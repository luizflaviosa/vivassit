# Telemonitoramento Cardiológico Passivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** entregar MVP de pipeline passivo de coleta de biomarcadores cardiológicos (FC, HRV, sono, atividade) por Flutter mobile, ingerido via Edge Function autenticada em `health_observations` (série temporal HL7-FHIR-ish + LOINC), integrado ao Singulare como módulo de paciente vinculado a `patients`/`tenants`.

**Architecture:** worktree isolada em `.claude/worktrees/mobile-cardio/`, app Flutter em `mobile/singulare_health/`. Backend: 3 tabelas novas em `public` (`patient_consents`, `patient_devices`, `health_observations`) + coluna `patients.auth_user_id` pra vincular Supabase Auth (phone OTP) ao paciente existente. Edge Functions: `ingest-vitals` (recebe batch, valida, filtra outlier fisiológico, enriquece com `is_active`, insere) e `link-patient` (vincula `auth.uid()` ao `patient` correto via telefone confirmado). Flutter usa `health` (acesso Apple Health / Health Connect), `supabase_flutter` (auth + http), `sqflite` (cache local `last_sync_at` por LOINC), `workmanager` (sync periódico 6h com retry exponencial).

**Tech Stack:** Flutter 3.24+, Dart 3.5+, `health: ^11.x`, `supabase_flutter: ^2.x`, `workmanager: ^0.5.x`, `sqflite: ^2.x`, `crypto: ^3.x`. Supabase Postgres + Edge Functions (Deno + TypeScript + Zod). LOINC pra códigos clínicos (sem tabela — constantes TS). Sem framework de teste no Flutter além de `flutter_test` built-in; Edge Functions testadas com `deno test`. Multi-tenant via `is_tenant_member()` (helpers existentes).

**Decisões arquiteturais críticas:**
- **Patient auth = Supabase Auth via phone OTP**. Paciente loga no app com WhatsApp; OTP via Twilio (config separada, fora do escopo desse plano — usar fallback de teste durante MVP). Após OTP, edge function `link-patient` faz lookup `patients WHERE phone=$1 AND tenant_id=$2` e seta `auth_user_id = auth.uid()`. Multi-tenant tratado pedindo `tenant_slug` no app.
- **Pacientes existem PRÉ-app**: clínica cadastra paciente (via N8N/Chatwoot/painel) → paciente baixa app → loga com telefone já cadastrado → app vincula. Não permitir auto-cadastro de paciente sem registro prévio (regra de negócio Singulare).
- **`patients.id` é `bigint`**: novas FKs usam bigint, não uuid.
- **`tenants.tenant_id` é `varchar`**: novas tabelas usam `tenant_id text not null` sem FK formal (consistente com `patients`, mantém invariante existente — não vou refatorar isso aqui).
- **`is_active` enrichment**: calculado server-side cruzando observation de FC com observation de `steps` da mesma janela de 5min. Não calculado no app — server centraliza lógica.
- **Outlier filter conservador**: FC < 25 ou > 240 = `rejected`. FC entre 220-240 = `outlier` (mantém, mas flagged). HRV SDNN < 0 = `rejected`. Sem filtro por idade no MVP.
- **LOINC subset**: HR `8867-4`, HRV-SDNN `80404-7`, R-R interval médio `80404-7`, steps count `55423-8`, distance walked `41950-7`, sleep duration `93832-4`, sleep stage `93831-6`. Codes ficam em constante TS compartilhada (não DB).

---

## Task 0 — Worktree isolada + scaffolding inicial

**Files:**
- Create: `.claude/worktrees/mobile-cardio/` (via `git worktree add`)
- Create: `mobile/singulare_health/` (dentro da worktree)

- [ ] **Step 0.1: Criar worktree a partir de main**

Run: `git worktree add .claude/worktrees/mobile-cardio -b feat/mobile-cardio`

Expected: nova worktree em `.claude/worktrees/mobile-cardio/` com branch `feat/mobile-cardio` baseada no `main`.

- [ ] **Step 0.2: Confirmar Flutter SDK disponível**

Run: `flutter --version`

Expected: Flutter 3.24+ instalado. Se não, parar e instruir o usuário a instalar via `brew install --cask flutter` (macOS).

- [ ] **Step 0.3: Criar app Flutter dentro da worktree**

Run (da raiz da worktree):
```bash
cd .claude/worktrees/mobile-cardio
mkdir -p mobile
cd mobile
flutter create singulare_health \
  --org org.singulare \
  --project-name singulare_health \
  --platforms ios,android \
  --description "Singulare — telemonitoramento cardiológico passivo"
```

Expected: estrutura padrão Flutter em `mobile/singulare_health/`.

- [ ] **Step 0.4: Adicionar dependências em `mobile/singulare_health/pubspec.yaml`**

Editar a seção `dependencies` pra adicionar (manter as default):

```yaml
dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.8
  supabase_flutter: ^2.5.0
  health: ^11.1.0
  workmanager: ^0.5.2
  sqflite: ^2.3.3
  path: ^1.9.0
  crypto: ^3.0.5
  device_info_plus: ^10.1.2
  package_info_plus: ^8.0.2
```

Run: `cd mobile/singulare_health && flutter pub get`

Expected: dependências resolvidas sem conflito.

- [ ] **Step 0.5: Commit do scaffold**

```bash
git add mobile/
git commit -m "feat(mobile): scaffold flutter singulare_health com deps de saude/auth/bg"
```

---

## Task 1 — Migration: `patients.auth_user_id` + RLS update

**Files:**
- Create: `supabase/migrations/<TIMESTAMP>_patients_auth_user_id.sql`

- [ ] **Step 1.1: Conferir RLS atual de `patients`**

Run: `mcp__supabase__execute_sql`:
```sql
select polname, polcmd,
       pg_get_expr(polqual, polrelid) as qual,
       pg_get_expr(polwithcheck, polrelid) as withcheck
from pg_policy where polrelid = 'public.patients'::regclass;
```

Anotar policies existentes. Esperado: `patients_member_read` via `is_tenant_member(tenant_id)`.

- [ ] **Step 1.2: Escrever migration**

`TIMESTAMP = date +%Y%m%d%H%M%S`. Conteúdo:

```sql
-- Vincula paciente a um auth.users (para login no app mobile).
-- Nullable: paciente pode existir antes de baixar o app.
alter table public.patients
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

-- Constraint: um auth.users só pode vincular a UM patient por tenant
-- (paciente pode estar em N tenants/clinicas mas com 1 auth_user por tenant).
create unique index if not exists patients_auth_user_per_tenant_uniq
  on public.patients (tenant_id, auth_user_id)
  where auth_user_id is not null;

-- Policy: paciente pode ler o proprio registro pelo auth.uid()
drop policy if exists patients_self_read on public.patients;
create policy patients_self_read on public.patients
  for select to authenticated
  using (auth_user_id = auth.uid());

comment on column public.patients.auth_user_id is
  'Supabase Auth user vinculado ao paciente (preenchido apos OTP por phone via edge function link-patient). Nullable: paciente existe antes do app.';
```

- [ ] **Step 1.3: Aplicar via singulare-db agent**

Dispatch singulare-db: "Aplica migration `<TIMESTAMP>_patients_auth_user_id.sql` com `mcp__supabase__apply_migration`. Não destrutivo (só add column + index + policy)."

Expected: migration aplicada, retorna sucesso.

- [ ] **Step 1.4: Smoke test**

Run via mcp:
```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='patients' and column_name='auth_user_id';
```

Expected: 1 linha retornada.

- [ ] **Step 1.5: Commit**

```bash
git add supabase/migrations/<TIMESTAMP>_patients_auth_user_id.sql
git commit -m "feat(db): patients.auth_user_id pra vincular paciente ao supabase auth"
```

---

## Task 2 — Migration: `patient_consents` + `patient_devices` + RLS

**Files:**
- Create: `supabase/migrations/<TIMESTAMP>_patient_consents_devices.sql`

- [ ] **Step 2.1: Escrever migration**

