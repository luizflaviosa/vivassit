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
2. **Janela 24h é forçada na query**: se o paciente demorar mais que 24h pra responder, a mensagem cai no AI Agent (não captura como NPS — comportamento intencional).
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
