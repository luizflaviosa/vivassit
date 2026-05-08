import { NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'edge';

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

interface DfsKeywordResult {
  keyword: string;
  search_volume: number | null;
  competition: number | null;
  competition_level?: 'LOW' | 'MEDIUM' | 'HIGH';
  cpc: number | null;
}

interface DfsResponse {
  status_code: number;
  status_message: string;
  tasks: Array<{
    status_code: number;
    status_message: string;
    result: DfsKeywordResult[] | null;
  }>;
}

interface KeywordItem {
  keyword: string;
  volume: number;
  competition_level: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  cpc: number | null;
}

interface NameSearch {
  doctor_name: string;
  total_volume: number;
  keywords: KeywordItem[];
}

interface RegionDemandPayload {
  success: boolean;
  is_mock: boolean;
  is_cached: boolean;
  location: string;
  specialty: string;
  total_monthly_volume: number;
  avg_cpc: number | null;
  keywords: KeywordItem[];
  name_search: NameSearch | null;
  collected_at: string;
}

function mockResponse(specialty: string, city: string, state: string, doctorName?: string | null): RegionDemandPayload {
  const cleanName = doctorName?.replace(/^(Dr\.?|Dra\.?|Doutor|Doutora)\s*/i, '').trim();
  return {
    success: true,
    is_mock: true,
    is_cached: false,
    location: `${city}, ${state}, Brazil`,
    specialty,
    total_monthly_volume: 1400,
    avg_cpc: 4.85,
    keywords: [
      { keyword: `${specialty.toLowerCase()} ${city}`, volume: 880, competition_level: 'MEDIUM', cpc: 4.5 },
      { keyword: `melhor ${specialty.toLowerCase()} ${city}`, volume: 210, competition_level: 'HIGH', cpc: 6.8 },
      { keyword: `${specialty.toLowerCase()} em ${city}`, volume: 170, competition_level: 'MEDIUM', cpc: 4.1 },
      { keyword: `clínica de ${specialty.toLowerCase()} ${city}`, volume: 90, competition_level: 'HIGH', cpc: 7.4 },
      { keyword: `${specialty.toLowerCase()} particular ${city}`, volume: 50, competition_level: 'MEDIUM', cpc: 5.9 },
    ],
    name_search: cleanName ? {
      doctor_name: doctorName!,
      total_volume: 12,
      keywords: [
        { keyword: cleanName.toLowerCase(), volume: 7, competition_level: 'LOW', cpc: 0.5 },
        { keyword: `dra ${cleanName.toLowerCase()}`, volume: 5, competition_level: 'LOW', cpc: 0.3 },
      ],
    } : null,
    collected_at: new Date().toISOString(),
  };
}

function buildMarketKeywords(specialty: string, city: string): string[] {
  const s = specialty.toLowerCase();
  return [
    s,
    `${s} ${city}`,
    `melhor ${s} ${city}`,
    `${s} em ${city}`,
    `clínica de ${s} ${city}`,
    `${s} particular ${city}`,
    `medico ${s} ${city}`,
  ];
}

function buildNameKeywords(doctorName: string | null | undefined, specialty: string, city: string): string[] {
  if (!doctorName) return [];
  const clean = doctorName.replace(/^(Dr\.?|Dra\.?|Doutor|Doutora)\s*/i, '').trim().toLowerCase();
  if (clean.length < 6) return []; // nomes curtos demais geram falsos positivos
  return [
    clean,
    `dra ${clean}`,
    `dr ${clean}`,
    `${clean} ${specialty.toLowerCase()}`,
    `${clean} ${city}`,
  ];
}

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const supabase = supabaseAdmin();

  // ── Cache check ─────────────────────────────────────────────────────────────
  const { data: cached } = await supabase
    .from('tenant_region_demand_cache')
    .select('payload, collected_at')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (cached?.payload && cached?.collected_at) {
    const age = Date.now() - new Date(cached.collected_at as string).getTime();
    if (age < CACHE_TTL_MS) {
      const payload = { ...(cached.payload as RegionDemandPayload), is_cached: true };
      console.log('[region-demand] cache HIT tenant=%s age=%sd', tenantId, Math.round(age / 86400000));
      return NextResponse.json(payload);
    }
  }

  // ── Resolve specialty + city + doctor_name ──────────────────────────────────
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

  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  let payload: RegionDemandPayload;

  if (!login || !password) {
    payload = mockResponse(specialty, city, stateName, doctorName);
    console.log('[region-demand] FRESH no-creds → mock total=%s', payload.total_monthly_volume);
  } else {
    const marketKeywords = buildMarketKeywords(specialty, city);
    const nameKeywords = buildNameKeywords(doctorName, specialty, city);
    const allKeywords = [...marketKeywords, ...nameKeywords];

    const baseUrl = process.env.DATAFORSEO_BASE_URL || 'https://api.dataforseo.com';
    const dfsRes = await fetch(
      `${baseUrl}/v3/keywords_data/google_ads/search_volume/live`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${login}:${password}`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{
          keywords: allKeywords,
          location_name: `${city},${stateName},Brazil`,
          language_code: 'pt',
          search_partners: false,
        }]),
      }
    );

    if (!dfsRes.ok) {
      payload = mockResponse(specialty, city, stateName, doctorName);
      console.log('[region-demand] FRESH dfs http=%s → mock', dfsRes.status);
    } else {
      const data = (await dfsRes.json()) as DfsResponse;
      if (data.status_code !== 20000) {
        payload = mockResponse(specialty, city, stateName, doctorName);
        console.log('[region-demand] FRESH dfs status=%s → mock', data.status_code);
      } else {
        const results = data.tasks?.[0]?.result ?? [];
        const marketSet = new Set(marketKeywords);
        const nameSet = new Set(nameKeywords);

        const marketResults = results.filter(k => marketSet.has(k.keyword));
        const nameResults = results.filter(k => nameSet.has(k.keyword));

        const totalMarket = marketResults.reduce((s, k) => s + (k.search_volume ?? 0), 0);
        const totalName = nameResults.reduce((s, k) => s + (k.search_volume ?? 0), 0);

        if (totalMarket === 0) {
          payload = mockResponse(specialty, city, stateName, doctorName);
          console.log('[region-demand] FRESH market=0 → mock');
        } else {
          const cpcValues = marketResults.filter(k => k.cpc != null).map(k => Number(k.cpc));
          const avgCpc = cpcValues.length > 0 ? cpcValues.reduce((s, v) => s + v, 0) / cpcValues.length : null;

          const toItems = (arr: DfsKeywordResult[]): KeywordItem[] =>
            arr
              .filter(k => (k.search_volume ?? 0) > 0)
              .sort((a, b) => (b.search_volume ?? 0) - (a.search_volume ?? 0))
              .map(k => ({
                keyword: k.keyword,
                volume: k.search_volume ?? 0,
                competition_level: k.competition_level ?? null,
                cpc: k.cpc,
              }));

          payload = {
            success: true,
            is_mock: false,
            is_cached: false,
            location: `${city}, ${stateName}, Brazil`,
            specialty,
            total_monthly_volume: totalMarket,
            avg_cpc: avgCpc,
            keywords: toItems(marketResults),
            name_search: doctorName ? {
              doctor_name: doctorName,
              total_volume: totalName,
              keywords: toItems(nameResults),
            } : null,
            collected_at: new Date().toISOString(),
          };
          console.log('[region-demand] FRESH real market=%s name=%s', totalMarket, totalName);
        }
      }
    }
  }

  // ── Cache write (best-effort) ──────────────────────────────────────────────
  const { error: cacheErr } = await supabase
    .from('tenant_region_demand_cache')
    .upsert({
      tenant_id: tenantId,
      payload,
      collected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  if (cacheErr) console.error('[region-demand] cache write failed:', cacheErr.message);

  return NextResponse.json(payload);
}
