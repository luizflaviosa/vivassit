-- Auto-transição de doctor_bookings.status booked/confirmed → completed quando slot_end < now().
-- Resolve o gap em que o agente interno respondia "0 consultas atendidas" porque nada
-- transicionava o status após o slot vencer. Job pg_cron a cada 15 minutos.

create extension if not exists pg_cron with schema cron;

create or replace function public.fn_auto_complete_past_bookings()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.doctor_bookings
  set status = 'completed', updated_at = now()
  where status in ('booked','confirmed')
    and slot_end < now();
end;
$$;

-- Idempotente: remove versão anterior do job se existir, depois agenda.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'auto-complete-past-bookings') then
    perform cron.unschedule('auto-complete-past-bookings');
  end if;
  perform cron.schedule(
    'auto-complete-past-bookings',
    '*/15 * * * *',
    $job$select public.fn_auto_complete_past_bookings();$job$
  );
end $$;

-- Limpa fila atual.
select public.fn_auto_complete_past_bookings();