```sql
-- LGPD: registro de consentimento explicito do paciente pra coleta de dados de saude.
create table public.patient_consents (
  id bigserial primary key,
  patient_id bigint not null references public.patients(id) on delete cascade,
  tenant_id text not null,
  consent_type text not null check (consent_type in ('health_monitoring','data_sharing_clinic','ai_inference')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  device_info jsonb,
  app_version text,
  ip_address inet,
  user_agent text,
  unique (patient_id, consent_type, granted_at)
);

create index on public.patient_consents (patient_id, consent_type) where revoked_at is null;

alter table public.patient_consents enable row level security;

create policy patient_consents_self_all on public.patient_consents
  for all to authenticated
  using (patient_id in (select id from public.patients where auth_user_id = auth.uid()))
  with check (patient_id in (select id from public.patients where auth_user_id = auth.uid()));

create policy patient_consents_tenant_read on public.patient_consents
  for select to authenticated
  using (public.is_tenant_member(tenant_id));

-- Dispositivos que o paciente usa pra coletar (1 paciente pode ter N).
create table public.patient_devices (
  id bigserial primary key,
  patient_id bigint not null references public.patients(id) on delete cascade,
  tenant_id text not null,
  platform text not null check (platform in ('ios','android')),
  os_version text,
  app_version text,
  device_model text,
  health_source text check (health_source in ('apple_health','health_connect','garmin','fitbit','manual')),
  install_id uuid not null,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  unique (patient_id, install_id)
);

create index on public.patient_devices (patient_id, last_sync_at desc);

alter table public.patient_devices enable row level security;

create policy patient_devices_self_all on public.patient_devices
  for all to authenticated
  using (patient_id in (select id from public.patients where auth_user_id = auth.uid()))
  with check (patient_id in (select id from public.patients where auth_user_id = auth.uid()));

create policy patient_devices_tenant_read on public.patient_devices
  for select to authenticated
  using (public.is_tenant_member(tenant_id));

comment on table public.patient_consents is 'LGPD: registro de consentimento do paciente pra coleta de biomarcadores.';
comment on table public.patient_devices is 'Dispositivos mobile usados pelo paciente pra sincronizar dados de saude.';
```

- [ ] **Step 2.2: Aplicar via singulare-db**

Dispatch singulare-db: "Aplica `<TIMESTAMP>_patient_consents_devices.sql`. Cria 2 tabelas + RLS. Não destrutivo."

- [ ] **Step 2.3: Smoke test RLS**

Run via mcp:
```sql
select tablename, polname, polcmd from pg_policies
where schemaname='public' and tablename in ('patient_consents','patient_devices')
order by tablename, polname;
```

Expected: 4 policies (2 por tabela: `_self_all` e `_tenant_read`).

- [ ] **Step 2.4: Commit**

```bash
git add supabase/migrations/<TIMESTAMP>_patient_consents_devices.sql
git commit -m "feat(db): patient_consents (lgpd) + patient_devices com rls"
```

---

## Task 3 — Migration: `health_observations` (série temporal)

**Files:**
- Create: `supabase/migrations/<TIMESTAMP>_health_observations.sql`

- [ ] **Step 3.1: Escrever migration**

```sql
-- Serie temporal de observacoes clinicas (HL7 FHIR Observation simplificado).
-- Otimizado pra append-only + queries por (patient_id, loinc_code, effective_time).
create table public.health_observations (
  id bigserial primary key,
  patient_id bigint not null references public.patients(id) on delete cascade,
  tenant_id text not null,
  device_id bigint references public.patient_devices(id) on delete set null,
  category text not null check (category in ('vital-signs','activity','sleep','laboratory')),
  loinc_code text not null,
  display_name text,
  value_numeric numeric,
  value_text text,
  unit text,
  effective_time timestamptz not null,
  effective_period_end timestamptz,
  device_provenance jsonb,
  data_quality_tag text not null default 'clean' check (data_quality_tag in ('clean','outlier','noisy','rejected')),
  is_active boolean,
  raw_payload jsonb,
  ingest_batch_id uuid,
  created_at timestamptz not null default now(),
  -- chave de dedup defensivo no server: mesmo paciente, mesmo LOINC, mesmo timestamp = 1 linha
  unique (patient_id, loinc_code, effective_time)
);

-- Indexes pra queries de painel (clinica le dados do paciente) e de IA (ranges grandes)
create index on public.health_observations (patient_id, loinc_code, effective_time desc);
create index on public.health_observations (tenant_id, effective_time desc);
create index on public.health_observations using brin (effective_time) with (pages_per_range = 32);
create index on public.health_observations (ingest_batch_id) where ingest_batch_id is not null;

alter table public.health_observations enable row level security;

-- Paciente le os proprios dados
create policy health_obs_self_read on public.health_observations
  for select to authenticated
  using (patient_id in (select id from public.patients where auth_user_id = auth.uid()));

-- Membros do tenant (medico/admin/owner) leem dados dos pacientes do tenant
create policy health_obs_tenant_read on public.health_observations
  for select to authenticated
  using (public.is_tenant_member(tenant_id));

-- INSERT proibido para usuario comum: so via edge function com service_role.
-- Nao criamos policy de INSERT/UPDATE/DELETE intencionalmente.

comment on table public.health_observations is
  'Serie temporal de biomarcadores (FHIR Observation). Insert apenas via edge function ingest-vitals com service_role.';
comment on column public.health_observations.loinc_code is
  'Codigo LOINC. HR=8867-4, HRV-SDNN=80404-7, steps=55423-8, distance=41950-7, sleep-duration=93832-4, sleep-stage=93831-6.';
comment on column public.health_observations.data_quality_tag is
  'clean=valido | outlier=fora da faixa esperada mas plausivel | noisy=conflito com outros sinais | rejected=fisiologicamente impossivel (descartado da analise mas mantido pra auditoria).';
comment on column public.health_observations.is_active is
  'Calculado server-side: paciente estava em atividade fisica na janela (true se steps>0 nos ultimos 5min). Usado pra inferir HRR.';
```

- [ ] **Step 3.2: Aplicar via singulare-db**

Dispatch singulare-db: "Aplica `<TIMESTAMP>_health_observations.sql`. Cria 1 tabela + 4 indexes + 2 policies RLS. Não destrutivo."

- [ ] **Step 3.3: Smoke test**

Run via mcp:
```sql
select count(*) as policies from pg_policies
where schemaname='public' and tablename='health_observations';
```

Expected: `policies = 2`.

```sql
select indexname from pg_indexes where tablename='health_observations' order by indexname;
```

Expected: 5 indexes (pkey + os 4 criados).

- [ ] **Step 3.4: Commit**

```bash
git add supabase/migrations/<TIMESTAMP>_health_observations.sql
git commit -m "feat(db): health_observations serie temporal fhir-loinc com rls + brin"
```

---

## Task 4 — Edge Function `link-patient`

**Files:**
- Create: `supabase/functions/link-patient/index.ts`
- Create: `supabase/functions/link-patient/deno.json`
- Create: `supabase/functions/_shared/cors.ts` (se não existir)

- [ ] **Step 4.1: Verificar se `_shared/cors.ts` existe**

Run: `ls supabase/functions/_shared/cors.ts 2>/dev/null && echo OK || echo MISSING`

Se MISSING, criar:

```typescript
// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
```

- [ ] **Step 4.2: Criar `supabase/functions/link-patient/deno.json`**

```json
{
  "imports": {
    "std/": "https://deno.land/std@0.224.0/",
    "supabase": "https://esm.sh/@supabase/supabase-js@2.45.0",
    "zod": "https://esm.sh/zod@3.23.8"
  }
}
```

- [ ] **Step 4.3: Implementar `index.ts`**

