-- Simplifica o trigger de alertas: em vez de chamar trigger-alert via pg_net
-- (que exigiria GUCs nao acessiveis no Supabase managed), o trigger agora
-- INSERE diretamente em alert_events com notified_*=false.
--
-- Dispatch real (WhatsApp + Chatwoot) e responsabilidade do P04 / cron que
-- polla alert_events.notified_chatwoot=false e notified_doctor_whatsapp=false.
--
-- Beneficio adicional: nao depende de pg_net nem de configuracao manual de
-- secrets. INSERT direto sempre funciona.

create or replace function public.evaluate_health_observation_alert()
returns trigger
language plpgsql
security definer
as $$
declare
  v_should_alert boolean := false;
  v_severity text;
  v_reason text;
begin
  -- Apenas observacoes passivas/laboratoriais; ativas alertam via codigo (ingest endpoint).
  if new.category not in ('vital-signs','activity','sleep','laboratory') then
    return new;
  end if;
  if new.data_quality_tag in ('rejected','noisy') then
    return new;
  end if;
  if new.value_numeric is null then
    return new;
  end if;

  -- Thresholds cardio:
  if new.loinc_code = '8480-6' and new.value_numeric >= 180 then
    v_should_alert := true; v_severity := 'critical';
    v_reason := format('PA sistolica %s mmHg (medicao passiva)', new.value_numeric::text);
  elsif new.loinc_code = '8462-4' and new.value_numeric >= 110 then
    v_should_alert := true; v_severity := 'critical';
    v_reason := format('PA diastolica %s mmHg (medicao passiva)', new.value_numeric::text);
  elsif new.loinc_code = '59408-5' and new.value_numeric < 90 then
    v_should_alert := true; v_severity := 'critical';
    v_reason := format('SpO2 %s%% (medicao passiva)', new.value_numeric::text);
  elsif new.loinc_code = '8867-4' and new.value_numeric > 120 and coalesce(new.is_active, false) = false then
    v_should_alert := true; v_severity := 'warning';
    v_reason := format('FC %s bpm em repouso (medicao passiva)', new.value_numeric::text);
  elsif new.loinc_code = '8867-4' and new.value_numeric < 40 then
    v_should_alert := true; v_severity := 'critical';
    v_reason := format('FC %s bpm (bradicardia severa, medicao passiva)', new.value_numeric::text);
  end if;

  if not v_should_alert then
    return new;
  end if;

  -- INSERT direto em alert_events. Nao dispara HTTP — dispatch e responsabilidade
  -- de P04/cron que polla notified_*=false.
  insert into public.alert_events (
    tenant_id, patient_id, severity, source, trigger_observation_id, reason,
    payload, notified_chatwoot, notified_doctor_whatsapp
  ) values (
    new.tenant_id,
    new.patient_id,
    v_severity,
    'passive_outlier',
    new.id,
    v_reason,
    jsonb_build_object(
      'loinc_code', new.loinc_code,
      'value_numeric', new.value_numeric,
      'unit', new.unit,
      'effective_time', new.effective_time
    ),
    false,
    false
  );

  return new;
exception when others then
  -- Defesa absoluta: nunca bloquear o INSERT da observacao por causa do alerta.
  raise warning 'evaluate_health_observation_alert falhou (obs_id=%, severity=%, reason=%): %',
    new.id, v_severity, v_reason, sqlerrm;
  return new;
end;
$$;

-- Trigger ja existe da migration anterior (health_observations_alert_trg).
-- A nova versao da funcao substitui a antiga via CREATE OR REPLACE.

comment on function public.evaluate_health_observation_alert is
  'Avalia observacao passiva inserida; INSERE direto em alert_events se cruzou threshold. '
  'Nao usa pg_net (sem dependencia de GUC). Dispatch real e do P04/cron via alert_events.notified_*=false.';
