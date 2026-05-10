/**
 * Helper compartilhado entre os endpoints de GBP Insights.
 *
 * Fonte: Business Profile Performance API
 *   https://businessprofileperformance.googleapis.com/v1/{location=locations/*}:fetchMultiDailyMetricsTimeSeries
 *
 * Métricas que coletamos (DAILY_METRIC_*):
 *   BUSINESS_IMPRESSIONS_DESKTOP_MAPS, BUSINESS_IMPRESSIONS_DESKTOP_SEARCH,
 *   BUSINESS_IMPRESSIONS_MOBILE_MAPS,  BUSINESS_IMPRESSIONS_MOBILE_SEARCH,
 *   BUSINESS_DIRECTION_REQUESTS, CALL_CLICKS, WEBSITE_CLICKS,
 *   BUSINESS_BOOKINGS, BUSINESS_CONVERSATIONS
 *
 * Auth: OAuth2 com refresh_token guardado em marketing_subscriptions.gbp_refresh_token_enc.
 * Refresh: cron mensal + botão manual no painel.
 * Append-only em tenant_gbp_insights_history → trends.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptString } from './crypto';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, 'public', any>;

const PERFORMANCE_BASE = 'https://businessprofileperformance.googleapis.com/v1';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const METRICS = [
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  'BUSINESS_DIRECTION_REQUESTS',
  'CALL_CLICKS',
  'WEBSITE_CLICKS',
  'BUSINESS_BOOKINGS',
  'BUSINESS_CONVERSATIONS',
] as const;

type MetricName = typeof METRICS[number];

export interface GbpInsightsPayload {
  is_mock: boolean;
  is_cached?: boolean;
  location_name: string;
  period_start: string; // ISO date
  period_end: string;   // ISO date
  totals: {
    impressions_search: number;
    impressions_maps: number;
    impressions_total: number;
    direction_requests: number;
    call_clicks: number;
    website_clicks: number;
    bookings: number;
    conversations: number;
  };
  daily: Array<{ date: string; impressions: number; calls: number; directions: number; website: number }>;
  collected_at: string;
}

export interface GbpTrendInfo {
  previous_impressions_total: number | null;
  previous_call_clicks: number | null;
  previous_collected_at: string | null;
  delta_impressions_pct: number | null;
  delta_calls_pct: number | null;
  history_points: Array<{ collected_at: string; impressions_total: number; call_clicks: number }>;
}

export interface GbpPainelPayload extends GbpInsightsPayload {
  trend: GbpTrendInfo;
}

const EMPTY_TREND: GbpTrendInfo = {
  previous_impressions_total: null,
  previous_call_clicks: null,
  previous_collected_at: null,
  delta_impressions_pct: null,
  delta_calls_pct: null,
  history_points: [],
};

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function mockGbpInsights(locationName: string): GbpInsightsPayload {
  const today = new Date();
  const start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    is_mock: true,
    location_name: locationName,
    period_start: start.toISOString().slice(0, 10),
    period_end: today.toISOString().slice(0, 10),
    totals: {
      impressions_search: 420,
      impressions_maps: 180,
      impressions_total: 600,
      direction_requests: 24,
      call_clicks: 18,
      website_clicks: 32,
      bookings: 0,
      conversations: 0,
    },
    daily: [],
    collected_at: new Date().toISOString(),
  };
}

export function buildEphemeralGbpPayload(locationName: string): GbpPainelPayload {
  return { ...mockGbpInsights(locationName), trend: EMPTY_TREND };
}

export async function loadGbpPainelPayload(supabase: SB, tenantId: string): Promise<GbpPainelPayload | null> {
  const { data: history } = await supabase
    .from('tenant_gbp_insights_history')
    .select('payload, collected_at')
    .eq('tenant_id', tenantId)
    .order('collected_at', { ascending: false })
    .limit(6);

  if (!history || history.length === 0) return null;

  const current = history[0].payload as GbpInsightsPayload;
  const previous = history[1]?.payload as GbpInsightsPayload | undefined;

  const currentImpr = current.totals.impressions_total ?? 0;
  const currentCalls = current.totals.call_clicks ?? 0;
  const previousImpr = previous?.totals.impressions_total ?? 0;
  const previousCalls = previous?.totals.call_clicks ?? 0;

  const trend: GbpTrendInfo = {
    previous_impressions_total: previous ? previousImpr : null,
    previous_call_clicks: previous ? previousCalls : null,
    previous_collected_at: history[1]?.collected_at as string | undefined ?? null,
    delta_impressions_pct: previous ? pctDelta(currentImpr, previousImpr) : null,
    delta_calls_pct: previous ? pctDelta(currentCalls, previousCalls) : null,
    history_points: history
      .map(h => ({
        collected_at: h.collected_at as string,
        impressions_total: (h.payload as GbpInsightsPayload).totals.impressions_total ?? 0,
        call_clicks: (h.payload as GbpInsightsPayload).totals.call_clicks ?? 0,
      }))
      .reverse(),
  };

  return { ...current, is_cached: true, trend };
}

export interface GbpRefreshResult {
  tenant_id: string;
  status: 'ok' | 'skipped' | 'error';
  reason?: string;
  is_mock?: boolean;
  impressions_total?: number;
  call_clicks?: number;
}

async function exchangeRefreshToken(refreshToken: string): Promise<{ ok: true; accessToken: string } | { ok: false; reason: string }> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { ok: false, reason: 'GOOGLE_OAUTH_CLIENT_ID/SECRET missing' };
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json().catch(() => ({} as { access_token?: string; error?: string; error_description?: string }));
  if (!res.ok || !data.access_token) {
    return { ok: false, reason: `oauth: ${res.status} ${data.error_description || data.error || ''}` };
  }
  return { ok: true, accessToken: data.access_token as string };
}

interface PerformanceResponse {
  multiDailyMetricTimeSeries?: Array<{
    dailyMetricTimeSeries?: Array<{
      dailyMetric?: MetricName;
      timeSeries?: { datedValues?: Array<{ date: { year: number; month: number; day: number }; value?: string }> };
    }>;
  }>;
}

function dateToParam(d: Date): { year: number; month: number; day: number } {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

async function fetchPerformance(
  accessToken: string,
  locationId: string,
  start: Date,
  end: Date
): Promise<{ ok: true; data: PerformanceResponse } | { ok: false; reason: string }> {
  const params = new URLSearchParams();
  for (const m of METRICS) params.append('dailyMetrics', m);
  const s = dateToParam(start);
  const e = dateToParam(end);
  params.set('dailyRange.start_date.year', String(s.year));
  params.set('dailyRange.start_date.month', String(s.month));
  params.set('dailyRange.start_date.day', String(s.day));
  params.set('dailyRange.end_date.year', String(e.year));
  params.set('dailyRange.end_date.month', String(e.month));
  params.set('dailyRange.end_date.day', String(e.day));

  const url = `${PERFORMANCE_BASE}/locations/${locationId}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { ok: false, reason: `http ${res.status}: ${body.slice(0, 300)}` };
  }
  return { ok: true, data: (await res.json()) as PerformanceResponse };
}

function aggregate(data: PerformanceResponse): {
  totals: GbpInsightsPayload['totals'];
  daily: GbpInsightsPayload['daily'];
} {
  const totalsByMetric: Record<string, number> = {};
  const dailyByDate: Record<string, { impressions: number; calls: number; directions: number; website: number }> = {};

  const series = data.multiDailyMetricTimeSeries?.[0]?.dailyMetricTimeSeries ?? [];
  for (const s of series) {
    const metric = s.dailyMetric;
    if (!metric) continue;
    const datedValues = s.timeSeries?.datedValues ?? [];
    let total = 0;
    for (const dv of datedValues) {
      const value = Number(dv.value ?? 0) || 0;
      total += value;
      const dateKey = `${dv.date.year}-${String(dv.date.month).padStart(2, '0')}-${String(dv.date.day).padStart(2, '0')}`;
      const bucket = dailyByDate[dateKey] ?? { impressions: 0, calls: 0, directions: 0, website: 0 };
      if (metric.startsWith('BUSINESS_IMPRESSIONS')) bucket.impressions += value;
      else if (metric === 'CALL_CLICKS') bucket.calls += value;
      else if (metric === 'BUSINESS_DIRECTION_REQUESTS') bucket.directions += value;
      else if (metric === 'WEBSITE_CLICKS') bucket.website += value;
      dailyByDate[dateKey] = bucket;
    }
    totalsByMetric[metric] = total;
  }

  const search = (totalsByMetric.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH ?? 0) + (totalsByMetric.BUSINESS_IMPRESSIONS_MOBILE_SEARCH ?? 0);
  const maps = (totalsByMetric.BUSINESS_IMPRESSIONS_DESKTOP_MAPS ?? 0) + (totalsByMetric.BUSINESS_IMPRESSIONS_MOBILE_MAPS ?? 0);

  const totals = {
    impressions_search: search,
    impressions_maps: maps,
    impressions_total: search + maps,
    direction_requests: totalsByMetric.BUSINESS_DIRECTION_REQUESTS ?? 0,
    call_clicks: totalsByMetric.CALL_CLICKS ?? 0,
    website_clicks: totalsByMetric.WEBSITE_CLICKS ?? 0,
    bookings: totalsByMetric.BUSINESS_BOOKINGS ?? 0,
    conversations: totalsByMetric.BUSINESS_CONVERSATIONS ?? 0,
  };

  const daily = Object.entries(dailyByDate)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { totals, daily };
}

export async function refreshGbpInsightsForTenant(supabase: SB, tenantId: string): Promise<GbpRefreshResult> {
  const { data: sub } = await supabase
    .from('marketing_subscriptions')
    .select('gbp_refresh_token_enc, gbp_location_id, gbp_location_name')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const tokenEnc = sub?.gbp_refresh_token_enc as string | null | undefined;
  const locationId = sub?.gbp_location_id as string | null | undefined;
  const locationName = (sub?.gbp_location_name as string | null | undefined) ?? '';

  if (!tokenEnc || !locationId) {
    return { tenant_id: tenantId, status: 'skipped', reason: 'no GBP OAuth connection' };
  }

  let refreshToken: string;
  try {
    refreshToken = decryptString(tokenEnc);
  } catch (e) {
    return { tenant_id: tenantId, status: 'error', reason: `decrypt: ${(e as Error).message}` };
  }

  const tokenRes = await exchangeRefreshToken(refreshToken);
  if (!tokenRes.ok) return { tenant_id: tenantId, status: 'error', reason: tokenRes.reason };

  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end.getTime() - 27 * 24 * 60 * 60 * 1000);

  const perf = await fetchPerformance(tokenRes.accessToken, locationId, start, end);
  if (!perf.ok) return { tenant_id: tenantId, status: 'error', reason: perf.reason };

  const { totals, daily } = aggregate(perf.data);

  const payload: GbpInsightsPayload = {
    is_mock: false,
    location_name: locationName || `locations/${locationId}`,
    period_start: start.toISOString().slice(0, 10),
    period_end: end.toISOString().slice(0, 10),
    totals,
    daily,
    collected_at: new Date().toISOString(),
  };

  const { error: histErr } = await supabase
    .from('tenant_gbp_insights_history')
    .insert({ tenant_id: tenantId, payload, collected_at: new Date().toISOString() });

  if (histErr) return { tenant_id: tenantId, status: 'error', reason: `history insert: ${histErr.message}` };

  console.log('[gbp-insights] tenant=%s OK impressions=%s calls=%s', tenantId, totals.impressions_total, totals.call_clicks);

  return {
    tenant_id: tenantId,
    status: 'ok',
    is_mock: false,
    impressions_total: totals.impressions_total,
    call_clicks: totals.call_clicks,
  };
}
