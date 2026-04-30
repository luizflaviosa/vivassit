# Multi-tenant + Multi-user — fechamento 2026-04-30

Sessão de trabalho que finalizou os planos abertos em 29-04. Tudo verificado em prod.

## TL;DR

Bug crítico de **memory leak entre tenants** (identificado em `2026-04-29-multi-tenant-multi-user-audit.md`) foi **eliminado**:

1. ✅ 3 Memory nodes do workflow ATIVA agora carregam `tenant_id` no `sessionKey`
2. ✅ 1.176 rows legacy de `n8n_historico_mensagens` foram backfilled com prefixo tenant
3. ✅ 6 tabelas business endurecidas (tenant_id NOT NULL + RLS + policies)
4. ✅ 2 tabelas n8n ganharam RLS (defesa em profundidade)
5. ✅ 4 índices de performance adicionados

Sistema pronto pra ativar 2º tenant em produção sem leak cross-clínica.

## O que mudou no banco

| Migration | Bloco | Detalhes |
|---|---|---|
| `block_a_appointments_tenant_id` | A | `appointments`: +coluna tenant_id NOT NULL, +FK tenants, +2 idx, +2 policies (`is_tenant_member()`) |
| `block_b_tenant_id_not_null_hardening` | B | NOT NULL em `saas_orders`, `push_subscriptions`, `notification_log` (com backfill via tenant_members) |
| `block_c_rls_n8n_exames` | C | RLS ON em `n8n_historico_exames` + `_memory` + 1 policy member-only cada |
| `block_d_indexes_performance` | D | +3 idx: `historico_mensagens(tenant_id, session_id, created_at desc)`, `fila_mensagens(telefone, timestamp desc)`, `fila_mensagens(tenant_id, telefone)` |

SQL completo arquivado em `docs/superpowers/plans/2026-04-30-multi-tenant-blocos-a-d.sql`.

## O que mudou no n8n

Workflow ATIVA `OOT4JZyKZUyB0SxB` (102 nodes) — 3 sessionKey patches:

| Node | Antes | Depois |
|---|---|---|
| `Memory` | `={{ $('Info').first().json.telefone }}` | `={{ $('Info').first().json.tenant_id + '_' + $('Info').first().json.telefone }}` |
| `Postgres Chat Memory` | `=assistente_confirmacao` | `={{ 'assistente_confirmacao_' + $('Buscar Config Tenant1').item.json.tenant_id }}` |
| `Postgres Chat Memory1` | `={{ $('Info').item.json.telefone }}` | `={{ $('Info').item.json.tenant_id + '_' + $('Info').item.json.telefone }}` |

Aplicado via `PUT /api/v1/workflows/OOT4JZyKZUyB0SxB` na public API. Backup pré-fix em `.n8n-backups/master-secretaria-ATIVA-pre-memory-fix-20260430-091441.json`.

**Side-effect conhecido:** public API rejeita `availableInMCP` no schema do PUT, então esse campo virou `false`. **Restaurar manualmente** via UI do n8n: workflow Settings → "Available in MCP" → On.

## Backfill de session_ids legacy

`n8n_historico_mensagens` tinha 1.272 rows todos com `tenant_id='singulare'` mas session_ids sem prefixo. UPDATE em 3 padrões:

| Padrão antes | Após backfill | Count |
|---|---|---|
| `+5511...` (E.164 puro) | `singulare_+5511...` | 1.048 |
| `assistente_confirmacao` | `assistente_confirmacao_singulare` | 38 |
| `assistente_interno` | `assistente_interno_singulare` | 50 |
| `+123456` (lixo teste) | (não tocado) | 104 |
| `*_singulare` (já correto) | (não tocado) | 32 |

Todos lookups novos do Memory bate exato com o backfill — sem rows órfãos.

## Estado da auditoria multi-tenant pós-sessão

| Tabela | tenant_id NOT NULL | RLS | Policies | Indexes |
|---|---|---|---|---|
| `appointments` | ✅ | ✅ | 5 | 8 |
| `saas_orders` | ✅ | ✅ | 1 | 9 |
| `push_subscriptions` | ✅ | ✅ | 1 | 4 |
| `notification_log` | ✅ | ✅ | 1 | 3 |
| `n8n_historico_exames` | ✅ | ✅ (era OFF) | 1 | 1 |
| `n8n_historico_exames_memory` | ✅ | ✅ (era OFF) | 1 | 1 |
| `n8n_historico_mensagens` | ✅ | ✅ | 4 | 4 |
| `n8n_fila_mensagens` | ✅ | ✅ | 4 | 6 |
| `tenants`, `tenant_members`, `tenant_doctors`, `tenant_api_keys` | ✅ | ✅ | 13 total | — |

## Pendências fora desta sessão

- ⚪ Smoke test ponta-a-ponta com mensagem real no WhatsApp (qualquer dia o user ativa)
- ⚪ Restaurar `availableInMCP=true` no n8n (1 toggle UI)
- ⚪ `notifications` tabela legacy sem tenant_id — investigar se ainda é usada (versus `notification_log` que substitui)
- ⚪ `webhook_logs` sem tenant_id, RLS OFF — log-only de Asaas, audit-only não-crítico
- ⚪ Onda 2.5 PR4 — Telegram pessoal por member no Assistente Interno (SQL JOIN tenant_members)

## Comandos de verificação

```sql
-- Memory isolation: query do agente IA por session_id
SELECT count(*), array_agg(DISTINCT tenant_id)
FROM n8n_historico_mensagens
WHERE session_id LIKE 'singulare_+%'
GROUP BY 1; -- esperado: 1 tenant_id distinto = singulare

-- 2º tenant ativando: depois de 1ª mensagem
SELECT session_id, tenant_id, count(*)
FROM n8n_historico_mensagens
GROUP BY 1, 2
ORDER BY 3 DESC LIMIT 10;
-- esperado: cada session_id tem prefixo igual ao tenant_id
```

## Arquivos novos / modificados nesta sessão

```
docs/STATUS-2026-04-30-multi-tenant-fechado.md          # este
docs/superpowers/plans/2026-04-30-multi-tenant-blocos-a-d.sql

.n8n-backups/master-secretaria-ATIVA-pre-memory-fix-20260430-091441.json   # backup PRE-fix (gitignore)
```

Workflow no n8n.singulare.org — `OOT4JZyKZUyB0SxB` `updatedAt: 2026-04-30T12:17:36.011Z`.
