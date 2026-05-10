/**
 * Helper de Competitors via Google Places API (New).
 *
 * Endpoint: POST https://places.googleapis.com/v1/places:searchText
 * Fields: places.id, places.displayName, places.rating, places.userRatingCount,
 *         places.location, places.formattedAddress, places.businessStatus.
 *
 * Estratégia: searchText("{specialty} {city}") com locationBias.circle ao redor
 * do tenant (raio default 5km). Cap em 20 results (limite da API).
 *
 * Custo: ~US$ 0.032/chamada (Text Search Pro). Refresh mensal por tenant.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = SupabaseClient<any, 'public', any>;

const PLACES_API = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = 'places.id,places.displayName,places.rating,places.userRatingCount,places.location,places.formattedAddress,places.businessStatus';

export interface CompetitorEntry {
  place_id: string;
  name: string;
  rating: number | null;
  reviews: number;
  address: string;
  distance_km: number | null;
  is_self: boolean;
}

export interface CompetitorsPayload {
  is_mock: boolean;
  is_cached?: boolean;
  search_query: string;
  location_label: string;
  competitors: CompetitorEntry[];
  market_stats: {
    total_competitors: number;
    avg_rating: number | null;
    avg_reviews: number | null;
    median_reviews: number | null;
    top_rating: number | null;
    top_reviews: number | null;
    self_position_by_reviews: number | null;
    self_percentile_by_reviews: number | null;
  };
  collected_at: string;
}

export interface CompetitorsTrendInfo {
  previous_avg_reviews: number | null;
  previous_self_percentile: number | null;
  previous_collected_at: string | null;
  delta_self_percentile: number | null;
  history_points: Array<{ collected_at: string; avg_reviews: number | null; self_percentile: number | null }>;
}

export interface CompetitorsPainelPayload extends CompetitorsPayload {
  trend: CompetitorsTrendInfo;
}

const EMPTY_TREND: CompetitorsTrendInfo = {
  previous_avg_reviews: null,
  previous_self_percentile: null,
  previous_collected_at: null,
  delta_self_percentile: null,
  history_points: [],
};

export function mockCompetitors(specialty: string, city: string): CompetitorsPayload {
  return {
    is_mock: true,
    search_query: `${specialty} ${city}`,
    location_label: city,
    competitors: [],
    market_stats: {
      total_competitors: 0,
      avg_rating: null,
      avg_reviews: null,
      median_reviews: null,
      top_rating: null,
      top_reviews: null,
      self_position_by_reviews: null,
      self_percentile_by_reviews: null,
    },
    collected_at: new Date().toISOString(),
  };
}

export function buildEphemeralCompetitorsPayload(specialty: string, city: string): CompetitorsPainelPayload {
  return { ...mockCompetitors(specialty, city), trend: EMPTY_TREND };
}

export async function loadCompetitorsPainelPayload(supabase: SB, tenantId: string): Promise<CompetitorsPainelPayload | null> {
  const { data: history } = await supabase
    .from('tenant_competitors_history')
    .select('payload, collected_at')
    .eq('tenant_id', tenantId)
    .order('collected_at', { ascending: false })
    .limit(6);

  if (!history || history.length === 0) return null;

  const current = history[0].payload as CompetitorsPayload;
  const previous = history[1]?.payload as CompetitorsPayload | undefined;

  const currentAvg = current.market_stats.avg_reviews;
  const currentPct = current.market_stats.self_percentile_by_reviews;
  const prevAvg = previous?.market_stats.avg_reviews ?? null;
  const prevPct = previous?.market_stats.self_percentile_by_reviews ?? null;

  const trend: CompetitorsTrendInfo = {
    previous_avg_reviews: prevAvg,
    previous_self_percentile: prevPct,
    previous_collected_at: history[1]?.collected_at as string | undefined ?? null,
    delta_self_percentile: prevPct != null && currentPct != null ? currentPct - prevPct : null,
    history_points: history
      .map(h => {
        const p = h.payload as CompetitorsPayload;
        return {
          collected_at: h.collected_at as string,
          avg_reviews: p.market_stats.avg_reviews,
          self_percentile: p.market_stats.self_percentile_by_reviews,
        };
      })
      .reverse(),
  };

  return { ...current, is_cached: true, trend };
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

interface PlacesSearchResponse {
  places?: Array<{
    id: string;
    displayName?: { text: string };
    rating?: number;
    userRatingCount?: number;
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    businessStatus?: string;
  }>;
}

async function geocodeAddress(apiKey: string, address: string): Promise<{ lat: number; lng: number } | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('region', 'br');
  url.searchParams.set('key', apiKey);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: Array<{ geometry: { location: { lat: number; lng: number } } }> };
  const loc = data.results?.[0]?.geometry?.location;
  return loc ?? null;
}

export interface CompetitorsRefreshResult {
  tenant_id: string;
  status: 'ok' | 'skipped' | 'error';
  reason?: string;
  total_competitors?: number;
  avg_reviews?: number | null;
}

export async function refreshCompetitorsForTenant(supabase: SB, tenantId: string): Promise<CompetitorsRefreshResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    return { tenant_id: tenantId, status: 'skipped', reason: 'no GOOGLE_PLACES_API_KEY' };
  }

  const [tenantRes, doctorRes] = await Promise.all([
    supabase.from('tenants').select('city, state, address, google_place_id, clinic_name').eq('tenant_id', tenantId).maybeSingle(),
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
  const address = tenantRes.data?.address as string | null | undefined;
  const selfPlaceId = tenantRes.data?.google_place_id as string | null | undefined;
  const specialty = doctorRes.data?.specialty as string | null | undefined;

  if (!specialty || !city) {
    return { tenant_id: tenantId, status: 'skipped', reason: 'missing city or specialty' };
  }

  const fullAddress = address ? `${address}, ${city}, ${stateName}, Brazil` : `${city}, ${stateName}, Brazil`;
  const center = await geocodeAddress(apiKey, fullAddress);
  if (!center) {
    return { tenant_id: tenantId, status: 'error', reason: 'geocode failed' };
  }

  const query = `${specialty} ${city}`;
  const reqBody = {
    textQuery: query,
    languageCode: 'pt-BR',
    regionCode: 'BR',
    locationBias: {
      circle: { center: { latitude: center.lat, longitude: center.lng }, radius: 8000 },
    },
    maxResultCount: 20,
  };

  const res = await fetch(PLACES_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(reqBody),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    return { tenant_id: tenantId, status: 'error', reason: `places: http ${res.status} ${txt.slice(0, 200)}` };
  }

  const data = (await res.json()) as PlacesSearchResponse;
  const places = data.places ?? [];

  const competitors: CompetitorEntry[] = places.map(p => {
    const loc = p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null;
    return {
      place_id: p.id,
      name: p.displayName?.text ?? p.id,
      rating: p.rating ?? null,
      reviews: p.userRatingCount ?? 0,
      address: p.formattedAddress ?? '',
      distance_km: loc ? haversineKm(center, loc) : null,
      is_self: !!selfPlaceId && p.id === selfPlaceId,
    };
  });

  const others = competitors.filter(c => !c.is_self);
  const ratings = others.map(c => c.rating).filter((r): r is number => r != null);
  const reviewCounts = others.map(c => c.reviews);
  const sortedByReviews = [...others].sort((a, b) => b.reviews - a.reviews);

  const self = competitors.find(c => c.is_self);
  const allByReviewsIncSelf = [...competitors].sort((a, b) => b.reviews - a.reviews);
  const selfPos = self ? allByReviewsIncSelf.findIndex(c => c.is_self) + 1 : null;
  const selfPct = self && allByReviewsIncSelf.length > 1
    ? Math.round(((allByReviewsIncSelf.length - selfPos!) / (allByReviewsIncSelf.length - 1)) * 100)
    : null;

  const avgRating = ratings.length > 0 ? ratings.reduce((s, v) => s + v, 0) / ratings.length : null;
  const avgReviews = reviewCounts.length > 0 ? reviewCounts.reduce((s, v) => s + v, 0) / reviewCounts.length : null;
  const medianReviews = (() => {
    if (reviewCounts.length === 0) return null;
    const s = [...reviewCounts].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
  })();

  const payload: CompetitorsPayload = {
    is_mock: false,
    search_query: query,
    location_label: `${city}, ${stateName}`,
    competitors: competitors
      .sort((a, b) => b.reviews - a.reviews)
      .slice(0, 15),
    market_stats: {
      total_competitors: others.length,
      avg_rating: avgRating != null ? Number(avgRating.toFixed(2)) : null,
      avg_reviews: avgReviews != null ? Math.round(avgReviews) : null,
      median_reviews: medianReviews != null ? Math.round(medianReviews) : null,
      top_rating: ratings.length > 0 ? Math.max(...ratings) : null,
      top_reviews: sortedByReviews[0]?.reviews ?? null,
      self_position_by_reviews: selfPos,
      self_percentile_by_reviews: selfPct,
    },
    collected_at: new Date().toISOString(),
  };

  const { error: histErr } = await supabase
    .from('tenant_competitors_history')
    .insert({ tenant_id: tenantId, payload, collected_at: new Date().toISOString() });

  if (histErr) return { tenant_id: tenantId, status: 'error', reason: `history insert: ${histErr.message}` };

  console.log('[competitors] tenant=%s OK total=%s avg_reviews=%s self_pos=%s', tenantId, others.length, avgReviews, selfPos);

  return { tenant_id: tenantId, status: 'ok', total_competitors: others.length, avg_reviews: avgReviews };
}
