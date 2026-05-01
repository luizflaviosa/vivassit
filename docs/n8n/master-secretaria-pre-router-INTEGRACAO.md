# Master Secretária — Integração dos Pre-Routers (NPS + Confirmação)

Dois sub-workflows criados, ambos chamados ANTES do AI Agent rodar:

| Sub-workflow | ID | Função |
|---|---|---|
| **NPS Pre-Router** | `ZWzRBjClOdA5xRNQ` | Intercepta resposta numérica 0-10 à pesquisa NPS pós-consulta |
| **Confirmação Pre-Router** | `OqxxLRm33tSe69HS` | Intercepta resposta sim/cancelar/reagendar à confirmação diária 8h |

Ambos respondem via **Chatwoot** (sub-workflow `5. Enviar agendamento` id `IUFMBjkYRcp20xr7`) e disparam **push pro médico** via `POST /api/n8n/push` (Vercel) quando relevante.

Este doc é o **passo manual** no UI do N8N pra plugar os pre-routers no Master Secretária ATIVO (`OOT4JZyKZUyB0SxB`). 4 nós novos no total. ~10 min. Reversível em 1 clique cada.

---

## Antes / Depois

**Hoje:**
```
Buscar Config Tenant → Mensagem chegando? → ...
```

**Depois:**
```
Buscar Config Tenant
   → [Confirmação Pre-Router] → [IF handled?]
                                      ├─ true: STOP (já respondeu)
                                      └─ false: ↓
   → [NPS Pre-Router] → [IF handled?]
                                      ├─ true: STOP (já respondeu)
                                      └─ false: Mensagem chegando? → ... (AI normal)
```

> **Ordem importa**: Confirmação primeiro (mais comum), NPS depois. Se ambos responderem `handled=false`, fluxo normal (AI Agent) roda.

---

## Passo 0 — Confirmação Pre-Router (analógo ao NPS)

Repete o mesmo padrão do NPS, **antes** dele:

1. No Master Secretária, depois de `Buscar Config Tenant`, adiciona **Execute Sub-Workflow**
   - Workflow: `Master Secretária — Confirmação Pre-Router` (id `OqxxLRm33tSe69HS`)
   - Workflow Inputs (mesmos 6 do NPS):
     - `tenant_id` = `={{ $('Buscar Config Tenant').item.json.tenant_id }}`
     - `patient_phone` = `={{ $('Info').item.json.telefone }}`
     - `mensagem` = `={{ $('Info').item.json.mensagem }}`
     - `id_conta` = `={{ $('Info').item.json.id_conta }}`
     - `id_conversa` = `={{ $('Info').item.json.id_conversa }}`
     - `url_chatwoot` = `={{ $('Info').item.json.url_chatwoot }}`
   - **Wait for Sub-Workflow Completion**: ON
   - Renomeia o nó pra **`Confirmação Pre-Router`**
2. Adiciona um IF logo depois com condition `={{ $json.handled }}` equals `true`
3. Renomeia o IF pra **`Confirmação handled?`**
4. Saída **true** → SEM conexão (encerra)
5. Saída **false** → conecta no **NPS Pre-Router** (próximo passo)

## Passo 1 — NPS Pre-Router (depois do Confirmação)

1. Abre `1. Master Secretária` no N8N
2. Conecta a saída **false** do `Confirmação handled?` (do Passo 0) num novo **Execute Sub-Workflow**:
   - Source: clica no `+` da saída false → "Execute Sub-Workflow"
5. Configura:
   - **Workflow**: seleciona `Master Secretária — NPS Pre-Router` (id `ZWzRBjClOdA5xRNQ`)
   - **Workflow Inputs** → Modo: "Define Below for Each Output" → cola estes **6 fields**:
     - `tenant_id` (string) = `={{ $('Buscar Config Tenant').item.json.tenant_id }}`
     - `patient_phone` (string) = `={{ $('Info').item.json.telefone }}`
     - `mensagem` (string) = `={{ $('Info').item.json.mensagem }}`
     - `id_conta` (string) = `={{ $('Info').item.json.id_conta }}`
     - `id_conversa` (string) = `={{ $('Info').item.json.id_conversa }}`
     - `url_chatwoot` (string) = `={{ $('Info').item.json.url_chatwoot }}`
   - **Wait for sub-workflow completion**: ON
   - Save

> **Nota:** Os campos `id_conta`, `id_conversa` e `url_chatwoot` já existem no payload do `Info` (vêm do webhook do Chatwoot). Se algum estiver com nome diferente no seu `Info`, ajuste o expression — o resto do payload do Master Secretária ATIVO já usa esses mesmos nomes pra responder via `5. Enviar agendamento`.

## Passo 2 — Adicionar IF "handled?"

1. Logo à direita do `Execute Sub-Workflow`, adiciona um **`IF`**
2. Configura:
   - Condition: `={{ $json.handled }}` **equals** `true` (boolean)
3. **Saída True** (handled=true): deixa SEM conexão (encerra — NPS foi tratado, não vai pro AI)
4. **Saída False** (handled=false): conecta em **`Mensagem chegando?`** (segue fluxo normal pro AI Agent)

## Passo 3 — Salvar e ativar

