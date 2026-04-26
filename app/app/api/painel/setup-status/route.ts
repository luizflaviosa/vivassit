import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

// Avalia o que falta configurar pra clinica ficar 100% pronta.
// Usado pelo SetupChecklist component no /painel.

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;
  const supabase = supabaseAdmin();

  const [
    { data: doctors },
    { data: tenant },
    { data: payments },
  ] = await Promise.all([
    supabase
      .from('tenant_doctors')
      .select('id, calendar_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
    supabase
      .from('tenants')
      .select('clinic_name, real_phone, assistant_prompt')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase
      .from('tenant_payments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
  ]);

  const doctorList = doctors ?? [];
  const has_doctor = doctorList.length > 0;
  const has_calendar = doctorList.some((d) => !!d.calendar_id);
  const has_ai_prompt = !!(tenant?.assistant_prompt && tenant.assistant_prompt.trim().length > 20);
  const has_clinic_data = !!(tenant?.clinic_name && tenant?.real_phone);
  const has_payment = (payments?.length ?? 0) > 0;

  return NextResponse.json({
    success: true,
    status: { has_doctor, has_calendar, has_payment, has_ai_prompt, has_clinic_data },
  });
}
