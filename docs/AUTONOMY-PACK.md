# Singulare Autonomy Pack v1

Setup one-shot para reduzir intervenção manual (aprovações, terminal, UI). Versionado no git, reproduzível, auditável.

> **Filosofia**: tudo que dá pra ser código vira código. Tudo que precisa de risco humano vira `ask` (prompt). Nada de credencial em git ou em transcripts de Claude.

---

## O que tem dentro

| Camada | Onde vive | O que faz |
|---|---|---|
| **Contexto** | [CLAUDE.md](../CLAUDE.md) | Regras invioláveis (deploy via push, env vars off-git, design refs, PT-BR, etc.) — economiza re-explicação a cada sessão |
| **Sub-agents** | [.claude/agents/](../.claude/agents/) | `singulare-db`, `singulare-n8n`, `singulare-deploy` — escopo isolado e ferramentas específicas |
| **Slash commands** | [.claude/commands/](../.claude/commands/) | `/deploy`, `/migrate`, `/sync-n8n`, `/onboard-tenant`, `/drift` |
| **Scripts** | [scripts/automation/](../scripts/automation/) | `n8n-sync`, `vercel-env-sync`, `supabase-baseline`, `chatwoot-onboard`, `drift-check` (default `--dry-run`) |
| **Hooks + permissões** | [.claude/settings.json](../.claude/settings.json) | SessionStart printa lembrete; permissions safe-by-default versionadas |
| **Permissões locais** | `.claude/settings.local.json` | Allowlist generosa para `npm/git/curl/MCP` — JWT N8N **removido** desta versão |

Diretórios novos (vazios, com `.gitkeep`):

- [n8n/workflows/](../n8n/workflows/) — destino de `/sync-n8n pull`
- [supabase/migrations/](../supabase/migrations/) — destino de `/migrate` e `supabase-baseline.sh`

---

## Ativação — checklist

### 1. Aplicar a versão sanitizada de `settings.local.json` (ação manual sua)

Por segurança o sistema do Claude bloqueou eu mesmo sobrescrever esse arquivo (auto-grant de permissões = self-modification protegida). Backup do estado anterior está em `.claude/settings.local.json.backup-<timestamp>`. A nova versão foi escrita como `.proposed`.

```bash
# Compare se quiser
diff .claude/settings.local.json .claude/settings.local.json.proposed | head -200

# Aplique
mv .claude/settings.local.json.proposed .claude/settings.local.json

# (opcional, depois de confirmar que tudo funciona)
rm .claude/settings.local.json.backup-*
```

**O que mudou:**
- ~30 entradas com JWT N8N inline (`eyJhbGci...`) **removidas** — vazavam em transcripts
- ~140 entradas duplicadas/stale (curl com URL hardcoded, comandos one-off antigos) **consolidadas em padrões genéricos**
- Adicionado bloco `ask` para operações destrutivas (`git push --force`, `rm -rf`, `vercel deploy`, `n8n_delete_workflow`, etc.) — vão pedir confirmação em vez de bloquear ou auto-permitir
- Total caiu de ~175 para ~75 regras, cobrindo o mesmo conjunto de casos

### 2. Garantir credenciais em `.env.local`

Os scripts em `scripts/automation/` lêem de `process.env`. Para rodar standalone:

```bash
# .env.local precisa ter (no mínimo) estas chaves:
N8N_API_KEY=...                  # JWT antigo está nos backups; pegue do n8n UI Settings → API
N8N_BASE_URL=https://n8n.singulare.org   # opcional, é default
CHATWOOT_API_TOKEN=...           # gerar em chatwoot.singulare.org → Profile Settings → API access
CHATWOOT_BASE_URL=https://chatwoot.singulare.org   # opcional
SUPABASE_DB_URL=...              # para supabase-baseline.sh — pegar em Supabase Studio → Project Settings → Database → Connection string
```

Para rodar com env file no Node 20+:

```bash
node --env-file=.env.local scripts/automation/n8n-sync.mjs list
```

### 3. Rotacionar a JWT N8N (recomendado, opcional)

A JWT antiga (`eyJhbGci...sub: "103f46e2..."`) ficou no `git log` deste setup e nos backups. Se aceitável, rotacione:

1. N8N UI → Settings → API → revogar key antiga
2. Criar nova
3. Atualizar `N8N_API_KEY` em `.env.local` e em qualquer credencial Vercel/Supabase que use

### 4. Commit do pack

```bash
git status   # vai mostrar todos os arquivos novos
git add CLAUDE.md .claude/settings.json .claude/agents/ .claude/commands/ \
        scripts/automation/ docs/AUTONOMY-PACK.md \
        n8n/workflows/.gitkeep supabase/migrations/.gitkeep .gitignore
git commit -m "feat(autonomy): pack v1 — CLAUDE.md, sub-agents, slash commands, automation scripts"
git push origin main
```

> Note: `.claude/settings.local.json` (e `.proposed`, `.backup-*`) estão no `.gitignore` — só você terá. `.claude/settings.json` (project-level) vai pro git e fica disponível para qualquer sessão futura nesta máquina.

---

## Como acessar / usar

### Pelo Claude Code CLI (terminal)

Reabra qualquer sessão neste diretório. Você verá:

```
Singulare Autonomy Pack v1 — slash: /deploy /migrate /sync-n8n /onboard-tenant /drift · agents: singulare-db singulare-n8n singulare-deploy · scripts: scripts/automation/
```

(é o hook `SessionStart`)

Use os slash commands diretamente:

