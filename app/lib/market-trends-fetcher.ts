/**
 * DataForSEO Trends — explore + subregion_interests + demography.
 * Source: clickstream proprietário do DFS (~1.5M panelistas globais).
 * Diferente do region-demand-fetcher que usa Google Ads search_volume.
 *
 * Layers:
 *   - explore        → série temporal de interesse 0–100 por keyword
 *   - subregion      → ranking de estados/regiões BR onde mais buscam
 *   - demography     → idade × gênero (nacional)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, 'public', any>;

export interface ExplorePoint {
  date_from: string;
  date_to: string;
  timestamp: number;
  values: number[]; // alinhado ao array keywords
}

export interface ExploreSection {
  keywords: string[];
  series: ExplorePoint[];
  current: number[];          // último valor por keyword
  peak: number[];             // valor máximo na série
  avg_90d: number[];          // média últimos 90d
  prev_90d: number[];         // média 91-180d atrás
  delta_90d_pct: (number | null)[];
}

export interface SubregionRow {
  keyword: string;
  regions: Array<{ name: string; value: number }>;
}

export interface DemographyRow {
  keyword: string;
  age: Record<string, number>;    // "18-24" → %
  gender: { female: number; male: number };
}

export interface MarketTrendsPayload {
  collected_at: string;
  is_mock: boolean;
  location: string;
  primary_keyword: string;
  explore: ExploreSection;
  subregion: SubregionRow[];
  demography: DemographyRow[];
  _debug?: unknown;
}

interface DfsTrendsResponse {
  status_code: number;
  status_message: string;
  tasks: Array<{
    status_code: number;
    status_message: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result: any[] | null;
  }>;
}

function mockTrends(specialty: string, city: string, doctorName?: string | null): MarketTrendsPayload {
  const kws = [specialty.toLowerCase(), 'fibromialgia', 'artrite reumatoide', 'lupus', doctorName?.toLowerCase() ?? specialty.toLowerCase()];
  const series: ExplorePoint[] = Array.from({ length: 12 }, (_, i) => ({
    date_from: `2025-${String((i % 12) + 1).padStart(2, '0')}-01`,
    date_to: `2025-${String((i % 12) + 1).padStart(2, '0')}-28`,
    timestamp: 0,
    values: [10 + i, 30 + Math.floor(Math.random() * 10), 12 + i / 2, 18 + i / 3, 0],
  }));
  return {
    collected_at: new Date().toISOString(),
    is_mock: true,
    location: `${city}, Brazil (mock)`,
    primary_keyword: specialty,
    explore: {
      keywords: kws,
      series,
      current: [22, 38, 18, 21, 0],
      peak: [25, 42, 22, 24, 1],
      avg_90d: [20, 36, 17, 20, 0],
      prev_90d: [18, 32, 16, 19, 0],
      delta_90d_pct: [11, 12.5, 6, 5, null],
    },
    subregion: [{
      keyword: specialty.toLowerCase(),
      regions: [
        { name: 'São Paulo', value: 100 },
        { name: 'Rio de Janeiro', value: 78 },
        { name: 'Minas Gerais', value: 65 },
        { name: 'Paraná', value: 52 },
        { name: 'Rio Grande do Sul', value: 48 },
      ],
    }],
    demography: [{
      keyword: specialty.toLowerCase(),
      age: { '18-24': 8, '25-34': 22, '35-44': 28, '45-54': 24, '55-64': 13, '65+': 5 },
      gender: { female: 64, male: 36 },
    }],
  };
}

async function callTrends(login: string, password: string, path: string, body: unknown): Promise<DfsTrendsResponse> {
  const baseUrl = process.env.DATAFORSEO_BASE_URL || 'https://api.dataforseo.com';
  const auth = Buffer.from(`${login}:${password}`).toString('base64');
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as DfsTrendsResponse;
}

export async function refreshMarketTrendsForTenant(supabase: SB, tenantId: string): Promise<{
  status: 'ok' | 'skipped' | 'error';
  reason?: string;
  is_mock?: boolean;
}> {
  const [tenantRes, doctorRes, kwRes] = await Promise.all([
    supabase.from('tenants').select('city, state').eq('tenant_id', tenantId).maybeSingle(),
    supabase
      .from('tenant_doctors')
      .select('specialty, doctor_name')
      .eq('tenant_id', tenantId)
      .not('specialty', 'is', null)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from('tenant_market_keywords').select('market_keywords, name_keywords').eq('tenant_id', tenantId).maybeSingle(),
  ]);

  const city = tenantRes.data?.city as string | null | undefined;
  const specialty = doctorRes.data?.specialty as string | null | undefined;
  const doctorName = doctorRes.data?.doctor_name as string | null | undefined;

  if (!specialty || !city) {
    return { status: 'skipped', reason: 'missing city or specialty' };
  }

  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  let payload: MarketTrendsPayload;

  if (!login || !password) {
    return { status: 'skipped', reason: 'no DataForSEO credentials configured' };
  }

  // Pra Trends explore: até 5 keywords por chamada (limite Google Trends).
  // Estratégia: especialidade + 3 sintomas/condições correlatas + nome (ou variação)
  const cleanName = doctorName?.replace(/^(Doutora|Doutor|Dra\.?|Dr\.?)\s*\.?\s*/i, '').trim().toLowerCase();
  const exploreKeywords = buildExploreKeywords(specialty, cleanName);

  try {
    // 1) Explore (12 meses, BR)
    const exploreRes = await callTrends(login, password, '/v3/keywords_data/dataforseo_trends/explore/live', [{
      keywords: exploreKeywords,
      location_name: 'Brazil',
      date_from: dateMonthsAgo(12),
      date_to: today(),
    }]);

    const exploreItem = exploreRes.tasks?.[0]?.result?.[0]?.items?.find((i: { type: string }) => i.type === 'dataforseo_trends_graph');
    const exploreSection: ExploreSection = exploreItem ? buildExploreSection(exploreKeywords, exploreItem.data ?? []) : emptyExplore(exploreKeywords);

    // 2) Subregion interests pra keyword principal (especialidade)
    const subregionRes = await callTrends(login, password, '/v3/keywords_data/dataforseo_trends/subregion_interests/live', [{
      keywords: [specialty.toLowerCase()],
      location_name: 'Brazil',
    }]);

    const subregionItems = subregionRes.tasks?.[0]?.result?.[0]?.items ?? [];
    const subregionItem = subregionItems.find((i: { type: string }) => i.type === 'subregion_interests');
    const subregionRaw = (subregionItem?.interests?.[0]?.values ?? []) as Array<{ value: number; geo_name: string }>;
    const subregion: SubregionRow[] = [{
      keyword: specialty.toLowerCase(),
      regions: subregionRaw
        .filter(r => (r.value ?? 0) > 0)
        .map(r => ({ name: cleanBrazilStateName(r.geo_name), value: r.value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    }];

    // 3) Demography pra keyword principal
    const demoRes = await callTrends(login, password, '/v3/keywords_data/dataforseo_trends/demography/live', [{
      keywords: [specialty.toLowerCase()],
      location_name: 'Brazil',
    }]);

    const demoItems = demoRes.tasks?.[0]?.result?.[0]?.items ?? [];
    const demography: DemographyRow[] = [extractDemography(specialty.toLowerCase(), demoItems)];

    payload = {
      collected_at: new Date().toISOString(),
      is_mock: false,
      location: 'Brasil',
      primary_keyword: specialty,
      explore: exploreSection,
      subregion,
      demography,
      _debug: {
        explore_keywords: exploreKeywords,
        explore_status: exploreRes.tasks?.[0]?.status_code,
        subregion_status: subregionRes.tasks?.[0]?.status_code,
        demography_status: demoRes.tasks?.[0]?.status_code,
        sample_explore: exploreItem?.data?.slice(0, 2),
        sample_subregion: subregionRaw.slice(0, 3),
        // Raw responses pra inspecionar estrutura quando parser falha
        raw_subregion_task: subregionRes.tasks?.[0],
        raw_demography_task: demoRes.tasks?.[0],
      },
    };
  } catch (e) {
    return { status: 'error', reason: `dfs trends: ${(e as Error).message}` };
  }

  const { error: histErr } = await supabase
    .from('tenant_market_trends_history')
    .insert({ tenant_id: tenantId, payload, collected_at: new Date().toISOString() });

  if (histErr) {
    return { status: 'error', reason: `history insert: ${histErr.message}` };
  }

  return { status: 'ok', is_mock: false };
}

export async function loadLatestMarketTrends(supabase: SB, tenantId: string): Promise<MarketTrendsPayload | null> {
  const { data } = await supabase
    .from('tenant_market_trends_history')
    .select('payload, collected_at')
    .eq('tenant_id', tenantId)
    .order('collected_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.payload as MarketTrendsPayload) ?? null;
}

export function ephemeralMarketTrendsMock(specialty: string, city: string, doctorName?: string | null): MarketTrendsPayload {
  return mockTrends(specialty, city, doctorName);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildExploreKeywords(specialty: string, cleanName: string | undefined): string[] {
  const s = specialty.toLowerCase();
  // Estratégia de produto:
  //  [0] especialidade — referência
  //  [1-3] sintomas/condições correlatas — pra o cliente ver onde está a demanda
  //  [4] nome do médico (se válido) ou variação da especialidade
  const correlations: Record<string, string[]> = {
    reumatologia: ['fibromialgia', 'artrite reumatoide', 'lupus'],
    cardiologia: ['arritmia', 'pressão alta', 'infarto'],
    endocrinologia: ['diabetes', 'tireoide', 'obesidade'],
    dermatologia: ['acne', 'psoriase', 'manchas pele'],
    ortopedia: ['hérnia de disco', 'lombar', 'artrose'],
    ginecologia: ['endometriose', 'menopausa', 'sop'],
    psiquiatria: ['ansiedade', 'depressão', 'tdah'],
  };
  const corrList = correlations[s] ?? ['dor', 'tratamento', 'sintomas'];
  const last = cleanName && cleanName.length >= 6 ? cleanName : `${s} sintomas`;
  return [s, corrList[0], corrList[1], corrList[2], last];
}

function dateMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildExploreSection(keywords: string[], rawSeries: Array<{ date_from: string; date_to: string; timestamp: number; values: number[] }>): ExploreSection {
  const series = rawSeries.map(p => ({
    date_from: p.date_from,
    date_to: p.date_to,
    timestamp: p.timestamp,
    values: p.values ?? [],
  }));

  // Pra cada keyword, pega current/peak/avg
  const n = keywords.length;
  const current = new Array(n).fill(0);
  const peak = new Array(n).fill(0);
  const avg_90d = new Array(n).fill(0);
  const prev_90d = new Array(n).fill(0);

  if (series.length === 0) {
    return {
      keywords,
      series,
      current,
      peak,
      avg_90d,
      prev_90d,
      delta_90d_pct: new Array(n).fill(null),
    };
  }

  // Janela de ~90d = últimas ~13 semanas (DFS retorna semanal pra 12m)
  const recentWindow = Math.min(13, series.length);
  const prevStart = Math.max(0, series.length - recentWindow * 2);
  const prevEnd = series.length - recentWindow;

  for (let k = 0; k < n; k++) {
    let max = 0;
    let recentSum = 0;
    let prevSum = 0;
    for (let i = 0; i < series.length; i++) {
      const v = series[i].values[k] ?? 0;
      if (v > max) max = v;
      if (i >= series.length - recentWindow) recentSum += v;
      if (i >= prevStart && i < prevEnd) prevSum += v;
    }
    current[k] = series[series.length - 1].values[k] ?? 0;
    peak[k] = max;
    avg_90d[k] = recentWindow > 0 ? recentSum / recentWindow : 0;
    prev_90d[k] = (prevEnd - prevStart) > 0 ? prevSum / (prevEnd - prevStart) : 0;
  }

  const delta_90d_pct = avg_90d.map((cur, i) => prev_90d[i] === 0 ? null : ((cur - prev_90d[i]) / prev_90d[i]) * 100);

  return { keywords, series, current, peak, avg_90d, prev_90d, delta_90d_pct };
}

function emptyExplore(keywords: string[]): ExploreSection {
  return {
    keywords,
    series: [],
    current: new Array(keywords.length).fill(0),
    peak: new Array(keywords.length).fill(0),
    avg_90d: new Array(keywords.length).fill(0),
    prev_90d: new Array(keywords.length).fill(0),
    delta_90d_pct: new Array(keywords.length).fill(null),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDemography(keyword: string, items: any[]): DemographyRow {
  // Estrutura DFS:
  //   item.type = 'demography'
  //   item.demography.age    = [{ keyword, values: [{ type: '18-24', value: 100 }, ...] }]
  //   item.demography.gender = [{ keyword, values: [{ type: 'female', value: 100 }, { type: 'male', value: 79 }] }]
  // Valores são relativos (peak = 100). Normalizamos pra % do total p/ exibir share.

  const item = items.find(i => i.type === 'demography');
  const ageRaw = (item?.demography?.age?.[0]?.values ?? []) as Array<{ type: string; value: number }>;
  const genderRaw = (item?.demography?.gender?.[0]?.values ?? []) as Array<{ type: string; value: number }>;

  // Normalize age: value/total * 100 — soma 100%
  const ageTotal = ageRaw.reduce((s, e) => s + (e.value ?? 0), 0);
  const age: Record<string, number> = {};
  if (ageTotal > 0) {
    for (const e of ageRaw) {
      if (e.type) age[e.type] = (e.value / ageTotal) * 100;
    }
  }

  // Normalize gender: same pattern
  const fRaw = genderRaw.find(e => e.type === 'female')?.value ?? 0;
  const mRaw = genderRaw.find(e => e.type === 'male')?.value ?? 0;
  const gTotal = fRaw + mRaw;
  const gender = gTotal > 0
    ? { female: (fRaw / gTotal) * 100, male: (mRaw / gTotal) * 100 }
    : { female: 0, male: 0 };

  return { keyword, age, gender };
}

function cleanBrazilStateName(raw: string): string {
  // DFS retorna "State of Sao Paulo" — limpa pra "São Paulo" com acento.
  const stripped = raw.replace(/^State of\s+/i, '').trim();
  const accentMap: Record<string, string> = {
    'Sao Paulo': 'São Paulo',
    'Espirito Santo': 'Espírito Santo',
    'Goias': 'Goiás',
    'Maranhao': 'Maranhão',
    'Para': 'Pará',
    'Paraiba': 'Paraíba',
    'Parana': 'Paraná',
    'Piaui': 'Piauí',
    'Rondonia': 'Rondônia',
    'Ceara': 'Ceará',
    'Federal District': 'Distrito Federal',
  };
  return accentMap[stripped] ?? stripped;
}
