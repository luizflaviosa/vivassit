-- Vitrine: campos pra conteudo gerado por IA.
-- faqs = perguntas frequentes (max 10) no formato [{q, a}]
-- ai_generated_at = quando bio + FAQs foram geradas pela ultima vez (pra
-- mostrar disclaimer "revise antes de publicar" e habilitar botao re-gerar).
-- Nao destrutivo: tudo IF NOT EXISTS, defaults seguros.

ALTER TABLE public.vitrine_profiles
  ADD COLUMN IF NOT EXISTS faqs              jsonb       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_generated_at   timestamptz;

COMMENT ON COLUMN public.vitrine_profiles.faqs IS
  'FAQs da pagina publica, array [{q: text, a: text}]. Gerado por IA no onboarding e editavel pelo profissional.';
COMMENT ON COLUMN public.vitrine_profiles.ai_generated_at IS
  'Quando bio/FAQs foram gerados por IA pela ultima vez. NULL se nunca gerado ou se profissional editou tudo manualmente.';
