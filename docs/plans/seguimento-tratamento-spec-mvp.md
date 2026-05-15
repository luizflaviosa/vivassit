# Spec MVP — Modulo Seguimento de Tratamento

**Data:** 2026-05-11
**Status:** Spec pre-implementacao, revisada apos integracao com trabalho ja em prod
**Problem map:** [docs/plans/seguimento-tratamento-problem-map.md](seguimento-tratamento-problem-map.md)
**Projeto irmao (mergeado em main):** [docs/superpowers/plans/2026-05-10-telemonitoramento-cardiologico.md](../superpowers/plans/2026-05-10-telemonitoramento-cardiologico.md)
**Handoff mobile:** [docs/HANDOFF-MOBILE.md](../HANDOFF-MOBILE.md)
**Spec biomarcadores:** [docs/health-data-spec.md](../health-data-spec.md)
**Piloto:** Cardiologia (1 medico parceiro, 30-50 pacientes, 90 dias)

---

## Estado real (10-11/05/2026)

### Ja em prod no `main`

| Peca | Onde |
|---|---|
| Tabela `health_observations` (FHIR/LOINC, RLS, BRIN, 5 linhas teste) | `supabase/migrations/20260510212828_health_observations.sql` |
| `patients.health_collection_token` (UUID secreto por paciente) | `supabase/migrations/20260510220652_patients_health_collection_token.sql` |
| `patient_consents` LGPD (3 tipos) + retencao 24m via pg_cron | `supabase/migrations/20260510222117_patient_consents_and_retention.sql` |
| Edge fn `ingest-vitals` (sem auth, recebe `patient_id` + `tenant_id`) | `supabase/functions/ingest-vitals/` |
| Pagina publica `/saude/[token]` (paciente preenche FC, PA, peso, temp, SpO2, glicemia) | `app/app/saude/[token]/page.tsx` |
| API `/api/saude/[token]` (GET) e `/api/saude/[token]/ingest` (POST) | `app/app/api/saude/[token]/` |
| Drawer paciente em `/painel/pacientes` mostra "Saude cardiaca" + botao gerar link | `app/app/painel/...` |
| `/privacidade/saude` (politica LGPD publica) | `app/app/privacidade/saude/page.tsx` |
| Paciente teste Andreia Vieira (id 56) com 9 medicoes reais no banco | banco |

### Scaffold pronto, build pendente (fase 2)

- App Flutter `mobile/singulare_health/` — 11 arquivos Dart, services completos. Aguarda Flutter SDK + Xcode capability + AASA/assetlinks + Apple Dev Account + Play Console review. Detalhes em [docs/HANDOFF-MOBILE.md](../HANDOFF-MOBILE.md).

### Em construcao paralela (MVP de passivo)

- **iOS Shortcuts (app Atalhos)** captando dados do Apple Health e postando no nosso endpoint de coleta. Substitui o app Flutter no MVP — zero install friction, sem Apple Developer review pra distribuicao, paciente adiciona via link iCloud.

### Decisoes ja batidas (nao revisitar sem motivo forte)

| Decisao | Justificativa registrada |
|---|---|
| Auth do paciente = `health_collection_token` (UUID) | Pula OTP+Twilio; mesmo modelo web/mobile/Shortcuts; sem `auth_user_id` |
| Web e mobile reusam o mesmo token | Simplicidade; revogacao centralizada |
| Consent auto na 1a abertura do link | LGPD aceita IP+UA como prova (registrado em `patient_consents`) |
| `ai_inference` consent SEPARADO | Granularidade — paciente pode permitir monitoramento sem IA |
| HRV SDNN (iOS) + RMSSD (Android) via `device_provenance.metric_type` | iOS so tem SDNN, Android so tem RMSSD |
| Retencao 24m | LGPD minimizacao; prontuario formal nao e afetado (vive em outras tabelas) |

---

## Filosofia revisada

1. **Reusar tudo o que ja existe.** Token, tabelas, edge function, pagina publica, drawer — todos sao building blocks pro modulo de seguimento. Nao recriar.
2. **3 canais de coleta convergem em `health_observations`:**
   - **Passivo iOS Shortcut** (MVP) — Apple Health -> `/api/saude/[token]/healthkit-shortcut`
   - **Passivo Flutter mobile** (fase 2) — HealthKit/Health Connect -> edge fn `ingest-vitals`
   - **Ativo via link web** (ja existe) — paciente digita manualmente em `/saude/[token]`
   - **Ativo via WhatsApp + protocolo** (NOVO neste modulo) — P04 N8N pergunta, paciente responde, grava como `category='patient-reported'`
