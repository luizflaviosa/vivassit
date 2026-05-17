/**
 * Agenda: reads (agenda_hoje, agenda_periodo, horarios_livres)
 *       + writes (consulta_marcar, consulta_reagendar, consulta_cancelar,
 *                 bloquear_horario, working_hours_atualizar).
 *
 * Source-of-truth: tabela doctor_bookings (status enum:
 *   booked / confirmed / completed / cancelled).
 */
import { supabaseAdmin } from '../supabase';
import { deleteEvent, updateEvent } from '../google-calendar';
import { calcAvailableSlots } from '../agenda-availability';
import type { Handler, WriteHandler } from './shared';
import { fmtDate, getDoctorCalendarId, resolveDoctorScope } from './shared';

// ── agenda_hoje ──────────────────────────────────────────────────
export const agendaHoje: Handler = async (params, ctx) => {
  const admin = supabaseAdmin();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);

  let q = admin
    .from('doctor_bookings')
    .select('id, patient_id, patient_name, patient_phone, doctor_id, slot_start, slot_end, status, notes, calendar_event_id')
    .eq('tenant_id', ctx.tenant_id)
    .gte('slot_start', startOfDay.toISOString())
    .lte('slot_start', endOfDay.toISOString())
    .order('slot_start', { ascending: true });

  if (scope.doctor_id) q = q.eq('doctor_id', scope.doctor_id);

  const { data, error } = await q;
  if (error) return { ok: false, summary: 'Erro ao buscar agenda', error: error.message };

  const list = (data ?? []).map((a) => ({
    id: a.id,
    time: new Date(a.slot_start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    patient_name: a.patient_name,
    patient_phone: a.patient_phone,
    status: a.status,
    notes: a.notes,
    in_calendar: !!a.calendar_event_id,
  }));

  const active = list.filter((l) => l.status !== 'cancelled');
  const confirmed = list.filter((l) => l.status === 'confirmed').length;

  return {
    ok: true,
    summary:
      active.length === 0
        ? 'Sem consultas ativas hoje.'
        : `${active.length} ${active.length === 1 ? 'consulta' : 'consultas'} hoje${confirmed > 0 ? ` (${confirmed} confirmada${confirmed === 1 ? '' : 's'})` : ''}.`,
    data: { count: active.length, total_with_cancelled: list.length, appointments: list },
  };
};

// ── agenda_periodo ──────────────────────────────────────────────
export const agendaPeriodo: Handler = async (params, ctx) => {
  const start = String(params.start);
  const end = String(params.end);
  const status = String(params.status ?? 'all');
  const admin = supabaseAdmin();

  const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);

  let q = admin
    .from('doctor_bookings')
    .select('id, patient_id, patient_name, patient_phone, doctor_id, slot_start, slot_end, status, notes, calendar_event_id')
    .eq('tenant_id', ctx.tenant_id)
    .gte('slot_start', start)
    .lte('slot_start', end + 'T23:59:59.999Z')
    .order('slot_start', { ascending: true });

  if (status !== 'all') q = q.eq('status', status);
  if (scope.doctor_id) q = q.eq('doctor_id', scope.doctor_id);

  const { data, error } = await q;
  if (error) return { ok: false, summary: 'Erro ao buscar agenda', error: error.message };

  const list = data ?? [];
  const byStatus = list.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  const active = list.length - (byStatus.cancelled ?? 0);

  return {
    ok: true,
    summary:
      `${active} consulta(s) ativa(s) entre ${start} e ${end}` +
      ` (${byStatus.booked ?? 0} marcadas, ${byStatus.confirmed ?? 0} confirmadas, ${byStatus.completed ?? 0} concluídas, ${byStatus.cancelled ?? 0} canceladas).`,
    data: {
      total: list.length,
      active,
      breakdown: byStatus,
      appointments: list.map((a) => ({
        id: a.id,
        when: fmtDate(a.slot_start),
        patient_name: a.patient_name,
        patient_phone: a.patient_phone,
        status: a.status,
        in_calendar: !!a.calendar_event_id,
      })),
    },
  };
};

