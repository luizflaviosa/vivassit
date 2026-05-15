-- T1 do MVP Seguimento de Tratamento
-- docs/plans/seguimento-tratamento-spec-mvp.md
--
-- Expande CHECK de category pra suportar coleta ativa (WhatsApp + protocolos):
--   patient-reported = resposta livre do paciente (sintoma, peso, PA self-report)
--   survey           = item de questionario validado (MMAS-8, KCCQ-12)
--
-- Forward-compatible: existing values (vital-signs, activity, sleep, laboratory)
-- continuam aceitos. Dados em prod confirmados como: activity=30, vital-signs=17,
-- laboratory=1 — todos sobrevivem.

alter table public.health_observations
  drop constraint if exists health_observations_category_check;

alter table public.health_observations
  add constraint health_observations_category_check
  check (category in (
    'vital-signs',
    'activity',
    'sleep',
    'laboratory',
    'patient-reported',
    'survey'
  ));

comment on column public.health_observations.category is
  'vital-signs|activity|sleep|laboratory = passivo (ingest-vitals, ios_shortcut, manual web). '
  'patient-reported|survey = ativo (whatsapp via P04 ou perguntas do protocolo na pagina /saude/[token]).';
