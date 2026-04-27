# Walkthrough N8N — Singulare

Guia clique-a-clique. ~15 min total.

---

## 🌐 PASSO 0 — Abrir N8N

1. Abre teu n8n no navegador (provavelmente **https://n8n.singulare.org/** se for self-hosted, ou o que você usa)
2. Faz login
3. Lateral esquerda → **Workflows**

> Se sua URL for outra, troca em todo lugar abaixo onde aparece `n8n.singulare.org`.

---

# WORKFLOW 1 — `0. On Boarding Vivassit v4.1 BACKUP`

**ID:** `p2NZXbrP3gIdisQ3` · **Status atual:** Inativo · **Objetivo:** trocar 4 hardcoded chat_ids + ativar.

## Abrir o workflow

1. Workflows → busca por **"Vivassit v4.1 BACKUP"**
2. Clica no nome dele → abre o canvas com os nós

---

## Etapa 1.1 — Criar variável de workflow

Variáveis de workflow guardam configs sem misturar com código.

1. **Topo do canvas** → ícone de **engrenagem ⚙️** (Settings) → ou **Settings** no menu lateral do workflow
2. Procura aba **"Variables"** ou **"Workflow Variables"**
3. Clica **"Add Variable"** (ou similar)
4. Preenche:
   - **Key:** `ADMIN_TELEGRAM_CHAT_ID`
   - **Value:** `5749317361`
5. **Save**

> Se a opção "Variables" não aparecer no UI do N8N (depende da versão), pula
> essa etapa e nas alterações abaixo use diretamente `5749317361` em vez de
> `$vars.ADMIN_TELEGRAM_CHAT_ID`. O importante é centralizar em algum lugar.

---

## Etapa 1.2 — Editar nó **"Criar Bot Telegram v4"**

**Onde está:** posição [832, -128] no canvas. É um nó **Set** (caixa amarela).

1. Clica duas vezes no nó **"Criar Bot Telegram v4"** → abre o painel de edição à direita
2. Procura a aba **"Fields to Set"** (ou "Assignments" dependendo da versão)
3. Encontra a linha onde está:
   - Name: `telegram_chat_id`
   - Value (atual): `5749317361`
4. **Mude o valor** clicando no campo:
   - Antes (modo "Fixed"): `5749317361`
   - Depois (mude pra modo "Expression" — clica no `=` no canto do campo): `{{ $vars.ADMIN_TELEGRAM_CHAT_ID }}`
5. **Save** no painel (ou ESC pra fechar — auto-save)

---

## Etapa 1.3 — Editar nó **"Code"** (config Bot Telegram)

**Onde está:** posição [1008, -128]. É um nó **Code** (azul).

1. Clica duas vezes em **"Code"** → painel direita abre com editor de JS
2. Procura a linha (perto da metade do código):
   ```js
   let chatId = telethonResponse.success && telethonResponse.user_id ? telethonResponse.user_id : '5749317361';
   ```
3. Substitua por:
   ```js
   let chatId = telethonResponse.success && telethonResponse.user_id ? telethonResponse.user_id : $vars.ADMIN_TELEGRAM_CHAT_ID;
   ```
4. **Save**

> Se as `Variables` do N8N não suportam acesso via `$vars` em código JS,
> deixa hardcoded mesmo (`'5749317361'`) — esse é só um caminho de fallback,
> não compromete o fluxo principal.

---

## Etapa 1.4 — Editar nó **"Send a text message"** (notificação final Telegram)

**Onde está:** posição [1872, 32]. Nó **Telegram** (azul).

1. Duplo clique → painel direita
2. Campo **"Chat ID"**:
   - Antes: `=5749317361` (ou `5749317361` simples)
   - Depois (modo Expression): `{{ $vars.ADMIN_TELEGRAM_CHAT_ID }}`
3. **Save**

---

## Etapa 1.5 — Nó "Buscar User ID via Telethon"

**Onde está:** posição [1616, 48]. Já está **disabled**. Não precisa mexer, mas se quiser limpar:

1. Duplo clique
2. Body do request: troca `"phone"` se quiser, ou **Delete** o nó (clique direito → Delete)

---

## Etapa 1.6 — Ativar o workflow

1. **Topo do canvas** → toggle **"Inactive"** → vira **"Active"** (verde)
2. Confirma se aparecer popup
3. **Save** (ícone de disquete ou Ctrl+S)

---

## Etapa 1.7 — Verificar webhook URL

Pra o frontend chamar esse workflow:
1. Encontra o nó **"🎯 Webhook Vivassit v4"** (canto superior esquerdo do canvas)
2. Duplo clique → vê **"Production URL"**:
   ```
   https://n8n.singulare.org/webhook/2f433624-1d6d-4c11-9e32-a567b9d29c5f
   ```
3. **Copia essa URL**
4. **Vercel** → projeto vivassit → Settings → Environment Variables:
   - Key: `N8N_WEBHOOK_URL`
   - Value: a URL copiada
   - ✅ Production · ✅ Preview · ✅ Development → Save
5. **Vercel → Deployments → último → ⋯ → Redeploy** (sem cache)

✅ **Workflow 1 pronto.** Agora qualquer onboarding novo dispara esse fluxo.

---

# WORKFLOW 2 — `6. Assistente Interno BACKUP`

**ID:** `WmM47MvuJPU8szyM` · **Status atual:** Inativo · **Objetivo:** adicionar suporte ao chat web do painel + reduzir custo.

## Abrir o workflow

1. Workflows → busca **"6. Assistente Interno BACKUP"**
2. Clica no nome → abre canvas

---

## Etapa 2.1 — Adicionar nó **Webhook** (chat web)

1. **Canvas em branco** (área vazia, lado do nó Telegram trigger atual)
2. Botão **"+"** ou clica com botão direito → **"Add Node"**
3. Busca por **"Webhook"** → escolhe o nó **Webhook** (ícone azul, n8n-nodes-base.webhook)
4. Configurações:
   - **HTTP Method:** `POST`
   - **Path:** `singulare-internal-chat`
   - **Authentication:** `None`
   - **Respond:** `Using 'Respond to Webhook' Node`
5. **Save** (no painel direita)
6. **Renomeia** o nó (clica no nome no topo do painel) pra **"Receber Mensagem Web"**

### Conectar ao fluxo

1. Arrasta da bolinha de saída do **"Receber Mensagem Web"** até o nó **"Buscar Config Tenant"**
2. Aparece linha de conexão. Pronto.

> Resultado: agora o nó "Buscar Config Tenant" tem 2 entradas — uma do Telegram trigger, outra do Webhook.

---

## Etapa 2.2 — Editar query do nó **"Buscar Config Tenant"**

**Onde está:** posição [-1504, 192]. Nó **Postgres** (azul).

1. Duplo clique → painel direita
2. Campo **"Query"** — atual:
   ```sql
   SELECT tenant_id, clinic_name, chatwoot_url, chatwoot_account_id, telegram_chat_id, rendered_prompt
   FROM tenants
   WHERE telegram_chat_id = '{{ $json.message.chat.id }}'
     AND status = 'active'
   LIMIT 1
   ```
3. **Substituir por:**
   ```sql
   SELECT tenant_id, clinic_name, chatwoot_url, chatwoot_account_id, telegram_chat_id, rendered_prompt
   FROM tenants
   WHERE
     status = 'active'
     AND (
       telegram_chat_id = '{{ $json.message ? $json.message.chat.id : "" }}'
       OR tenant_id = '{{ $json.tenant_id || "" }}'
     )
   LIMIT 1
   ```
4. **Save**

> Esse SQL aceita ambas origens: Telegram (busca por `chat.id`) ou Web (busca direto por `tenant_id` que vem no payload).

---

## Etapa 2.3 — Editar nó **"Info"** pra capturar source

**Onde está:** posição [-1280, 192]. Nó **Set**.

1. Duplo clique
2. Aba **"Fields to Set"** → clica **"+ Add Field"**
3. Configurações do novo field:
   - **Name:** `source`
   - **Type:** `String`
   - **Value** (modo Expression): `{{ $json.source ?? 'telegram' }}`
4. Adiciona outro field também:
   - **Name:** `web_response_required`
   - **Type:** `Boolean`
   - **Value** (Expression): `{{ ($json.source ?? 'telegram') === 'web' }}`
5. **Save**

---

## Etapa 2.4 — Adicionar **Switch** depois do agente (rotear resposta)

Hoje o fluxo termina sempre em **"Responder Telegram"**. Precisa rotear: web vai pra `Respond to Webhook`, telegram continua igual.

### A) Adicionar nó Switch

1. Canvas → **"+"** ou botão direito → Add Node
2. Busca **"Switch"** → seleciona
3. Coloca entre **"Assistente do escritório interno"** e **"Responder Telegram"**
4. Configurações:
   - **Mode:** `Rules`
   - **Number of Outputs:** `2`
   - **Rule 1** (output "Web"):
     - Conditions → adicionar:
       - Value 1 (Expression): `{{ $('Info').item.json.source }}`
       - Operation: `equal`
       - Value 2: `web`
     - Output Key: `Web`
   - **Rule 2** (output "Telegram"):
     - Conditions:
       - Value 1: `{{ $('Info').item.json.source }}`
       - Operation: `not equal`
       - Value 2: `web`
     - Output Key: `Telegram`
5. **Renomeia** o nó pra **"Roteador Resposta"**

### B) Reconectar fluxo

1. **Apaga** a conexão atual entre `"Assistente do escritório interno"` → `"Responder Telegram"` (clica na linha → Delete)
2. **Conecta:** `Assistente do escritório interno` → `Roteador Resposta`
3. **Saída "Telegram"** do Roteador → conecta no **"Responder Telegram"** existente
4. **Saída "Web"** do Roteador → vamos criar um nó novo abaixo

### C) Adicionar nó Respond to Webhook

1. Add Node → busca **"Respond to Webhook"** → seleciona
2. Configurações:
   - **Respond With:** `JSON`
   - **Response Body** (Expression):
     ```json
     {"reply": "{{ $json.output }}"}
     ```
   - **Response Code:** `200`
3. **Renomeia** pra **"Responder Web"**
4. Conecta saída "Web" do Roteador → "Responder Web"

---

## Etapa 2.5 — Reduzir Memory Window (10 → 5)

**Onde:** Nó **"Postgres Chat Memory"**, posição [-416, 432]. Caixa rosa.

1. Duplo clique
2. Campo **"Context Window Length"**: muda de `10` pra `5`
3. **Save**

> Reduz ~12% do custo de cada chamada. Pra chat curto estilo WhatsApp, 5 msgs é suficiente.

---

## Etapa 2.6 — Confirmar Gemini 2.0 Flash

**Onde:** Nó **"Google Gemini Chat Model"**, posição [-560, 432].

1. Duplo clique
2. Campo **"Model"** — confirma que está em uma dessas:
   - `models/gemini-2.0-flash-exp` (recomendado, mais barato)
   - `models/gemini-2.0-flash`
3. **NÃO usar:**
   - `gemini-1.5-pro` ou `gemini-2.5-pro` → 16x mais caro
   - `gemini-2.5-flash` → 4x mais caro que o 2.0 Flash
4. Se estiver em outro, troca pra `gemini-2.0-flash-exp`
5. **Save**

---

## Etapa 2.7 — Ativar o workflow

1. **Topo do canvas** → toggle **"Inactive"** → vira **"Active"** (verde)
2. **Save** (Ctrl+S)

---

## Etapa 2.8 — Configurar URL do webhook no Vercel

1. Encontra o nó **"Receber Mensagem Web"** que você adicionou
2. Duplo clique → copia **"Production URL"** (formato `https://n8n.singulare.org/webhook/singulare-internal-chat`)
3. **Vercel** → projeto vivassit → Settings → Environment Variables:
   - Key: `N8N_INTERNAL_AGENT_URL`
   - Value: a URL copiada
   - ✅ Production · ✅ Preview · ✅ Development → Save
4. **Vercel → Deployments → último → ⋯ → Redeploy** (sem cache)

✅ **Workflow 2 pronto.** O chat-drawer da bolha 💬 no `/painel` agora responde de verdade.

---

# 🧪 Como testar

## Teste 1 — Onboarding novo
1. Vá em `https://app.singulare.org/landing` (em modo anônimo, ou sai do login)
2. **Começar grátis** → preenche o wizard de 5 steps até o final
3. Após criar, abre Supabase → tabela `tenants` → vê o tenant recém-criado:
   - `calendar_id` ✓ preenchido
   - `evolution_phone_number` ✓ preenchido
   - `telegram_bot_link` ✓ preenchido
   - `evolution_status` = `connected` (ou `created`)

## Teste 2 — Chat web
1. Loga no `/painel`
2. Bolha 💬 inferior direita
3. Digita "Olá"
4. **Esperado:** resposta do agente IA em segundos
5. **Se cair em "modo manutenção":** env `N8N_INTERNAL_AGENT_URL` faltando ou workflow inativo

## Teste 3 — Telegram (continua funcionando)
1. Acessa o link `t.me/SingulareBot?start=singulare`
2. Manda mensagem
3. Recebe resposta normal — fluxo Telegram não foi quebrado

## Teste 4 — Dashboard admin
1. `https://app.singulare.org/admin`
2. Vê: total de mensagens, custo estimado, tabela por tenant

---

# 🆘 Se algo der errado

| Erro | Causa | Fix |
|---|---|---|
| `/painel/agenda` mostra "Service Account não configurado" | env `GOOGLE_SERVICE_ACCOUNT_JSON` faltando ou redeploy não foi feito | Vercel → check env → Redeploy sem cache |
| Chat IA mostra "modo manutenção" | env `N8N_INTERNAL_AGENT_URL` faltando ou workflow inativo | Vercel → check env. N8N → workflow Active. Redeploy. |
| Onboarding novo cria tenant mas calendar/telegram nulos | Workflow N8N inativo OU env `N8N_WEBHOOK_URL` faltando no Vercel | Verifica os 2 + redeploy |
| Switch do Workflow 2 não roteia certo | Expression do Switch errada | Volta no Switch → confere se condições leem `$('Info').item.json.source` |

---

# 📋 Resumo das envs do Vercel

| Env | Onde vem | Quando precisa |
|---|---|---|
| `N8N_WEBHOOK_URL` | URL do webhook do Workflow 1 | Onboarding novo funcionar |
| `N8N_INTERNAL_AGENT_URL` | URL do webhook que você criou no Workflow 2 | Chat IA do painel responder |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON key do Service Account `atendimento-singulare` | Agenda Google funcionar |
| `ASAAS_API_KEY` (futuro) | Chave produção Asaas | Cobrar de verdade |

Após qualquer mudança de env: **Vercel → Redeploy SEM cache.**
