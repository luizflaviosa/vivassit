import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

// Stats agregadas pra Visao Geral do painel.
// Importante: tabela `appointments` NAO tem coluna tenant_id — relaciona via doctor_id (FK pra tenant_doctors).
// tenant_payments usa consultation_value (nao "amount") e approved_at.

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });

  const admin = supabaseAdmin();

  // Resolve tenant (suporta múltiplos)
  let { data: tenants } = await admin
    .from('tenants')
    .select('tenant_id, clinic_name')
    .eq('admin_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);

  let tenant = tenants?.[0];
  if (!tenant && user.email) {
    const { data: byEmail } = await admin
      .from('tenants')
      .select('tenant_id, clinic_name')
      .eq('admin_email', user.email)
      .order('created_at', { ascending: false })
      .limit(1);
    tenant = byEmail?.[0];
  }
  if (!tenant) return NextResponse.json({ success: false, error: 'no_tenant' }, { status: 404 });

  const tenantId = tenant.tenant_id;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const sevenDaysAhead = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const sixMonthsAgo = new Date(Date.now() - 180 * 86_400_000).toISOString();

  // Pega doctor_ids do tenant (precisa pra filtrar appointments)
  const { data: doctorRows } = await admin
    .from('tenant_doctors')
    .select('id, doctor_name')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');
  const doctorIds = (doctorRows ?? []).map((d) => d.id);
  const doctorNameById = new Map((doctorRows ?? []).map((d) => [d.id, d.doctor_name]));

  // Roda em paralelo
  const [
    patientsTotal,
    patientsNewMonth,
    apptsUpcoming,
    apptsNext7d,
    apptsTotalMonth,
    feedbackList,
    paymentsMonth,
    weeklySeries,
  ] = await Promise.all([
    admin.from('patients').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    admin.from('patients').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', startOfMonth),
    doctorIds.length === 0
      ? Promise.resolve({ data: [], count: 0 })
      : admin
          .from('appointments')
          .select('id, patient_id, doctor_id, appointment_date, status', { count: 'exact' })
          .in('doctor_id', doctorIds)
          .gte('appointment_date', now.toISOString())
          .order('appointment_date', { ascending: true })
          .limit(5),
    doctorIds.length === 0
      ? Promise.resolve({ data: null, count: 0 })
      : admin
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .in('doctor_id', doctorIds)
          .gte('appointment_date', now.toISOString())
          .lte('appointment_date', sevenDaysAhead),
    doctorIds.length === 0
      ? Promise.resolve({ data: null, count: 0 })
      : admin
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .in('doctor_id', doctorIds)
          .gte('appointment_date', startOfMonth),
    admin
      .from('patient_feedback')
      .select('nps_score, sent_at, responded_at')
      .eq('tenant_id', tenantId)
      .gte('sent_at', thirtyDaysAgo),
    admin
      .from('tenant_payments')
      .select('consultation_value, status, approved_at, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', startOfMonth),
    doctorIds.length === 0
      ? Promise.resolve({ data: [] })
      : admin
          .from('appointments')
          .select('appointment_date')
          .in('doctor_id', doctorIds)
          .gte('appointment_date', sixMonthsAgo)
          .order('appointment_date', { ascending: true }),
  ]);

  // NPS
  type Fb = { nps_score: number | null; responded_at: string | null };
  const responded = (feedbackList.data ?? []).filter((f: Fb) => f.responded_at && typeof f.nps_score === 'number');
  const npsAvg = responded.length > 0
    ? responded.reduce((a, f: Fb) => a + (f.nps_score ?? 0), 0) / responded.length
    : null;
  const promoters = responded.filter((f: Fb) => (f.nps_score ?? 0) >= 9).length;
  const detractors = responded.filter((f: Fb) => (f.nps_score ?? 0) <= 6).length;
  const npsScore = responded.length > 0 ? Math.round(((promoters - detractors) / responded.length) * 100) : null;

  // Faturamento (consultation_value)
  type Pay = { consultation_value: number | null; status: string | null };
  const paymentsConfirmed = (paymentsMonth.data ?? []).filter(
    (p: Pay) => ['paid', 'received', 'approved', 'confirmed'].includes((p.status ?? '').toLowerCase())
  );
  const revenueMonth = paymentsConfirmed.reduce(
    (a, p: Pay) => a + (Number(p.consultation_value) || 0),
    0
  );

  // Série semanal
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
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    if (key in weekBuckets) weekBuckets[key]++;
  });
  const series = Object.entries(weekBuckets).map(([date, count]) => ({ date, count }));

  // Enrich upcoming com doctor_name
  type Appt = { id: string; patient_id: string | null; doctor_id: string; appointment_date: string; status: string };
  const upcomingEnriched = (apptsUpcoming.data ?? []).map((a: Appt) => ({
    id: a.id,
    patient_name: null, // patients table indexada por uuid, sem name direto aqui
    doctor_name: doctorNameById.get(a.doctor_id) ?? null,
    appointment_date: a.appointment_date,
    status: a.status,
  }));

  return NextResponse.json({
    success: true,
    tenant: { id: tenant.tenant_id, name: tenant.clinic_name },
    stats: {
      patients_total: patientsTotal.count ?? 0,
      patients_new_month: patientsNewMonth.count ?? 0,
      appts_upcoming: apptsUpcoming.count ?? 0,
      appts_next_7d: apptsNext7d.count ?? 0,
      appts_total_month: apptsTotalMonth.count ?? 0,
      doctors_active: doctorIds.length,
      revenue_month: revenueMonth,
      revenue_count: paymentsConfirmed.length,
      nps_avg: npsAvg,
      nps_score: npsScore,
      nps_responses: responded.length,
      nps_promoters: promoters,
      nps_detractors: detractors,
    },
    upcoming: upcomingEnriched,
    series,
  });
}