3. **Funcionar antes do app mobile.** Modulo entrega valor em pacientes iOS (Shortcut) e pacientes WhatsApp-only desde dia 1. Flutter mobile abre Android e background robusto na fase 2.
4. **Coordenacao zero com mais sessoes.** A peca paralela ja foi mergeada. Nosso modulo so adiciona tabelas/endpoints proprios em cima.
5. **Audit trail desde o primeiro alerta.** `alert_events` registra tudo. Defesa regulatoria.
6. **Templates pre-aprovados pelo medico parceiro** antes de qualquer UI de configuracao avancada.

---

## Diff com o que ja existe

| Capacidade | Status | O que falta |
|---|---|---|
| `health_observations` | Em prod | Expandir CHECK `category` pra aceitar `'patient-reported'` (Task 1) |
| `patient_consents` | Em prod | Nada — 3 tipos cobrem nosso uso (`health_monitoring` cobre WhatsApp ativo) |
| `health_collection_token` | Em prod | Nada |
| `ingest-vitals` | Em prod | Nada — usamos como esta pra passivo Flutter futuro |
| `/saude/[token]` + `/api/saude/[token]/ingest` | Em prod | **Estender** pra renderizar perguntas do protocolo do paciente alem de campos livres (parte da Task 4) |
| Endpoint Shortcut iOS | Nao existe | **Novo** (Task 4b) |
| `treatment_protocols` + `protocol_questions` + `patient_protocols` | Nao existe | Novo (Task 2-3) |
| `alert_events` | Nao existe | Novo (Task 2) |
| Trigger postgres em `health_observations` (alertas) | Nao existe | Novo (Task 6) |
| Edge fn `trigger-alert` | Nao existe | Novo (Task 5) |
| Edge fn / route `generate-briefing` PDF | Nao existe | Novo (Task 7) |
| Workflow N8N P04 Seguimento | Nao existe | Novo (Task 8) |
| UI painel — gestao de protocolos | Nao existe | Novo (Task 9) |
| UI painel — atribuir paciente a protocolo | Nao existe | Novo (Task 10) |
| Cron diario de briefing pre-consulta | Nao existe | Novo (Task 11) |
| Piloto manual | Nao iniciado | **Pode rodar HOJE** com `/saude/[token]` (Task 12) |

**Coisas que estavam no spec antigo e foram CORTADAS:**
- ~~Edge fn `link-patient`~~ — auth e por token, nao via Supabase Auth/OTP
- ~~Migration `patients.auth_user_id`~~ — token-based, nao precisa
- ~~Migration `patient_consents`~~ — ja em prod
- ~~Migration `patient_devices`~~ — nao usado no MVP Shortcut; reavaliar quando Flutter for buildado
- ~~Edge fn `ingest-active-survey`~~ — substituida por extensao do endpoint `/api/saude/[token]/ingest` existente
- ~~Pedido formal pra peca paralela~~ — peca mergeada, sem coordenacao pendente

---

## Arquitetura — visao geral

```
COLETA PASSIVA (iOS Shortcut, MVP)
  iOS Atalhos --(diario, automation)--> POST /api/saude/[token]/healthkit-shortcut
                                                 |
                                                 v
                                       [health_observations]
                                       category=vital-signs|activity|sleep
                                       device_provenance.source='ios_shortcut'

COLETA ATIVA — duas portas pro mesmo token
  (a) Web manual:
      Paciente abre /saude/[token]
      Preenche FC/PA/peso/etc
      POST /api/saude/[token]/ingest

  (b) Conversa WhatsApp:
      P04 cron envia pergunta semanal
      Paciente responde texto livre
      N8N classifica/extrai
      POST /api/saude/[token]/ingest com protocol_question_id e value
      category='patient-reported'

  ambos --> [health_observations]

ALERTAS UNIFICADOS
  [health_observations INSERT trigger]
       |
       +-- LOINC critica (SBP>=180, DBP>=110, SpO2<90, HR>120 sustentado)
             |
             v
       POST /functions/v1/trigger-alert
             |
             +-- INSERT alert_events
             +-- Chatwoot inbox (Dra. Paula) — sempre
             +-- WhatsApp pessoal medico + secretaria (critical) com escalada 15min

BRIEFING PRE-CONSULTA
  Cron diario 00:00 (N8N)
       |
       +-- query appointments D+1 onde paciente.patient_protocol = active
             |
             v
       POST /functions/v1/generate-briefing
             |
             +-- query health_observations 90d
             +-- query alert_events 90d
             +-- LLM gera 3-bullet TL;DR
             +-- renderiza PDF (1 pagina, 4 quadrantes)
             +-- upload Supabase Storage briefings/<tenant>/<patient>/<consult>.pdf
             +-- update appointments.briefing_pdf_url
             +-- WhatsApp pessoal medico 1h antes da consulta com link
```

