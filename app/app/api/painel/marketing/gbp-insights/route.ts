import { NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';
import { buildEphemeralGbpPayload, loadGbpPainelPayload } from '@/lib/gbp-insights-fetcher';

// CACHE-ONLY: lê do tenant_gbp_insights_history. Refresh é responsabilidade de:
//  - /api/interno/gbp-insights-refresh    (cron mensal)
//  - /api/painel/marketing/gbp-insights-refresh (botão manual / bootstrap)

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const supabase = supabaseAdmin();

  const cached = await loadGbpPainelPayload(supabase, tenantId);
  if (cached) return NextResponse.json(cached);

  // Sem history: precisa OAuth conectado pra buscar de fato. Devolve 404
  // se não há OAuth, ou ephemeral mock se há OAuth mas sem coleta ainda.
  const { data: sub } = await supabase
    .from('marketing_subscriptions')
    .select('gbp_location_id, gbp_location_name')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!sub?.gbp_location_id) {
    return NextResponse.json(
      { success: false, message: 'GBP nao conectado. Acesse /painel/marketing/configurar pra conectar.' },
      { status: 404 }
    );
  }

  return NextResponse.json(buildEphemeralGbpPayload((sub.gbp_location_name as string) || 'Sua localização'));
}
