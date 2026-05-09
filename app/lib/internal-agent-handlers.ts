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
import type { AgentRole } from './internal-agent-tools';

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

  let q = admin
    .from('appointments')
    .select('id, patient_id, doctor_id, appointment_date, status, amount, description')
    .eq('tenant_id', ctx.tenant_id)
    .gte('appointment_date', startOfDay.toISOString())
    .lte('appointment_date', endOfDay.toISOString())
    .order('appointment_date', { ascending: true });

  if (scope.doctor_id) q = q.eq('doctor_id', scope.doctor_id);

  const { data, error } = await q;

  if (error) return { ok: false, summary: 'Erro ao buscar agenda', error: error.message };

  const list = (data ?? []).map((a) => ({
    id: a.id,
    time: new Date(a.appointment_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    patient_id: a.patient_id,
    status: a.status,
    description: a.description,
  }));

  return {
    ok: true,
    summary:
      list.length === 0
        ? 'Sem consultas hoje.'
        : `${list.length} ${list.length === 1 ? 'consulta' : 'consultas'} hoje. ${list.filter((l) => l.status === 'confirmed').length} confirmada(s).`,
    data: { count: list.length, appointments: list },
  };
};

const agendaPeriodo: Handler = async (params, ctx) => {
  const start = String(params.start);
  const end = String(params.end);
  const status = String(params.status ?? 'all');
  const admin = supabaseAdmin();

  const scope = await resolveDoctorScope(ctx, params.doctor_id as string | undefined);

  let q = admin
    .from('appointments')
    .select('id, patient_id, doctor_id, appointment_date, status, amount')
    .eq('tenant_id', ctx.tenant_id)
    .gte('appointment_date', start)
    .lte('appointment_date', end + 'T23:59:59.999Z')
    .order('appointment_date', { ascending: true });

  if (status !== 'all') q = q.eq('status', status);
  if (scope.doctor_id) q = q.eq('doctor_id', scope.doctor_id);

  const { data, error } = await q;
  if (error) return { ok: false, summary: 'Erro ao buscar agenda', error: error.message };

  const list = data ?? [];
  const byStatus = list.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    ok: true,
    summary: `${list.length} consulta(s) entre ${start} e ${end}. ${byStatus.confirmed ?? 0} confirmadas, ${byStatus.scheduled ?? 0} pendentes, ${byStatus.completed ?? 0} concluídas, ${byStatus.cancelled ?? 0} canceladas.`,
    data: {
      total: list.length,
      breakdown: byStatus,
      appointments: list.map((a) => ({
        id: a.id,
        when: fmtDate(a.appointment_date),
        status: a.status,
        amount: a.amount,
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

  let q = admin
    .from('appointments')
    .select('id, patient_id, appointment_date, status')
    .eq('tenant_id', ctx.tenant_id)
    .gte('appointment_date', now.toISOString())
    .lte('appointment_date', end.toISOString())
    .neq('status', 'cancelled');

  if (scope.doctor_id) q = q.eq('doctor_id', scope.doctor_id);

  const { data, error } = await q;

  if (error) return { ok: false, summary: 'Erro ao buscar próximos', error: error.message };

  const list = data ?? [];
  // breakdown por semana
  const byWeek: number[] = Array(weeks).fill(0);
  list.forEach((a) => {
    const days = Math.floor((new Date(a.appointment_date).getTime() - now.getTime()) / 86_400_000);
    const wk = Math.min(weeks - 1, Math.floor(days / 7));
    byWeek[wk]++;
  });

  // pacientes únicos
  const unique = new Set(list.map((a) => a.patient_id)).size;

  return {
    ok: true,
    summary: `${list.length} consulta(s) marcada(s) nas próximas ${weeks} semana(s) — ${unique} pacientes únicos.`,
    data: {
      total_appointments: list.length,
      unique_patients: unique,
      by_week: byWeek.map((count, i) => ({ week: i + 1, appointments: count })),
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
  action: { tool: string; params: Record<string, unknown> };
}

export interface WriteHandler {
  propose: (params: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult & { card?: ProposalCard }>;
  execute: (params: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

// ── consulta_reagendar ─────────────────────────────────────────
const consultaReagendar: WriteHandler = {
  async propose(params, ctx) {
    const apptId = String(params.appointment_id);
    const newDate = String(params.new_date);
    const admin = supabaseAdmin();
    const { data: appt, error } = await admin
      .from('appointments')
      .select('id, appointment_date, status, patient_id, doctor_id')
      .eq('tenant_id', ctx.tenant_id)
      .eq('id', apptId)
      .maybeSingle();
    if (error || !appt) {
      return { ok: false, summary: 'Consulta não encontrada', error: 'not_found' };
    }
    if (appt.status === 'cancelled') {
      return { ok: false, summary: 'Consulta já está cancelada — não dá pra reagendar.' };
    }
    const oldFmt = fmtDate(appt.appointment_date);
    const newFmt = fmtDate(newDate);
    return {
      ok: true,
      summary: `Reagendar de ${oldFmt} → ${newFmt}?`,
      card: {
        summary: `Reagendar consulta`,
        detail: `De ${oldFmt} para ${newFmt}`,
        confirm_label: 'Confirmar reagendamento',
        cancel_label: 'Voltar',
        action: { tool: 'consulta_reagendar', params: { appointment_id: apptId, new_date: newDate } },
      },
      data: { appointment: appt, new_date: newDate },
    };
  },
  async execute(params, ctx) {
    const apptId = String(params.appointment_id);
    const newDate = String(params.new_date);
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('appointments')
      .update({ appointment_date: newDate, updated_at: new Date().toISOString() })
      .eq('tenant_id', ctx.tenant_id)
      .eq('id', apptId)
      .select('id, appointment_date, status')
      .maybeSingle();
    if (error) return { ok: false, summary: 'Falha ao reagendar', error: error.message };
    if (!data) return { ok: false, summary: 'Consulta não encontrada', error: 'not_found' };
    return {
      ok: true,
      summary: `Reagendado pra ${fmtDate(data.appointment_date)}.`,
      data: { appointment: data },
    };
  },
};

// ── consulta_cancelar ──────────────────────────────────────────
const consultaCancelar: WriteHandler = {
  async propose(params, ctx) {
    const apptId = String(params.appointment_id);
    const reason = params.reason ? String(params.reason) : null;
    const admin = supabaseAdmin();
    const { data: appt } = await admin
      .from('appointments')
      .select('id, appointment_date, status, description')
      .eq('tenant_id', ctx.tenant_id)
      .eq('id', apptId)
      .maybeSingle();
    if (!appt) return { ok: false, summary: 'Consulta não encontrada', error: 'not_found' };
    if (appt.status === 'cancelled') return { ok: false, summary: 'Consulta já cancelada.' };
    return {
      ok: true,
      summary: `Cancelar consulta de ${fmtDate(appt.appointment_date)}?`,
      card: {
        summary: 'Cancelar consulta',
        detail: `${appt.description ?? 'Consulta'} — ${fmtDate(appt.appointment_date)}${reason ? `\nMotivo: ${reason}` : ''}`,
        confirm_label: 'Sim, cancelar',
        cancel_label: 'Voltar',
        action: { tool: 'consulta_cancelar', params: { appointment_id: apptId, reason } },
      },
      data: { appointment: appt },
    };
  },
  async execute(params, ctx) {
    const apptId = String(params.appointment_id);
    const reason = params.reason ? String(params.reason) : null;
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('appointments')
      .update({
        status: 'cancelled',
        description: reason ? `[CANCELADO] ${reason}` : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', ctx.tenant_id)
      .eq('id', apptId)
      .select('id, status, appointment_date')
      .maybeSingle();
    if (error) return { ok: false, summary: 'Falha ao cancelar', error: error.message };
    if (!data) return { ok: false, summary: 'Consulta não encontrada', error: 'not_found' };
    return { ok: true, summary: 'Consulta cancelada.', data };
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
};

export const WRITE_HANDLERS: Record<string, WriteHandler> = {
  consulta_reagendar: consultaReagendar,
  consulta_cancelar: consultaCancelar,
  paciente_criar: pacienteCriar,
  cobranca_avulsa: cobrancaAvulsa,
  documento_gerar: documentoGerar,
  documento_assinar: documentoAssinar,
};

export function getHandler(name: string): Handler | null {
  return HANDLERS[name] ?? null;
}

export function getWriteHandler(name: string): WriteHandler | null {
  return WRITE_HANDLERS[name] ?? null;
}
