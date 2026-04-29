import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { decryptString } from '@/lib/crypto';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { estimateFee, type PaymentMethod } from '@/lib/asaas-fees';

// Endpoint chamado pelo N8N (agente IA) quando precisa cobrar um paciente
// usando a SUBCONTA Asaas da clinica (nao a conta master Vivassit).
//
// Fluxo:
//   N8N → POST /api/marketplace/charge
//   Vercel: valida token, busca subconta apiKey criptografada do tenant,
//           cria customer + payment via Asaas (com apiKey da subconta),
//           salva em tenant_payments, retorna link/QR/barcode
//   N8N: envia link via WhatsApp pro paciente
//
// Auth: header `Authorization: Bearer <N8N_TO_VERCEL_TOKEN>`
// (token compartilhado, configurado em env var)

interface ChargeRequest {
  tenant_id: string;
  patient: {
    name: string;
    cpfCnpj: string;
    email?: string;
    phone: string;
  };
  doctor_name?: string;
  consultation_date?: string;
  consultation_value: number;
  method: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';
  description?: string;
  external_reference?: string;
  conversation_id?: string;
}

interface AsaasError {
  errors?: Array<{ description?: string; code?: string }>;
}

const ASAAS_URL =
  process.env.ASAAS_API_URL?.replace(/\/$/, '') || 'https://sandbox.asaas.com/api/v3';

