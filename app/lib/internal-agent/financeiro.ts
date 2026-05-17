/**
 * Financeiro: pagamentos_status, pagamentos_pendentes (reads) + cobranca_avulsa (write).
 */
import { supabaseAdmin } from '../supabase';
import type { Handler, WriteHandler } from './shared';
import { fmtBRL } from './shared';

export const pagamentosStatus: Handler = async (params, ctx) => {
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

export const pagamentosPendentes: Handler = async (params, ctx) => {
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

// ── cobrancas_paciente ────────────────────────────────────────
// Extrato financeiro de 1 paciente. Identifica via id, nome (ilike) OU
// phone (E.164). Match canônico em tenant_payments é por patient_phone
// (tabela e denormalizada, sem FK). RBAC: tenant_id filter em TODA query.
export const cobrancasPaciente: Handler = async (params, ctx) => {
  const patientIdIn = params.patient_id ? String(params.patient_id).trim() : '';
  const patientNameIn = params.patient_name ? String(params.patient_name).trim() : '';
  const patientPhoneIn = params.patient_phone ? String(params.patient_phone).trim() : '';

  if (!patientIdIn && !patientNameIn && !patientPhoneIn) {
    return {
      ok: false,
      summary: 'Sem paciente identificado. Passe patient_id, patient_name ou patient_phone.',
    };
  }

  const admin = supabaseAdmin();

  // 1. Resolver patient_phone (chave canonica)
  let phone = patientPhoneIn;
  let resolvedName = patientNameIn;
  let resolvedEmail = '';

  if (phone && !resolvedName) {
    // Quando phone vem direto, tenta resolver name/email pra evitar fallback "paciente"
    const { data: pat } = await admin
      .from('patients')
      .select('name, email')
      .eq('phone', phone)
      .eq('tenant_id', ctx.tenant_id)
      .maybeSingle();
    if (pat) {
      resolvedName = pat.name ?? '';
      resolvedEmail = pat.email ?? '';
    }
  }

  if (!phone) {
    if (patientIdIn) {
      // patients.id e bigint; aceita string ou number
      const idNum = Number(patientIdIn);
      if (!Number.isFinite(idNum)) {
        return { ok: false, summary: 'patient_id invalido (esperado numero).' };
      }
      const { data: pat } = await admin
        .from('patients')
        .select('name, phone, email')
        .eq('id', idNum)
        .eq('tenant_id', ctx.tenant_id)
        .maybeSingle();
      if (!pat) return { ok: false, summary: 'Paciente nao encontrado neste tenant.' };
      phone = pat.phone ?? '';
      resolvedName = pat.name ?? resolvedName;
      resolvedEmail = pat.email ?? '';
      if (!phone) {
        return { ok: false, summary: 'Paciente sem telefone cadastrado — nao da pra buscar cobrancas.' };
      }
    } else {
      // patient_name path
      const { data: matches } = await admin
        .from('patients')
        .select('id, name, phone, email')
        .eq('tenant_id', ctx.tenant_id)
        .ilike('name', `%${patientNameIn}%`)
        .limit(5);
      if (!matches || matches.length === 0) {
        return {
          ok: false,
          summary: `Paciente "${patientNameIn}" nao encontrado.`,
          data: { missing_patient: { name: patientNameIn } },
        };
      }
      if (matches.length > 1) {
        return {
          ok: false,
          summary: `${matches.length} pacientes batem com "${patientNameIn}". Especifique o ID ou telefone.`,
          data: { ambiguous: matches },
        };
      }
      phone = matches[0].phone ?? '';
      resolvedName = matches[0].name ?? resolvedName;
      resolvedEmail = matches[0].email ?? '';
      if (!phone) {
        return { ok: false, summary: 'Paciente sem telefone cadastrado — nao da pra buscar cobrancas.' };
      }
    }
  }

  // 2. since default = 90 dias atras
  const since = params.since
    ? String(params.since)
    : new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const statusFilter = String(params.status ?? 'all');

  // 3. Query tenant_payments por (tenant_id, patient_phone)
  const { data, error } = await admin
    .from('tenant_payments')
    .select('id, consultation_value, asaas_net_value, status, payment_method, payment_url, created_at, doctor_name, patient_name, patient_email')
    .eq('tenant_id', ctx.tenant_id)
    .eq('patient_phone', phone)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return { ok: false, summary: 'Erro ao buscar cobrancas', error: error.message };

  const PAID_STATUSES = new Set(['approved', 'paid', 'received', 'confirmed']);
  const now = Date.now();

  type Classified = 'paid' | 'pending' | 'overdue' | 'other';
  const itemsAll = (data ?? []).map((p) => {
    const status = (p.status ?? '').toLowerCase();
    const daysOpen = Math.floor((now - new Date(p.created_at!).getTime()) / 86_400_000);
    let classification: Classified = 'other';
    if (PAID_STATUSES.has(status)) classification = 'paid';
    else if (status === 'pending') classification = daysOpen > 3 ? 'overdue' : 'pending';
    return {
      id: p.id,
      value: Number(p.consultation_value),
      net_value: p.asaas_net_value !== null ? Number(p.asaas_net_value) : null,
      status: p.status,
      classification,
      payment_method: p.payment_method,
      created_at: p.created_at,
      days_open: daysOpen,
      payment_url: p.payment_url,
      doctor_name: p.doctor_name,
      patient_name: p.patient_name,
    };
  });

  // 4. Filtro status opcional
  const items = statusFilter === 'all'
    ? itemsAll
    : itemsAll.filter((i) => i.classification === statusFilter);

  // 5. Agrega totais
  const totals = {
    paid: 0, pending: 0, overdue: 0,
    count_paid: 0, count_pending: 0, count_overdue: 0,
  };
  for (const i of items) {
    if (i.classification === 'paid') { totals.paid += i.value; totals.count_paid++; }
    else if (i.classification === 'pending') { totals.pending += i.value; totals.count_pending++; }
    else if (i.classification === 'overdue') { totals.overdue += i.value; totals.count_overdue++; }
  }

  // 6. Summary humano
  const displayName = resolvedName || (items[0]?.patient_name as string | undefined) || 'paciente';
  const parts: string[] = [];
  if (totals.count_paid > 0) parts.push(`${totals.count_paid} paga(s) (${fmtBRL(totals.paid)})`);
  if (totals.count_pending > 0) parts.push(`${totals.count_pending} pendente(s) (${fmtBRL(totals.pending)})`);
  if (totals.count_overdue > 0) parts.push(`${totals.count_overdue} vencida(s) (${fmtBRL(totals.overdue)})`);
  const summary = items.length === 0
    ? `Sem cobrancas pra ${displayName} no periodo (desde ${since}).`
    : `${displayName}: ${parts.join(' • ')}.`;

  return {
    ok: true,
    summary,
    data: {
      patient: { name: displayName, phone, email: resolvedEmail || undefined },
      totals,
      items,
    },
  };
};

// Sprint 2 stub: propose mostra preview, execute delega pra /api/marketplace/charge
// (que já tem integração Asaas validada).
export const cobrancaAvulsa: WriteHandler = {
  async propose(params, _ctx) {
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
