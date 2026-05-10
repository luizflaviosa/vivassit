# SES → Supabase Auth — Integração End-to-End

Passo a passo sequencial. Cada etapa tem **critério de sucesso** antes de seguir.
Se algo falhar, **pare e diagnostique** antes de prosseguir — a próxima etapa depende da anterior estar 100%.

---

## FASE 1 — Confirmar domínio SES Verified

### Passo 1.1: Conferir status no console SES

1. Console AWS → busca **"SES"** → entra em **Amazon Simple Email Service**
2. Confirma região no canto superior direito = **US East (N. Virginia) / us-east-1**
3. Menu lateral → **Verified identities**
4. Clica em `singulare.org`

**Critério de sucesso:**
- ✅ **Identity status: Verified** (verde)
- ✅ **DKIM configuration: Successful**
- ✅ **Custom MAIL FROM domain: Successful** (contato.singulare.org)

❌ **Se ainda Pending:** roda no terminal e cola pra mim:
```bash
dig +short CNAME hh2sydacseai4m7g3jmv5ytjzpsxjbzu._domainkey.singulare.org @8.8.8.8
dig +short MX contato.singulare.org @8.8.8.8
```
Se ambos retornam valor, é só esperar SES verificar (até 72h, geralmente <1h). Sem ação.

---

## FASE 2 — Sair do sandbox (production access)

Sem isso, SES só envia para emails que você verificou explicitamente. Para usar com Supabase Auth (qualquer email), tem que sair do sandbox.

### Passo 2.1: Adicionar email pessoal como verified identity (workaround temporário)

Enquanto o pedido de production access não é aprovado, você precisa de pelo menos 1 email verificado para testar:

1. SES → **Verified identities** → **Create identity**
2. Escolhe **Email address**
3. Email: `luizflaviosa@yahoo.com.br`
4. **Create identity**
5. Abre Yahoo, clica no link de confirmação que chegou

**Critério de sucesso:** `luizflaviosa@yahoo.com.br` aparece na lista com status **Verified**.

### Passo 2.2: Submeter form de production access

1. SES → menu lateral → **Account dashboard**
2. Banner amarelo no topo: **"Your Amazon SES account is in the sandbox"**
3. Clica **Request production access**
4. Preenche:

| Campo | Valor |
|---|---|
| Mail type | **Transactional** |
| Website URL | `https://singulare.org` |
| Use case description | (cola o bloco abaixo) |
| Additional contacts | `luizflaviosa@yahoo.com.br` |
| Preferred contact language | English |

**Use case description (cola tal qual):**
```
Singulare is a healthcare SaaS for clinic management (appointment scheduling, patient records, professional onboarding) operating in Brazil. We use Amazon SES exclusively for transactional authentication emails sent through Supabase Auth, including:

- Account signup confirmation (double opt-in)
- Magic link / one-time password for login
- Password reset requests
- Email change confirmation

All recipients are clinic owners and healthcare professionals who explicitly created an account on our platform and consented to receive these emails as part of the authentication flow. We do not send marketing, promotional, or bulk content through SES.

Expected volume: under 2,000 emails per month initially, scaling with user growth.

Bounce and complaint handling: Supabase Auth automatically suppresses invalid addresses, and we monitor SES reputation metrics (bounce rate, complaint rate) via the SES console. Users can delete their account at any time, which removes them from all email flows.

Unsubscribe: Not applicable for transactional auth emails (required for account access), but the user can self-delete the account from the app settings to stop receiving them.
```

5. Aceita os termos → **Submit**

**Critério de sucesso:** banner muda pra "Production access request pending review". AWS responde em **2-24h** por email pra `luizflaviosa@yahoo.com.br`.

---

## FASE 3 — Criar credenciais SMTP

### Passo 3.1: Gerar SMTP user

1. SES → menu lateral → **SMTP settings**
2. Anota o **SMTP endpoint**: `email-smtp.us-east-1.amazonaws.com`
3. Anota a **Port**: `587` (STARTTLS) ou `465` (TLS) — vamos usar **587**
4. Botão **Create SMTP credentials**
5. Username IAM (sugestão): `ses-smtp-supabase-singulare`
6. **Create user**