---

## Task 1 — Migration: expandir CHECK `health_observations.category`

**Justificativa:** coleta ativa por WhatsApp (MMAS-8, sintomas livres, satisfacao) nao cai em `vital-signs|activity|sleep|laboratory`. Tabela em prod tem ~5+ linhas; alteracao segura.

**Files:**
- Create: `supabase/migrations/<TIMESTAMP>_health_observations_category_extend.sql`

```sql
alter table public.health_observations
  drop constraint if exists health_observations_category_check;

alter table public.health_observations
  add constraint health_observations_category_check
  check (category in (
    'vital-signs','activity','sleep','laboratory',
    'patient-reported','survey'
  ));

comment on column public.health_observations.category is
  'vital-signs|activity|sleep|laboratory = passivo (ingest-vitals, ios_shortcut, manual web). '
  'patient-reported|survey = ativo (whatsapp via P04 ou perguntas do protocolo na pagina /saude/[token]).';
```

---

## Task 2 — Migration: tabelas do modulo seguimento

**Files:**
- Create: `supabase/migrations/<TIMESTAMP>_treatment_protocols.sql`

```sql
-- Templates de protocolo de seguimento.
create table public.treatment_protocols (
  id bigserial primary key,
  tenant_id text,  -- null = template global Singulare
  specialty text not null check (specialty in ('cardiologia')),  -- expandivel
  slug text not null,
  name text not null,
  description text,
  duration_weeks int not null default 12,
  cadence_days int not null default 7,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, specialty, slug)
);

create index treatment_protocols_tenant_idx
  on public.treatment_protocols (tenant_id, specialty)
  where is_active = true;

alter table public.treatment_protocols enable row level security;

create policy treatment_protocols_read on public.treatment_protocols
  for select to authenticated
  using (tenant_id is null or public.is_tenant_member(tenant_id));

create policy treatment_protocols_write on public.treatment_protocols
  for all to authenticated
  using (tenant_id is not null and public.is_tenant_member(tenant_id))
  with check (tenant_id is not null and public.is_tenant_member(tenant_id));

-- Perguntas por protocolo.
create table public.protocol_questions (
  id bigserial primary key,
  protocol_id bigint not null references public.treatment_protocols(id) on delete cascade,
  ordering int not null default 0,
  kind text not null check (kind in (
    'adherence_mmas8','symptom_open','symptom_keyword',
    'pa_self_report','weight_self_report','activity_self_report',
    'kccq_short','satisfaction'
  )),
  prompt_pt text not null,
  loinc_code text not null,
  expected_unit text,
  dedup_loinc_codes text[] default '{}',
  alert_thresholds jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index protocol_questions_protocol_idx
  on public.protocol_questions (protocol_id, ordering)
  where is_active = true;

alter table public.protocol_questions enable row level security;

create policy protocol_questions_read on public.protocol_questions
  for select to authenticated
  using (
    protocol_id in (
      select id from public.treatment_protocols
      where tenant_id is null or public.is_tenant_member(tenant_id)
    )
  );

create policy protocol_questions_write on public.protocol_questions
  for all to authenticated
  using (
    protocol_id in (
      select id from public.treatment_protocols
      where tenant_id is not null and public.is_tenant_member(tenant_id)
    )
  )
  with check (
    protocol_id in (
      select id from public.treatment_protocols
      where tenant_id is not null and public.is_tenant_member(tenant_id)
    )
  );

-- Atribuicao paciente <-> protocolo.
create table public.patient_protocols (
  id bigserial primary key,
  patient_id bigint not null references public.patients(id) on delete cascade,
  tenant_id text not null,
  protocol_id bigint not null references public.treatment_protocols(id) on delete restrict,
  doctor_id bigint references public.tenant_doctors(id) on delete set null,
  started_at timestamptz not null default now(),
  ends_at timestamptz,
  next_consultation_at timestamptz,
  last_dispatched_at timestamptz,
  status text not null default 'active' check (status in ('active','paused','completed','abandoned')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, protocol_id, started_at)
);

create index patient_protocols_active_idx
  on public.patient_protocols (tenant_id, status, next_consultation_at)
  where status = 'active';

alter table public.patient_protocols enable row level security;

create policy patient_protocols_tenant_all on public.patient_protocols
  for all to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

-- Audit trail de alertas (defesa regulatoria).
create table public.alert_events (
  id bigserial primary key,
  patient_id bigint not null references public.patients(id) on delete cascade,
  tenant_id text not null,
  severity text not null check (severity in ('info','warning','critical')),
  source text not null check (source in (
    'passive_outlier','active_keyword','active_threshold','manual'
  )),
  trigger_observation_id bigint references public.health_observations(id) on delete set null,
  reason text,
  payload jsonb,
  notified_chatwoot boolean default false,
  notified_doctor_whatsapp boolean default false,
  acknowledged_at timestamptz,
  acknowledged_by bigint references public.tenant_members(id) on delete set null,
  action_taken text,
  created_at timestamptz not null default now()
);

create index alert_events_patient_idx
  on public.alert_events (patient_id, created_at desc);
create index alert_events_tenant_severity_idx
  on public.alert_events (tenant_id, severity, created_at desc);

alter table public.alert_events enable row level security;

create policy alert_events_tenant_read on public.alert_events
  for select to authenticated
  using (public.is_tenant_member(tenant_id));
-- INSERT/UPDATE so via edge function trigger-alert (service_role)

comment on table public.treatment_protocols is 'Templates de protocolo de seguimento. tenant_id null = global.';
comment on table public.patient_protocols is 'Atribuicao paciente <-> protocolo. Alimenta cron P04 e cron de briefing.';
comment on table public.alert_events is 'Audit trail de alertas clinicos. Defesa regulatoria ANVISA + LGPD.';
```

