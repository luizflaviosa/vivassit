/**
 * Refresh do cache de region-demand acionado pelo painel (user auth).
 *
 * Diferente de /api/interno/region-demand-refresh (server-to-server, Bearer token),
 * este aqui usa requireTenant() e só permite owner/admin do tenant atual.
 *
 * Usado pra:
 *   - Auto-bootstrap quando admin entra no painel pela primeira vez (cache miss)
 *   - Botão manual "Atualizar dados de mercado"
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
  const role = auth.ctx.member.role;

  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

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
