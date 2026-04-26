import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

// Endpoint legado mantido por compat. /api/painel/stats é o novo (mais completo).
// FIX: appointments NAO tem tenant_id (usa doctor_id FK pra tenant_doctors).

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const supabase = supabaseAdmin();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Doctor IDs do tenant
  const { data: doctorRows } = await supabase
    .from('tenant_doctors')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');
  const doctorIds = (doctorRows ?? []).map((d) => d.id);

  const [
    apptsCountRes,
    { count: patientsTotal },
    { data: feedbacks },
    { data: payments },
    { count: messagesCount },
  ] = await Promise.all([
    doctorIds.length === 0
      ? Promise.resolve({ count: 0 })
      : supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .in('doctor_id', doctorIds)
          .gte('appointment_date', monthStart.toISOString()),
    supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    supabase
      .from('patient_feedback')
      .select('nps_score')
      .eq('tenant_id', tenantId)
      .not('nps_score', 'is', null),
    supabase
      .from('tenant_payments')
      .select('consultation_value, status, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', monthStart.toISOString()),
    supabase
      .from('n8n_historico_mensagens')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', monthStart.toISOString().slice(0, 19)),
  ]);

  const npsScores = (feedbacks ?? []).map((f) => f.nps_score as number).filter((s) => typeof s === 'number');
  const npsAvg = npsScores.length ? npsScores.reduce((a, b) => a + b, 0) / npsScores.length : null;
  const paid = (payments ?? []).filter(
    (p) => ['approved', 'paid', 'received', 'confirmed'].includes((p.status ?? '').toLowerCase())
  );
  const revenueMonth = paid.reduce((sum, p) => sum + Number(p.consultation_value || 0), 0);
  const pendingCount = (payments ?? []).filter((p) => (p.status ?? '').toLowerCase() === 'pending').length;

  return NextResponse.json({
    success: true,
    metrics: {
      appointments_month: apptsCountRes.count ?? 0,
      patients_total: patientsTotal ?? 0,
      nps_avg: npsAvg,
      nps_responses: npsScores.length,
      revenue_month: revenueMonth,
      payments_pending: pendingCount,
      doctors_active: doctorIds.length,
      messages_month: messagesCount ?? 0,
    },
  });
}
