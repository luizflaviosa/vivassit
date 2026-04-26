import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

interface RouteContext {
  params: { id: string };
}

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

  // Fetch related: appointments + payments
  const [{ data: appointments }, { data: payments }, { data: messages }] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, doctor_name, appointment_date, status, calendar_event_id')
      .eq('tenant_id', tenantId)
      .eq('patient_phone', patient.phone)
      .order('appointment_date', { ascending: false })
      .limit(20),
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

  const totalSpent = (payments ?? [])
    .filter((p) => ['paid', 'received', 'approved', 'confirmed'].includes((p.status ?? '').toLowerCase()))
    .reduce((a, p) => a + (Number(p.consultation_value) || 0), 0);

  return NextResponse.json({
    success: true,
    patient,
    appointments: appointments ?? [],
    payments: payments ?? [],
    messages_recent: messages ?? [],
    summary: {
      total_appointments: (appointments ?? []).length,
      total_spent: totalSpent,
      total_payments: (payments ?? []).length,
    },
  });
}
