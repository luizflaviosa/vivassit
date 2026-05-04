import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

export const runtime = 'edge';

function parsePeriodMs(period: string): number {
  const map: Record<string, number> = {
    '1m': 30 * 24 * 60 * 60 * 1000,
    '3m': 90 * 24 * 60 * 60 * 1000,
    '6m': 180 * 24 * 60 * 60 * 1000,
    '1y': 365 * 24 * 60 * 60 * 1000,
  };
  return map[period] ?? map['3m'];
}

export async function GET(req: Request) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const supabase = supabaseAdmin();
  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || '3m';

  const [{ data: latest }, { data: history }] = await Promise.all([
    supabase
      .from('tenant_scores')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('collected_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('tenant_scores')
      .select('total_score, classification, google_score, doctoralia_score, social_score, seo_score, operational_score, collected_at')
      .eq('tenant_id', tenantId)
      .gte('collected_at', new Date(Date.now() - parsePeriodMs(period)).toISOString())
      .order('collected_at', { ascending: true }),
  ]);

  let recommendations: unknown[] = [];
  if (latest?.recommendations) {
    try {
      recommendations = typeof latest.recommendations === 'string'
        ? JSON.parse(latest.recommendations)
        : latest.recommendations;
    } catch { recommendations = []; }
  }

  return NextResponse.json({
    current: latest ? {
      total_score: latest.total_score,
      classification: latest.classification,
      score_change: latest.score_change,
      previous_score: latest.previous_score,
      pilares: {
        google: { score: latest.google_score, max: 30, rating: latest.google_rating, reviews: latest.google_reviews_count },
        doctoralia: { score: latest.doctoralia_score, max: 15, present: latest.doctoralia_present, rating: latest.doctoralia_rating, reviews: latest.doctoralia_reviews_count },
        social: { score: latest.social_score, max: 20, ig_followers: latest.ig_followers, ig_engagement: latest.ig_engagement_rate, fb_fans: latest.fb_fans },
        seo: { score: latest.seo_score, max: 20, website_exists: latest.website_exists, mobile_score: latest.website_mobile_score, top10: latest.google_search_top10 },
        operational: { score: latest.operational_score, max: 15, booking_rate: latest.booking_rate, avg_nps: latest.avg_nps, noshow_rate: latest.noshow_rate },
      },
      collected_at: latest.collected_at,
    } : null,
    history: history || [],
    recommendations,
  });
}
