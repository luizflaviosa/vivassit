# NPS Pós-Consulta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Coletar NPS de pacientes da Singulare/Vivassit após cada consulta via WhatsApp, populando `patient_feedback` para alimentar o painel `/painel/feedback` (já implementado).

**Architecture:** Cron n8n às 19h BRT lê eventos terminados hoje no Google Calendar, envia mensagem via Evolution API e cria row `pending` em `patient_feedback`. Quando o paciente responde, o workflow "1. Master Secretária" intercepta a mensagem antes do AI Agent (Gemini), classifica como NPS se há row pendente nas últimas 24h, grava nota/feedback e responde — sem envenenar o agente IA com lógica NPS.

**Tech Stack:** n8n (Schedule Trigger, Postgres, Google Calendar, HTTP Request, Code, Switch nodes), Supabase Postgres (`patient_feedback`, `tenants`, `tenant_doctors`), Evolution API (WhatsApp), Google Calendar (Service Account já existente).

**Spec:** `docs/superpowers/specs/2026-04-28-nps-pos-consulta-design.md`

---

## File Structure

| Caminho | Tipo | Responsabilidade |
|---|---|---|
| `scripts/nps-schema.sql` | novo | Migração idempotente: CHECK constraint em `status` + 2 índices |
| `scripts/n8n-functions/extract-patient-info.js` | novo | Função pura que extrai `phone, name, first_name` da description do Calendar event (TDD) |
| `scripts/n8n-functions/extract-patient-info.test.js` | novo | Test suite (Node assert nativo, sem framework) |
| `scripts/n8n-functions/parse-nps-score.js` | novo | Função pura que extrai inteiro 0-10 de uma mensagem (TDD) |
| `scripts/n8n-functions/parse-nps-score.test.js` | novo | Test suite |
| `docs/n8n/nps-queries.sql` | novo | SQL central pra colar nos Postgres nodes do n8n (List Tenants, List Doctors, Dedupe, Insert, Lookup, Save) |
| `docs/n8n/3-nps-pesquisa-walkthrough.md` | novo | Walkthrough nó-a-nó do workflow novo, com expressões e parâmetros |
| `docs/n8n/master-secretaria-nps-handler.md` | novo | Walkthrough das modificações no workflow "1. Master Secretária" |
| `docs/n8n/nps-smoke-test.md` | novo | Runbook ponta-a-ponta: aplicar SQL → importar workflow → modificar Master → testar |
| `docs/PLANO-PRODUCAO.md` | modificar | Marcar NPS coleta como entregue |

---

## Task 1: SQL migration (schema patient_feedback)

**Files:**
- Create: `scripts/nps-schema.sql`

- [ ] **Step 1: Escrever a migração**

```sql
-- scripts/nps-schema.sql
-- Migração idempotente: padroniza status de patient_feedback e cria índices
-- pra os fluxos NPS (cron de envio + lookup do Master Secretária).
--
-- Execute manualmente no Supabase SQL Editor antes de ativar o workflow
-- "3. NPS Pesquisa Pós-Consulta".

BEGIN;

-- 1. Defensive: rows legados sem status válido viram 'pending'.
-- Status aceitos: pending, responded, awaiting_followup, closed, send_failed.
UPDATE public.patient_feedback
SET status = COALESCE(NULLIF(status, ''), 'pending')
WHERE status IS NULL
   OR status = ''
   OR status NOT IN ('pending', 'responded', 'awaiting_followup', 'closed', 'send_failed');

-- 2. CHECK constraint (idempotente: drop+create)
ALTER TABLE public.patient_feedback
  DROP CONSTRAINT IF EXISTS patient_feedback_status_check;

ALTER TABLE public.patient_feedback
  ADD CONSTRAINT patient_feedback_status_check
  CHECK (status IN ('pending', 'responded', 'awaiting_followup', 'closed', 'send_failed'));

-- 3. Default em status (pra inserts que omitem)
ALTER TABLE public.patient_feedback
  ALTER COLUMN status SET DEFAULT 'pending';

-- 4. Índices pra performance
-- Lookup do Master Secretária (tenant + telefone + status + janela 24h)
CREATE INDEX IF NOT EXISTS idx_patient_feedback_lookup
  ON public.patient_feedback (tenant_id, patient_phone, status, sent_at DESC);

-- Dedupe do cron (tenant + data da consulta)
CREATE INDEX IF NOT EXISTS idx_patient_feedback_dedupe
  ON public.patient_feedback (tenant_id, appointment_date);

COMMIT;
```

- [ ] **Step 2: Validar localmente que o SQL parsing está OK**

Run: `psql --no-psqlrc -c "\\i scripts/nps-schema.sql" --dry-run 2>/dev/null || echo "skip: sem psql local — Luiz roda no Supabase Editor"`

(Sem psql local é OK — o SQL é direto e vai ser validado no Supabase.)

- [ ] **Step 3: Commit**

```bash
git add scripts/nps-schema.sql
git commit -m "feat(nps): migration idempotente pra patient_feedback (status check + indexes)"
```

---

## Task 2: Extract patient info (TDD)

A função roda **dentro do n8n Code node** mas escrevemos como módulo Node testável pra evitar bugs de regex. O conteúdo final é colado no Code node.

