# Auditoria: Compatibilidade Multi-Tenant + Multi-User

**Data:** 2026-04-29
**Escopo:** Supabase + workflows n8n + app Next.js
**Status:** PARCIAL — Supabase MCP fora do ar durante geração; algumas tabelas precisam re-verificação

## TL;DR — O bug crítico que precisa de atenção AGORA

🚨 **Memory dos agentes n8n vaza histórico entre tenants.**

O nó `Memory` da Secretária usa:
```
sessionKey: ={{ $('Info').first().json.telefone }}
```

Quando o agente lê o histórico, faz:
```sql
SELECT * FROM n8n_historico_mensagens WHERE session_id = '+5511999999999'
```

**Resultado:** se um paciente X é cliente da clínica A E da clínica B (cenário real e comum), o agente vê conversas das DUAS clínicas misturadas. Ainda que cada row tenha `tenant_id` correto (graças aos triggers da Onda 1+2), o **SELECT do Memory ignora tenant_id**.

A nova feature de RLS não ajuda — n8n usa service_role que bypassa.

### Fix crítico

Em **TODOS** os Memory nodes do workflow, mudar `sessionKey` para incluir tenant:

| Antes | Depois |
|---|---|
| `={{ $('Info').first().json.telefone }}` | `={{ $('Info').first().json.tenant_id + '_' + $('Info').first().json.telefone }}` |
| `=assistente_confirmacao` | `={{ 'assistente_confirmacao_' + $('Buscar Config Tenant1').item.json.tenant_id }}` |

Resultado: session_ids viram `singulare_+5511...` e `clinica-voda-c6e7d50f_+5511...` — naturalmente isolados.

**Aplicar na ATIVA (`OOT4JZyKZUyB0SxB`):**
- Nó `Memory` (da Secretária) — sessionKey
- Nó `Postgres Chat Memory` (do Assistente de confirmação) — sessionKey
- Nó `Postgres Chat Memory1` (do AI Agent Exam Specialist) — sessionKey

⚠️ **Migração retroativa de dados:** os 1270 rows existentes em `n8n_historico_mensagens` têm session_id em formato antigo (sem prefixo de tenant). Após mudar o workflow, essas conversas históricas ficam órfãs (não são lidas pelo novo session_id format). Solução possível:
```sql
-- Backfill retroativo (executar APÓS mudar workflow)
UPDATE n8n_historico_mensagens
SET session_id = tenant_id || '_' || session_id
WHERE session_id ~ '^\+\d{10,15}$'
  AND session_id NOT LIKE tenant_id || '_%';
```

---

## Mapeamento das tabelas

### Tier 1 — Tabelas verificadas nesta sessão (estado conhecido)

| Tabela | tenant_id | NOT NULL | Default | RLS | Policies | Status |
|---|---|---|---|---|---|---|
| `tenants` | varchar (PK) | N/A (PK) | — | ✅ | 2 (SELECT + UPDATE) | ✅ OK |
| `tenant_members` | varchar | sim | — | ✅ | 6 | ✅ OK |
| `tenant_doctors` | varchar | sim | — | ✅ | 5 | ✅ OK (linked_user_id ✅) |
| `tenant_api_keys` | varchar | sim | — | ✅ | **0 intencional** | ✅ OK |
| `n8n_fila_mensagens` | varchar | sim | `'singulare'` | ❓ | ❓ | 🟡 verificar RLS |
| `n8n_historico_mensagens` | varchar | sim | `'singulare'` | ❓ | ❓ | 🟡 trigger Onda 1; verificar RLS |
| `n8n_historico_exames` | varchar | sim | `'singulare'` | ❓ | ❓ | 🟡 trigger Onda 2; verificar RLS |
| `n8n_historico_exames_memory` | varchar | sim | `'singulare'` | ❓ | ❓ | 🟡 trigger Onda 2; verificar RLS |

### Tier 2 — Tabelas usadas pelo app, **não verificadas direto** nesta sessão

App code (`app/lib`, `app/app/api`) faz queries em:

