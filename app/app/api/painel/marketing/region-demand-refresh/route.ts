/**
 * Refresh do cache de region-demand acionado pelo painel (user auth).
 *
 * Diferente de /api/interno/region-demand-refresh (server-to-server, Bearer
 * token), este usa requireTenant() — qualquer tenant_member ativo do tenant
 * atual pode disparar. Sem role check porque (a) o custo é fixo por tenant
 * e auto-bounded pelo cache de 30 dias, e (b) restringir a owner/admin
 * deixava tenants sem admin ativo presos em mock até a cron mensal.
 */

import { NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';
import { refreshRegionDemandForTenant, loadPainelPayload } from '@/lib/region-demand-fetcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const supabase = supabaseAdmin();
  const result = await refreshRegionDemandForTenant(supabase, tenantId);
  const payload = await loadPainelPayload(supabase, tenantId);

  return NextResponse.json({
    ok: result.status === 'ok',
    result,
    payload,
  });
}
