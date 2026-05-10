---
description: Sync N8N workflows ↔ git (pull|push|diff)
argument-hint: [pull|push|diff] [workflow_id?]
allowed-tools: Agent, Bash, Read, Edit
---

# /sync-n8n — Sincroniza workflows N8N com o repo

Mantém `n8n/workflows/<id>-<slug>.json` em sincronia com `https://n8n.singulare.org`.

## Parse de argumentos

`$ARGUMENTS` tem dois tokens separados por espaço:

- `<modo>` — `pull` | `push` | `diff` (default: `pull` se vazio)
- `<workflow_id?>` — opcional, escopa a operação a um único workflow

## Comportamento por modo

### `pull` (default)
Exporta TODOS os workflows ativos da N8N para `n8n/workflows/`.

1. Verifique se `scripts/automation/n8n-sync.mjs` existe (`!ls scripts/automation/n8n-sync.mjs`).
2. Se existir: rode `node scripts/automation/n8n-sync.mjs pull` (com `--id=<workflow_id>` se fornecido).
3. Se NÃO existir: delegue ao sub-agent `singulare-n8n`:
   > Liste workflows ativos via `mcp__n8n-mcp__n8n_list_workflows` (filtro `active=true`). Para cada um, pegue o JSON com `mcp__n8n-mcp__n8n_get_workflow` e salve em `n8n/workflows/<id>-<slug-do-name>.json` (slug = name lowercased, espaços -> hífen, sem chars especiais). Liste arquivos criados/atualizados ao fim.

### `push`
Sobe arquivo local para a N8N. **Exige `<workflow_id>`** — se faltar, pare e peça.

1. Encontre o arquivo: `!ls n8n/workflows/<workflow_id>-*.json`.
2. Leia o JSON, mostre ao usuário um resumo (nome, # de nodes, conexões).
3. **PEÇA CONFIRMAÇÃO EXPLÍCITA** antes de aplicar.
4. Após confirmar: `mcp__n8n-mcp__n8n_update_full_workflow` com o payload completo.
5. Reporte sucesso/erro.

### `diff`
Compara local vs remoto sem alterar nada.

1. Se `<workflow_id>` fornecido: diff só desse. Senão: itera por todos arquivos em `n8n/workflows/`.
2. Para cada um: leia o local, pegue o remoto via `mcp__n8n-mcp__n8n_get_workflow`, normalize ambos (ordene chaves, remova campos voláteis tipo `updatedAt`, `versionId`) e mostre `diff -u` ou um resumo estruturado das diferenças.
3. NÃO modifica nada.

## Regras

- SEMPRE liste o que vai mudar antes de aplicar (em `push`).
- Workflows com credenciais embarcadas: NÃO commit credenciais no JSON — N8N já referencia por ID.
- Se o script `scripts/automation/n8n-sync.mjs` for criado depois, ele tem prioridade sobre o caminho via Agent.
