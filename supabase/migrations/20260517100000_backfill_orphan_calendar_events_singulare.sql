-- Backfill manual de 3 eventos calendar_sync orfaos do tenant 'singulare' em bookings.
-- Pareamento ja validado: homonyms_count=1 (nome unico em patients), slot_conflicts=0.
-- source='calendar_external' (valor permitido pela CHECK constraint da coluna).
-- Identificacao pra rollback cirurgico via notes LIKE 'Backfill 2026-05-17%':
--   DELETE FROM doctor_bookings
--   WHERE source='calendar_external' AND notes LIKE 'Backfill 2026-05-17%';
-- (FK tenant_calendar_events.booking_id e ON DELETE SET NULL, sem cascata.)
--
-- Hoje: 2026-05-17.
--   13/05 Vanessa  -> passado     -> status='completed' + incrementa patients counters
--   22/05 Joseli   -> futuro      -> status='booked'
--   29/05 Patricia -> futuro      -> status='booked'

BEGIN;

WITH new_bookings AS (
  INSERT INTO doctor_bookings (
    tenant_id, doctor_id, patient_id, patient_phone, patient_name,
    slot_start, slot_end, duration_minutes, status, calendar_event_id,
    source, notes, created_at, updated_at
  ) VALUES
    (
      'singulare', 'd52102f7-5507-4416-b902-b5ff5fc12668', 22,
      '+5511988923331', 'Vanessa de Oliveira Moraes',
      '2026-05-13 10:00:00-03'::timestamptz, '2026-05-13 11:00:00-03'::timestamptz, 60,
      'completed', 'jguejukjg5vs30dl524sc3v6m4',
      'calendar_external',
      'Backfill 2026-05-17: evento calendar_sync orfao linkado por match exato em patients (homonyms=1, slot_conflicts=0)',
      now(), now()
    ),
    (
      'singulare', 'd52102f7-5507-4416-b902-b5ff5fc12668', 59,
      '+5511975552666', 'Joseli Nicolino',
      '2026-05-22 16:00:00-03'::timestamptz, '2026-05-22 17:00:00-03'::timestamptz, 60,
      'booked', '6f5vg3biid7k47ajhku9f7u7e0',
      'calendar_external',
      'Backfill 2026-05-17: evento calendar_sync orfao linkado por match exato em patients (homonyms=1, slot_conflicts=0)',
      now(), now()
    ),
    (
      'singulare', 'd52102f7-5507-4416-b902-b5ff5fc12668', 60,
      '+5511987780153', 'Patricia da Silva Nascimento',
      '2026-05-29 14:00:00-03'::timestamptz, '2026-05-29 15:00:00-03'::timestamptz, 60,
      'booked', '3r2jmp060ooneg8scdpk56ticc',
      'calendar_external',
      'Backfill 2026-05-17: evento calendar_sync orfao linkado por match exato em patients (homonyms=1, slot_conflicts=0)',
      now(), now()
    )
  RETURNING id, calendar_event_id, tenant_id, patient_id, status, slot_start
)
-- 1. Linka tenant_calendar_events ao booking criado
, link_events AS (
  UPDATE tenant_calendar_events ce
  SET booking_id = nb.id
  FROM new_bookings nb
  WHERE ce.event_id = nb.calendar_event_id
    AND ce.tenant_id = nb.tenant_id
    AND ce.booking_id IS NULL  -- guard: nao sobrescreve link existente
  RETURNING ce.event_id
)
-- 2. Pra bookings completed (passados), atualiza counters do paciente
, update_patients AS (
  UPDATE patients p
  SET
    total_consultations = COALESCE(p.total_consultations, 0) + 1,
    last_visit_at = GREATEST(COALESCE(p.last_visit_at, '1970-01-01'::timestamptz), nb.slot_start),
    last_doctor = 'Dra. Paula Franzon',
    updated_at = now()
  FROM new_bookings nb
  WHERE p.id = nb.patient_id
    AND nb.status = 'completed'
  RETURNING p.id
)
SELECT COUNT(*) AS bookings_criados FROM new_bookings;

COMMIT;
