---
description: Detect drift — git ↔ Vercel env, Supabase schema, N8N workflows
allowed-tools: Bash, Read
---

# /drift — Relatório de divergências

Compara estado real (Vercel, Supabase, N8N) contra o que está versionado no repo. **NÃO modifica nada.**

## Execução

1. Rode o relatório consolidado:

   ```bash
   node scripts/automation/drift-check.mjs --report
   ```

   Se o script ainda não existir (`!test -f scripts/automation/drift-check.mjs && echo OK || echo MISSING`): reporte ao usuário que `drift-check.mjs` ainda está sendo criado em paralelo — pare aqui sem inventar saída.

2. **Apresente o resultado em 3 seções**, mesmo que uma delas venha vazia:

### Vercel env vars
Variáveis no projeto `vivassit` no Vercel que NÃO estão documentadas em `docs/INTEGRATIONS.md`.

Para cada divergência, sugira:
> Documente em `docs/INTEGRATIONS.md` ou remova do Vercel se for legado.

### Supabase schema
Tabelas presentes no projeto `qwyxacfgoqlskidwzdxe` (schemas `public`, `auth` filtrados a `public`) sem migration correspondente em `supabase/migrations/`.

Para cada divergência, sugira:
> Rode `/migrate baseline_<table>` para criar migration retroativa, OU adicione ao baseline com `bash scripts/automation/supabase-baseline.sh`.

### N8N workflows
Workflows com `active=true` em `https://n8n.singulare.org` sem export em `n8n/workflows/<id>-*.json`.

Para cada divergência, sugira:
> Rode `/sync-n8n pull <workflow_id>` para baixar e versionar.

## Formato do output

```
== DRIFT REPORT ==
[Vercel env]    <N> divergências
  - VAR_NAME (env: production) — não documentada
    > sugestão: ...

[Supabase]      <N> divergências
  - public.<table> — sem migration
    > sugestão: ...

[N8N]           <N> divergências
  - <id> "<name>" — sem export local
    > sugestão: ...

Resumo: <total> itens precisando atenção.
```

## Regras

- READ-ONLY. Não roda migrations, não faz push, não atualiza nada.
- Se uma das fontes (Vercel/Supabase/N8N) estiver inacessível, reporte a falha mas continue com as demais.
