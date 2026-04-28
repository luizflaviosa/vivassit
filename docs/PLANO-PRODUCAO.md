# Plano de Produção — Singulare

**Data:** 2026-04-27 · **Status atual:** MVP funcional, sem clientes pagantes

---

## 📊 Estado real (verificado agora)

### O que funciona em produção
- ✅ App `app.singulare.org` no ar (Vercel · health OK · Supabase + Asaas conectados)
- ✅ Login Google OAuth (testado, funciona)
- ✅ Login email + senha (após `/configurar-senha`)
- ✅ Painel completo (visão geral, profissionais editáveis, pacientes drawer, agenda, mensagens, cobranças, NF, NPS, configurações)
- ✅ Multi-tenant switcher (1 admin pode gerir várias clínicas)
- ✅ Dashboard `/admin` (custo LLM por tenant)
- ✅ Onboarding 5 steps com working hours + opção "configurar depois"
- ✅ Cmd+K command palette
- ✅ PWA install (mobile)
- ✅ Workflow N8N "6. Assistente Interno BACKUP" ativo + Web webhook funcionando (você acabou de fazer)
- ✅ 2 tenants ativos (Singulare + Voda), 1 com calendar Google integrado, 1 com Telegram vinculado
- ✅ NPS pós-consulta: workflow n8n cron 19h BRT lê Calendar + Master Secretária trata respostas. Painel `/painel/feedback` já consome `patient_feedback`. Spec: `docs/superpowers/specs/2026-04-28-nps-pos-consulta-design.md` · Smoke: `docs/n8n/nps-smoke-test.md`

### O que está QUEBRADO ou faltando
- 🔴 **Magic link não funciona** (você confirmou) — bloqueia user que não usa Google
- 🔴 **Asaas em sandbox** — 0 contas Asaas criadas, cobranças não acontecem
- 🟡 Workflow `0. On Boarding Vivassit v4.1 BACKUP` ainda não revisado/ativo
- 🟡 Trigger Telegram do "6. Assistente Interno" ainda `disabled`
- 🟡 patients table vazia + appointments quase vazias (N8N não tá inserindo? Ou não rodou ainda em produção real)
- 🟡 SQL cleanup (triggers duplicados, RLS, search_path) ainda não rodado

---

## 🎯 Problem Map: O que separa de "produção em vivo"

### Problema 1 — **Magic link broken (BLOQUEADOR CRÍTICO)**

**Sintoma:** user pede magic link → email não chega OU chega e não loga.

**Causas prováveis (ordem de probabilidade):**
1. **Rate limit do Supabase** (3-4 emails/h no SMTP nativo). Se você testou ≥3x, cota acabou.
2. **Supabase Site URL** mal configurado → magic link aponta pra URL errada
3. **Redirect URLs** sem `https://app.singulare.org/auth/callback`
4. **Sem SMTP customizado (Resend)** — depende do SMTP nativo precário do Supabase

