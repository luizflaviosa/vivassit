/**
 * Refresh manual de GBP Insights via painel (user auth).
 * Permite qualquer tenant_member ativo disparar o refresh.
 */

import { NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';
import { refreshGbpInsightsForTenant, loadGbpPainelPayload } from '@/lib/gbp-insights-fetcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const supabase = supabaseAdmin();
  const result = await refreshGbpInsightsForTenant(supabase, tenantId);
  const payload = await loadGbpPainelPayload(supabase, tenantId);

  return NextResponse.json({ ok: result.status === 'ok', result, payload });
}