**Files:**
- Create: `scripts/n8n-functions/extract-patient-info.js`
- Create: `scripts/n8n-functions/extract-patient-info.test.js`

- [ ] **Step 1: Escrever o test primeiro (failing)**

```js
// scripts/n8n-functions/extract-patient-info.test.js
const assert = require('node:assert/strict');
const { extractPatientInfo } = require('./extract-patient-info');

// Caso 1: description com convenção padrão Master Secretária
{
  const desc = `Telefone: +55 11 99999-9999
Nome Completo: João da Silva Pereira
Data de Nascimento: 15/03/1980
ID da conversa: abc123`;
  const out = extractPatientInfo(desc);
  assert.equal(out.phone, '+5511999999999', 'phone E.164');
  assert.equal(out.name, 'João da Silva Pereira', 'nome completo');
  assert.equal(out.first_name, 'João', 'first_name');
}

// Caso 2: telefone sem máscara
{
  const desc = `Telefone: 11999999999\nNome Completo: Maria Souza`;
  const out = extractPatientInfo(desc);
  assert.equal(out.phone, '+5511999999999');
  assert.equal(out.first_name, 'Maria');
}

// Caso 3: telefone já em E.164
{
  const desc = `Telefone: +5543987654321\nNome Completo: Ana`;
  const out = extractPatientInfo(desc);
  assert.equal(out.phone, '+5543987654321');
  assert.equal(out.first_name, 'Ana');
}

// Caso 4: description sem telefone → retorna null
{
  const desc = `Nome Completo: Sem Telefone`;
  const out = extractPatientInfo(desc);
  assert.equal(out, null, 'sem telefone, descarta');
}

// Caso 5: description sem nome → first_name fallback "Paciente"
{
  const desc = `Telefone: +5511988887777`;
  const out = extractPatientInfo(desc);
  assert.equal(out.phone, '+5511988887777');
  assert.equal(out.first_name, 'Paciente');
  assert.equal(out.name, null);
}

// Caso 6: description vazia ou null
{
  assert.equal(extractPatientInfo(''), null);
  assert.equal(extractPatientInfo(null), null);
  assert.equal(extractPatientInfo(undefined), null);
}

// Caso 7: telefone com 8 dígitos (fixo, raro mas possível) - ainda 11+DDD esperado
// Se vier menos que 10 dígitos depois de tirar não-dígitos → null (telefone inválido)
{
  const desc = `Telefone: 12345\nNome Completo: Curto`;
  const out = extractPatientInfo(desc);
  assert.equal(out, null, 'telefone curto inválido');
}

console.log('extract-patient-info: all tests passed');
```

- [ ] **Step 2: Rodar o test pra confirmar que falha**

Run: `node scripts/n8n-functions/extract-patient-info.test.js`
Expected: `Cannot find module './extract-patient-info'` (módulo ainda não existe).

- [ ] **Step 3: Implementar a função**

```js
// scripts/n8n-functions/extract-patient-info.js
//
// Extrai telefone e nome da description de um evento do Google Calendar
// criado pelo Master Secretária. Convenção:
//   Telefone: +55 11 99999-9999
//   Nome Completo: Fulano de Tal
//   Data de Nascimento: dd/mm/yyyy
//   ID da conversa: <id>
//
// Retorna: { phone: string E.164, name: string|null, first_name: string }
// ou null se telefone ausente/inválido.

function extractPatientInfo(description) {
  if (!description || typeof description !== 'string') return null;

  const phoneMatch = description.match(/Telefone:\s*([+\d][\d\s\-()+]{6,})/i);
  if (!phoneMatch) return null;

  const phone = normalizeToE164(phoneMatch[1]);
  if (!phone) return null;

  const nameMatch = description.match(/Nome\s*Completo:\s*(.+?)(?:\r?\n|$)/i);
  const name = nameMatch ? nameMatch[1].trim() : null;

  const first_name = name
    ? name.split(/\s+/)[0]
    : 'Paciente';

  return { phone, name, first_name };
}

function normalizeToE164(raw) {
  // Remove tudo que não for dígito
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 10) return null;        // muito curto pra ser válido
  if (digits.length > 15) return null;        // E.164 max 15
  // Se já começa com 55 e tem 12-13 dígitos, assume Brasil completo
  if (digits.startsWith('55') && digits.length >= 12) return '+' + digits;
  // Caso BR sem DDI (10 ou 11 dígitos) → prefixa 55
  if (digits.length === 10 || digits.length === 11) return '+55' + digits;
  // Caso outros países (com DDI já incluso, sem 55): mantém
  return '+' + digits;
}

module.exports = { extractPatientInfo, normalizeToE164 };
```

- [ ] **Step 4: Rodar test pra confirmar passa**

Run: `node scripts/n8n-functions/extract-patient-info.test.js`
Expected: `extract-patient-info: all tests passed`

- [ ] **Step 5: Commit**

```bash
git add scripts/n8n-functions/extract-patient-info.js scripts/n8n-functions/extract-patient-info.test.js
git commit -m "feat(nps): extract-patient-info — parse Calendar description (E.164, name)"
```

---

## Task 3: Parse NPS score (TDD)

Função usada pelo pre-router do Master Secretária pra extrair nota 0-10.

**Files:**
- Create: `scripts/n8n-functions/parse-nps-score.js`
- Create: `scripts/n8n-functions/parse-nps-score.test.js`