**Diagnóstico em 3 min:**
1. Supabase → Auth → Logs → busca "magic link" recentes → vê se email foi tentado/enviado
2. Se "rate limit exceeded" → causa é #1
3. Se enviado mas você não recebe → checa spam, ou SMTP do Supabase tá unreachable
4. Se chega mas link não loga → URL errada (#2 ou #3)

**Fix definitivo:** **configurar Resend** (15 min, gratuito 3k/mês). Documentado em `docs/SETUP-PRODUCAO.md` passo 6 / `docs/PASSO-A-PASSO-OPERACIONAL.md` passo 6.

---

### Problema 2 — **Cobrança real (Asaas produção)**

**Sintoma:** `/painel/pagamentos/ativar` funciona em sandbox, mas não cobra de verdade.

**Bloqueio:** você ainda não submeteu KYC do Asaas.

**Fix:** documentado em `docs/PASSO-A-PASSO-OPERACIONAL.md` passo 7. ~7 min ativo + 24h de espera de aprovação.

**Sem isso:** sistema funciona como demo, não vende.

---

### Problema 3 — **Onboarding workflow N8N ainda não tá production-ready**

**Status atual:** existe `0. On Boarding Vivassit v4.1 BACKUP` (inativo), com bug do `5749317361` hardcoded.

**Impacto:** novos signups via `/landing` ficam parcialmente provisionados (sem evolution instance, sem Telegram bot, sem calendar próprio).

**Fix:** documentado em `docs/N8N-WALKTHROUGH.md` Workflow 1. ~5 min.

---

### Problema 4 — **Pacientes table vazia · trigger N8N não persiste**

**Achado:** `patients = 0` rows, `appointments = 2` (lixo de teste).

**Causa provável:** workflow N8N de WhatsApp (Master Secretária) NÃO tá inserindo paciente novo no Supabase quando alguém chega no WhatsApp da clínica. Está só salvando no Chatwoot e/ou na memory do Postgres.

**Impacto:** painel "/painel/pacientes" sempre vai mostrar vazio. CRM real não acontece.

**Fix:** revisar workflow `1. Master Secretária BACKUP` (também BACKUP, MCP enabled) e adicionar nó Postgres INSERT em `patients` quando paciente novo chega. Posso fazer essa análise se autorizar.

---

### Problema 5 — **Schema/segurança Supabase pendente**

**Achado:** 19 tabelas sem RLS, triggers duplicados (3x em `tenant_doctors`), 18 funções sem search_path.

**Impacto:**
- **Segurança:** qualquer um com chave anon pode `SELECT * FROM tenants` (vazamento)
- **Performance:** triggers triplicados causam lentidão proporcional

**Fix:** rodar `scripts/supabase-cleanup.sql` bloco a bloco. ~10 min, low-risk.

---

### Problema 6 — **Campos não capturados/auditados**

- Nenhum `usage_tracking_llm` (custo real por tenant é estimativa, não medição)
- Nenhum log estruturado de erros (depende do console.log + Vercel logs)
- Sem alertas (se um tenant abusa do chat, você não sabe)

**Impacto:** baixo agora (poucos tenants), crítico quando passar de 50.

---

### Problema 7 — **Onboarding novo NÃO reaproveita `0. On Boarding Vivassit v4.1 BACKUP`**

**Achado:** o `/api/onboarding/route.ts` chama `process.env.N8N_WEBHOOK_URL` mas você ainda não setou pra apontar pro webhook do BACKUP.

**Impacto:** signups novos pela landing rodam o Next.js (cria tenant), mas N8N **não dispara** → nem evolution, nem Telegram, nem calendar próprio.

**Fix:** Vercel env `N8N_WEBHOOK_URL` = `https://n8n.singulare.org/webhook/2f433624-1d6d-4c11-9e32-a567b9d29c5f` + redeploy.

---

## 🚦 Plano de evolução em 4 ondas

### 🌊 Onda 1 — Destravar fundamentos (HOJE/AMANHÃ, ~1h ativo)

> Sem isso, ninguém pode logar/cobrar.

| # | Tarefa | Tempo | Quem |
|---|---|---|---|
| 1 | Configurar Resend SMTP (resolve magic link) | 15 min ativo + 10 min DNS | Você |
| 2 | Setar `N8N_WEBHOOK_URL` no Vercel + redeploy | 2 min | Você |
| 3 | Habilitar trigger Telegram no "6. Assistente Interno BACKUP" | 30s | Você |
| 4 | Fix chat_id `5749317361` no workflow Onboarding (4 lugares) | 5 min | Você |
| 5 | Ativar workflow `0. On Boarding Vivassit v4.1 BACKUP` | 30s | Você |
| 6 | Submeter KYC Asaas | 7 min ativo + 24h espera | Você |

**Resultado:** signup novo end-to-end funciona, magic link ok, agendas Google sincronizadas, chat IA responde no painel + Telegram.

---

### 🌊 Onda 2 — Confiabilidade + dados reais (esta semana, ~2h)

> Sem isso, escalar pra 10+ clientes vira dor de cabeça.

| # | Tarefa | Onde |
|---|---|---|
| 1 | Rodar `scripts/supabase-cleanup.sql` bloco a bloco | Supabase SQL Editor |
| 2 | Revisar workflow `1. Master Secretária BACKUP` pra inserir pacientes | N8N |
| 3 | Adicionar tracking real de tokens LLM em `usage_tracking` | DDL + N8N node |
| 4 | Criar tabela `error_logs` + log estruturado nas APIs principais | Supabase + frontend |
| 5 | Ativar Asaas produção + testar cobrança real R$1 | Vercel + Asaas |

**Resultado:** dashboard `/admin` mostra custo real (não estimativa), pacientes apareceriam no painel, primeiro pagamento real flui.

---

### 🌊 Onda 3 — UX premium pra reter (próximas 2 semanas)

> Diferencia o produto.

| # | Tarefa | Por quê |
|---|---|---|
| 1 | Welcome tour interativo inline (não modal) | Reduz fricção primeiros minutos |
| 2 | Notificações in-app (toast quando paciente chega via WhatsApp) | Sensação de tempo real |
| 3 | Realtime no painel (Supabase channels) — agenda atualiza sem F5 | Pro user vê IA agindo |
| 4 | Dashboard de cobranças `/painel/cobrancas` consumindo `/insights` | Já tem API, falta UI |
| 5 | Multi-usuário por tenant (recepcionista + médico, papéis diferentes) | Clínicas reais têm equipe |
| 6 | Export CSV (pacientes, faturamento, NPS) | Profissional pede |

---

### 🌊 Onda 4 — Crescimento e escala (mês 2+)

| # | Tarefa | Por quê |
|---|---|---|
| 1 | Landing page com case studies + depoimentos reais | Conversão fria |
| 2 | Programa de indicação (tenant convida outro → bonus) | Growth orgânico |
| 3 | Integração com mais convênios (não só particular) | Expandir TAM |
| 4 | App mobile nativo (React Native) ou só PWA aprimorada | Profissional usa muito mobile |
| 5 | API pública pra integrações (Zapier/Make) | Lock-in profissional |
| 6 | White-label opcional (clínica grande quer marca própria) | Tickets maiores |

---

## ✅ Checklist mínimo pra "ir pro vivo" (Onda 1 + 2)

```
[ ] Resend SMTP configurado + magic link testado funcionando
[ ] N8N_WEBHOOK_URL no Vercel apontando pro onboarding webhook
[ ] Workflow Onboarding ativo + chat_id corrigido
[ ] Trigger Telegram habilitado no Assistente Interno
[ ] Asaas conta produção aprovada + envs no Vercel
[ ] Webhook Asaas configurado e testado com cobrança R$1
[ ] scripts/supabase-cleanup.sql rodado (RLS + triggers)
[ ] Master Secretária inserindo pacientes no banco
[ ] 1 cliente real (você ou alguém de confiança) fazendo onboarding completo end-to-end
```

Quando os 9 itens acima estiverem ✅, pode anunciar publicamente.

---

## 🆘 O que fazer agora (próximas 30 min)

**Sequência sugerida:**

1. **Diagnosticar magic link** (3 min)
   - Supabase → Auth → Logs → filtra "magic" e "otp"
   - Se vir "rate_limit" → vai pro passo 2
   - Se vir mensagem outra → me manda screenshot que eu analiso

2. **Configurar Resend** (15 min)
   - Já tá tudo documentado em `docs/PASSO-A-PASSO-OPERACIONAL.md` passo 6
   - Resolve magic link **definitivo**

3. **Setar `N8N_WEBHOOK_URL`** (2 min)
   - Vercel env → `https://n8n.singulare.org/webhook/2f433624-1d6d-4c11-9e32-a567b9d29c5f`
   - Redeploy

4. **Habilitar Telegram trigger** + corrigir chat_id no workflow Onboarding (10 min)
   - Walkthrough em `docs/N8N-WALKTHROUGH.md` Workflow 1

Total: ~30 min ativo. Resolve metade dos bloqueadores.

Resto (Asaas KYC + cleanup SQL + revisar Master Secretária) você faz amanhã.
