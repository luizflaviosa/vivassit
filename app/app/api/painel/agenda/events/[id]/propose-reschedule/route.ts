// POST /api/painel/agenda/events/:eventId/propose-reschedule
//
// Membro da clinica sugere novo horario para uma consulta ja agendada.
// O booking vai para status=pending_confirmation por 24h. Paciente recebe
// mensagem via WhatsApp (workflow N8N S04) e responde. Se nao responder,
// pg_cron expira automaticamente e libera o slot (slot original perdido).
//
// Path param :eventId  → tenant_calendar_events.event_id (Calendar event ID)
// Body             → { newStart: ISO, newEnd: ISO }
//
// Comportamento:
//   1. Resolve booking via JOIN tenant_calendar_events.booking_id
//   2. Valida que slot novo esta livre (excluindo o proprio booking)
//   3. Preserva original_slot_start/end + original_calendar_event_id
//   4. Atualiza booking: status=pending_confirmation, slot_start/end = novo,
//      proposed_* preenchidos, confirmation_expires_at = now()+24h
//   5. Atualiza Calendar event com prefixo "[PROPOSTO]" + novo horario
//   6. Dispara webhook N8N S04 (best-effort — Fase 3 ainda nao criada)

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';
import { updateEvent } from '@/lib/google-calendar';

