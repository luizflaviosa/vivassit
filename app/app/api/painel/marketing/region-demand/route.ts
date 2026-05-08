import { NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'edge';

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

interface RegionDemandPayload {
  success: boolean;
  is_mock: boolean;
  location: string;
  specialty: string;
  total_monthly_volume: number;
  avg_cpc: number | null;
  keywords: Array<{
    keyword: string;
    volume: number;
    competition_level: 'LOW' | 'MEDIUM' | 'HIGH' | null;
    cpc: number | null;
  }>;
  collected_at: string;
}

function mockResponse(specialty: string, city: string, state: string): RegionDemandPayload {
  return {
    success: true,
    is_mock: true,
    location: `${city}, ${state}, Brazil`,
    specialty,
    total_monthly_volume: 1400,
    avg_cpc: 4.85,
    keywords: [
      { keyword: `${specialty} ${city}`, volume: 880, competition_level: 'MEDIUM', cpc: 4.5 },
      { keyword: `melhor ${specialty} ${city}`, volume: 210, competition_level: 'HIGH', cpc: 6.8 },
      { keyword: `${specialty} em ${city}`, volume: 170, competition_level: 'MEDIUM', cpc: 4.1 },
      { keyword: `clínica de ${specialty} ${city}`, volume: 90, competition_level: 'HIGH', cpc: 7.4 },
      { keyword: `${specialty} particular ${city}`, volume: 50, competition_level: 'MEDIUM', cpc: 5.9 },
    ],
    collected_at: new Date().toISOString(),
  };
}

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const supabase = supabaseAdmin();
  const { data: profile } = await supabase
    .from('vitrine_profiles')
    .select('specialty, city, state')
    .eq('tenant_id', tenantId)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!profile?.specialty || !profile?.city) {
    return NextResponse.json(
      { success: false, message: 'Vitrine sem specialty/city configurados' },
      { status: 404 }
    );
  }

  const { specialty, city, state } = profile as { specialty: string; city: string; state: string };
  const stateName = state || 'São Paulo';

  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    return NextResponse.json(mockResponse(specialty, city, stateName));
  }

  const keywords = [
    `${specialty} ${city}`,
    `melhor ${specialty} ${city}`,
    `${specialty} em ${city}`,
    `clínica de ${specialty} ${city}`,
    `${specialty} particular ${city}`,
    `medico ${specialty} ${city}`,
    `consulta ${specialty} ${city}`,
  ];

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
        keywords,
        location_name: `${city},${stateName},Brazil`,
        language_code: 'pt',
        search_partners: false,
      }]),
    }
  );

  if (!dfsRes.ok) {
    return NextResponse.json(mockResponse(specialty, city, stateName));
  }

  const data = (await dfsRes.json()) as DfsResponse;
  if (data.status_code !== 20000) {
    return NextResponse.json(mockResponse(specialty, city, stateName));
  }

  const results = data.tasks?.[0]?.result ?? [];
  const totalVolume = results.reduce((sum, k) => sum + (k.search_volume ?? 0), 0);
  const cpcValues = results.filter(k => k.cpc != null).map(k => Number(k.cpc));
  const avgCpc = cpcValues.length > 0 ? cpcValues.reduce((s, v) => s + v, 0) / cpcValues.length : null;

  const topKeywords = results
    .filter(k => (k.search_volume ?? 0) > 0)
    .sort((a, b) => (b.search_volume ?? 0) - (a.search_volume ?? 0))
    .map(k => ({
      keyword: k.keyword,
      volume: k.search_volume ?? 0,
      competition_level: k.competition_level ?? null,
      cpc: k.cpc,
    }));

  const payload: RegionDemandPayload = {
    success: true,
    is_mock: false,
    location: `${city}, ${stateName}, Brazil`,
    specialty,
    total_monthly_volume: totalVolume,
    avg_cpc: avgCpc,
    keywords: topKeywords,
    collected_at: new Date().toISOString(),
  };

  return NextResponse.json(payload);
}
