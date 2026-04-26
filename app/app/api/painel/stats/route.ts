import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

// Stats agregadas pra Visao Geral do painel (1 chamada → varios contadores).
// Tudo escopado por tenant_id resolvido a partir da sessao.

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });

  const admin = supabaseAdmin();

  // Resolve tenant
  let { data: tenant } = await admin
    .from('tenants')
    .select('tenant_id, clinic_name')
    .eq('admin_user_id', user.id)
    .maybeSingle();

  if (!tenant && user.email) {
    const { data: list } = await admin
      .from('tenants')
      .select('tenant_id, clinic_name')
      .eq('admin_email', user.email)
      .order('created_at', { ascending: false })
      .limit(1);
    tenant = list?.[0] ?? null;
  }
  if (!tenant) return NextResponse.json({ success: false, error: 'no_tenant' }, { status: 404 });

  const tenantId = tenant.tenant_id;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const sevenDaysAhead = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const sixMonthsAgo = new Date(Date.now() - 180 * 86_400_000).toISOString();

  // Roda em paralelo
  const [
    patientsTotal,
    patientsNewMonth,
    apptsUpcoming,
    apptsNext7d,
    apptsTotalMonth,
    feedbackList,
    doctorsActive,
    paymentsMonth,
    weeklySeries,
  ] = await Promise.all([
    admin.from('patients').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    admin.from('patients').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', startOfMonth),
    admin
      .from('appointments')
      .select('id, patient_name, doctor_name, appointment_date, status', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .gte('appointment_date', now.toISOString())
      .order('appointment_date', { ascending: true })
      .limit(5),
    admin
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('appointment_date', now.toISOString())
      .lte('appointment_date', sevenDaysAhead),
    admin
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('appointment_date', startOfMonth),
    admin
      .from('patient_feedback')
      .select('nps_score, sent_at, responded_at')
      .eq('tenant_id', tenantId)
      .gte('sent_at', thirtyDaysAgo),
    admin
      .from('tenant_doctors')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
    admin
      .from('tenant_payments')
      .select('amount, status, paid_at, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', startOfMonth),
    admin
      .from('appointments')
      .select('appointment_date')
      .eq('tenant_id', tenantId)
      .gte('appointment_date', sixMonthsAgo)
      .order('appointment_date', { ascending: true }),
  ]);

  // NPS médio + breakdown
  const responded = (feedbackList.data ?? []).filter((f: { nps_score: number | null; responded_at: string | null }) => f.responded_at && typeof f.nps_score === 'number');
  const npsAvg = responded.length > 0
    ? responded.reduce((a: number, f: { nps_score: number | null }) => a + (f.nps_score ?? 0), 0) / responded.length
    : null;
  const promoters = responded.filter((f: { nps_score: number | null }) => (f.nps_score ?? 0) >= 9).length;
  const detractors = responded.filter((f: { nps_score: number | null }) => (f.nps_score ?? 0) <= 6).length;
  const npsScore = responded.length > 0
    ? Math.round(((promoters - detractors) / responded.length) * 100)
    : null;

  // Faturamento do mês (pagamentos confirmados)
  const paymentsConfirmed = (paymentsMonth.data ?? []).filter(
    (p: { status: string | null }) => ['paid', 'received', 'approved', 'confirmed'].includes((p.status ?? '').toLowerCase())
  );
  const revenueMonth = paymentsConfirmed.reduce(
    (a: number, p: { amount: number | null }) => a + (Number(p.amount) || 0),
    0
  );

  // Série semanal pra mini chart (últimas 12 semanas)
  const weekBuckets: Record<string, number> = {};
  const today = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i * 7);
    const key = d.toISOString().slice(0, 10);
    weekBuckets[key] = 0;
  }
  (weeklySeries.data ?? []).forEach((row: { appointment_date: string }) => {
    const d = new Date(row.appointment_date);
    // bucket = início da semana (domingo)
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    if (key in weekBuckets) weekBuckets[key]++;
  });
  const series = Object.entries(weekBuckets).map(([date, count]) => ({ date, count }));

  return NextResponse.json({
    success: true,
    tenant: { id: tenant.tenant_id, name: tenant.clinic_name },
    stats: {
      patients_total: patientsTotal.count ?? 0,
      patients_new_month: patientsNewMonth.count ?? 0,
      appts_upcoming: apptsUpcoming.count ?? 0,
      appts_next_7d: apptsNext7d.count ?? 0,
      appts_total_month: apptsTotalMonth.count ?? 0,
      doctors_active: doctorsActive.count ?? 0,
      revenue_month: revenueMonth,
      revenue_count: paymentsConfirmed.length,
      nps_avg: npsAvg,
      nps_score: npsScore,
      nps_responses: responded.length,
      nps_promoters: promoters,
      nps_detractors: detractors,
    },
    upcoming: apptsUpcoming.data ?? [],
    series,
  });
}