| Tabela | Mencionada em código | Crítica multi-tenant? | Verificar |
|---|---|---|---|
| `appointments` | sim (várias rotas /api/painel/agenda) | 🔴 **CRÍTICA** | tenant_id, RLS, FK doctor_id |
| `patients` | `/api/painel/pacientes/*` | 🔴 **CRÍTICA** | tenant_id, RLS, unique (tenant_id, phone) |
| `patient_feedback` | NPS routes | 🔴 sim | tenant_id, RLS |
| `saas_orders` | `/api/onboarding`, `/api/checkout/*`, `/api/webhooks/asaas` | 🟡 sim | tenant_id, RLS |
| `tenant_payments` | webhooks/asaas, marketplace/charge | 🟡 sim | tenant_id, RLS |

### Tier 3 — Tabelas n8n auxiliares

| Tabela | Fonte | Status |
|---|---|---|
| `n8n_fila_mensagens` | workflow Master Secretária | tenant_id ✅, RLS ❓ |

---

## Multi-user (staff de clínica)

### Estado atual ✅

- `tenant_members` (PR1) já implementa multi-user: `(tenant_id, user_id, role, status)`
- Roles suportados: `'owner'`, `'admin'` (outros podem ser adicionados)
- App code usa `auth-tenant.ts` → `requireTenant()` que resolve via tenant_members
- RLS policies (PR5) garantem isolamento mesmo se app esquecer filtro

### O que está OK

- Owner pode editar tenant (policy `tenants_owner_update`)
- Owner/admin podem CRUD doctors (policies `tenant_doctors_admin_*`)
- Doctors podem editar sua própria linha via `linked_user_id` (policy `tenant_doctors_self_update`)
- Owner pode convidar/remover members
- Members podem editar próprio perfil

### O que falta (não bloqueante hoje)

- Roles além de owner/admin — ex: `'staff'`, `'doctor'`, `'receptionist'` — sem policies dedicadas
- UI de convite (`/painel/equipe`) — PR3 ainda não foi feito
- Email de convite — depende de SES estar funcional (✅ está)

---

## Multi-tenant (paciente vs clínicas)

### O caso complicado

Um paciente pode ser cliente de várias clínicas (cenário real). O telefone é único globalmente, mas o "histórico" deve ser separado por clínica.

| Camada | Multi-tenant correto? | Como |
|---|---|---|
| **Storage** (rows com `tenant_id`) | ✅ Sim | Trigger Onda 1+2 popula tenant_id correto |
| **Query** (Memory nodes do n8n) | 🚨 **NÃO** | sessionKey = telefone só, lookup ignora tenant |
| **App reads** | ✅ Sim | Filtros explícitos `.eq('tenant_id', ...)` em todas as routes |

Por isso o **fix crítico no início deste doc** é obrigatório antes de ativar 2º tenant em produção.

---

## Fluxos de dados — quem escreve onde

### Por workflow n8n (Master Secretária)

| Nó | Escreve em | tenant_id? | Como obtem |
|---|---|---|---|
| `Enfileirar mensagem.` | n8n_fila_mensagens | ✅ explícito | `$('Buscar Config Tenant').item.json.tenant_id` |
| `Memory` (Secretária) | n8n_historico_mensagens | ✅ via trigger | trigger lookup por session_id (telefone) |
| `Postgres Chat Memory` (Assistente) | n8n_historico_mensagens | ⚠️ trigger faz fallback `singulare` (session_id fixo) | hardcoded |
| `Salvar memoria` (tool Assistente) | n8n_historico_mensagens | ✅ explícito (após fix recente) | `$('Buscar Config Tenant1').item.json.tenant_id` |
| `Registra Exames` | n8n_historico_exames | ✅ via trigger | trigger lookup por telefone_paciente |
| `Postgres Chat Memory1` | n8n_historico_exames_memory | ✅ via trigger | trigger lookup por session_id |

### Por app Next.js

| Endpoint | Escreve em | tenant_id? |
|---|---|---|
| `POST /api/onboarding` | tenants, tenant_doctors, saas_orders | ✅ explícito (cria o tenant) |
| `POST /api/painel/profissionais` | tenant_doctors | ✅ via `requireTenant()` |
| `POST /api/marketplace/activate` | tenants, tenant_api_keys | ✅ explícito |
| `POST /api/webhooks/asaas` | tenants, tenant_payments | ⚠️ verificar |