- [ ] **Step 1: Escrever o test primeiro**

```js
// scripts/n8n-functions/parse-nps-score.test.js
const assert = require('node:assert/strict');
const { parseNpsScore } = require('./parse-nps-score');

// Mensagens válidas
assert.equal(parseNpsScore('10'), 10);
assert.equal(parseNpsScore('  9  '), 9);
assert.equal(parseNpsScore('0'), 0);
assert.equal(parseNpsScore('Acho que daria 8'), 8);
assert.equal(parseNpsScore('nota 7!'), 7);
assert.equal(parseNpsScore('nota: 5'), 5);

// 10 vence sobre 1 quando ambíguo (regex prioriza 10)
assert.equal(parseNpsScore('10'), 10);
assert.equal(parseNpsScore('Daria 10!'), 10);

// Mensagens inválidas (sem nota plausível)
assert.equal(parseNpsScore('oi'), null);
assert.equal(parseNpsScore('foi ok'), null);
assert.equal(parseNpsScore(''), null);
assert.equal(parseNpsScore(null), null);

// Números fora da faixa não contam
assert.equal(parseNpsScore('15'), null, '15 não é nota válida');
assert.equal(parseNpsScore('cheguei às 14h'), null, 'horário não é nota');
assert.equal(parseNpsScore('100'), null);

// Caso ambíguo: número múltiplos — pega o primeiro que esteja em 0-10
assert.equal(parseNpsScore('Era pra ser 10, mas dou 8'), 10);

console.log('parse-nps-score: all tests passed');
```

- [ ] **Step 2: Rodar pra confirmar falha**

Run: `node scripts/n8n-functions/parse-nps-score.test.js`
Expected: `Cannot find module './parse-nps-score'`

- [ ] **Step 3: Implementar**

```js
// scripts/n8n-functions/parse-nps-score.js
//
// Extrai um inteiro 0-10 de uma mensagem do paciente.
// Estratégia: regex que casa números isolados (word boundaries) e filtra 0-10.
// Retorna o primeiro match válido, ou null se nenhum.

function parseNpsScore(message) {
  if (!message || typeof message !== 'string') return null;

  // Casa números isolados (não fazem parte de outro número/palavra).
  // Word boundary na frente, e (não-dígito ou fim) atrás.
  const matches = message.matchAll(/\b(\d{1,3})\b/g);
  for (const m of matches) {
    const n = Number(m[1]);
    if (Number.isInteger(n) && n >= 0 && n <= 10) return n;
  }
  return null;
}

module.exports = { parseNpsScore };
```

- [ ] **Step 4: Rodar pra passar**

Run: `node scripts/n8n-functions/parse-nps-score.test.js`
Expected: `parse-nps-score: all tests passed`

- [ ] **Step 5: Commit**

```bash
git add scripts/n8n-functions/parse-nps-score.js scripts/n8n-functions/parse-nps-score.test.js
git commit -m "feat(nps): parse-nps-score — extrai nota 0-10 de mensagem livre"
```

---

## Task 4: Reference SQL queries pra n8n Postgres nodes

**Files:**
- Create: `docs/n8n/nps-queries.sql`

- [ ] **Step 1: Criar o arquivo**

```sql
-- docs/n8n/nps-queries.sql
-- SQL pra colar nos Postgres nodes dos workflows n8n.
-- Cada bloco é uma query independente — nome do bloco indica o nó destino.

-- ============================================================================
-- WORKFLOW "3. NPS Pesquisa Pós-Consulta"
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Nó: "List Tenants"
-- ----------------------------------------------------------------------------
SELECT
  tenant_id,
  clinic_name,
  evolution_instance_name,
  evolution_phone_number
FROM public.tenants
WHERE evolution_status = 'connected'
  AND evolution_instance_name IS NOT NULL;


-- ----------------------------------------------------------------------------
-- Nó: "List Doctors" (parametrizado por tenant_id do loop)
-- Parâmetro $1 = {{ $json.tenant_id }}
-- ----------------------------------------------------------------------------
SELECT
  id           AS doctor_id,
  doctor_name,
  calendar_id
FROM public.tenant_doctors
WHERE tenant_id = $1
  AND status = 'active'
  AND calendar_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- Nó: "Dedupe" (parametrizado)
-- $1 = tenant_id, $2 = patient_phone (E.164)
-- Retorna 1 row se já existe pesquisa hoje pra esse paciente nesse tenant.
-- ----------------------------------------------------------------------------
SELECT 1
FROM public.patient_feedback
WHERE tenant_id = $1
  AND patient_phone = $2
  AND appointment_date::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
LIMIT 1;


-- ----------------------------------------------------------------------------
-- Nó: "Insert Pending"
-- $1 = tenant_id, $2 = patient_name, $3 = patient_phone,
-- $4 = doctor_name, $5 = appointment_date (timestamp do event.start.dateTime)
-- ----------------------------------------------------------------------------
INSERT INTO public.patient_feedback
  (tenant_id, patient_name, patient_phone, doctor_name,
   appointment_date, status, sent_at)
VALUES
  ($1, $2, $3, $4, $5, 'pending', now())
RETURNING id;


-- ----------------------------------------------------------------------------
-- Nó: "Mark Send Failed" (rollback de envio)
-- $1 = id do row recém-inserido
-- ----------------------------------------------------------------------------
UPDATE public.patient_feedback
SET status = 'send_failed'
WHERE id = $1;


-- ============================================================================
-- WORKFLOW "1. Master Secretária" — pre-router NPS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Nó: "Lookup Pending NPS"
-- $1 = tenant_id, $2 = patient_phone (E.164, msg recebida)
-- ----------------------------------------------------------------------------
SELECT id, status, nps_score
FROM public.patient_feedback
WHERE tenant_id = $1
  AND patient_phone = $2
  AND status IN ('pending', 'awaiting_followup')
  AND sent_at > now() - interval '24 hours'
ORDER BY sent_at DESC
LIMIT 1;


-- ----------------------------------------------------------------------------
-- Nó: "Save Score" (resposta numérica 0-10)
-- $1 = nps_score (int), $2 = id do feedback row
-- ----------------------------------------------------------------------------
UPDATE public.patient_feedback
SET nps_score = $1,
    responded_at = now(),
    status = CASE WHEN $1 <= 6 THEN 'awaiting_followup' ELSE 'closed' END
WHERE id = $2
RETURNING status, nps_score;


-- ----------------------------------------------------------------------------
-- Nó: "Save Feedback Text" (texto livre após nota baixa)
-- $1 = feedback_text, $2 = id do feedback row
-- ----------------------------------------------------------------------------
UPDATE public.patient_feedback
SET feedback_text = $1,
    status = 'closed'
WHERE id = $2;
```

