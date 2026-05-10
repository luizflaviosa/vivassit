/**
 * DataForSEO Trends — explore + subregion_interests + demography.
 * Source: clickstream proprietário do DFS (~1.5M panelistas globais).
 * Diferente do region-demand-fetcher que usa Google Ads search_volume.
 *
 * Layers:
 *   - explore        → série temporal de interesse 0–100 por keyword
 *   - subregion      → ranking de estados/regiões BR onde mais buscam
 *   - demography     → idade × gênero (nacional)
 *
 * Estratégia de coleta (otimizada):
 *   1) Cache compartilhado por especialidade (BR-level — todos os tenants
 *      cardiologistas compartilham o mesmo snapshot). Reduz custo em escala.
 *      TTL 30d (mensal, alinhado ao cron).
 *   2) Cache miss → 1 chamada DFS `merged_data/live` (combina explore + subregion +
 *      demography num único response). Custo $0.002 vs 3× $0.002 do esquema antigo.
 *   3) Hit ou novo snapshot é gravado em `tenant_market_trends_history` por tenant
 *      pra preservar séries temporais individualizadas.
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

interface SharedTrendsPayload {
  keywords: string[];
  explore: ExploreSection;
  subregion: SubregionRow[];
  demography: DemographyRow[];
  collected_at: string;
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

const CACHE_SOURCE = 'market_trends';
const CACHE_TTL_DAYS = 30;

function mockTrends(specialty: string, city: string, doctorName?: string | null): MarketTrendsPayload {
  const kws = [specialty.toLowerCase(), 'fibromialgia', 'artrite reumatoide', 'lupus', doctorName?.toLowerCase() ?? `${specialty.toLowerCase()} sintomas`];
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

// ── Cache compartilhado por especialidade ───────────────────────────────────

function normalizeCacheKey(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
}

async function loadSharedTrendsCache(supabase: SB, cacheKey: string, ttlDays: number): Promise<SharedTrendsPayload | null> {
  const cutoff = new Date(Date.now() - ttlDays * 86400000).toISOString();
  const { data } = await supabase
    .from('market_data_cache')
    .select('payload, collected_at')
    .eq('source', CACHE_SOURCE)
    .eq('cache_key', cacheKey)
    .gte('collected_at', cutoff)
    .maybeSingle();
  return (data?.payload as SharedTrendsPayload | null) ?? null;
}

async function saveSharedTrendsCache(supabase: SB, cacheKey: string, payload: SharedTrendsPayload): Promise<void> {
  await supabase
    .from('market_data_cache')
    .upsert({
      source: CACHE_SOURCE,
      cache_key: cacheKey,
      payload,
      collected_at: new Date().toISOString(),
    }, { onConflict: 'source,cache_key' });
}

// ── DFS merged_data: 1 chamada → explore + subregion + demography ───────────

async function fetchTrendsMerged(
  login: string,
  password: string,
  exploreKeywords: string[],
  specialty: string,
): Promise<{ ok: true; payload: SharedTrendsPayload } | { ok: false; reason: string }> {
  // merged_data combina os 3 sub-tipos num único task. 1 call $0.002 vs 3× $0.002.
  // Sem `type` o endpoint pode devolver só o explore — listamos os 3 explicitamente.
  const mergedRes = await callTrends(login, password, '/v3/keywords_data/dataforseo_trends/merged_data/live', [{
    keywords: exploreKeywords,
    location_name: 'Brazil',
    date_from: dateMonthsAgo(12),
    date_to: today(),
    type: ['google_trends_explore', 'google_trends_subregion_interests', 'google_trends_demography'],
  }]);

  const status = mergedRes.tasks?.[0]?.status_code;
  const items = (mergedRes.tasks?.[0]?.result?.[0]?.items ?? []) as Array<{ type: string; data?: unknown; interests?: unknown; demography?: unknown }>;

  if (status !== 20000 || items.length === 0) {
    return { ok: false, reason: `dfs merged_data status=${status} items=${items.length}` };
  }

  const exploreItem = items.find(i => i.type === 'dataforseo_trends_graph');
  const subregionItem = items.find(i => i.type === 'subregion_interests') as undefined | { interests?: Array<{ values?: Array<{ value: number; geo_name: string }> }> };
  const demographyItem = items.find(i => i.type === 'demography');

  const exploreSection: ExploreSection = exploreItem
    ? buildExploreSection(exploreKeywords, ((exploreItem.data ?? []) as Array<{ date_from: string; date_to: string; timestamp: number; values: number[] }>))
    : emptyExplore(exploreKeywords);

  if (exploreSection.series.length === 0) {
    return { ok: false, reason: 'empty explore series in merged_data response' };
  }

  // interests[0] e demography[0] são pra exploreKeywords[0] = especialidade.
  const subregionRaw = (subregionItem?.interests?.[0]?.values ?? []) as Array<{ value: number; geo_name: string }>;
  const subregion: SubregionRow[] = [{
    keyword: specialty.toLowerCase(),
    regions: subregionRaw
      .filter(r => (r.value ?? 0) > 0)
      .map(r => ({ name: cleanBrazilStateName(r.geo_name), value: r.value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
  }];

  const demography: DemographyRow[] = [extractDemography(specialty.toLowerCase(), demographyItem ? [demographyItem] : [])];

  return {
    ok: true,
    payload: {
      keywords: exploreKeywords,
      explore: exploreSection,
      subregion,
      demography,
      collected_at: new Date().toISOString(),
    },
  };
}

// ── Refresh por tenant ──────────────────────────────────────────────────────

export async function refreshMarketTrendsForTenant(supabase: SB, tenantId: string): Promise<{
  status: 'ok' | 'skipped' | 'error';
  reason?: string;
  is_mock?: boolean;
  cache_hit?: boolean;
}> {
  const [tenantRes, doctorRes] = await Promise.all([
    supabase.from('tenants').select('city').eq('tenant_id', tenantId).maybeSingle(),
    supabase
      .from('tenant_doctors')
      .select('specialty')
      .eq('tenant_id', tenantId)
      .not('specialty', 'is', null)
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const city = tenantRes.data?.city as string | null | undefined;
  const specialty = doctorRes.data?.specialty as string | null | undefined;

  if (!specialty || !city) {
    return { status: 'skipped', reason: 'missing city or specialty' };
  }

  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    return { status: 'skipped', reason: 'no DataForSEO credentials configured' };
  }

  const cacheKey = normalizeCacheKey(specialty);
  const exploreKeywords = buildExploreKeywords(specialty);

  // 1) Cache compartilhado: hit zero custo DFS
  let shared = await loadSharedTrendsCache(supabase, cacheKey, CACHE_TTL_DAYS);
  const cacheHit = !!shared;

  // 2) Cache miss → DFS merged_data (1 call vs 3 antigamente)
  if (!shared) {
    try {
      const result = await fetchTrendsMerged(login, password, exploreKeywords, specialty);
      if (!result.ok) {
        return { status: 'error', reason: result.reason };
      }
      shared = result.payload;
      // 3) Salva cache pra próximos tenants da mesma especialidade
      await saveSharedTrendsCache(supabase, cacheKey, shared);
    } catch (e) {
      return { status: 'error', reason: `dfs trends: ${(e as Error).message}` };
    }
  }

  // 4) Per-tenant history (preserva série temporal individualizada)
  const payload: MarketTrendsPayload = {
    collected_at: new Date().toISOString(),
    is_mock: false,
    location: 'Brasil',
    primary_keyword: specialty,
    explore: shared.explore,
    subregion: shared.subregion,
    demography: shared.demography,
    _debug: {
      cache_hit: cacheHit,
      cache_key: cacheKey,
      cache_collected_at: shared.collected_at,
      explore_keywords: shared.keywords,
    },
  };

  const { error: histErr } = await supabase
    .from('tenant_market_trends_history')
    .insert({ tenant_id: tenantId, payload, collected_at: new Date().toISOString() });

  if (histErr) {
    return { status: 'error', reason: `history insert: ${histErr.message}` };
  }

  return { status: 'ok', is_mock: false, cache_hit: cacheHit };
}

export async function loadLatestMarketTrends(supabase: SB, tenantId: string): Promise<MarketTrendsPayload | null> {
  // Pega últimos 5 snapshots e prefere o mais recente com série não-vazia.
  // Defesa contra rows com explore vazio (DFS rate-limit/falha transiente)
  // que poderiam ter sido gravadas antes do guard atual.
  const { data } = await supabase
    .from('tenant_market_trends_history')
    .select('payload, collected_at')
    .eq('tenant_id', tenantId)
    .order('collected_at', { ascending: false })
    .limit(5);

  if (!data || data.length === 0) return null;

  const firstNonEmpty = data.find(row => {
    const p = row.payload as MarketTrendsPayload | null;
    return p?.explore?.series && p.explore.series.length > 0;
  });

  return ((firstNonEmpty ?? data[0]).payload as MarketTrendsPayload) ?? null;
}

export function ephemeralMarketTrendsMock(specialty: string, city: string, doctorName?: string | null): MarketTrendsPayload {
  return mockTrends(specialty, city, doctorName);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildExploreKeywords(specialty: string): string[] {
  const s = specialty.toLowerCase();
  // Estratégia de produto:
  //  [0] especialidade — referência (também usado pra subregion/demography)
  //  [1-3] sintomas/condições correlatas — pra o cliente ver onde está a demanda
  //  [4] variação da especialidade — completa o contexto sem quebrar cache compartilhado
  // Doctor name foi removido daqui (era a chave que quebrava o cache); region-demand
  // já cobre name search com Google Ads volume (mais robusto que clickstream Trends).
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
  return [s, corrList[0], corrList[1], corrList[2], `${s} sintomas`];
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
