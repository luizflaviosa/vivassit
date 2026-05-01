# Singulare Marketing Add-ons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three marketing add-ons (Presença R$97, Social R$197, Ads R$297) that run on autopilot using existing Singulare infrastructure (N8N, Gemini, Supabase, WhatsApp/Baileys).

**Architecture:** Phase 1 (Presença) has zero external dependencies — NPS→Review redirect, recall cron, SEO vitrine pages, and metrics dashboard all use existing stack. Phase 2 (Social) and Phase 3 (Ads) are gated behind Meta App Review and Google Ads API approval respectively, applied for in parallel with Phase 1 dev. All marketing data flows through a `marketing_events` table for unified analytics. OAuth tokens for Instagram/Google stored encrypted via existing `lib/crypto.ts` (AES-256-GCM).

**Tech Stack:** Next.js 14 App Router (SSR pages + API routes), Supabase (Postgres), N8N (workflow orchestration), Gemini (content generation), Baileys/Evolution (WhatsApp), Instagram Graph API, Google Ads API, Google Business Profile API.

---

## File Structure

### New files to create:

```
# Supabase migration
scripts/marketing-schema.sql

# Vitrine public pages (SSR, no auth)
app/app/p/[slug]/page.tsx                         — Individual professional profile
app/app/profissionais/[cidade]/[especialidade]/page.tsx — City+specialty listing
app/app/profissionais/page.tsx                     — Root directory page

# API routes (authed, painel)
app/app/api/painel/marketing/subscription/route.ts — CRUD marketing subscription
app/app/api/painel/marketing/events/route.ts       — Read marketing events/metrics
app/app/api/painel/marketing/review-link/route.ts  — Save/get Google Review link
app/app/api/painel/marketing/oauth/instagram/route.ts — Instagram OAuth callback
app/app/api/painel/marketing/oauth/google/route.ts — Google OAuth callback

# API routes (public, for vitrine)
app/app/api/vitrine/profiles/route.ts              — Public profiles listing
app/app/api/vitrine/profiles/[slug]/route.ts       — Single profile data

# N8N workflow definitions (JSON exports for import)
docs/n8n/marketing-nps-review.json                 — NPS→Google Review workflow
docs/n8n/marketing-recall.json                     — Recall inactive patients
docs/n8n/marketing-gbp-post.json                   — Google Business Profile auto-post
docs/n8n/marketing-social-post.json                — Instagram/Facebook auto-post
docs/n8n/marketing-ads-sync.json                   — Google Ads agenda↔campaign sync

# Painel UI
app/app/painel/marketing/page.tsx                  — Marketing dashboard
app/app/painel/marketing/configurar/page.tsx       — Marketing settings + OAuth connect

# Shared lib
app/lib/marketing-types.ts                         — Types for marketing features
app/lib/marketing-queries.ts                       — Supabase queries for marketing data
```

### Existing files to modify:

```
app/app/sitemap.ts                    — Add dynamic vitrine URLs
app/app/painel/layout.tsx:93          — Enable "Visibilidade" nav item → /painel/marketing
app/lib/supabase.ts                   — Add MARKETING_PLAN_AMOUNTS
app/lib/types.ts                      — Add marketing add-on types to OnboardingData
```

---

## PHASE 1: SINGULARE PRESENÇA (zero external dependencies)

### Task 1: Database Schema — Marketing Tables

**Files:**
- Create: `scripts/marketing-schema.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
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
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Copy the SQL above, paste into Supabase SQL Editor, execute. Verify tables exist:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('marketing_subscriptions', 'marketing_events', 'vitrine_profiles');
```

Expected: 3 rows returned.

- [ ] **Step 3: Commit**

```bash
git add scripts/marketing-schema.sql
git commit -m "feat(marketing): add schema for subscriptions, events, vitrine profiles"
```

---

### Task 2: Shared Types and Queries

**Files:**
- Create: `app/lib/marketing-types.ts`
- Create: `app/lib/marketing-queries.ts`
- Modify: `app/lib/supabase.ts`

- [ ] **Step 1: Create marketing types**

```typescript
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
```

- [ ] **Step 2: Create marketing queries helper**

```typescript
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
```

- [ ] **Step 3: Add MARKETING_PLAN_AMOUNTS to supabase.ts**

In `app/lib/supabase.ts`, add after the existing `SAAS_PLAN_AMOUNTS`:

```typescript
// Marketing add-on pricing
export { MARKETING_PLAN_AMOUNTS } from './marketing-types';
```

- [ ] **Step 4: Commit**

```bash
git add app/lib/marketing-types.ts app/lib/marketing-queries.ts app/lib/supabase.ts
git commit -m "feat(marketing): add shared types and Supabase query helpers"
```

---

### Task 3: Marketing Subscription API

**Files:**
- Create: `app/app/api/painel/marketing/subscription/route.ts`

- [ ] **Step 1: Create subscription endpoint (GET + POST + PATCH)**