- [ ] **Step 2: Commit**

```bash
git add docs/n8n/nps-queries.sql
git commit -m "docs(nps): SQL central pros Postgres nodes do n8n"
```

---

## Task 5: Walkthrough do workflow "3. NPS Pesquisa Pós-Consulta"

**Files:**
- Create: `docs/n8n/3-nps-pesquisa-walkthrough.md`

- [ ] **Step 1: Criar walkthrough completo**

```markdown
# Workflow n8n "3. NPS Pesquisa Pós-Consulta" — Walkthrough

Cron diário 19:00 BRT. Para cada tenant ativo, lista consultas concluídas hoje no Google Calendar e envia pesquisa NPS via Evolution API.

## Pré-requisitos no n8n

- Credencial Postgres "Supabase" já configurada (mesma do Master Secretária).
- Credencial Google Calendar "Service Account Singulare" (Service Account `atendimento-singulare@...`).
- Variável de ambiente do n8n: `EVOLUTION_BASE_URL` (ex: `https://evo.singulare.org`).
- Variável `EVOLUTION_API_KEY` se a Evolution exige header `apikey`.

## Estrutura de nós

```
Schedule Trigger (19:00 BRT)
  └─ Postgres: List Tenants
       └─ Split In Batches (1 por tenant)
            └─ Postgres: List Doctors (filtra por tenant_id)
                 └─ Split In Batches (1 por doctor)
                      └─ Google Calendar: List Events
                           └─ Filter: only events with end < now AND end >= today_00:00 BRT
                                └─ Code: Extract Patient Info (regex na description)
                                     └─ IF: phone is not null
                                          └─ Postgres: Dedupe (LIMIT 1)
                                               └─ IF: dedupe row count == 0
                                                    └─ Postgres: Insert Pending → returns id
                                                         └─ HTTP Request: Evolution sendText
                                                              └─ IF: response.status == "PENDING" or "SENT"
                                                                   ├─ true: end (status já é 'pending')
                                                                   └─ false: Postgres "Mark Send Failed"
```

## Configuração nó-a-nó

### 1. Schedule Trigger

- Type: `Schedule Trigger`
- Trigger Interval: **Cron**
- Cron Expression: `0 19 * * *`
- Timezone: `America/Sao_Paulo`

### 2. Postgres "List Tenants"

- Operation: **Execute Query**
- Query: ver `docs/n8n/nps-queries.sql` bloco "List Tenants".
- Output: `tenant_id, clinic_name, evolution_instance_name, evolution_phone_number`

### 3. Split In Batches (tenants)

- Batch Size: **1**
- Reset: false

### 4. Postgres "List Doctors"

- Operation: **Execute Query**
- Query: bloco "List Doctors"
- Query Parameters:
  - `={{ $json.tenant_id }}`

### 5. Split In Batches (doctors)

- Batch Size: **1**

### 6. Google Calendar "List Events"

- Resource: **Event**
- Operation: **Get Many**
- Calendar: `={{ $json.calendar_id }}`
- Return All: false, Limit: 50
- Time Min: `={{ $now.setZone('America/Sao_Paulo').startOf('day').toUTC().toISO() }}`
- Time Max: `={{ $now.toUTC().toISO() }}`
- Additional Fields:
  - Single Events: **true**
  - Order By: `startTime`

### 7. Code "Filter Concluded + Extract Patient Info"

- Mode: **Run Once for Each Item**
- Language: **JavaScript**

Cole o conteúdo abaixo (copia/cola da função testada em `scripts/n8n-functions/extract-patient-info.js`, adaptado pra retornar `null` ou item).