---

## Task 3 — Seed dos 5 templates cardio

**Files:**
- Create: `supabase/migrations/<TIMESTAMP>_seed_cardio_protocols.sql`

5 templates globais (tenant_id null): `hipertenso`, `pos-iam`, `icc`, `fa`, `dislipidemia`. Cada um com 4-6 perguntas semanais, `dedup_loinc_codes` populados.

**Exemplo (hipertenso):**

```sql
with p as (
  insert into public.treatment_protocols (tenant_id, specialty, slug, name, description, duration_weeks, cadence_days)
  values (null, 'cardiologia', 'hipertenso', 'Hipertensao Arterial Sistemica',
          'Seguimento de paciente com HAS estavel.', 12, 7)
  returning id
)
insert into public.protocol_questions
  (protocol_id, ordering, kind, prompt_pt, loinc_code, expected_unit, dedup_loinc_codes, alert_thresholds)
select p.id, ordering, kind, prompt_pt, loinc_code, expected_unit, dedup_loinc_codes, alert_thresholds::jsonb
from p, (values
  (1, 'adherence_mmas8',     'Voce tomou seus remedios todos os dias dessa semana?',  '71799-1',                NULL,         '{}'::text[],
     '{"yellow":"missed_days >= 2","red":"missed_days >= 4"}'),
  (2, 'pa_self_report',      'Mediu sua pressao essa semana? Qual foi a maior?',      'singulare:pa-self',     'mmHg',       '{"8480-6","8462-4"}'::text[],
     '{"yellow":"sbp >= 160 or dbp >= 100","red":"sbp >= 180 or dbp >= 110"}'),
  (3, 'symptom_keyword',     'Sentiu dor no peito, falta de ar ou tontura forte?',    'singulare:symptom-cardio','',          '{}'::text[],
     '{"red":"answer = yes"}'),
  (4, 'activity_self_report','Quantas vezes voce caminhou ou se exercitou?',           'singulare:activity-self','sessoes/sem','{"55423-8","41950-7"}'::text[],
     '{"yellow":"sessions < 2"}'),
  (5, 'weight_self_report',  'Qual seu peso atual?',                                   '29463-7',                'kg',         '{}'::text[],
     '{"yellow":"delta_kg_4wk >= 2"}')
) as q(ordering, kind, prompt_pt, loinc_code, expected_unit, dedup_loinc_codes, alert_thresholds);
```

