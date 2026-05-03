// app/lib/marketing-types.ts

export const MARKETING_PLANS = {
  presenca: 'Presença',
  social: 'Social',
  ads: 'Ads',
} as const;

export type MarketingPlanKey = keyof typeof MARKETING_PLANS;

export const MARKETING_PLAN_AMOUNTS: Record<MarketingPlanKey, number> = {
  presenca: 97,
  social: 197,
  ads: 297,
};

export const MARKETING_EVENT_TYPES = [
  'review_request_sent',
  'review_completed',
  'recall_sent',
  'recall_converted',
  'post_published',
  'vitrine_view',
  'vitrine_click_whatsapp',
  'ad_impression',
  'ad_click',
  'ad_lead',
] as const;

export type MarketingEventType = typeof MARKETING_EVENT_TYPES[number];

export interface MarketingSubscription {
  id: number;
  tenant_id: string;
  plan: MarketingPlanKey;
  status: 'active' | 'paused' | 'cancelled' | 'trial';
  google_review_url: string | null;
  instagram_token_enc: string | null;
  facebook_page_id: string | null;
  google_gbp_token_enc: string | null;
  google_ads_customer_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface VitrineProfile {
  id: number;
  tenant_id: string;
  doctor_id: number | null;
  slug: string;
  display_name: string;
  professional_type: string;
  specialty: string;
  city: string;
  state: string;
  bio: string | null;
  photo_url: string | null;
  consultation_value: number | null;
  google_review_url: string | null;
  avg_nps: number | null;
  review_count: number;
  whatsapp_link: string | null;
  is_featured: boolean;
  published: boolean;
}

export interface MarketingMetrics {
  review_requests_sent: number;
  reviews_completed: number;
  review_conversion_rate: number;
  recalls_sent: number;
  recalls_converted: number;
  recall_conversion_rate: number;
  vitrine_views: number;
  vitrine_whatsapp_clicks: number;
  posts_published: number;
  period_start: string;
  period_end: string;
}
