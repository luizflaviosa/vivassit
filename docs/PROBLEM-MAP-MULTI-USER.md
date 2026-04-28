# Problem Map — Multi-User por Tenant (Onda 2.5)

**Data:** 2026-04-27 · **Modo:** Solo · **Decisão:** ainda em aberto (executar agora ou depois)

---

## Problem Statement

Hoje **1 tenant = 1 admin_user_id**. Para vender pra clínicas reais (com 2-10 profissionais), cada profissional precisa de:
- Login próprio (email + sessão Supabase)
- Telegram pessoal pro Assistente Interno
- Acesso ao painel da MESMA clínica (mesmo tenant)
- Possível papel diferente (admin geral, médico, recepcionista)

Um mesmo usuário também pode ser admin de várias clínicas (ex: rede de consultórios, ou eu mesmo: admin do "Singulare HQ" + admin da clínica Voda).

A **restrição não-negociável**: o WhatsApp de atendimento é UM número por clínica, compartilhado entre todos os profissionais (Evolution API + 1 Chatwoot inbox por tenant).

---

## Achados verificáveis (estado atual)

### A1. Master Secretária identifica tenant por Chatwoot, não por user

**Verificado nos nós N8N do workflow `1ItWxEZZsAQN7luV`:**

```sql
-- Buscar Config Tenant
SELECT chatwoot_url, chatwoot_account_id, telegram_chat_id, rendered_prompt, assistant_prompt
FROM tenants
WHERE chatwoot_inbox_id = '{{ $json.id_inbox }}' AND status = 'active' LIMIT 1

-- Buscar Config Tenant1 (usado pelo Assistente de Confirmação)
SELECT rendered_prompt, assistant_prompt
FROM tenants
WHERE chatwoot_account_id = '{{ $("Info1").first().json.id_conta }}'
  AND status = 'active' LIMIT 1
```

**Implicação:** Multi-user-per-tenant **NÃO afeta** o Master Secretária. Ele nunca usa `admin_user_id` nem `admin_email`. Identifica clínica pelo `chatwoot_inbox_id` que vem no webhook do Chatwoot quando o paciente manda WhatsApp.

### A2. tenant_id default 'singulare' nas tabelas de mensagens — bomba latente

**Verificado no schema:**

```
n8n_historico_mensagens.tenant_id  default 'singulare'::varchar
n8n_fila_mensagens.tenant_id       default 'singulare'::varchar
```

**Verificado nos nós:** `Salvar memoria` e `Enfileirar mensagem.` do Master Secretária **NÃO** setam `tenant_id` explicitamente — confiam no default.

**Implicação concreta:** Se o usuário onboardar uma 2ª clínica HOJE, **todas as mensagens dela vão pra `tenant_id='singulare'`** no histórico/fila. Isolamento quebrado, dashboard `/admin` (custo LLM por tenant) vai mostrar tudo no Singulare.

**Severidade:** alta — independente do plano multi-user.

### A3. Patients table só usa tenant_id (sem doctor link)

`patients` tem só `tenant_id` (varchar) + `phone` (PK natural). Não amarra a um médico. Está OK pro modelo "WhatsApp único da clínica" — paciente é da clínica, não do médico.

Já tem `doctor_preference` e `last_doctor` (varchar livre, nome) → isso vira info pro agente IA escolher o calendar correto. Não precisa migrar.

### A4. tenant_doctors NÃO tem user_id

```
tenant_doctors columns: id, tenant_id, doctor_name, doctor_crm, specialty,
  phone_number, email, calendar_id, working_hours, ...
  (NENHUMA coluna FK para auth.users)
```

**Implicação:** profissional cadastrado no painel é só **dado de catálogo** (nome, CRM, calendar). Não há login associado. Pra dar acesso pessoal a cada médico, precisamos de `tenant_doctors.linked_user_id` opcional + `tenant_members` (a tabela proposta).