(Outros 4 protocolos seguem mesmo molde — definidos no commit final.)

---

## Task 4 — Estender `/api/saude/[token]/ingest` pra coleta ativa por protocolo

**Files:**
- Edit: `app/app/api/saude/[token]/ingest/route.ts`

**Hoje:** aceita lista de `{loinc_code, value}` e grava em `health_observations` com `category='vital-signs'`.

**Estender:**
- Aceitar payload com `protocol_question_id` opcional. Se presente:
  - Resolver `patient_protocols.active` + `protocol_questions`.
  - Gravar com `category='patient-reported'`, `device_provenance.source='whatsapp_active'` (ou `web_protocol` se veio da pagina), `device_provenance.protocol_id`, `device_provenance.question_id`, `device_provenance.confidence`.
  - Avaliar `alert_thresholds` da pergunta; se bate red/yellow, chamar `trigger-alert`.
- Aceitar `value_text` alem de `value_numeric` (pra `symptom_open` etc).

**Schema (request body):**

```typescript
{
  observations: Array<{
    loinc_code: string,
    value_numeric?: number,
    value_text?: string,
    unit?: string,
    effective_time?: string,         // default now()
    // ativo:
    protocol_question_id?: number,
    confidence?: number,             // 0..1
    raw_text?: string,               // pra patient-reported, preservar resposta original
  }>,
  source: 'web_manual' | 'whatsapp_active' | 'web_protocol',
}
```

---

## Task 4b — Endpoint pro iOS Shortcut

**Files:**
- Create: `app/app/api/saude/[token]/healthkit-shortcut/route.ts`

**Justificativa:** payload do app Atalhos do iOS e granular (cada "Get Health Sample" retorna ja com tipo, valor, unidade, intervalo). Diferente do payload web manual.

**Schema (request body — desenhado pra Shortcuts):**

```typescript
{
  samples: Array<{
    // Sample type vem como string do Shortcuts; mapeamos pra LOINC
    type: 'heart_rate' | 'resting_heart_rate' | 'hrv_sdnn'
        | 'steps' | 'distance' | 'active_energy'
        | 'blood_pressure_systolic' | 'blood_pressure_diastolic'
        | 'blood_glucose' | 'oxygen_saturation' | 'weight' | 'body_temperature'
        | 'sleep_duration',
    value: number,
    unit: string,                    // 'bpm' | 'mmHg' | 'kg' | etc
    start_date: string,              // ISO
    end_date?: string,
    source_name?: string,            // 'Apple Watch' | 'iPhone' | nome do device
  }>,
  shortcut_version?: string,         // pra evoluir o atalho com migracoes seguras
}
```

**Logica:**
1. Valida token, resolve `patient_id` + `tenant_id`.
2. Mapeia `samples[].type` -> LOINC + categoria (tabela hardcoded server-side).
3. Conversoes de unidade pra SI (mesma logica de [docs/health-data-spec.md](../health-data-spec.md)).
4. Insere em `health_observations` com `device_provenance.source='ios_shortcut'`, `device_provenance.shortcut_version`, `device_provenance.source_name`.
5. Aplica `classifyQuality` igual `ingest-vitals` (faixas fisiologicas).
6. Retorna `{accepted, rejected, outliers, batch_id}`.

**Distribuicao do Shortcut:**
- `/saude/[token]` na pagina, detecta iOS e oferece botao "Adicionar coleta automatica" com link `https://www.icloud.com/shortcuts/<id>?token=<token>` (URL canonica do iCloud).
- Atalho roda diariamente (Personal Automation 08:00, "Run with Automation" sem confirmacao depois da 1a vez).
- Atalho pega ultimas 24h dos samples relevantes e POST.

**Off-scope deste spec:** desenho interno do atalho. Voce esta construindo em paralelo; o endpoint suporta o que o atalho enviar.

---

## Task 5 — Edge fn `trigger-alert`

**Files:**
- Create: `supabase/functions/trigger-alert/index.ts`
- Create: `supabase/functions/trigger-alert/deno.json`

