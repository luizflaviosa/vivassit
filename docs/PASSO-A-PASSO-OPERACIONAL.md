# Passo-a-Passo — Singulare Full Operativo

Total: ~35min ativo + 24h de espera (Asaas KYC).

---

## 1️⃣ Mergear branch `feat/evolutions-2` → `main` _(2min)_

**O que faz:** ativa em produção todos os fixes recentes (editores completos, modal corrigido, logos padronizados, fix duplo-clique, onboarding reorganizado, "Configurar depois", working hours editor).

```bash
cd ~/Desktop/vivassit
git status                     # confere que não tem mudança não-commit
git checkout main
git pull origin main           # sincroniza
git merge feat/evolutions-2
git push origin main
```

✅ **Conferir:**
1. Abre **https://vercel.com/dashboard** → projeto vivassit → aba **Deployments**
2. Vê deploy novo "Building..." aparecer em ~30s
3. Aguarda ~2min até virar "Ready"

---

## 2️⃣ Criar JSON Key do Service Account Google _(5min)_

**O que faz:** gera credencial pra o app autenticar como o SA `atendimento-singulare` e ler agendas.

### A) Baixar a key
1. Abre: **https://console.cloud.google.com/iam-admin/serviceaccounts?project=grand-quarter-462319-i7**
2. Clique no **email** `atendimento-singulare@grand-quarter-462319-i7.iam.gserviceaccount.com`
3. Aba superior: **DETAILS · PERMISSIONS · KEYS · METRICS · LOGS** → clica em **KEYS**
4. Botão **ADD KEY** → **Create new key**
5. Modal: marca **JSON** → **CREATE**
6. **Download automático** de um arquivo `grand-quarter-462319-i7-XXXXX.json`

> ⚠️ Esse arquivo é segredo. **Nunca commita no git.**

### B) Adicionar como env no Vercel
1. Abre: **https://vercel.com/dashboard** → projeto **vivassit** → **Settings** (top) → **Environment Variables** (lateral)
2. Botão **+ Add New**
3. Campos:
   - **Key:** `GOOGLE_SERVICE_ACCOUNT_JSON`
   - **Value:** abre o `.json` baixado em qualquer editor (Notepad, VS Code, TextEdit), `Ctrl+A` (ou `Cmd+A`), copia, cola no campo. Vercel aceita multiline.
   - **Environments:** ✅ Production ✅ Preview ✅ Development
4. **Save**

### C) Forçar Redeploy
1. Vercel → **Deployments** → último deploy → 3 pontinhos `⋯` → **Redeploy**
2. Modal: **desmarca** "Use existing build cache" → **Redeploy**
3. Aguarda ~2min

✅ **Conferir:** abre `https://app.singulare.org/painel/agenda` e troca pra Clínica Singulare no switcher → **não deve** mais mostrar "Service Account não configurado".

---

## 3️⃣ Habilitar Calendar API no projeto _(30s)_

**O que faz:** libera o Google a aceitar chamadas pro Calendar API.

1. Cola no navegador (URL já vem com projeto certo):
   ```
   https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=grand-quarter-462319-i7
   ```
2. Topo da tela deve mostrar projeto **n8n-singulare**
3. Se vir botão azul **ENABLE** → clica
4. Se já mostrar "API Enabled" → ✅ pronto

> Provavelmente já tá enabled porque o N8N usa.

---

## 4️⃣ Compartilhar calendar com o Service Account _(1min)_

**O que faz:** dá permissão pro SA ler o calendar da Dra. Paula (e qualquer outro profissional cadastrado).

### Como o N8N já cria/cancela eventos no calendar dela hoje, ele provavelmente JÁ COMPARTILHOU com o mesmo SA. Mas vale conferir:

1. **Você ou a Dra. Paula** abre **https://calendar.google.com**
2. Painel esquerdo, seção **Meus calendários** → encontra o calendar da Dra. Paula
3. Hover no nome → 3 pontinhos `⋯` → **Configurações e compartilhamento** (Settings and sharing)
4. Rola até **Compartilhar com pessoas e grupos específicos**
5. Confere se já tem o email:
   ```
   atendimento-singulare@grand-quarter-462319-i7.iam.gserviceaccount.com
   ```
6. Se SIM com permissão "Ver todos os detalhes do evento" → ✅ pronto
7. Se NÃO → **+ Adicionar pessoas e grupos** → cola o email → permissão **Ver todos os detalhes do evento** → **Enviar**

> Não envia email pro SA (não é uma pessoa). Permissão é registrada na hora.

✅ **Conferir:** abre `https://app.singulare.org/painel/agenda` → vê eventos da Dra. Paula listados.

---

## 5️⃣ N8N Webhook + env do Vercel _(10min)_

**O que faz:** permite a bolha de chat IA do `/painel` responder via N8N (hoje cai em "modo manutenção").