// ── horarios_livres ──────────────────────────────────────────────
export const horariosLivres: Handler = async (params, ctx) => {
  const startStr = String(params.start ?? '');
  const endStr = String(params.end ?? '');
  if (!startStr || !endStr) {
    return { ok: false, summary: 'Faltam start e end (YYYY-MM-DD).' };
  }
  const start = new Date(`${startStr}T00:00:00-03:00`);
  const end = new Date(`${endStr}T23:59:59-03:00`);
  if (isNaN(+start) || isNaN(+end)) {
    return { ok: false, summary: 'Datas inválidas.' };
  }
  const diffDays = Math.floor((+end - +start) / 86_400_000);
  if (diffDays < 0 || diffDays > 28) {
    return { ok: false, summary: 'Janela inválida (0-28 dias).' };
  }
  const slotMinutes = Math.max(15, Math.min(120, Number(params.slot_minutes ?? 30)));

  const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);
  const admin = supabaseAdmin();

  let doctorsQuery = admin
    .from('tenant_doctors')
    .select('id, doctor_name, working_hours')
    .eq('tenant_id', ctx.tenant_id)
    .eq('status', 'active');
  if (scope.doctor_id) doctorsQuery = doctorsQuery.eq('id', scope.doctor_id);
  const { data: doctors, error: docErr } = await doctorsQuery;
  if (docErr) return { ok: false, summary: 'Erro ao buscar médicos', error: docErr.message };
  if (!doctors || doctors.length === 0) {
    return { ok: true, summary: 'Nenhum médico encontrado.', data: { slots: [], total: 0 } };
  }

  const result: Array<{ doctor_id: string; doctor_name: string; start: string; end: string }> = [];

  for (const doc of doctors) {
    // overlap real com bookings e blocks
    const { data: bookings } = await admin
      .from('doctor_bookings')
      .select('slot_start, slot_end')
      .eq('tenant_id', ctx.tenant_id)
      .eq('doctor_id', doc.id)
      .neq('status', 'cancelled')
      .lt('slot_start', end.toISOString())
      .gt('slot_end', start.toISOString());

    const { data: blocks } = await admin
      .from('doctor_schedule_blocks')
      .select('start_at, end_at')
      .eq('tenant_id', ctx.tenant_id)
      .eq('doctor_id', doc.id)
      .lt('start_at', end.toISOString())
      .gt('end_at', start.toISOString());

    const busy = [
      ...(bookings ?? []).map((b) => ({ start: new Date(b.slot_start), end: new Date(b.slot_end) })),
      ...(blocks ?? []).map((b) => ({ start: new Date(b.start_at), end: new Date(b.end_at) })),
    ];

    const free = calcAvailableSlots({
      start, end,
      workingHours: (doc.working_hours as Record<string, unknown>) ?? {},
      busy,
      slotMinutes,
    });

    for (const s of free) {
      result.push({
        doctor_id: doc.id,
        doctor_name: doc.doctor_name,
        start: s.start.toISOString(),
        end: s.end.toISOString(),
      });
    }
  }

  return {
    ok: true,
    summary: `${result.length} slot(s) livre(s) entre ${startStr} e ${endStr}.`,
    data: { slots: result, total: result.length },
  };
};