```typescript
// supabase/functions/link-patient/index.ts
import { serve } from "std/http/server.ts";
import { createClient } from "supabase";
import { z } from "zod";
import { corsHeaders } from "../_shared/cors.ts";

const InputSchema = z.object({
  tenant_id: z.string().min(1),
  phone: z.string().regex(/^\+?\d{10,15}$/, "phone must be E.164-ish"),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "missing_auth" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "invalid_token" }, 401);
  const authUserId = userData.user.id;
  const authPhone = userData.user.phone;

  const body = await req.json().catch(() => null);
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) return json({ error: "bad_input", details: parsed.error.flatten() }, 400);

  const { tenant_id, phone } = parsed.data;
  const normalizedPhone = phone.replace(/^\+/, "").replace(/\D/g, "");

  // Defesa: phone do body precisa bater com phone do JWT (OTP).
  if (authPhone && authPhone.replace(/\D/g, "") !== normalizedPhone) {
    return json({ error: "phone_mismatch" }, 403);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: patient, error: pErr } = await admin
    .from("patients")
    .select("id, auth_user_id")
    .eq("tenant_id", tenant_id)
    .eq("phone", normalizedPhone)
    .maybeSingle();

  if (pErr) return json({ error: "db_error", detail: pErr.message }, 500);
  if (!patient) return json({ error: "patient_not_found" }, 404);

  if (patient.auth_user_id && patient.auth_user_id !== authUserId) {
    return json({ error: "patient_already_linked_to_other_user" }, 409);
  }

  if (!patient.auth_user_id) {
    const { error: uErr } = await admin
      .from("patients")
      .update({ auth_user_id: authUserId })
      .eq("id", patient.id);
    if (uErr) return json({ error: "link_failed", detail: uErr.message }, 500);
  }

  return json({ patient_id: patient.id, linked: true }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 4.4: Deploy via singulare-db agent**

Dispatch singulare-db: "Deploy edge function `link-patient` via `mcp__supabase__deploy_edge_function` no projeto qwyxacfgoqlskidwzdxe. Source files acima."

Expected: function deployed em `https://qwyxacfgoqlskidwzdxe.supabase.co/functions/v1/link-patient`.

- [ ] **Step 4.5: Smoke test via curl**

Run (substituir `<ANON_KEY>` pela publishable key):
```bash
curl -X POST https://qwyxacfgoqlskidwzdxe.supabase.co/functions/v1/link-patient \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"test","phone":"5511999999999"}'
```

Expected: `{"error":"invalid_token"}` com status 401 (já que estamos passando anon key, não JWT de user). Comportamento correto.

- [ ] **Step 4.6: Commit**

```bash
git add supabase/functions/link-patient/ supabase/functions/_shared/
git commit -m "feat(edge): link-patient vincula auth.users ao registro patients via phone OTP"
```

---

## Task 5 — Edge Function `ingest-vitals` — schemas + LOINC constants

**Files:**
- Create: `supabase/functions/ingest-vitals/deno.json`
- Create: `supabase/functions/ingest-vitals/loinc.ts`
- Create: `supabase/functions/ingest-vitals/schema.ts`

- [ ] **Step 5.1: Criar `deno.json`**

```json
{
  "imports": {
    "std/": "https://deno.land/std@0.224.0/",
    "supabase": "https://esm.sh/@supabase/supabase-js@2.45.0",
    "zod": "https://esm.sh/zod@3.23.8"
  }
}
```

- [ ] **Step 5.2: Criar `loinc.ts`**

```typescript
// supabase/functions/ingest-vitals/loinc.ts
export const LOINC = {
  HEART_RATE: "8867-4",
  HRV_SDNN: "80404-7",
  STEPS: "55423-8",
  DISTANCE_WALKING: "41950-7",
  SLEEP_DURATION: "93832-4",
  SLEEP_STAGE: "93831-6",
  BLOOD_PRESSURE_SYSTOLIC: "8480-6",
  BLOOD_PRESSURE_DIASTOLIC: "8462-4",
  BODY_TEMPERATURE: "8310-5",
  SPO2: "59408-5",
} as const;

export type LoincCode = typeof LOINC[keyof typeof LOINC];

export const LOINC_CATEGORY: Record<LoincCode, "vital-signs" | "activity" | "sleep" | "laboratory"> = {
  "8867-4": "vital-signs",
  "80404-7": "vital-signs",
  "55423-8": "activity",
  "41950-7": "activity",
  "93832-4": "sleep",
  "93831-6": "sleep",
  "8480-6": "vital-signs",
  "8462-4": "vital-signs",
  "8310-5": "vital-signs",
  "59408-5": "vital-signs",
};

export const LOINC_DISPLAY: Record<LoincCode, string> = {
  "8867-4": "Heart rate",
  "80404-7": "R-R interval standard deviation (SDNN)",
  "55423-8": "Number of steps in unspecified time Pedometer",
  "41950-7": "Number of meters walked in unspecified time",
  "93832-4": "Sleep duration",
  "93831-6": "Sleep stage",
  "8480-6": "Systolic blood pressure",
  "8462-4": "Diastolic blood pressure",
  "8310-5": "Body temperature",
  "59408-5": "Oxygen saturation in Arterial blood by Pulse oximetry",
};

// Faixas fisiologicas pra outlier detection.
// [reject_below, outlier_below, outlier_above, reject_above]
export const PHYSIOLOGICAL_RANGES: Partial<Record<LoincCode, [number, number, number, number]>> = {
  "8867-4": [25, 35, 220, 240],     // HR bpm
  "80404-7": [0, 5, 250, 500],      // HRV SDNN ms
  "8480-6": [50, 80, 200, 260],     // SBP mmHg
  "8462-4": [30, 50, 130, 180],     // DBP mmHg
  "8310-5": [32, 35, 40, 43],       // Temp Celsius
  "59408-5": [70, 85, 100, 100],    // SpO2 %
};

export function classifyQuality(code: string, value: number): "clean" | "outlier" | "rejected" {
  const range = PHYSIOLOGICAL_RANGES[code as LoincCode];
  if (!range) return "clean";
  const [rejLow, outLow, outHigh, rejHigh] = range;
  if (value < rejLow || value > rejHigh) return "rejected";
  if (value < outLow || value > outHigh) return "outlier";
  return "clean";
}
```

- [ ] **Step 5.3: Criar `schema.ts`**

```typescript
// supabase/functions/ingest-vitals/schema.ts
import { z } from "zod";

export const ObservationSchema = z.object({
  loinc_code: z.string().min(1),
  value_numeric: z.number().finite().nullable().optional(),
  value_text: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  effective_time: z.string().datetime(),
  effective_period_end: z.string().datetime().nullable().optional(),
  source: z.enum(["apple_health", "health_connect", "garmin", "fitbit", "manual"]),
}).refine(
  (o) => o.value_numeric !== null && o.value_numeric !== undefined || o.value_text !== null,
  { message: "either value_numeric or value_text required" },
);

export const BatchSchema = z.object({
  tenant_id: z.string().min(1),
  install_id: z.string().uuid(),
  device: z.object({
    platform: z.enum(["ios", "android"]),
    os_version: z.string(),
    app_version: z.string(),
    device_model: z.string(),
  }),
  observations: z.array(ObservationSchema).min(1).max(500),
});

export type Batch = z.infer<typeof BatchSchema>;
export type Observation = z.infer<typeof ObservationSchema>;
```

- [ ] **Step 5.4: Commit**

```bash
git add supabase/functions/ingest-vitals/
git commit -m "feat(edge): ingest-vitals schemas zod + tabela loinc + faixas fisiologicas"
```

---

## Task 6 — Edge Function `ingest-vitals` — handler principal

**Files:**
- Create: `supabase/functions/ingest-vitals/index.ts`
- Create: `supabase/functions/ingest-vitals/enrich.ts`

- [ ] **Step 6.1: Criar `enrich.ts`** (cálculo de `is_active`)

```typescript
// supabase/functions/ingest-vitals/enrich.ts
import type { Observation } from "./schema.ts";
import { LOINC } from "./loinc.ts";

// Marca is_active=true em uma observacao de FC se houver steps>0 na janela [-5min, +5min].
export function enrichIsActive(observations: Observation[]): Map<number, boolean> {
  const result = new Map<number, boolean>();
  const stepEvents = observations
    .filter((o) => o.loinc_code === LOINC.STEPS && (o.value_numeric ?? 0) > 0)
    .map((o) => new Date(o.effective_time).getTime());

  observations.forEach((obs, idx) => {
    if (obs.loinc_code !== LOINC.HEART_RATE) return;
    const t = new Date(obs.effective_time).getTime();
    const windowMs = 5 * 60 * 1000;
    const hasNearbyStep = stepEvents.some((st) => Math.abs(st - t) <= windowMs);
    result.set(idx, hasNearbyStep);
  });

  return result;
}
```

- [ ] **Step 6.2: Criar `index.ts`**