```
/deploy fix(painel): corrige link do dashboard
/migrate add_doctor_calendar_id_index
/sync-n8n pull
/sync-n8n diff EaZNHoaKhq0yJsiS
/onboard-tenant clinica-x "Clínica X" admin@clinicax.com.br
/drift
```

### Pelo Claude.ai web app

A app web do Claude (claude.ai) **não lê** os arquivos locais de `.claude/`. Mas você pode replicar o pacote via prompt + o padrão de **dispatching de sub-agents em paralelo**.

**Receita para usar via Claude.ai:**

1. **No primeiro turno da conversa**, cole o conteúdo de `CLAUDE.md` para estabelecer contexto (ou anexe o arquivo).

2. **Para tarefas complexas**, peça explicitamente o dispatch paralelo. Exemplo:

   > "Quero deployar essas 3 mudanças: (a) atualizar página /precos, (b) criar migration `add_index_x`, (c) sincronizar workflow N8N P03. Faça em paralelo: dispatch 3 sub-tasks (frontend, db, n8n), então me reporte cada uma."

3. **Para dar acesso a Vercel/Supabase/N8N**, certifique-se que os MCP integrados estão habilitados na conta Claude.ai (Settings → Integrations).

4. **Os scripts em `scripts/automation/`** podem ser rodados via Claude.ai se você tiver Claude Code conectado ao mesmo workspace, ou copiando para o ambiente onde rodar.

5. **Workflow recomendado para tarefas longas no Claude.ai**:
   - Anexe `CLAUDE.md` + `docs/INTEGRATIONS.md` no primeiro turno
   - Diga: "estou usando o setup do Singulare descrito acima, com slash commands `/deploy /migrate /sync-n8n /onboard-tenant /drift` e sub-agents `singulare-db`, `singulare-n8n`, `singulare-deploy`. Para esta tarefa quero que você simule o behavior do `/<comando>` e use dispatching paralelo onde fizer sentido."
   - O Claude vai seguir as regras do CLAUDE.md mesmo sem acesso direto aos arquivos `.claude/`

### Pelos sub-agents (Claude Code via Agent tool)

Em qualquer prompt, você pode pedir:

> "Use o sub-agent `singulare-db` para listar tabelas relacionadas a marketing e gerar uma migration que adiciona índice em `tenant_market_keywords.tenant_id`."

O Claude vai despachar o sub-agent com a ferramenta apropriada e contexto reduzido.

---

## Próximos passos sugeridos (não fiz, são suas decisões)

### A. Cron Vercel para `renew-google-watches`

Gap conhecido: Google Calendar watch channels expiram em 7 dias. Patch sugerido em [app/vercel.json](../app/vercel.json):

```json
{
  "crons": [
    { "path": "/api/interno/region-demand-refresh", "schedule": "0 3 1 * *" },
    { "path": "/api/interno/market-trends-refresh", "schedule": "30 3 1 * *" },
    { "path": "/api/interno/renew-google-watches", "schedule": "0 4 */6 * *" }
  ]
}
```

**Antes de aplicar**: confirme que `/api/interno/renew-google-watches/route.ts` existe e aceita o header `Authorization: Bearer ${CRON_SECRET}`. Se não existir, criar uma rota interna que chama `lib/google-calendar.ts setup-watches` para todos os doctors ativos.

### B. Baseline Supabase

```bash
./scripts/automation/supabase-baseline.sh
git add supabase/migrations/
git commit -m "chore(db): baseline schema do Supabase para versionamento"
```

Requer Supabase CLI instalado: `brew install supabase/tap/supabase`. Após esse baseline, **toda mudança de schema** deveria ser nova migration via `/migrate`.

### C. Primeiro pull dos workflows N8N

```bash
node --env-file=.env.local scripts/automation/n8n-sync.mjs list
node --env-file=.env.local scripts/automation/n8n-sync.mjs pull
git add n8n/workflows/
git commit -m "chore(n8n): snapshot inicial de workflows"
```

### D. Scheduled agents (Claude.ai cron remoto)

A Claude.ai oferece "routines" — agents que rodam em horário fixo. Útil pra:

- `/drift` diário às 8h da manhã (relatório por email)
- "Cleanup branches mergeadas" semanal aos domingos
- "Verificar status DataForSEO + Google Ads" mensal

Configurar via slash skill `/schedule` no Claude.ai (não é local — é um serviço remoto da Anthropic).

### E. Hardening adicional

- Mover `N8N_API_KEY` e `CHATWOOT_API_TOKEN` para macOS Keychain via `security add-generic-password` e wrapper script
- `.envrc` (direnv) para auto-carregar `.env.local` ao entrar no diretório
- Pre-commit hook que valida que nenhum arquivo staged tem `eyJhbG...` ou outras assinaturas de credencial

---

## Manutenção

- **Trocou de stack/integração?** Atualize [CLAUDE.md](../CLAUDE.md) e [docs/INTEGRATIONS.md](INTEGRATIONS.md). Os sub-agents lêem CLAUDE.md por padrão.
- **Novo workflow N8N entrou em produção?** Rode `/sync-n8n pull` e commite.
- **Schema mudou?** Use `/migrate` em vez de tocar via Studio.
- **Nova env var no Vercel?** Documente em `docs/INTEGRATIONS.md` seção "Env vars" — `/drift` vai cobrar.

---

_Setup criado em 2026-05-09. Backup do `settings.local.json` original em `.claude/settings.local.json.backup-20260510-004903`._
