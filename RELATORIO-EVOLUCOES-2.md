# Relatório — Sessão Autônoma 2

**Branch:** `feat/evolutions-2` (zero impacto na `main` até você aprovar)
**Início:** ~14:30 BRT · **Encerramento:** ~16:00 BRT (~90min)
**Commits:** 1 grande (3 arquivos, +566/−221 linhas) + script SQL fora do bundle

---

## TL;DR — 3 ações suas quando voltar

1. **Mergear branch:** `git checkout main && git merge feat/evolutions-2 && git push origin main` → ativa modal corrigido + edição completa de profissionais + edição completa da clínica
2. **Rodar script SQL:** `scripts/supabase-cleanup.sql` no SQL Editor (bloco a bloco) → corrige triggers duplicados + RLS faltando
3. **Habilitar MCP no workflow N8N "6. Assistente Interno"** pra eu poder modificar/criar webhook chat na próxima

---

## O que foi feito

### 🎨 Frontend (mergeable em 1 commit)

#### A) Modal de profissionais corrigido
- **Bug:** modal centralizado vertical com `top-1/2 -translate-y-1/2` saía da tela em formulários longos
- **Fix:** wrapper flex fullscreen com items-center justify-center, modal interno com `max-h-[calc(100vh-3rem)] flex flex-col`
- Header e footer ficam sticky, body scroll independente

#### B) Editor COMPLETO de profissional (todos os campos do onboarding)
Antes: 6 campos. Agora **17 campos** organizados em 7 seções:

| Seção | Campos |
|---|---|
| Identidade | Nome, registro (CRM/CRO/CRP/CRN/CREFITO), especialidade |
| Contato | Email, telefone, endereço |
| Consulta | Valor, duração, métodos de pagamento |
| Convênios | Toggle "aceita convênios" + textarea com lista de convênios |
| Retorno (follow-up) | Valor, duração, janela em dias |
| **Dias e horários** | **Editor inline 7 dias da semana com toggle aberto/fechado e time inputs start/end** |
| Google Calendar | Calendar ID + hint sobre service account |

API `PATCH /api/painel/profissionais` whitelist ampliada. Botão "Editar" no card já existia (do round anterior).

#### C) Editor COMPLETO de tenant/clínica (resolve "configurar depois")
Antes: 4 campos básicos. Agora **13 campos editáveis** + **status read-only de integrações**:

| Seção | Campos editáveis |
|---|---|
| Personalização IA | assistant_prompt (textarea grande) |
| Identidade | Nome, CNPJ, endereço, tipo (read-only) |
| Profissional principal (só se solo) | Nome, registro, especialidade |
| Contato e canais | Admin email, email público, telefone real WhatsApp, telefone alternativo, email do contador |
| Status integrações (read-only) | WhatsApp Evolution, Telegram, Asaas, ElevenLabs (com label colorido de status) |

Botão "Salvar alterações" agora **sticky-bottom** pra não perder em forms longos.

API `PATCH /api/painel/tenant` whitelist ampliada com 13 novos campos.

---

### 🔍 Audit Supabase (encontrou 85 lints)

**Críticos (8 ERROR):**
- 19 tabelas sem RLS no schema `public` (qualquer um com chave anon acessa)
- 6 views com `SECURITY DEFINER` (bypassa RLS do consultador)
- 2 tabelas sem RLS contêm colunas sensíveis (`session_id` em `n8n_historico_exames*`)
- 1 tabela tem policy criada mas RLS não habilitado (`webhook_logs`)

**Performance/best-practice (76 WARN):**
- 36 tabelas expostas via pg_graphql anon (sem usar)
- 18 funções sem `search_path` fixado (vetor SQL injection)
- OTP do Supabase Auth com expiração longa (1h, devia ser 10min)
- "Prevent leaked passwords" desabilitado
- Postgres em versão vulnerável

**Triggers duplicados (causam lentidão):**
- `trg_doctor_prompt_rebuild` em `tenant_doctors` — **3x**
- `trg_refresh_rendered_prompt` em `tenant_doctors` — **3x**
- `validate_appointment_trigger` em `appointments` — **2x**
- `trigger_auto_telegram_requirements` em `saas_orders` — **2x**
- `trg_sync_real_phone` em `tenants` — **2x**

