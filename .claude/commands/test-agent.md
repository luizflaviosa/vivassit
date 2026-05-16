---
description: Roda bateria E2E do agente IA (Master Secretária). Aceita ID (C15), categoria (falha-tools) ou vazio (todos)
argument-hint: [C01|C15|falha-tools|adversarial|novo-paciente|tipos-mensagem|vazio=todos]
allowed-tools: Bash, Read
---

# /test-agent — Bateria E2E do agente Master Secretária

Roda a suite automatizada que dispara cenários reais no workflow P01 do N8N e avalia se o agente IA respondeu adequadamente.

Documentação completa em [docs/agent-test-matrix.md](docs/agent-test-matrix.md).

## Passos

1. **Verificar argumento** — `$ARGUMENTS` pode ser:
   - Vazio → roda toda a suite
   - `C\d+` (ex: `C15`) → roda 1 cenário específico
   - Nome de categoria (ex: `falha-tools`, `novo-paciente`, `adversarial`, `tipos-mensagem`) → roda categoria via `--grep`
   - Múltiplos IDs separados por espaço (ex: `C15 C16`) → roda os dois

2. **Pré-checks rápidos**:
   - Confirme que `app/.env.local` existe com `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. Se faltar, pare e avise.
   - NÃO rode `npm install` — o projeto já tá com as deps.

3. **Executar** via Bash (foreground, timeout generoso):
   - Se `$ARGUMENTS` vazio: `cd app && npm run test:agent`
   - Se for ID(s): `cd app && npm run test:agent -- $ARGUMENTS`
   - Se for categoria (qualquer string não-ID): `cd app && npm run test:agent -- --grep $ARGUMENTS`
   - Tempo esperado: ~15-60s por cenário (LLM judge demora ~3s; cada turn do agente ~10-20s)
   - Defina timeout do Bash em 600000ms (10 min) pra rodadas grandes

4. **Ler relatório**:
   - O runner escreve em `docs/agent-test-matrix-history/<timestamp>.md`
   - Identifique o arquivo mais recente: `ls -t docs/agent-test-matrix-history/ | head -1`
   - Leia o relatório com Read

5. **Reportar pro usuário em PT-BR** sem emoji, estruturado:
   - Resumo: `X/Y PASS` no topo
   - Pra cada FAIL: ID, título, assertion que falhou, motivo
   - Pra cada PASS: 1 linha com ID + título (não detalhar)
   - Citar o caminho do relatório com link markdown pra ele abrir se quiser detalhes
   - Se algum cenário deu erro (não FAIL, mas crash): mostrar o `error` e sugerir causa provável

6. **Não tomar ação corretiva automática** — só reportar. Se o usuário quiser corrigir, ele pede.

## Quando NÃO usar

- Skill é para rodar a suite. NÃO use pra criar cenários novos, modificar a matriz ou fixar bugs — esses são tasks separadas.
- Não rode em loop autonomamente sem o usuário pedir.

## Comandos relacionados

- `/migrate` — aplicar migration nova (ex: se for adicionar coluna que algum cenário precisa)
- `/sync-n8n` — exportar workflows N8N (útil antes de patch no agente)
- `/drift` — checar drift entre git e infra
