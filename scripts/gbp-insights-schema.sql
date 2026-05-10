-- scripts/gbp-insights-schema.sql
-- Google Business Profile (GBP) Insights — armazena snapshots mensais por tenant.
-- Métricas: views (search/maps), calls, direction requests, website clicks, posts views.
-- Fonte: businessprofileperformance.googleapis.com (POST :fetchMultiDailyMetricsTimeSeries).
-- Refresh: cron mensal + botão manual no painel. Append-only (1 row por refresh) → trends.

BEGIN;

-- 1. Histórico de snapshots GBP
CREATE TABLE IF NOT EXISTS public.tenant_gbp_insights_history (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id     varchar NOT NULL REFERENCES public.tenants(tenant_id) ON DELETE CASCADE,
  payload       jsonb   NOT NULL,
  collected_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gbp_insights_tenant_collected
  ON public.tenant_gbp_insights_history (tenant_id, collected_at DESC);

-- 2. Campos OAuth GBP em marketing_subscriptions (idempotente)
ALTER TABLE public.marketing_subscriptions
  ADD COLUMN IF NOT EXISTS gbp_refresh_token_enc text,
  ADD COLUMN IF NOT EXISTS gbp_account_id        text,
  ADD COLUMN IF NOT EXISTS gbp_location_id       text,
  ADD COLUMN IF NOT EXISTS gbp_location_name     text,
  ADD COLUMN IF NOT EXISTS gbp_connected_at      timestamptz;

COMMIT;
