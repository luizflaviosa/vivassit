-- tenants.connect_token: token publico (uuid) usado em /conectar/[token]
-- pra cliente recem-cadastrado abrir o QR do WhatsApp sem precisar fazer login.
-- Backfill nao e necessario; tenants antigos nao tem token, mas seguem usando o
-- magic_link normal. Onboardings novos geram o token na criacao.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS connect_token text;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_connect_token_key
  ON public.tenants (connect_token)
  WHERE connect_token IS NOT NULL;

COMMENT ON COLUMN public.tenants.connect_token IS
  'UUID gerado no onboarding pra montar a URL publica /conectar/<token> que mostra o QR do WhatsApp sem login. Distinto de magic_link (que requer ate certo ponto auth).';
