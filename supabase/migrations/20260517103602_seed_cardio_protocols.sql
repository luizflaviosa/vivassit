-- Seed dos 5 templates globais (tenant_id null) de cardiologia.
-- Idempotente: cada bloco usa WHERE NOT EXISTS antes do INSERT.
-- Templates:
--   1. hipertenso     - Hipertensao Arterial Sistemica
--   2. pos-iam        - Pos infarto agudo do miocardio
--   3. icc            - Insuficiencia cardiaca congestiva
--   4. fa             - Fibrilacao atrial
--   5. dislipidemia   - Dislipidemia

-- ===========================================================================
-- 1. HIPERTENSO
-- ===========================================================================
insert into public.treatment_protocols
  (tenant_id, specialty, slug, name, description, duration_weeks, cadence_days)
select null, 'cardiologia', 'hipertenso',
  'Hipertensao Arterial Sistemica',
  'Seguimento de paciente com HAS estavel. Foco em adesao medicamentosa, controle da PA, atividade fisica e peso.',
  12, 7
where not exists (
  select 1 from public.treatment_protocols
  where slug = 'hipertenso' and specialty = 'cardiologia' and tenant_id is null
);

insert into public.protocol_questions
  (protocol_id, ordering, kind, prompt_pt, loinc_code, expected_unit, dedup_loinc_codes, alert_thresholds)
select
  (select id from public.treatment_protocols
    where slug = 'hipertenso' and specialty = 'cardiologia' and tenant_id is null),
  q.ordering, q.kind, q.prompt_pt, q.loinc_code, q.expected_unit, q.dedup_loinc_codes, q.alert_thresholds
from (values
  (1, 'adherence_mmas8',
     'Voce tomou seus remedios da pressao todos os dias dessa semana?',
     '71799-1', NULL, '{}'::text[],
     '{"yellow":"missed_days >= 2","red":"missed_days >= 4"}'::jsonb),
  (2, 'pa_self_report',
     'Mediu sua pressao essa semana? Qual foi a maior medida?',
     'singulare:pa-self', 'mmHg', '{"8480-6","8462-4"}'::text[],
     '{"yellow":"sbp >= 160 or dbp >= 100","red":"sbp >= 180 or dbp >= 110"}'::jsonb),
  (3, 'symptom_keyword',
     'Sentiu dor no peito, falta de ar ou tontura forte essa semana?',
     'singulare:symptom-cardio', NULL, '{}'::text[],
     '{"red":"answer = yes"}'::jsonb),
  (4, 'activity_self_report',
     'Quantas vezes voce caminhou ou se exercitou na semana?',
     'singulare:activity-self', 'sessoes/sem', '{"55423-8","41950-7"}'::text[],
     '{"yellow":"sessions < 2"}'::jsonb),
  (5, 'weight_self_report',
     'Qual seu peso atual em kg?',
     '29463-7', 'kg', '{}'::text[],
     '{"yellow":"delta_kg_4wk >= 2"}'::jsonb)
) as q(ordering, kind, prompt_pt, loinc_code, expected_unit, dedup_loinc_codes, alert_thresholds)
where not exists (
  select 1 from public.protocol_questions pq
  join public.treatment_protocols tp on tp.id = pq.protocol_id
  where tp.slug = 'hipertenso' and tp.tenant_id is null and pq.ordering = q.ordering
);

-- ===========================================================================
-- 2. POS-IAM (pos infarto)
-- ===========================================================================
insert into public.treatment_protocols
  (tenant_id, specialty, slug, name, description, duration_weeks, cadence_days)
select null, 'cardiologia', 'pos-iam',
  'Pos Infarto Agudo do Miocardio',
  'Seguimento pos-IAM com foco em quadruple therapy (antiplaquetario + beta-bloqueador + estatina + IECA/BRA), reabilitacao e detecao precoce de re-eventos.',
  12, 7
where not exists (
  select 1 from public.treatment_protocols
  where slug = 'pos-iam' and specialty = 'cardiologia' and tenant_id is null
);

insert into public.protocol_questions
  (protocol_id, ordering, kind, prompt_pt, loinc_code, expected_unit, dedup_loinc_codes, alert_thresholds)
select
  (select id from public.treatment_protocols
    where slug = 'pos-iam' and specialty = 'cardiologia' and tenant_id is null),
  q.ordering, q.kind, q.prompt_pt, q.loinc_code, q.expected_unit, q.dedup_loinc_codes, q.alert_thresholds