// ── consulta_reagendar ───────────────────────────────────────────
// Atualiza doctor_bookings + propaga move pro Google Calendar via SA quando
// houver calendar_event_id. Webhook sincroniza tenant_calendar_events e
// libera o slot antigo.
export const consultaReagendar: WriteHandler = {
  async propose(params, ctx) {
    const bookingId = String(params.appointment_id);
    const newDate = String(params.new_date);
    const admin = supabaseAdmin();
    const { data: appt, error } = await admin
      .from('doctor_bookings')
      .select('id, slot_start, slot_end, duration_minutes, status, patient_name, patient_phone, doctor_id, calendar_event_id')
      .eq('tenant_id', ctx.tenant_id)
      .eq('id', bookingId)
      .maybeSingle();
    if (error || !appt) {
      return { ok: false, summary: 'Consulta não encontrada', error: 'not_found' };
    }
    if (appt.status === 'cancelled') {
      return { ok: false, summary: 'Consulta já está cancelada — não dá pra reagendar.' };
    }
    const oldFmt = fmtDate(appt.slot_start);
    const newFmt = fmtDate(newDate);
    return {
      ok: true,
      summary: `Reagendar ${appt.patient_name ?? 'consulta'} de ${oldFmt} → ${newFmt}?`,
      card: {
        summary: `Reagendar consulta`,
        detail: `Paciente: ${appt.patient_name ?? '(sem nome)'}\nDe: ${oldFmt}\nPara: ${newFmt}`,
        confirm_label: 'Confirmar reagendamento',
        cancel_label: 'Voltar',
        action: { tool: 'consulta_reagendar', params: { appointment_id: bookingId, new_date: newDate } },
      },
      data: { booking: appt, new_date: newDate },
    };
  },
  async execute(params, ctx) {
    const bookingId = String(params.appointment_id);
    const newDate = String(params.new_date);
    const newStart = new Date(newDate);
    const admin = supabaseAdmin();

    const { data: existing } = await admin
      .from('doctor_bookings')
      .select('duration_minutes')
      .eq('tenant_id', ctx.tenant_id)
      .eq('id', bookingId)
      .maybeSingle<{ duration_minutes: number | null }>();
    const dur = existing?.duration_minutes ?? 60;
    const newEnd = new Date(newStart.getTime() + dur * 60_000);

    const { data, error } = await admin
      .from('doctor_bookings')
      .update({
        slot_start: newStart.toISOString(),
        slot_end: newEnd.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', ctx.tenant_id)
      .eq('id', bookingId)
      .select('id, slot_start, status, calendar_event_id, doctor_id')
      .maybeSingle();
    if (error) return { ok: false, summary: 'Falha ao reagendar', error: error.message };
    if (!data) return { ok: false, summary: 'Consulta não encontrada', error: 'not_found' };

    let calendarMsg = '';
    if (data.calendar_event_id && data.doctor_id) {
      const calId = await getDoctorCalendarId(ctx.tenant_id, data.doctor_id);
      if (calId) {
        const upd = await updateEvent({
          calendarId: calId,
          eventId: data.calendar_event_id,
          start: newStart,
          end: newEnd,
        });
        if ('error' in upd) {
          calendarMsg = ' (Calendar: falha ao mover — ajuste manual.)';
          console.error('[consulta_reagendar] updateEvent falhou:', upd.error);
        }
      } else {
        calendarMsg = ' (Calendar: sem calendar_id no doctor.)';
      }
    }

    return {
      ok: true,
      summary: `Reagendado pra ${fmtDate(data.slot_start)}.${calendarMsg}`,
      data: { booking: data },
    };
  },
};

// ── consulta_cancelar ────────────────────────────────────────────
// Cancela booking + deleta evento no Google Calendar (SA).
// Sem o delete no Google, fn_get_available_slots veria o slot ocupado.
export const consultaCancelar: WriteHandler = {
  async propose(params, ctx) {
    const bookingId = String(params.appointment_id);
    const reason = params.reason ? String(params.reason) : null;
    const admin = supabaseAdmin();
    const { data: appt } = await admin
      .from('doctor_bookings')
      .select('id, slot_start, status, patient_name, calendar_event_id, notes')
      .eq('tenant_id', ctx.tenant_id)
      .eq('id', bookingId)
      .maybeSingle();
    if (!appt) return { ok: false, summary: 'Consulta não encontrada', error: 'not_found' };
    if (appt.status === 'cancelled') return { ok: false, summary: 'Consulta já cancelada.' };
    return {
      ok: true,
      summary: `Cancelar consulta de ${appt.patient_name ?? 'paciente'} em ${fmtDate(appt.slot_start)}?`,
      card: {
        summary: 'Cancelar consulta',
        detail: `Paciente: ${appt.patient_name ?? '(sem nome)'}\nQuando: ${fmtDate(appt.slot_start)}${reason ? `\nMotivo: ${reason}` : ''}`,
        confirm_label: 'Sim, cancelar',
        cancel_label: 'Voltar',
        action: { tool: 'consulta_cancelar', params: { appointment_id: bookingId, reason } },
      },
      data: { booking: appt },
    };
  },
  async execute(params, ctx) {
    const bookingId = String(params.appointment_id);
    const reason = params.reason ? String(params.reason) : null;
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('doctor_bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', ctx.tenant_id)
      .eq('id', bookingId)
      .select('id, status, slot_start, calendar_event_id, doctor_id')
      .maybeSingle();
    if (error) return { ok: false, summary: 'Falha ao cancelar', error: error.message };
    if (!data) return { ok: false, summary: 'Consulta não encontrada', error: 'not_found' };

    let calendarMsg = '';
    if (data.calendar_event_id && data.doctor_id) {
      const calId = await getDoctorCalendarId(ctx.tenant_id, data.doctor_id);
      if (calId) {
        const del = await deleteEvent({ calendarId: calId, eventId: data.calendar_event_id });
        if ('error' in del) {
          calendarMsg = ' (Calendar: falha — limpe o evento manualmente.)';
          console.error('[consulta_cancelar] deleteEvent falhou:', del.error);
        }
      } else {
        calendarMsg = ' (Calendar: sem calendar_id no doctor — evento órfão.)';
      }
    }

    return {
      ok: true,
      summary: `Consulta cancelada.${calendarMsg}`,
      data,
    };
  },
};

// ── consulta_marcar ──────────────────────────────────────────────
// Cria nova consulta em doctor_bookings. NÃO sincroniza pro Google Calendar
// nesta versão (calendar_event_id fica null). EXCLUDE constraint anti
// double-book + re-validate de overlap antes do INSERT.
export const consultaMarcar: WriteHandler = {
  async propose(params, ctx) {
    const slotStartStr = String(params.slot_start ?? '');
    if (!slotStartStr) return { ok: false, summary: 'slot_start obrigatório.' };
    const slotStart = new Date(slotStartStr.includes('Z') || /[+-]\d\d:\d\d$/.test(slotStartStr)
      ? slotStartStr : `${slotStartStr}-03:00`);
    if (isNaN(+slotStart)) return { ok: false, summary: 'slot_start inválido.' };
    const duration = Math.max(15, Math.min(240, Number(params.duration_minutes ?? 60)));
    const slotEnd = new Date(+slotStart + duration * 60_000);

    const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);
    if (!scope.doctor_id) return { ok: false, summary: 'Sem médico no escopo. Admin/owner deve passar doctor_id ou usar medicos_listar primeiro.' };

    const admin = supabaseAdmin();

    // Resolver paciente
    let patientId = params.patient_id ? String(params.patient_id) : null;
    let patientName = params.patient_name ? String(params.patient_name) : '';
    let patientPhone = params.patient_phone ? String(params.patient_phone) : '';
    if (!patientId) {
      if (!patientName && !patientPhone) {
        return {
          ok: false,
          summary: 'Sem paciente identificado. Passe patient_id, patient_name ou patient_phone.',
        };
      }
      let pq = admin.from('patients').select('id, name, phone').eq('tenant_id', ctx.tenant_id);
      if (patientName) pq = pq.ilike('name', `%${patientName}%`);
      if (patientPhone) pq = pq.eq('phone', patientPhone);
      const { data: matches } = await pq.limit(5);
      if (!matches || matches.length === 0) {
        return {
          ok: false,
          summary: `Paciente "${patientName || patientPhone}" não encontrado. Use paciente_criar antes.`,
          data: { missing_patient: { name: patientName, phone: patientPhone } },
        };
      }
      if (matches.length > 1) {
        return {
          ok: false,
          summary: `${matches.length} pacientes batem com "${patientName}". Especifique o ID ou telefone.`,
          data: { ambiguous: matches },
        };
      }
      patientId = matches[0].id;
      patientName = matches[0].name;
      patientPhone = matches[0].phone ?? '';
    } else {
      const { data: pat } = await admin.from('patients').select('name, phone').eq('id', patientId).eq('tenant_id', ctx.tenant_id).maybeSingle();
      if (!pat) {
        return { ok: false, summary: 'Paciente nao encontrado neste tenant.' };
      }
      patientName = pat.name ?? patientName;
      patientPhone = pat.phone ?? patientPhone;
    }

    // Conflito — overlap real (start < slotEnd AND end > slotStart)
    const { data: conflictBookings } = await admin
      .from('doctor_bookings')
      .select('id, patient_name, slot_start, slot_end')
      .eq('tenant_id', ctx.tenant_id)
      .eq('doctor_id', scope.doctor_id)
      .neq('status', 'cancelled')
      .lt('slot_start', slotEnd.toISOString())
      .gt('slot_end', slotStart.toISOString());
    const { data: conflictBlocks } = await admin
      .from('doctor_schedule_blocks')
      .select('id, reason, start_at, end_at')
      .eq('tenant_id', ctx.tenant_id)
      .eq('doctor_id', scope.doctor_id)
      .lt('start_at', slotEnd.toISOString())
      .gt('end_at', slotStart.toISOString());
    if ((conflictBookings?.length ?? 0) > 0 || (conflictBlocks?.length ?? 0) > 0) {
      return {
        ok: false,
        summary: 'Conflito: slot ocupado por consulta ou bloqueio existente.',
        data: { conflict: { bookings: conflictBookings ?? [], blocks: conflictBlocks ?? [] } },
      };
    }

    const slotFmt = fmtDate(slotStart.toISOString());
    return {
      ok: true,
      summary: `Marcar consulta de ${patientName} em ${slotFmt}?`,
      card: {
        summary: `Marcar consulta`,
        detail: `Paciente: ${patientName}${patientPhone ? ` (${patientPhone})` : ''}\nQuando: ${slotFmt}\nDuração: ${duration} min${params.notes ? `\nNotas: ${String(params.notes)}` : ''}`,
        confirm_label: 'Confirmar agendamento',
        cancel_label: 'Voltar',
        action: {
          tool: 'consulta_marcar',
          params: {
            patient_id: patientId,
            slot_start: slotStart.toISOString(),
            duration_minutes: duration,
            doctor_id: scope.doctor_id,
            notes: params.notes ?? null,
          },
        },
      },
      data: { patient: { id: patientId, name: patientName, phone: patientPhone }, slot_start: slotStart.toISOString(), slot_end: slotEnd.toISOString() },
    };
  },

  async execute(params, ctx) {
    const slotStart = new Date(String(params.slot_start));
    const duration = Number(params.duration_minutes ?? 60);
    const slotEnd = new Date(+slotStart + duration * 60_000);
    const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);
    if (!scope.doctor_id) return { ok: false, summary: 'Sem doctor_id no escopo.' };

    const admin = supabaseAdmin();

    const { data: patient } = await admin
      .from('patients').select('id, name, phone').eq('id', String(params.patient_id))
      .eq('tenant_id', ctx.tenant_id).maybeSingle();
    if (!patient) return { ok: false, summary: 'Paciente não encontrado no execute.' };

    // Re-validar conflito (outro booking pode ter entrado entre propose e execute).
    // EXCLUDE constraint em doctor_bookings tambem pega isso, mas re-check da mensagem util.
    const { data: latebookings } = await admin
      .from('doctor_bookings')
      .select('id, patient_name, slot_start')
      .eq('tenant_id', ctx.tenant_id)
      .eq('doctor_id', scope.doctor_id)
      .neq('status', 'cancelled')
      .lt('slot_start', slotEnd.toISOString())
      .gt('slot_end', slotStart.toISOString());
    if (latebookings && latebookings.length > 0) {
      return {
        ok: false,
        summary: 'Conflito: outra consulta ocupou o slot entre a proposta e a confirmacao.',
        data: { conflict: { bookings: latebookings } },
      };
    }
    const { data: lateblocks } = await admin
      .from('doctor_schedule_blocks')
      .select('id, reason, start_at')
      .eq('tenant_id', ctx.tenant_id)
      .eq('doctor_id', scope.doctor_id)
      .lt('start_at', slotEnd.toISOString())
      .gt('end_at', slotStart.toISOString());
    if (lateblocks && lateblocks.length > 0) {
      return {
        ok: false,
        summary: 'Conflito: um bloqueio foi criado no slot entre a proposta e a confirmacao.',
        data: { conflict: { blocks: lateblocks } },
      };
    }

    const { data, error } = await admin.from('doctor_bookings').insert({
      tenant_id: ctx.tenant_id,
      doctor_id: scope.doctor_id,
      patient_id: patient.id,
      patient_name: patient.name,
      patient_phone: patient.phone,
      slot_start: slotStart.toISOString(),
      slot_end: slotEnd.toISOString(),
      duration_minutes: duration,
      status: 'booked',
      notes: params.notes ? String(params.notes) : null,
    }).select('id, slot_start').maybeSingle();
    if (error) {
      // 23P01 = exclusion_violation (constraint doctor_bookings_no_overlap)
      if (error.code === '23P01') {
        return { ok: false, summary: 'Conflito de slot detectado pelo banco (insert concorrente). Tente outro horario.' };
      }
      return { ok: false, summary: 'Falha ao criar consulta', error: error.message };
    }
    return { ok: true, summary: `Consulta criada (id ${data?.id}).`, data: { booking: data } };
  },
};