```js
// Filtra eventos concluídos hoje e extrai patient info da description.
// Inputs do n8n: $input.item.json é um event do Google Calendar.

function normalizeToE164(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length > 15) return null;
  if (digits.startsWith('55') && digits.length >= 12) return '+' + digits;
  if (digits.length === 10 || digits.length === 11) return '+55' + digits;
  return '+' + digits;
}

function extractPatientInfo(description) {
  if (!description || typeof description !== 'string') return null;
  const phoneMatch = description.match(/Telefone:\s*([+\d][\d\s\-()+]{6,})/i);
  if (!phoneMatch) return null;
  const phone = normalizeToE164(phoneMatch[1]);
  if (!phone) return null;
  const nameMatch = description.match(/Nome\s*Completo:\s*(.+?)(?:\r?\n|$)/i);
  const name = nameMatch ? nameMatch[1].trim() : null;
  const first_name = name ? name.split(/\s+/)[0] : 'Paciente';
  return { phone, name, first_name };
}

const event = $input.item.json;
const endIso = event.end?.dateTime || event.end?.date;
if (!endIso) return null;
const endMs = new Date(endIso).getTime();
if (endMs > Date.now()) return null;  // ainda não terminou

const info = extractPatientInfo(event.description || '');
if (!info) return null;  // sem telefone parseável → skip

// Pega doctor_name e tenant_id dos contextos n8n upstream
// (usa $('Split In Batches: doctors') e $('Split In Batches: tenants'))
const doctor = $('Postgres: List Doctors').item.json;
const tenant = $('Postgres: List Tenants').item.json;

return {
  json: {
    tenant_id: tenant.tenant_id,
    evolution_instance_name: tenant.evolution_instance_name,
    doctor_name: doctor.doctor_name,
    appointment_date: event.start?.dateTime || event.start?.date,
    patient_phone: info.phone,
    patient_name: info.name,
    first_name: info.first_name,
  },
};
```

**Nota:** os nomes dos nós upstream nas chamadas `$('...').item.json` precisam casar com os nomes reais que você der pros nodes Postgres. Renomeie no editor pra "Postgres: List Tenants" e "Postgres: List Doctors" pra seguir o exemplo.

Quando o Code retorna `null`, o n8n descarta o item.

### 8. Postgres "Dedupe"

- Operation: **Execute Query**
- Query: bloco "Dedupe"
- Query Parameters:
  - `={{ $json.tenant_id }}`
  - `={{ $json.patient_phone }}`

### 9. IF "Already sent today?"

- Condition: `={{ $('Postgres: Dedupe').all().length }}` **equals** `0`
- Branch true → continua. Branch false → end.

### 10. Postgres "Insert Pending"

- Operation: **Execute Query**
- Query: bloco "Insert Pending"
- Query Parameters:
  - `={{ $('Code').item.json.tenant_id }}`
  - `={{ $('Code').item.json.patient_name }}`
  - `={{ $('Code').item.json.patient_phone }}`
  - `={{ $('Code').item.json.doctor_name }}`
  - `={{ $('Code').item.json.appointment_date }}`

### 11. HTTP Request "Evolution sendText"

- Method: **POST**
- URL: `={{ $env.EVOLUTION_BASE_URL }}/message/sendText/{{ $('Code').item.json.evolution_instance_name }}`
- Authentication: **Header Auth** com header `apikey` = `{{ $env.EVOLUTION_API_KEY }}` (se aplicável)
- Body Content Type: **JSON**
- Body:

```json
{
  "number": "{{ $('Code').item.json.patient_phone }}",
  "text": "Olá {{ $('Code').item.json.first_name }}! 👋\n\nComo foi sua consulta hoje com {{ $('Code').item.json.doctor_name }}?\nDe 0 a 10, qual nota você daria?\n\n_Caso não tenha comparecido à consulta, é só ignorar esta mensagem._"
}
```

- Options → Response → Response Format: **JSON**
- Continue On Fail: **true** (não bloqueia o lote se um envio falhar)

### 12. IF "Send OK"

- Condition: `={{ $json.status }}` em **{ "PENDING", "SENT", "success" }** (use uma expressão `{{ ['PENDING','SENT','success'].includes($json.status) }}`).
- Branch true → end (status já é 'pending'). Branch false → próximo nó.

### 13. Postgres "Mark Send Failed"

- Operation: **Execute Query**
- Query: bloco "Mark Send Failed"
- Query Parameters:
  - `={{ $('Postgres: Insert Pending').item.json.id }}`

## Settings do workflow

- Save Manual Executions: **on**
- Timezone: **America/Sao_Paulo**
- Execution Timeout: 300s

## Como testar manualmente

1. Cria evento de teste no Calendar de um doctor de tenant teste, com horário começando 30min atrás (`start` < now), descrição com `Telefone: +5511...` e `Nome Completo: ...`.
2. No n8n editor, clica **Execute Workflow**.
3. Confere row inserida em `patient_feedback` (status='pending').
4. Confere mensagem WhatsApp recebida.
```

- [ ] **Step 2: Commit**

```bash
git add docs/n8n/3-nps-pesquisa-walkthrough.md
git commit -m "docs(nps): walkthrough completo do workflow n8n NPS Pesquisa"
```

---

## Task 6: Walkthrough das modificações no Master Secretária

**Files:**
- Create: `docs/n8n/master-secretaria-nps-handler.md`

- [ ] **Step 1: Criar walkthrough**

````markdown
# Master Secretária — NPS Pre-Router

Modificação do workflow "1. Master Secretária" pra interceptar respostas NPS antes do AI Agent (Gemini), evitando que a IA confabule sobre notas.

## Princípio

O pre-router só intercepta **mensagens de pacientes que têm uma pesquisa NPS pendente** (`patient_feedback.status IN ('pending', 'awaiting_followup')`, `sent_at` < 24h). Tudo mais segue pro AI Agent normal.

## Estrutura

Insira a sequência abaixo **entre o nó de webhook do Evolution** e **o AI Agent (Gemini 2.5 Pro)**.

```
[Evolution webhook (já existe)]
   ↓