from (values
  (1, 'adherence_mmas8',
     'Voce tomou TODOS os remedios do coracao (AAS, beta-bloq, estatina, IECA) todos os dias?',
     '71799-1', NULL, '{}'::text[],
     '{"yellow":"missed_days >= 1","red":"missed_days >= 3"}'::jsonb),
  (2, 'symptom_keyword',
     'Sentiu dor no peito, sufoco, suor frio ou enjoo essa semana?',
     'singulare:symptom-cardio', NULL, '{}'::text[],
     '{"red":"answer = yes"}'::jsonb),
  (3, 'activity_self_report',
     'Conseguiu fazer a caminhada/reabilitacao recomendada essa semana?',
     'singulare:activity-self', 'sessoes/sem', '{"55423-8","41950-7"}'::text[],
     '{"yellow":"sessions < 3"}'::jsonb),
  (4, 'weight_self_report',
     'Qual seu peso atual em kg?',
     '29463-7', 'kg', '{}'::text[],
     '{"yellow":"delta_kg_4wk >= 2"}'::jsonb),
  (5, 'pa_self_report',
     'Mediu sua pressao essa semana? Qual foi a maior?',
     'singulare:pa-self', 'mmHg', '{"8480-6","8462-4"}'::text[],
     '{"yellow":"sbp >= 140 or dbp >= 90","red":"sbp >= 180 or dbp >= 110"}'::jsonb),
  (6, 'satisfaction',
     'Como esta a sua adaptacao ao tratamento? (1 = muito dificil, 5 = tranquila)',
     'singulare:satisfaction', 'escala', '{}'::text[],
     '{"yellow":"score <= 2"}'::jsonb)
) as q(ordering, kind, prompt_pt, loinc_code, expected_unit, dedup_loinc_codes, alert_thresholds)
where not exists (
  select 1 from public.protocol_questions pq
  join public.treatment_protocols tp on tp.id = pq.protocol_id
  where tp.slug = 'pos-iam' and tp.tenant_id is null and pq.ordering = q.ordering
);

-- ===========================================================================
-- 3. ICC (insuficiencia cardiaca)
-- ===========================================================================
insert into public.treatment_protocols
  (tenant_id, specialty, slug, name, description, duration_weeks, cadence_days)
select null, 'cardiologia', 'icc',
  'Insuficiencia Cardiaca',
  'Seguimento de IC com foco em peso diario (sinal de descompensacao), sintomas congestivos, adesao e KCCQ-12 mensal.',
  12, 7
where not exists (
  select 1 from public.treatment_protocols
  where slug = 'icc' and specialty = 'cardiologia' and tenant_id is null
);

insert into public.protocol_questions
  (protocol_id, ordering, kind, prompt_pt, loinc_code, expected_unit, dedup_loinc_codes, alert_thresholds)
select
  (select id from public.treatment_protocols
    where slug = 'icc' and specialty = 'cardiologia' and tenant_id is null),
  q.ordering, q.kind, q.prompt_pt, q.loinc_code, q.expected_unit, q.dedup_loinc_codes, q.alert_thresholds
from (values
  (1, 'adherence_mmas8',
     'Voce tomou todos os remedios do coracao todos os dias dessa semana?',
     '71799-1', NULL, '{}'::text[],
     '{"yellow":"missed_days >= 1","red":"missed_days >= 3"}'::jsonb),
  (2, 'weight_self_report',
     'Qual seu peso hoje em kg? (pese-se sempre de manha em jejum)',
     '29463-7', 'kg', '{}'::text[],
     '{"yellow":"delta_kg_7d >= 1.5","red":"delta_kg_7d >= 2.5"}'::jsonb),
  (3, 'symptom_keyword',
     'Sentiu falta de ar deitado, inchaco nas pernas ou cansaco anormal?',
     'singulare:symptom-cardio', NULL, '{}'::text[],
     '{"yellow":"answer = yes","red":"orthopnea = yes or edema_severe = yes"}'::jsonb),
  (4, 'kccq_short',
     'Como esta sua qualidade de vida com a IC essa semana? (questionario rapido KCCQ)',
     'singulare:kccq-short', 'escala', '{}'::text[],
     '{"yellow":"score < 60","red":"score < 40 or score_drop_4wk >= 10"}'::jsonb),
  (5, 'activity_self_report',
     'Quantas vezes conseguiu caminhar 20+ minutos essa semana?',
     'singulare:activity-self', 'sessoes/sem', '{"55423-8","41950-7"}'::text[],
     '{"yellow":"sessions < 2"}'::jsonb)
) as q(ordering, kind, prompt_pt, loinc_code, expected_unit, dedup_loinc_codes, alert_thresholds)
where not exists (
  select 1 from public.protocol_questions pq
  join public.treatment_protocols tp on tp.id = pq.protocol_id
  where tp.slug = 'icc' and tp.tenant_id is null and pq.ordering = q.ordering
);

-- ===========================================================================
-- 4. FA (fibrilacao atrial)
-- ===========================================================================
insert into public.treatment_protocols
  (tenant_id, specialty, slug, name, description, duration_weeks, cadence_days)
select null, 'cardiologia', 'fa',
  'Fibrilacao Atrial',
  'Seguimento de FA com foco em adesao a anticoagulante (CHADS-VASc), sintomas e controle de frequencia/ritmo.',
  12, 7
where not exists (
  select 1 from public.treatment_protocols
  where slug = 'fa' and specialty = 'cardiologia' and tenant_id is null
);

