/**
 * Handlers das tools do agente interno.
 *
 * Cada handler recebe { params, tenant_id, user_id, role } e retorna ToolResult.
 * Handlers presumem que a auth + role check já foi feita no dispatch endpoint.
 *
 * Sprint 1: 9 reads implementados. Writes ficam null e são tratados pelo dispatch
 * como "Sprint 2 — em breve".
 */

import { supabaseAdmin } from './supabase';
import { deleteEvent, updateEvent } from './google-calendar';
import type { AgentRole } from './internal-agent-tools';
import { calcAvailableSlots } from './agenda-availability';

// Lookup interno: pega calendar_id do doctor pra propagar mudança no Google.
async function getDoctorCalendarId(tenantId: string, doctorId: string): Promise<string | null> {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from('tenant_doctors')
    .select('calendar_id')
    .eq('tenant_id', tenantId)
    .eq('id', doctorId)
    .maybeSingle<{ calendar_id: string | null }>();
  return data?.calendar_id ?? null;
}

export interface ToolContext {
  tenant_id: string;
  user_id: string;
  role: AgentRole;
}

export interface ToolResult {
  ok: boolean;
  summary: string; // 1 linha pra agente narrar
  data?: unknown;  // payload estruturado (chat-drawer pode renderizar como tabela/lista)
  error?: string;
}

type Handler = (params: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function fmtBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function getDoctorIds(tenantId: string): Promise<string[]> {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from('tenant_doctors')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');
  return (data ?? []).map((d) => d.id);
}

/**
 * Resolve o escopo de visão por médico segundo o role do usuário.
 *
 * Regra de produto (validada com o usuário em 2026-05-09):
 *   - role=doctor   → escopo INDIVIDUAL: queries filtradas pelo doctor_id
 *                     vinculado em tenant_members.doctor_id. Param doctor_id
 *                     do request é IGNORADO (médico não vê outros médicos).
 *   - role=admin/owner/staff → escopo COLETIVO: aceita doctor_id opcional
 *                              do request pra filtrar; sem ele = todos.
 *   - role=viewer   → coletivo (read-only de tudo).
 *
 * Caso role=doctor sem doctor_id vinculado em tenant_members: scope individual
 * mas doctor_id null → handler decide se retorna vazio ou erro semântico.
 */
async function resolveDoctorScope(
  ctx: ToolContext,
  requestedDoctorId?: string | null
): Promise<{ scope: 'individual' | 'collective'; doctor_id: string | null }> {
  if (ctx.role === 'doctor') {
    const admin = supabaseAdmin();
    const { data } = await admin
      .from('tenant_members')
      .select('doctor_id')
      .eq('tenant_id', ctx.tenant_id)
      .eq('user_id', ctx.user_id)
      .eq('status', 'active')
      .maybeSingle<{ doctor_id: string | null }>();
    return { scope: 'individual', doctor_id: data?.doctor_id ?? null };
  }
  return { scope: 'collective', doctor_id: requestedDoctorId ?? null };
}

// ──────────────────────────────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────────────────────────────

const agendaHoje: Handler = async (params, ctx) => {
  const admin = supabaseAdmin();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);

  // Source of truth: doctor_bookings (appointments é tabela legacy abandonada).
  // Status canônicos: booked / confirmed / completed / cancelled.
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

const agendaPeriodo: Handler = async (params, ctx) => {
  const start = String(params.start);
  const end = String(params.end);
  const status = String(params.status ?? 'all');
  const admin = supabaseAdmin();

  const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);

  // Source of truth: doctor_bookings. Status canônicos do enum:
  //   booked (recém-marcada) / confirmed (paciente reconfirmou) /
  //   completed (atendimento ocorrido) / cancelled (cancelada).
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

const pacientesCount: Handler = async (params, ctx) => {
  const since = params.since ? String(params.since) : null;
  const admin = supabaseAdmin();

  let q = admin
    .from('patients')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', ctx.tenant_id);

  if (since) q = q.gte('created_at', since);

  const { count, error } = await q;
  if (error) return { ok: false, summary: 'Erro ao contar pacientes', error: error.message };

  return {
    ok: true,
    summary: since
      ? `${count ?? 0} pacientes cadastrados desde ${since}.`
      : `${count ?? 0} pacientes cadastrados ao todo.`,
    data: { count: count ?? 0, since },
  };
};

const pacientesProximos: Handler = async (params, ctx) => {
  const weeks = Math.min(12, Math.max(1, Number(params.weeks_ahead ?? 2)));
  const now = new Date();
  const end = new Date(now.getTime() + weeks * 7 * 86_400_000);
  const admin = supabaseAdmin();

  const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);

  // Source of truth: doctor_bookings (slot_start em vez de appointment_date,
  // patient_name/phone denormalizados, status enum {booked, confirmed,
  // completed, cancelled}).
  let q = admin
    .from('doctor_bookings')
    .select('id, patient_id, patient_name, slot_start, status')
    .eq('tenant_id', ctx.tenant_id)
    .gte('slot_start', now.toISOString())
    .lte('slot_start', end.toISOString())
    .neq('status', 'cancelled');

  if (scope.doctor_id) q = q.eq('doctor_id', scope.doctor_id);

  const { data, error } = await q;

  if (error) return { ok: false, summary: 'Erro ao buscar próximos', error: error.message };

  const list = data ?? [];
  // breakdown por semana
  const byWeek: number[] = Array(weeks).fill(0);
  list.forEach((a) => {
    const days = Math.floor((new Date(a.slot_start).getTime() - now.getTime()) / 86_400_000);
    const wk = Math.min(weeks - 1, Math.floor(days / 7));
    byWeek[wk]++;
  });

  // pacientes únicos: dedupe por patient_name (denormalizado), guardando
  // primeiro slot futuro de cada um pra o agente conseguir listar nominalmente
  const seen = new Map<string, { name: string; next_slot: string; appointments: number }>();
  for (const a of list) {
    const key = (a.patient_name || a.patient_id || '').trim();
    if (!key) continue;
    const existing = seen.get(key);
    if (!existing || new Date(a.slot_start) < new Date(existing.next_slot)) {
      seen.set(key, {
        name: a.patient_name || key,
        next_slot: a.slot_start,
        appointments: (existing?.appointments ?? 0) + 1,
      });
    } else {
      existing.appointments += 1;
    }
  }
  const patients = Array.from(seen.values())
    .sort((a, b) => new Date(a.next_slot).getTime() - new Date(b.next_slot).getTime())
    .map((p) => ({
      name: p.name,
      next_slot: new Date(p.next_slot).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
      appointments: p.appointments,
    }));

  return {
    ok: true,
    summary: `${list.length} consulta(s) marcada(s) nas próximas ${weeks} semana(s) — ${patients.length} pacientes únicos.`,
    data: {
      total_appointments: list.length,
      unique_patients: patients.length,
      by_week: byWeek.map((count, i) => ({ week: i + 1, appointments: count })),
      patients,
    },
  };
};

