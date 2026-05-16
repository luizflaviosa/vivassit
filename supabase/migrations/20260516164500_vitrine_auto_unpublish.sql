-- Auto-despublica vitrine_profiles quando o tenant perde direito de publicar:
--   1. subscription_status passa pra 'canceled', OU
--   2. addon_marketing vira false (e plan_type nao eh enterprise)
--
-- Roda como trigger AFTER UPDATE em tenants — mais robusto que checar
-- isso no app, porque qualquer caminho (webhook Asaas, cron, painel admin,
-- SQL manual) acaba passando aqui.

ALTER TABLE public.vitrine_profiles
  ADD COLUMN IF NOT EXISTS unpublished_reason text;

COMMENT ON COLUMN public.vitrine_profiles.unpublished_reason IS
  'Motivo da ultima despublicacao automatica (ex: subscription_canceled, addon_removed). NULL se foi acao manual do usuario.';

CREATE OR REPLACE FUNCTION public.unpublish_vitrine_on_billing_change()
RETURNS TRIGGER AS $$
DECLARE
  reason text;
  loses_publish boolean := false;
BEGIN
  -- Cancelou assinatura
  IF (OLD.subscription_status IS DISTINCT FROM NEW.subscription_status)
     AND NEW.subscription_status = 'canceled'
  THEN
    reason := 'subscription_canceled';
    loses_publish := true;
  END IF;

  -- Removeu addon (e nao tem fallback enterprise)
  IF NOT loses_publish
     AND OLD.addon_marketing = true
     AND NEW.addon_marketing = false
     AND COALESCE(NEW.plan_type, '') <> 'enterprise'
  THEN
    reason := 'addon_removed';
    loses_publish := true;
  END IF;

  -- Trocou enterprise pra outro plano e nao tem addon_marketing avulso
  IF NOT loses_publish
     AND OLD.plan_type = 'enterprise'
     AND NEW.plan_type IS DISTINCT FROM 'enterprise'
     AND COALESCE(NEW.addon_marketing, false) = false
  THEN
    reason := 'downgrade';
    loses_publish := true;
  END IF;

  IF loses_publish THEN
    UPDATE public.vitrine_profiles
       SET published = false,
           unpublished_reason = reason,
           updated_at = now()
     WHERE tenant_id = NEW.tenant_id
       AND published = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.unpublish_vitrine_on_billing_change() IS
  'Auto-despublica vitrine_profiles quando tenant perde acesso (cancelamento, remocao de addon_marketing, downgrade de enterprise).';

DROP TRIGGER IF EXISTS tr_unpublish_vitrine_on_billing_change ON public.tenants;

CREATE TRIGGER tr_unpublish_vitrine_on_billing_change
AFTER UPDATE OF subscription_status, addon_marketing, plan_type ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.unpublish_vitrine_on_billing_change();
