-- Rook integration: vinculacao 1:1 paciente <-> usuario Rook + timestamps de
-- onboarding/conexao pra rastrear ciclo de vida do convite.

alter table public.patients
  add column if not exists rook_user_id text unique,
  add column if not exists rook_invited_at timestamptz,
  add column if not exists rook_connected_at timestamptz;

comment on column public.patients.rook_user_id is
  'Identificador usado no Rook (formato: singulare_pat_<id>). Unique pra evitar reuso entre pacientes.';
comment on column public.patients.rook_invited_at is
  'Quando o link de conexao Rook foi enviado via WhatsApp.';
comment on column public.patients.rook_connected_at is
  'Quando o primeiro webhook do Rook chegou (paciente concluiu onboarding no Extraction App).';