**Schema input:**

```typescript
{
  tenant_id: string,
  patient_id: number,
  severity: 'warning' | 'critical',
  source: 'passive_outlier' | 'active_keyword' | 'active_threshold' | 'manual',
  trigger_observation_id?: number,
  reason: string,
  payload?: Record<string, unknown>,
}
```

**Logica:**
1. `insert into alert_events`.
2. Resolve `tenant_doctors` + `tenant_members` (role admin/owner + secretarias) responsaveis.
3. **Critical:**
   - Manda WhatsApp pessoal pro medico **e** secretaria simultaneo via Evolution.
   - Cria conversa no Chatwoot (inbox 3, tag `alerta-clinico`) marcada alta prioridade.
   - Se medico nao ack em 15min, escala (notifica de novo).
4. **Warning:**
   - Chatwoot only, sem WhatsApp pessoal.
5. Atualiza `alert_events.notified_*` conforme sucesso.

**Tom da mensagem pro medico:**
> "Dra., a Sra. Maria de 68 anos (paciente em seguimento HAS) acabou de relatar dor no peito. Liguei pra confirmar com ela? [confirmar]"

---

## Task 6 — Trigger Postgres em `health_observations` (passivo critico)

**Files:**
- Create: `supabase/migrations/<TIMESTAMP>_health_observations_critical_trigger.sql`

```sql
-- pg_net obrigatorio (validar com singulare-db antes)
create or replace function public.evaluate_health_observation_alert()
returns trigger language plpgsql security definer as $$
declare
  v_should_alert boolean := false;
  v_severity text;
  v_reason text;
begin
  -- Apenas observacoes passivas; ativas alertam via Task 4 (endpoint).
  if new.category not in ('vital-signs','activity','sleep','laboratory') then
    return new;
  end if;
  if new.data_quality_tag in ('rejected','noisy') then
    return new;
  end if;

  if new.loinc_code = '8480-6' and new.value_numeric >= 180 then
    v_should_alert := true; v_severity := 'critical';
    v_reason := format('PA sistolica %.0f mmHg em medicao passiva', new.value_numeric);
  elsif new.loinc_code = '8462-4' and new.value_numeric >= 110 then
    v_should_alert := true; v_severity := 'critical';
    v_reason := format('PA diastolica %.0f mmHg em medicao passiva', new.value_numeric);
  elsif new.loinc_code = '59408-5' and new.value_numeric < 90 then
    v_should_alert := true; v_severity := 'critical';
    v_reason := format('SpO2 %.0f%% em medicao passiva', new.value_numeric);
  end if;

  if v_should_alert then
    perform net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/trigger-alert',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
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
  end if;

  return new;
end;
$$;

create trigger health_observations_alert_trg
  after insert on public.health_observations
  for each row execute function public.evaluate_health_observation_alert();
```

**Pre-requisito:** extension `pg_net` habilitada. Conferir com singulare-db. Alternativa fallback: trigger insere em `alert_events` direto e cron N8N puxa pendentes.

---

## Task 7 — Edge fn / route `generate-briefing` (PDF)

**Files:**
- Create: `app/app/api/seguimento/briefing/route.ts` (Vercel; OK pra PDF render)
- Create: `app/lib/seguimento/render-briefing-pdf.ts`

**Por que Vercel route em vez de edge function Supabase:**
- Render de PDF (puppeteer ou react-pdf) e mais leve no Vercel Node runtime
- Acesso a fontes/css via filesystem
- Re-uso de helpers TS existentes do painel
- Cabe na hobby tier

**Input:**

```typescript
{
  tenant_id: string,
  patient_protocol_id: number,
  appointment_id?: number,
}
```

**Logica:**
1. Resolve `patient_id`, periodo (90d ate `next_consultation_at`).
2. Query agregada em `health_observations` por LOINC e semana.
3. Query `alert_events` no periodo.
4. Calcula bandeira clinica:
   - Verde: adesao >= 80%, sem critical, sinais em meta
   - Amarelo: adesao 60-79% OU >= 1 warning OU sinais fora
   - Vermelho: adesao < 60% OU >= 1 critical