### Passo 3.2: Salvar credenciais

A tela mostra **uma única vez**:
- SMTP Username (algo como `AKIAxxxxxxxxxxxx`)
- SMTP Password (longa, base64)

**Faz nesta ordem (importante):**

1. Clica **Download .csv credentials** → salva o CSV
2. Abre o CSV, copia username e password
3. Salva em local seguro (1Password, gestor de senhas, ou arquivo `.env.local` que NÃO entra no git)
4. **Nunca** commita esses valores

❌ **Se fechar a tela sem baixar:** as credenciais somem. Volta no IAM, deleta o user `ses-smtp-supabase-singulare`, e refaz do passo 3.1.

**Critério de sucesso:** CSV salvo + credenciais em local seguro.

---

## FASE 4 — Configurar Supabase Auth SMTP

### Passo 4.1: Abrir SMTP Settings

1. https://supabase.com/dashboard/project/qwyxacfgoqlskidwzdxe/auth/templates
2. Aba **SMTP Settings** (topo da página)
3. Toggle **Enable Custom SMTP** → **ON**

### Passo 4.2: Preencher campos

| Campo Supabase | Valor |
|---|---|
| **Sender email** | `oi@singulare.org` |
| **Sender name** | `Singulare` |
| **Host** | `email-smtp.us-east-1.amazonaws.com` |
| **Port** | `587` |
| **Username** | (SMTP username do CSV — começa com `AKIA...`) |
| **Password** | (SMTP password do CSV) |
| **Minimum interval between emails** | `1` (segundos) |

⚠️ **NÃO** marca "Secure connection" se for porta 587. Marca SE for 465.

### Passo 4.3: Save

Clica **Save** no rodapé.

**Critério de sucesso:** mensagem verde "SMTP settings saved" sem erro.

❌ **Erro comum: "Could not connect to SMTP server"** → username ou password errado, ou porta/secure incompatíveis. Recopia do CSV.

❌ **Erro: "Sender email is not verified"** → significa que `oi@singulare.org` precisa estar dentro do domínio verificado. Como `singulare.org` está Verified no SES, qualquer email `*@singulare.org` funciona. Se der esse erro, confere Fase 1.

---

## FASE 5 — Aumentar rate limit do Supabase Auth

Default Supabase é 4 emails/hora — quebra qualquer fluxo real.

### Passo 5.1: Auth Rate Limits

1. https://supabase.com/dashboard/project/qwyxacfgoqlskidwzdxe/auth/rate-limits
2. Encontra **Email** (rate limit por hora)
3. Muda de `4` → `30`
4. **Save**

**Critério de sucesso:** valor `30` salvo.

---

## FASE 6 — Teste end-to-end (em sandbox, antes da aprovação)

### Passo 6.1: Enviar magic link pra email verificado

1. Supabase Dashboard → **Authentication** → **Users**
2. Botão **Add user** (canto superior direito) → **Send invitation**
3. Email: `luizflaviosa@yahoo.com.br` (o que você verificou no passo 2.1)
4. **Send invitation**

### Passo 6.2: Conferir entrega

Em <30 segundos, abre Yahoo:

**Critério de sucesso:**
- ✅ Email chegou na inbox (não no spam)
- ✅ Sender = `Singulare <oi@singulare.org>`
- ✅ Conteúdo é o template Supabase com link mágico
- ✅ Header `Authentication-Results` mostra `dkim=pass header.d=singulare.org` e `spf=pass`

❌ **Se foi pro spam:** ainda funciona, mas é sinal de reputação ruim no início. Marca "Não é spam" e move pra inbox. Após algumas semanas o Yahoo aprende.

❌ **Se não chegou em 5 min:**
1. Supabase → **Logs** → **Auth Logs** — procura por erro de SMTP
2. SES → **Sending Statistics** — vê se contou um Send
3. Se SES contou Send mas Yahoo não recebeu → está rejeitando (raríssimo com DKIM/SPF/DMARC ok)

