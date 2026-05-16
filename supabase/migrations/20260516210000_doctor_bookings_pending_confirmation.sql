-- Fase 1 do fluxo "Proposta de reagendamento" — admin sugere novo slot pelo painel,
-- paciente confirma via WhatsApp dentro de 24h. Se expirar sem resposta, slot original é perdido.
--
-- Decisões definidas com o user:
--   TTL 24h           — confirmation_expires_at = proposed_at + 24h
--   Sem resposta       — status vira 'cancelled', slot liberado para todos
--   Bloqueia conflito  — unique index parcial inclui 'pending_confirmation'
--
-- Notificação Telegram e cleanup de Calendar event ficam para o workflow N8N
-- (Fase 3) — extensão pg_net não está disponível neste projeto.

-- 1. Colunas novas
ALTER TABLE public.doctor_bookings
  ADD COLUMN IF NOT EXISTS proposed_slot_start         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proposed_slot_end           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proposed_by                 UUID REFERENCES public.tenant_members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proposed_at                 TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmation_expires_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_slot_start         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_slot_end           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_calendar_event_id  TEXT;

COMMENT ON COLUMN public.doctor_bookings.proposed_slot_start IS
  'Novo slot sugerido pelo membro da clinica. Durante pending_confirmation slot_start ja aponta para o novo slot; este campo serve para auditoria.';
COMMENT ON COLUMN public.doctor_bookings.proposed_by IS
  'tenant_members.id do membro que propos o reagendamento.';
COMMENT ON COLUMN public.doctor_bookings.confirmation_expires_at IS
  'Deadline para resposta do paciente (proposed_at + 24h). Expirou sem resposta = booking cancelado pelo fn_expire_pending_confirmations.';
COMMENT ON COLUMN public.doctor_bookings.original_slot_start IS
  'slot_start antes da proposta — preservado para audit. Nao usado para rollback (slot original e perdido se expirar).';

-- 2. Index parcial para fn_expire_pending_confirmations achar expirados rapido
CREATE INDEX IF NOT EXISTS idx_doctor_bookings_pending_expiry
  ON public.doctor_bookings (confirmation_expires_at)
  WHERE status = 'pending_confirmation';

-- 3. Atualiza unique index para bloquear novo agendamento no slot enquanto pending_confirmation
--    O index antigo permitia segundo paciente reservar o mesmo slot durante pending.
DROP INDEX IF EXISTS public.idx_doctor_bookings_active_slot;
CREATE UNIQUE INDEX idx_doctor_bookings_active_slot
  ON public.doctor_bookings (doctor_id, slot_start)
  WHERE status IN ('booked', 'confirmed', 'pending_confirmation');

-- 4. Funcao que expira propostas vencidas
CREATE OR REPLACE FUNCTION public.fn_expire_pending_confirmations()
RETURNS TABLE (
  booking_id           UUID,
  tenant_id            VARCHAR,
  doctor_id            UUID,
  patient_phone        VARCHAR,
  patient_name         VARCHAR,
  proposed_slot_start  TIMESTAMPTZ,
  proposed_by          UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH expired AS (
    UPDATE public.doctor_bookings b
    SET status        = 'cancelled',
        cancelled_at  = NOW(),
        cancel_reason = COALESCE(b.cancel_reason || ' | ', '') ||
                        'Proposta de reagendamento expirou em 24h sem resposta do paciente.',
        updated_at    = NOW()
    WHERE b.status = 'pending_confirmation'
      AND b.confirmation_expires_at < NOW()
    RETURNING b.id, b.tenant_id, b.doctor_id, b.patient_phone, b.patient_name,
              b.proposed_slot_start, b.proposed_by
  )
  SELECT e.id, e.tenant_id, e.doctor_id, e.patient_phone, e.patient_name,
         e.proposed_slot_start, e.proposed_by
  FROM expired e;
END;
$$;

COMMENT ON FUNCTION public.fn_expire_pending_confirmations() IS
  'Move bookings com status=pending_confirmation cuja confirmation_expires_at passou para cancelled. Retorna os bookings afetados para o N8N notificar via Telegram e limpar Calendar event.';

-- 5. Schedule pg_cron a cada 5 minutos (idempotente)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fn_expire_pending_confirmations') THEN
    PERFORM cron.unschedule('fn_expire_pending_confirmations');
  END IF;
END $$;

SELECT cron.schedule(
  'fn_expire_pending_confirmations',
  '*/5 * * * *',
  $$SELECT public.fn_expire_pending_confirmations();$$
);
