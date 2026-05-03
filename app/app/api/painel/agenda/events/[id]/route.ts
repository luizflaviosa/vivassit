// PUT /api/painel/agenda/events/:id
// Move or resize a Google Calendar event (drag-and-drop / resize from the agenda UI).

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';
import { updateEvent } from '@/lib/google-calendar';

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

  let body: { start: string; end: string; allDay?: boolean; doctorId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'JSON inválido' }, { status: 400 });
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

  // Resolve which doctor's calendar to use
  const supabase = supabaseAdmin();
  let doctorQ = supabase
    .from('tenant_doctors')
    .select('calendar_id, doctor_name')
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
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

  const result = await updateEvent({
    calendarId: doctor.calendar_id,
    eventId,
    start,
    end,
    allDay: body.allDay ?? false,
  });

  if ('error' in result) {
    console.error('[agenda/events/[id] PUT]', result.error);
    return NextResponse.json({ success: false, message: result.error }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
