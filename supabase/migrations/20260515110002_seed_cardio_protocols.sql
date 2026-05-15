-- T3 do MVP Seguimento de Tratamento
-- docs/plans/seguimento-tratamento-spec-mvp.md
--
-- Seed dos 5 templates cardio globais (tenant_id null):
--   1. hipertenso     (HAS estavel)
--   2. pos-iam        (pos-infarto)
--   3. icc            (insuficiencia cardiaca cronica)
--   4. fa             (fibrilacao atrial)
--   5. dislipidemia   (controle lipidico)
--
-- Cada protocolo tem 4-6 perguntas semanais (cadence_days=7, duration_weeks=12).
-- dedup_loinc_codes evita gravar self-report se ja houver passive (HealthKit/Health Connect)
-- da mesma metrica na janela — protege contra duplicidade.
-- alert_thresholds em jsonb, avaliado pela edge fn trigger-alert.
--
-- LOINC codes: padrao oficial onde existe; singulare:* pra metricas custom.

-- ====================================================================
-- 1. HIPERTENSO (HAS estavel)
-- ====================================================================

with p as (
  insert into public.treatment_protocols
    (tenant_id, specialty, slug, name, description, duration_weeks, cadence_days)
  values
    (null, 'cardiologia', 'hipertenso', 'Hipertensao Arterial Sistemica',
     'Seguimento de paciente com HAS estavel.', 12, 7)
  returning id
)
insert into public.protocol_questions
  (protocol_id, ordering, kind, prompt_pt, loinc_code, expected_unit,
   dedup_loinc_codes, alert_thresholds)
select p.id, ordering, kind, prompt_pt, loinc_code, expected_unit,
       dedup_loinc_codes, alert_thresholds::jsonb
from p, (values
  (1, 'adherence_mmas8',      'Voce tomou seus remedios todos os dias dessa semana?',
      '71799-1',                  null::text,    '{}'::text[],
      '{"yellow":"missed_days >= 2","red":"missed_days >= 4"}'),
  (2, 'pa_self_report',       'Mediu sua pressao essa semana? Qual foi a maior?',
      'singulare:pa-self',        'mmHg',        '{"8480-6","8462-4"}'::text[],
      '{"yellow":"sbp >= 160 or dbp >= 100","red":"sbp >= 180 or dbp >= 110"}'),
  (3, 'symptom_keyword',      'Sentiu dor no peito, falta de ar ou tontura forte?',
      'singulare:symptom-cardio', '',            '{}'::text[],
      '{"red":"answer = yes"}'),
  (4, 'activity_self_report', 'Quantas vezes voce caminhou ou se exercitou?',
      'singulare:activity-self',  'sessoes/sem', '{"55423-8","41950-7"}'::text[],
      '{"yellow":"sessions < 2"}'),
  (5, 'weight_self_report',   'Qual seu peso atual?',
      '29463-7',                  'kg',          '{}'::text[],
      '{"yellow":"delta_kg_4wk >= 2"}')
) as q(ordering, kind, prompt_pt, loinc_code, expected_unit,
       dedup_loinc_codes, alert_thresholds);

-- ====================================================================
-- 2. POS-IAM (pos-infarto do miocardio)
-- ====================================================================

with p as (
  insert into public.treatment_protocols
    (tenant_id, specialty, slug, name, description, duration_weeks, cadence_days)
  values
    (null, 'cardiologia', 'pos-iam', 'Pos-Infarto Agudo do Miocardio',
     'Seguimento dos primeiros 12 meses pos-IAM. Foco em adherence aa terapia '
     'quadrupla (AAS + beta-bloqueador + IECA/BRA + estatina) e detecção precoce '
     'de re-IAM/angina.', 12, 7)
  returning id
)
insert into public.protocol_questions
  (protocol_id, ordering, kind, prompt_pt, loinc_code, expected_unit,
   dedup_loinc_codes, alert_thresholds)
select p.id, ordering, kind, prompt_pt, loinc_code, expected_unit,
       dedup_loinc_codes, alert_thresholds::jsonb
