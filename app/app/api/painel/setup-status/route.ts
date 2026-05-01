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
      .select('id, calendar_id, consultation_value, working_hours')
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
    supabase
      .from('tenants')
      .select('clinic_name, real_phone, assistant_prompt, address')
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
  const has_clinic_data = !!(tenant?.clinic_name && tenant?.real_phone && tenant?.address);
  const has_payment = (payments?.length ?? 0) > 0;

  // Profissional "configurado" = tem valor da consulta E horários definidos.
  // O agente IA precisa desses 2 pra cotar consulta e responder horários.
  // Demais campos (convênio/payment_methods) são opcionais.
  const isDoctorConfigured = (d: { consultation_value: number | string | null; working_hours: Record<string, unknown> | null }) => {
    const hasValue = d.consultation_value != null && Number(d.consultation_value) > 0;
    const hasHours = !!d.working_hours && typeof d.working_hours === 'object' && Object.keys(d.working_hours).length > 0;
    return hasValue && hasHours;
  };
  const doctorsTotal = doctorList.length;
  const doctorsConfigured = doctorList.filter(isDoctorConfigured).length;
  const has_doctors_configured = doctorsTotal > 0 && doctorsConfigured === doctorsTotal;
  const doctors_incomplete = doctorList
    .filter((d) => !isDoctorConfigured(d))
    .map((d) => d.id);

  return NextResponse.json({
    success: true,
    status: {
      has_doctor,
      has_calendar,
      has_payment,
      has_ai_prompt,
      has_clinic_data,
      has_doctors_configured,
      doctors_total: doctorsTotal,
      doctors_configured: doctorsConfigured,
      doctors_incomplete,
    },
  });
}
