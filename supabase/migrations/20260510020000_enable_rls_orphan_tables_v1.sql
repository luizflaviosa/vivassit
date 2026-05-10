-- Habilita RLS nas 20 tabelas flagadas pelo Supabase advisor crítico.
-- Estratégia em 4 categorias:
--   1. Tenant-scoped: ENABLE RLS + read policy is_tenant_member; service_role bypassa
--   2. Server-only: ENABLE RLS sem policies (anon/authenticated bloqueados; service_role bypassa)
--   3. Public lookups: ENABLE RLS + SELECT pra public (dados públicos, RLS é só formalidade)
--   4. JurisLocal (jl_*): ENABLE RLS sem policies (produto separado, sem UI client-side ainda)
--
-- Helpers usados (já existentes): is_tenant_member(uuid)
-- Convenção de nome: <tabela>_<scope>_<verbo>

-- =====================================================
-- 1. Tenant-scoped operational tables (read pra membros)
-- =====================================================

ALTER TABLE public.doctor_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doctor_bookings_member_read" ON public.doctor_bookings
  FOR SELECT TO public USING (is_tenant_member(tenant_id));

ALTER TABLE public.tenant_calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_calendar_events_member_read" ON public.tenant_calendar_events
  FOR SELECT TO public USING (is_tenant_member(tenant_id));

ALTER TABLE public.tenant_market_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_market_keywords_member_read" ON public.tenant_market_keywords
  FOR SELECT TO public USING (is_tenant_member(tenant_id));

ALTER TABLE public.tenant_market_trends_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_market_trends_history_member_read" ON public.tenant_market_trends_history
  FOR SELECT TO public USING (is_tenant_member(tenant_id));

ALTER TABLE public.tenant_region_demand_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_region_demand_history_member_read" ON public.tenant_region_demand_history
  FOR SELECT TO public USING (is_tenant_member(tenant_id));

ALTER TABLE public.tenant_gbp_insights_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_gbp_insights_history_member_read" ON public.tenant_gbp_insights_history
  FOR SELECT TO public USING (is_tenant_member(tenant_id));

ALTER TABLE public.tenant_competitors_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_competitors_history_member_read" ON public.tenant_competitors_history
  FOR SELECT TO public USING (is_tenant_member(tenant_id));

-- =====================================================
-- 2. Server-only (sem policies — anon/authenticated bloqueados)
-- =====================================================

ALTER TABLE public.google_calendar_watch_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.n8n_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_schemas ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. Public lookup tables (CID-10 e TUSS — dados públicos)
-- =====================================================

ALTER TABLE public.lookup_cid10 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lookup_cid10_public_read" ON public.lookup_cid10
  FOR SELECT TO public USING (true);

ALTER TABLE public.lookup_tuss ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lookup_tuss_public_read" ON public.lookup_tuss
  FOR SELECT TO public USING (true);

-- =====================================================
-- 4. JurisLocal (produto separado, server-only por ora)
-- =====================================================

ALTER TABLE public.jl_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jl_processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jl_partes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jl_advogados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jl_processo_advogados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jl_comunicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jl_raio_x ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.jl_empresas IS 'JurisLocal — produto separado co-habitando esta DB. RLS habilitada sem policies (server-only por ora). Quando JL ganhar painel próprio, adicionar policies tenant-scoped seguindo padrão Singulare.';