async function asaasCallWithKey<T>(
  apiKey: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${ASAAS_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
      'User-Agent': 'Vivassit/1.0',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  if (!res.ok) {
    const e = json as AsaasError;
    const msg = e?.errors?.[0]?.description ?? `Asaas ${path} retornou ${res.status}`;
    const err = new Error(msg) as Error & { status?: number; body?: unknown };
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json as T;
}

export async function POST(req: NextRequest) {
  // Rate limit por IP: 100/min (gostoso pra N8N rajadas, restritivo p/ abuse)
  const ip = getClientIp(req);
  const rl = rateLimit(`charge:${ip}`, { max: 100, windowMs: 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: 'rate_limited', retry_after: rl.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } }
    );
  }

  // Auth: token compartilhado N8N ↔ Vercel
  const authHeader = req.headers.get('authorization') ?? '';
  const expected = process.env.N8N_TO_VERCEL_TOKEN;
  if (!expected) {
    console.error('[marketplace/charge] N8N_TO_VERCEL_TOKEN nao configurado');
    return NextResponse.json(
      { success: false, message: 'server_misconfigured' },
      { status: 500 }
    );
  }
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json(
      { success: false, message: 'unauthorized' },
      { status: 401 }
    );
  }

  let body: ChargeRequest;
  try {
    body = (await req.json()) as ChargeRequest;
  } catch {
    return NextResponse.json({ success: false, message: 'JSON inválido' }, { status: 400 });
  }

  if (!body.tenant_id || !body.patient?.name || !body.patient?.phone) {
    return NextResponse.json(
      { success: false, message: 'tenant_id e dados do paciente obrigatórios' },
      { status: 400 }
    );
  }
  if (!body.consultation_value || body.consultation_value <= 0) {
    return NextResponse.json(
      { success: false, message: 'consultation_value deve ser > 0' },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();

  // Busca tenant + apiKey criptografada
  const { data: tenant } = await supabase
    .from('tenants')
    .select('tenant_id, asaas_account_id, asaas_account_status')
    .eq('tenant_id', body.tenant_id)
    .maybeSingle();

  if (!tenant?.asaas_account_id) {
    return NextResponse.json(
      {
        success: false,
        message: 'Tenant não tem subconta Asaas ativada. Acesse /painel/pagamentos/ativar',
      },
      { status: 400 }
    );
  }

  const { data: keyRow } = await supabase
    .from('tenant_api_keys')
    .select('api_key_encrypted')
    .eq('tenant_id', body.tenant_id)
    .eq('service_name', 'asaas')
    .eq('status', 'active')
    .maybeSingle();

  if (!keyRow?.api_key_encrypted) {
    return NextResponse.json(
      { success: false, message: 'API key da subconta não encontrada' },
      { status: 500 }
    );
  }

  let apiKey: string;
  try {
    apiKey = decryptString(keyRow.api_key_encrypted);
  } catch (e) {
    console.error('[marketplace/charge] decrypt erro:', e);
    return NextResponse.json(
      { success: false, message: 'Falha ao descriptografar credenciais' },
      { status: 500 }
    );
  }

  const externalRef =
    body.external_reference ?? `pat-${body.tenant_id}-${Date.now()}`;

  // Cria/recupera customer no Asaas (na SUBCONTA do tenant)
  let customerId: string;
  try {
    const cleanedCpf = body.patient.cpfCnpj?.replace(/\D/g, '') ?? '';
    if (cleanedCpf.length >= 11) {
      const existing = await asaasCallWithKey<{ data: Array<{ id: string }> }>(
        apiKey,
        `/customers?cpfCnpj=${encodeURIComponent(cleanedCpf)}&limit=1`
      );
      if (existing?.data?.length > 0) {
        customerId = existing.data[0].id;
      } else {
        const created = await asaasCallWithKey<{ id: string }>(apiKey, `/customers`, {
          method: 'POST',
          body: JSON.stringify({
            name: body.patient.name,
            email: body.patient.email,
            cpfCnpj: cleanedCpf,
            mobilePhone: body.patient.phone.replace(/\D/g, ''),
            externalReference: body.tenant_id,
          }),
        });
        customerId = created.id;
      }
    } else {
      // Sem CPF: cria sem cpfCnpj (Asaas aceita pra cobranca anonima)
      const created = await asaasCallWithKey<{ id: string }>(apiKey, `/customers`, {
        method: 'POST',
        body: JSON.stringify({
          name: body.patient.name,
          email: body.patient.email,
          mobilePhone: body.patient.phone.replace(/\D/g, ''),
          externalReference: body.tenant_id,
        }),
      });
      customerId = created.id;
    }
  } catch (e) {
    const err = e as Error & { status?: number; body?: unknown };
    console.error('[marketplace/charge] customer erro:', err.message);
    return NextResponse.json(
      {
        success: false,
        message: 'Falha ao criar/buscar paciente no Asaas',
        detail: err.body,
      },
      { status: err.status || 500 }
    );
  }

  // Cria payment na SUBCONTA
  const dueDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  let payment;
  try {
    payment = await asaasCallWithKey<{
      id: string;
      status: string;
      value: number;
      invoiceUrl?: string;
      bankSlipUrl?: string;
      pixTransaction?: unknown;
    }>(apiKey, `/payments`, {
      method: 'POST',
      body: JSON.stringify({
        customer: customerId,
        billingType: body.method ?? 'UNDEFINED',
        value: body.consultation_value,
        dueDate,
        description:
          body.description ??
          `Consulta${body.doctor_name ? ' com ' + body.doctor_name : ''}${
            body.consultation_date ? ' em ' + body.consultation_date : ''
          }`,
        externalReference: externalRef,
      }),
    });
  } catch (e) {
    const err = e as Error & { status?: number; body?: unknown };
    console.error('[marketplace/charge] payment erro:', err.message);
    return NextResponse.json(
      { success: false, message: err.message, detail: err.body },
      { status: err.status || 500 }
    );
  }

  // Busca QR PIX se aplicavel
  let pix: { qrCodeImage: string; qrCodePayload: string } | null = null;
  if (body.method === 'PIX') {
    try {
      const qr = await asaasCallWithKey<{ encodedImage: string; payload: string }>(
        apiKey,
        `/payments/${payment.id}/pixQrCode`
      );
      pix = { qrCodeImage: qr.encodedImage, qrCodePayload: qr.payload };
    } catch {
      // PIX nao disponivel ainda - frontend pode usar invoiceUrl
    }
  }

  // Modelo B (pass-through): estima fee Asaas pra UI antecipada.
  // Valor REAL do fee vem no webhook quando paid → tenant_payments.asaas_fee_value.
  const feeEstimate = estimateFee(body.consultation_value, (body.method ?? 'UNDEFINED') as PaymentMethod);

  // Persiste em tenant_payments
  await supabase.from('tenant_payments').insert({
    tenant_id: body.tenant_id,
    external_reference: externalRef,
    asaas_payment_id: payment.id,
    asaas_customer_id: customerId,
    patient_name: body.patient.name,
    patient_email: body.patient.email,
    patient_phone: body.patient.phone,
    doctor_name: body.doctor_name ?? '',
    consultation_date: body.consultation_date ?? '',
    consultation_value: body.consultation_value,
    estimated_fee_value: feeEstimate.fee,
    conversation_id: body.conversation_id,
    status: 'pending',
    payment_method: body.method ?? 'UNDEFINED',
    payment_url: payment.invoiceUrl,
    provider: 'asaas',
  });

  return NextResponse.json({
    success: true,
    payment: {
      id: payment.id,
      status: payment.status,
      value: payment.value,
      invoiceUrl: payment.invoiceUrl,
      bankSlipUrl: payment.bankSlipUrl,
      external_reference: externalRef,
    },
    pix,
    fee_breakdown: {
      gross: feeEstimate.gross,
      estimated_fee: feeEstimate.fee,
      estimated_net: feeEstimate.net,
      is_promo_pricing: feeEstimate.isPromo,
    },
    // URL pronta pra mandar via WhatsApp:
    customer_message: pix?.qrCodePayload
      ? `*PIX copia e cola*\n\`\`\`${pix.qrCodePayload}\`\`\`\nOu pague pelo link: ${payment.invoiceUrl}`
      : `Sua cobrança de R$ ${body.consultation_value.toFixed(2)}: ${payment.invoiceUrl}`,
  });
}