// ── bloquear_horario ─────────────────────────────────────────────
// Insere em doctor_schedule_blocks. Em propose lista bookings que caem
// dentro da janela (apenas aviso — bloqueio não cancela nada).
export const bloquearHorario: WriteHandler = {
  async propose(params, ctx) {
    const startStr = String(params.start ?? '');
    const endStr = String(params.end ?? '');
    const norm = (s: string) => /[Z+]/.test(s) || /-\d\d:\d\d$/.test(s) ? s : `${s}-03:00`;
    const start = new Date(norm(startStr));
    const end = new Date(norm(endStr));
    if (isNaN(+start) || isNaN(+end)) return { ok: false, summary: 'start/end inválidos.' };
    if (end <= start) return { ok: false, summary: 'end deve ser maior que start.' };

    const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);
    if (!scope.doctor_id) return { ok: false, summary: 'Sem médico no escopo.' };

    const admin = supabaseAdmin();

    const { data: hits } = await admin
      .from('doctor_bookings')
      .select('id, patient_name, slot_start, slot_end, status')
      .eq('tenant_id', ctx.tenant_id)
      .eq('doctor_id', scope.doctor_id)
      .neq('status', 'cancelled')
      .lt('slot_start', end.toISOString())
      .gt('slot_end', start.toISOString());

    const startFmt = fmtDate(start.toISOString());
    const endFmt = fmtDate(end.toISOString());
    const reason = params.reason ? String(params.reason) : 'Indisponível';
    const conflictNote = hits && hits.length > 0
      ? `\n\nATENCAO: ${hits.length} consulta(s) caem dentro:\n` + hits.map((h) => `- ${h.patient_name} em ${fmtDate(h.slot_start)}`).join('\n')
      : '';

    return {
      ok: true,
      summary: `Bloquear ${startFmt} → ${endFmt}?`,
      card: {
        summary: `Bloquear horário`,
        detail: `De: ${startFmt}\nAté: ${endFmt}\nMotivo: ${reason}${conflictNote}`,
        confirm_label: 'Bloquear',
        cancel_label: 'Voltar',
        action: {
          tool: 'bloquear_horario',
          params: {
            start: start.toISOString(),
            end: end.toISOString(),
            reason,
            doctor_id: scope.doctor_id,
          },
        },
      },
      data: { conflicts: hits ?? [] },
    };
  },

  async execute(params, ctx) {
    const start = new Date(String(params.start));
    const end = new Date(String(params.end));
    const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);
    if (!scope.doctor_id) return { ok: false, summary: 'Sem médico no escopo.' };

    const admin = supabaseAdmin();
    const { data, error } = await admin.from('doctor_schedule_blocks').insert({
      tenant_id: ctx.tenant_id,
      doctor_id: scope.doctor_id,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      reason: params.reason ? String(params.reason) : null,
      source: 'agente',
      created_by: ctx.user_id,
    }).select('id').maybeSingle();
    if (error) return { ok: false, summary: 'Falha ao bloquear', error: error.message };
    return { ok: true, summary: `Bloqueio criado (id ${data?.id}).`, data: { block: data } };
  },
};

