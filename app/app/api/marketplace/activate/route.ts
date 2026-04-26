import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';
import { createSubaccount, type CreateSubaccountInput, type AsaasPersonType } from '@/lib/asaas';
import { encryptString, ENCRYPTION_KEY_ID } from '@/lib/crypto';

interface RequestBody {
  // Dados da empresa/profissional
  name: string;                  // razao social ou nome PF
  cpfCnpj: string;
  personType: AsaasPersonType;   // FISICA | JURIDICA
  birthDate?: string;            // YYYY-MM-DD (PF)
  companyType?: 'MEI' | 'LIMITED' | 'INDIVIDUAL' | 'ASSOCIATION';

  // Contato
  email: string;
  mobilePhone: string;
  site?: string;
  incomeValue: number;           // faturamento mensal estimado

  // Endereco
  postalCode: string;
  address: string;
  addressNumber: string;
  complement?: string;
  province: string;              // bairro
  city?: string;
  state?: string;
}

export async function POST(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ success: false, message: 'JSON inválido' }, { status: 400 });
  }

  // Validacao
  const required: Array<keyof RequestBody> = [
    'name', 'cpfCnpj', 'personType', 'email', 'mobilePhone',
    'incomeValue', 'postalCode', 'address', 'addressNumber', 'province',
  ];
  for (const f of required) {
    if (!body[f] && body[f] !== 0) {
      return NextResponse.json(
        { success: false, message: `Campo obrigatório: ${f}` },
        { status: 400 }
      );
    }
  }

  if (body.personType === 'FISICA' && !body.birthDate) {
    return NextResponse.json(
      { success: false, message: 'Data de nascimento obrigatória para PF' },
      { status: 400 }
    );
  }
  if (body.personType === 'JURIDICA' && !body.companyType) {
    return NextResponse.json(
      { success: false, message: 'Tipo de empresa obrigatório para PJ' },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();

  // Ja ativada?
  const { data: tenant } = await supabase
    .from('tenants')
    .select('asaas_account_id, asaas_account_status')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (tenant?.asaas_account_id && tenant.asaas_account_status === 'active') {
    return NextResponse.json(
      { success: false, message: 'Conta marketplace já está ativa' },
      { status: 409 }
    );
  }

  // Cria subconta no Asaas
  let subaccount;
  try {
    const input: CreateSubaccountInput = {
      name: body.name,
      email: body.email,
      cpfCnpj: body.cpfCnpj,
      personType: body.personType,
      birthDate: body.birthDate,
      companyType: body.companyType,
      mobilePhone: body.mobilePhone,
      site: body.site,
      incomeValue: body.incomeValue,
      address: body.address,
      addressNumber: body.addressNumber,
      complement: body.complement,
      province: body.province,
      city: body.city,
      state: body.state,
      postalCode: body.postalCode,
    };
    subaccount = await createSubaccount(input);
  } catch (error) {
    const err = error as Error & { status?: number; body?: unknown };
    console.error('[marketplace/activate] Asaas erro:', err.message, err.body);
    return NextResponse.json(
      {
        success: false,
        message: err.message || 'Erro ao criar subconta no Asaas',
        detail: err.body,
      },
      { status: err.status || 500 }
    );
  }

  // Salva apiKey criptografada em tenant_api_keys
  let apiKeyStored = false;
  try {
    const encrypted = encryptString(subaccount.apiKey);
    const { error: keyErr } = await supabase.from('tenant_api_keys').insert({
      tenant_id: tenantId,
      service_name: 'asaas',
      api_key_encrypted: encrypted,
      encryption_key_id: ENCRYPTION_KEY_ID,
      status: 'active',
    });
    if (keyErr) {
      console.error('[marketplace/activate] erro salvando apiKey:', keyErr);
    } else {
      apiKeyStored = true;
    }
  } catch (e) {
    console.error('[marketplace/activate] criptografia falhou:', e);
    // Loga mas nao bloqueia - admin pode resetar depois
  }

  // Atualiza tenant com IDs Asaas
  await supabase
    .from('tenants')
    .update({
      asaas_account_id: subaccount.id,
      asaas_wallet_id: subaccount.walletId,
      asaas_account_status: subaccount.status?.general ?? 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId);

  return NextResponse.json({
    success: true,
    message:
      'Subconta criada! Asaas pode levar até 24h para aprovação documental.',
    subaccount: {
      id: subaccount.id,
      walletId: subaccount.walletId,
      status: subaccount.status,
    },
    api_key_stored: apiKeyStored,
  });
}

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from('tenants')
    .select('asaas_account_id, asaas_wallet_id, asaas_account_status')
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .maybeSingle();

  return NextResponse.json({
    success: true,
    activated: !!data?.asaas_account_id,
    asaas_account_id: data?.asaas_account_id ?? null,
    asaas_wallet_id: data?.asaas_wallet_id ?? null,
    status: data?.asaas_account_status ?? 'not_started',
  });
}
