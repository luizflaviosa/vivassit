/**
 * Helper compartilhado entre os endpoints de region-demand.
 *
 * Arquitetura:
 *  - tenant_market_keywords: lista de keywords por tenant (auto-gerada na 1ª
 *    coleta a partir de specialty/city/doctor_name; pode ser editada como
 *    'custom' pra preservar customizações de cron subsequentes).
 *  - tenant_region_demand_history: append-only, 1 linha por refresh. Permite
 *    trends e comparação contra mês anterior.
 *  - Refresh: lê keywords config → chama DataForSEO → INSERT em history.
 *  - GET (cache-only): SELECT latest history row + previous (pra trend).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const HISTORY_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export interface KeywordItem {
  keyword: string;
  volume: number;
  competition_level: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  cpc: number | null;
}

export interface NameSearch {
  doctor_name: string;
  total_volume: number;
  keywords: KeywordItem[];
}

export interface RegionDemandPayload {
  success: boolean;
  is_mock: boolean;
  is_cached: boolean;
  location: string;
  location_level?: 'city' | 'state' | 'country';
  specialty: string;
  total_monthly_volume: number;
  avg_cpc: number | null;
  keywords: KeywordItem[];
  name_search: NameSearch | null;
  collected_at: string;
}

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
  tasks: Array<{ status_code: number; status_message: string; result: DfsKeywordResult[] | null }>;
}

// DataForSEO espera nome completo do estado (location_name fuzzy mas
// abreviações tipo "SP" não casam — devolvem volumes vazios sem erro).
const BR_STATE_MAP: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas',
  BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo',
  GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
  PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina',
  SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

function expandStateName(state: string): string {
  const upper = state.trim().toUpperCase();
  return BR_STATE_MAP[upper] ?? state;
}

interface KeywordConfig {
  market_keywords: string[];
  name_keywords: string[];
  source: 'auto' | 'custom';
  generated_from: { specialty: string; city: string; state: string; doctor_name: string | null } | null;
}

// ── Defaults pra keywords auto-geradas ────────────────────────────────────────

function defaultMarketKeywords(specialty: string, city: string): string[] {
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

function defaultNameKeywords(doctorName: string | null | undefined, specialty: string, city: string): string[] {
  if (!doctorName) return [];
  const clean = doctorName.replace(/^(Doutora|Doutor|Dra\.?|Dr\.?)\s*\.?\s*/i, '').trim().toLowerCase();
  if (clean.length < 6) return [];
  return [
    clean,
    `dra ${clean}`,
    `dr ${clean}`,
    `${clean} ${specialty.toLowerCase()}`,
    `${clean} ${city}`,
  ];
}