const pagamentosStatus: Handler = async (params, ctx) => {
  const start = params.start
    ? String(params.start)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const end = params.end ? String(params.end) : new Date().toISOString();
  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from('tenant_payments')
    .select('consultation_value, status, payment_method, created_at, asaas_net_value')
    .eq('tenant_id', ctx.tenant_id)
    .gte('created_at', start)
    .lte('created_at', end);

  if (error) return { ok: false, summary: 'Erro ao buscar pagamentos', error: error.message };

  const list = data ?? [];
  const approved = list.filter((p) => ['approved', 'paid', 'received', 'confirmed'].includes((p.status ?? '').toLowerCase()));
  const pending = list.filter((p) => (p.status ?? '').toLowerCase() === 'pending');
  const total_received = approved.reduce((s, p) => s + Number(p.consultation_value || 0), 0);
  const total_net = approved.reduce((s, p) => s + Number(p.asaas_net_value || p.consultation_value || 0), 0);
  const total_pending = pending.reduce((s, p) => s + Number(p.consultation_value || 0), 0);

  const byMethod = approved.reduce<Record<string, number>>((acc, p) => {
    const m = p.payment_method ?? 'outro';
    acc[m] = (acc[m] ?? 0) + Number(p.consultation_value || 0);
    return acc;
  }, {});

  return {
    ok: true,
    summary: `Recebido: ${fmtBRL(total_received)} (líquido ${fmtBRL(total_net)}). Pendente: ${fmtBRL(total_pending)} de ${pending.length} cobrança(s).`,
    data: {
      total_received,
      total_net,
      total_pending,
      count_approved: approved.length,
      count_pending: pending.length,
      by_method: byMethod,
    },
  };
};