5. Gera 3-bullet TL;DR via OpenAI (gpt-4o-mini) com prompt fechado.
6. Renderiza PDF (react-pdf) com 1 pagina, 4 quadrantes + linha do tempo.
7. Upload pra Supabase Storage `briefings/<tenant>/<patient>/<appointment>.pdf`.
8. `update appointments set briefing_pdf_url = ?`.
9. Retorna `{pdf_url, severity, summary}`.

**Migration auxiliar:**

```sql
alter table public.appointments
  add column if not exists briefing_pdf_url text;
```

---

## Task 8 — Workflow N8N "P04 Seguimento"

**Files:**
- Create: `n8n/workflows/<id>-p04-seguimento.json`

**Decisao: P04 separado de P03.** P03 e reativo/conversacional (agenda); P04 e proativo/cron com logica de protocolo. Misturar polui o systemMessage do P03.

**Compartilhamento:** webhook Evolution recebe TODA mensagem; classifier (primeiro node N8N) decide rota: P03 (default) ou P04 (se paciente tem `patient_protocol.active` E ultima mensagem do P04 foi pergunta).

**Nodes P04:**

```
[Cron: segunda-feira 09:00 BRT]
    |
    v
[Postgres: select patient_protocols.active where
   last_dispatched_at is null
   or last_dispatched_at < now() - (cadence_days * interval '1 day')]
    |
    v
[Loop por paciente]
    |
    +-- [Postgres: protocol_questions ordered by ordering]
    |       |
    +-- [Loop por pergunta]
    |       |
    |       v
    |    [Dedup: ja temos observacao com loinc_code OR dedup_loinc_codes
    |     nos ultimos 7 dias em health_observations?]
    |       |
    |       v
    |    [SIM: skip] ou [NAO: send WhatsApp via Evolution]
    |
    v
[Update patient_protocols.last_dispatched_at = now()]

---

[Webhook Evolution: mensagem do paciente]
    |
    v
[Classifier (LLM): identifica se e resposta a pergunta pendente do P04]
    |
    v
[IF sim:]
    +-- [resolve qual protocol_question esta pendente]
    +-- [extract intent+value via NLU (LLM)]
    +-- [POST /api/saude/[token]/ingest com protocol_question_id]
    +-- [IF alert retornado: POST /functions/v1/trigger-alert]
    +-- [reply ao paciente: "Obrigada, anotei!" ou "Sinto muito, vou conectar com a secretaria"]

[IF nao:]
    +-- [encaminha pro P03 (agendamento/duvida)]
```

---

## Task 9 — UI painel: gestao de protocolos

**Files:**
- Create: `app/app/painel/seguimento/protocols/page.tsx`
- Create: `app/app/painel/seguimento/protocols/[id]/page.tsx`
- Create: `app/app/painel/seguimento/protocols/components/protocol-form.tsx`
- Create: `app/lib/seguimento/protocols.ts`

**Telas:**
- Lista: templates globais (tenant_id null) + customizados do tenant; CTA "Duplicar template" pra editar.
- Detalhe: edita perguntas (ordering drag-drop, prompt_pt, alert_thresholds via JSON editor minimalista), preview da mensagem WhatsApp e da pergunta na pagina `/saude/[token]`.

**Visual:** Apple/Linear/Vercel, hairlines `1px solid`, violet `#6E56CF`, sem emojis.

---

## Task 10 — UI painel: atribuir paciente a protocolo

**Files:**
- Edit: `app/app/painel/pacientes/[id]/page.tsx` (drawer ja existe — adicionar secao "Seguimento")
- Create: `app/app/painel/pacientes/[id]/seguimento/components/assign-protocol-modal.tsx`

**Fluxo:**
1. Drawer paciente — secao "Seguimento de Tratamento" abaixo de "Saude cardiaca"
2. Sem protocolo ativo: botao "Atribuir protocolo" -> modal (select template, data inicial, proxima consulta, doctor_id, notas)
3. Com ativo: timeline de respostas (`health_observations` filtrado por `device_provenance.protocol_id`) + botoes "Pausar" / "Concluir"
4. Link "Ver briefing PDF" se ja gerado

---

## Task 11 — Cron diario: gerar briefing pre-consulta

**Files:**
- Create: `app/app/api/cron/generate-briefings/route.ts`
- Edit: `vercel.json` (adicionar cron)

