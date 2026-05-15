-- T2 do MVP Seguimento de Tratamento
-- docs/plans/seguimento-tratamento-spec-mvp.md
--
-- Cria 4 tabelas do modulo:
--   treatment_protocols  - templates de protocolo (global ou por tenant)
--   protocol_questions   - perguntas por protocolo (com LOINC, dedup, thresholds)
--   patient_protocols    - atribuicao paciente <-> protocolo (alimenta cron P04)
--   alert_events         - audit trail de alertas clinicos (defesa regulatoria)

-- ====================================================================
-- 1. treatment_protocols: templates (tenant_id null = global Singulare)
-- ====================================================================

create table public.treatment_protocols (
  id bigserial primary key,
  tenant_id text,
  specialty text not null check (specialty in ('cardiologia')),
  slug text not null,
  name text not null,
  description text,
  duration_weeks int not null default 12,
  cadence_days int not null default 7,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, specialty, slug)
);

create index treatment_protocols_tenant_idx
  on public.treatment_protocols (tenant_id, specialty)
  where is_active = true;

alter table public.treatment_protocols enable row level security;

create policy treatment_protocols_read on public.treatment_protocols
  for select to authenticated
  using (tenant_id is null or public.is_tenant_member(tenant_id));

create policy treatment_protocols_write on public.treatment_protocols
  for all to authenticated
  using (tenant_id is not null and public.is_tenant_member(tenant_id))
  with check (tenant_id is not null and public.is_tenant_member(tenant_id));

comment on table public.treatment_protocols is
  'Templates de protocolo de seguimento. tenant_id null = global Singulare.';

-- ====================================================================
-- 2. protocol_questions: perguntas semanais por protocolo
-- ====================================================================

create table public.protocol_questions (
  id bigserial primary key,
  protocol_id bigint not null references public.treatment_protocols(id) on delete cascade,
  ordering int not null default 0,
  kind text not null check (kind in (
    'adherence_mmas8',
    'symptom_open',
    'symptom_keyword',
    'pa_self_report',
    'weight_self_report',
    'activity_self_report',
    'kccq_short',
    'satisfaction'
  )),
  prompt_pt text not null,
  loinc_code text not null,
  expected_unit text,
  dedup_loinc_codes text[] default '{}',
  alert_thresholds jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index protocol_questions_protocol_idx
  on public.protocol_questions (protocol_id, ordering)
  where is_active = true;

alter table public.protocol_questions enable row level security;

create policy protocol_questions_read on public.protocol_questions
  for select to authenticated
  using (
    protocol_id in (
      select id from public.treatment_protocols
      where tenant_id is null or public.is_tenant_member(tenant_id)
    )
  );

create policy protocol_questions_write on public.protocol_questions
  for all to authenticated
  using (
    protocol_id in (
      select id from public.treatment_protocols
      where tenant_id is not null and public.is_tenant_member(tenant_id)
    )
  )
  with check (
    protocol_id in (
      select id from public.treatment_protocols
      where tenant_id is not null and public.is_tenant_member(tenant_id)
    )
  );

comment on table public.protocol_questions is
  'Perguntas semanais por protocolo. dedup_loinc_codes evita gravar self-report '
  'se ja houver passive da mesma metrica na janela. alert_thresholds em jsonb pra '
  'edge fn trigger-alert evaluar.';

-- ====================================================================
-- 3. patient_protocols: atribuicao paciente <-> protocolo
-- ====================================================================

create table public.patient_protocols (
  id bigserial primary key,
  patient_id bigint not null references public.patients(id) on delete cascade,
  tenant_id text not null,
  protocol_id bigint not null references public.treatment_protocols(id) on delete restrict,
  doctor_id uuid references public.tenant_doctors(id) on delete set null,
  started_at timestamptz not null default now(),
  ends_at timestamptz,
  next_consultation_at timestamptz,
  last_dispatched_at timestamptz,
  status text not null default 'active' check (status in (
    'active', 'paused', 'completed', 'abandoned'
  )),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, protocol_id, started_at)
);

create index patient_protocols_active_idx
  on public.patient_protocols (tenant_id, status, next_consultation_at)
  where status = 'active';

alter table public.patient_protocols enable row level security;

create policy patient_protocols_tenant_all on public.patient_protocols
  for all to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

comment on table public.patient_protocols is
  'Atribuicao paciente <-> protocolo. Alimenta cron P04 (envio perguntas WhatsApp) e '
  'cron de briefing (PDF pre-consulta).';

-- ====================================================================
-- 4. alert_events: audit trail de alertas clinicos
-- ====================================================================

create table public.alert_events (
  id bigserial primary key,
  patient_id bigint not null references public.patients(id) on delete cascade,
  tenant_id text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  source text not null check (source in (
    'passive_outlier',
    'active_keyword',
    'active_threshold',
    'manual'
  )),
  trigger_observation_id bigint references public.health_observations(id) on delete set null,
  reason text,
  payload jsonb,
  notified_chatwoot boolean default false,
  notified_doctor_whatsapp boolean default false,
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.tenant_members(id) on delete set null,
  action_taken text,
  created_at timestamptz not null default now()
);

create index alert_events_patient_idx
  on public.alert_events (patient_id, created_at desc);

create index alert_events_tenant_severity_idx
  on public.alert_events (tenant_id, severity, created_at desc);

alter table public.alert_events enable row level security;

create policy alert_events_tenant_read on public.alert_events
  for select to authenticated
  using (public.is_tenant_member(tenant_id));

-- INSERT/UPDATE so via edge function trigger-alert (service_role) — sem policy
-- pra authenticated. Service_role bypassa RLS.

comment on table public.alert_events is
  'Audit trail de alertas clinicos. Defesa regulatoria ANVISA + LGPD. '
  'INSERT/UPDATE so via edge function trigger-alert com service_role.';