const pagamentosPendentes: Handler = async (params, ctx) => {
  const overdueOnly = Boolean(params.include_overdue_only);
  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from('tenant_payments')
    .select('id, patient_name, patient_phone, consultation_value, created_at, payment_method')
    .eq('tenant_id', ctx.tenant_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) return { ok: false, summary: 'Erro ao buscar pendentes', error: error.message };

  const now = Date.now();
  const list = (data ?? [])
    .map((p) => {
      const days_open = Math.floor((now - new Date(p.created_at!).getTime()) / 86_400_000);
      return {
        id: p.id,
        patient_name: p.patient_name,
        phone: p.patient_phone,
        value: Number(p.consultation_value),
        method: p.payment_method,
        days_open,
        is_overdue: days_open > 3,
      };
    })
    .filter((p) => (overdueOnly ? p.is_overdue : true));

  const total = list.reduce((s, p) => s + p.value, 0);
  const overdue_count = list.filter((p) => p.is_overdue).length;

  return {
    ok: true,
    summary:
      list.length === 0
        ? 'Nenhuma cobrança pendente.'
        : `${list.length} pendente(s) somando ${fmtBRL(total)}. ${overdue_count} vencida(s).`,
    data: { total_value: total, count: list.length, overdue_count, items: list },
  };
};

const npsResumo: Handler = async (params, ctx) => {
  const since = params.since
    ? String(params.since)
    : new Date(Date.now() - 90 * 86_400_000).toISOString();
  const admin = supabaseAdmin();

  const { data, error } = await admin
    .from('patient_feedback')
    .select('nps_score, feedback_text, patient_name, responded_at')
    .eq('tenant_id', ctx.tenant_id)
    .not('nps_score', 'is', null)
    .gte('responded_at', since)
    .order('responded_at', { ascending: false });

  if (error) return { ok: false, summary: 'Erro ao buscar NPS', error: error.message };

  const list = data ?? [];
  if (list.length === 0) {
    return { ok: true, summary: 'Sem respostas de NPS no período.', data: { count: 0 } };
  }

  const scores = list.map((f) => f.nps_score as number);
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  const passives = scores.length - promoters - detractors;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const npsScore = Math.round(((promoters - detractors) / scores.length) * 100);

  const positive = list.filter((f) => (f.nps_score as number) >= 9 && f.feedback_text).slice(0, 3);
  const negative = list.filter((f) => (f.nps_score as number) <= 6 && f.feedback_text).slice(0, 3);

  return {
    ok: true,
    summary: `NPS ${npsScore} (média ${avg.toFixed(1)}/10) com ${list.length} resposta(s). ${promoters} promotor(es), ${detractors} detrator(es).`,
    data: {
      nps_score: npsScore,
      avg,
      count: list.length,
      promoters,
      passives,
      detractors,
      top_positive: positive.map((f) => ({ name: f.patient_name, score: f.nps_score, text: f.feedback_text })),
      top_negative: negative.map((f) => ({ name: f.patient_name, score: f.nps_score, text: f.feedback_text })),
    },
  };
};

