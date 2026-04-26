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
      'tenant_id, clinic_name, email, phone, real_phone, admin_email, doctor_name, doctor_crm, speciality, consultation_duration, establishment_type, chatwoot_type, plan_type, status, subscription_status, trial_ends_at, subscription_renews_at, assistant_prompt, payment_info, calendar_config, created_at'
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
  admin_email?: string;
  real_phone?: string;
  payment_info?: Record<string, unknown>;
}

export async function PATCH(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const body = (await req.json()) as UpdateBody;
  const allowed: Record<string, unknown> = {};
  if (typeof body.assistant_prompt === 'string') allowed.assistant_prompt = body.assistant_prompt;
  if (typeof body.clinic_name === 'string' && body.clinic_name.trim()) allowed.clinic_name = body.clinic_name.trim();
  if (typeof body.admin_email === 'string' && body.admin_email.trim()) allowed.admin_email = body.admin_email.trim();
  if (typeof body.real_phone === 'string' && body.real_phone.trim()) allowed.real_phone = body.real_phone.trim();

  const supabase = supabaseAdmin();

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
