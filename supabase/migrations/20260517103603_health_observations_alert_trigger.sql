-- Trigger postgres em health_observations que dispara alertas criticos
-- pra dados PASSIVOS fora da faixa fisiologica.
--
-- Coleta ATIVA (category = 'patient-reported'|'survey') NAO entra aqui:
-- alertas ativos sao avaliados em codigo pelo P04/endpoint /ingest com base
-- nos alert_thresholds da protocol_question.
--
-- Disparo: chama edge function trigger-alert via pg_net.
-- Pre-requisito: extensions `pg_net` habilitada. Configs do GUC:
--   - app.settings.supabase_url
--   - app.settings.service_role_key

create or replace function public.evaluate_health_observation_alert()
returns trigger
language plpgsql
security definer
as $$
declare
  v_should_alert boolean := false;
  v_severity text;
  v_reason text;
  v_supabase_url text;
  v_service_key text;
begin
  -- Apenas observacoes passivas/laboratoriais; ativas ficam fora.
  if new.category not in ('vital-signs','activity','sleep','laboratory') then
    return new;
  end if;
  -- Ignora dados de baixa qualidade (rejected = fisiologicamente impossivel).
  if new.data_quality_tag in ('rejected','noisy') then
    return new;
  end if;
  -- Sem valor numerico, nao avalia threshold.
  if new.value_numeric is null then
    return new;
  end if;

  -- Thresholds criticos cardio:
  --   SBP >= 180  -> emergencia hipertensiva
  --   DBP >= 110  -> emergencia hipertensiva
  --   SpO2 < 90   -> hipoxemia
  --   FC > 120 (em repouso, sem atividade no momento)
  --   FC < 40 (bradicardia severa)
  if new.loinc_code = '8480-6' and new.value_numeric >= 180 then
    v_should_alert := true;
    v_severity := 'critical';
    v_reason := format('PA sistolica %s mmHg (medicao passiva)', new.value_numeric::text);
  elsif new.loinc_code = '8462-4' and new.value_numeric >= 110 then
    v_should_alert := true;
    v_severity := 'critical';
    v_reason := format('PA diastolica %s mmHg (medicao passiva)', new.value_numeric::text);
  elsif new.loinc_code = '59408-5' and new.value_numeric < 90 then
    v_should_alert := true;
    v_severity := 'critical';
    v_reason := format('SpO2 %s%% (medicao passiva)', new.value_numeric::text);
  elsif new.loinc_code = '8867-4' and new.value_numeric > 120 and coalesce(new.is_active, false) = false then
    v_should_alert := true;
    v_severity := 'warning';
    v_reason := format('FC %s bpm em repouso (medicao passiva)', new.value_numeric::text);
  elsif new.loinc_code = '8867-4' and new.value_numeric < 40 then
    v_should_alert := true;
    v_severity := 'critical';
    v_reason := format('FC %s bpm (bradicardia severa, medicao passiva)', new.value_numeric::text);
  end if;

  if not v_should_alert then
    return new;
  end if;

  -- Le configs via GUC. Se faltar, registra warning e nao dispara HTTP
  -- (fallback: alert_events fica sem ser criado e cron N8N pode catch up depois).
  begin
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_service_key := current_setting('app.settings.service_role_key', true);
  exception when others then
    v_supabase_url := null;
    v_service_key := null;
  end;

  if v_supabase_url is null or v_service_key is null then
    raise warning 'evaluate_health_observation_alert: GUC app.settings.supabase_url/service_role_key nao configurado, alerta nao despachado (obs_id=%, severity=%, reason=%)',
      new.id, v_severity, v_reason;
    return new;
  end if;

  -- Dispara via pg_net (async). Falha silenciosa: nao bloqueia o INSERT.
  -- Envolvido em BEGIN/EXCEPTION pra blindar contra pg_net ausente.
  begin
    perform net.http_post(
      url := v_supabase_url || '/functions/v1/trigger-alert',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      ),
      body := jsonb_build_object(
        'tenant_id', new.tenant_id,
        'patient_id', new.patient_id,
        'severity', v_severity,
        'source', 'passive_outlier',
        'trigger_observation_id', new.id,
        'reason', v_reason
      )
    );
  exception when others then
    raise warning 'evaluate_health_observation_alert: dispatch via pg_net falhou (obs_id=%, severity=%, reason=%): %',
      new.id, v_severity, v_reason, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists health_observations_alert_trg on public.health_observations;
create trigger health_observations_alert_trg
  after insert on public.health_observations
  for each row execute function public.evaluate_health_observation_alert();

comment on function public.evaluate_health_observation_alert is
  'Avalia observacao passiva inserida; dispara trigger-alert via pg_net se cruzou threshold critico/warning. '
  'Sem efeito em coleta ativa (category=patient-reported|survey). Falha silenciosa se GUC nao configurada.';