// ── working_hours_atualizar ──────────────────────────────────────
// Altera rotina semanal fixa do médico. Requer digitação literal da frase
// de confirmação no painel. Trigger trg_doctor_prompt_rebuild regenera
// rendered_prompt automaticamente.
export const workingHoursAtualizar: WriteHandler = {
  async propose(params, ctx) {
    const day = String(params.day ?? '');
    const hours = String(params.hours ?? '');
    const VALID_DAYS = ['seg','ter','qua','qui','sex','sab','dom'];
    if (!VALID_DAYS.includes(day)) return { ok: false, summary: `day inválido (esperado: ${VALID_DAYS.join('|')}).` };
    if (hours !== 'fechado') {
      const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(hours);
      if (!m) return { ok: false, summary: 'hours deve ser "HH:MM-HH:MM" ou "fechado".' };
      const sh = Number(m[1]), sm = Number(m[2]), eh = Number(m[3]), em = Number(m[4]);
      if (sh > 23 || eh > 23 || sm > 59 || em > 59) {
        return { ok: false, summary: 'hours invalido: HH deve ser 0-23 e MM deve ser 0-59.' };
      }
      if (sh * 60 + sm >= eh * 60 + em) {
        return { ok: false, summary: 'hours invalido: hora final deve ser maior que inicial.' };
      }
    }

    const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);
    if (!scope.doctor_id) return { ok: false, summary: 'Sem médico no escopo.' };

    const admin = supabaseAdmin();
    const { data: doc } = await admin
      .from('tenant_doctors')
      .select('id, doctor_name, working_hours')
      .eq('id', scope.doctor_id).eq('tenant_id', ctx.tenant_id).maybeSingle();
    if (!doc) return { ok: false, summary: 'Médico não encontrado.' };

    const wh = (doc.working_hours as Record<string, unknown>) ?? {};
    const before = String(wh[day] ?? 'fechado');

    return {
      ok: true,
      summary: `Mudar ${day} de "${before}" → "${hours}"?`,
      card: {
        summary: `Atualizar horário fixo`,
        detail: `Médico: ${doc.doctor_name}\nDia: ${day}\nAntes: ${before}\nDepois: ${hours}\n\nIMPACTO: o agente WhatsApp passa a informar este novo horário aos pacientes.`,
        confirm_label: 'Aplicar mudança',
        cancel_label: 'Voltar',
        confirmation_phrase: 'CONFIRMAR MUDANCA HORARIO',
        action: {
          tool: 'working_hours_atualizar',
          params: { day, hours, doctor_id: scope.doctor_id },
        },
      },
      data: { before, after: hours },
    };
  },

  async execute(params, ctx) {
    const day = String(params.day);
    const hours = String(params.hours);
    const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);
    if (!scope.doctor_id) return { ok: false, summary: 'Sem médico no escopo.' };

    const admin = supabaseAdmin();
    const { data: doc } = await admin
      .from('tenant_doctors')
      .select('working_hours')
      .eq('id', scope.doctor_id).eq('tenant_id', ctx.tenant_id).maybeSingle();
    const wh = { ...((doc?.working_hours as Record<string, unknown>) ?? {}) };
    wh[day] = hours;
    const { error } = await admin
      .from('tenant_doctors')
      .update({ working_hours: wh, updated_at: new Date().toISOString() })
      .eq('id', scope.doctor_id).eq('tenant_id', ctx.tenant_id);
    if (error) return { ok: false, summary: 'Falha ao atualizar.', error: error.message };
    return { ok: true, summary: `${day} agora é "${hours}". Prompt do WhatsApp regenerado.`, data: { day, hours } };
  },
};
