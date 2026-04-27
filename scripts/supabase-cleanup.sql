-- ============================================================================
-- Supabase Cleanup — Singulare
-- ----------------------------------------------------------------------------
-- Gerado a partir de audit (advisors + triggers duplicados).
-- LEIA antes de executar. NÃO rode tudo de uma vez sem entender.
-- Recomendação: rode bloco a bloco no SQL Editor do Supabase.
-- ============================================================================


-- ──────────────────────────────────────────────────────────────────────────────
-- BLOCO 1 — DROP de triggers duplicados (CRÍTICO)
-- ----------------------------------------------------------------------------
-- Múltiplos triggers com o mesmo nome estão executando 2-3x por update,
-- causando lentidão e side-effects multiplicados.
-- Postgres permite triggers homônimos em tabelas diferentes, mas
-- aqui temos o MESMO nome na MESMA tabela. Vamos dropar e recriar 1x.
-- ──────────────────────────────────────────────────────────────────────────────

-- 1a. tenant_doctors: trg_doctor_prompt_rebuild (3x → 1x)
DROP TRIGGER IF EXISTS trg_doctor_prompt_rebuild ON public.tenant_doctors;
CREATE TRIGGER trg_doctor_prompt_rebuild
  AFTER INSERT OR UPDATE OR DELETE ON public.tenant_doctors
  FOR EACH ROW EXECUTE FUNCTION trg_rebuild_prompt_on_doctor_change();

-- 1b. tenant_doctors: trg_refresh_rendered_prompt (3x → 1x)
DROP TRIGGER IF EXISTS trg_refresh_rendered_prompt ON public.tenant_doctors;
CREATE TRIGGER trg_refresh_rendered_prompt
  AFTER INSERT OR UPDATE OR DELETE ON public.tenant_doctors
  FOR EACH ROW EXECUTE FUNCTION fn_trigger_refresh_rendered_prompt();

-- 1c. appointments: validate_appointment_trigger (2x → 1x)
DROP TRIGGER IF EXISTS validate_appointment_trigger ON public.appointments;
CREATE TRIGGER validate_appointment_trigger
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION validate_appointment();

-- 1d. saas_orders: trigger_auto_telegram_requirements (2x → 1x)
DROP TRIGGER IF EXISTS trigger_auto_telegram_requirements ON public.saas_orders;
CREATE TRIGGER trigger_auto_telegram_requirements
  BEFORE INSERT OR UPDATE ON public.saas_orders
  FOR EACH ROW EXECUTE FUNCTION auto_calculate_telegram_requirements();

-- 1e. tenants: trg_sync_real_phone (2x → 1x)
DROP TRIGGER IF EXISTS trg_sync_real_phone ON public.tenants;
CREATE TRIGGER trg_sync_real_phone
  BEFORE INSERT OR UPDATE OF phone, real_phone ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION fn_sync_real_phone();


-- ──────────────────────────────────────────────────────────────────────────────
-- BLOCO 2 — Habilitar RLS em tabelas com dados sensíveis (CRÍTICO)
-- ----------------------------------------------------------------------------
-- Sem RLS, qualquer pessoa com a chave anon pode SELECT/INSERT/UPDATE/DELETE
-- nessas tabelas. Habilita RLS + cria policy mínima (só service_role lê/escreve).
-- Adicione policies específicas por user/tenant_id depois conforme cada caso.
--
-- ATENÇÃO: se algum cliente legítimo (frontend, n8n com chave anon) acessa
-- essas tabelas, vai parar de funcionar até você criar policies corretas.
-- Comece pelas mais sensíveis (tenants, tenant_doctors, patients, etc).
-- ──────────────────────────────────────────────────────────────────────────────

-- Habilita RLS (não cria policy automaticamente — service_role já bypassa)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nf_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.n8n_historico_exames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.n8n_historico_exames_memory ENABLE ROW LEVEL SECURITY;

-- Tabelas jl_* (jurislocal — não-Singulare, mas ainda no public expostas)
-- Se NÃO usadas mais, melhor mover pra schema separado ou DROP.
-- Por enquanto habilita RLS:
ALTER TABLE public.jl_processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jl_partes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jl_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jl_processo_advogados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jl_advogados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jl_comunicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jl_raio_x ENABLE ROW LEVEL SECURITY;


