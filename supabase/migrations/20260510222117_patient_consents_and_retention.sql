-- LGPD: registro de consentimento explicito do paciente pra coleta de dados de saude.
-- Necessario antes de coletar dados pessoais sensiveis (LGPD art. 11).
create table public.patient_consents (
  id bigserial primary key,
  patient_id bigint not null references public.patients(id) on delete cascade,
  tenant_id text not null,
  consent_type text not null check (consent_type in (
    'health_monitoring',
    'data_sharing_clinic',
    'ai_inference'
  )),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  source text not null default 'web_link' check (source in (
    'web_link', 'mobile_app', 'painel_manual'
  )),
  ip_address inet,
  user_agent text,
  app_version text,
  -- Unique por (patient, type, ainda-ativo): nao re-registra se ja tem ativo
  unique (patient_id, consent_type, granted_at)
);

create index patient_consents_active_idx on public.patient_consents (patient_id, consent_type)
  where revoked_at is null;

alter table public.patient_consents enable row level security;

-- Membros do tenant (medico/admin/owner) leem consents dos pacientes do tenant.
create policy patient_consents_tenant_read on public.patient_consents
  for select to authenticated
  using (public.is_tenant_member(tenant_id));

-- INSERT/UPDATE/DELETE proibidos para usuario comum: gerenciado via service_role
-- pela edge function ou pelos endpoints Next.js do painel.

comment on table public.patient_consents is
  'LGPD art. 7/11: registro de consentimento do paciente pra coleta de biomarcadores. '
  'health_monitoring=coleta basica; data_sharing_clinic=compartilhar com a clinica; '
  'ai_inference=permitir uso pra modelos preditivos.';

-- Politica de retencao de health_observations (24 meses).
-- Dados de monitoramento sao auxiliares: o prontuario formal (CFM 1.821/2007 = 20 anos)
-- continua nas tabelas appointments/patient_clinical_data/etc, nao aqui.
-- LGPD art. 16 III: minimizacao - guardar so o necessario pro proposito.
create or replace function public.fn_health_observations_retention()
returns void
language plpgsql
security definer
as $$
declare
  cutoff timestamptz := now() - interval '24 months';
  rows_deleted bigint;
begin
  delete from public.health_observations where created_at < cutoff;
  get diagnostics rows_deleted = row_count;
  raise notice 'health_observations retention: % rows deleted (cutoff %)', rows_deleted, cutoff;
end;
$$;

comment on function public.fn_health_observations_retention is
  'LGPD retencao: apaga health_observations com mais de 24 meses. '
  'Roda mensal via pg_cron. Prontuario formal nao e afetado.';

-- Agenda mensal: dia 1, 04:00 UTC (madrugada BR).
-- pg_cron precisa estar habilitado (extensao); se nao tiver, ignorar erro silenciosamente.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('health_observations_retention')
      from cron.job where jobname = 'health_observations_retention';
    perform cron.schedule(
      'health_observations_retention',
      '0 4 1 * *',  -- minute 0, hour 4, day-of-month 1, every month
      'select public.fn_health_observations_retention()'
    );
  end if;
exception when others then
  raise notice 'pg_cron schedule skipped: %', sqlerrm;
end;
$$;
