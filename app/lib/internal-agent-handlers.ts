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

// ──────────────────────────────────────────────────────────────────────
// Handlers
// ──────────────────────────────────────────────────────────────────────

const agendaHoje: Handler = async (_params, ctx) => {
  const admin = supabaseAdmin();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const { data, error } = await admin
    .from('appointments')
    .select('id, patient_id, doctor_id, appointment_date, status, amount, description')
    .eq('tenant_id', ctx.tenant_id)
    .gte('appointment_date', startOfDay.toISOString())
    .lte('appointment_date', endOfDay.toISOString())
    .order('appointment_date', { ascending: true });

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

  let q = admin
    .from('appointments')
    .select('id, patient_id, doctor_id, appointment_date, status, amount')
    .eq('tenant_id', ctx.tenant_id)
    .gte('appointment_date', start)
    .lte('appointment_date', end + 'T23:59:59.999Z')
    .order('appointment_date', { ascending: true });

  if (status !== 'all') q = q.eq('status', status);

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

  const { data, error } = await admin
    .from('appointments')
    .select('id, patient_id, appointment_date, status')
    .eq('tenant_id', ctx.tenant_id)
    .gte('appointment_date', now.toISOString())
    .lte('appointment_date', end.toISOString())
    .neq('status', 'cancelled');

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

  let q = admin
    .from('medical_documents')
    .select('id, doc_type, status, patient_id, doctor_id, pdf_url, signed_pdf_url, signed_at, sent_to_patient_at, created_at')
    .eq('tenant_id', ctx.tenant_id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status !== 'all') q = q.eq('status', status);
  if (pacienteId) q = q.eq('patient_id', pacienteId);

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
};

export function getHandler(name: string): Handler | null {
  return HANDLERS[name] ?? null;
}