1. Save no workflow Master Secretária
2. **Ativa os 2 workflows**:
   - `OqxxLRm33tSe69HS` (Confirmação Pre-Router) — toggle Active
   - `ZWzRBjClOdA5xRNQ` (NPS Pre-Router) — toggle Active
3. Confirma que os env vars estão setados no N8N:
   - `APP_BASE_URL` = `https://app.singulare.org` (necessário pros pushes do Confirmação)
   - `N8N_TO_VERCEL_TOKEN` = mesmo token usado em `/marketplace/charge` (já existe)
4. Sem env vars novos pra Chatwoot — usa credenciais do `5. Enviar agendamento`

---

## Como testar

**Sem cliente real**, num terminal SQL:
```sql
INSERT INTO patient_feedback
  (tenant_id, patient_phone, doctor_name, status, sent_at, appointment_date)
VALUES
  ('singulare', '+55SEUNUMERO', 'Dra. Paula Franzon', 'pending', now(), now())
RETURNING id;
```

Pelo seu WhatsApp, manda **"9"** para o número da Paula. Esperado:
- N8N executa o Master Secretária
- Pre-router lookup encontra o pending
- Switch → Pending → Parse Score (9) → Save → Reply Thanks (via Chatwoot)
- Você recebe "Obrigada pelo retorno! Que bom que correu bem 💜"
- SQL `SELECT * FROM patient_feedback ORDER BY id DESC LIMIT 1` mostra `nps_score=9, status=closed, responded_at=...`

Repete com nota baixa: insere outra row pending, manda "3", esperado:
- Reply "Obrigada pela nota 🙏\nO que podemos melhorar pra próxima vez?"
- DB: `status=awaiting_followup, nps_score=3`
- Manda mensagem de texto livre ("muito tempo de espera"), esperado:
- Reply "Anotado, obrigada por contribuir 💜"
- DB: `status=closed, feedback_text='muito tempo de espera'`

**Sem nada pendente** (terceiro teste): manda "oi" → fluxo normal, IA Gemini responde.

---

## Cron 19h (envio outbound)

Workflow `87vZl62KFCOqFbyI` ("3. NPS Pesquisa Pós-Consulta") — **ATIVO**, cron 19h BRT.

- Lista médicos+tenants com Chatwoot configurado (chatwoot_url, chatwoot_account_id, chatwoot_inbox_id NOT NULL)
- Pra cada um: lista eventos finalizados hoje no Google Calendar do médico
- Extrai phone+nome da `description`, dedup contra `patient_feedback` do dia
- Insere row `pending` em `patient_feedback`
- Envia via **Chatwoot direto** (`POST /api/v1/accounts/{id}/conversations`) — cria contato + conversa + mensagem em 1 call
- Resposta numérica do paciente cai no Master Secretária → Pre-Router → fecha o ciclo

> **Pré-requisito**: tenants precisam ter `chatwoot_url`, `chatwoot_account_id`, `chatwoot_inbox_id` preenchidos. Tenant `singulare` (Dra. Paula) já tem. Outros tenants sem Chatwoot são pulados.

---

## Confirmação Pre-Router — como funciona

Quando o paciente responde a uma confirmação enviada pelo cron `2. Confirmação Diária`:

1. **Lookup**: confere em `n8n_historico_mensagens` se houve msg "ai" com palavra "confirm" pra esse phone nas últimas 18h. Se não → `handled=false` (deixa AI lidar).
2. **Find Appointment**: busca em `appointments_detailed` consulta com status `scheduled` nas próximas 48h pra esse phone. Se não → `handled=false`.
3. **Classify Intent** (Code node, regex sem LLM):
   - `confirm`: "sim", "ok", "claro", "perfeito", "combinado", emoji 👍✅
   - `reschedule`: "reagendar", "remarcar", "adiar", "outro horário/dia"
   - `cancel`: "cancelar", "não vou/posso", "desisti"
   - `unknown`: qualquer outra coisa
4. **Switch by intent**:
   - **`confirm`** → UPDATE `appointments.status='confirmed'` + responde "Combinado! 💜 Sua consulta está confirmada..." + push pro médico (✅ Maria confirmou) + `handled=true`
   - **`reschedule`** → push pro médico (🔄 pediu remarcação, IA está cuidando) + `handled=false` (AI Agent lida com Calendar)
   - **`cancel`** → push pro médico (❌ cancelou, IA vai responder) + `handled=false` (AI Agent lida)
   - **`unknown`** → `handled=false` (fluxo normal)

### Push notifications

Disparados via `POST /api/n8n/push` (Vercel) com Bearer `N8N_TO_VERCEL_TOKEN`. Tipos:
- `appointment_confirmed` (priority normal)
- `appointment_reschedule_request` (priority high)
- `appointment_cancel_request` (priority high)

Cada membro do tenant pode desligar tipos específicos via `notification_prefs` (toggles novos: `appointment_confirmed`, `appointment_reschedule_request`, `appointment_cancel_request` — default true).

---

## Rollback (se precisar)

No `1. Master Secretária`:
1. Apaga os 4 nós (Confirmação Pre-Router, Confirmação handled?, NPS Pre-Router, NPS handled?)
2. Reconecta `Buscar Config Tenant` → `Mensagem chegando?` direto
3. Desativa `OqxxLRm33tSe69HS` e `ZWzRBjClOdA5xRNQ`

Comportamento volta a ser idêntico ao de antes.