const RESCHEDULE_TTL_HOURS = 24;
const PROPOSED_PREFIX = '[PROPOSTO]';
const N8N_S04_WEBHOOK = process.env.N8N_S04_RESCHEDULE_WEBHOOK_URL ?? '';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;
  const userId = auth.ctx.user.id;
  const memberName = auth.ctx.user.email ?? 'Membro da clinica';

  const eventId = params.id;
  if (!eventId) {
    return NextResponse.json({ success: false, message: 'eventId obrigatorio' }, { status: 400 });
  }

  let body: { newStart?: string; newEnd?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'JSON invalido' }, { status: 400 });
  }
  if (!body.newStart || !body.newEnd) {
    return NextResponse.json({ success: false, message: 'newStart e newEnd obrigatorios' }, { status: 400 });
  }

  const newStart = new Date(body.newStart);
  const newEnd = new Date(body.newEnd);
  if (isNaN(newStart.getTime()) || isNaN(newEnd.getTime())) {
    return NextResponse.json({ success: false, message: 'Datas invalidas' }, { status: 400 });
  }
  if (newEnd <= newStart) {
    return NextResponse.json({ success: false, message: 'newEnd deve ser depois de newStart' }, { status: 400 });
  }
  if (newStart < new Date()) {
    return NextResponse.json({ success: false, message: 'Novo horario nao pode estar no passado' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // Resolve tenant_members.id (FK proposed_by) via user_id + tenant_id
  const { data: memberRow } = await supabase
    .from('tenant_members')
    .select('id')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  const memberId = memberRow?.id ?? null;

  // 1. Resolve booking + doctor via tenant_calendar_events
  const { data: evRow, error: evErr } = await supabase
    .from('tenant_calendar_events')
    .select('event_id, doctor_id, calendar_id, booking_id, tenant_id')
    .eq('event_id', eventId)
    .eq('tenant_id', tenantId)
    .single();

  if (evErr || !evRow) {
    return NextResponse.json(
      { success: false, message: 'Evento nao encontrado nesta clinica' },
      { status: 404 },
    );
  }

  if (!evRow.booking_id) {
    return NextResponse.json(
      { success: false, message: 'Este evento nao tem agendamento vinculado — nao da pra propor reagendamento' },
      { status: 422 },
    );
  }

  const { data: booking, error: bkErr } = await supabase
    .from('doctor_bookings')
    .select('id, status, slot_start, slot_end, doctor_id, patient_name, patient_phone, conversation_id, calendar_event_id, duration_minutes')
    .eq('id', evRow.booking_id)
    .eq('tenant_id', tenantId)
    .single();

  if (bkErr || !booking) {
    return NextResponse.json(
      { success: false, message: 'Booking nao encontrado' },
      { status: 404 },
    );
  }

  if (booking.status === 'cancelled' || booking.status === 'completed') {
    return NextResponse.json(
      { success: false, message: `Booking ja esta ${booking.status} — nao da pra propor reagendamento` },
      { status: 422 },
    );
  }

  if (booking.status === 'pending_confirmation') {
    return NextResponse.json(
      { success: false, message: 'Ja existe uma proposta de reagendamento pendente para este booking. Aguarde a resposta do paciente ou a expiracao (24h).' },
      { status: 409 },
    );
  }

  // 2. Verifica conflito no novo slot (via unique index parcial — se houver outro booking ativo/pending no slot, vai dar erro 23505 no update)

  // 3. Atualiza booking inplace, preservando original_*
  const proposedAt = new Date();
  const expiresAt = new Date(proposedAt.getTime() + RESCHEDULE_TTL_HOURS * 3600 * 1000);

  const { error: updErr } = await supabase
    .from('doctor_bookings')
    .update({
      status: 'pending_confirmation',
      slot_start: newStart.toISOString(),
      slot_end: newEnd.toISOString(),
      proposed_slot_start: newStart.toISOString(),
      proposed_slot_end: newEnd.toISOString(),
      proposed_by: memberId,
      proposed_at: proposedAt.toISOString(),
      confirmation_expires_at: expiresAt.toISOString(),
      original_slot_start: booking.slot_start,
      original_slot_end: booking.slot_end,
      original_calendar_event_id: booking.calendar_event_id,
      updated_at: proposedAt.toISOString(),
    })
    .eq('id', booking.id);

  if (updErr) {
    // 23505 = unique violation → conflito no novo slot
    if (updErr.code === '23505') {
      return NextResponse.json(
        { success: false, message: 'Este horario novo ja esta ocupado por outro agendamento.' },
        { status: 409 },
      );
    }
    console.error('[propose-reschedule] update booking failed', updErr);
    return NextResponse.json(
      { success: false, message: 'Nao foi possivel salvar a proposta. Tente novamente.' },
      { status: 500 },
    );
  }

  // 4. Atualiza Calendar event pro novo horario com prefixo [PROPOSTO]
  const newTitle = `${PROPOSED_PREFIX} ${booking.patient_name ?? 'Consulta'}`;

  const calResult = await updateEvent({
    calendarId: evRow.calendar_id,
    eventId,
    start: newStart,
    end: newEnd,
    summary: newTitle,
    allDay: false,
  });

  if ('error' in calResult) {
    // Rollback parcial: marca booking de volta para booked (Calendar e fonte de verdade da agenda visual)
    await supabase
      .from('doctor_bookings')
      .update({
        status: 'booked',
        slot_start: booking.slot_start,
        slot_end: booking.slot_end,
        proposed_slot_start: null,
        proposed_slot_end: null,
        proposed_by: null,
        proposed_at: null,
        confirmation_expires_at: null,
        original_slot_start: null,
        original_slot_end: null,
        original_calendar_event_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id);
    console.error('[propose-reschedule] Calendar update failed, rolled back', calResult.error);
    return NextResponse.json(
      { success: false, message: `Erro ao atualizar Google Calendar: ${calResult.error}` },
      { status: 502 },
    );
  }

  // 5. Dispara webhook N8N S04 (best-effort — workflow sera criado na Fase 3)
  if (N8N_S04_WEBHOOK) {
    try {
      await fetch(N8N_S04_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: booking.id,
          tenant_id: tenantId,
          doctor_id: booking.doctor_id,
          patient_phone: booking.patient_phone,
          patient_name: booking.patient_name,
          conversation_id: booking.conversation_id,
          old_slot_start: booking.slot_start,
          old_slot_end: booking.slot_end,
          new_slot_start: newStart.toISOString(),
          new_slot_end: newEnd.toISOString(),
          proposed_by_id: memberId,
          proposed_by_name: memberName,
          confirmation_expires_at: expiresAt.toISOString(),
        }),
      });
    } catch (err) {
      // Nao bloqueia a proposta — Calendar e DB ja foram atualizados.
      // Workflow S04 (Fase 3) tem um schedule de retry pra propostas sem mensagem enviada.
      console.warn('[propose-reschedule] webhook S04 falhou (provavel workflow ainda nao criado):', err);
    }
  }

  return NextResponse.json({
    success: true,
    booking_id: booking.id,
    proposed_slot_start: newStart.toISOString(),
    proposed_slot_end: newEnd.toISOString(),
    confirmation_expires_at: expiresAt.toISOString(),
    message: 'Proposta enviada. Aguardando confirmacao do paciente nas proximas 24h.',
  });
}
