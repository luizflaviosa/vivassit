-- Previne double-booking em doctor_bookings entre propose e execute do agente interno.
-- Antes: nada impedia 2 inserts simultaneos no mesmo slot do mesmo medico.
-- Agora: GiST exclude constraint usa tstzrange + && operator pra recusar
-- inserts/updates que sobreponham booking nao-cancelled existente.
--
-- Range usado: '[)' (inclusive no inicio, exclusive no fim) — duas consultas
-- back-to-back (uma termina 15h, outra comeca 15h) NAO conflitam.

create extension if not exists btree_gist;

alter table public.doctor_bookings
  add constraint doctor_bookings_no_overlap
  exclude using gist (
    doctor_id with =,
    tstzrange(slot_start, slot_end, '[)') with &&
  )
  where (status <> 'cancelled');
