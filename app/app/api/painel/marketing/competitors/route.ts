import { NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';
import { buildEphemeralCompetitorsPayload, loadCompetitorsPainelPayload } from '@/lib/competitors-fetcher';

// CACHE-ONLY: lê tenant_competitors_history. Refresh é responsabilidade de:
//  - /api/interno/competitors-refresh (cron mensal)
//  - /api/painel/marketing/competitors-refresh (botão manual + bootstrap)

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const supabase = supabaseAdmin();
  const cached = await loadCompetitorsPainelPayload(supabase, tenantId);
  if (cached) return NextResponse.json(cached);

  const [tenantRes, doctorRes] = await Promise.all([
    supabase.from('tenants').select('city, state').eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('tenant_doctors').select('specialty').eq('tenant_id', tenantId).not('specialty', 'is', null).order('id', { ascending: true }).limit(1).maybeSingle(),
  ]);

  const city = tenantRes.data?.city as string | null | undefined;
  const specialty = doctorRes.data?.specialty as string | null | undefined;

  if (!city || !specialty) {
    return NextResponse.json({ success: false, message: 'Tenant sem city ou specialty configurados' }, { status: 404 });
  }

  return NextResponse.json(buildEphemeralCompetitorsPayload(specialty, city));
}
