-- Modulo Seguimento de Tratamento: tabelas core.
-- Idempotente: tabelas/indexes/colunas usam IF NOT EXISTS; policies recriam com DROP IF EXISTS + CREATE.
-- Tipos das FKs alinhados com o schema real do projeto:
--   patients.id          = bigint
--   health_observations.id = bigint
--   tenant_doctors.id    = uuid
--   tenant_members.id    = uuid
-- Reusa health_observations (ja em prod) como camada de dados longitudinal.

-- ===========================================================================
-- treatment_protocols
-- ===========================================================================
create table if not exists public.treatment_protocols (
  id              bigserial primary key,
  tenant_id       text,
  specialty       text not null check (specialty = 'cardiologia'),
  slug            text not null,
  name            text not null,
  description     text,
  duration_weeks  int  not null default 12,
  cadence_days    int  not null default 7,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, specialty, slug)
);

create unique index if not exists treatment_protocols_global_slug_uniq
  on public.treatment_protocols (specialty, slug)
  where tenant_id is null;

create index if not exists treatment_protocols_tenant_idx
  on public.treatment_protocols (tenant_id, specialty)
  where is_active = true;

alter table public.treatment_protocols enable row level security;

drop policy if exists treatment_protocols_read on public.treatment_protocols;
create policy treatment_protocols_read on public.treatment_protocols
  for select to authenticated
  using (tenant_id is null or public.is_tenant_member(tenant_id));

drop policy if exists treatment_protocols_write on public.treatment_protocols;
create policy treatment_protocols_write on public.treatment_protocols
  for all to authenticated
  using (tenant_id is not null and public.is_tenant_member(tenant_id))
  with check (tenant_id is not null and public.is_tenant_member(tenant_id));

comment on table public.treatment_protocols is
  'Templates de protocolo de seguimento por especialidade. tenant_id null = template global Singulare.';

-- ===========================================================================
-- protocol_questions
-- ===========================================================================
create table if not exists public.protocol_questions (
  id                bigserial primary key,
  protocol_id       bigint not null references public.treatment_protocols(id) on delete cascade,
  ordering          int not null default 0,
  kind              text not null check (kind in (
    'adherence_mmas8',
    'symptom_open',
    'symptom_keyword',
    'pa_self_report',
    'weight_self_report',
    'activity_self_report',
    'kccq_short',
    'satisfaction'
  )),
  prompt_pt         text not null,
  loinc_code        text not null,
  expected_unit     text,
  dedup_loinc_codes text[] default '{}',
  alert_thresholds  jsonb,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists protocol_questions_protocol_idx
  on public.protocol_questions (protocol_id, ordering)
  where is_active = true;

alter table public.protocol_questions enable row level security;

drop policy if exists protocol_questions_read on public.protocol_questions;
create policy protocol_questions_read on public.protocol_questions
  for select to authenticated
  using (
    protocol_id in (
      select id from public.treatment_protocols
      where tenant_id is null or public.is_tenant_member(tenant_id)
    )
  );

drop policy if exists protocol_questions_write on public.protocol_questions;
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
  'Perguntas por protocolo. dedup_loinc_codes lista LOINC do passivo que cobre essa pergunta '
  '(se ja temos dado passivo recente, P04 pula). alert_thresholds em DSL avaliada em codigo.';

-- ===========================================================================
-- patient_protocols
-- ===========================================================================
create table if not exists public.patient_protocols (
  id                    bigserial primary key,
  patient_id            bigint not null references public.patients(id) on delete cascade,
  tenant_id             text not null,
  protocol_id           bigint not null references public.treatment_protocols(id) on delete restrict,
  doctor_id             uuid references public.tenant_doctors(id) on delete set null,
  started_at            timestamptz not null default now(),
  ends_at               timestamptz,
  next_consultation_at  timestamptz,
  last_dispatched_at    timestamptz,
  status                text not null default 'active'
    check (status in ('active','paused','completed','abandoned')),
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (patient_id, protocol_id, started_at)
);

create index if not exists patient_protocols_active_idx
  on public.patient_protocols (tenant_id, status, next_consultation_at)
  where status = 'active';

create index if not exists patient_protocols_dispatch_idx
  on public.patient_protocols (tenant_id, status, last_dispatched_at)
  where status = 'active';

alter table public.patient_protocols enable row level security;

drop policy if exists patient_protocols_tenant_all on public.patient_protocols;
create policy patient_protocols_tenant_all on public.patient_protocols
  for all to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

comment on table public.patient_protocols is
  'Atribuicao paciente <-> protocolo. Alimenta cron P04 (envio de perguntas) '
  'e cron de briefing pre-consulta.';

-- ===========================================================================
-- alert_events
-- ===========================================================================
create table if not exists public.alert_events (
  id                       bigserial primary key,
  patient_id               bigint not null references public.patients(id) on delete cascade,
  tenant_id                text not null,
  severity                 text not null check (severity in ('info','warning','critical')),
  source                   text not null check (source in (
    'passive_outlier','active_keyword','active_threshold','manual'
  )),
  trigger_observation_id   bigint references public.health_observations(id) on delete set null,
  reason                   text,
  payload                  jsonb,
  notified_chatwoot        boolean default false,
  notified_doctor_whatsapp boolean default false,
  acknowledged_at          timestamptz,
  acknowledged_by          uuid references public.tenant_members(id) on delete set null,
  action_taken             text,
  created_at               timestamptz not null default now()
);

create index if not exists alert_events_patient_idx
  on public.alert_events (patient_id, created_at desc);

create index if not exists alert_events_tenant_severity_idx
  on public.alert_events (tenant_id, severity, created_at desc);

alter table public.alert_events enable row level security;

drop policy if exists alert_events_tenant_read on public.alert_events;
create policy alert_events_tenant_read on public.alert_events
  for select to authenticated
  using (public.is_tenant_member(tenant_id));

-- INSERT/UPDATE so via edge function trigger-alert com service_role.

comment on table public.alert_events is
  'Audit trail de alertas clinicos disparados pelo modulo seguimento. '
  'Defesa regulatoria ANVISA (RDC 657/2022) + LGPD. Insert exclusivamente via service_role.';

-- ===========================================================================
-- appointments.briefing_pdf_url
-- ===========================================================================
alter table public.appointments
  add column if not exists briefing_pdf_url text;

comment on column public.appointments.briefing_pdf_url is
  'URL do PDF de briefing pre-consulta (Supabase Storage). Preenchido pelo cron de geracao em D-1.';
