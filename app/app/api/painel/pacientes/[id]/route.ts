import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

interface RouteContext {
  params: { id: string };
}

// IMPORTANTE:
// - appointments NAO tem tenant_id; relaciona via doctor_id (FK pra tenant_doctors)
// - tenant_payments usa consultation_value (nao "amount") + patient_phone

export async function GET(_req: Request, { params }: RouteContext) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;
  const supabase = supabaseAdmin();

  const patientId = parseInt(params.id, 10);
  if (isNaN(patientId)) {
    return NextResponse.json({ success: false, error: 'invalid_id' }, { status: 400 });
  }

  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', patientId)
    .maybeSingle();

  if (!patient) {
    return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 });
  }

  // Doctor IDs do tenant pra filtrar appointments
  const { data: doctorRows } = await supabase
    .from('tenant_doctors')
    .select('id, doctor_name')
    .eq('tenant_id', tenantId);
  const doctorIds = (doctorRows ?? []).map((d) => d.id);
  const doctorNameById = new Map((doctorRows ?? []).map((d) => [d.id, d.doctor_name]));

  // Payments + mensagens (filtradas por phone do paciente)
  const [{ data: payments }, { data: messages }] = await Promise.all([
    supabase
      .from('tenant_payments')
      .select('id, consultation_value, status, payment_method, approved_at, created_at, doctor_name, payment_url')
      .eq('tenant_id', tenantId)
      .eq('patient_phone', patient.phone)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('n8n_historico_mensagens')
      .select('id, message, created_at')
      .eq('tenant_id', tenantId)
      .ilike('session_id', `%${patient.phone}%`)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  // Appointments via doctor_id (sem FK pra patient_id direta, retorna do tenant)
  let appointments: Array<{ id: string; doctor_name: string | null; appointment_date: string; status: string | null }> = [];
  if (doctorIds.length > 0) {
    const { data: apps } = await supabase
      .from('appointments')
      .select('id, doctor_id, appointment_date, status')
      .in('doctor_id', doctorIds)
      .order('appointment_date', { ascending: false })
      .limit(20);
    appointments = (apps ?? []).map((a) => ({
      id: a.id,
      doctor_name: doctorNameById.get(a.doctor_id) ?? null,
      appointment_date: a.appointment_date,
      status: a.status,
    }));
  }

  const totalSpent = (payments ?? [])
    .filter((p) => ['paid', 'received', 'approved', 'confirmed'].includes((p.status ?? '').toLowerCase()))
    .reduce((a, p) => a + (Number(p.consultation_value) || 0), 0);

  return NextResponse.json({
    success: true,
    patient,
    appointments,
    payments: payments ?? [],
    messages_recent: messages ?? [],
    summary: {
      total_appointments: appointments.length,
      total_spent: totalSpent,
      total_payments: (payments ?? []).length,
    },
  });
}
