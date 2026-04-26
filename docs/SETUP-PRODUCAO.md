# Setup de Produção — 4 Configurações Externas

Tudo que precisa ser feito **fora do código** pra Singulare ficar 100% live.
Faça na ordem (~30min total).

---

## 0. Service Account Google (pra agenda nova) — 5min

A agenda do painel agora usa um Service Account compartilhado, não o login do usuário.

### Passo a passo

1. Abre **https://console.cloud.google.com/iam-admin/serviceaccounts**
2. Selecione um projeto (ou cria um novo: "Singulare Production")
3. **+ CREATE SERVICE ACCOUNT**
   - Service account name: `singulare-calendar`
   - ID: `singulare-calendar` (auto-preenche)
   - Description: `Lê eventos do Google Calendar dos profissionais cadastrados`
   - **CREATE AND CONTINUE**
4. **Grant access** → escolha role `Service Account User` → **CONTINUE** → **DONE**
5. Na lista, clique no service account criado → aba **KEYS** → **ADD KEY** → **Create new key** → **JSON** → **CREATE**
   → Baixa um arquivo `.json` (ex: `singulare-calendar-xxxx.json`)
6. **Habilitar Google Calendar API**:
   - Abre **https://console.cloud.google.com/apis/library/calendar-json.googleapis.com**
   - Click **ENABLE**
7. **Adicionar como env no Vercel:**
   - Vercel → seu projeto → Settings → Environment Variables
   - Name: `GOOGLE_SERVICE_ACCOUNT_JSON`
   - Value: cole o **conteúdo INTEIRO do arquivo .json** (uma linha só, ou multiline OK)
   - Environment: ✅ Production ✅ Preview ✅ Development
   - **Save**
8. **Redeploy** (Vercel detecta mudança de env e oferece redeploy)

### Compartilhar calendar de cada profissional

Pra cada profissional cadastrado em `tenant_doctors` (que tem `calendar_id`):

1. Esse profissional abre **Google Calendar** (calendar.google.com)
2. Settings (⚙️) → escolhe o calendar dele à esquerda → **Settings and sharing**
3. Seção **Share with specific people or groups** → **+ Add people**
4. Cola o email do service account: `singulare-calendar@<seu-projeto>.iam.gserviceaccount.com`
5. Permission: **See all event details**
6. **Send** (não envia email pq é service account, mas registra a permissão)

A partir daí o painel `/painel/agenda` lê os eventos automaticamente. **Sem login Google.**

---

## 1. Asaas KYC + Marketplace API em produção — 15min

Pra cobrar de paciente real (não mais sandbox). Asaas é a infra de pagamentos do Singulare (PIX, Boleto, Cartão).

### A) Conta Asaas em modo produção

1. Acessa **https://www.asaas.com**
2. Cria conta empresarial (PJ/MEI/PF — depende do seu modelo)
3. Faz **KYC**:
   - Documento (CNH, RG ou CNPJ)
   - Selfie com documento (se PF) ou CCMEI (se MEI)
   - Comprovante de endereço (≤90 dias)
   - Conta bancária pra receber repasses
4. Aguarda aprovação (~24h em dias úteis)

### B) Habilitar API + Marketplace

1. Logado no painel Asaas → **Integrações** → **API**
2. Clica em **Gerar nova chave** (modo PRODUÇÃO, não sandbox)
3. **COPIA a chave** (formato `$aact_prod_...` — só aparece 1x)
4. Vai em **Integrações** → **Conta Marketplace** (ou solicita habilitação se não aparecer)
   - Marketplace permite criar **subcontas** pra cada clínica receber direto
   - Sem isso, todo dinheiro entra na sua conta master e você precisa repassar manual

### C) Configurar no Vercel

Adicione **3 envs** no Vercel:

| Nome | Valor |
|---|---|
| `ASAAS_BASE_URL` | `https://api.asaas.com/v3` (produção) |
| `ASAAS_API_KEY` | `$aact_prod_...` (a chave gerada) |
| `ASAAS_WEBHOOK_TOKEN` | `<gere uma string random de 32 chars>` (qualquer) |

Em **Asaas painel** → **Integrações** → **Webhook**:
- URL: `https://app.singulare.org/api/webhooks/asaas`
- Token: o mesmo `ASAAS_WEBHOOK_TOKEN`
- Events: ✅ Payment created, ✅ Payment confirmed, ✅ Payment overdue

### D) Validar

1. Redeploy no Vercel
2. Acesse `/painel/pagamentos/ativar` → preencha dados PJ/PF + endereço + conta bancária
3. Sistema cria subaccount em Asaas via marketplace API (`POST /accounts`)
4. Teste cobrança real: `/painel/cobrancas` → criar cobrança de R$ 1,00

### Troubleshooting
- **"401 Unauthorized"**: chave em sandbox, não produção. Gere de novo no painel produção.
- **"Marketplace não habilitado"**: contate suporte Asaas pra liberar (pode levar 24h)
- **Webhook não chega**: confira se `ASAAS_WEBHOOK_TOKEN` bate em ambos os lados.

---

## 2. N8N Webhook — Chat IA Interno — 10min

Pra a bolha de chat no painel responder. Hoje cai em fallback "modo manutenção".

### A) Adicionar Webhook trigger no workflow "6. Assistente Interno"

