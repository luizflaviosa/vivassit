import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenant');
  if (!tenantId) {
    return NextResponse.json({ success: false, message: 'tenant obrigatório' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Em paralelo: consultas mes, pacientes ativos, NPS medio, faturamento
  const [
    { count: appointmentsMonth },
    { count: patientsTotal },
    { data: feedbacks },
    { data: payments },
    { count: doctorsCount },
    { count: messagesCount },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', tenantId) // appointments usa uuid de users; placeholder ate auth
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
      .from('tenant_doctors')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),
    supabase
      .from('n8n_historico_mensagens')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', monthStart.toISOString().slice(0, 19)),
  ]);

  const npsScores = (feedbacks ?? []).map((f) => f.nps_score as number).filter((s) => typeof s === 'number');
  const npsAvg = npsScores.length
    ? npsScores.reduce((a, b) => a + b, 0) / npsScores.length
    : null;

  const paid = (payments ?? []).filter((p) => p.status === 'approved' || p.status === 'paid');
  const revenueMonth = paid.reduce((sum, p) => sum + Number(p.consultation_value || 0), 0);
  const pendingCount = (payments ?? []).filter((p) => p.status === 'pending').length;

  return NextResponse.json({
    success: true,
    metrics: {
      appointments_month: appointmentsMonth ?? 0,
      patients_total: patientsTotal ?? 0,
      nps_avg: npsAvg,
      nps_responses: npsScores.length,
      revenue_month: revenueMonth,
      payments_pending: pendingCount,
      doctors_active: doctorsCount ?? 0,
      messages_month: messagesCount ?? 0,
    },
  });
}
