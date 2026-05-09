import { NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';
import { ephemeralMarketTrendsMock, loadLatestMarketTrends } from '@/lib/market-trends-fetcher';

export const runtime = 'edge';

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const supabase = supabaseAdmin();
  const cached = await loadLatestMarketTrends(supabase, tenantId);
  if (cached) return NextResponse.json({ ...cached, is_cached: true });

  // Sem history → mock contextualizado
  const [tenantRes, doctorRes] = await Promise.all([
    supabase.from('tenants').select('city').eq('tenant_id', tenantId).maybeSingle(),
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
  const specialty = doctorRes.data?.specialty as string | null | undefined;
  const doctorName = doctorRes.data?.doctor_name as string | null | undefined;

  if (!specialty || !city) {
    return NextResponse.json(
      { success: false, message: 'Tenant sem specialty ou city' },
      { status: 404 }
    );
  }

  return NextResponse.json({ ...ephemeralMarketTrendsMock(specialty, city, doctorName), is_cached: false });
}
