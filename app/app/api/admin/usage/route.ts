import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin-auth';

// Dashboard admin: usage de tokens LLM por tenant.
// Estimativa baseada em msgs (n8n_historico_mensagens) ate termos coluna real
// de tokens em usage_tracking.
//
// Premissas (Gemini 2.0 Flash):
//   - Input avg: 3500 tokens/msg
//   - Output avg: 100 tokens/msg
//   - Custo: $0.075/1M input + $0.30/1M output = $0.000287/msg

const AVG_INPUT_TOKENS = 3500;
const AVG_OUTPUT_TOKENS = 100;
const COST_PER_INPUT_TOKEN = 0.075 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 0.30 / 1_000_000;
const COST_PER_MSG_USD = AVG_INPUT_TOKENS * COST_PER_INPUT_TOKEN + AVG_OUTPUT_TOKENS * COST_PER_OUTPUT_TOKEN;
const USD_TO_BRL = 5.20; // approx

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });
  }

  const admin = supabaseAdmin();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const last7Days = new Date(Date.now() - 7 * 86_400_000).toISOString();

  // Total messages all-time + breakdown
  const [
    totalMsgs,
    monthMsgs,
    last7DaysMsgs,
    perTenant,
    activeTenants,
  ] = await Promise.all([
    admin.from('n8n_historico_mensagens').select('id', { count: 'exact', head: true }),
    admin.from('n8n_historico_mensagens').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
    admin.from('n8n_historico_mensagens').select('id', { count: 'exact', head: true }).gte('created_at', last7Days),
    // Per tenant rollup (using session_id which contains tenant_id like 'assistente_interno_xxx')
    admin
      .from('n8n_historico_mensagens')
      .select('session_id, created_at')
      .gte('created_at', monthStart)
      .order('created_at', { ascending: false })
      .limit(2000),
    admin.from('tenants').select('tenant_id, clinic_name, created_at, plan_type, status').order('created_at', { ascending: false }),
  ]);

  // Group msgs por tenant
  const tenantStats = new Map<string, { msgs: number; last: string }>();
  for (const row of (perTenant.data ?? []) as Array<{ session_id: string; created_at: string }>) {
    const session = row.session_id ?? '';
    // session pode ser 'assistente_interno_TENANTID' ou só o tenant_id
    const tenantId = session.startsWith('assistente_interno_') ? session.replace('assistente_interno_', '') : session;
    if (!tenantId) continue;
    const cur = tenantStats.get(tenantId) ?? { msgs: 0, last: row.created_at };
    cur.msgs++;
    if (row.created_at > cur.last) cur.last = row.created_at;
    tenantStats.set(tenantId, cur);
  }

  // Junta com lista de tenants
  const tenantList = (activeTenants.data ?? []).map((t) => {
    const stats = tenantStats.get(t.tenant_id) ?? { msgs: 0, last: '' };
    const cost_usd = stats.msgs * COST_PER_MSG_USD;
    return {
      tenant_id: t.tenant_id,
      clinic_name: t.clinic_name,
      plan_type: t.plan_type,
      status: t.status,
      msgs_month: stats.msgs,
      last_message_at: stats.last || null,
      cost_month_usd: cost_usd,
      cost_month_brl: cost_usd * USD_TO_BRL,
    };
  });

  // Sort por uso (mais ativos primeiro)
  tenantList.sort((a, b) => b.msgs_month - a.msgs_month);

  const totalCount = totalMsgs.count ?? 0;
  const monthCount = monthMsgs.count ?? 0;
  const week7Count = last7DaysMsgs.count ?? 0;

  const totalCostMonth = monthCount * COST_PER_MSG_USD;
  const projectedMonth = (week7Count / 7) * 30 * COST_PER_MSG_USD; // proj. baseada em 7 dias

  return NextResponse.json({
    success: true,
    summary: {
      total_msgs_alltime: totalCount,
      total_msgs_month: monthCount,
      total_msgs_7days: week7Count,
      tenants_total: tenantList.length,
      tenants_active_month: tenantList.filter((t) => t.msgs_month > 0).length,
      cost_month_usd: totalCostMonth,
      cost_month_brl: totalCostMonth * USD_TO_BRL,
      projected_full_month_usd: projectedMonth,
      projected_full_month_brl: projectedMonth * USD_TO_BRL,
      avg_msg_cost_usd: COST_PER_MSG_USD,
      avg_msg_cost_brl: COST_PER_MSG_USD * USD_TO_BRL,
      assumptions: {
        model: 'Gemini 2.0 Flash (estimativa)',
        avg_input_tokens: AVG_INPUT_TOKENS,
        avg_output_tokens: AVG_OUTPUT_TOKENS,
        usd_to_brl: USD_TO_BRL,
        note: 'Custo real depende do modelo configurado e tamanho real do prompt/memory por tenant.',
      },
    },
    tenants: tenantList,
  });
}
