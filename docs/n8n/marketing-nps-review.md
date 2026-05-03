# Workflow n8n "Marketing: NPS → Google Review" — Spec

Triggered quando score NPS 9 ou 10 é registrado. Envia mensagem WhatsApp com link direto para avaliação no Google.

## Pré-requisitos

- Credencial Postgres "Supabase" já configurada.
- Evolution API (Baileys) com instância do tenant ativa.
- Tabela `marketing_subscriptions` com `google_review_url` preenchido.
- Tabela `marketing_events` para logging.

## Trigger

**Webhook** (chamado pelo handler de NPS existente, workflow "3. NPS Pesquisa"):
- Quando o score NPS for >= 9, o workflow NPS envia HTTP Request para este webhook.
- Payload: `{ tenant_id, patient_phone, patient_name, score, nps_id }`

Alternativa: **Cron a cada 5 min** que consulta `nps_responses` com `score >= 9 AND review_sent = false`.

## Estrutura de nós

```
Webhook Trigger (POST /webhook/marketing-nps-review)
  └─ Postgres: Check Subscription Active
       └─ IF: subscription exists AND status in ('active','trial') AND google_review_url != null
            ├─ true:
            │    └─ Code: Build WhatsApp message
            │         └─ HTTP Request: Evolution sendText
            │              └─ IF: response OK
            │                   ├─ true:
            │                   │    └─ Postgres: Log marketing_event (review_request_sent)
            │                   │         └─ Postgres: Mark nps_response review_sent = true
            │                   └─ false:
            │                        └─ Postgres: Log error event
            └─ false: No-op (tenant sem plano ativo)
```

## Configuração nó-a-nó

### 1. Webhook Trigger

- Type: `Webhook`
- HTTP Method: **POST**
- Path: `marketing-nps-review`
- Authentication: **Header Auth** (X-N8N-Secret)
- Response Mode: **Last Node**

### 2. Postgres "Check Subscription Active"

- Operation: **Execute Query**
- Query:
```sql
SELECT ms.id, ms.plan, ms.status, ms.google_review_url
FROM marketing_subscriptions ms
WHERE ms.tenant_id = $1
  AND ms.status IN ('active', 'trial')
  AND ms.google_review_url IS NOT NULL
  AND ms.google_review_url != ''
LIMIT 1;
```
- Query Parameters: `={{ $json.tenant_id }}`

### 3. IF "Subscription Valid"

- Condition: `{{ $json.id }}` is not empty

### 4. Code "Build WhatsApp message"

```javascript
const patientName = $input.first().json.patient_name || 'paciente';
const firstName = patientName.split(' ')[0];
const reviewUrl = $('Check Subscription Active').first().json.google_review_url;

const message = `Olá, ${firstName}! 😊\n\nMuito obrigado pela avaliação positiva! Ficamos felizes em saber que você teve uma boa experiência.\n\nSe puder, gostaríamos muito que deixasse uma avaliação no Google. Isso nos ajuda a atender mais pessoas como você:\n\n👉 ${reviewUrl}\n\nLeva menos de 1 minuto. Obrigado! 🙏`;

return [{ json: { message, phone: $input.first().json.patient_phone } }];
```

### 5. HTTP Request "Evolution sendText"

- Method: **POST**
- URL: `{{ $env.EVOLUTION_BASE_URL }}/message/sendText/{{ $('Webhook Trigger').first().json.tenant_instance }}`
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

### 6. Postgres "Log Event"

- Operation: **Execute Query**
- Query:
```sql
INSERT INTO marketing_events (tenant_id, event_type, metadata, created_at)
VALUES ($1, 'review_request_sent', $2::jsonb, NOW());
```
- Parameters:
  - `$1`: `={{ $('Webhook Trigger').first().json.tenant_id }}`
  - `$2`: `={{ JSON.stringify({ patient_phone: $('Webhook Trigger').first().json.patient_phone, nps_score: $('Webhook Trigger').first().json.score, nps_id: $('Webhook Trigger').first().json.nps_id }) }}`

### 7. Postgres "Mark NPS Sent"

- Operation: **Execute Query**
- Query:
```sql
UPDATE nps_responses SET review_sent = true, review_sent_at = NOW()
WHERE id = $1;
```
- Parameters: `={{ $('Webhook Trigger').first().json.nps_id }}`

## Mensagem template

A mensagem é informal e curta. Regras CFM:
- ❌ Não mencionar promoções ou descontos
- ❌ Não solicitar depoimento sobre tratamento específico
- ✅ Solicitar avaliação genérica sobre experiência no consultório
- ✅ Usar linguagem simples e respeitosa

## Tracking de conversão

Para saber se o review foi de fato postado, o workflow de "Review Completion Check" (futuro) consultará a Google Business Profile API. No MVP, apenas logamos o envio.

## Integração com NPS existente

O workflow NPS existente ("3. NPS Pesquisa") já processa scores. Adicionar ao final do workflow existente:
- Após registrar o score no banco
- IF score >= 9
  - HTTP Request para este webhook
  - Passa `{ tenant_id, patient_phone, patient_name, score, nps_id }`

Isso mantém os workflows desacoplados e permite ativar/desativar o marketing independentemente.
