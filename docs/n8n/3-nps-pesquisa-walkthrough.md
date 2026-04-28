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
                           └─ Code: Filter Concluded + Extract Patient Info
                                └─ Postgres: Dedupe (LIMIT 1)
                                     └─ IF: dedupe row count == 0
                                          └─ Postgres: Insert Pending → returns id
                                               └─ HTTP Request: Evolution sendText
                                                    └─ IF: response.status OK
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

Cole o conteúdo abaixo (versão adaptada para n8n da função testada em `scripts/n8n-functions/extract-patient-info.js`):

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

// Pega doctor_name e tenant_id dos contextos n8n upstream.
// IMPORTANTE: os nomes dos nós Postgres precisam ser EXATAMENTE
// "Postgres: List Doctors" e "Postgres: List Tenants".
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
- Authentication: **Header Auth** com header `apikey` = `={{ $env.EVOLUTION_API_KEY }}` (se aplicável)
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

- Condition: expressão `={{ ['PENDING','SENT','success'].includes($json.status) }}`
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
