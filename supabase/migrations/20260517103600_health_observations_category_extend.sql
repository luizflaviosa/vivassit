-- Expande o CHECK de health_observations.category pra aceitar coleta ativa
-- (respostas autorrelatadas do paciente via WhatsApp ou perguntas do protocolo).
-- Tabela existente em prod com poucas linhas; alteracao aditiva e segura.
--
-- Antes: ('vital-signs','activity','sleep','laboratory')
-- Depois: + ('patient-reported','survey')

alter table public.health_observations
  drop constraint if exists health_observations_category_check;

alter table public.health_observations
  add constraint health_observations_category_check
  check (category in (
    'vital-signs','activity','sleep','laboratory',
    'patient-reported','survey'
  ));

comment on column public.health_observations.category is
  'vital-signs|activity|sleep|laboratory = passivo (ingest-vitals, ios_shortcut, manual web). '
  'patient-reported|survey = ativo (whatsapp via P04 ou perguntas do protocolo na pagina /saude/[token]).';
