-- ============================================================
-- Multi-tenant hardening: Blocos A → D
-- Data: 2026-04-30
-- Origem: docs/superpowers/plans/2026-04-29-multi-tenant-multi-user-audit.md
-- Apply via mcp__supabase-singulare__apply_migration (uma migration por bloco)
-- Todos rollbackáveis (rollback no fim do arquivo)
-- ============================================================


-- ──────────────────────────────────────────────────────────
-- BLOCO A — appointments multi-tenant
-- 0 rows hoje, app filtra via doctor_id IN (...)
-- ──────────────────────────────────────────────────────────

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS tenant_id varchar;

UPDATE public.appointments a
   SET tenant_id = d.tenant_id
  FROM public.tenant_doctors d
 WHERE a.doctor_id = d.id
   AND a.tenant_id IS NULL;

ALTER TABLE public.appointments
  ALTER COLUMN tenant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_tenant_id_fkey') THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_date
  ON public.appointments (tenant_id, appointment_date DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_doctor
  ON public.appointments (tenant_id, doctor_id);

DROP POLICY IF EXISTS appointments_member_read ON public.appointments;
CREATE POLICY appointments_member_read
  ON public.appointments FOR SELECT
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS appointments_member_write ON public.appointments;
CREATE POLICY appointments_member_write
  ON public.appointments FOR ALL
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));


-- ──────────────────────────────────────────────────────────
-- BLOCO B — tenant_id NOT NULL hardening
-- saas_orders (8 rows, todos com tenant_id) — só ALTER
-- push_subscriptions (1 row) — backfill via tenant_members
-- notification_log (6 rows) — backfill via tenant_members
-- ──────────────────────────────────────────────────────────

-- B.1 saas_orders
ALTER TABLE public.saas_orders
  ALTER COLUMN tenant_id SET NOT NULL;

-- B.2 push_subscriptions: backfill via user_id → tenant_members
UPDATE public.push_subscriptions ps
   SET tenant_id = tm.tenant_id
  FROM public.tenant_members tm
 WHERE ps.user_id = tm.user_id
   AND tm.status = 'active'
   AND ps.tenant_id IS NULL;
-- (se sobrar NULL, falha o ALTER abaixo — é o desejado)
ALTER TABLE public.push_subscriptions
  ALTER COLUMN tenant_id SET NOT NULL;

-- B.3 notification_log: backfill via user_id → tenant_members
UPDATE public.notification_log nl
   SET tenant_id = tm.tenant_id
  FROM public.tenant_members tm
 WHERE nl.user_id = tm.user_id
   AND tm.status = 'active'
   AND nl.tenant_id IS NULL;
ALTER TABLE public.notification_log
  ALTER COLUMN tenant_id SET NOT NULL;


-- ──────────────────────────────────────────────────────────
-- BLOCO C — RLS em n8n_historico_exames + _memory (defesa em profundidade)
-- service_role (n8n) bypassa RLS, app não toca essas tabelas
-- ──────────────────────────────────────────────────────────

ALTER TABLE public.n8n_historico_exames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.n8n_historico_exames_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS n8n_exames_member_read ON public.n8n_historico_exames;
CREATE POLICY n8n_exames_member_read
  ON public.n8n_historico_exames FOR SELECT
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS n8n_exames_memory_member_read ON public.n8n_historico_exames_memory;
CREATE POLICY n8n_exames_memory_member_read
  ON public.n8n_historico_exames_memory FOR SELECT
  USING (public.is_tenant_member(tenant_id));


-- ──────────────────────────────────────────────────────────
-- BLOCO D — Índices de performance
-- ──────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_historico_mensagens_tenant_session
  ON public.n8n_historico_mensagens (tenant_id, session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fila_mensagens_telefone_timestamp
  ON public.n8n_fila_mensagens (telefone, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_fila_mensagens_tenant_telefone
  ON public.n8n_fila_mensagens (tenant_id, telefone);


-- ============================================================
-- ROLLBACK (em caso de problema, rodar do bloco D pro A)
-- ============================================================

-- Bloco D rollback
-- DROP INDEX IF EXISTS public.idx_fila_mensagens_tenant_telefone;
-- DROP INDEX IF EXISTS public.idx_fila_mensagens_telefone_timestamp;
-- DROP INDEX IF EXISTS public.idx_historico_mensagens_tenant_session;

-- Bloco C rollback
-- DROP POLICY IF EXISTS n8n_exames_memory_member_read ON public.n8n_historico_exames_memory;
-- DROP POLICY IF EXISTS n8n_exames_member_read ON public.n8n_historico_exames;
-- ALTER TABLE public.n8n_historico_exames_memory DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.n8n_historico_exames DISABLE ROW LEVEL SECURITY;

-- Bloco B rollback
-- ALTER TABLE public.notification_log ALTER COLUMN tenant_id DROP NOT NULL;
-- ALTER TABLE public.push_subscriptions ALTER COLUMN tenant_id DROP NOT NULL;
-- ALTER TABLE public.saas_orders ALTER COLUMN tenant_id DROP NOT NULL;

-- Bloco A rollback
-- DROP POLICY IF EXISTS appointments_member_write ON public.appointments;
-- DROP POLICY IF EXISTS appointments_member_read ON public.appointments;
-- DROP INDEX IF EXISTS public.idx_appointments_tenant_doctor;
-- DROP INDEX IF EXISTS public.idx_appointments_tenant_date;
-- ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_tenant_id_fkey;
-- ALTER TABLE public.appointments DROP COLUMN IF EXISTS tenant_id;
