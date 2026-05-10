# Singulare — Google Ads API Tool Design Document

**Submitted to**: Google Ads API Access Review
**Manager Account (MCC) ID**: 131-855-2890
**Application date**: 2026-05-09
**Tool name**: Singulare Marketing Intelligence

---

## 1. Company & Tool Overview

**Singulare** is a B2B SaaS platform for medical clinics in Brazil. We provide a unified dashboard combining clinic operations (appointment management, patient communications via WhatsApp, electronic medical documents, automated patient review collection via NPS) and marketing intelligence (online presence score, social media post generation, search demand insights for the clinic's medical specialty within its city/region).

Our typical user is a medical clinic owner or manager — non-technical healthcare professional. We currently serve approximately 50–200 clinics, with steady growth.

**Application URL**: `https://app.singulare.org`
**Privacy policy**: `https://app.singulare.org/privacidade`
**Terms of service**: `https://app.singulare.org/termos`

---

## 2. Purpose of Google Ads API Access

We will use **only** the Keyword Plan Idea Service of the Google Ads API to provide aggregated, regional search-volume insights to our medical-clinic customers as part of a "Market Intelligence" feature in their dashboard.

We are **not** building an advertising campaign management tool. We will not create, modify, pause, resume, or report on Google Ads campaigns via the API.

### 2.1 Methods used

- `KeywordPlanIdeaService.generateKeywordIdeas`
- `KeywordPlanIdeaService.generateKeywordHistoricalMetrics`
- `CustomerService.listAccessibleCustomers` (sanity checks only)

### 2.2 Data fields consumed

For each keyword:
- `avgMonthlySearches`
- `lowTopOfPageBidMicros` / `highTopOfPageBidMicros` (CPC range)
- `competition`, `competitionIndex`
- `monthlySearchVolumes` (for trend visualization)

---

## 3. User-Facing Feature

In the customer dashboard, the user (clinic owner/manager) sees a card titled **"Oportunidade na sua região"** that displays:

- Number of monthly searches in their city for their specialty (e.g., "1,400 searches/month for 'reumatologista' in Jundiaí")
- Average CPC range
- Top related queries with volume

This is **read-only display**. There is no UI that triggers Google Ads campaigns or modifies any campaign data.

The clinic owner uses this data to inform their content/marketing strategy — for example, deciding to publish blog posts about high-volume conditions or to evaluate whether running paid ads is worthwhile (campaigns themselves are managed by the clinic separately, outside our platform).

---

## 4. Architecture and Data Flow

### 4.1 Authentication

- OAuth 2.0 server-to-server flow
- Single refresh token (stored as encrypted environment variable on Vercel)
- Token belongs to the Singulare admin Google account that has access to the Manager (131-855-2890)
- Each API request includes:
  - `Authorization: Bearer <access_token>` (refreshed as needed)
  - `developer-token: <approved-developer-token>`
  - `login-customer-id: 1318552890` (Manager)

### 4.2 Server architecture

- Backend: Next.js 14 deployed on Vercel
- Database: Supabase Postgres
- All Google Ads API calls are made server-side from `lib/google-ads.ts` helpers
- No client-side calls to Google Ads API

### 4.3 Caching

To minimize API call volume:
- API responses cached in `tenant_region_demand_cache` table (Postgres) with 30-day TTL
- A monthly Vercel cron job refreshes data for all active tenants
- Manual refresh available via "atualizar" button (admin role only) — bounded by 30-day TTL anyway

### 4.4 Rate-limit and quota plan

- Estimated volume: <1,000 API operations per day
- Concurrency limit: 3 parallel requests
- Exponential backoff on rate-limit errors (429) and transient errors (500/503)

---

## 5. Data Storage and Privacy

- API responses are cached in our Supabase Postgres database with row-level security
- Data is associated with `tenant_id` (clinic ID), not with patient or doctor PII
- Keywords queried are medical-specialty terms — not patient-specific or commercially sensitive
- We do not share Google Ads API data with third parties
- We do not combine Google Ads API data with personally identifiable information of patients
- Privacy policy: https://app.singulare.org/privacidade
- Compliance with Brazilian LGPD (Lei Geral de Proteção de Dados)

---

## 6. Compliance with Google Ads API Policies

We commit to:
- **Required Minimum Functionality (RMF)**: while we do not build a campaign management tool, our use of read-only Keyword Planner is consistent with the Allowed Use Cases policy
- **Google Ads API Terms of Service**: full compliance
- **Privacy & Security**: data encrypted in transit (HTTPS), refresh tokens stored in encrypted env-var system (Vercel)
- **No prohibited use cases**: no scraping, no automation that violates Google policies, no resale of API data

---

## 7. Access Control

- The Google Ads API token is used **only** by Singulare's server backend, not exposed to end users
- Clinic users (external) view aggregated insights through Singulare's dashboard
- Internal access to environment variables and tokens is limited to Singulare administrators

---

## 8. Future Plans (no API expansion planned)

We have **no current plans** to:
- Manage Google Ads campaigns via the API
- Use App Conversion Tracking or Remarketing
- Resell, repackage, or grant external developers access to our token

If we expand to campaign management in the future, we will submit a new application with updated documentation.

---

## 9. Contact

- API contact email: api@singulare.org (or singulareempresa@gmail.com)
- Manager Account (MCC) ID: 131-855-2890
- Singulare admin: Luiz Flavio Xavier de Sá

---

*End of design document.*