[Postgres: Lookup Pending NPS]   ← novo
   ↓
[Switch: NPS Router]              ← novo (3 ramos)
   ├─ ramo "pending":
   │     [Code: Parse Score] → IF score is null
   │              ├─ não casou → fallback: AI Agent (mensagem não é NPS)
   │              └─ casou:
   │                    [Postgres: Save Score]
   │                       ↓
   │                    IF score <= 6
   │                       ├─ true: Evolution sendText "obrigada, o que melhorar?"
   │                       └─ false: Evolution sendText "obrigada, que bom que correu bem"
   │                       ↓
   │                    [STOP]
   │
   ├─ ramo "awaiting_followup":
   │     [Postgres: Save Feedback Text]
   │        ↓
   │     Evolution sendText "anotado, obrigada"
   │        ↓
   │     [STOP]
   │
   └─ ramo "no pending row":
         [AI Agent (já existe)]
```

## Detalhes nó-a-nó

### Nó 1: Postgres "Lookup Pending NPS"

- Operation: **Execute Query**
- Query: bloco "Lookup Pending NPS" do `docs/n8n/nps-queries.sql`
- Parameters:
  - `={{ $json.tenant_id }}` (vem do contexto upstream do Master Secretária — onde quer que ele já resolva tenant_id pelo número de telefone que recebeu mensagem)
  - `={{ $json.patient_phone }}` (idem; geralmente vem do payload do Evolution)
- **Continue On Fail: true** (se a query falha, segue pro AI Agent normal — não bloqueia chat)

### Nó 2: Switch "NPS Router"

- Mode: **Rules**
- Output 1 ("pending"):
  - Condition: `={{ $('Postgres: Lookup Pending NPS').item.json.status }}` **equals** `pending`
- Output 2 ("awaiting_followup"):
  - Condition: `={{ $('Postgres: Lookup Pending NPS').item.json.status }}` **equals** `awaiting_followup`
- Fallback (Output 3): tudo mais (inclusive lookup vazio) → AI Agent

### Ramo "pending"

#### Nó 3a: Code "Parse Score"

- Mode: **Run Once for Each Item**
- Language: **JavaScript**

```js
function parseNpsScore(message) {
  if (!message || typeof message !== 'string') return null;
  const matches = message.matchAll(/\b(\d{1,3})\b/g);
  for (const m of matches) {
    const n = Number(m[1]);
    if (Number.isInteger(n) && n >= 0 && n <= 10) return n;
  }
  return null;
}

const msgText = $json.message?.text || $json.text || $json.body || '';
const feedbackId = $('Postgres: Lookup Pending NPS').item.json.id;
const score = parseNpsScore(msgText);