❌ **Erro `MessageRejected: Email address is not verified`:**
Tá tentando enviar pra email não verificado, e ainda está em sandbox. Confirma que o destinatário é exatamente `luizflaviosa@yahoo.com.br` (o que você verificou).

---

## FASE 7 — Pós aprovação production access

Quando AWS responder (geralmente "Your account has been moved out of the sandbox"):

### Passo 7.1: Verificar saída do sandbox

1. SES → **Account dashboard**
2. Banner amarelo desapareceu
3. Sending quota: **50,000+ emails/24h** (limite inicial pós-saída)

### Passo 7.2: Teste com email externo

1. Supabase → **Users** → **Send invitation** pra um email **NÃO verificado** (qualquer Gmail de teste, ex: um amigo)
2. Email deve chegar

**Critério de sucesso:** entrega para email arbitrário funciona.

### Passo 7.3: Limpar identities desnecessárias

1. SES → **Verified identities**
2. Pode **deletar** o `luizflaviosa@yahoo.com.br` (era só pra teste em sandbox)
3. **Mantém** `singulare.org` (essa é a sua identidade de produção)

---

## FASE 8 — Templates de email customizados (opcional, recomendado)

Os templates default do Supabase são genéricos ("You requested to confirm your email...").

### Passo 8.1: Customizar

1. https://supabase.com/dashboard/project/qwyxacfgoqlskidwzdxe/auth/templates
2. Para cada template (Confirm signup, Magic Link, Reset Password, Change Email), customiza HTML mantendo as variáveis `{{ .ConfirmationURL }}`, `{{ .Token }}`, etc.

Exemplo Magic Link em português:

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#0f172a">
  <h1 style="font-size:22px;margin:0 0 16px">Entrar na Singulare</h1>
  <p>Clique no botão abaixo para acessar seu painel:</p>
  <p style="margin:24px 0">
    <a href="{{ .ConfirmationURL }}" style="background:#6E56CF;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Entrar agora</a>
  </p>
  <p style="font-size:13px;color:#64748b">Ou copia o código: <strong>{{ .Token }}</strong></p>
  <p style="font-size:13px;color:#64748b;margin-top:32px">Se você não solicitou este email, ignore.</p>
</div>
```

### Passo 8.2: Save + testar

Save → reenviar magic link pra você → confere visual.

---

## Checklist final (verifica tudo no fim)

- [ ] FASE 1: SES `singulare.org` Verified, DKIM Successful, MAIL FROM Successful
- [ ] FASE 2: Production access submitted (banner pending)
- [ ] FASE 3: SMTP credentials criadas e guardadas em 1Password/local seguro
- [ ] FASE 4: Supabase Custom SMTP enabled e saved sem erro
- [ ] FASE 5: Rate limit Supabase = 30/h
- [ ] FASE 6: Magic link recebido em `luizflaviosa@yahoo.com.br` com DKIM=pass
- [ ] FASE 7: Após aprovação, teste com email externo entregue
- [ ] FASE 8: Templates em português customizados

---

## Tabela de troubleshooting rápido

| Sintoma | Causa provável | Fix |
|---|---|---|
| `Email address is not verified` | Sender `*@singulare.org` mas domínio Pending | Volta Fase 1 |
| `Could not connect to SMTP server` | Credencial errada ou porta/secure mismatched | Recopia CSV; porta 587 = sem secure; 465 = com secure |
| Email vai pro spam | Reputação inicial baixa | Normal; melhora em 2-4 semanas; marca "não é spam" |
| `MessageRejected: ... is not verified` | Sandbox + destinatário não verificado | Ou aguarda production access, ou verifica o email manualmente |
| Limite de 4 emails/hora | Rate limit Supabase default | Fase 5 — sobe pra 30 |
| `Authentication-Results: dkim=fail` | DNS não propagou ainda ou registro errado | `dig` os 3 CNAMEs; reverifica MAIL FROM |
| AWS aprovação demora >48h | Caso edge | Abre support ticket "Production access request follow-up" |