```typescript
// supabase/functions/ingest-vitals/index.ts
import { serve } from "std/http/server.ts";
import { createClient } from "supabase";
import { corsHeaders } from "../_shared/cors.ts";
import { BatchSchema } from "./schema.ts";
import { LOINC_CATEGORY, LOINC_DISPLAY, classifyQuality } from "./loinc.ts";
import { enrichIsActive } from "./enrich.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "missing_auth" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "invalid_token" }, 401);
  const authUserId = userData.user.id;

  const body = await req.json().catch(() => null);
  const parsed = BatchSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "bad_payload", details: parsed.error.flatten() }, 400);
  }
  const batch = parsed.data;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Resolve paciente via auth_user_id + tenant_id
  const { data: patient, error: pErr } = await admin
    .from("patients")
    .select("id, tenant_id")
    .eq("tenant_id", batch.tenant_id)
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (pErr) return json({ error: "db_error", detail: pErr.message }, 500);
  if (!patient) return json({ error: "patient_not_linked" }, 403);

  // Upsert device
  const { data: device, error: dErr } = await admin
    .from("patient_devices")
    .upsert(
      {
        patient_id: patient.id,
        tenant_id: patient.tenant_id,
        platform: batch.device.platform,
        os_version: batch.device.os_version,
        app_version: batch.device.app_version,
        device_model: batch.device.device_model,
        health_source: batch.device.platform === "ios" ? "apple_health" : "health_connect",
        install_id: batch.install_id,
        last_sync_at: new Date().toISOString(),
      },
      { onConflict: "patient_id,install_id" },
    )
    .select("id")
    .single();
  if (dErr || !device) return json({ error: "device_upsert_failed", detail: dErr?.message }, 500);

  // Enriquecimento is_active
  const activeMap = enrichIsActive(batch.observations);
  const batchId = crypto.randomUUID();

  const rows = batch.observations.map((o, idx) => {
    const quality = o.value_numeric != null
      ? classifyQuality(o.loinc_code, o.value_numeric)
      : "clean";
    return {
      patient_id: patient.id,
      tenant_id: patient.tenant_id,
      device_id: device.id,
      category: LOINC_CATEGORY[o.loinc_code as keyof typeof LOINC_CATEGORY] ?? "vital-signs",
      loinc_code: o.loinc_code,
      display_name: LOINC_DISPLAY[o.loinc_code as keyof typeof LOINC_DISPLAY] ?? o.loinc_code,
      value_numeric: o.value_numeric ?? null,
      value_text: o.value_text ?? null,
      unit: o.unit ?? null,
      effective_time: o.effective_time,
      effective_period_end: o.effective_period_end ?? null,
      device_provenance: {
        source: o.source,
        platform: batch.device.platform,
        os_version: batch.device.os_version,
        app_version: batch.device.app_version,
        device_model: batch.device.device_model,
      },
      data_quality_tag: quality,
      is_active: activeMap.get(idx) ?? null,
      ingest_batch_id: batchId,
    };
  });

  // Insert com ON CONFLICT DO NOTHING (dedup defensivo via UNIQUE constraint)
  const { error: iErr, count } = await admin
    .from("health_observations")
    .upsert(rows, { onConflict: "patient_id,loinc_code,effective_time", ignoreDuplicates: true, count: "exact" });
  if (iErr) return json({ error: "insert_failed", detail: iErr.message }, 500);

  const accepted = count ?? rows.length;
  const rejected = rows.filter((r) => r.data_quality_tag === "rejected").length;

  return json(
    { batch_id: batchId, accepted, rejected, total: rows.length },
    200,
  );
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 6.3: Deploy via singulare-db**

Dispatch singulare-db: "Deploy edge function `ingest-vitals` no qwyxacfgoqlskidwzdxe."

- [ ] **Step 6.4: Smoke test sem auth**

Run:
```bash
curl -X POST https://qwyxacfgoqlskidwzdxe.supabase.co/functions/v1/ingest-vitals \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: `{"error":"missing_auth"}` status 401.

- [ ] **Step 6.5: Commit**

```bash
git add supabase/functions/ingest-vitals/
git commit -m "feat(edge): ingest-vitals handler com outlier filter + is_active + dedup"
```

---

## Task 7 — Edge Function tests (Deno)

**Files:**
- Create: `supabase/functions/ingest-vitals/test_loinc.ts`
- Create: `supabase/functions/ingest-vitals/test_enrich.ts`

- [ ] **Step 7.1: Test `classifyQuality`**

```typescript
// supabase/functions/ingest-vitals/test_loinc.ts
import { assertEquals } from "std/assert/mod.ts";
import { classifyQuality, LOINC } from "./loinc.ts";

Deno.test("HR 70 bpm = clean", () => {
  assertEquals(classifyQuality(LOINC.HEART_RATE, 70), "clean");
});

Deno.test("HR 230 bpm = outlier (entre 220 e 240)", () => {
  assertEquals(classifyQuality(LOINC.HEART_RATE, 230), "outlier");
});

Deno.test("HR 250 bpm = rejected (>240)", () => {
  assertEquals(classifyQuality(LOINC.HEART_RATE, 250), "rejected");
});

Deno.test("HR 20 bpm = rejected (<25)", () => {
  assertEquals(classifyQuality(LOINC.HEART_RATE, 20), "rejected");
});

Deno.test("HRV -5 ms = rejected (<0)", () => {
  assertEquals(classifyQuality(LOINC.HRV_SDNN, -5), "rejected");
});

Deno.test("LOINC sem range conhecido = clean", () => {
  assertEquals(classifyQuality("99999-9", 12345), "clean");
});
```

- [ ] **Step 7.2: Test `enrichIsActive`**

```typescript
// supabase/functions/ingest-vitals/test_enrich.ts
import { assertEquals } from "std/assert/mod.ts";
import { enrichIsActive } from "./enrich.ts";
import { LOINC } from "./loinc.ts";

Deno.test("HR sem steps proximo = is_active false", () => {
  const obs = [
    { loinc_code: LOINC.HEART_RATE, value_numeric: 80, effective_time: "2026-05-10T12:00:00Z", source: "apple_health" as const },
  ];
  const result = enrichIsActive(obs);
  assertEquals(result.get(0), false);
});

Deno.test("HR com steps em janela de 5min = is_active true", () => {
  const obs = [
    { loinc_code: LOINC.HEART_RATE, value_numeric: 130, effective_time: "2026-05-10T12:00:00Z", source: "apple_health" as const },
    { loinc_code: LOINC.STEPS, value_numeric: 200, effective_time: "2026-05-10T12:03:00Z", source: "apple_health" as const },
  ];
  const result = enrichIsActive(obs);
  assertEquals(result.get(0), true);
});

Deno.test("HR com steps fora da janela = is_active false", () => {
  const obs = [
    { loinc_code: LOINC.HEART_RATE, value_numeric: 130, effective_time: "2026-05-10T12:00:00Z", source: "apple_health" as const },
    { loinc_code: LOINC.STEPS, value_numeric: 200, effective_time: "2026-05-10T12:10:00Z", source: "apple_health" as const },
  ];
  const result = enrichIsActive(obs);
  assertEquals(result.get(0), false);
});

Deno.test("Observacao nao-HR nao recebe is_active", () => {
  const obs = [
    { loinc_code: LOINC.STEPS, value_numeric: 100, effective_time: "2026-05-10T12:00:00Z", source: "apple_health" as const },
  ];
  const result = enrichIsActive(obs);
  assertEquals(result.has(0), false);
});
```

- [ ] **Step 7.3: Rodar os testes**

Run: `cd supabase/functions/ingest-vitals && deno test --allow-all`

Expected: 10 testes passando (6 loinc + 4 enrich).

- [ ] **Step 7.4: Commit**

```bash
git add supabase/functions/ingest-vitals/test_*.ts
git commit -m "test(edge): cobertura loinc classify + is_active enrich"
```

---

## Task 8 — Flutter: estrutura de pastas + secrets

**Files (todos em `mobile/singulare_health/lib/`):**
- Create: `lib/config.dart`
- Create: `lib/main.dart` (rewrite do gerado)
- Create: `lib/services/` (pasta)
- Create: `lib/screens/` (pasta)
- Create: `lib/models/` (pasta)
- Create: `.env.example` (na raiz `mobile/singulare_health/`)

- [ ] **Step 8.1: Criar `lib/config.dart`**

```dart
// lib/config.dart
class AppConfig {
  // Substituido em build-time via --dart-define=SUPABASE_URL=... etc.
  static const supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://qwyxacfgoqlskidwzdxe.supabase.co',
  );
  static const supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: '',
  );

  // Batching
  static const maxBatchSize = 500;
  static const syncIntervalHours = 6;
  static const maxRetries = 5;
  static const retryBaseDelaySec = 30;
}
```