```typescript
// app/app/api/painel/marketing/subscription/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';
import type { MarketingPlanKey } from '@/lib/marketing-types';

const VALID_PLANS: MarketingPlanKey[] = ['presenca', 'social', 'ads'];

// GET: current subscription for this tenant
export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const { data } = await supabaseAdmin()
    .from('marketing_subscriptions')
    .select('*')
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .maybeSingle();

  return NextResponse.json({ success: true, subscription: data });
}

// POST: create new subscription
export async function POST(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const plan = body.plan as MarketingPlanKey;
  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json(
      { success: false, message: 'Plano inválido' },
      { status: 400 }
    );
  }

  const tenantId = auth.ctx.tenant.tenant_id;

  // Upsert: one subscription per tenant
  const { data, error } = await supabaseAdmin()
    .from('marketing_subscriptions')
    .upsert(
      {
        tenant_id: tenantId,
        plan,
        status: 'trial',
        google_review_url: body.google_review_url ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, subscription: data });
}

// PATCH: update google_review_url or plan
export async function PATCH(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.plan && VALID_PLANS.includes(body.plan)) updates.plan = body.plan;
  if (body.google_review_url !== undefined) updates.google_review_url = body.google_review_url;
  if (body.status) updates.status = body.status;

  const { data, error } = await supabaseAdmin()
    .from('marketing_subscriptions')
    .update(updates)
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, subscription: data });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/app/api/painel/marketing/subscription/route.ts
git commit -m "feat(marketing): add subscription CRUD API route"
```

---

### Task 4: Marketing Events & Metrics API

**Files:**
- Create: `app/app/api/painel/marketing/events/route.ts`

- [ ] **Step 1: Create events/metrics endpoint**

```typescript
// app/app/api/painel/marketing/events/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { getMarketingMetrics } from '@/lib/marketing-queries';

// GET: marketing metrics for the tenant
export async function GET(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10);
  const metrics = await getMarketingMetrics(
    auth.ctx.tenant.tenant_id,
    Math.min(days, 365)
  );

  return NextResponse.json({ success: true, metrics });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/app/api/painel/marketing/events/route.ts
git commit -m "feat(marketing): add events/metrics API endpoint"
```

---

### Task 5: Vitrine Profile — Public API & SSR Pages

**Files:**
- Create: `app/app/api/vitrine/profiles/route.ts`
- Create: `app/app/p/[slug]/page.tsx`
- Create: `app/app/profissionais/[cidade]/[especialidade]/page.tsx`
- Create: `app/app/profissionais/page.tsx`

- [ ] **Step 1: Create public vitrine API**

```typescript
// app/app/api/vitrine/profiles/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getPublishedVitrineProfiles } from '@/lib/marketing-queries';
import { logMarketingEvent } from '@/lib/marketing-queries';

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get('city') ?? undefined;
  const type = req.nextUrl.searchParams.get('type') ?? undefined;

  const profiles = await getPublishedVitrineProfiles(city, type);

  return NextResponse.json({ success: true, profiles });
}
```

- [ ] **Step 2: Create individual profile page `/p/[slug]`**

```tsx
// app/app/p/[slug]/page.tsx

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getVitrineBySlug } from '@/lib/marketing-queries';
import { logMarketingEvent } from '@/lib/marketing-queries';
import { PROFESSIONAL_TYPES } from '@/lib/types';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await getVitrineBySlug(params.slug);
  if (!profile) return { title: 'Profissional não encontrado' };

  const profLabel = PROFESSIONAL_TYPES[profile.professional_type as keyof typeof PROFESSIONAL_TYPES] ?? profile.professional_type;
  const title = `${profile.display_name} — ${profLabel} em ${profile.city}`;
  const description = profile.bio
    ?? `${profLabel} em ${profile.city}. Agende sua consulta via WhatsApp.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      ...(profile.photo_url ? { images: [profile.photo_url] } : {}),
    },
    other: {
      'script:ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Physician',
        name: profile.display_name,
        medicalSpecialty: profile.specialty,
        address: {
          '@type': 'PostalAddress',
          addressLocality: profile.city,
          addressRegion: profile.state,
          addressCountry: 'BR',
        },
        ...(profile.avg_nps ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: profile.avg_nps,
            reviewCount: profile.review_count,
            bestRating: 10,
          },
        } : {}),
        ...(profile.photo_url ? { image: profile.photo_url } : {}),
      }),
    },
  };
}

