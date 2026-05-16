-- Adiciona consentimento LGPD na publicacao da vitrine.
-- Quando o medico aperta "Publicar pagina" pela primeira vez, gravamos
-- timestamp + IP pra auditoria. Nao destrutivo, nao altera tipos.

ALTER TABLE public.vitrine_profiles
  ADD COLUMN IF NOT EXISTS lgpd_consent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS lgpd_consent_ip  text;

COMMENT ON COLUMN public.vitrine_profiles.lgpd_consent_at IS
  'Quando o profissional consentiu explicitamente em publicar o perfil (LGPD).';
COMMENT ON COLUMN public.vitrine_profiles.lgpd_consent_ip IS
  'IP do request que registrou o consentimento de publicacao.';