→ Script SQL pronto em **`scripts/supabase-cleanup.sql`** com 6 blocos (rode bloco a bloco, não tudo de uma vez).

---

### 🔍 Audit N8N (43 workflows ativos)

**Encontrei:**
- 43 workflows totais. Ativos relevantes pro Singulare:
  - `0. On Boarding Latest v10.0 - Completo e Correto` ✓
  - `1. Master copy020825` (inativo — substituído)
  - `2. MCP Google Calendar` ✓
  - `3. Baixar e enviar arquivo do Google Drive` ✓
  - `4. Escalar humano` ✓
  - `5. Enviar agendamento` ✓
  - **`6. Assistente Interno`** (`fRqmEWOaL1b8zEDz`) ✓ — onde precisa adicionar Webhook trigger
  - `7. Agente Especialista Exames` ✓
  - `9. Reativar Agente v2.0` ✓
  - `On Boarding On Going` ✓
- ~10-15 workflows de teste ou duplicados antigos (`My workflow N`, `Teste *`, `corrigido*`) que poderiam ser arquivados
- **MCP access desabilitado em "6. Assistente Interno"** — sem isso eu não consigo nem ver os nodes nem adicionar o Webhook trigger automaticamente

**Recomendações N8N (você faz manual ou habilita MCP):**

1. Habilitar MCP no "6. Assistente Interno" (Settings do workflow → toggle MCP availability)
2. Limpar workflows duplicados/teste (~10 candidatos a arquivar)
3. Adicionar Webhook trigger no "6. Assistente Interno" (instruções em `docs/SETUP-PRODUCAO.md`)

---

## Estrutura de arquivos novos/modificados

```
feat/evolutions-2 vs main
├── app/app/api/painel/profissionais/route.ts  (PATCH whitelist + working_hours/followup_duration)
├── app/app/api/painel/tenant/route.ts          (PATCH whitelist ampliada 13 campos)
├── app/app/painel/profissionais/page.tsx       (form completo, modal corrigido, WorkingHoursEditor)
├── app/app/painel/configuracoes/page.tsx       (form ampliado, sticky save, integrações status)
├── scripts/supabase-cleanup.sql                (NOVO — 6 blocos de limpeza)
└── RELATORIO-EVOLUCOES-2.md                    (NOVO — este arquivo)
```

---

## 3 caminhos quando voltar

### A — Aprovar tudo
```bash
cd ~/Desktop/vivassit
git checkout main
git merge feat/evolutions-2
git push origin main
# Vercel auto-deploya em ~2min
```
Depois rode o `scripts/supabase-cleanup.sql` bloco a bloco no SQL Editor do Supabase.

### B — Aprovar só código (deixar SQL pra depois)
Mesmos comandos do A, **sem** rodar o SQL ainda. Vai ter modal corrigido + editores completos. Triggers continuam duplicados (lentidão moderada, sem quebra).

### C — Reverter tudo
```bash
git branch -D feat/evolutions-2
```
Tudo volta como antes do bloco autônomo.

---

## Pendências não-bloqueadas (mesmas de antes)

- **Service Account Google: criar JSON key + adicionar env no Vercel** (instruções `docs/SETUP-PRODUCAO.md` passo 0)
- **Asaas KYC + Marketplace produção** (~15min de config em asaas.com)
- **N8N webhook trigger no "6. Assistente Interno"** (~10min)
- **Resend SMTP** pra magic link sem rate limit (~5min)
- **DELETE 5 tenants de teste** no Supabase (Bloco 4 do SQL, comentado por segurança — você descomenta se quiser)

---

## Ideias pra próxima sessão

- **Painel de pacientes editável** (nome, notas, tags) — hoje só read
- **Dashboard de cobranças** consumindo `/api/painel/cobrancas/insights` (a API já existe)
- **WhatsApp QR connect inline** se Evolution status == 'disconnected'
- **Logs N8N na UI** — mostrar últimas execuções do workflow "6. Assistente Interno" no chat drawer pra debug rápido
- **Multi-tenant invite** — convidar outros usuários com diferentes papéis (admin, recepcionista, profissional)
- **Auditoria automática** — schedule pra rodar `get_advisors` semanalmente e abrir issue se passar de threshold