export default async function VitrineProfilePage({ params }: Props) {
  const profile = await getVitrineBySlug(params.slug);
  if (!profile) notFound();

  // Log view event (fire-and-forget)
  logMarketingEvent(profile.tenant_id, 'vitrine_view', { slug: params.slug });

  const profLabel = PROFESSIONAL_TYPES[profile.professional_type as keyof typeof PROFESSIONAL_TYPES] ?? profile.professional_type;
  const npsDisplay = profile.avg_nps ? profile.avg_nps.toFixed(1) : null;

  return (
    <main className="min-h-screen bg-[#FAFAF7]">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-black/[0.06] p-8 mb-6">
          <div className="flex items-start gap-6">
            {profile.photo_url ? (
              <img
                src={profile.photo_url}
                alt={profile.display_name}
                className="w-24 h-24 rounded-2xl object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-[#F5F3FF] flex items-center justify-center text-3xl font-medium text-[#6E56CF]">
                {profile.display_name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">
                {profile.display_name}
              </h1>
              <p className="text-base text-zinc-500 mt-1">
                {profLabel} · {profile.specialty}
              </p>
              <p className="text-sm text-zinc-400 mt-0.5">
                📍 {profile.city}, {profile.state}
              </p>
              {npsDisplay && (
                <p className="text-sm mt-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                    ★ {npsDisplay} ({profile.review_count} avaliações)
                  </span>
                </p>
              )}
            </div>
          </div>

          {profile.bio && (
            <p className="mt-6 text-zinc-600 text-[15px] leading-relaxed">
              {profile.bio}
            </p>
          )}

          {profile.consultation_value && (
            <p className="mt-4 text-sm text-zinc-500">
              Consulta a partir de <span className="font-medium text-zinc-700">R$ {profile.consultation_value}</span>
            </p>
          )}
        </div>

        {/* CTA */}
        {profile.whatsapp_link && (
          <a
            href={profile.whatsapp_link}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-4 px-6 rounded-2xl text-white font-medium text-base"
            style={{ background: '#6E56CF' }}
          >
            📱 Agendar via WhatsApp
          </a>
        )}

        <p className="text-center text-xs text-zinc-400 mt-8">
          Perfil verificado por <a href="https://singulare.org" className="underline">Singulare</a>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create city+specialty listing page**

```tsx
// app/app/profissionais/[cidade]/[especialidade]/page.tsx

import { Metadata } from 'next';
import Link from 'next/link';
import { getPublishedVitrineProfiles } from '@/lib/marketing-queries';
import { PROFESSIONAL_TYPES } from '@/lib/types';

interface Props {
  params: { cidade: string; especialidade: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = decodeURIComponent(params.cidade).replace(/-/g, ' ');
  const specKey = params.especialidade;
  const specLabel = PROFESSIONAL_TYPES[specKey as keyof typeof PROFESSIONAL_TYPES] ?? specKey;

  const title = `${specLabel} em ${city} — Agende sua consulta | Singulare`;
  const description = `Encontre os melhores profissionais de ${specLabel.toLowerCase()} em ${city}. Avaliações verificadas e agendamento via WhatsApp.`;

  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function CitySpecialtyPage({ params }: Props) {
  const city = decodeURIComponent(params.cidade).replace(/-/g, ' ');
  const specKey = params.especialidade;
  const specLabel = PROFESSIONAL_TYPES[specKey as keyof typeof PROFESSIONAL_TYPES] ?? specKey;

  const profiles = await getPublishedVitrineProfiles(city, specKey);

  return (
    <main className="min-h-screen bg-[#FAFAF7]">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">
          {specLabel} em {city}
        </h1>
        <p className="text-zinc-500 mt-2 mb-8">
          {profiles.length} profissional{profiles.length !== 1 ? 'is' : ''} encontrado{profiles.length !== 1 ? 's' : ''}
        </p>

        <div className="space-y-4">
          {profiles.map((p) => (
            <Link
              key={p.slug}
              href={`/p/${p.slug}`}
              className="block bg-white rounded-2xl border border-black/[0.06] p-6 hover:border-[#6E56CF]/20 transition-colors"
            >
              <div className="flex items-center gap-4">
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.display_name} className="w-14 h-14 rounded-xl object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-[#F5F3FF] flex items-center justify-center text-xl font-medium text-[#6E56CF]">
                    {p.display_name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-medium text-zinc-900">{p.display_name}</h2>
                  <p className="text-sm text-zinc-500">{p.specialty}</p>
                </div>
                <div className="text-right">
                  {p.avg_nps && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                      ★ {p.avg_nps.toFixed(1)}
                    </span>
                  )}
                  {p.consultation_value && (
                    <p className="text-xs text-zinc-400 mt-1">a partir de R$ {p.consultation_value}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}

          {profiles.length === 0 && (
            <div className="text-center py-16 text-zinc-400">
              Nenhum profissional cadastrado nesta região ainda.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Create root directory page**

```tsx
// app/app/profissionais/page.tsx

import { Metadata } from 'next';
import Link from 'next/link';
import { PROFESSIONAL_TYPES } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Encontre seu profissional de saúde | Singulare',
  description: 'Diretório de profissionais de saúde com avaliações verificadas e agendamento via WhatsApp.',
};

export default function ProfissionaisRootPage() {
  const types = Object.entries(PROFESSIONAL_TYPES);

  return (
    <main className="min-h-screen bg-[#FAFAF7]">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">
          Encontre seu profissional de saúde
        </h1>
        <p className="text-zinc-500 mt-2 mb-8">
          Avaliações verificadas. Agendamento via WhatsApp.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {types.filter(([k]) => k !== 'outro').map(([key, label]) => (
            <Link
              key={key}
              href={`/profissionais/sao-paulo/${key}`}
              className="bg-white rounded-xl border border-black/[0.06] p-4 text-center hover:border-[#6E56CF]/20 transition-colors"
            >
              <p className="text-sm font-medium text-zinc-700">{label}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add app/app/api/vitrine/profiles/route.ts app/app/p/ app/app/profissionais/
git commit -m "feat(vitrine): add public profile pages with SEO metadata and JSON-LD"
```

---

### Task 6: Dynamic Sitemap for Vitrine Pages

**Files:**
- Modify: `app/app/sitemap.ts`

- [ ] **Step 1: Update sitemap to include vitrine profiles**

Replace the entire content of `app/app/sitemap.ts`:

```typescript
// app/app/sitemap.ts

import type { MetadataRoute } from 'next';
import { supabaseAdmin } from '@/lib/supabase';

const BASE_URL = 'https://app.singulare.org';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/v6.html`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/landing`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/onboarding`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/profissionais`, lastModified, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/login`, lastModified, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${BASE_URL}/termos`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/privacidade`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Dynamic vitrine profile pages
  let profilePages: MetadataRoute.Sitemap = [];
  try {
    const { data: profiles } = await supabaseAdmin()
      .from('vitrine_profiles')
      .select('slug, updated_at')
      .eq('published', true);

    profilePages = (profiles ?? []).map((p) => ({
      url: `${BASE_URL}/p/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));
  } catch {
    // Sitemap generation should not fail the build
  }

  return [...staticPages, ...profilePages];
}
```

- [ ] **Step 2: Commit**

```bash
git add app/app/sitemap.ts
git commit -m "feat(sitemap): add dynamic vitrine profile URLs"
```

---

### Task 7: Enable Marketing Nav in Painel

**Files:**
- Modify: `app/app/painel/layout.tsx:93`

- [ ] **Step 1: Change the Visibilidade nav item to enabled and point to /painel/marketing**

In `app/app/painel/layout.tsx`, find line 93:

```typescript
    { href: '/painel/visibilidade', label: 'Visibilidade', icon: <Megaphone className="w-4 h-4" />, enabled: false, hint: 'Tráfego pago e SEO' },
```

Replace with:

```typescript
    { href: '/painel/marketing', label: 'Marketing', icon: <Megaphone className="w-4 h-4" />, enabled: true },
```

- [ ] **Step 2: Commit**

```bash
git add app/app/painel/layout.tsx
git commit -m "feat(painel): enable Marketing nav item"
```

---

### Task 8: Marketing Dashboard Page

**Files:**
- Create: `app/app/painel/marketing/page.tsx`

- [ ] **Step 1: Create the marketing dashboard**

```tsx
// app/app/painel/marketing/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useMe } from '@/lib/painel-context';
import {
  Loader2, Star, RotateCcw, Eye, MousePointerClick, Megaphone,
  ExternalLink, Settings,
} from 'lucide-react';
import Link from 'next/link';

const ACCENT = '#6E56CF';
const ACCENT_SOFT = '#F5F3FF';

interface Metrics {
  review_requests_sent: number;
  reviews_completed: number;
  review_conversion_rate: number;
  recalls_sent: number;
  recalls_converted: number;
  recall_conversion_rate: number;
  vitrine_views: number;
  vitrine_whatsapp_clicks: number;
  posts_published: number;
}

interface Subscription {
  plan: string;
  status: string;
  google_review_url: string | null;
}

function MetricCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: ACCENT_SOFT }}>
          {icon}
        </div>
        <span className="text-sm text-zinc-500">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-zinc-900 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function MarketingPage() {
  const me = useMe();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [mRes, sRes] = await Promise.all([
          fetch('/api/painel/marketing/events?days=30'),
          fetch('/api/painel/marketing/subscription'),
        ]);
        const mJson = await mRes.json();
        const sJson = await sRes.json();
        if (mJson.success) setMetrics(mJson.metrics);
        if (sJson.success) setSub(sJson.subscription);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
      </div>
    );
  }

  // No subscription yet → show upsell
  if (!sub) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-6" style={{ background: ACCENT_SOFT }}>
          <Megaphone className="w-8 h-8" style={{ color: ACCENT }} />
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight mb-3">
          Singulare Marketing
        </h1>
        <p className="text-zinc-500 mb-8 max-w-md mx-auto">
          Automatize sua presença digital: colete avaliações no Google, reative pacientes inativos e apareça no topo das buscas — tudo no piloto automático.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 text-left max-w-lg mx-auto mb-8">
          {[
            'NPS → Google Review automático',
            'Recall de pacientes inativos',
            'Página SEO no diretório Singulare',
            'Dashboard de resultados',
          ].map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm text-zinc-600">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{ background: ACCENT_SOFT, color: ACCENT }}>✓</span>
              {f}
            </div>
          ))}
        </div>
        <Link
          href="/painel/marketing/configurar"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-medium text-sm"
          style={{ background: ACCENT }}
        >
          Ativar Presença — R$ 97/mês
        </Link>
        <p className="text-xs text-zinc-400 mt-3">7 dias grátis · Sem fidelidade</p>
      </div>
    );
  }

  const m = metrics ?? {
    review_requests_sent: 0, reviews_completed: 0, review_conversion_rate: 0,
    recalls_sent: 0, recalls_converted: 0, recall_conversion_rate: 0,
    vitrine_views: 0, vitrine_whatsapp_clicks: 0, posts_published: 0,
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight">Marketing</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Plano <span className="font-medium capitalize">{sub.plan}</span> · Últimos 30 dias
          </p>
        </div>
        <Link
          href="/painel/marketing/configurar"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-black/[0.06] text-sm text-zinc-600 hover:bg-zinc-50"
        >
          <Settings className="w-4 h-4" /> Configurar
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Reviews solicitados"
          value={m.review_requests_sent}
          icon={<Star className="w-4 h-4" style={{ color: ACCENT }} />}
          sub={`${m.reviews_completed} completados (${(m.review_conversion_rate * 100).toFixed(0)}%)`}
        />
        <MetricCard
          label="Recalls enviados"
          value={m.recalls_sent}
          icon={<RotateCcw className="w-4 h-4" style={{ color: ACCENT }} />}
          sub={`${m.recalls_converted} reagendaram (${(m.recall_conversion_rate * 100).toFixed(0)}%)`}
        />
        <MetricCard
          label="Visualizações vitrine"
          value={m.vitrine_views}
          icon={<Eye className="w-4 h-4" style={{ color: ACCENT }} />}
        />
        <MetricCard
          label="Cliques WhatsApp"
          value={m.vitrine_whatsapp_clicks}
          icon={<MousePointerClick className="w-4 h-4" style={{ color: ACCENT }} />}
        />
      </div>

      {/* Google Review Link */}
      {!sub.google_review_url && (
        <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-4 mb-6">
          <p className="text-sm text-amber-800">
            <strong>Configure seu link do Google Review</strong> para ativar a coleta automática de avaliações.{' '}
            <Link href="/painel/marketing/configurar" className="underline">Configurar agora →</Link>
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/app/painel/marketing/page.tsx
git commit -m "feat(painel): add marketing dashboard with metrics and upsell"
```

---

### Task 9: Marketing Settings Page

**Files:**
- Create: `app/app/painel/marketing/configurar/page.tsx`

- [ ] **Step 1: Create settings/configuration page**

```tsx
// app/app/painel/marketing/configurar/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft, Star, ExternalLink } from 'lucide-react';

const ACCENT = '#6E56CF';

export default function MarketingConfigurarPage() {
  const router = useRouter();
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [plan, setPlan] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/painel/marketing/subscription');
      const json = await res.json();
      if (json.subscription) {
        setPlan(json.subscription.plan);
        setGoogleReviewUrl(json.subscription.google_review_url ?? '');
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const method = plan ? 'PATCH' : 'POST';
      const body: Record<string, string> = { google_review_url: googleReviewUrl };
      if (!plan) body.plan = 'presenca';

      const res = await fetch('/api/painel/marketing/subscription', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setPlan(json.subscription.plan);
        setMessage('Salvo com sucesso!');
        setTimeout(() => router.push('/painel/marketing'), 1500);
      } else {
        setMessage('Erro: ' + json.message);
      }
    } catch {
      setMessage('Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <h1 className="text-2xl font-semibold text-zinc-900 tracking-tight mb-2">
        Configurar Marketing
      </h1>
      <p className="text-zinc-500 mb-8">
        Configure as automações de marketing do seu consultório.
      </p>

      {/* Google Review URL */}
      <div className="bg-white rounded-2xl border border-black/[0.06] p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-5 h-5" style={{ color: ACCENT }} />
          <h2 className="font-medium text-zinc-900">Link do Google Review</h2>
        </div>
        <p className="text-sm text-zinc-500 mb-4">
          Quando um paciente der NPS 9 ou 10, enviaremos automaticamente um convite para avaliar no Google.{' '}
          <a
            href="https://support.google.com/business/answer/7035772"
            target="_blank"
            rel="noopener noreferrer"
            className="underline inline-flex items-center gap-0.5"
          >
            Como encontrar seu link <ExternalLink className="w-3 h-3" />
          </a>
        </p>
        <input
          type="url"
          value={googleReviewUrl}
          onChange={(e) => setGoogleReviewUrl(e.target.value)}
          placeholder="https://g.page/r/..."
          className="w-full px-4 py-3 rounded-xl border border-black/[0.08] text-sm focus:outline-none focus:ring-2 focus:ring-[#6E56CF]/20"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl text-white font-medium text-sm disabled:opacity-50"
        style={{ background: ACCENT }}
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : plan ? 'Salvar configurações' : 'Ativar Presença — R$ 97/mês'}
      </button>

      {message && (
        <p className={`text-sm text-center mt-3 ${message.startsWith('Erro') ? 'text-red-600' : 'text-emerald-600'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/app/painel/marketing/configurar/page.tsx
git commit -m "feat(painel): add marketing settings page with Google Review URL config"
```

---

### Task 10: N8N Workflow — NPS → Google Review Request

**Files:**
- Create: `docs/n8n/marketing-nps-review.json`

This task documents the N8N workflow to build. It extends the existing NPS workflow.

- [ ] **Step 1: Document the workflow specification**

```markdown
## docs/n8n/marketing-nps-review.json

### Workflow: NPS → Google Review Request

**Trigger:** Webhook from existing NPS workflow (after patient responds with score 9-10).

**Nodes:**

1. **Webhook Trigger** — receives `{ tenant_id, patient_phone, patient_name, nps_score }`

2. **IF: Score >= 9** — filters only promoters

3. **Supabase Lookup** — query `marketing_subscriptions` where `tenant_id = input.tenant_id` AND `status = 'active'` AND `google_review_url IS NOT NULL`

4. **IF: Has subscription** — skip if no active marketing subscription

5. **Compose Message** — template:
   ```
   Que bom que gostou, {{ patient_name }}! 😊

   Sua opinião ajuda outros pacientes a encontrar bons profissionais.
   Avaliação rápida (30 segundos):

   {{ google_review_url }}

   Obrigado! 💜
   ```

6. **Send WhatsApp via Baileys/Evolution** — send message to `patient_phone`

7. **Log Event** — Supabase insert into `marketing_events`:
   `{ tenant_id, event_type: 'review_request_sent', metadata: { patient_phone, nps_score } }`

### Integration Point:
Add a new branch to the existing NPS response handler workflow (after score is saved).
When nps_score >= 9, HTTP Request node calls this webhook.

### Testing:
1. Manually trigger webhook with test payload
2. Verify WhatsApp message is sent
3. Verify marketing_events row is created
```

- [ ] **Step 2: Commit**

```bash
git add docs/n8n/marketing-nps-review.json
git commit -m "docs(n8n): add NPS → Google Review workflow specification"
```

---

### Task 11: N8N Workflow — Recall Inactive Patients

**Files:**
- Create: `docs/n8n/marketing-recall.json`

- [ ] **Step 1: Document the recall workflow specification**

```markdown
## docs/n8n/marketing-recall.json

### Workflow: Recall Inactive Patients

**Trigger:** Cron — every Monday at 10:00 BRT

**Nodes:**

1. **Cron Trigger** — weekly Monday 10:00

2. **Supabase Query: Active subscriptions** — query `marketing_subscriptions` where `status = 'active'`

3. **Loop: For each tenant**

4. **Supabase Query: Inactive patients** — SQL:
   ```sql
   SELECT DISTINCT p.name, p.phone
   FROM patients p
   JOIN appointments a ON a.patient_id = p.id
   JOIN tenant_doctors td ON a.doctor_id = td.id
   WHERE td.tenant_id = :tenant_id
   AND p.phone IS NOT NULL
   AND a.appointment_date = (
     SELECT MAX(a2.appointment_date)
     FROM appointments a2
     WHERE a2.patient_id = p.id
   )
   AND a.appointment_date < NOW() - INTERVAL '90 days'
   AND p.phone NOT IN (
     SELECT metadata->>'patient_phone'
     FROM marketing_events
     WHERE tenant_id = :tenant_id
     AND event_type = 'recall_sent'
     AND created_at > NOW() - INTERVAL '30 days'
   )
   LIMIT 10
   ```
   (Max 10 per tenant per week to avoid spam)

5. **Supabase Lookup: Tenant info** — get `clinic_name`, first `doctor_name` from `tenant_doctors`

6. **Gemini: Generate message** — prompt:
   ```
   Gere uma mensagem curta e carinhosa de recall para um paciente que
   não visita a clínica "{{ clinic_name }}" há mais de 3 meses.
   Nome do paciente: {{ patient_name }}.
   Nome do profissional: {{ doctor_name }}.
   Máximo 3 linhas. Tom acolhedor. Termine com convite para agendar.
   NÃO mencione valores, promoções ou descontos.
   NÃO faça promessas de resultado.
   ```

7. **Send WhatsApp** — send generated message to patient_phone

8. **Log Event** — insert into `marketing_events`:
   `{ tenant_id, event_type: 'recall_sent', metadata: { patient_phone, patient_name } }`

### Guardrails (CFM/CRO compliance):
- No prices, discounts, or promotions in recall messages
- No before/after claims
- No result guarantees
- Max 10 recalls per tenant per week
- 30-day cooldown per patient (dedupe via marketing_events)
```

- [ ] **Step 2: Commit**

```bash
git add docs/n8n/marketing-recall.json
git commit -m "docs(n8n): add recall inactive patients workflow specification"
```

---

## PHASE 2: SINGULARE SOCIAL (requires Meta App Review)

### Task 12: Apply for Meta App Review (parallel with Phase 1)

**Files:** None (external process)

- [ ] **Step 1: Document the Meta App Review checklist**

Before starting Phase 2 development, submit Meta App Review for these permissions:
1. `pages_manage_posts` — publish to Facebook Page
2. `instagram_basic` — read Instagram profile
3. `instagram_content_publish` — publish to Instagram Business
4. `pages_read_engagement` — read page insights

Requirements:
- Privacy Policy URL: `https://app.singulare.org/privacidade`
- Terms of Service URL: `https://app.singulare.org/termos`
- App verification: business verification via Meta Business Manager
- Screencast demo showing the feature in action (record marketing dashboard + post preview)
- Data Handling Declaration

Estimated review time: 2-4 weeks.

---

### Task 13: Instagram OAuth Flow

**Files:**
- Create: `app/app/api/painel/marketing/oauth/instagram/route.ts`

- [ ] **Step 1: Create Instagram OAuth callback handler**

```typescript
// app/app/api/painel/marketing/oauth/instagram/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';
import { encryptString } from '@/lib/crypto';

const META_APP_ID = process.env.META_APP_ID!;
const META_APP_SECRET = process.env.META_APP_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/painel/marketing/oauth/instagram`;

// GET: handle OAuth callback from Meta
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    // Step 1: redirect to Meta OAuth
    const auth = await requireTenant();
    if (!auth.ok) return auth.response;

    const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    authUrl.searchParams.set('client_id', META_APP_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('scope', 'pages_manage_posts,instagram_basic,instagram_content_publish,pages_read_engagement');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', auth.ctx.tenant.tenant_id);

    return NextResponse.redirect(authUrl.toString());
  }

  // Step 2: exchange code for token
  const state = req.nextUrl.searchParams.get('state') ?? '';
  const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  tokenUrl.searchParams.set('client_id', META_APP_ID);
  tokenUrl.searchParams.set('client_secret', META_APP_SECRET);
  tokenUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  tokenUrl.searchParams.set('code', code);

  const tokenRes = await fetch(tokenUrl.toString());
  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    return NextResponse.redirect('/painel/marketing/configurar?error=oauth_failed');
  }

  // Step 3: exchange for long-lived token (60 days)
  const llUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  llUrl.searchParams.set('grant_type', 'fb_exchange_token');
  llUrl.searchParams.set('client_id', META_APP_ID);
  llUrl.searchParams.set('client_secret', META_APP_SECRET);
  llUrl.searchParams.set('fb_exchange_token', tokenData.access_token);

  const llRes = await fetch(llUrl.toString());
  const llData = await llRes.json();
  const longLivedToken = llData.access_token ?? tokenData.access_token;

  // Step 4: get pages and find Instagram Business Account
  const pagesRes = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?access_token=${longLivedToken}`
  );
  const pagesData = await pagesRes.json();
  const page = pagesData.data?.[0]; // first page

  // Step 5: store encrypted token
  const encrypted = encryptString(longLivedToken);

  await supabaseAdmin()
    .from('marketing_subscriptions')
    .update({
      instagram_token_enc: encrypted,
      facebook_page_id: page?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', state);

  return NextResponse.redirect('/painel/marketing/configurar?connected=instagram');
}
```

- [ ] **Step 2: Commit**

```bash
git add app/app/api/painel/marketing/oauth/instagram/route.ts
git commit -m "feat(marketing): add Instagram OAuth flow with encrypted token storage"
```

---

### Task 14: N8N Workflow — Social Media Auto-Post

**Files:**
- Create: `docs/n8n/marketing-social-post.json`

- [ ] **Step 1: Document the social post workflow**

```markdown
## docs/n8n/marketing-social-post.json

### Workflow: Auto-Post to Instagram + Facebook

**Trigger:** Cron — every Tuesday and Friday at 11:00 BRT

**Nodes:**

1. **Cron Trigger** — Tue/Fri 11:00

2. **Supabase Query** — get tenants with `plan IN ('social', 'ads')` AND `instagram_token_enc IS NOT NULL`

3. **Loop: For each tenant**

4. **Decrypt Token** — HTTP Request to internal API to decrypt token

5. **Supabase: Get tenant info** — specialty, clinic_name, doctor_name, city

6. **Gemini: Generate post content** — prompt:
   ```
   Você é um social media manager para {{ clinic_name }}, uma clínica de {{ specialty }} em {{ city }}.
   Gere um post educativo curto para Instagram (máximo 150 palavras).
   
   REGRAS OBRIGATÓRIAS:
   - Conteúdo educativo sobre {{ specialty }}
   - NÃO mencione preços, promoções ou descontos
   - NÃO faça promessas de resultado ("garante", "cura", "resolve")
   - NÃO use imagens de antes/depois
   - NÃO mencione medicamentos específicos
   - Tom profissional e acolhedor
   - Inclua 5-8 hashtags relevantes ao final
   - Inclua call-to-action suave ("Agende sua avaliação")
   
   Retorne JSON: { "caption": "...", "hashtags": "..." }
   ```

7. **Generate Image** — HTTP Request to Creatomate API:
   - Use template ID for the specialty
   - Overlay text: first line of caption
   - Brand color: #6E56CF

8. **Publish to Instagram** — HTTP Request to Graph API:
   ```
   POST https://graph.facebook.com/v21.0/{ig-user-id}/media
   { image_url, caption }
   
   POST https://graph.facebook.com/v21.0/{ig-user-id}/media_publish
   { creation_id }
   ```

9. **Publish to Facebook Page** — HTTP Request to Graph API:
   ```
   POST https://graph.facebook.com/v21.0/{page-id}/photos
   { url: image_url, message: caption, access_token }
   ```

10. **Log Event** — insert `post_published` into marketing_events

### Creatomate Templates Needed (one-time setup):
- Template per specialty (12 total) with brand colors
- Dynamic text overlay + background image slot
- Estimated cost: ~$29/month Creatomate subscription
```

- [ ] **Step 2: Commit**

```bash
git add docs/n8n/marketing-social-post.json
git commit -m "docs(n8n): add Instagram/Facebook auto-post workflow specification"
```

---

## PHASE 3: SINGULARE ADS (requires Google Ads API Standard Access)

### Task 15: Apply for Google Ads API Standard Access (parallel)

**Files:** None (external process)

- [ ] **Step 1: Document the Google Ads API application checklist**

1. Create MCC (Manager Account) at ads.google.com/home/tools/manager-accounts/
2. Apply for Developer Token → Standard Access
3. Complete OAuth consent screen verification
4. Required info: company name, website, use case description
5. Demonstrate automated campaign creation use case
6. Estimated approval: 1-4 weeks

---

### Task 16: N8N Workflow — Google Ads Campaign Sync

**Files:**
- Create: `docs/n8n/marketing-ads-sync.json`

- [ ] **Step 1: Document the Ads sync workflow**

```markdown
## docs/n8n/marketing-ads-sync.json

### Workflow: Google Ads ↔ Agenda Sync

**Trigger:** Cron — every 2 hours (Mon-Sat 8:00-20:00)

**Nodes:**

1. **Cron Trigger** — every 2h during business hours

2. **Supabase Query** — get tenants with `plan = 'ads'` AND `google_ads_customer_id IS NOT NULL`

3. **Loop: For each tenant**

4. **Check Agenda Availability** — Supabase query:
   ```sql
   SELECT COUNT(*) as open_slots
   FROM generate_series(
     NOW(),
     NOW() + INTERVAL '7 days',
     INTERVAL '30 minutes'
   ) AS slot(t)
   WHERE NOT EXISTS (
     SELECT 1 FROM appointments a
     JOIN tenant_doctors td ON a.doctor_id = td.id
     WHERE td.tenant_id = :tenant_id
     AND a.appointment_date BETWEEN slot.t AND slot.t + INTERVAL '30 minutes'
     AND a.status NOT IN ('cancelled', 'no_show')
   )
   ```

5. **Decision: Pause or Resume**
   - If `open_slots < 5` → Pause campaign (agenda almost full)
   - If `open_slots >= 10` → Resume campaign (needs patients)
   - Between 5-10 → no change

6. **Google Ads API** — update campaign status:
   ```
   PATCH campaigns/{campaign_id}
   { status: 'ENABLED' | 'PAUSED' }
   ```

7. **Log Event** — `ad_impression` or status change in marketing_events

### Campaign Setup (one-time per tenant):
1. Create sub-account via MCC API
2. Create Search campaign:
   - Budget: tenant-defined (default R$30/day)
   - Keywords: "[specialty] [city]", "[specialty] perto de mim", "agendar [specialty] [city]"
   - Ad copy generated by Gemini (responsive search ad)
   - Landing page: vitrine profile /p/[slug]
   - Bidding: Maximize Conversions
   - Location: city + 20km radius
3. Set up conversion tracking (WhatsApp click = conversion)
```

- [ ] **Step 2: Commit**

```bash
git add docs/n8n/marketing-ads-sync.json
git commit -m "docs(n8n): add Google Ads agenda sync workflow specification"
```

---

## PHASE 4: Polish & Integration

### Task 17: Update Landing Page with Marketing Add-ons

**Files:**
- Modify: `app/public/v6.html`

- [ ] **Step 1: Add marketing add-on section to landing page**

After the existing "Singulare Atendimento" add-on section in `v6.html`, add a second add-on card for Marketing. Use the same visual pattern (`.addon-sec` class):

```html
<div class="addon-sec reveal" style="max-width:720px;margin:32px auto 0;background:var(--s-100);border-radius:22px;padding:40px 36px;border:1.5px solid rgba(110,86,207,.12)">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
    <span style="font-size:1.5rem">📈</span>
    <h3 style="margin:0;font-size:1.25rem;font-weight:600;color:var(--s-900)">Singulare Marketing</h3>
    <span style="background:var(--s-500);color:#fff;font-size:.7rem;padding:3px 10px;border-radius:99px;font-weight:600">NOVO</span>
  </div>
  <p style="color:var(--s-700);font-size:.95rem;line-height:1.6;margin-bottom:18px">
    Sua presença digital no piloto automático. A mesma IA que atende seus pacientes agora faz seu marketing.
  </p>
  <ul style="list-style:none;padding:0;margin:0 0 20px;display:grid;gap:8px">
    <li style="display:flex;align-items:center;gap:8px;font-size:.9rem;color:var(--s-700)"><span style="color:var(--s-500)">✓</span> Avaliações 5★ no Google coletadas automaticamente</li>
    <li style="display:flex;align-items:center;gap:8px;font-size:.9rem;color:var(--s-700)"><span style="color:var(--s-500)">✓</span> Reativação de pacientes inativos</li>
    <li style="display:flex;align-items:center;gap:8px;font-size:.9rem;color:var(--s-700)"><span style="color:var(--s-500)">✓</span> Página SEO no diretório Singulare</li>
    <li style="display:flex;align-items:center;gap:8px;font-size:.9rem;color:var(--s-700)"><span style="color:var(--s-500)">✓</span> Dashboard de resultados</li>
  </ul>
  <p style="font-size:1.1rem;font-weight:600;color:var(--s-900)">A partir de R$ 97<span style="font-size:.8rem;font-weight:400;color:var(--s-500)">/mês</span></p>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add app/public/v6.html
git commit -m "feat(landing): add Singulare Marketing add-on section"
```

---

### Task 18: Verify and Smoke Test

- [ ] **Step 1: Run TypeScript check**

```bash
cd /Users/luizflavioxavierdesa/Desktop/vivassit/app && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Run dev server and verify pages**

```bash
cd /Users/luizflavioxavierdesa/Desktop/vivassit/app && npm run dev
```

Test URLs:
- `http://localhost:3000/profissionais` → should show directory
- `http://localhost:3000/painel/marketing` → should show upsell (no subscription)
- `http://localhost:3000/painel/marketing/configurar` → should show settings form

- [ ] **Step 3: Verify DB tables exist**

In Supabase SQL Editor:
```sql
SELECT * FROM marketing_subscriptions LIMIT 1;
SELECT * FROM marketing_events LIMIT 1;
SELECT * FROM vitrine_profiles LIMIT 1;
```

Expected: empty results, no errors (tables exist).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: verify marketing add-ons Phase 1 complete"
```

---

## Summary

| Phase | Tasks | Hours | Dependency |
|---|---|---|---|
| **1: Presença** | Tasks 1-11 | ~45h | None |
| **2: Social** | Tasks 12-14 | ~35h | Meta App Review |
| **3: Ads** | Tasks 15-16 | ~30h | Google Ads API |
| **4: Polish** | Tasks 17-18 | ~10h | Phase 1 |
| **Parallel** | Apply Meta + Google | 2h | Start ASAP |
| **Total** | 18 tasks | ~120h | |
