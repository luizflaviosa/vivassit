// app/lib/marketing-queries.ts

import { supabaseAdmin } from './supabase';
import type { MarketingMetrics, MarketingEventType } from './marketing-types';

const sb = () => supabaseAdmin();

export async function getMarketingSubscription(tenantId: string) {
  const { data } = await sb()
    .from('marketing_subscriptions')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return data;
}

export async function logMarketingEvent(
  tenantId: string,
  eventType: MarketingEventType,
  metadata: Record<string, unknown> = {}
) {
  await sb()
    .from('marketing_events')
    .insert({ tenant_id: tenantId, event_type: eventType, metadata });
}

export async function getMarketingMetrics(
  tenantId: string,
  days: number = 30
): Promise<MarketingMetrics> {
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - days);
  const periodStartISO = periodStart.toISOString();
  const periodEnd = new Date().toISOString();

  const { data: events } = await sb()
    .from('marketing_events')
    .select('event_type')
    .eq('tenant_id', tenantId)
    .gte('created_at', periodStartISO);

  const counts: Record<string, number> = {};
  for (const e of events ?? []) {
    counts[e.event_type] = (counts[e.event_type] ?? 0) + 1;
  }

  const reviewsSent = counts['review_request_sent'] ?? 0;
  const reviewsDone = counts['review_completed'] ?? 0;
  const recallsSent = counts['recall_sent'] ?? 0;
  const recallsConverted = counts['recall_converted'] ?? 0;

  return {
    review_requests_sent: reviewsSent,
    reviews_completed: reviewsDone,
    review_conversion_rate: reviewsSent > 0 ? reviewsDone / reviewsSent : 0,
    recalls_sent: recallsSent,
    recalls_converted: recallsConverted,
    recall_conversion_rate: recallsSent > 0 ? recallsConverted / recallsSent : 0,
    vitrine_views: counts['vitrine_view'] ?? 0,
    vitrine_whatsapp_clicks: counts['vitrine_click_whatsapp'] ?? 0,
    posts_published: counts['post_published'] ?? 0,
    period_start: periodStartISO,
    period_end: periodEnd,
  };
}

export async function getPublishedVitrineProfiles(
  city?: string,
  professionalType?: string
) {
  let query = sb()
    .from('vitrine_profiles')
    .select('*')
    .eq('published', true)
    .order('is_featured', { ascending: false })
    .order('avg_nps', { ascending: false, nullsFirst: false });

  if (city) query = query.ilike('city', city);
  if (professionalType) query = query.eq('professional_type', professionalType);

  const { data } = await query.limit(50);
  return data ?? [];
}

export async function getVitrineBySlug(slug: string) {
  const { data } = await sb()
    .from('vitrine_profiles')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
  return data;
}
