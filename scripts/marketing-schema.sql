-- scripts/marketing-schema.sql
-- Marketing add-ons: subscriptions, events tracking, vitrine profiles.
-- Execute in Supabase SQL Editor.

BEGIN;

-- 1. Marketing subscriptions per tenant
CREATE TABLE IF NOT EXISTS public.marketing_subscriptions (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id     uuid NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  plan          text NOT NULL CHECK (plan IN ('presenca', 'social', 'ads')),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'trial')),
  started_at    timestamptz NOT NULL DEFAULT now(),
  cancelled_at  timestamptz,
  -- OAuth tokens (encrypted via lib/crypto.ts)
  instagram_token_enc  text,  -- encrypted Instagram long-lived token
  facebook_page_id     text,
  google_gbp_token_enc text,  -- encrypted Google Business Profile token
  google_ads_customer_id text, -- Google Ads sub-account ID
  google_review_url    text,  -- direct link to Google Review form
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)  -- one subscription per tenant (upgrade/downgrade in place)
);

CREATE INDEX IF NOT EXISTS idx_marketing_sub_tenant
  ON public.marketing_subscriptions (tenant_id);

-- 2. Marketing events (analytics)
CREATE TABLE IF NOT EXISTS public.marketing_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  event_type  text NOT NULL CHECK (event_type IN (
    'review_request_sent',
    'review_completed',
    'recall_sent',
    'recall_converted',
    'post_published',
    'vitrine_view',
    'vitrine_click_whatsapp',
    'ad_impression',
    'ad_click',
    'ad_lead'
  )),
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mktevents_tenant_type
  ON public.marketing_events (tenant_id, event_type, created_at DESC);

-- 3. Vitrine profiles (public-facing)
CREATE TABLE IF NOT EXISTS public.vitrine_profiles (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id       uuid NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  doctor_id       bigint REFERENCES public.tenant_doctors(id),
  slug            text NOT NULL UNIQUE,  -- 'dr-joao-silva-dermatologista-campinas'
  display_name    text NOT NULL,
  professional_type text NOT NULL,       -- key from PROFESSIONAL_TYPES
  specialty       text NOT NULL,
  city            text NOT NULL,
  state           text NOT NULL DEFAULT 'SP',
  bio             text,
  photo_url       text,
  consultation_value numeric(10,2),
  google_review_url text,
  avg_nps         numeric(3,1),
  review_count    int NOT NULL DEFAULT 0,
  whatsapp_link   text,                  -- wa.me/55... direct link
  is_featured     boolean NOT NULL DEFAULT false,
  published       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vitrine_city_spec
  ON public.vitrine_profiles (city, professional_type, published) WHERE published = true;

CREATE INDEX IF NOT EXISTS idx_vitrine_slug
  ON public.vitrine_profiles (slug) WHERE published = true;

-- 4. RLS policies
ALTER TABLE public.marketing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vitrine_profiles ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; anon can read published vitrine profiles
CREATE POLICY vitrine_public_read ON public.vitrine_profiles
  FOR SELECT TO anon USING (published = true);

COMMIT;
