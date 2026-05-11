-- Serie temporal de observacoes clinicas (HL7 FHIR Observation simplificado).
-- Append-only; identifica unicidade por (patient_id, loinc_code, effective_time).
-- LOINC subset cardio: HR=8867-4, HRV-SDNN=80404-7, steps=55423-8,
-- distance=41950-7, sleep-duration=93832-4, sleep-stage=93831-6,
-- SBP=8480-6, DBP=8462-4, temp=8310-5, SpO2=59408-5.
create table public.health_observations (
  id bigserial primary key,
  patient_id bigint not null references public.patients(id) on delete cascade,
  tenant_id text not null,
  category text not null check (category in ('vital-signs','activity','sleep','laboratory')),
  loinc_code text not null,
  display_name text,
  value_numeric numeric,
  value_text text,
  unit text,
  effective_time timestamptz not null,
  effective_period_end timestamptz,
  device_provenance jsonb,
  data_quality_tag text not null default 'clean'
    check (data_quality_tag in ('clean','outlier','noisy','rejected')),
  is_active boolean,
  raw_payload jsonb,
  ingest_batch_id uuid,
  created_at timestamptz not null default now(),
  unique (patient_id, loinc_code, effective_time)
);

create index health_obs_patient_code_time_idx
  on public.health_observations (patient_id, loinc_code, effective_time desc);

create index health_obs_tenant_time_idx
  on public.health_observations (tenant_id, effective_time desc);

create index health_obs_effective_time_brin
  on public.health_observations using brin (effective_time)
  with (pages_per_range = 32);

create index health_obs_batch_idx
  on public.health_observations (ingest_batch_id)
  where ingest_batch_id is not null;

alter table public.health_observations enable row level security;

-- Membros do tenant (medico/admin/owner) leem dados dos pacientes do tenant.
-- INSERT/UPDATE/DELETE proibidos para usuario comum: feitos exclusivamente
-- pela edge function ingest-vitals com service_role.
create policy health_obs_tenant_read on public.health_observations
  for select to authenticated
  using (public.is_tenant_member(tenant_id));

comment on table public.health_observations is
  'Serie temporal de biomarcadores (FHIR Observation). Insert apenas via edge function ingest-vitals com service_role.';
comment on column public.health_observations.data_quality_tag is
  'clean=valido | outlier=fora da faixa esperada mas plausivel | noisy=conflito com outros sinais | rejected=fisiologicamente impossivel.';
