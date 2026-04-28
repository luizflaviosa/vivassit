-- scripts/nps-schema.sql
-- Migração idempotente: padroniza status de patient_feedback e cria índices
-- pra os fluxos NPS (cron de envio + lookup do Master Secretária).
--
-- Execute manualmente no Supabase SQL Editor antes de ativar o workflow
-- "3. NPS Pesquisa Pós-Consulta".

BEGIN;

-- 1. Defensive: rows legados sem status válido viram 'pending'.
-- Status aceitos: pending, responded, awaiting_followup, closed, send_failed.
UPDATE public.patient_feedback
SET status = COALESCE(NULLIF(status, ''), 'pending')
WHERE status IS NULL
   OR status = ''
   OR status NOT IN ('pending', 'responded', 'awaiting_followup', 'closed', 'send_failed');

-- 2. CHECK constraint (idempotente: drop+create)
ALTER TABLE public.patient_feedback
  DROP CONSTRAINT IF EXISTS patient_feedback_status_check;

ALTER TABLE public.patient_feedback
  ADD CONSTRAINT patient_feedback_status_check
  CHECK (status IN ('pending', 'responded', 'awaiting_followup', 'closed', 'send_failed'));

-- 3. Default em status (pra inserts que omitem)
ALTER TABLE public.patient_feedback
  ALTER COLUMN status SET DEFAULT 'pending';

-- 4. Índices pra performance
-- Lookup do Master Secretária (tenant + telefone + status + janela 24h)
CREATE INDEX IF NOT EXISTS idx_patient_feedback_lookup
  ON public.patient_feedback (tenant_id, patient_phone, status, sent_at DESC);

-- Dedupe do cron (tenant + data da consulta)
CREATE INDEX IF NOT EXISTS idx_patient_feedback_dedupe
  ON public.patient_feedback (tenant_id, appointment_date);

COMMIT;
