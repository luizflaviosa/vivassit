-- Cache compartilhado entre tenants para coletas de mercado externas (DataForSEO, Google Places).
-- Reduz custo em escala: N cardiologistas em SP compartilham o mesmo snapshot.
-- Sources previstos:
--   market_trends   -> DFS Trends merged_data (BR-level por especialidade)
--   region_demand   -> DFS Labs keyword_overview por (especialidade, cidade)
--   competitors     -> Google Places + DFS Labs keywords_for_site por (especialidade, cidade)
-- Consumo: supabaseAdmin (service_role). RLS sem policies bloqueia anon/authenticated.

create table if not exists public.market_data_cache (
  source        text        not null,
  cache_key     text        not null,
  payload       jsonb       not null,
  collected_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  primary key (source, cache_key)
);

create index if not exists market_data_cache_collected_idx
  on public.market_data_cache (source, collected_at desc);

comment on table public.market_data_cache is
  'Cache compartilhado para coletas externas. Chave: (source, cache_key normalizado lower+sem-acentos). TTL definido pelo consumidor via collected_at.';
comment on column public.market_data_cache.source is
  'market_trends | region_demand | competitors';
comment on column public.market_data_cache.cache_key is
  'Chave normalizada (lower, sem acentos). market_trends: especialidade. region_demand/competitors: especialidade|cidade.';

alter table public.market_data_cache enable row level security;
-- Sem policies por desenho: acesso exclusivo via service_role.
