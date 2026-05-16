-- Fase 4 do fluxo "Proposta de reagendamento" — funcoes SQL que os tools T08
-- (confirmacao) e T09 (cancelamento) chamam quando o paciente responde via WhatsApp.
-- Atomico: status + cleanup dos proposed_*/original_* numa unica transaction.

-- fn_confirm_proposed_reschedule: paciente aceitou a proposta.
-- Booking sai de pending_confirmation -> booked, slot_start/end ja apontam pro novo,
-- apenas limpa os campos auxiliares. Retorna dados pro N8N atualizar Calendar
-- (tirar prefixo [PROPOSTO] do titulo) e remover label do Chatwoot.
CREATE OR REPLACE FUNCTION public.fn_confirm_proposed_reschedule(
  p_booking_id UUID,
  p_tenant_id  VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking RECORD;
BEGIN
  SELECT id, status, slot_start, slot_end, patient_name, calendar_event_id,
         doctor_id, conversation_id
  INTO v_booking
  FROM public.doctor_bookings
  WHERE id = p_booking_id
    AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason',  'not_found',
      'message', 'Agendamento nao encontrado.'
    );
  END IF;

  IF v_booking.status <> 'pending_confirmation' THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason',  'not_pending',
      'message', 'Agendamento nao esta com proposta pendente (status atual: ' || v_booking.status || ').'
    );
  END IF;

  UPDATE public.doctor_bookings
  SET status                      = 'booked',
      proposed_slot_start         = NULL,
      proposed_slot_end           = NULL,
      proposed_by                 = NULL,
      proposed_at                 = NULL,
      confirmation_expires_at     = NULL,
      original_slot_start         = NULL,
      original_slot_end           = NULL,
      original_calendar_event_id  = NULL,
      updated_at                  = NOW()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'success',           true,
    'booking_id',        v_booking.id,
    'slot_start',        v_booking.slot_start,
    'slot_end',          v_booking.slot_end,
    'patient_name',      v_booking.patient_name,
    'doctor_id',         v_booking.doctor_id,
    'conversation_id',   v_booking.conversation_id,
    'calendar_event_id', v_booking.calendar_event_id,
    'message',           'Reagendamento confirmado pelo paciente.'
  );
END;
$$;

COMMENT ON FUNCTION public.fn_confirm_proposed_reschedule(UUID, VARCHAR) IS
  'T08: paciente aceitou a proposta de novo horario. Limpa campos auxiliares e marca booked. Retorna dados pro N8N tirar prefixo [PROPOSTO] do Calendar event e remover label aguardando_reagendamento.';

-- fn_cancel_proposed_reschedule: paciente rejeitou (com ou sem alternativa).
-- Booking vai pra cancelled. Decisao do user: slot original perdido, vaga liberada.
-- Retorna dados pro N8N deletar Calendar event + remover label + (opcional) reabrir
-- conversa com agente normal pra negociar nova data.
CREATE OR REPLACE FUNCTION public.fn_cancel_proposed_reschedule(
  p_booking_id UUID,
  p_tenant_id  VARCHAR,
  p_reason     TEXT DEFAULT 'Paciente rejeitou a proposta de reagendamento.'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking RECORD;
BEGIN
  SELECT id, status, patient_name, calendar_event_id, doctor_id, conversation_id
  INTO v_booking
  FROM public.doctor_bookings
  WHERE id = p_booking_id
    AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason',  'not_found',
      'message', 'Agendamento nao encontrado.'
    );
  END IF;

  IF v_booking.status <> 'pending_confirmation' THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason',  'not_pending',
      'message', 'Agendamento nao esta com proposta pendente (status atual: ' || v_booking.status || ').'
    );
  END IF;

  UPDATE public.doctor_bookings
  SET status        = 'cancelled',
      cancelled_at  = NOW(),
      cancel_reason = COALESCE(cancel_reason || ' | ', '') || p_reason,
      updated_at    = NOW()
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'success',           true,
    'booking_id',        v_booking.id,
    'patient_name',      v_booking.patient_name,
    'doctor_id',         v_booking.doctor_id,
    'conversation_id',   v_booking.conversation_id,
    'calendar_event_id', v_booking.calendar_event_id,
    'message',           'Reagendamento rejeitado pelo paciente. Slot liberado.'
  );
END;
$$;

COMMENT ON FUNCTION public.fn_cancel_proposed_reschedule(UUID, VARCHAR, TEXT) IS
  'T09: paciente rejeitou a proposta. Marca booking como cancelled. Retorna dados pro N8N deletar Calendar event e remover label aguardando_reagendamento.';
