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