1. Abre seu n8n (provavelmente `https://n8n.suaempresa.com` ou self-hosted)
2. Workflow **"6. Assistente Interno"**
3. Adiciona **novo nó Webhook** no início (paralelo ao Telegram trigger):
   - Method: **POST**
   - Path: `vivassit-internal-chat` (ou o que preferir)
   - Authentication: **None** (ou Header Auth com `X-Vivassit-Token` matching env)
   - Response: **Last Node** (pra responder no mesmo request)
4. **Conecta esse Webhook ao mesmo nó** que o Telegram trigger conecta (provavelmente o "Master Agent" ou "Switch by chat_id")
5. **Active workflow** (toggle no topo)
6. Copia a **Production URL** do webhook (formato: `https://n8n.suaempresa.com/webhook/vivassit-internal-chat`)

### B) Adaptar parser do payload

O webhook vai receber:
```json
{
  "source": "web",
  "tenant_id": "clinica-voda-c6e7d50f",
  "clinic_name": "Clínica Voda",
  "user_email": "luiz@gmail.com",
  "user_id": "uuid",
  "doctor_id": null,
  "message": "Minha agenda hoje",
  "history": [{ "role": "user", "text": "..." }],
  "timestamp": "2026-04-26T..."
}
```

No nó **Switch** (ou Code node de roteamento), adiciona caso `source === 'web'`:
- Pula a parte de "extrair tenant do chat_id Telegram"
- Usa diretamente `tenant_id` e `user_email` do payload
- Manda pra mesma sequência (Master Agent → Tools → Response)

### C) Resposta do agente

O nó final do workflow deve responder via **Respond to Webhook**:
- Status: 200
- Body: `{ "reply": "{{ $node['Master Agent'].json.output }}" }`
- ou qualquer formato — o endpoint Edge aceita várias chaves (`reply`, `output`, `message`, `text`, `response`)

### D) Configurar env no Vercel

| Nome | Valor |
|---|---|
| `N8N_INTERNAL_AGENT_URL` | URL completo do webhook (passo A.6) |

### E) Validar

1. Redeploy no Vercel
2. Acesse `/painel`
3. Clique na bolha 💬 no canto inferior direito
4. Digite "Olá" → deve receber resposta da IA em segundos

### Troubleshooting
- **Cai em fallback "modo manutenção"**: env `N8N_INTERNAL_AGENT_URL` não tá set no Vercel
- **Resposta vazia**: workflow N8N não tá retornando JSON ou tá retornando outro formato. Cheque o "Respond to Webhook"
- **Latência alta (>3s)**: workflow tem nó pesado (LLM lento, vector search). Otimize ou aceite

---

## 3. SMTP Resend — Email Transacional — 5min

Pra parar de depender do SMTP nativo do Supabase (rate limit 3-4 emails/hora).

### A) Conta Resend

1. **https://resend.com** → Sign up
2. Free tier: 3.000 emails/mês, 100/dia (suficiente)
3. **Domains** → **Add Domain** → `singulare.org`
4. Resend mostra registros DNS (TXT, CNAME, MX)
5. Cole no seu DNS (AWS Lightsail, no seu caso):
   - SPF: TXT `v=spf1 include:_spf.resend.com ~all`
   - DKIM: 1 CNAME apontando pra resend
   - DMARC opcional mas recomendado
6. Aguarda verificação (~10min, status muda pra "Verified")

### B) API key

1. Resend → **API Keys** → **Create API Key**
2. Name: `supabase-smtp`
3. Permission: **Sending access**
4. Domain: `singulare.org`
5. Copia a key (formato `re_...`)

### C) Configurar SMTP no Supabase

1. Supabase → seu projeto → **Authentication** → **Settings** → **SMTP Settings**
2. Toggle **"Enable Custom SMTP"** ON
3. Preencha:
   - **Sender email**: `oi@singulare.org` (ou `noreply@singulare.org`)
   - **Sender name**: `Singulare`
   - **Host**: `smtp.resend.com`
   - **Port**: `587` (ou `465` SSL)
   - **Username**: `resend`
   - **Password**: a API key do Resend (`re_...`)
4. **Save**

### D) Aumentar rate limit no Supabase

Mesmo painel **Authentication** → **Rate Limits**:
- Email rate limit: aumenta de 4/h pra **30/h** ou mais
- Pode ir até 1000/h sem problema (Resend aguenta)

### E) Testar

1. Logout do painel
2. Tenta login com magic link
3. Email deve chegar em <30s, vindo de `oi@singulare.org`
4. Acesse Resend dashboard → **Emails** → vê o email enviado, com tracking

### Troubleshooting
- **DNS não verifica**: aguarde até 24h. AWS Route53/Lightsail propagam rápido (~5min).
- **Email cai no spam**: configure DMARC + warm-up (envia poucos emails iniciais)
- **"535 Authentication failed"**: API key errada, ou está usando email do sender em vez de `resend` no Username

---

## Checklist Final

Quando os 4 setups acima estiverem prontos:

- [ ] **Service Account Google** configurado + calendars compartilhados → `/painel/agenda` mostra eventos sem pedir Google
- [ ] **Asaas produção** com KYC aprovado + Marketplace API + webhook → `/painel/pagamentos/ativar` cria subconta real
- [ ] **N8N Webhook** ativo + env `N8N_INTERNAL_AGENT_URL` → bolha de chat IA responde no `/painel`
- [ ] **Resend SMTP** + DNS verified + Supabase configurado → magic link e password reset chegam sem rate limit

Depois disso, Singulare está 100% pronta pra clientes pagantes.
