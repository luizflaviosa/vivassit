-- Feature flag pra modulo RPM (Remote Patient Monitoring / Seguimento de Tratamento).
-- Segue o padrao da coluna `addon_marketing` ja existente em tenants.
-- Default false: rollout controlado, tenants tem o item visivel como "Em breve" no menu;
-- quando true, item vira link funcional pra /painel/seguimento.

alter table public.tenants
  add column if not exists addon_rpm boolean not null default false;

comment on column public.tenants.addon_rpm is
  'Feature flag do modulo Seguimento de Tratamento (RPM). True = tenant ve o item ativo no menu e acessa /painel/seguimento. Default false (rollout controlado).';

-- Ativa pros tenants de testes internos (Singulare + parceiros iniciais).
update public.tenants
   set addon_rpm = true,
       updated_at = now()
 where tenant_id in ('demo-singulare', 'singulare', 'singulare-e2e');