**Logica:**
- Cron 00:00 BRT: busca `appointments` D+1 onde paciente tem `patient_protocol.active`.
- Pra cada, POST `/api/seguimento/briefing`.
- Update `appointments.briefing_pdf_url`.
- 1h antes do `appointments.starts_at`: envia WhatsApp pessoal do medico com link clicavel via Evolution.

---

## Task 12 — Piloto operacional usando o que ja existe

**Justificativa:** valida P1 (engajamento) e P2 (disposicao de pagamento) **HOJE** sem codigo novo.

**Setup zero-codigo:**
- 5-10 pacientes cardio do parceiro
- Cada um recebe `/saude/[token]` por WhatsApp
- Acompanhar engajamento: % que abrem, % que preenchem, frequencia
- Andreia Vieira (id 56) ja tem 9 medicoes — usar como baseline de UX

**Setup com perguntas semanais (post Task 1+2+3+4):**
- Atribuir template "hipertenso" aos 10 pacientes
- P04 envia 1 pergunta/semana via WhatsApp
- Mede taxa de resposta + tempo medio + abandono

**Carta de intencao de pagamento** com mockup do PDF de briefing (Task 7 pode rodar em "modo demo" com dados fakes pra mostrar).

**Criterio de avancar:**
- >= 6/10 respondem 2 semanas seguidas
- Medico assina LOI >= R$ 300/mes ou aceita R$ 50/paciente ativo

---

## Ordem de implementacao recomendada

**Semana 1 — piloto operacional + base:**
1. **Task 12 (piloto operacional)** rodando em paralelo a tudo, com 2-5 pacientes do parceiro usando `/saude/[token]` ja em prod.
2. **Task 1 + 2 + 3 (migrations + seed)** — 1 dia, aplicar com singulare-db.
3. **Task 4 (estender ingest)** — 1 dia.

**Semana 2 — coleta ativa completa:**
4. **Task 8 (N8N P04)** sem alerta ainda — 2 dias.
5. Validar fluxo end-to-end com 1 paciente: protocolo atribuido, pergunta semanal recebida, resposta volta no painel.

**Semana 3 — alertas + briefing:**
6. **Task 5 + 6 (trigger-alert + trigger postgres)** — 2 dias.
7. **Task 7 (PDF briefing)** — 3 dias.

**Semana 4 — UI + cron:**
8. **Task 9 + 10 (UI painel)** — 3 dias.
9. **Task 11 (cron pre-consulta)** — 1 dia.
10. **Task 4b (endpoint Shortcut iOS)** — 1 dia (pode rodar antes se o atalho ficar pronto primeiro).

**Total:** ~13 dias dev + 4 semanas calendarizadas em paralelo ao piloto.

---

## Riscos e mitigacoes

| Risco | Mitigacao |
|---|---|
| Idoso nao responde WhatsApp | Task 12 valida antes de codar muito; baseline com Andreia |
| Clinica nao paga | Task 12 inclui LOI antes de codar UI completa |
| Atalho iOS quebra com update do iOS | `shortcut_version` no payload + endpoint compat |
| NLU do P04 erra extracao | `raw_text` sempre preservado em `device_provenance`; `data_quality_tag='noisy'` se confidence < 0.6; revisao humana primeiras 200 |
| Falso positivo de alerta critico | Threshold conservador; warning antes de critical; janela de confirmacao via P04 |
| pg_net nao habilitado | Validar com singulare-db; fallback: insert em `alert_events` + cron N8N puxa |
| PDF demora a renderizar | Cron 00:00 com folga ate consulta; fallback HTML inline web |
| Conflito de category com peca passiva | Migration aditiva (drop+recreate constraint); zero risco com 5+ linhas |
| Feature flag desativado | `tenant_features.seguimento_enabled` validado antes de UI mostrar |
| Token vazado | `/api/painel/pacientes/[id]/collection-token` ja permite regenerar (revoga antigo) |

---

## Coordenacao agora-zero

Com a peca paralela mergeada em main, nao ha mais dependencias cruzadas. Nosso modulo so adiciona:
- 1 migration aditiva em `health_observations` (CHECK)
- 4 tabelas proprias
- 1 migration auxiliar em `appointments` (briefing_pdf_url)
- 1 endpoint API estendido
- 1 endpoint API novo (Shortcut)
- 2 edge functions
- 1 trigger postgres
- 1 workflow N8N
- 2 paginas UI no painel
- 1 cron Vercel

Nada quebra o que ja existe.
