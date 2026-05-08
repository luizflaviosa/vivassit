/**
 * Refresh do cache de region-demand acionado pelo painel (user auth).
 *
 * Diferente de /api/interno/region-demand-refresh (server-to-server, Bearer
 * token), este usa requireTenant() — qualquer tenant_member ativo do tenant
 * atual pode disparar. Sem role check porque (a) o custo é fixo por tenant
 * e auto-bounded pelo cache de 30 dias, e (b) restringir a owner/admin
 * deixava tenants sem admin ativo presos em mock até a cron mensal.
 *
 * Usado pra:
 *   - Auto-bootstrap quando QUALQUER user entra no painel pela primeira
 *     vez (cache miss) — popula uma vez, beneficia todos depois
 *   - Botão manual "atualizar" no card de oportunidade
 */

import { NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';
import { refreshRegionDemandForTenant, type RegionDemandPayload } from '@/lib/region-demand-fetcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const supabase = supabaseAdmin();
  const result = await refreshRegionDemandForTenant(supabase, tenantId);

  // Lê o cache recém-escrito pra devolver pro frontend numa só round-trip
  const { data: cached } = await supabase
    .from('tenant_region_demand_cache')
    .select('payload')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return NextResponse.json({
    ok: result.status === 'ok',
    result,
    payload: cached?.payload
      ? ({ ...(cached.payload as RegionDemandPayload), is_cached: true })
      : null,
  });
}
