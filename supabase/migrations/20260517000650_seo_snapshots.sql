-- Snapshots semanais do Google Search Console.
-- Populado pelo cron /api/cron/gsc-snapshot toda segunda 11:00 UTC (8h BRT).
-- Lido pelo dashboard /painel/seo (server component, service_role).

create table if not exists seo_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_at timestamptz not null default now(),
  -- Período coberto pelo snapshot (Search Analytics aceita data, não timestamp).
  range_start date not null,
  range_end date not null,
  -- Totais do período: clicks, impressions, ctr, position.
  summary jsonb not null default '{}'::jsonb,
  -- Top queries: array de {query, clicks, impressions, ctr, position}.
  top_queries jsonb not null default '[]'::jsonb,
  -- Top pages: array de {page, clicks, impressions, ctr, position}.
  top_pages jsonb not null default '[]'::jsonb,
  -- Metadados da execução: site, dimensions, latência, erro se houver.
  raw_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_seo_snapshots_at
  on seo_snapshots (snapshot_at desc);

-- RLS: dado interno (agregados públicos do site). Só service_role escreve/lê.
-- Não habilitamos RLS pra simplicidade — a tabela só é acessada pelo backend.
-- Se algum dia for exposta a tenant, adicionar policies.

comment on table seo_snapshots is
  'Snapshots semanais do Google Search Console (singulare.org). Populado pelo cron weekly.';