from p, (values
  (1, 'adherence_mmas8',      'Voce tomou TODOS os remedios do coracao essa semana? (AAS, beta-bloqueador, estatina, IECA)',
      '71799-1',                  null::text,    '{}'::text[],
      '{"yellow":"missed_days >= 1","red":"missed_days >= 3"}'),
  (2, 'symptom_keyword',      'Sentiu dor ou aperto no peito, falta de ar em repouso ou suor frio?',
      'singulare:symptom-cardio', '',            '{}'::text[],
      '{"red":"answer = yes"}'),
  (3, 'pa_self_report',       'Mediu sua pressao essa semana? Qual foi a maior?',
      'singulare:pa-self',        'mmHg',        '{"8480-6","8462-4"}'::text[],
      '{"yellow":"sbp >= 140 or dbp >= 90","red":"sbp >= 160 or dbp >= 100"}'),
  (4, 'activity_self_report', 'Conseguiu fazer reabilitacao ou caminhadas? Quantas vezes?',
      'singulare:activity-self',  'sessoes/sem', '{"55423-8","41950-7"}'::text[],
      '{"yellow":"sessions < 2"}'),
  (5, 'weight_self_report',   'Qual seu peso atual?',
      '29463-7',                  'kg',          '{}'::text[],
      '{"yellow":"delta_kg_4wk >= 3"}'),
  (6, 'satisfaction',         'Numa escala de 0 a 10, como esta se sentindo essa semana?',
      'singulare:satisfaction',   'escore',      '{}'::text[],
      '{"yellow":"score <= 5","red":"score <= 3"}')
) as q(ordering, kind, prompt_pt, loinc_code, expected_unit,
       dedup_loinc_codes, alert_thresholds);

-- ====================================================================
-- 3. ICC (Insuficiencia Cardiaca Cronica)
-- ====================================================================

with p as (
  insert into public.treatment_protocols
    (tenant_id, specialty, slug, name, description, duration_weeks, cadence_days)
  values
    (null, 'cardiologia', 'icc', 'Insuficiencia Cardiaca Cronica',
     'Seguimento de paciente com IC cronica (FE reduzida ou preservada). '
     'Peso diario e sintomas de descompensacao sao prioridade.', 12, 7)
  returning id
)
insert into public.protocol_questions
  (protocol_id, ordering, kind, prompt_pt, loinc_code, expected_unit,
   dedup_loinc_codes, alert_thresholds)
select p.id, ordering, kind, prompt_pt, loinc_code, expected_unit,
       dedup_loinc_codes, alert_thresholds::jsonb
from p, (values
  (1, 'adherence_mmas8',      'Tomou TODAS as medicacoes essa semana (diuretico, beta-bloqueador, IECA/BRA)?',
      '71799-1',                  null::text,    '{}'::text[],
      '{"yellow":"missed_days >= 1","red":"missed_days >= 3"}'),
  (2, 'weight_self_report',   'Qual seu peso hoje? (peso de manha, em jejum, mesma balanca)',
      '29463-7',                  'kg',          '{}'::text[],
      '{"yellow":"delta_kg_3d >= 1.5","red":"delta_kg_3d >= 2.5 or delta_kg_7d >= 3"}'),
  (3, 'symptom_keyword',      'Falta de ar piorou? Pernas mais inchadas? Precisou de mais travesseiros pra dormir?',
      'singulare:symptom-cardio', '',            '{}'::text[],
      '{"red":"answer = yes"}'),
  (4, 'kccq_short',           'Numa escala de 0 a 100, quanto a IC esta limitando sua vida essa semana? (0=muito, 100=nada)',
      'singulare:kccq-short',     'escore',      '{}'::text[],
      '{"yellow":"score <= 60","red":"score <= 40 or delta_score_2wk <= -15"}'),
  (5, 'activity_self_report', 'Quanto consegue andar antes de cansar? (quarteiroes, lances escada)',
      'singulare:activity-self',  'quarteiroes/dia', '{"55423-8","41950-7"}'::text[],
      '{"yellow":"blocks <= 2"}'),
  (6, 'pa_self_report',       'Mediu sua pressao? Quais valores?',
      'singulare:pa-self',        'mmHg',        '{"8480-6","8462-4"}'::text[],
      '{"yellow":"sbp <= 95 or sbp >= 140"}')
) as q(ordering, kind, prompt_pt, loinc_code, expected_unit,
       dedup_loinc_codes, alert_thresholds);

-- ====================================================================
-- 4. FA (Fibrilacao Atrial)
-- ====================================================================

with p as (
  insert into public.treatment_protocols
    (tenant_id, specialty, slug, name, description, duration_weeks, cadence_days)
  values
    (null, 'cardiologia', 'fa', 'Fibrilacao Atrial',
     'Seguimento de paciente com FA paroxistica ou permanente. Adherence ao '
     'anticoagulante e vigilancia de sangramento sao criticos.', 12, 7)
  returning id
)
insert into public.protocol_questions
  (protocol_id, ordering, kind, prompt_pt, loinc_code, expected_unit,
   dedup_loinc_codes, alert_thresholds)