return {
  json: {
    score,
    feedback_id: feedbackId,
    msg_text: msgText,
  },
};
```

#### Nó 4a: IF "Score parsed?"

- Condition: `={{ $json.score !== null }}`
- True branch → próximo nó. False branch → AI Agent (mensagem é número fora de 0-10 ou texto sem número; não é NPS).

#### Nó 5a: Postgres "Save Score"

- Operation: **Execute Query**
- Query: bloco "Save Score"
- Parameters:
  - `={{ $('Code: Parse Score').item.json.score }}`
  - `={{ $('Code: Parse Score').item.json.feedback_id }}`

#### Nó 6a: IF "Score <= 6"

- Condition: `={{ $('Code: Parse Score').item.json.score <= 6 }}`

#### Nó 7a (true branch): HTTP Evolution sendText (follow-up ask)

- Method: **POST**, URL/Auth idêntico ao do workflow "3. NPS Pesquisa"
- Body:

```json
{
  "number": "{{ $json.patient_phone }}",
  "text": "Obrigada pela nota 🙏\nO que podemos melhorar pra próxima vez?"
}
```

#### Nó 7b (false branch): HTTP Evolution sendText (thanks)

```json
{
  "number": "{{ $json.patient_phone }}",
  "text": "Obrigada pelo retorno! Que bom que correu bem 💜"
}
```

(Após 7a ou 7b: encerra. Não passa pro AI Agent.)

### Ramo "awaiting_followup"

#### Nó 3b: Postgres "Save Feedback Text"

- Operation: **Execute Query**
- Query: bloco "Save Feedback Text"
- Parameters:
  - `={{ $json.message?.text || $json.text || $json.body }}`
  - `={{ $('Postgres: Lookup Pending NPS').item.json.id }}`

#### Nó 4b: HTTP Evolution sendText (final thanks)

```json
{
  "number": "{{ $json.patient_phone }}",
  "text": "Anotado, obrigada por contribuir 💜"
}
```

(Encerra. Não passa pro AI Agent.)

## Cuidados / armadilhas

1. **Continue On Fail no Lookup**: se o Postgres cair, mensagens de chat não podem travar. O Lookup tem `continueOnFail: true` e o Switch fallback manda pro AI Agent. Pior caso: paciente respondendo NPS é tratado como mensagem normal — degrada graciosamente.
2. **Janela 24h é forçada na query**: se o paciente demorar mais que 24h pra responder, a mensagem cai no AI Agent (não captura como NPS — comportamento intencional pra evitar lag de score em tenant).
3. **Múltiplas pesquisas pendentes do mesmo paciente**: a query `ORDER BY sent_at DESC LIMIT 1` resolve — pega a mais recente.
4. **Mensagem "obrigado" sem número**: se status='pending' e o regex não casa → cai no fallback (AI Agent). A IA pode responder normalmente. NPS continua pendente até timeout (status fica eternamente 'pending' — aceitável, é só ruído de dados).
5. **Telefone do remetente**: o `patient_phone` precisa estar em E.164 idêntico ao do INSERT do cron. Verifique no payload do Evolution se já vem `+55...` ou se precisa normalizar antes do Lookup.

## Como testar

Após aplicar:

1. Force um row em `patient_feedback`:
   ```sql
   INSERT INTO patient_feedback (tenant_id, patient_phone, doctor_name, status, sent_at)
   VALUES ('SEU_TENANT_ID', '+55SEUNUMERO', 'Dr. Teste', 'pending', now())
   RETURNING id;
   ```
2. Manda "9" pelo WhatsApp do número configurado.
3. Espera reply "Obrigada pelo retorno!". Confere `nps_score=9, status='closed'`.
4. Repete: cria row pending; manda "3"; espera reply de follow-up; manda "muito tempo de espera"; confere `feedback_text` e `status='closed'`.
5. Manda "oi" sem ter nada pendente → IA responde normal.
````

- [ ] **Step 2: Commit**

```bash
git add docs/n8n/master-secretaria-nps-handler.md
git commit -m "docs(nps): walkthrough da modificação no Master Secretária (pre-router)"
```

---

## Task 7: Smoke test runbook

**Files:**
- Create: `docs/n8n/nps-smoke-test.md`

- [ ] **Step 1: Criar runbook**

````markdown
# NPS — Smoke Test ponta-a-ponta

Sequência manual pra validar a feature em tenant teste antes de ativar em produção.

## Pré-requisitos

- Tenant teste com `evolution_status='connected'`
- Pelo menos 1 doctor com `calendar_id` válido
- Telefone WhatsApp de teste acessível

## Passos

### 1. Aplicar SQL

No Supabase SQL Editor:
```sql
\i scripts/nps-schema.sql
```
(Ou copia/cola o conteúdo de `scripts/nps-schema.sql`.)

Verifica:
```sql
\d patient_feedback
SELECT conname FROM pg_constraint WHERE conname = 'patient_feedback_status_check';
SELECT indexname FROM pg_indexes WHERE tablename = 'patient_feedback';
```

Esperado: constraint existe, 2 índices novos (`idx_patient_feedback_lookup`, `idx_patient_feedback_dedupe`).

### 2. Importar workflow "3. NPS Pesquisa Pós-Consulta" no n8n

Siga `docs/n8n/3-nps-pesquisa-walkthrough.md` — monta o workflow nó-a-nó.

Antes de ativar, **teste manualmente**:

1. Cria evento no Calendar do doctor teste:
   - `start.dateTime`: 30 min atrás (já passou)
   - `description`:
     ```
     Telefone: +55XX9999999X
     Nome Completo: Paciente Teste
     Data de Nascimento: 01/01/1990
     ID da conversa: smoke-test
     ```
2. Clica **Execute Workflow** no n8n.
3. Confere:
   ```sql
   SELECT id, patient_phone, doctor_name, status, sent_at
   FROM patient_feedback
   WHERE patient_phone = '+55XX9999999X'
   ORDER BY sent_at DESC LIMIT 1;
   ```
   Esperado: 1 row, status='pending', sent_at recente.
4. Verifica WhatsApp do número teste — chegou a mensagem.

### 3. Modificar Master Secretária

Siga `docs/n8n/master-secretaria-nps-handler.md`. Adiciona pre-router antes do Gemini.

### 4. Testar fluxo de resposta — caso promotor (≥7)

1. Pelo WhatsApp teste, responde **"9"**.
2. Confere reply: "Obrigada pelo retorno! Que bom que correu bem 💜"
3. SQL:
   ```sql
   SELECT nps_score, responded_at, status FROM patient_feedback
   WHERE patient_phone='+55XX9999999X' ORDER BY sent_at DESC LIMIT 1;
   ```
   Esperado: `nps_score=9, status='closed', responded_at not null`.

### 5. Testar fluxo de resposta — caso detrator (≤6)

1. Cria novo evento Calendar (ou força INSERT manual com `status='pending'`).
2. Re-executa workflow NPS pra criar nova row pending pro número teste.
3. Pelo WhatsApp, responde **"3"**.
4. Confere reply: "Obrigada pela nota 🙏\nO que podemos melhorar pra próxima vez?"
5. SQL:
   ```sql
   SELECT status FROM patient_feedback WHERE id = LAST_FEEDBACK_ID;
   -- Esperado: 'awaiting_followup'
   ```
6. Responde texto livre: **"O atendimento demorou muito"**
7. Confere reply: "Anotado, obrigada por contribuir 💜"
8. SQL:
   ```sql
   SELECT feedback_text, status FROM patient_feedback WHERE id = LAST_FEEDBACK_ID;
   -- Esperado: feedback_text='O atendimento demorou muito', status='closed'
   ```

### 6. Testar dedupe

Re-executa workflow no mesmo dia (sem novo evento). Confere que **não cria** row duplicado.

### 7. Testar fallback (mensagem não-NPS)

1. Sem feedback pendente, manda "oi" pelo WhatsApp.
2. AI Agent responde normalmente — pre-router não interceptou.

### 8. Verificar painel

- Acessa `/painel/feedback` no app.
- Confere: rows aparecem, summary cards atualizados (NPS, score médio, taxa, promotores/detratores).

### 9. Ativar workflow em produção

- No n8n, marca o workflow "3. NPS Pesquisa Pós-Consulta" como **Active**.
- Confere `Schedule Trigger` exibe próxima execução para hoje 19:00 ou amanhã 19:00 BRT.

## Critérios de aceitação ✅

- [ ] SQL aplicado sem erro
- [ ] Workflow novo importado e ativado
- [ ] Master Secretária com pre-router NPS
- [ ] Mensagem chega no WhatsApp do paciente teste
- [ ] Score 9 → status='closed', reply correto
- [ ] Score 3 → awaiting_followup → texto livre → closed, reply correto
- [ ] Dedupe não duplica no mesmo dia
- [ ] Mensagem fora de contexto cai no AI Agent normal
- [ ] /painel/feedback exibe rows com summary

## Rollback

Se algo der errado em produção:

1. **n8n**: desativa o workflow "3. NPS Pesquisa Pós-Consulta" (toggle "Active" off).
2. **Master Secretária**: desconecta o Switch "NPS Router" e religa o webhook → AI Agent direto. Os nós ficam órfãos mas não atrapalham (não removem da árvore — manter pra restaurar depois).
3. **SQL**: a migração é aditiva (não remove colunas). Não precisa rollback.
````

- [ ] **Step 2: Commit**

```bash
git add docs/n8n/nps-smoke-test.md
git commit -m "docs(nps): smoke test runbook ponta-a-ponta"
```

---

## Task 8: Atualizar PLANO-PRODUCAO.md

**Files:**
- Modify: `docs/PLANO-PRODUCAO.md`

- [ ] **Step 1: Localizar a linha relevante**

Run: `grep -n "NPS\|patient_feedback\|coleta" docs/PLANO-PRODUCAO.md`

- [ ] **Step 2: Editar pra marcar entrega**

Adiciona uma seção curta (ou item em onda existente) tipo:
```markdown
- ✅ NPS pós-consulta: workflow n8n cron 19h + Master Secretária trata respostas + painel já consome `patient_feedback`. Spec: `docs/superpowers/specs/2026-04-28-nps-pos-consulta-design.md`. Smoke: `docs/n8n/nps-smoke-test.md`.
```

(O texto exato depende do que já está no arquivo — adapte na execução.)

- [ ] **Step 3: Commit**

```bash
git add docs/PLANO-PRODUCAO.md
git commit -m "docs: marca NPS pós-consulta como entregue"
```

---

## Task 9: Final summary e push

- [ ] **Step 1: Conferir tudo committed**

Run: `git status` (esperado: clean) e `git log --oneline main..HEAD` (esperado: 7-8 commits novos)

- [ ] **Step 2: Push pra Vercel auto-deploy (se autorizado pelo Luiz)**

NÃO faz push automático. Pergunta primeiro: "Tudo pronto local. Pode dar `git push origin <branch>` pra Vercel deployar e o Luiz seguir o smoke test?"

---

## Self-Review

**Spec coverage:**
- ✅ Cron 19h BRT — Task 5
- ✅ Mensagem WhatsApp via Evolution — Task 5 (HTTP Request node)
- ✅ Master Secretária trata resposta NPS — Task 6
- ✅ Score ≤6 → follow-up "O que melhorar" — Task 6 (ramo pending → IF Score ≤6)
- ✅ Vincular dados no painel — já existe (escopo confirmado fora)
- ✅ Schema patient_feedback — Task 1
- ✅ Convenção description Calendar (Telefone + Nome) — Task 2
- ✅ Disclaimer de no-show na mensagem — Task 5 step 11

**Placeholder scan:**
- Task 8 step 2 diz "adapte na execução". Aceito porque o conteúdo exato do PLANO-PRODUCAO.md depende do estado vigente — o engineer lê o arquivo e insere na seção apropriada. Não é placeholder de código, é orientação de doc.

**Type consistency:**
- `feedback_id` usado em Code "Parse Score" → `feedback_id` em Save Score. Consistente.
- Status values: `pending`, `responded`, `awaiting_followup`, `closed`, `send_failed` — usados de forma idêntica em SQL constraint, Lookup query, Save Score (CASE). OK.
- `patient_phone` em E.164 — produzido por `normalizeToE164`, esperado por Lookup e Dedupe. OK.
