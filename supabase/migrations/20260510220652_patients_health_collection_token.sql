-- Token unico por paciente pra coleta de dados de saude via link publico.
-- Clinica gera o token e envia o link https://singulare.org/saude/<token> via WhatsApp.
-- Paciente acessa, preenche vitals (FC, PA, peso, etc) e a pagina insere
-- em health_observations via endpoint publico que valida o token.
-- Sem login. Token revogavel (clinica regenera via painel).
alter table public.patients
  add column if not exists health_collection_token uuid unique;

comment on column public.patients.health_collection_token is
  'UUID secreto pra link publico de coleta /saude/<token>. Clinica gera via /api/painel/pacientes/[id]/collection-token. Regenerar revoga link antigo.';
