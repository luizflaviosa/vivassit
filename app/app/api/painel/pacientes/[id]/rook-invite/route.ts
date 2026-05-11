import { NextRequest, NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';

const INVITE_ROLES: MemberRole[] = ['owner', 'admin', 'doctor', 'staff'];

// Convida paciente a conectar Apple Saude/Health Connect via Rook Extraction App.
// Fluxo:
// 1. Bind user no Rook Extraction App via POST /user_extraction_app
//    (endpoint que gera o deep-link/QR pra abrir o app pre-configurado)
// 2. Resposta do Rook traz uma URL que ja abre o app na App Store (iOS) ou
//    direto no app instalado, com client_uuid + user_id no scheme.
// 3. Envia WhatsApp via Chatwoot API:
//    a) busca/cria contato pelo phone
//    b) cria conversation no inbox configurado
//    c) POST message com a URL do Extraction App
// 4. Marca patients.rook_user_id + rook_invited_at
//
// Chatwoot -> Evolution -> WhatsApp (transparente).

interface RookBindingResponse {
  // POST /api/v1/extraction_app/binding/ retorna universal_link + qr_code.
  // Mantemos campos alternativos por compatibilidade caso payload varie.
  universal_link?: string;
  qr_code?: string;
  url?: string;
  app_url?: string;
  link?: string;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  if (!INVITE_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }

  const patientId = parseInt(params.id, 10);
  if (isNaN(patientId)) {
    return NextResponse.json({ success: false, error: 'invalid_id' }, { status: 400 });
  }

  const supa = supabaseAdmin();
  const { data: patient } = await supa
    .from('patients')
    .select('id, tenant_id, name, phone, rook_user_id, rook_invited_at')
    .eq('id', patientId)
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .maybeSingle();

  if (!patient) {
    return NextResponse.json({ success: false, error: 'patient_not_found' }, { status: 404 });
  }
  if (!patient.phone) {
    return NextResponse.json({ success: false, error: 'patient_without_phone' }, { status: 400 });
  }

  const clientUuid = process.env.ROOK_CLIENT_UUID;
  const apiKey = process.env.ROOK_API_KEY;
  if (!clientUuid || !apiKey) {
    return NextResponse.json({ success: false, error: 'rook_not_configured' }, { status: 500 });
  }

  // user_id format: regex Rook ^[a-zA-Z0-9\-]{1,50}$ — so hifens, no underscores.
  const desiredUserId = `singulare-pat-${patient.id}`;
  const rookUserId = patient.rook_user_id && /^[a-zA-Z0-9-]{1,50}$/.test(patient.rook_user_id)
    ? patient.rook_user_id
    : desiredUserId;

  // Carrega tenant cedo (precisamos do clinic_name no metadata do binding)
  const { data: tenant } = await supa
    .from('tenants')
    .select('clinic_name, chatwoot_url, chatwoot_account_id, chatwoot_inbox_id')
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .maybeSingle();

  const apiBaseUrl = process.env.ROOK_API_URL ?? 'https://api.rook-connect.review/api/v1';
  const connectionsBase = process.env.ROOK_CONNECTIONS_BASE_URL ?? 'https://connections.rook-connect.review';
  const supportUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/privacidade/saude`
    : 'https://singulare.org/privacidade/saude';

  // POST /api/v1/extraction_app/binding/ — endpoint oficial de binding.
  // Doc Rook: retorna { universal_link, qr_code (base64 PNG) }.
  // Trailing slash no path eh obrigatorio (rota /binding/, nao /binding).
  const basicAuth = `Basic ${Buffer.from(`${clientUuid}:${apiKey}`).toString('base64')}`;
  const bindingPayload = JSON.stringify({
    user_id: rookUserId,
    metadata: {
      client_name: tenant?.clinic_name ?? 'Singulare',
      support_url: supportUrl,
      complete_log_out: false,
    },
    salt: rookUserId, // unico por user, usado como anti-replay
  });

  let bindingRaw: unknown = null;
  let bindingUrl: string | null = null;
  let rookOk = false;
  let rookError: string | null = null;

  try {
    const r = await fetch(`${apiBaseUrl}/extraction_app/binding/`, {
      method: 'POST',
      headers: {
        'Authorization': basicAuth,
        'Content-Type': 'application/json',
      },
      body: bindingPayload,
      signal: AbortSignal.timeout(10000),
    });
    const txt = await r.text();
    try {
      bindingRaw = JSON.parse(txt);
    } catch {
      bindingRaw = txt;
    }
    rookOk = r.ok;
    if (!r.ok) {
      rookError = `HTTP ${r.status}: ${typeof bindingRaw === 'string' ? bindingRaw.slice(0, 200) : JSON.stringify(bindingRaw).slice(0, 200)}`;
    } else if (bindingRaw && typeof bindingRaw === 'object') {
      const b = bindingRaw as RookBindingResponse;
      bindingUrl = b.universal_link ?? b.url ?? b.app_url ?? b.link ?? null;
    }
  } catch (e) {
    rookError = e instanceof Error ? e.message : String(e);
  }

  // Fallback URL: connections page (caso Rook nao retorne universal_link)
  const fallbackConnectionUrl = `${connectionsBase}/client_uuid/${clientUuid}/user_id/${rookUserId}`;
  const finalUrl = bindingUrl ?? fallbackConnectionUrl;

  const chatwootKey = process.env.CHATWOOT_API_KEY;
  const chatwootUrl = tenant?.chatwoot_url?.replace(/\/$/, '');
  const accountId = tenant?.chatwoot_account_id;
  const inboxId = tenant?.chatwoot_inbox_id;

  if (!chatwootKey || !chatwootUrl || !accountId || !inboxId) {
    return NextResponse.json({
      success: false,
      error: 'chatwoot_not_configured',
      missing: {
        api_key: !chatwootKey,
        chatwoot_url: !chatwootUrl,
        account_id: !accountId,
        inbox_id: !inboxId,
      },
      connection_url: finalUrl,
      rook_ok: rookOk,
      rook_error: rookError,
      binding_raw: bindingRaw,
    }, { status: 500 });
  }

  const firstName = (patient.name ?? 'paciente').split(' ')[0];
  const clinicName = tenant?.clinic_name ?? 'Singulare';
  const messageText = `Olá, ${firstName}.\n\nA ${clinicName} liberou acesso ao monitoramento contínuo dos seus dados de saúde (frequência cardíaca, sono, atividade). Isso permite ao seu médico acompanhar a evolução do tratamento com dados reais.\n\nClique no link, instale o app Rook Extraction (se ainda não tem) e autorize o acesso ao app Saúde do iPhone:\n\n${finalUrl}\n\nO setup leva 2 minutos. Qualquer dúvida, responda esta mensagem.`;

  // Normaliza phone (Chatwoot espera E.164 com +)
  const phone = patient.phone.startsWith('+') ? patient.phone : `+${patient.phone}`;
  const chatwootHeaders = {
    'api_access_token': chatwootKey,
    'Content-Type': 'application/json',
  };

  let chatwootSent = false;
  let chatwootError: string | null = null;
  let conversationId: number | null = null;
  let contactId: number | null = null;

  try {
    // 1. Search contact by phone
    const searchRes = await fetch(`${chatwootUrl}/api/v1/accounts/${accountId}/contacts/search?q=${encodeURIComponent(phone)}&include=contact_inboxes`, {
      headers: chatwootHeaders,
      signal: AbortSignal.timeout(10000),
    });
    if (searchRes.ok) {
      const sj = await searchRes.json() as { payload?: Array<{ id: number; phone_number?: string | null }> };
      const match = sj.payload?.find((c) => c.phone_number === phone);
      if (match) contactId = match.id;
    }

    // 2. Create contact if not found
    if (!contactId) {
      const createRes = await fetch(`${chatwootUrl}/api/v1/accounts/${accountId}/contacts`, {
        method: 'POST',
        headers: chatwootHeaders,
        body: JSON.stringify({
          inbox_id: inboxId,
          name: patient.name ?? firstName,
          phone_number: phone,
          identifier: `singulare_pat_${patient.id}`,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!createRes.ok) {
        const txt = await createRes.text().catch(() => '');
        throw new Error(`contact_create_failed: HTTP ${createRes.status} ${txt.slice(0, 200)}`);
      }
      const cj = await createRes.json() as { payload?: { contact?: { id?: number } } };
      contactId = cj.payload?.contact?.id ?? null;
      if (!contactId) throw new Error('contact_create_no_id');
    }

    // 3. Create new conversation (Chatwoot dedup nao funciona via API simples;
    //    cria nova - paciente recebe na thread, secretaria humana ve normal)
    const convRes = await fetch(`${chatwootUrl}/api/v1/accounts/${accountId}/conversations`, {
      method: 'POST',
      headers: chatwootHeaders,
      body: JSON.stringify({
        source_id: phone,
        inbox_id: inboxId,
        contact_id: contactId,
        message: { content: messageText },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!convRes.ok) {
      const txt = await convRes.text().catch(() => '');
      throw new Error(`conversation_create_failed: HTTP ${convRes.status} ${txt.slice(0, 200)}`);
    }
    const cv = await convRes.json() as { id?: number };
    conversationId = cv.id ?? null;
    chatwootSent = true;
  } catch (e) {
    chatwootError = e instanceof Error ? e.message : String(e);
  }

  // Atualiza paciente (mesmo se falhou - marca tentativa)
  await supa
    .from('patients')
    .update({
      rook_user_id: rookUserId,
      rook_invited_at: new Date().toISOString(),
    })
    .eq('id', patientId);

  return NextResponse.json({
    success: chatwootSent && rookOk,
    rook_user_id: rookUserId,
    extraction_app_url: finalUrl,
    rook_ok: rookOk,
    rook_error: rookError,
    binding_raw: bindingRaw,
    chatwoot_sent: chatwootSent,
    chatwoot_error: chatwootError,
    chatwoot_contact_id: contactId,
    chatwoot_conversation_id: conversationId,
  });
}