### A) Adicionar Webhook trigger no workflow
1. Abre seu N8N → workflow **"6. Assistente Interno"**
2. Adiciona um novo nó **Webhook** (paralelo ao trigger do Telegram):
   - **Authentication:** None (ou Header Auth se quiser)
   - **HTTP Method:** POST
   - **Path:** `singulare-internal-chat`
   - **Response:** `Last Node` (responde no mesmo request)
3. **Conecta** esse Webhook ao mesmo nó que o Telegram trigger conecta (geralmente "Master Agent" ou um Switch/Code de roteamento)

### B) Adaptar parser pra `source === 'web'`
O webhook vai receber:
```json
{
  "source": "web",
  "tenant_id": "singulare",
  "clinic_name": "Clínica Singulare",
  "user_email": "luizflaviosa.lfx@gmail.com",
  "user_id": "uuid",
  "message": "Olá",
  "history": [{ "role": "user", "text": "..." }],
  "timestamp": "..."
}
```

No nó de roteamento (Switch ou Code) que decide tenant/identidade, adicione branch:
- Se `source === 'web'`: usa `tenant_id` e `user_email` direto do payload (não precisa lookup por chat_id Telegram)
- Senão: fluxo Telegram normal

### C) Resposta
O nó final responde via **Respond to Webhook**:
- Status: 200
- Body: `{ "reply": "{{ $node['Master Agent'].json.output }}" }`
- Outros formatos aceitos: `output`, `message`, `text`, `response`

### D) Active workflow + copia URL
1. Toggle **Active** no topo do workflow
2. Copia a **Production URL** do Webhook (formato: `https://seu-n8n.com/webhook/singulare-internal-chat`)

### E) Vercel env
1. Vercel → projeto vivassit → Settings → Environment Variables
2. **+ Add New:**
   - **Key:** `N8N_INTERNAL_AGENT_URL`
   - **Value:** a URL completa do passo D
   - ✅ Production ✅ Preview ✅ Development → Save
3. **Redeploy** (Deployments → último → Redeploy sem cache)

✅ **Conferir:** abre `https://app.singulare.org/painel` → bolha 💬 inferior direita → digita "Olá" → recebe resposta da IA em segundos.

### F) Bonus — habilitar MCP no workflow
No mesmo workflow "6. Assistente Interno":
- Settings (engrenagem do workflow) → **MCP availability** → toggle ON
- Salva

Isso me permite, em sessões futuras, ver e modificar o workflow direto via MCP.

---

## 6️⃣ Resend SMTP (resolver rate limit do Supabase) _(10min ativo + ~10min DNS)_

**O que faz:** elimina o limite de 3-4 emails/hora do SMTP nativo do Supabase. Magic links e password resets vão chegar sempre.

### A) Conta Resend
1. **https://resend.com** → Sign up
2. Free tier: 3.000 emails/mês, 100/dia (mais que suficiente)

### B) Adicionar domínio
1. Resend → **Domains** → **+ Add Domain**
2. Domain name: `singulare.org`
3. Resend mostra **3-4 registros DNS** (1 TXT pra SPF, 2 CNAMEs pra DKIM, 1 TXT pra DMARC opcional)

### C) Cole no DNS (AWS Lightsail/Route53)
1. AWS Console → Route53 (ou Lightsail Networking → DNS Zone do `singulare.org`)
2. Cria os registros que o Resend mostrou:
   - **SPF (TXT)**: nome `@` ou `singulare.org` · valor `v=spf1 include:_spf.resend.com ~all`
   - **DKIM (CNAME)**: nome e valor do que o Resend deu (geralmente `resend._domainkey.singulare.org`)
   - **DMARC (TXT, opcional)**: nome `_dmarc` · valor `v=DMARC1; p=none; rua=mailto:dmarc@singulare.org`
3. Salva
4. Volta no Resend → aguarda **status virar "Verified"** (~5-15min)

### D) API key do Resend
1. Resend → **API Keys** → **Create API Key**
2. Name: `supabase-smtp`
3. Permission: **Sending access**
4. Domain: `singulare.org`
5. **Copia a key** (formato `re_xxxxxxxxxxxxx`) — só aparece 1x

### E) Configurar SMTP no Supabase
1. **https://supabase.com/dashboard/project/qwyxacfgoqlskidwzdxe/auth/templates** → aba **SMTP Settings** (ou Authentication → Settings → SMTP)
2. Toggle **Enable Custom SMTP** ON
3. Preenche:
   - **Sender email:** `oi@singulare.org` (ou `noreply@singulare.org`)
   - **Sender name:** `Singulare`
   - **Host:** `smtp.resend.com`
   - **Port:** `587`
   - **Username:** `resend`
   - **Password:** a API key do passo D
4. **Save**

### F) Aumentar rate limit
1. Mesma página, role pra **Rate Limits** (ou Auth → Rate Limits)
2. **Email rate limit:** mude de `4` pra `30` (ou mais alto se quiser)
3. **Save**

