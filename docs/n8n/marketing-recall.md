# Workflow n8n "Marketing: Recall Pacientes Inativos" — Spec

Cron semanal (segunda 10:00 BRT). Para cada tenant com plano Presença ativo, identifica pacientes sem consulta há 90+ dias e envia WhatsApp de recall.

## Pré-requisitos

- Credencial Postgres "Supabase" já configurada.
- Evolution API (Baileys) com instância do tenant ativa.
- Tabela `marketing_subscriptions` com status ativo.
- Tabela `marketing_events` para logging e dedup.
- Acesso à tabela `calendar_events` ou `appointments` para última consulta.

## Estrutura de nós

```
Schedule Trigger (Segunda 10:00 BRT)
  └─ Postgres: List Active Marketing Tenants
       └─ Split In Batches (1 por tenant)
            └─ Postgres: List Inactive Patients (90+ days)
                 └─ Split In Batches (1 por patient)
                      └─ Postgres: Check Dedup (recall enviado nos últimos 30 dias?)
                           └─ IF: not sent recently
                                └─ Code: Build recall message
                                     └─ HTTP Request: Evolution sendText
                                          └─ IF: response OK
                                               ├─ true: Postgres: Log marketing_event (recall_sent)
                                               └─ false: Postgres: Log error
```

## Configuração nó-a-nó

### 1. Schedule Trigger

- Type: `Schedule Trigger`
- Trigger Interval: **Cron**
- Cron Expression: `0 10 * * 1` (segunda 10:00)
- Timezone: `America/Sao_Paulo`

### 2. Postgres "List Active Marketing Tenants"

- Operation: **Execute Query**
- Query:
```sql
SELECT t.tenant_id, t.clinic_name, t.evolution_instance_name,
       ms.plan, ms.id as subscription_id
FROM tenants t
INNER JOIN marketing_subscriptions ms ON ms.tenant_id = t.tenant_id
WHERE ms.status IN ('active', 'trial')
  AND t.evolution_instance_name IS NOT NULL;
```

### 3. Split In Batches (tenants)

- Batch Size: **1**

### 4. Postgres "List Inactive Patients"

Pacientes que tiveram a última consulta há mais de 90 dias e não receberam recall nos últimos 30 dias.

- Operation: **Execute Query**
- Query:
```sql
WITH last_appointment AS (
  SELECT
    p.id AS patient_id,
    p.name,
    p.phone,
    MAX(ce.start_time) AS last_visit
  FROM patients p
  LEFT JOIN calendar_events ce ON ce.patient_id = p.id AND ce.tenant_id = p.tenant_id
  WHERE p.tenant_id = $1
    AND p.phone IS NOT NULL
    AND p.phone != ''
  GROUP BY p.id, p.name, p.phone
),
recent_recalls AS (
  SELECT (metadata->>'patient_id')::int AS patient_id
  FROM marketing_events
  WHERE tenant_id = $1
    AND event_type = 'recall_sent'
    AND created_at > NOW() - INTERVAL '30 days'
)
SELECT la.patient_id, la.name, la.phone, la.last_visit
FROM last_appointment la
LEFT JOIN recent_recalls rr ON rr.patient_id = la.patient_id
WHERE rr.patient_id IS NULL
  AND la.last_visit IS NOT NULL
  AND la.last_visit < NOW() - INTERVAL '90 days'
ORDER BY la.last_visit ASC
LIMIT 50;
```
- Query Parameters: `={{ $json.tenant_id }}`

Nota: `LIMIT 50` para evitar spam. Em futuras versões, pode ser configurável por tenant.

### 5. Split In Batches (patients)

- Batch Size: **1**
- Add **Wait** node entre batches: 3-5 segundos (rate limit Evolution/WhatsApp)

### 6. Code "Build recall message"

```javascript
const patientName = $json.name || 'paciente';
const firstName = patientName.split(' ')[0];
const clinicName = $('List Active Marketing Tenants').first().json.clinic_name;

// Calcular meses desde última visita
const lastVisit = new Date($json.last_visit);
const months = Math.round((Date.now() - lastVisit.getTime()) / (30 * 24 * 60 * 60 * 1000));

const message = `Olá, ${firstName}! 👋\n\nAqui é da ${clinicName}. Faz ${months} meses desde sua última consulta e queremos saber como você está!\n\nQue tal agendar um retorno? Estamos com horários disponíveis e seria ótimo ver como está sua saúde.\n\nÉ só responder essa mensagem ou ligar para agendar. 😊`;

return [{ json: { message, phone: $json.phone, patient_id: $json.patient_id } }];
```

### 7. HTTP Request "Evolution sendText"

- Method: **POST**
- URL: `{{ $env.EVOLUTION_BASE_URL }}/message/sendText/{{ $('List Active Marketing Tenants').first().json.evolution_instance_name }}`
- Headers:
  - `apikey`: `{{ $env.EVOLUTION_API_KEY }}`
  - `Content-Type`: `application/json`
- Body:
```json
{
  "number": "{{ $json.phone }}",
  "text": "{{ $json.message }}"
}
```

### 8. Postgres "Log Recall Event"

- Operation: **Execute Query**
- Query:
```sql
INSERT INTO marketing_events (tenant_id, event_type, metadata, created_at)
VALUES ($1, 'recall_sent', $2::jsonb, NOW());
```
- Parameters:
  - `$1`: `={{ $('List Active Marketing Tenants').first().json.tenant_id }}`
  - `$2`: `={{ JSON.stringify({ patient_id: $json.patient_id, patient_phone: $json.phone }) }}`

## Conversão de recall

Um recall é "convertido" quando o paciente agenda uma nova consulta. Isso pode ser detectado:
1. **Via agente IA**: Se o paciente responder ao WhatsApp e agendar, o agente registra.
2. **Via cron semanal**: Verificar se pacientes que receberam recall nos últimos 30 dias têm nova consulta no calendário.

No MVP, a conversão é logada manualmente ou pelo agente IA. O workflow de tracking automático é Phase 2.

## Rate limiting e segurança

- **Dedup**: Não enviar recall se já enviou nos últimos 30 dias para o mesmo paciente.
- **Limit**: Máximo 50 pacientes por tenant por execução.
- **Wait**: 3-5 segundos entre cada mensagem (WhatsApp rate limit).
- **Horário**: Segunda 10:00 (horário comercial, não incomodar fim de semana).

## Regras CFM/CRO

- ❌ Não mencionar tratamentos específicos
- ❌ Não oferecer promoções ou descontos
- ❌ Não criar urgência falsa ("última chance")
- ✅ Lembrete cordial sobre check-up/retorno
- ✅ Linguagem informal e respeitosa
- ✅ Opt-out implícito (paciente pode ignorar)

## Notas de implementação

1. A query de "pacientes inativos" depende da existência de uma tabela `calendar_events` com `patient_id`. Se o schema usar outra tabela (e.g., `appointments` ou eventos do Google Calendar), ajustar a query.
2. O campo `evolution_instance_name` da tabela `tenants` identifica a instância Baileys/Evolution do tenant.
3. Se um tenant não tiver instância Evolution configurada, o `WHERE` já o filtra automaticamente.