const reviewsExternos: Handler = async (_params, ctx) => {
  const admin = supabaseAdmin();
  // v_latest_tenant_scores é a view agregada; fallback pra tenant_scores se view ausente
  let data: any = null;
  let error: any = null;

  const viewQ = await admin
    .from('v_latest_tenant_scores')
    .select('total_score, classification, google_score, google_rating, google_reviews_count, doctoralia_score, doctoralia_rating, doctoralia_reviews_count, doctoralia_present, collected_at')
    .eq('tenant_id', ctx.tenant_id)
    .maybeSingle();

  if (viewQ.data) {
    data = viewQ.data;
  } else {
    const tableQ = await admin
      .from('tenant_scores')
      .select('total_score, classification, google_score, google_rating, google_reviews_count, doctoralia_score, doctoralia_rating, doctoralia_reviews_count, doctoralia_present, collected_at')
      .eq('tenant_id', ctx.tenant_id)
      .order('collected_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    data = tableQ.data;
    error = tableQ.error;
  }

  if (error && error.code !== 'PGRST116') {
    return { ok: false, summary: 'Erro ao buscar reviews', error: error.message };
  }
  if (!data) {
    return {
      ok: true,
      summary: 'Sem dados de reviews externas ainda — Singulare Score não foi coletado.',
      data: null,
    };
  }

  const summary = `Google: ${data.google_rating ?? '—'}★ (${data.google_reviews_count ?? 0} reviews). Doctoralia: ${data.doctoralia_present ? `${data.doctoralia_rating ?? '—'}★ (${data.doctoralia_reviews_count ?? 0} reviews)` : 'sem perfil'}.`;

  return {
    ok: true,
    summary,
    data: {
      collected_at: data.collected_at,
      classification: data.classification,
      google: {
        rating: data.google_rating,
        reviews_count: data.google_reviews_count,
        score: data.google_score,
      },
      doctoralia: {
        present: data.doctoralia_present,
        rating: data.doctoralia_rating,
        reviews_count: data.doctoralia_reviews_count,
        score: data.doctoralia_score,
      },
    },
  };
};

const documentosListar: Handler = async (params, ctx) => {
  const limit = Math.min(50, Math.max(1, Number(params.limit ?? 10)));
  const status = String(params.status ?? 'all');
  const pacienteId = params.paciente_id ? Number(params.paciente_id) : null;
  const admin = supabaseAdmin();

  const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);

  let q = admin
    .from('medical_documents')
    .select('id, doc_type, status, patient_id, doctor_id, pdf_url, signed_pdf_url, signed_at, sent_to_patient_at, created_at')
    .eq('tenant_id', ctx.tenant_id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status !== 'all') q = q.eq('status', status);
  if (pacienteId) q = q.eq('patient_id', pacienteId);
  if (scope.doctor_id) q = q.eq('doctor_id', scope.doctor_id);

  const { data, error } = await q;
  if (error) {
    return {
      ok: true,
      summary: 'Sem documentos ou tabela ainda não disponível.',
      data: { count: 0, items: [] },
    };
  }

  const list = data ?? [];
  const signed = list.filter((d) => d.status === 'signed').length;
  const draft = list.filter((d) => d.status === 'draft').length;

  return {
    ok: true,
    summary: `${list.length} documento(s) — ${signed} assinado(s), ${draft} rascunho(s).`,
    data: { count: list.length, signed, draft, items: list },
  };
};