- [ ] **Step 8.2: Criar `.env.example`**

```
# mobile/singulare_health/.env.example
# Build com:
# flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
SUPABASE_URL=https://qwyxacfgoqlskidwzdxe.supabase.co
SUPABASE_ANON_KEY=<publishable_key_from_vercel_dashboard>
```

- [ ] **Step 8.3: Adicionar `.env` ao `.gitignore` da worktree**

Editar `mobile/singulare_health/.gitignore` adicionando ao final:

```
.env
.env.local
```

- [ ] **Step 8.4: Reescrever `lib/main.dart`**

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:workmanager/workmanager.dart';
import 'config.dart';
import 'screens/auth_screen.dart';
import 'screens/home_screen.dart';
import 'services/background_sync.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    anonKey: AppConfig.supabaseAnonKey,
  );
  await Workmanager().initialize(backgroundCallbackDispatcher, isInDebugMode: false);
  runApp(const SingulareHealthApp());
}

class SingulareHealthApp extends StatelessWidget {
  const SingulareHealthApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Singulare Saude',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF6E56CF)),
        useMaterial3: true,
      ),
      home: StreamBuilder<AuthState>(
        stream: Supabase.instance.client.auth.onAuthStateChange,
        builder: (context, snapshot) {
          final session = Supabase.instance.client.auth.currentSession;
          return session == null ? const AuthScreen() : const HomeScreen();
        },
      ),
    );
  }
}
```

- [ ] **Step 8.5: Commit**

```bash
git add mobile/singulare_health/lib/config.dart mobile/singulare_health/lib/main.dart \
        mobile/singulare_health/.env.example mobile/singulare_health/.gitignore
git commit -m "feat(mobile): estrutura inicial app + config supabase via dart-define"
```

---

## Task 9 — Flutter: telas de Auth (phone OTP) + link-patient

**Files:**
- Create: `lib/screens/auth_screen.dart`
- Create: `lib/screens/otp_screen.dart`
- Create: `lib/screens/link_screen.dart`
- Create: `lib/services/auth_service.dart`

- [ ] **Step 9.1: Criar `lib/services/auth_service.dart`**

```dart
// lib/services/auth_service.dart
import 'package:supabase_flutter/supabase_flutter.dart';

class AuthService {
  static final _client = Supabase.instance.client;

  static Future<void> sendOtp(String phoneE164) async {
    await _client.auth.signInWithOtp(phone: phoneE164);
  }

  static Future<AuthResponse> verifyOtp(String phoneE164, String code) {
    return _client.auth.verifyOTP(
      phone: phoneE164,
      token: code,
      type: OtpType.sms,
    );
  }

  static Future<Map<String, dynamic>> linkPatient(String tenantId, String phoneE164) async {
    final res = await _client.functions.invoke(
      'link-patient',
      body: {'tenant_id': tenantId, 'phone': phoneE164.replaceFirst('+', '')},
    );
    if (res.status != 200) {
      throw Exception('link-patient failed: ${res.status} ${res.data}');
    }
    return Map<String, dynamic>.from(res.data as Map);
  }

