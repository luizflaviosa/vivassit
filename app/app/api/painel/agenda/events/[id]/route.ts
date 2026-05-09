// PUT /api/painel/agenda/events/:id    → edita evento (drag/resize OU form completo)
// DELETE /api/painel/agenda/events/:id  → remove evento

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';
import { updateEvent, deleteEvent } from '@/lib/google-calendar';

async function resolveDoctorCalendar(
  tenantId: string,
  doctorId?: string,
): Promise<{ calendar_id: string; doctor_name: string } | null> {
  const supabase = supabaseAdmin();
  let q = supabase
    .from('tenant_doctors')
    .select('calendar_id, doctor_name')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');
  if (doctorId) q = q.eq('id', doctorId);
  else q = q.order('is_primary', { ascending: false });
  const { data } = await q.limit(1);
  const d = data?.[0];
  if (!d?.calendar_id) return null;
  return { calendar_id: d.calendar_id, doctor_name: d.doctor_name };
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const eventId = params.id;
  if (!eventId) {
    return NextResponse.json({ success: false, message: 'ID do evento obrigatório' }, { status: 400 });
  }

  let body: {
    start?: string;
    end?: string;
    allDay?: boolean;
    title?: string;
    description?: string | null;
    location?: string | null;
    doctorId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'JSON inválido' }, { status: 400 });
  }

  // start/end opcionais (edição só de texto não precisa); mas se vier um, vem o outro
  let start: Date | undefined;
  let end: Date | undefined;
  if (body.start || body.end) {
    if (!body.start || !body.end) {
      return NextResponse.json(
        { success: false, message: 'start e end devem vir juntos' },
        { status: 400 },
      );
    }
    start = new Date(body.start);
    end = new Date(body.end);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ success: false, message: 'Datas inválidas' }, { status: 400 });
    }
    if (end <= start) {
      return NextResponse.json({ success: false, message: 'end deve ser depois de start' }, { status: 400 });
    }
  }

  const doctor = await resolveDoctorCalendar(auth.ctx.tenant.tenant_id, body.doctorId);
  if (!doctor) {
    return NextResponse.json(
      { success: false, message: 'Profissional sem calendar_id configurado' },
      { status: 422 },
    );
  }

  const result = await updateEvent({
    calendarId: doctor.calendar_id,
    eventId,
    start,
    end,
    allDay: body.allDay ?? false,
    summary: body.title?.trim() || undefined,
    description: body.description === undefined ? undefined : body.description,
    location: body.location === undefined ? undefined : body.location,
  });

  if ('error' in result) {
    console.error('[agenda/events/[id] PUT]', result.error);
    return NextResponse.json({ success: false, message: result.error }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const eventId = params.id;
  if (!eventId) {
    return NextResponse.json({ success: false, message: 'ID do evento obrigatório' }, { status: 400 });
  }

  const url = new URL(req.url);
  const doctorId = url.searchParams.get('doctorId') ?? undefined;

  const doctor = await resolveDoctorCalendar(auth.ctx.tenant.tenant_id, doctorId);
  if (!doctor) {
    return NextResponse.json(
      { success: false, message: 'Profissional sem calendar_id configurado' },
      { status: 422 },
    );
  }

  const result = await deleteEvent({
    calendarId: doctor.calendar_id,
    eventId,
  });

  if ('error' in result) {
    console.error('[agenda/events/[id] DELETE]', result.error);
    return NextResponse.json({ success: false, message: result.error }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
