-- Tabela de bloqueios esporadicos de agenda (almoco, ausencia pontual, etc).
-- Independente de doctor_bookings: doctor_bookings = consultas com paciente,
-- doctor_schedule_blocks = indisponibilidade sem paciente.

create table public.doctor_schedule_blocks (
  id uuid default gen_random_uuid() primary key,
  tenant_id text not null references public.tenants(tenant_id) on delete cascade,
  doctor_id uuid not null references public.tenant_doctors(id) on delete cascade,
  start_at timestamptz not null,
  end_at   timestamptz not null,
  reason   text,
  source   text not null default 'painel'
           check (source in ('agente','painel','google_cal')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index doctor_schedule_blocks_lookup
  on public.doctor_schedule_blocks (tenant_id, doctor_id, start_at);

alter table public.doctor_schedule_blocks enable row level security;

-- Politica identica em forma a de doctor_bookings (is_tenant_member sobre tenant_id):
create policy doctor_schedule_blocks_tenant_isolation
  on public.doctor_schedule_blocks
  for all
  using ( is_tenant_member(tenant_id) )
  with check ( is_tenant_member(tenant_id) );