export function mockResponse(specialty: string, city: string, state: string, doctorName?: string | null): RegionDemandPayload {
  const cleanName = doctorName?.replace(/^(Doutora|Doutor|Dra\.?|Dr\.?)\s*\.?\s*/i, '').trim();
  const s = specialty.toLowerCase();
  return {
    success: true,
    is_mock: true,
    is_cached: false,
    location: `${city}, ${state}, Brazil`,
    specialty,
    total_monthly_volume: 1400,
    avg_cpc: 4.85,
    keywords: [
      { keyword: `${s} ${city}`, volume: 880, competition_level: 'MEDIUM', cpc: 4.5 },
      { keyword: `melhor ${s} ${city}`, volume: 210, competition_level: 'HIGH', cpc: 6.8 },
      { keyword: `${s} em ${city}`, volume: 170, competition_level: 'MEDIUM', cpc: 4.1 },
      { keyword: `clínica de ${s} ${city}`, volume: 90, competition_level: 'HIGH', cpc: 7.4 },
      { keyword: `${s} particular ${city}`, volume: 50, competition_level: 'MEDIUM', cpc: 5.9 },
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

// ── Keyword config (auto-gera na 1ª, regenera se inputs mudam) ───────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, 'public', any>;

async function getOrGenerateKeywords(
  supabase: SB,
  tenantId: string,
  specialty: string,
  city: string,
  state: string,
  doctorName: string | null | undefined
): Promise<KeywordConfig> {
  const { data: existing } = await supabase
    .from('tenant_market_keywords')
    .select('market_keywords, name_keywords, source, generated_from')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const inputs = { specialty, city, state, doctor_name: doctorName ?? null };

  // Custom: respeita edição manual independente de mudança nos inputs
  if (existing?.source === 'custom' && existing.market_keywords?.length > 0) {
    return {
      market_keywords: existing.market_keywords,
      name_keywords: existing.name_keywords ?? [],
      source: 'custom',
      generated_from: existing.generated_from as KeywordConfig['generated_from'] ?? null,
    };
  }

  // Auto: regenera se não existe OU se os inputs mudaram
  const inputsChanged =
    !existing?.generated_from ||
    JSON.stringify(existing.generated_from) !== JSON.stringify(inputs);

  if (existing && !inputsChanged) {
    return {
      market_keywords: existing.market_keywords,
      name_keywords: existing.name_keywords ?? [],
      source: 'auto',
      generated_from: existing.generated_from as KeywordConfig['generated_from'],
    };
  }

  const market = defaultMarketKeywords(specialty, city);
  const name = defaultNameKeywords(doctorName, specialty, city);

  await supabase
    .from('tenant_market_keywords')
    .upsert({
      tenant_id: tenantId,
      market_keywords: market,
      name_keywords: name,
      source: 'auto',
      generated_from: inputs,
      updated_at: new Date().toISOString(),
    });

  return { market_keywords: market, name_keywords: name, source: 'auto', generated_from: inputs };
}

// ── Trend & painel payload ───────────────────────────────────────────────────

export interface TrendInfo {
  previous_total_monthly_volume: number | null;
  previous_total_name_volume: number | null;
  previous_collected_at: string | null;
  delta_market_pct: number | null;
  delta_name_pct: number | null;
  history_points: Array<{ collected_at: string; total_monthly_volume: number; total_name_volume: number }>;
}

export interface PainelPayload extends RegionDemandPayload {
  trend: TrendInfo;
}

const EMPTY_TREND: TrendInfo = {
  previous_total_monthly_volume: null,
  previous_total_name_volume: null,
  previous_collected_at: null,
  delta_market_pct: null,
  delta_name_pct: null,
  history_points: [],
};

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Carrega payload com trend pro painel. Lê últimos 6 snapshots da history.
 * Se não há history, devolve null (caller deve fallback pra mock).
 */
export async function loadPainelPayload(supabase: SB, tenantId: string): Promise<PainelPayload | null> {
  const { data: history } = await supabase
    .from('tenant_region_demand_history')
    .select('payload, collected_at')
    .eq('tenant_id', tenantId)
    .order('collected_at', { ascending: false })
    .limit(6);

  if (!history || history.length === 0) return null;

  const current = history[0].payload as RegionDemandPayload;
  const previous = history[1]?.payload as RegionDemandPayload | undefined;

  const currentMarket = current.total_monthly_volume ?? 0;
  const currentName = current.name_search?.total_volume ?? 0;
  const previousMarket = previous?.total_monthly_volume ?? 0;
  const previousName = previous?.name_search?.total_volume ?? 0;

  const trend: TrendInfo = {
    previous_total_monthly_volume: previous ? previousMarket : null,
    previous_total_name_volume: previous ? previousName : null,
    previous_collected_at: history[1]?.collected_at as string | undefined ?? null,
    delta_market_pct: previous ? pctDelta(currentMarket, previousMarket) : null,
    delta_name_pct: previous ? pctDelta(currentName, previousName) : null,
    history_points: history
      .map(h => ({
        collected_at: h.collected_at as string,
        total_monthly_volume: (h.payload as RegionDemandPayload).total_monthly_volume ?? 0,
        total_name_volume: (h.payload as RegionDemandPayload).name_search?.total_volume ?? 0,
      }))
      .reverse(),
  };

  return { ...current, is_cached: true, trend };
}

export function buildEphemeralPainelPayload(specialty: string, city: string, state: string, doctorName?: string | null): PainelPayload {
  return { ...mockResponse(specialty, city, state, doctorName), trend: EMPTY_TREND };
}

// ── Refresh ──────────────────────────────────────────────────────────────────
export interface RefreshResult {
  tenant_id: string;
  status: 'ok' | 'skipped' | 'error';
  reason?: string;
  is_mock?: boolean;
  total_monthly_volume?: number;
  total_name_volume?: number;
}

export async function refreshRegionDemandForTenant(supabase: SB, tenantId: string): Promise<RefreshResult> {
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
    return { tenant_id: tenantId, status: 'skipped', reason: 'missing city or specialty' };
  }

  const config = await getOrGenerateKeywords(supabase, tenantId, specialty, city, stateName, doctorName);
  const allKeywords = [...config.market_keywords, ...config.name_keywords];

  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  // Sem credenciais → não grava nada na history. GET serve mock ephemeral.
  if (!login || !password) {
    console.log('[region-demand] tenant=%s SKIP no DFS credentials', tenantId);
    return { tenant_id: tenantId, status: 'skipped', reason: 'no DataForSEO credentials configured' };
  }

  const baseUrl = process.env.DATAFORSEO_BASE_URL || 'https://api.dataforseo.com';
  const expandedState = expandStateName(stateName);

  // DataForSEO Google Ads tem cobertura limitada de cidades médias no BR.
  // Cascata: cidade → estado → país. Marca o nível usado.
  const locationCascade: Array<{ name: string; level: 'city' | 'state' | 'country' }> = [
    { name: `${city},${expandedState},Brazil`, level: 'city' },
    { name: `${expandedState},Brazil`, level: 'state' },
    { name: 'Brazil', level: 'country' },
  ];

  async function callDfs(locationName: string): Promise<{ ok: true; data: DfsResponse } | { ok: false; reason: string }> {
    try {
      const res = await fetch(
        `${baseUrl}/v3/keywords_data/google_ads/search_volume/live`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([{
            keywords: allKeywords,
            location_name: locationName,
            language_code: 'pt',
            search_partners: false,
          }]),
        }
      );
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return { ok: false, reason: `http ${res.status}: ${body.slice(0, 200)}` };
      }
      const data = (await res.json()) as DfsResponse;
      if (data.status_code !== 20000) {
        return { ok: false, reason: `status ${data.status_code}: ${data.status_message}` };
      }
      return { ok: true, data };
    } catch (e) {
      return { ok: false, reason: `fetch: ${(e as Error).message}` };
    }
  }

  let chosenLevel: 'city' | 'state' | 'country' = 'city';
  let chosenLocation = locationCascade[0].name;
  let data: DfsResponse | null = null;
  const cascadeAttempts: Array<{ location: string; level: string; results: number; reason?: string }> = [];

  for (const step of locationCascade) {
    const r = await callDfs(step.name);
    if (!r.ok) {
      cascadeAttempts.push({ location: step.name, level: step.level, results: 0, reason: r.reason });
      console.log('[region-demand] tenant=%s cascade %s FAIL: %s', tenantId, step.level, r.reason);
      continue;
    }
    const cnt = r.data.tasks?.[0]?.result?.length ?? 0;
    cascadeAttempts.push({ location: step.name, level: step.level, results: cnt });
    if (cnt > 0) {
      data = r.data;
      chosenLevel = step.level;
      chosenLocation = step.name;
      console.log('[region-demand] tenant=%s cascade %s OK results=%s', tenantId, step.level, cnt);
      break;
    }
    console.log('[region-demand] tenant=%s cascade %s empty, trying next', tenantId, step.level);
  }

  if (!data) {
    return { tenant_id: tenantId, status: 'error', reason: `dfs cascade exhausted: ${JSON.stringify(cascadeAttempts)}` };
  }

  // Sucesso — grava DADOS REAIS, mesmo que volumes sejam 0/null
  const results = data.tasks?.[0]?.result ?? [];
  const marketSet = new Set(config.market_keywords);
  const nameSet = new Set(config.name_keywords);
  const marketResults = results.filter(k => marketSet.has(k.keyword));
  const nameResults = results.filter(k => nameSet.has(k.keyword));

  const totalMarket = marketResults.reduce((s, k) => s + (k.search_volume ?? 0), 0);
  const totalName = nameResults.reduce((s, k) => s + (k.search_volume ?? 0), 0);

  // Diagnóstico: log raw DFS sample pra detectar location não-reconhecida ou
  // outros problemas de matching de keywords
  if (totalMarket === 0 && results.length > 0) {
    const sample = results.slice(0, 3).map(r => ({
      keyword: r.keyword,
      search_volume: r.search_volume,
      cpc: r.cpc,
    }));
    console.log('[region-demand] tenant=%s WARN totalMarket=0 sample=%j returned=%s sent=%s', tenantId, sample, results.length, allKeywords.length);
  } else if (results.length === 0) {
    console.log('[region-demand] tenant=%s WARN dfs returned 0 results for %s keywords', tenantId, allKeywords.length);
  }

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

  const locationLabel = chosenLevel === 'city'
    ? `${city}, ${stateName}, Brazil`
    : chosenLevel === 'state'
    ? `${expandedState}, Brazil (estado — cidade sem dados no Google Ads)`
    : 'Brasil (estimativa nacional — região sem dados no Google Ads)';

  const payload: RegionDemandPayload & { _debug?: unknown } = {
    success: true,
    is_mock: false,
    is_cached: false,
    location: locationLabel,
    location_level: chosenLevel,
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
    _debug: {
      location_used: chosenLocation,
      location_level: chosenLevel,
      cascade_attempts: cascadeAttempts,
      keywords_sent: allKeywords,
      results_returned: results.length,
      raw_sample: results.slice(0, 5).map(r => ({
        keyword: r.keyword,
        search_volume: r.search_volume,
        cpc: r.cpc,
        competition: r.competition,
        competition_level: r.competition_level,
      })),
      dfs_status_code: data.status_code,
      dfs_status_message: data.status_message,
    },
  };

  console.log('[region-demand] tenant=%s OK market=%s name=%s keywords_returned=%s', tenantId, totalMarket, totalName, results.length);

  const { error: histErr } = await supabase
    .from('tenant_region_demand_history')
    .insert({
      tenant_id: tenantId,
      payload,
      collected_at: new Date().toISOString(),
    });

  if (histErr) {
    return { tenant_id: tenantId, status: 'error', reason: `history insert: ${histErr.message}` };
  }

  return {
    tenant_id: tenantId,
    status: 'ok',
    is_mock: false,
    total_monthly_volume: totalMarket,
    total_name_volume: totalName,
  };
}
