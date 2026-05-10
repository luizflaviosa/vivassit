---
description: Create + apply Supabase migration with safety checks
argument-hint: [migration_name_snake_case]
allowed-tools: Agent, Bash, Read, Edit
---

# /migrate — Supabase migration workflow

Cria, aplica e valida uma migration no projeto Supabase `qwyxacfgoqlskidwzdxe`.

## Passos

1. **Validar nome** — `$ARGUMENTS` deve ser um slug `snake_case` (ex.: `add_tenant_features_jsonb`). Se vazio ou inválido (espaços, maiúsculas, hífens), peça ao usuário um nome válido e pare.

2. **Delegar ao sub-agent `singulare-db`** com este briefing:

   > Você está criando a migration `$ARGUMENTS` no projeto Supabase `qwyxacfgoqlskidwzdxe`.
   >
   > Execute na ordem:
   >
   > 1. `mcp__supabase__list_tables` (schemas: `public`, `auth`) para confirmar o estado atual e identificar conflitos com o que será mudado.
   > 2. **Discuta com o usuário** o SQL exato antes de escrever. Mostre rascunho. Não invente colunas/índices sem confirmar.
   > 3. Gere o timestamp em UTC: `date -u +%Y%m%d%H%M%S`. Salve o arquivo em `supabase/migrations/<TIMESTAMP>_$ARGUMENTS.sql` com cabeçalho-comentário descrevendo o objetivo.
   > 4. Aplique via `mcp__supabase__apply_migration` (name=`$ARGUMENTS`, query=conteúdo do arquivo). Espere o confirm cost se o MCP pedir.
   > 5. Rode `mcp__supabase__get_advisors type=security` e depois `type=performance`. Reporte qualquer alerta novo introduzido pela migration (compare com baseline mental se possível).
   > 6. Rode `mcp__supabase__generate_typescript_types` e salve a saída em `app/lib/supabase-types.ts` (sobrescreve).
   > 7. Devolva: caminho da migration, advisors novos, e se os types mudaram (diff resumido).

3. **Não dê commit nem push automático** — apenas reporte. O usuário decide quando rodar `/deploy`.

## Regras de segurança

- RLS: toda tabela nova em `public` precisa de `ENABLE ROW LEVEL SECURITY` + policies. Não esqueça.
- Multi-tenant: colunas `tenant_id uuid` referenciando `tenants(id)` quando aplicável; index em `tenant_id`.
- Nunca `DROP` em produção sem confirmar duplamente com o usuário.
- Migrations são append-only. Se erra, cria nova migration corrigindo — não edita histórico.
