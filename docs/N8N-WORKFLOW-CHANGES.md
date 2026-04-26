# Mudanças manuais nos Workflows N8N

Mudanças cirúrgicas — abrir o workflow no UI do N8N, mexer no nó indicado, salvar.
Tempo estimado: ~10 min total.

---

## Workflow 1: `0. On Boarding Vivassit v4.1 BACKUP` (id `p2NZXbrP3gIdisQ3`)

### Mudança 1.1 — Substituir chat_id hardcoded por variável

Há 4 nós com `5749317361` hardcoded (chat_id de teste). Em produção precisa ser
o chat_id real do admin **ou** o do profissional após ele clicar /start no bot.

**Estratégia recomendada:** usar env var do N8N pro admin chat_id,
e o profissional recebe via EMAIL apenas (já tem o nó `Send email`).

**Passos no UI N8N:**

1. **Settings do workflow** → **Variables** → adicionar:
   - Nome: `ADMIN_TELEGRAM_CHAT_ID`
   - Valor: `5749317361` (ou outro chat_id de admin)

2. **Nó "Criar Bot Telegram v4"** (Set node, position [832, -128]):
   - Localiza o assignment `chat-id`
   - Antes: `"5749317361"` (string)
   - Depois: `={{ $vars.ADMIN_TELEGRAM_CHAT_ID }}` (expression)

3. **Nó "Code"** (Code node bot Telegram, position [1008, -128]):
   - Localiza linha: `let chatId = telethonResponse.success && telethonResponse.user_id ? telethonResponse.user_id : '5749317361';`
   - Substituir por: `let chatId = telethonResponse.success && telethonResponse.user_id ? telethonResponse.user_id : $vars.ADMIN_TELEGRAM_CHAT_ID;`

4. **Nó "Send a text message"** (Telegram, position [1872, 32]):
   - Campo `chatId`: `=5749317361`
   - Substituir por: `={{ $vars.ADMIN_TELEGRAM_CHAT_ID }}`

5. **Nó "Buscar User ID via Telethon"** (HTTP, disabled):
   - Já tá disabled, não precisa mexer

### Mudança 1.2 — Salvar dados de retorno no `tenants`

O frontend `/api/onboarding/route.ts` agora salva os dados retornados
(commit já feito). Mas pra redundância, considera adicionar UPDATE no banco
no fim do workflow:

**Adicionar nó Postgres antes do "Final Response Summary v4":**
- Operation: `Update`
- Table: `tenants`
- Match: `tenant_id = {{ $('Auto Configure Services v').item.json.tenant_id }}`
- Update fields:
  - `calendar_id` = `{{ $('Create Google Calendar v4').item.json.id }}`
  - `evolution_phone_number` = `{{ $('Auto Configure Services v').item.json.evolution_phone_number }}`
  - `evolution_instance_name` = `{{ $('Criar instancia').item.json.data.instance.instanceName }}`
  - `evolution_status` = `{{ $('Criar instancia').item.json.data.instance.status }}`
  - `telegram_bot_link` = `{{ $('Code').item.json.telegram_bot_link }}`
  - `chatwoot_account_id` = (do node correspondente)

**OU mantém só no frontend** (mais simples, já feito).

### Mudança 1.3 — Ativar o workflow

**Settings** do workflow → toggle **Active** ON

---

## Workflow 2: `6. Assistente Interno BACKUP` (id `WmM47MvuJPU8szyM`)

### Mudança 2.1 — Adicionar Webhook trigger (chat web)

**Adicionar novo nó:**
- Type: `Webhook`
- Name: `Receber Mensagem Web`
- HTTP Method: `POST`
- Path: `singulare-internal-chat`
- Authentication: None
- Response: `Last Node`

**Conectar:** `Receber Mensagem Web` → `Buscar Config Tenant` (mesmo destino do Telegram)

### Mudança 2.2 — Adaptar lookup de tenant

O nó `Buscar Config Tenant` hoje busca por `telegram_chat_id`. Precisa suportar
busca por `tenant_id` direto (vindo do webhook web).

**Editar query do nó "Buscar Config Tenant":**

```sql
SELECT tenant_id, clinic_name, chatwoot_url, chatwoot_account_id, telegram_chat_id, rendered_prompt
FROM tenants
WHERE
  -- Caso 1: vem do Telegram → busca por chat_id
  ($json.message.chat.id IS NOT NULL AND telegram_chat_id = '{{ $json.message.chat.id }}')
  OR
  -- Caso 2: vem do Web → vem tenant_id direto no payload
  ($json.tenant_id IS NOT NULL AND tenant_id = '{{ $json.tenant_id }}')
  AND status = 'active'
LIMIT 1
```

**Alternativa mais limpa**: adicionar nó IF antes do lookup:
- IF `{{ $json.source === 'web' }}` → busca por tenant_id
- ELSE → busca por telegram_chat_id (atual)

### Mudança 2.3 — Adaptar nó "Info" pra incluir source

**Editar nó "Info" (Set node):**
Adicionar assignment:
- Nome: `source`
- Valor: `={{ $json.source ?? 'telegram' }}`
- Tipo: string

### Mudança 2.4 — Switch antes da resposta

**Adicionar nó Switch APÓS "Assistente do escritório interno":**
- Nome: `Roteador de Resposta`
- Condições:
  - Output 1 (Web): `{{ $('Info').item.json.source === 'web' }}`
  - Output 2 (Telegram): default

**Conectar:**
- Web output → novo nó `Respond to Webhook`:
  - Body: `{ "reply": "{{ $json.output }}" }`
  - Status: 200
- Telegram output → `Responder Telegram` (atual)

### Mudança 2.5 — Memory window 10 → 5

**Nó "Postgres Chat Memory":**
- Campo `contextWindowLength`: `10` → `5`

Reduz ~12% do custo de tokens por chamada.

### Mudança 2.6 — Forçar Gemini 2.0 Flash

**Nó "Google Gemini Chat Model":**
- Verifica que o modelo selecionado é `gemini-2.0-flash-exp` ou `gemini-2.0-flash`
- Se estiver em `gemini-1.5-pro` ou `gemini-2.5-pro` → custo 16x maior

### Mudança 2.7 — Ativar o workflow

**Settings** → **Active** ON

---

## Workflow 3: Tracking de tokens (futuro, opcional)

Pra ter custo REAL por tenant em vez de estimativa, adicionar:

1. Nó Postgres `INSERT INTO usage_tracking_llm` após cada execução do agente
2. Capturar `input_tokens`, `output_tokens` da resposta do Gemini
3. Atualizar coluna no `usage_tracking` ou criar tabela nova

DDL sugerido (pra rodar no Supabase SQL Editor):

```sql
ALTER TABLE usage_tracking
  ADD COLUMN IF NOT EXISTS llm_input_tokens BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS llm_output_tokens BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS llm_calls_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS llm_model VARCHAR(50),
  ADD COLUMN IF NOT EXISTS llm_cost_usd_estimated NUMERIC(10, 6) DEFAULT 0;
```

---

## Validação após mudanças

1. **Onboarding**: testa criar nova clínica via `/landing` → preencher onboarding → verificar que dados N8N foram salvos no `tenants` (calendar_id, telegram_bot_link, etc)

2. **Assistente Interno**: 
   - Testa via Telegram (continua funcionando)
   - Testa via chat web do `/painel` (bolha) — agora responde de verdade

3. **Custo**: acessa `/admin` (com email admin) → vê dashboard de uso e custo estimado
