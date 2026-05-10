-- Reverte booking marcado completed mas com slot futuro (data sujo identificada em 2026-05-10).
-- Idempotente: NO-OP em ambientes onde o booking já está consistente.
update public.doctor_bookings
set status = 'booked', updated_at = now()
where tenant_id = 'singulare'
  and patient_name ilike 'valentina%'
  and status = 'completed'
  and slot_start > now();