insert into public.protocol_questions
  (protocol_id, ordering, kind, prompt_pt, loinc_code, expected_unit, dedup_loinc_codes, alert_thresholds)
select
  (select id from public.treatment_protocols
    where slug = 'fa' and specialty = 'cardiologia' and tenant_id is null),
  q.ordering, q.kind, q.prompt_pt, q.loinc_code, q.expected_unit, q.dedup_loinc_codes, q.alert_thresholds
from (values
  (1, 'adherence_mmas8',
     'Voce tomou seu anticoagulante (Xarelto/Eliquis/Pradaxa/Marevan) todos os dias?',
     '71799-1', NULL, '{}'::text[],
     '{"yellow":"missed_days >= 1","red":"missed_days >= 2"}'::jsonb),
  (2, 'symptom_keyword',
     'Sentiu palpitacao, batedeira no peito ou tontura sem motivo?',
     'singulare:symptom-cardio', NULL, '{}'::text[],
     '{"yellow":"answer = yes","red":"syncope = yes or chest_pain = yes"}'::jsonb),
  (3, 'symptom_keyword',
     'Notou algum sangramento (gengivas, fezes escuras, urina rosada) ou hematoma sem batida?',
     'singulare:symptom-bleeding', NULL, '{}'::text[],
     '{"red":"answer = yes"}'::jsonb),
  (4, 'activity_self_report',
     'Quantas vezes voce caminhou ou se exercitou na semana?',
     'singulare:activity-self', 'sessoes/sem', '{"55423-8","41950-7"}'::text[],
     '{"yellow":"sessions < 2"}'::jsonb),
  (5, 'weight_self_report',
     'Qual seu peso atual em kg?',
     '29463-7', 'kg', '{}'::text[],
     '{"yellow":"delta_kg_4wk >= 2"}'::jsonb)
) as q(ordering, kind, prompt_pt, loinc_code, expected_unit, dedup_loinc_codes, alert_thresholds)
where not exists (
  select 1 from public.protocol_questions pq
  join public.treatment_protocols tp on tp.id = pq.protocol_id
  where tp.slug = 'fa' and tp.tenant_id is null and pq.ordering = q.ordering
);

-- ===========================================================================
-- 5. DISLIPIDEMIA
-- ===========================================================================
insert into public.treatment_protocols
  (tenant_id, specialty, slug, name, description, duration_weeks, cadence_days)
select null, 'cardiologia', 'dislipidemia',
  'Dislipidemia',
  'Seguimento de paciente em uso de estatina/anti-dislipidemico. Foco em adesao, efeito adverso muscular, dieta e atividade.',
  12, 7
where not exists (
  select 1 from public.treatment_protocols
  where slug = 'dislipidemia' and specialty = 'cardiologia' and tenant_id is null
);

insert into public.protocol_questions
  (protocol_id, ordering, kind, prompt_pt, loinc_code, expected_unit, dedup_loinc_codes, alert_thresholds)
select
  (select id from public.treatment_protocols
    where slug = 'dislipidemia' and specialty = 'cardiologia' and tenant_id is null),
  q.ordering, q.kind, q.prompt_pt, q.loinc_code, q.expected_unit, q.dedup_loinc_codes, q.alert_thresholds
from (values
  (1, 'adherence_mmas8',
     'Voce tomou a estatina (Sinvastatina/Atorvastatina/Rosuvastatina) todos os dias?',
     '71799-1', NULL, '{}'::text[],
     '{"yellow":"missed_days >= 2","red":"missed_days >= 4"}'::jsonb),
  (2, 'symptom_keyword',
     'Sentiu dor muscular forte, fraqueza ou caibras incomuns essa semana?',
     'singulare:symptom-myalgia', NULL, '{}'::text[],
     '{"yellow":"answer = yes","red":"severe_pain = yes or urine_dark = yes"}'::jsonb),
  (3, 'activity_self_report',
     'Quantas vezes voce caminhou ou se exercitou na semana?',
     'singulare:activity-self', 'sessoes/sem', '{"55423-8","41950-7"}'::text[],
     '{"yellow":"sessions < 3"}'::jsonb),
  (4, 'weight_self_report',
     'Qual seu peso atual em kg?',
     '29463-7', 'kg', '{}'::text[],
     '{"yellow":"delta_kg_4wk >= 2"}'::jsonb),
  (5, 'satisfaction',
     'Como esta sendo seguir a alimentacao recomendada? (1 = muito dificil, 5 = tranquila)',
     'singulare:satisfaction', 'escala', '{}'::text[],
     '{"yellow":"score <= 2"}'::jsonb)
) as q(ordering, kind, prompt_pt, loinc_code, expected_unit, dedup_loinc_codes, alert_thresholds)
where not exists (
  select 1 from public.protocol_questions pq
  join public.treatment_protocols tp on tp.id = pq.protocol_id
  where tp.slug = 'dislipidemia' and tp.tenant_id is null and pq.ordering = q.ordering
);
