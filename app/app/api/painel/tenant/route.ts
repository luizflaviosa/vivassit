import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const supabase = supabaseAdmin();
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select(
      'tenant_id, clinic_name, cnpj, email, phone, real_phone, admin_email, accountant_email, address, doctor_name, doctor_crm, speciality, consultation_duration, establishment_type, chatwoot_type, plan_type, status, subscription_status, trial_ends_at, subscription_renews_at, assistant_prompt, rendered_prompt, payment_info, calendar_config, evolution_phone_number, evolution_status, asaas_account_status, telegram_chat_id, telegram_bot_link, elevenlabs_voice_id, created_at'
    )
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .maybeSingle();

  if (error || !tenant) {
    return NextResponse.json({ success: false, message: 'Tenant não encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true, tenant });
}

interface UpdateBody {
  assistant_prompt?: string;
  clinic_name?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  real_phone?: string;
  admin_email?: string;
  accountant_email?: string;
  address?: string;
  doctor_name?: string;
  doctor_crm?: string;
  speciality?: string;
  consultation_duration?: number;
  establishment_type?: string;
  evolution_phone_number?: string;
  elevenlabs_voice_id?: string;
  payment_info?: Record<string, unknown>;
}

export async function PATCH(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const body = (await req.json()) as UpdateBody;
  const allowed: Record<string, unknown> = {};

  // Whitelist de campos editáveis (texto/strings)
  const stringFields: (keyof UpdateBody)[] = [
    'assistant_prompt', 'clinic_name', 'cnpj', 'email', 'phone', 'real_phone',
    'admin_email', 'accountant_email', 'address', 'doctor_name', 'doctor_crm',
    'speciality', 'establishment_type', 'evolution_phone_number',
    'elevenlabs_voice_id',
  ];
  for (const f of stringFields) {
    const v = body[f];
    if (typeof v === 'string') {
      // Strings vazias são permitidas (limpar campo); mas se trim vazia, trata como null
      allowed[f] = v.trim() === '' ? null : v.trim();
    }
  }

  // Numéricos
  if (typeof body.consultation_duration === 'number') {
    allowed.consultation_duration = body.consultation_duration;
  }

  const supabase = supabaseAdmin();

  // Merge payment_info (jsonb) ao invés de sobrescrever
  if (body.payment_info && typeof body.payment_info === 'object') {
    const { data: current } = await supabase
      .from('tenants')
      .select('payment_info')
      .eq('tenant_id', auth.ctx.tenant.tenant_id)
      .maybeSingle();
    allowed.payment_info = { ...(current?.payment_info ?? {}), ...body.payment_info };
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ success: false, message: 'Nada para atualizar' }, { status: 400 });
  }

  allowed.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('tenants')
    .update(allowed)
    .eq('tenant_id', auth.ctx.tenant.tenant_id);

  if (error) {
    console.error('[painel/tenant PATCH] erro:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
