import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';
import { listEvents, getServiceAccountEmail } from '@/lib/google-calendar';

// Lista eventos do Google Calendar de UM doctor específico (ou primário do tenant).
//
// Arquitetura nova:
//   - Login do painel é independente (sem scope calendar.readonly)
//   - Usa Service Account compartilhado (env GOOGLE_SERVICE_ACCOUNT_JSON)
//   - calendar_id vem de tenant_doctors.calendar_id (ou ?doctor=ID na query)
//   - Se múltiplos doctors, frontend mostra dropdown e passa ?doctor=ID

export async function GET(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;
  const supabase = supabaseAdmin();

  const url = new URL(req.url);
  const doctorIdParam = url.searchParams.get('doctor');
  const daysBack = parseInt(url.searchParams.get('back') ?? '7', 10);
  const daysForward = parseInt(url.searchParams.get('forward') ?? '60', 10);

  let doctorQ = supabase
    .from('tenant_doctors')
    .select('id, doctor_name, calendar_id, is_primary, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');

  if (doctorIdParam) doctorQ = doctorQ.eq('id', doctorIdParam);
  else doctorQ = doctorQ.order('is_primary', { ascending: false });

  const { data: doctors } = await doctorQ.limit(1);
  const doctor = doctors?.[0];

  if (!doctor) {
    return NextResponse.json({
      success: false,
      error: 'no_doctor',
      message: 'Nenhum profissional cadastrado nesta clínica.',
    }, { status: 200 });
  }

  if (!doctor.calendar_id) {
    return NextResponse.json({
      success: false,
      error: 'no_calendar',
      requires_setup: true,
      message: `O profissional "${doctor.doctor_name}" ainda não tem calendar_id configurado. Adicione em /painel/profissionais.`,
      doctor: { id: doctor.id, name: doctor.doctor_name },
    }, { status: 200 });
  }

  const timeMin = new Date(Date.now() - daysBack * 86_400_000).toISOString();
  const timeMax = new Date(Date.now() + daysForward * 86_400_000).toISOString();

  const result = await listEvents({
    calendarId: doctor.calendar_id,
    timeMin,
    timeMax,
  });

  if ('error' in result) {
    if (result.code === 'no_sa') {
      return NextResponse.json({
        success: false,
        error: 'no_service_account',
        requires_setup: true,
        message: 'Service Account do Google não configurado. Veja docs/AGENDA-SETUP.md.',
      }, { status: 200 });
    }
    if (result.code === 'no_access') {
      const saEmail = getServiceAccountEmail();
      return NextResponse.json({
        success: false,
        error: 'no_calendar_access',
        requires_setup: true,
        message: result.error,
        share_with: saEmail,
        doctor: { id: doctor.id, name: doctor.doctor_name, calendar_id: doctor.calendar_id },
      }, { status: 200 });
    }
    return NextResponse.json({ success: false, error: result.code, message: result.error }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    events: result.events,
    doctor: { id: doctor.id, name: doctor.doctor_name, calendar_id: doctor.calendar_id },
    window: { from: timeMin, to: timeMax },
  });
}
