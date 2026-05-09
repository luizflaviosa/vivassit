import { NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';
import { refreshMarketTrendsForTenant, loadLatestMarketTrends } from '@/lib/market-trends-fetcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const supabase = supabaseAdmin();
  const result = await refreshMarketTrendsForTenant(supabase, tenantId);
  const payload = await loadLatestMarketTrends(supabase, tenantId);

  return NextResponse.json({
    ok: result.status === 'ok',
    result,
    payload: payload ? { ...payload, is_cached: true } : null,
  });
}
