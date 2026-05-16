-- Adiciona flag addon_marketing em tenants.
-- Quando true (ou plan_type = 'enterprise', que ja inclui marketing por
-- padrao), o tenant pode publicar a pagina /p/[slug] da vitrine.
--
-- Backfill: tenants enterprise existentes ja recebem true (pra nao quebrar
-- vitrines publicadas antes do gate).
-- Nao destrutivo: IF NOT EXISTS, default false.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS addon_marketing boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tenants.addon_marketing IS
  'Add-on Marketing ativo (publicacao na vitrine, ranking no Google). Enterprise inclui por padrao.';

-- Backfill: enterprise ja vem com marketing incluso
UPDATE public.tenants
  SET addon_marketing = true
  WHERE plan_type = 'enterprise' AND addon_marketing = false;