-- ──────────────────────────────────────────────────────────────────────────────
-- BLOCO 3 — Fixar search_path nas funções (WARN, recomendado)
-- ----------------------------------------------------------------------------
-- Funções sem search_path explícito são vetor de SQL injection se um schema
-- malicioso for criado. Recomendado fixar como public.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER FUNCTION public.fn_generate_rendered_prompt() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_trigger_refresh_rendered_prompt() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_trigger_tenant_onboard_doctor() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_rebuild_tenant_prompt() SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_rebuild_prompt_on_doctor_change() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_sync_real_phone() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.initialize_tenant_usage() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_tenant_config() SET search_path = public, pg_temp;
ALTER FUNCTION public.validate_appointment() SET search_path = public, pg_temp;
ALTER FUNCTION public.process_payment_webhook() SET search_path = public, pg_temp;
ALTER FUNCTION public.create_payment_notifications() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_payment_metrics() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_webhook_metrics() SET search_path = public, pg_temp;
ALTER FUNCTION public.calculate_telegram_requirements() SET search_path = public, pg_temp;
ALTER FUNCTION public.auto_calculate_telegram_requirements() SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_usage() SET search_path = public, pg_temp;


-- ──────────────────────────────────────────────────────────────────────────────
-- BLOCO 4 — DELETE tenants de teste (LIMPEZA, opcional)
-- ----------------------------------------------------------------------------
-- 5 tenants de teste / duplicados criados durante onboarding inicial.
-- Confira no Painel do Supabase antes de rodar.
-- ──────────────────────────────────────────────────────────────────────────────

-- Preview do que vai deletar:
SELECT tenant_id, clinic_name, admin_email, created_at FROM tenants
WHERE tenant_id IN ('teste-fb102743','teste-1df70125','teste-796c469d','teste-f7093d5b','clinica-voda-baeb0303')
ORDER BY created_at;

-- Se OK, descomenta e roda:
-- DELETE FROM tenant_doctors WHERE tenant_id IN ('teste-fb102743','teste-1df70125','teste-796c469d','teste-f7093d5b','clinica-voda-baeb0303');
-- DELETE FROM tenant_payments WHERE tenant_id IN ('teste-fb102743','teste-1df70125','teste-796c469d','teste-f7093d5b','clinica-voda-baeb0303');
-- DELETE FROM tenants WHERE tenant_id IN ('teste-fb102743','teste-1df70125','teste-796c469d','teste-f7093d5b','clinica-voda-baeb0303');


-- ──────────────────────────────────────────────────────────────────────────────
-- BLOCO 5 — SECURITY DEFINER views (revisar)
-- ----------------------------------------------------------------------------
-- 6 views usam SECURITY DEFINER (executa com permissão do creator, ignora RLS).
-- Pode ser intencional ou não. Liste e decida:
-- ──────────────────────────────────────────────────────────────────────────────

SELECT viewname, definition FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('appointments_detailed', 'tenant_overview', 'webhook_logs_summary',
                   'v_doctors_resolved', 'payments_dashboard', 'telegram_checkout_analysis');

-- Se quiser remover SECURITY DEFINER (vai usar permissão do user que consulta):
-- ALTER VIEW public.appointments_detailed SET (security_invoker = true);
-- ALTER VIEW public.tenant_overview SET (security_invoker = true);
-- ... etc


-- ──────────────────────────────────────────────────────────────────────────────
-- BLOCO 6 — Configurações via Dashboard (não SQL)
-- ----------------------------------------------------------------------------
-- Os 3 abaixo se resolvem na UI do Supabase, não via SQL:
--
-- 6a. auth_otp_long_expiry: Authentication → Settings →
--     "Email OTP expiration" → reduza de 3600s pra 600s (10min)
--
-- 6b. auth_leaked_password_protection: Authentication → Providers → Email →
--     habilite "Prevent use of leaked passwords"
--     (só plano Pro+; ignorar se free tier)
--
-- 6c. vulnerable_postgres_version: Settings → Infrastructure →
--     atualizar Postgres pra versão suportada (downtime ~1min)
--
-- ============================================================================
-- FIM
-- ============================================================================