const horariosLivres: Handler = async (params, ctx) => {
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

  // Resolve médico(s) e working_hours
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
    // Bookings ocupados — captura qualquer overlap com a janela
    const { data: bookings } = await admin
      .from('doctor_bookings')
      .select('slot_start, slot_end')
      .eq('tenant_id', ctx.tenant_id)
      .eq('doctor_id', doc.id)
      .neq('status', 'cancelled')
      .lt('slot_start', end.toISOString())
      .gt('slot_end', start.toISOString());

    // Bloqueios — idem (block longo tipo ferias precisa ser pego mesmo se start_at < janela)
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

// ──────────────────────────────────────────────────────────────────────
// WRITE HANDLERS (Sprint 2)
// Cada write tem .propose() (preview, sem mutação) e .execute() (mutação real).
// Dispatch decide qual chamar via mode='propose'|'execute'.
// ──────────────────────────────────────────────────────────────────────

export interface ProposalCard {
  summary: string;
  detail?: string;
  confirm_label?: string;
  cancel_label?: string;
  confirmation_phrase?: string;  // se presente, painel exige digitação literal antes de habilitar confirm
  action: { tool: string; params: Record<string, unknown> };
}

export interface WriteHandler {
  propose: (params: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult & { card?: ProposalCard }>;
  execute: (params: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

// ── consulta_reagendar ─────────────────────────────────────────
// Opera em doctor_bookings (source of truth). Quando a booking tem
// calendar_event_id, propaga o move pro Google Calendar via Service Account
// — webhook sincroniza tenant_calendar_events e o slot antigo é liberado.
const consultaReagendar: WriteHandler = {
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

    // Pega duration pra recalcular slot_end
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

// ── consulta_cancelar ──────────────────────────────────────────
// Cancela booking + deleta evento no Google Calendar (Service Account).
// Sem o delete no Google, fn_get_available_slots seguiria vendo o slot ocupado
// porque tenant_calendar_events guardaria o evento (sync via webhook).
const consultaCancelar: WriteHandler = {
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

    // Propaga delete pro Google Calendar (idempotente: 404/410 contam como sucesso).
    // Webhook → tenant_calendar_events removerá a linha em ~5s, liberando o slot.
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

// ── paciente_criar ─────────────────────────────────────────────
const pacienteCriar: WriteHandler = {
  async propose(params, _ctx) {
    const name = String(params.name ?? '').trim();
    const phone = String(params.phone ?? '').trim();
    const birthdate = params.birthdate ? String(params.birthdate) : null;
    const email = params.email ? String(params.email) : null;
    if (!name) return { ok: false, summary: 'Nome obrigatório.' };
    if (!phone.match(/^\+\d{12,14}$/)) {
      return { ok: false, summary: 'Telefone deve ser E.164 (ex: +5511999999999).' };
    }
    return {
      ok: true,
      summary: `Cadastrar ${name}?`,
      card: {
        summary: `Cadastrar paciente`,
        detail: `Nome: ${name}\nTelefone: ${phone}${birthdate ? `\nNascimento: ${birthdate}` : ''}${email ? `\nEmail: ${email}` : ''}`,
        confirm_label: 'Confirmar cadastro',
        cancel_label: 'Voltar',
        action: { tool: 'paciente_criar', params: { name, phone, birthdate, email } },
      },
      data: { name, phone, birthdate, email },
    };
  },
  async execute(params, ctx) {
    const admin = supabaseAdmin();
    // Verifica duplicidade por phone+tenant
    const { data: existing } = await admin
      .from('patients')
      .select('id, name')
      .eq('tenant_id', ctx.tenant_id)
      .eq('phone', String(params.phone))
      .maybeSingle();
    if (existing) {
      return {
        ok: false,
        summary: `Já existe paciente com esse telefone: ${existing.name}.`,
        error: 'duplicate',
      };
    }
    const { data, error } = await admin
      .from('patients')
      .insert({
        tenant_id: ctx.tenant_id,
        name: String(params.name),
        phone: String(params.phone),
        birthdate: params.birthdate ? String(params.birthdate) : null,
        email: params.email ? String(params.email) : null,
        notes: 'Criado via agente interno',
        tags: [],
      })
      .select('id, name, phone')
      .maybeSingle();
    if (error) return { ok: false, summary: 'Falha ao cadastrar', error: error.message };
    return { ok: true, summary: `Paciente ${data?.name} cadastrado.`, data };
  },
};

// ── consulta_marcar ─────────────────────────────────────────────
// Cria nova consulta em doctor_bookings. Source-of-truth: NÃO sincroniza
// pro Google Calendar nesta versão (calendar_event_id fica null). Próxima
// sync feita por job separado se houver.
const consultaMarcar: WriteHandler = {
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

    // Conflitos — overlap real (start < slotEnd AND end > slotStart)
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

    // Re-validar paciente
    const { data: patient } = await admin
      .from('patients').select('id, name, phone').eq('id', String(params.patient_id))
      .eq('tenant_id', ctx.tenant_id).maybeSingle();
    if (!patient) return { ok: false, summary: 'Paciente não encontrado no execute.' };

    // Re-validar conflito de slot (outro booking pode ter entrado entre propose e execute).
    // O EXCLUDE constraint em doctor_bookings tambem pega isso, mas re-check da mensagem util.
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
      // Erro 23P01 do Postgres = exclusion_violation (constraint doctor_bookings_no_overlap).
      // Pode acontecer em race extremo (insert concorrente apos o re-check acima).
      if (error.code === '23P01') {
        return { ok: false, summary: 'Conflito de slot detectado pelo banco (insert concorrente). Tente outro horario.' };
      }
      return { ok: false, summary: 'Falha ao criar consulta', error: error.message };
    }
    return { ok: true, summary: `Consulta criada (id ${data?.id}).`, data: { booking: data } };
  },
};

// ── cobranca_avulsa ────────────────────────────────────────────
// Sprint 2 stub: propose mostra preview, execute delega pra /api/painel/cobrancas
// (que já tem integração Asaas validada).
const cobrancaAvulsa: WriteHandler = {
  async propose(params, ctx) {
    const pacienteId = String(params.paciente_id);
    const valor = Number(params.valor);
    const desc = String(params.descricao ?? 'Consulta');
    const metodo = String(params.metodo ?? 'pix');
    if (!pacienteId || valor <= 0) {
      return { ok: false, summary: 'Paciente e valor obrigatórios.' };
    }
    const admin = supabaseAdmin();
    const { data: paciente } = await admin
      .from('users')
      .select('id, name, phone, email')
      .eq('id', pacienteId)
      .maybeSingle();
    if (!paciente) return { ok: false, summary: 'Paciente não encontrado.' };
    return {
      ok: true,
      summary: `Cobrar ${fmtBRL(valor)} de ${paciente.name}?`,
      card: {
        summary: `Gerar cobrança Asaas`,
        detail: `Para: ${paciente.name}\nValor: ${fmtBRL(valor)}\nMétodo: ${metodo.toUpperCase()}\nDescrição: ${desc}`,
        confirm_label: 'Gerar cobrança',
        cancel_label: 'Voltar',
        action: { tool: 'cobranca_avulsa', params: { paciente_id: pacienteId, valor, descricao: desc, metodo } },
      },
      data: { paciente, valor, metodo, desc },
    };
  },
  async execute(params, ctx) {
    // Delega pro endpoint existente que já cuida de Asaas + persistência
    const url = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.singulare.org'}/api/marketplace/charge`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.N8N_TO_VERCEL_TOKEN}`,
      },
      body: JSON.stringify({
        tenant_id: ctx.tenant_id,
        patient_id: params.paciente_id,
        value: params.valor,
        description: params.descricao,
        method: params.metodo,
        source: 'internal_agent',
      }),
    });
    if (!r.ok) {
      return { ok: false, summary: `Falha Asaas: HTTP ${r.status}`, error: await r.text() };
    }
    const j = await r.json().catch(() => ({}));
    return { ok: true, summary: 'Cobrança gerada. Link enviado.', data: j };
  },
};

// ── documento_gerar / documento_assinar ────────────────────────
// Sprint 2 stub: propose preview; execute sinaliza handoff p/ UI do painel
// (gerar/assinar docs requer template editor + BirdID modal — UX visual essencial)
const documentoGerar: WriteHandler = {
  async propose(params, _ctx) {
    return {
      ok: true,
      summary: 'Gerar documento (precisa do painel pra preencher campos).',
      card: {
        summary: 'Gerar documento',
        detail: `Template: ${params.template_id}\nPaciente: ${params.paciente_id}\nVou abrir o editor de documentos pra você preencher e revisar antes de enviar.`,
        confirm_label: 'Abrir editor',
        cancel_label: 'Voltar',
        action: { tool: 'documento_gerar', params },
      },
    };
  },
  async execute(params, _ctx) {
    return {
      ok: true,
      summary: 'Abre o editor pra finalizar.',
      data: {
        redirect: `/painel/docs?action=new&template=${params.template_id}&paciente=${params.paciente_id}`,
      },
    };
  },
};

const documentoAssinar: WriteHandler = {
  async propose(params, ctx) {
    const docId = Number(params.documento_id);
    const admin = supabaseAdmin();
    const { data: doc } = await admin
      .from('medical_documents')
      .select('id, doc_type, status, patient_id')
      .eq('tenant_id', ctx.tenant_id)
      .eq('id', docId)
      .maybeSingle();
    if (!doc) return { ok: false, summary: 'Documento não encontrado.' };
    if (doc.status === 'signed') return { ok: false, summary: 'Documento já assinado.' };
    return {
      ok: true,
      summary: `Enviar pra assinatura via BirdID?`,
      card: {
        summary: 'Enviar pra assinatura',
        detail: `Documento: ${doc.doc_type}\nVai abrir BirdID pra assinatura digital.`,
        confirm_label: 'Enviar pra BirdID',
        cancel_label: 'Voltar',
        action: { tool: 'documento_assinar', params: { documento_id: docId } },
      },
      data: { doc },
    };
  },
  async execute(params, _ctx) {
    return {
      ok: true,
      summary: 'Abrindo fluxo BirdID...',
      data: {
        redirect: `/painel/docs?action=sign&id=${params.documento_id}`,
      },
    };
  },
};

// ── bloquear_horario ───────────────────────────────────────────
// Insere linha em doctor_schedule_blocks. Em propose lista bookings que
// caem dentro da janela (apenas aviso — bloqueio não cancela nada).
const bloquearHorario: WriteHandler = {
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

    // Bookings que caem dentro (overlap real)
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

// ──────────────────────────────────────────────────────────────────────
// working_hours_atualizar — altera a rotina semanal fixa do médico.
// Requer digitação literal da frase de confirmação no painel.
// Trigger trg_doctor_prompt_rebuild regenera rendered_prompt automaticamente.
// ──────────────────────────────────────────────────────────────────────

const workingHoursAtualizar: WriteHandler = {
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
    // Trigger trg_doctor_prompt_rebuild regenera rendered_prompt automaticamente.
    return { ok: true, summary: `${day} agora é "${hours}". Prompt do WhatsApp regenerado.`, data: { day, hours } };
  },
};

// ──────────────────────────────────────────────────────────────────────
// medicos_listar — sempre respeita scope: doctor vê só ele mesmo,
// admin/owner/staff vê todos os médicos do tenant.
// ──────────────────────────────────────────────────────────────────────

const medicosListar: Handler = async (_params, ctx) => {
  const admin = supabaseAdmin();
  const scope = await resolveDoctorScope(ctx);

  let q = admin
    .from('tenant_doctors')
    .select('id, doctor_name, specialty, doctor_crm, status')
    .eq('tenant_id', ctx.tenant_id)
    .eq('status', 'active')
    .order('doctor_name', { ascending: true });

  if (scope.scope === 'individual' && scope.doctor_id) {
    q = q.eq('id', scope.doctor_id);
  }

  const { data, error } = await q;
  if (error) return { ok: false, summary: 'Erro ao buscar médicos', error: error.message };

  const list = (data ?? []).map((d) => ({
    doctor_id: d.id,
    name: d.doctor_name,
    specialty: d.specialty,
    crm: d.doctor_crm,
  }));

  // doctor sem vínculo em tenant_members.doctor_id → retorna vazio com sinal claro
  if (scope.scope === 'individual' && !scope.doctor_id) {
    return {
      ok: true,
      summary: 'Seu usuário não está vinculado a um perfil de médico no tenant. Pede pra um admin configurar tenant_members.doctor_id.',
      data: { count: 0, doctors: [], scope: 'individual_unlinked' },
    };
  }

  return {
    ok: true,
    summary:
      list.length === 0
        ? 'Nenhum médico ativo cadastrado.'
        : list.length === 1
          ? `1 médico ativo: ${list[0].name} (${list[0].specialty}).`
          : `${list.length} médicos ativos: ${list.map((d) => d.name).join(', ')}.`,
    data: { count: list.length, doctors: list, scope: scope.scope },
  };
};

// ──────────────────────────────────────────────────────────────────────
// Registry
// ──────────────────────────────────────────────────────────────────────

export const HANDLERS: Record<string, Handler> = {
  agenda_hoje: agendaHoje,
  agenda_periodo: agendaPeriodo,
  pacientes_count: pacientesCount,
  pacientes_proximos: pacientesProximos,
  pagamentos_status: pagamentosStatus,
  pagamentos_pendentes: pagamentosPendentes,
  nps_resumo: npsResumo,
  reviews_externos: reviewsExternos,
  documentos_listar: documentosListar,
  medicos_listar: medicosListar,
  horarios_livres: horariosLivres,
};

export const WRITE_HANDLERS: Record<string, WriteHandler> = {
  consulta_reagendar: consultaReagendar,
  consulta_marcar: consultaMarcar,
  consulta_cancelar: consultaCancelar,
  paciente_criar: pacienteCriar,
  cobranca_avulsa: cobrancaAvulsa,
  documento_gerar: documentoGerar,
  documento_assinar: documentoAssinar,
  bloquear_horario: bloquearHorario,
  working_hours_atualizar: workingHoursAtualizar,
};

export function getHandler(name: string): Handler | null {
  return HANDLERS[name] ?? null;
}

export function getWriteHandler(name: string): WriteHandler | null {
  return WRITE_HANDLERS[name] ?? null;
}
