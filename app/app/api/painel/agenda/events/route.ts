import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';
import { listEvents, createEvent, getServiceAccountEmail } from '@/lib/google-calendar';

// Lista eventos do calendário do doctor primário (ou ?doctor=id).
//
// Fonte de dados:
//   - Default: tenant_calendar_events (DB local, ~10x mais rápido)
//   - Fallback: Google Calendar API direto (?source=gcal ou se DB vazio)
//
// O sync DB ↔ GCal acontece via webhook /api/webhooks/google-calendar em <5s
// pra qualquer mudança. Painel passa a ler DB pra:
//   - Velocidade (~50ms vs ~500ms da Google API)
//   - Funcionar mesmo se Google API estiver fora
//   - JOIN com doctor_bookings pra mostrar dados do paciente direto

interface EventRow {
  event_id: string;
  summary: string | null;
  description: string | null;
  event_start: string;
  event_end: string;
  source: string | null;
  booking_id: string | null;
  calendar_id: string | null;
  doctor_bookings: {
    id: string;
    patient_name: string | null;
    patient_phone: string | null;
    status: string;
  } | null;
}

export async function GET(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;
  const supabase = supabaseAdmin();

  const url = new URL(req.url);
  const doctorIdParam = url.searchParams.get('doctor');
  const sourceParam = url.searchParams.get('source'); // 'db' | 'gcal'
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

  // ── Caminho default: lê do DB (rápido, com info do paciente) ──
  if (sourceParam !== 'gcal') {
    const { data, error } = await supabase
      .from('tenant_calendar_events')
      .select(
        'event_id, summary, description, event_start, event_end, source, booking_id, calendar_id, doctor_bookings(id, patient_name, patient_phone, status)',
      )
      .eq('doctor_id', doctor.id)
      .gte('event_end', timeMin)
      .lt('event_start', timeMax)
      .order('event_start', { ascending: true })
      .returns<EventRow[]>();

    if (!error && data && data.length > 0) {
      // Normaliza pro shape que o frontend espera (compatível com listEvents output)
      const events = data.map((ev) => {
        const booking = ev.doctor_bookings;
        const isCancelled = booking?.status === 'cancelled';
        return {
          id: ev.event_id,
          title: ev.summary ?? '(sem título)',
          description: ev.description ?? null,
          location: null,
          start: ev.event_start,
          end: ev.event_end,
          all_day: ev.summary?.toLowerCase().includes('dia todo') ?? false,
          attendees: booking?.patient_name ? [booking.patient_name] : [],
          status: isCancelled ? 'cancelled' : 'confirmed',
          link: `https://calendar.google.com/calendar/event?eid=${ev.event_id}`,
          meet_link: null,
          color_id: null,
          color_hex: booking ? '#0F1B33' /* roxo Singulare pra consultas */ : null,
          // Extras: úteis pro UI distinguir consulta vs bloco
          booking_id: ev.booking_id,
          patient_phone: booking?.patient_phone ?? null,
          source: ev.source,
        };
      });

      return NextResponse.json({
        success: true,
        events,
        doctor: { id: doctor.id, name: doctor.doctor_name, calendar_id: doctor.calendar_id },
        window: { from: timeMin, to: timeMax },
        source: 'db',
        count: events.length,
      });
    }
    // Fall-through pra GCal se DB vazio ou erro (resiliência durante warmup)
  }

  // ── Caminho fallback: Google Calendar direto ──
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
        calendar_id: doctor.calendar_id,
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
    source: 'gcal',
    count: result.events.length,
  });
}

// ─────────────────────────────────────────────────────────────────────
// POST → cria novo evento no Google Calendar (botão "Novo" / clique em slot vazio).
// O webhook push de Google → /api/webhooks/google-calendar dispara em seguida e
// popula tenant_calendar_events automaticamente, então o bot já passa a respeitar.
// ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  let body: {
    title?: string;
    description?: string;
    location?: string;
    start?: string;
    end?: string;
    allDay?: boolean;
    doctorId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'JSON inválido' }, { status: 400 });
  }

  if (!body.title?.trim()) {
    return NextResponse.json({ success: false, message: 'Título obrigatório' }, { status: 400 });
  }
  if (!body.start || !body.end) {
    return NextResponse.json({ success: false, message: 'start e end obrigatórios' }, { status: 400 });
  }

  const start = new Date(body.start);
  const end = new Date(body.end);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ success: false, message: 'Datas inválidas' }, { status: 400 });
  }
  if (end <= start) {
    return NextResponse.json({ success: false, message: 'end deve ser depois de start' }, { status: 400 });
  }

  // Resolve doctor → calendar_id
  const supabase = supabaseAdmin();
  let doctorQ = supabase
    .from('tenant_doctors')
    .select('id, doctor_name, calendar_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');

  if (body.doctorId) doctorQ = doctorQ.eq('id', body.doctorId);
  else doctorQ = doctorQ.order('is_primary', { ascending: false });

  const { data: doctors } = await doctorQ.limit(1);
  const doctor = doctors?.[0];

  if (!doctor?.calendar_id) {
    return NextResponse.json(
      { success: false, message: 'Profissional sem calendar_id configurado' },
      { status: 422 },
    );
  }

  const result = await createEvent({
    calendarId: doctor.calendar_id,
    summary: body.title.trim(),
    description: body.description?.trim() || undefined,
    location: body.location?.trim() || undefined,
    start,
    end,
    allDay: body.allDay ?? false,
  });

  if ('error' in result) {
    console.error('[agenda/events POST]', result.error);
    return NextResponse.json({ success: false, message: result.error }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    event_id: result.event_id,
    link: result.link,
    doctor: { id: doctor.id, name: doctor.doctor_name },
  });
}