  static Future<void> signOut() => _client.auth.signOut();
}
```

- [ ] **Step 9.2: Criar `lib/screens/auth_screen.dart`**

```dart
// lib/screens/auth_screen.dart
import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import 'otp_screen.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _phoneCtrl = TextEditingController(text: '+55');
  bool _loading = false;
  String? _error;

  Future<void> _submit() async {
    setState(() { _loading = true; _error = null; });
    try {
      final phone = _phoneCtrl.text.trim();
      await AuthService.sendOtp(phone);
      if (!mounted) return;
      Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => OtpScreen(phone: phone),
      ));
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('Singulare Saude', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              const Text('Entre com seu WhatsApp cadastrado na clinica.'),
              const SizedBox(height: 32),
              TextField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'WhatsApp', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _loading ? null : _submit,
                child: _loading ? const CircularProgressIndicator() : const Text('Receber codigo'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(_error!, style: const TextStyle(color: Colors.red)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 9.3: Criar `lib/screens/otp_screen.dart`**

```dart
// lib/screens/otp_screen.dart
import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import 'link_screen.dart';

class OtpScreen extends StatefulWidget {
  final String phone;
  const OtpScreen({super.key, required this.phone});
  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final _codeCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _verify() async {
    setState(() { _loading = true; _error = null; });
    try {
      await AuthService.verifyOtp(widget.phone, _codeCtrl.text.trim());
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(
        builder: (_) => LinkScreen(phone: widget.phone),
      ));
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Codigo SMS')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Enviado para ${widget.phone}'),
            const SizedBox(height: 16),
            TextField(
              controller: _codeCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: '6 digitos', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _loading ? null : _verify,
              child: _loading ? const CircularProgressIndicator() : const Text('Confirmar'),
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 9.4: Criar `lib/screens/link_screen.dart`**

```dart
// lib/screens/link_screen.dart
import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import 'home_screen.dart';

class LinkScreen extends StatefulWidget {
  final String phone;
  const LinkScreen({super.key, required this.phone});
  @override
  State<LinkScreen> createState() => _LinkScreenState();
}

class _LinkScreenState extends State<LinkScreen> {
  final _tenantCtrl = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _link() async {
    setState(() { _loading = true; _error = null; });
    try {
      await AuthService.linkPatient(_tenantCtrl.text.trim(), widget.phone);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(
        builder: (_) => const HomeScreen(),
      ));
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Vincular clinica')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Informe o codigo da clinica onde voce e paciente:'),
            const SizedBox(height: 16),
            TextField(
              controller: _tenantCtrl,
              decoration: const InputDecoration(labelText: 'Codigo da clinica', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _loading ? null : _link,
              child: _loading ? const CircularProgressIndicator() : const Text('Vincular'),
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 9.5: Commit**

```bash
git add mobile/singulare_health/lib/services/auth_service.dart \
        mobile/singulare_health/lib/screens/auth_screen.dart \
        mobile/singulare_health/lib/screens/otp_screen.dart \
        mobile/singulare_health/lib/screens/link_screen.dart
git commit -m "feat(mobile): fluxo auth phone OTP + vinculo com patients via edge function"
```

---

## Task 10 — Flutter: `HealthDataEngine` (leitura + normalização)

**Files:**
- Create: `lib/services/health_data_engine.dart`
- Create: `lib/models/observation.dart`
- Create: `test/health_data_engine_test.dart`

- [ ] **Step 10.1: Criar `lib/models/observation.dart`**

```dart
// lib/models/observation.dart
class Loinc {
  static const heartRate = '8867-4';
  static const hrvSdnn = '80404-7';
  static const steps = '55423-8';
  static const distanceWalking = '41950-7';
  static const sleepDuration = '93832-4';
  static const sleepStage = '93831-6';
  static const bodyTemperature = '8310-5';
  static const spo2 = '59408-5';
}

class Observation {
  final String loincCode;
  final double? valueNumeric;
  final String? valueText;
  final String? unit;
  final DateTime effectiveTime;
  final DateTime? effectivePeriodEnd;
  final String source; // 'apple_health' | 'health_connect'

  Observation({
    required this.loincCode,
    required this.effectiveTime,
    required this.source,
    this.valueNumeric,
    this.valueText,
    this.unit,
    this.effectivePeriodEnd,
  });

  Map<String, dynamic> toJson() => {
    'loinc_code': loincCode,
    'value_numeric': valueNumeric,
    'value_text': valueText,
    'unit': unit,
    'effective_time': effectiveTime.toUtc().toIso8601String(),
    'effective_period_end': effectivePeriodEnd?.toUtc().toIso8601String(),
    'source': source,
  };
}

double fahrenheitToCelsius(double f) => (f - 32) * 5 / 9;
double mgPerDlToMmolPerLGlucose(double mg) => mg / 18.0;
```

- [ ] **Step 10.2: Test de normalização**

```dart
// test/health_data_engine_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:singulare_health/models/observation.dart';

void main() {
  test('Fahrenheit 98.6 = 37 Celsius', () {
    expect(fahrenheitToCelsius(98.6), closeTo(37.0, 0.01));
  });

  test('Glicose 90 mg/dL = 5.0 mmol/L', () {
    expect(mgPerDlToMmolPerLGlucose(90), closeTo(5.0, 0.01));
  });
}
```

Run: `cd mobile/singulare_health && flutter test`
Expected: 2 testes passando.

- [ ] **Step 10.3: Criar `lib/services/health_data_engine.dart`**

```dart
// lib/services/health_data_engine.dart
import 'dart:io';
import 'package:health/health.dart';
import '../models/observation.dart';

class HealthDataEngine {
  final Health _health = Health();

  static const _types = <HealthDataType>[
    HealthDataType.HEART_RATE,
    HealthDataType.HEART_RATE_VARIABILITY_SDNN,
    HealthDataType.STEPS,
    HealthDataType.DISTANCE_WALKING_RUNNING,
    HealthDataType.SLEEP_ASLEEP,
    HealthDataType.SLEEP_AWAKE,
    HealthDataType.SLEEP_DEEP,
    HealthDataType.SLEEP_LIGHT,
    HealthDataType.SLEEP_REM,
  ];

  Future<bool> requestPermissions() async {
    final perms = _types.map((_) => HealthDataAccess.READ).toList();
    return _health.requestAuthorization(_types, permissions: perms);
  }

  Future<List<Observation>> readSince(DateTime from) async {
    final now = DateTime.now();
    final data = await _health.getHealthDataFromTypes(
      startTime: from,
      endTime: now,
      types: _types,
    );
    return data.map(_toObservation).whereType<Observation>().toList();
  }

  Observation? _toObservation(HealthDataPoint p) {
    final source = Platform.isIOS ? 'apple_health' : 'health_connect';
    final loinc = _loincFor(p.type);
    if (loinc == null) return null;

    double? numericValue;
    String? textValue;
    if (p.value is NumericHealthValue) {
      numericValue = (p.value as NumericHealthValue).numericValue.toDouble();
    } else {
      textValue = p.value.toString();
    }

    return Observation(
      loincCode: loinc,
      valueNumeric: numericValue,
      valueText: textValue,
      unit: _unitFor(p.type),
      effectiveTime: p.dateFrom,
      effectivePeriodEnd: p.dateTo != p.dateFrom ? p.dateTo : null,
      source: source,
    );
  }

  String? _loincFor(HealthDataType t) {
    switch (t) {
      case HealthDataType.HEART_RATE: return Loinc.heartRate;
      case HealthDataType.HEART_RATE_VARIABILITY_SDNN: return Loinc.hrvSdnn;
      case HealthDataType.STEPS: return Loinc.steps;
      case HealthDataType.DISTANCE_WALKING_RUNNING: return Loinc.distanceWalking;
      case HealthDataType.SLEEP_ASLEEP:
      case HealthDataType.SLEEP_AWAKE:
      case HealthDataType.SLEEP_DEEP:
      case HealthDataType.SLEEP_LIGHT:
      case HealthDataType.SLEEP_REM:
        return Loinc.sleepStage;
      default: return null;
    }
  }

  String? _unitFor(HealthDataType t) {
    switch (t) {
      case HealthDataType.HEART_RATE: return 'bpm';
      case HealthDataType.HEART_RATE_VARIABILITY_SDNN: return 'ms';
      case HealthDataType.STEPS: return 'count';
      case HealthDataType.DISTANCE_WALKING_RUNNING: return 'm';
      default: return null;
    }
  }
}
```

- [ ] **Step 10.4: Commit**

```bash
git add mobile/singulare_health/lib/services/health_data_engine.dart \
        mobile/singulare_health/lib/models/observation.dart \
        mobile/singulare_health/test/health_data_engine_test.dart
git commit -m "feat(mobile): HealthDataEngine le HR/HRV/steps/sleep e mapeia pra LOINC"
```

---

## Task 11 — Flutter: cache local de `last_sync_at` por LOINC (sqflite)

**Files:**
- Create: `lib/services/sync_cache.dart`
- Create: `test/sync_cache_test.dart`

- [ ] **Step 11.1: Criar `lib/services/sync_cache.dart`**

```dart
// lib/services/sync_cache.dart
import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

class SyncCache {
  static const _dbName = 'singulare_sync.db';
  Database? _db;

  Future<Database> _open() async {
    if (_db != null) return _db!;
    final dir = await getDatabasesPath();
    _db = await openDatabase(
      p.join(dir, _dbName),
      version: 1,
      onCreate: (db, v) async {
        await db.execute('''
          create table sync_state (
            loinc_code text primary key,
            last_sync_at text not null
          )
        ''');
      },
    );
    return _db!;
  }

  Future<DateTime?> getLastSync(String loinc) async {
    final db = await _open();
    final rows = await db.query('sync_state', where: 'loinc_code = ?', whereArgs: [loinc], limit: 1);
    if (rows.isEmpty) return null;
    return DateTime.parse(rows.first['last_sync_at'] as String);
  }

  Future<void> setLastSync(String loinc, DateTime at) async {
    final db = await _open();
    await db.insert(
      'sync_state',
      {'loinc_code': loinc, 'last_sync_at': at.toUtc().toIso8601String()},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<DateTime> getOldestSyncOrDefault(List<String> codes, Duration fallback) async {
    DateTime? oldest;
    for (final c in codes) {
      final t = await getLastSync(c);
      if (t == null) return DateTime.now().subtract(fallback);
      if (oldest == null || t.isBefore(oldest)) oldest = t;
    }
    return oldest!;
  }
}
```

- [ ] **Step 11.2: Commit**

```bash
git add mobile/singulare_health/lib/services/sync_cache.dart
git commit -m "feat(mobile): sync_cache sqflite armazena last_sync_at por loinc"
```

---

## Task 12 — Flutter: `IngestClient` + batching + retry

**Files:**
- Create: `lib/services/ingest_client.dart`
- Create: `lib/services/install_id.dart`

- [ ] **Step 12.1: Criar `lib/services/install_id.dart`** (UUID estável por instalação)

```dart
// lib/services/install_id.dart
import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;
import 'package:crypto/crypto.dart';
import 'dart:convert';

class InstallId {
  static Future<String> get() async {
    final dir = await getDatabasesPath();
    final db = await openDatabase(
      p.join(dir, 'singulare_meta.db'),
      version: 1,
      onCreate: (db, _) =>
          db.execute('create table meta (k text primary key, v text not null)'),
    );
    final rows = await db.query('meta', where: 'k = ?', whereArgs: ['install_id']);
    if (rows.isNotEmpty) return rows.first['v'] as String;

    // Gera UUID v4 derivado de timestamp+random (sem identificar hardware).
    final raw = '${DateTime.now().microsecondsSinceEpoch}-${_randomNonce()}';
    final hash = sha256.convert(utf8.encode(raw)).toString();
    final uuid = '${hash.substring(0,8)}-${hash.substring(8,12)}-4${hash.substring(13,16)}-a${hash.substring(17,20)}-${hash.substring(20,32)}';
    await db.insert('meta', {'k': 'install_id', 'v': uuid});
    return uuid;
  }

  static String _randomNonce() {
    final now = DateTime.now().microsecondsSinceEpoch;
    return (now ^ (now >> 7)).toRadixString(16);
  }

  static Future<Map<String, String>> deviceInfo() async {
    final info = DeviceInfoPlugin();
    if (Platform.isIOS) {
      final i = await info.iosInfo;
      return {
        'platform': 'ios',
        'os_version': i.systemVersion,
        'device_model': i.utsname.machine,
      };
    } else {
      final a = await info.androidInfo;
      return {
        'platform': 'android',
        'os_version': a.version.release,
        'device_model': '${a.manufacturer} ${a.model}',
      };
    }
  }
}
```

- [ ] **Step 12.2: Criar `lib/services/ingest_client.dart`**

```dart
// lib/services/ingest_client.dart
import 'dart:math';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../config.dart';
import '../models/observation.dart';
import 'install_id.dart';

class IngestResult {
  final int totalSent;
  final int accepted;
  final int rejected;
  IngestResult(this.totalSent, this.accepted, this.rejected);
}

class IngestClient {
  static final _client = Supabase.instance.client;

  static Future<IngestResult> sendBatches({
    required String tenantId,
    required List<Observation> observations,
  }) async {
    if (observations.isEmpty) return IngestResult(0, 0, 0);

    final installId = await InstallId.get();
    final dev = await InstallId.deviceInfo();
    final pkg = await PackageInfo.fromPlatform();

    int totalSent = 0, totalAccepted = 0, totalRejected = 0;

    for (var i = 0; i < observations.length; i += AppConfig.maxBatchSize) {
      final chunk = observations.sublist(
        i,
        min(i + AppConfig.maxBatchSize, observations.length),
      );
      final body = {
        'tenant_id': tenantId,
        'install_id': installId,
        'device': {
          'platform': dev['platform'],
          'os_version': dev['os_version'],
          'app_version': pkg.version,
          'device_model': dev['device_model'],
        },
        'observations': chunk.map((o) => o.toJson()).toList(),
      };

      final res = await _sendWithRetry(body);
      totalSent += chunk.length;
      totalAccepted += (res['accepted'] as int? ?? 0);
      totalRejected += (res['rejected'] as int? ?? 0);
    }

    return IngestResult(totalSent, totalAccepted, totalRejected);
  }

  static Future<Map<String, dynamic>> _sendWithRetry(Map<String, dynamic> body) async {
    var attempt = 0;
    while (true) {
      try {
        final res = await _client.functions.invoke('ingest-vitals', body: body);
        if (res.status == 200) return Map<String, dynamic>.from(res.data as Map);
        if (res.status == 401 || res.status == 403 || res.status == 400) {
          throw Exception('non_retryable: ${res.status} ${res.data}');
        }
        throw Exception('retryable: ${res.status}');
      } catch (e) {
        attempt++;
        if (e.toString().contains('non_retryable')) rethrow;
        if (attempt >= AppConfig.maxRetries) rethrow;
        final delaySec = AppConfig.retryBaseDelaySec * (1 << (attempt - 1));
        await Future.delayed(Duration(seconds: delaySec));
      }
    }
  }
}
```

- [ ] **Step 12.3: Commit**

```bash
git add mobile/singulare_health/lib/services/ingest_client.dart \
        mobile/singulare_health/lib/services/install_id.dart
git commit -m "feat(mobile): ingest_client com batching 500 + retry exponential backoff"
```

---

## Task 13 — Flutter: background sync via `workmanager`

**Files:**
- Create: `lib/services/background_sync.dart`
- Create: `lib/screens/home_screen.dart`
- Create: `lib/screens/consent_screen.dart`

- [ ] **Step 13.1: Criar `lib/services/background_sync.dart`**

```dart
// lib/services/background_sync.dart
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:workmanager/workmanager.dart';
import '../config.dart';
import '../models/observation.dart';
import 'health_data_engine.dart';
import 'ingest_client.dart';
import 'sync_cache.dart';

const _taskTag = 'singulare-cardio-sync';

@pragma('vm:entry-point')
void backgroundCallbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    if (task != _taskTag) return true;
    try {
      await Supabase.initialize(
        url: AppConfig.supabaseUrl,
        anonKey: AppConfig.supabaseAnonKey,
      );
      final tenantId = inputData?['tenant_id'] as String?;
      if (tenantId == null) return false;
      await runSync(tenantId: tenantId);
      return true;
    } catch (_) {
      return false; // workmanager re-tenta
    }
  });
}

Future<void> registerPeriodicSync(String tenantId) async {
  await Workmanager().registerPeriodicTask(
    _taskTag,
    _taskTag,
    frequency: Duration(hours: AppConfig.syncIntervalHours),
    constraints: Constraints(networkType: NetworkType.connected),
    backoffPolicy: BackoffPolicy.exponential,
    backoffPolicyDelay: Duration(seconds: AppConfig.retryBaseDelaySec),
    inputData: {'tenant_id': tenantId},
    existingWorkPolicy: ExistingWorkPolicy.keep,
  );
}

Future<IngestResult> runSync({required String tenantId}) async {
  final engine = HealthDataEngine();
  final cache = SyncCache();

  final codes = [
    Loinc.heartRate, Loinc.hrvSdnn, Loinc.steps,
    Loinc.distanceWalking, Loinc.sleepStage,
  ];
  final since = await cache.getOldestSyncOrDefault(codes, const Duration(days: 7));
  final obs = await engine.readSince(since);
  if (obs.isEmpty) return IngestResult(0, 0, 0);

  final result = await IngestClient.sendBatches(tenantId: tenantId, observations: obs);

  final latestByCode = <String, DateTime>{};
  for (final o in obs) {
    final cur = latestByCode[o.loincCode];
    if (cur == null || o.effectiveTime.isAfter(cur)) {
      latestByCode[o.loincCode] = o.effectiveTime;
    }
  }
  for (final entry in latestByCode.entries) {
    await cache.setLastSync(entry.key, entry.value);
  }

  return result;
}
```

- [ ] **Step 13.2: Criar `lib/screens/home_screen.dart`**

```dart
// lib/screens/home_screen.dart
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/auth_service.dart';
import '../services/background_sync.dart';
import '../services/health_data_engine.dart';
import 'consent_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String? _tenantId;
  String _status = 'Carregando...';

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final uid = Supabase.instance.client.auth.currentUser?.id;
    if (uid == null) return;
    final rows = await Supabase.instance.client
        .from('patients')
        .select('tenant_id')
        .eq('auth_user_id', uid)
        .limit(1);
    if (rows.isEmpty) {
      setState(() => _status = 'Sem vinculo. Refaca o login.');
      return;
    }
    _tenantId = rows.first['tenant_id'] as String;

    final granted = await HealthDataEngine().requestPermissions();
    if (!granted) {
      if (!mounted) return;
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ConsentScreen()));
      return;
    }

    await registerPeriodicSync(_tenantId!);
    setState(() => _status = 'Monitoramento ativo. Sync a cada 6h.');
  }

  Future<void> _syncNow() async {
    if (_tenantId == null) return;
    setState(() => _status = 'Sincronizando...');
    final r = await runSync(tenantId: _tenantId!);
    setState(() => _status = 'Enviados ${r.totalSent} | aceitos ${r.accepted} | rejeitados ${r.rejected}');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Singulare Saude'),
        actions: [
          IconButton(onPressed: () => AuthService.signOut(), icon: const Icon(Icons.logout)),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.favorite, size: 64, color: Color(0xFF6E56CF)),
            const SizedBox(height: 16),
            Text(_status, textAlign: TextAlign.center),
            const SizedBox(height: 32),
            FilledButton(onPressed: _syncNow, child: const Text('Sincronizar agora')),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 13.3: Criar `lib/screens/consent_screen.dart`**

```dart
// lib/screens/consent_screen.dart
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/health_data_engine.dart';

class ConsentScreen extends StatelessWidget {
  const ConsentScreen({super.key});

  Future<void> _grant(BuildContext context) async {
    final granted = await HealthDataEngine().requestPermissions();
    if (!granted) return;
    final uid = Supabase.instance.client.auth.currentUser!.id;
    final patient = await Supabase.instance.client
        .from('patients')
        .select('id, tenant_id')
        .eq('auth_user_id', uid)
        .single();
    await Supabase.instance.client.from('patient_consents').insert({
      'patient_id': patient['id'],
      'tenant_id': patient['tenant_id'],
      'consent_type': 'health_monitoring',
    });
    if (context.mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Consentimento')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Para monitorar sua saude cardiaca, precisamos ler dados do Apple Health / Google Health Connect: frequencia cardiaca, variabilidade, passos, distancia e sono.\n\n'
              'Esses dados sao enviados criptografados ao Singulare e compartilhados apenas com a clinica vinculada. Voce pode revogar a qualquer momento nas configuracoes.',
            ),
            const SizedBox(height: 32),
            FilledButton(onPressed: () => _grant(context), child: const Text('Eu aceito')),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 13.4: Commit**

```bash
git add mobile/singulare_health/lib/services/background_sync.dart \
        mobile/singulare_health/lib/screens/home_screen.dart \
        mobile/singulare_health/lib/screens/consent_screen.dart
git commit -m "feat(mobile): background sync 6h via workmanager + home + consent screens"
```

---

## Task 14 — iOS: permissões HealthKit + background

**Files:**
- Modify: `mobile/singulare_health/ios/Runner/Info.plist`
- Modify: `mobile/singulare_health/ios/Runner.xcodeproj/project.pbxproj` (via Xcode capabilities, manual)

- [ ] **Step 14.1: Editar `Info.plist`** — adicionar antes do `</dict>` final:

```xml
<key>NSHealthShareUsageDescription</key>
<string>Singulare Saude le seus dados de saude do Apple Health (frequencia cardiaca, variabilidade, passos, distancia, sono) para que sua clinica acompanhe sua evolucao cardiologica.</string>
<key>NSHealthUpdateUsageDescription</key>
<string>Singulare Saude nao escreve dados no Apple Health. Esta permissao e requerida apenas para a integracao funcionar.</string>
<key>UIBackgroundModes</key>
<array>
    <string>fetch</string>
    <string>processing</string>
</array>
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
    <string>be.tramckrijte.workmanager.singulare-cardio-sync</string>
</array>
```

- [ ] **Step 14.2: Instrução manual ao usuário (não-automatizável)**

Documentar no commit: "abrir `ios/Runner.xcworkspace` no Xcode → Runner target → Signing & Capabilities → + Capability → HealthKit". (Sem Xcode, esse passo precisa ser feito pelo usuário no terminal Mac com acesso ao Xcode.)

- [ ] **Step 14.3: Commit**

```bash
git add mobile/singulare_health/ios/Runner/Info.plist
git commit -m "feat(mobile/ios): info.plist healthkit usage + background modes"
```

---

## Task 15 — Android: Health Connect + Manifest

**Files:**
- Modify: `mobile/singulare_health/android/app/src/main/AndroidManifest.xml`
- Modify: `mobile/singulare_health/android/app/build.gradle` (minSdk 26)

- [ ] **Step 15.1: Editar `AndroidManifest.xml`** — adicionar dentro de `<manifest>` antes de `<application>`:

```xml
<uses-permission android:name="android.permission.health.READ_HEART_RATE" />
<uses-permission android:name="android.permission.health.READ_HEART_RATE_VARIABILITY" />
<uses-permission android:name="android.permission.health.READ_STEPS" />
<uses-permission android:name="android.permission.health.READ_DISTANCE" />
<uses-permission android:name="android.permission.health.READ_SLEEP" />
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_HEALTH" />

<queries>
    <package android:name="com.google.android.apps.healthdata" />
</queries>
```

E dentro de `<application>`, antes do `</application>`:

```xml
<activity
    android:name=".PermissionsRationaleActivity"
    android:exported="true"
    android:permission="android.permission.health.READ_DATA">
    <intent-filter>
        <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
    </intent-filter>
</activity>
```

- [ ] **Step 15.2: Editar `android/app/build.gradle`**

Garantir `minSdkVersion 26` (Health Connect requer 26+):

```gradle
defaultConfig {
    applicationId "org.singulare.singulare_health"
    minSdkVersion 26
    targetSdkVersion 34
    versionCode flutterVersionCode.toInteger()
    versionName flutterVersionName
}
```

- [ ] **Step 15.3: Commit**

```bash
git add mobile/singulare_health/android/app/src/main/AndroidManifest.xml \
        mobile/singulare_health/android/app/build.gradle
git commit -m "feat(mobile/android): health connect permissions + manifest queries + minSdk 26"
```

---

## Task 16 — README do módulo mobile + smoke E2E

**Files:**
- Create: `mobile/singulare_health/README.md`

- [ ] **Step 16.1: Criar README**

````markdown
# Singulare Saude (mobile)

App Flutter de telemonitoramento cardiologico passivo. Le HR/HRV/passos/sono via Apple Health (iOS) ou Health Connect (Android) e sincroniza a cada 6h com o backend Singulare.

## Setup

```bash
flutter pub get
```

## Run

```bash
flutter run --dart-define=SUPABASE_URL=https://qwyxacfgoqlskidwzdxe.supabase.co \
            --dart-define=SUPABASE_ANON_KEY=<publishable_key>
```

## Estrutura

- `lib/services/health_data_engine.dart` — leitura de dados nativos, mapeamento LOINC
- `lib/services/ingest_client.dart` — batching 500 + retry exponential
- `lib/services/background_sync.dart` — workmanager 6h
- `lib/services/sync_cache.dart` — sqflite cache `last_sync_at`

## Backend (Supabase project qwyxacfgoqlskidwzdxe)

- Tabelas: `patient_consents`, `patient_devices`, `health_observations`
- Edge functions: `link-patient`, `ingest-vitals`
- Auth: phone OTP (Twilio), vincula `auth.users` <-> `patients.auth_user_id`

## Compliance (LGPD)

- Consent explicito gravado em `patient_consents` antes de qualquer leitura
- IDs de hardware nao sao enviados — apenas `install_id` UUID derivado de timestamp+random
- Dados isolados por tenant via RLS
````

- [ ] **Step 16.2: Smoke E2E manual**

Criar paciente de teste via SQL no Supabase:
```sql
insert into public.patients (tenant_id, phone, name)
values ('clinica_teste', '5511988887777', 'Teste Cardio');
```

Rodar app no simulador iOS / emulador Android:
1. Inserir `+5511988887777` na tela de auth
2. Receber OTP via Twilio (config separada — durante MVP, usar fallback de teste do Supabase)
3. Verificar código
4. Inserir `clinica_teste` na tela de vínculo
5. Conceder permissão de saúde
6. Tocar "Sincronizar agora"
7. Verificar no Supabase:
   ```sql
   select count(*), data_quality_tag from public.health_observations
   where tenant_id = 'clinica_teste' group by data_quality_tag;
   ```
   Expected: ao menos 1 linha `clean`.

- [ ] **Step 16.3: Commit final**

```bash
git add mobile/singulare_health/README.md
git commit -m "docs(mobile): README com setup, estrutura e smoke E2E"
```

- [ ] **Step 16.4: Push da branch**

```bash
git push -u origin feat/mobile-cardio
```

---

## Self-Review (executado durante elaboração)

**Spec coverage** vs prompt original:
- (1) Arquitetura de Dados: Tasks 1-3 cobrem `patients.auth_user_id`, `health_observations` time-series, `device_provenance` JSONB, `data_quality_tag`, RLS restritiva (sem INSERT pra anon). `patient_consents` + `patient_devices` adicionados pra suprir lacunas LGPD/dispositivos. **OK**.
- (2) Lógica Mobile: Task 10 = permissões granulares (HR/HRV/sleep/steps/distance) + LOINC mapping. Task 11 = dedup proativa via SQLite `last_sync_at`. Task 12 = batching 500 + normalization (Fahrenheit→Celsius em `observation.dart`). **OK**.
- (3) Edge Functions: Tasks 5-7 = Zod payload validation, `classifyQuality` filtra `>240bpm` e `HRV<0`, `enrichIsActive` cruza HR com steps. **OK**.
- (4) Background Sync: Task 13 = `workmanager` `frequency: 6h` + `BackoffPolicy.exponential` + retry no `ingest_client`. **OK**.
- (5) Compliance: Task 14 = `Info.plist` com `NSHealthShareUsageDescription`. Task 15 = `AndroidManifest` com queries Health Connect + foreground service. Task 12 = `install_id` UUID derivado, **sem** IMEI/Serial. **OK**.

**Placeholder scan**: nenhum `TODO`, "implement later" ou "appropriate error handling" sem código. Todos os steps com código mostram o código completo.

**Type consistency**: `Loinc.heartRate` (Dart) ↔ `LOINC.HEART_RATE` (TS) ambos = `"8867-4"`. `Observation.toJson()` (Dart) bate com `ObservationSchema` (TS): `loinc_code, value_numeric, value_text, unit, effective_time, effective_period_end, source`. `Batch` em TS espera `{tenant_id, install_id, device, observations}` — `IngestClient.sendBatches` em Dart envia exatamente isso. **OK**.

**Gaps conhecidos / fora do escopo do MVP** (anotados pra fase 2):
- Twilio config pra phone OTP — Supabase precisa de provider SMS configurado (custo + setup separado)
- Tela de listagem/visualização dos dados pro paciente no app (só status básico no `HomeScreen`)
- Painel Singulare Next.js consumindo `health_observations` (UI no painel da clínica fica pra plano futuro)
- Inferências ML / detecção de arritmia (esse plano só entrega o pipeline de ingestão)
- Revogação de consentimento via UI (apenas insert, sem update `revoked_at` no MVP)
- Worktree exit (merge → main) fica a critério após review

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-10-telemonitoramento-cardiologico.md`. Two execution options:

**1. Subagent-Driven (recommended)** — eu disparo um subagent fresco por task, com review intermediário. Cada task entrega 1 commit. Bom pra projeto grande como esse (16 tasks).

**2. Inline Execution** — executo tasks nesta sessão com checkpoints. Mais rápido mas o contexto fica pesado.

Qual abordagem?