select p.id, ordering, kind, prompt_pt, loinc_code, expected_unit,
       dedup_loinc_codes, alert_thresholds::jsonb
from p, (values
  (1, 'adherence_mmas8',      'Tomou o anticoagulante (varfarina/rivaroxabana/apixabana/dabigatrana) todos os dias?',
      '71799-1',                  null::text,    '{}'::text[],
      '{"yellow":"missed_days >= 1","red":"missed_days >= 2"}'),
  (2, 'symptom_keyword',      'Sentiu palpitacao forte, tontura ao levantar, desmaio ou falta de ar repentina?',
      'singulare:symptom-cardio', '',            '{}'::text[],
      '{"red":"answer = yes"}'),
  (3, 'symptom_open',         'Notou sangramento incomum? (gengiva, nariz, manchas roxas, urina/fezes escuras)',
      'singulare:symptom-open',   '',            '{}'::text[],
      '{"red":"answer = yes"}'),
  (4, 'pa_self_report',       'Mediu sua pressao e batimento? Qual a frequencia cardiaca?',
      'singulare:pa-self',        'mmHg/bpm',    '{"8480-6","8462-4","8867-4"}'::text[],
      '{"yellow":"hr >= 110 or hr <= 50","red":"hr >= 130"}'),
  (5, 'activity_self_report', 'Conseguiu manter suas atividades? Cansou mais que o normal?',
      'singulare:activity-self',  'sessoes/sem', '{"55423-8","41950-7"}'::text[],
      '{"yellow":"sessions < 2"}')
) as q(ordering, kind, prompt_pt, loinc_code, expected_unit,
       dedup_loinc_codes, alert_thresholds);

-- ====================================================================
-- 5. DISLIPIDEMIA (controle lipidico em uso de estatina)
-- ====================================================================

with p as (
  insert into public.treatment_protocols
    (tenant_id, specialty, slug, name, description, duration_weeks, cadence_days)
  values
    (null, 'cardiologia', 'dislipidemia', 'Dislipidemia',
     'Seguimento de paciente em uso de estatina. Foco em adherence, efeito '
     'adverso muscular e adesao a mudanca de estilo de vida.', 12, 7)
  returning id
)
insert into public.protocol_questions
  (protocol_id, ordering, kind, prompt_pt, loinc_code, expected_unit,
   dedup_loinc_codes, alert_thresholds)
select p.id, ordering, kind, prompt_pt, loinc_code, expected_unit,
       dedup_loinc_codes, alert_thresholds::jsonb
from p, (values
  (1, 'adherence_mmas8',      'Tomou a estatina (sinvastatina/atorvastatina/rosuvastatina) todos os dias?',
      '71799-1',                  null::text,    '{}'::text[],
      '{"yellow":"missed_days >= 2","red":"missed_days >= 4"}'),
  (2, 'symptom_keyword',      'Sentiu dor muscular, fraqueza nas pernas ou urina escura essa semana?',
      'singulare:symptom-cardio', '',            '{}'::text[],
      '{"red":"answer = yes"}'),
  (3, 'activity_self_report', 'Conseguiu fazer 150 min de exercicio essa semana? (recomendacao para dislipidemia)',
      'singulare:activity-self',  'min/sem',     '{"55423-8","41950-7"}'::text[],
      '{"yellow":"minutes < 90","red":"minutes < 30"}'),
  (4, 'weight_self_report',   'Qual seu peso atual?',
      '29463-7',                  'kg',          '{}'::text[],
      '{"yellow":"delta_kg_4wk >= 2"}')
) as q(ordering, kind, prompt_pt, loinc_code, expected_unit,
       dedup_loinc_codes, alert_thresholds);

-- ====================================================================
-- Verificacao final: contagem por protocolo
-- ====================================================================
-- select tp.slug, tp.name, count(pq.id) as num_questions
-- from public.treatment_protocols tp
-- left join public.protocol_questions pq on pq.protocol_id = tp.id
-- where tp.tenant_id is null
-- group by tp.slug, tp.name
-- order by tp.slug;
-- Esperado:
--   dislipidemia | 4
--   fa           | 5
--   hipertenso   | 5
--   icc          | 6
--   pos-iam      | 6