---

## Próximos passos (priorizados)

### 🔴 P0 — Fix Memory isolation (crítico antes de ativar 2º tenant)

1. Editar 3 nós Memory na ATIVA:
   - `Memory` → sessionKey = `={{ $('Info').first().json.tenant_id + '_' + $('Info').first().json.telefone }}`
   - `Postgres Chat Memory` → sessionKey = `={{ 'assistente_confirmacao_' + $('Buscar Config Tenant1').item.json.tenant_id }}`
   - `Postgres Chat Memory1` → mesmo padrão (incluir tenant)
2. Editar 3 tools que escrevem em historico_mensagens com session_id telefone:
   - `Salvar memoria` (tool do Assistente) → mudar `session_id` em columns.value para incluir tenant
   - Demais ferramentas usando o mesmo padrão
3. Backfill SQL retroativo após confirmar workflow (ver SQL no topo deste doc)

### 🟡 P1 — Auditoria de tabelas business (quando Supabase MCP voltar)

```sql
-- Rodar quando MCP voltar:
SELECT
  t.table_name,
  c.column_name AS tenant_col,
  c.is_nullable,
  c.column_default,
  (SELECT relrowsecurity FROM pg_class
   WHERE relname=t.table_name
     AND relnamespace=(SELECT oid FROM pg_namespace WHERE nspname='public')) AS rls_enabled,
  (SELECT count(*) FROM pg_policies p
   WHERE p.schemaname='public' AND p.tablename=t.table_name) AS policy_count
FROM information_schema.tables t
LEFT JOIN information_schema.columns c
  ON c.table_schema=t.table_schema AND c.table_name=t.table_name
  AND c.column_name='tenant_id'
WHERE t.table_schema='public' AND t.table_type='BASE TABLE'
ORDER BY (c.column_name IS NULL), t.table_name;
```

Alvos prioritários: `appointments`, `patients`, `patient_feedback`, `saas_orders`, `tenant_payments`.

### 🟢 P2 — Performance + indexes

```sql
-- Index composto para Memory queries (futuro)
CREATE INDEX IF NOT EXISTS idx_historico_mensagens_tenant_session
  ON n8n_historico_mensagens (tenant_id, session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fila_mensagens_telefone_timestamp
  ON n8n_fila_mensagens (telefone, timestamp DESC);
```

Não urgente com 1270 rows, mas necessário quando passar de ~50k.

### 🟢 P3 — RLS em tabelas n8n_*

Atualmente desconhecido se RLS está habilitado nas tabelas `n8n_*`. Se está OFF, é OK pra hoje (só service_role escreve), mas defesa em profundidade exigiria policies análogas às de tenants/tenant_doctors.

---

## Como retomar a varredura quando MCP voltar

1. Rodar a query do P1 — confirma estado de cada tabela
2. Para cada `appointments`/`patients`/etc, verificar:
   - tenant_id existe + NOT NULL?
   - Index em (tenant_id) e (tenant_id, FK_principal)?
   - RLS + policies adequadas?
3. Aplicar fixes incrementais conforme achar gaps

---

## Comandos rápidos de verificação

### Quem está usando session_id que vaza?
```sql
SELECT tenant_id, count(*), count(DISTINCT session_id) AS unique_sessions
FROM n8n_historico_mensagens
GROUP BY tenant_id;
```

### Tem rows com tenant_id 'singulare' que deveriam ser de outro tenant?
```sql
SELECT m.session_id, m.tenant_id AS historico_tenant, f.tenant_id AS fila_tenant
FROM n8n_historico_mensagens m
LEFT JOIN LATERAL (
  SELECT tenant_id FROM n8n_fila_mensagens
  WHERE telefone = m.session_id ORDER BY timestamp DESC LIMIT 1
) f ON true
WHERE m.session_id ~ '^\+\d{10,15}$'
  AND m.tenant_id != COALESCE(f.tenant_id, 'singulare')
LIMIT 20;
```

### Verificar policies em todas as tabelas multi-tenant
```sql
SELECT schemaname, tablename, count(*) AS policies
FROM pg_policies
WHERE schemaname='public'
GROUP BY 1,2
ORDER BY 2;
```