### A5. Endpoints que assumem 1 tenant por user (precisam migrar)

Verificado por grep `admin_user_id|admin_email`:

| Arquivo | O que faz | Migração |
|---|---|---|
| [lib/auth-tenant.ts](app/lib/auth-tenant.ts) | Helper `requireTenant()` central — usado por todo `/api/painel/*` | Reescrever query: `JOIN tenant_members WHERE user_id = ?` |
| [app/auth/callback/route.ts:83-92](app/app/auth/callback/route.ts#L83-L92) | Auto-link de `admin_user_id` quando null no primeiro login | Trocar pra inserir em `tenant_members` |
| [app/api/painel/me/route.ts](app/app/api/painel/me/route.ts) | Resolve tenant atual (cookie → user_id → email) | Idem; retornar `available_tenants[]` com role |
| [app/api/painel/tenants/route.ts](app/app/api/painel/tenants/route.ts) | Lista tenants do switcher | Trocar `eq('admin_user_id', user.id)` por `JOIN tenant_members` |
| [app/api/painel/tenant/route.ts](app/app/api/painel/tenant/route.ts) | GET/PUT detalhe do tenant ativo | Permission check via role do member |
| [app/api/diag/auth/route.ts:111-119](app/app/api/diag/auth/route.ts#L111-L119) | Diagnóstico — mostra tenant lookup | Atualizar pra mostrar membership |
| [app/api/interno/comando/route.ts](app/app/api/interno/comando/route.ts) | Chat IA — já fixou com cookie hoje | Trocar pra `tenant_members` lookup |
| [app/api/onboarding/route.ts](app/app/api/onboarding/route.ts) | Recebe `admin_email` do form | **Mantém** — é o campo do form. Após criar tenant, INSERT em `tenant_members` (role=owner) |

**Total de arquivos com mudança:** 8.

### A6. RLS atual — `tenants` e `tenant_doctors` SEM RLS

Pesquisei `pg_policies WHERE schemaname='public'`:

- **Tem RLS isolada por tenant:** `n8n_historico_mensagens`, `n8n_fila_mensagens`, `tenant_payments`, `usage_tracking`, `tenant_activity_logs`, `tenant_exams` — todas usam `current_setting('app.current_tenant_id')`.
- **Sem RLS:** `tenants`, `tenant_doctors`, `tenant_api_keys`, `patients`, `patient_feedback`, `nf_requests`, `webhook_logs`, `weekly_metrics`, `saas_orders`. Foram listadas em `scripts/supabase-cleanup.sql` mas o usuário ainda não rodou.
- **RLS por user (não tenant):** `appointments`, `payments`, `notifications`, `profiles`, `users` — usam `auth.uid() = X`.

**Implicação:** Quando ativar RLS em `tenants` (Onda 1, cleanup script), a policy precisa já contemplar multi-user:

```sql
CREATE POLICY tenants_member_read ON tenants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_members.tenant_id = tenants.tenant_id
      AND tenant_members.user_id = auth.uid()
      AND tenant_members.status = 'active'
  )
);
```

Se eu **rodar o cleanup ANTES** de criar `tenant_members`, vou precisar de uma policy temporária baseada em `admin_user_id` que depois será trocada — é retrabalho.

### A7. Workflow Assistente Interno (chat IA) usa telegram_chat_id em tenants

Verificado no workflow `WmM47MvuJPU8szyM`:

```sql
SELECT ... FROM tenants
WHERE telegram_chat_id = '{{ $json.telegram_chat_id }}'
   OR tenant_id = '{{ $json.tenant_id }}'
```

**Implicação:** se cada **member** tem o próprio Telegram, esse SQL precisa virar:

```sql
SELECT t.*, m.role, m.user_id
FROM tenants t
JOIN tenant_members m ON m.tenant_id = t.tenant_id
WHERE m.telegram_chat_id = '{{ $json.telegram_chat_id }}'
   OR t.tenant_id = '{{ $json.tenant_id }}'
```

Mudança simples no único nó SQL desse workflow. Não afeta o Master Secretária (que usa Chatwoot, não Telegram).

### A8. Onboarding atual cria 1 admin como owner

[app/api/onboarding/route.ts:107,265,326,461](app/app/api/onboarding/route.ts#L107) usa `admin_email` em vários lugares como campo do formulário do onboarding — isso é **input do user**, não vai mudar.

Após criar o tenant, hoje só seta `admin_email` no INSERT. Pra multi-user: além disso, INSERT em `tenant_members (tenant_id, user_id=NULL, role='owner', invited_via_email=admin_email)` — quando o user logar pela 1ª vez, o callback resolve o `user_id` pelo email convidado.

---

## Users & Stakeholders

**Usuários afetados:**
- **Eu (operador / admin global)** — preciso poder pular entre clínicas e o admin-system. Já uso o switcher hoje.
- **Médico solo** — clínica de 1 profissional (caso atual). Hoje funciona perfeitamente; **não pode regredir**.
- **Clínica de 2-5 profissionais** (próximo público) — cada profissional quer login próprio + Telegram próprio. Hoje **inviável** sem multi-user.
- **Pacientes** — não são afetados. WhatsApp continua sendo um único número por clínica.

**Stakeholders técnicos:**
- **N8N Master Secretária** — passivo, identifica por Chatwoot. Não-impactado.
- **N8N Assistente Interno** — 1 SQL pra mudar.
- **N8N Onboarding** — leve impacto: precisa criar member quando criar tenant.
- **Chatwoot e Evolution** — zero impacto. Continuam 1 inbox/instance por tenant.

---

## Success Criteria

1. **Zero downtime no Master Secretária** durante a migração — paciente não percebe nada.
2. Singulare HQ + clínica Voda (meus 2 tenants atuais) **continuam acessíveis com meu Google login** após migração — sem ter que re-onboardar.
3. Posso convidar um 2º membro pra clínica Voda com role `doctor`, ele recebe email com magic link, acessa o painel só da Voda.
4. O Assistente Interno do membro convidado responde **só pelo Telegram dele**, não pelo do owner.
5. Onboarding novo continua criando 1 owner por tenant automaticamente.
6. RLS de `tenants` e tabelas relacionadas baseada em membership (não em `admin_user_id`).

---

## Constraints

**Tempo:** ~5h focado se feito em sequência. Pode ser quebrado em 3 PRs (schema → app → workflows).

**Técnicos:**
- Master Secretária precisa rodar 100% do tempo. Toda mudança no SQL `Buscar Config Tenant` é risco direto pra cliente.
- Cookie `singulare_active_tenant` já existe e é respeitado por `requireTenant()` — base sólida pra multi-tenant UI.
- Webhook do Chatwoot bate em N8N com `account_id` e `id_inbox` no payload — não dá pra mudar.

**Negócio:**
- Sem multi-user, **não vendemos pra clínica multi-profissional**. Isso fecha 70%+ do TAM.
- Mas agora não temos cliente pagante pendurado nisso. Janela tranquila.

---

## Assumptions (precisam de validação)

- ✅ **Validado:** Master Secretária não usa admin_user_id — confirmado nos SQLs.
- ✅ **Validado:** Chatwoot inbox é 1-por-tenant — confirmado no schema (`tenants.chatwoot_inbox_id`).
- ⚠️ **Não validado:** Em uma clínica multi-profissional real, todos vão querer ver os pacientes uns dos outros? Ou queremos partição por médico no futuro? Hipótese: **clínica = todos veem tudo**; partição vem depois.
- ⚠️ **Não validado:** Cada médico vai querer Telegram pessoal pro Assistente Interno, ou usar o Telegram do owner? Hipótese: **cada um o seu** (mais higiênico).
- ⚠️ **Não validado:** Convite de membro precisa ter aprovação do owner? Hipótese: **convite por email + role pré-definido pelo owner**, member só aceita.

---

## Pain Points & Challenges

### Risco 1 — Janela de regressão na migração
Se eu mudar `requireTenant()` pra usar `tenant_members` antes de fazer backfill, **todos os endpoints do painel quebram** até o backfill rodar. Ordem de execução crítica.

**Mitigação:** Schema → backfill → código (read path tolerante) → workflows. Backfill faz `INSERT INTO tenant_members SELECT tenant_id, admin_user_id, 'owner', ... FROM tenants WHERE admin_user_id IS NOT NULL`. Idempotente.

### Risco 2 — Tenants sem admin_user_id (só admin_email)
Vi 5+ tenants `pending_payment` que tem `admin_user_id = NULL` (só email). Pro backfill funcionar, ou pulamos esses (são lixo, podem ser deletados pelo cleanup) ou criamos um membro "convidado" com user_id=NULL e email no campo.

**Mitigação:** rodar `BLOCO 4 — DELETE tenants de teste` do `scripts/supabase-cleanup.sql` ANTES do backfill. Limpa 5 tenants teste de uma vez.

### Risco 3 — RLS recursiva
A policy de `tenants` referencia `tenant_members`. Se `tenant_members` tiver RLS que referencia `tenants` (loop), Postgres recusa. Solução: RLS em `tenant_members` baseado em `auth.uid() = user_id` (não JOIN com tenants).

**Mitigação:** policies bem definidas. Já mapeei o pattern.

### Risco 4 — N8N Assistente Interno
Se eu mudar o SQL `Buscar Config Tenant` no workflow `WmM47MvuJPU8szyM` e errar, chat IA do painel volta a ficar mudo. Acabei de consertar isso hoje, é regressão imediata.

**Mitigação:** SQL com fallback duplo (`OR tenant_id = ?`) — se member lookup falhar, ainda funciona pelo tenant_id direto. Testar via execute_workflow MCP antes de declarar pronto.

### Risco 5 — Bomba latente do tenant_id default 'singulare'
Identificada no A2. Se a 1ª clínica multi-user onboardar e usar Master Secretária sem fix, mensagens vão pro tenant errado. **Não é problema de multi-user**, mas é **bloqueador pra qualquer 2º cliente** — precisa ser resolvido junto ou antes.

**Mitigação:** Corrigir nó `Enfileirar mensagem.` e `Salvar memoria` pra setar `tenant_id` explícito (vindo do `Buscar Config Tenant`). Mudança trivial no workflow.

---

## Open Questions

1. Convite de member: link mágico via email, ou geramos código que owner manda manual? (Recomendo magic link via Supabase Auth.)
2. Member pode trocar de clínica ativa? Sim — switcher já existe, só precisa mostrar todas onde é member.
3. Member pode ter role diferente em tenants diferentes? Sim — `tenant_members(tenant_id, user_id, role)` já modela isso naturalmente.
4. Se um member é admin de A e doctor em B, o `singulare_active_tenant` cookie precisa preservar contexto. Já preserva.
5. Quando deletar member: cascade nos `appointments` que ele criou? **Não.** Manter histórico, marcar `tenant_members.status='disabled'`.

---

## Ordem segura de execução (recomendada)

### Pré-requisitos (devem rodar ANTES)
- [ ] **Onda 1.5 — Limpar lixo:** rodar BLOCO 4 do `scripts/supabase-cleanup.sql` (deleta 5 tenants teste). 5 min.
- [ ] **Fix bomba latente A2:** corrigir Master Secretária pra setar `tenant_id` explícito no `Enfileirar mensagem.` e `Salvar memoria`. **Não é multi-user, mas é pré-requisito.** 10 min via MCP n8n.

### Onda 2.5 propriamente dita (em PRs separados)

**PR 1 — Schema (~30 min, low risk)**
- [ ] Migration: criar `tenant_members` + indexes + `tenant_doctors.linked_user_id`
- [ ] Backfill: `INSERT INTO tenant_members SELECT tenant_id, admin_user_id, 'owner' FROM tenants WHERE admin_user_id IS NOT NULL`
- [ ] Manter `tenants.admin_user_id` e `admin_email` por enquanto (compatibilidade)
- [ ] Smoke test: `SELECT count(*) FROM tenant_members` bate com `SELECT count(*) FROM tenants WHERE admin_user_id IS NOT NULL`

**PR 2 — App read path (~2h, medium risk)**
- [ ] `lib/auth-tenant.ts` — query primária via `tenant_members`, fallback pra `admin_user_id` (transition mode)
- [ ] `/api/painel/me`, `/api/painel/tenants`, `/api/painel/tenant`, `/api/interno/comando` — usam helper novo
- [ ] `/auth/callback` — em vez de auto-link `admin_user_id`, faz `INSERT … ON CONFLICT DO NOTHING` em `tenant_members` resolvendo email → user_id
- [ ] Verificar `/admin` e tenant switcher continuam ok
- [ ] Deploy + teste manual no painel

**PR 3 — Convite + write path (~2h, low risk)**
- [ ] `/painel/equipe` — UI lista members, botão "Convidar"
- [ ] `POST /api/painel/members` — insere convite (`status='invited'`, user_id=NULL, invited_email)
- [ ] Email via SES (já vai estar funcionando com Resend ou SES quando rodarmos)
- [ ] `/auth/callback` aceita convite: se `tenant_members.invited_email = user.email` e `user_id IS NULL`, seta user_id e status='active'
- [ ] DELETE member: soft delete (status='disabled')

**PR 4 — N8N Assistente Interno (~15 min, medium risk — toca produção)**
- [ ] Update SQL do `Buscar Config Tenant` no workflow `WmM47MvuJPU8szyM` pra JOIN com `tenant_members`
- [ ] Manter fallback `OR tenant_id = ?` (não regride)
- [ ] Testar via `execute_workflow` MCP com payload de cada source (web + telegram)

**PR 5 — RLS proper (~1h, high risk se errar)**
- [ ] Habilitar RLS em `tenants`, `tenant_doctors`, `tenant_api_keys`
- [ ] Criar policies baseadas em `EXISTS … FROM tenant_members WHERE user_id = auth.uid()`
- [ ] Service_role continua bypassando (já é o padrão)
- [ ] Testar todas as rotas do painel + N8N (que usa service_role)

**PR 6 — Cleanup (depois de N dias estável)**
- [ ] Remover fallback `admin_user_id` dos endpoints
- [ ] Drop colunas `tenants.admin_user_id` e `admin_email`? **Não — manter como cache do owner.** Adicionar coluna `tenants.owner_user_id` derivada se quiser, mas não urgente.

---

## Decisão pendente

**Pergunta pra você:** executar Onda 2.5 agora (resolve TAM mas atrasa SES/Asaas) ou depois (foco em destravar cobrança primeiro)?

**Minha recomendação:** **executar agora, em ordem invertida do plano original.**

- Os bloqueadores de produção atuais (SES, Asaas KYC) são **dependências externas** (resposta da AWS, aprovação do Asaas) — você espera, não trabalha
- Onda 2.5 é trabalho seu, dá pra paralelizar
- Sem multi-user, fechar a 1ª clínica multi-profissional vira retrabalho urgente sob pressão
- Os PRs são independentes — dá pra parar em qualquer um se precisar atender bug crítico

**Se executar agora:** PR 1+2 hoje (schema + read path = ~2.5h). PR 3 amanhã (UI de convite + write). PR 4+5 depois de validar com o seu próprio Google login. PR 6 daqui 2 semanas.

**Se postergar:** mantenho documentado, aguardo SES/Asaas, retomo depois.