✅ **Conferir:**
1. Logout do painel
2. Tenta login com magic link no `/login`
3. Email chega em <30s, vindo de `oi@singulare.org`
4. Resend dashboard → Emails → vê o envio com tracking

---

## 7️⃣ Asaas KYC + ativação Marketplace _(7min preencher + ~24h aprovar)_

**O que faz:** habilita cobranças reais (PIX, boleto, cartão) em produção.

### A) Criar conta produção
1. **https://www.asaas.com** → cria conta empresa (PJ/MEI/PF)
2. Use o **CNPJ da Singulare** (se tiver) — facilita aprovação Marketplace

### B) Submeter KYC
1. Logado → completar perfil
2. Documentos pedidos (varia conforme tipo):
   - Documento de identificação (CNH, RG, ou cartão CNPJ)
   - Selfie segurando documento (se PF)
   - Comprovante de endereço (≤90 dias) — conta de luz, internet
   - **Conta bancária** pra receber repasses (banco, agência, conta)
3. Submete → Asaas analisa em **~24h em dias úteis**

### C) (Enquanto aguarda) Solicitar habilitação Marketplace
1. Painel Asaas → **Integrações** → procura por **"Conta Marketplace"** ou **"Subcontas"**
2. Se aparecer botão habilitar → clica
3. Se não → fala com **suporte Asaas** (chat ou email): "Quero habilitar API de Marketplace pra criar subcontas dos meus clientes"
4. Suporte aprova em ~24h

### D) Após aprovação (volta aqui amanhã)
1. Asaas → **Integrações** → **API**
2. **Gerar nova chave** (modo PRODUÇÃO, não sandbox)
3. **Copia a chave** (formato `$aact_prod_...`) — só aparece 1x
4. Vercel envs:
   ```
   ASAAS_BASE_URL = https://api.asaas.com/v3
   ASAAS_API_KEY = $aact_prod_xxxxx
   ASAAS_WEBHOOK_TOKEN = (gere uma string random 32 chars)
   ```
   Pra gerar a webhook token, no Mac: `openssl rand -hex 16`
5. Vercel → Redeploy

### E) Webhook no Asaas
1. Asaas → **Integrações** → **Webhook**
2. Cria novo:
   - URL: `https://app.singulare.org/api/webhooks/asaas`
   - Token: o mesmo `ASAAS_WEBHOOK_TOKEN` do Vercel
   - Events marcados: ✅ Payment created · ✅ Payment confirmed · ✅ Payment overdue · ✅ Payment refunded

### F) Testar
1. Acessa `https://app.singulare.org/painel/pagamentos/ativar`
2. Preenche dados PJ/PF + endereço + conta bancária
3. Sistema cria subaccount no Asaas via Marketplace API
4. Em `/painel/cobrancas` testa criar cobrança de R$ 1,00

✅ **Conferir:** cobrança de teste vira PIX/boleto válido. Webhook do Asaas aparece nos logs do `/api/webhooks/asaas` quando você paga.

---

## 📋 Checklist consolidado

Imprime/copia isso e marca:

```
[ ] 1. git merge feat/evolutions-2 + push
[ ] 2a. Baixei JSON key do Service Account
[ ] 2b. Adicionei GOOGLE_SERVICE_ACCOUNT_JSON no Vercel + redeploy
[ ] 3. Confirmei que Calendar API está enabled
[ ] 4. Compartilhei calendar Dra. Paula com SA email (ou já estava)
[ ] 5a. Adicionei Webhook trigger no workflow N8N "6. Assistente Interno"
[ ] 5b. Adicionei N8N_INTERNAL_AGENT_URL no Vercel + redeploy
[ ] 5c. Habilitei MCP no workflow (opcional)
[ ] 6a. Resend conta criada + domínio adicionado
[ ] 6b. Registros DNS colados (aguardar verify)
[ ] 6c. API key gerada
[ ] 6d. SMTP configurado no Supabase
[ ] 6e. Rate limit Supabase aumentado pra 30/h
[ ] 7a. Asaas conta criada + KYC submetido
[ ] 7b. Solicitada habilitação Marketplace
[ ] 7c. (após aprovação) Chave produção + envs Vercel
[ ] 7d. Webhook Asaas configurado
```

---

## 🆘 Se algo der errado

**Agenda continua mostrando "Service Account não configurado":**
- Confere env no Vercel (sem aspas extras, JSON inteiro)
- Forçou redeploy SEM cache?
- Ver logs em Vercel → Functions

**Chat IA cai em "modo manutenção":**
- Env `N8N_INTERNAL_AGENT_URL` setada?
- Workflow N8N está Active?
- Webhook URL é a Production (não Test) URL?

**Magic link não chega:**
- DNS do Resend Verified? (pode levar até 24h em alguns provedores)
- Rate limit do Supabase aumentado?
- Pasta de spam?

**Asaas KYC negado:**
- Documento legível? Endereço atualizado? Suporte do Asaas costuma ser bem responsivo no chat.

---

Qualquer travamento, me chama com o erro exato e o passo onde travou.
