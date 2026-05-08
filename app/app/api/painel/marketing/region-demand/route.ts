import { NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';
import { buildEphemeralPainelPayload, loadPainelPayload } from '@/lib/region-demand-fetcher';

// CACHE-ONLY: nunca chama DataForSEO. Lê do tenant_region_demand_history
// (latest snapshot + 5 anteriores pra trend).
// Refresh é responsabilidade de:
//  - /api/interno/region-demand-refresh (cron mensal)
//  - /api/painel/marketing/region-demand-refresh (auto-bootstrap + botão manual)

export const runtime = 'edge';

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const supabase = supabaseAdmin();

  const cached = await loadPainelPayload(supabase, tenantId);
  if (cached) return NextResponse.json(cached);

  // Sem history → mock contextualizado
  const [tenantRes, doctorRes] = await Promise.all([
    supabase.from('tenants').select('city, state').eq('tenant_id', tenantId).maybeSingle(),
    supabase
      .from('tenant_doctors')
      .select('specialty, doctor_name')
      .eq('tenant_id', tenantId)
      .not('specialty', 'is', null)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const city = tenantRes.data?.city as string | null | undefined;
  const stateName = (tenantRes.data?.state as string | null | undefined) || 'SP';
  const specialty = doctorRes.data?.specialty as string | null | undefined;
  const doctorName = doctorRes.data?.doctor_name as string | null | undefined;

  if (!specialty || !city) {
    return NextResponse.json(
      { success: false, message: 'Tenant sem specialty (tenant_doctors) ou city (tenants) configurados' },
      { status: 404 }
    );
  }

  return NextResponse.json(buildEphemeralPainelPayload(specialty, city, stateName, doctorName));
}
