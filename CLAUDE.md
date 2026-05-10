# Singulare — Project Context

## Quem / O que

Luiz Flavio constrói o **Singulare** (rebrand de Vivassit), um SaaS B2B multi-tenant para clínicas no Brasil: agendamento via WhatsApp com agente IA, painel administrativo, integrações de marketing e onboarding sem código.

## Stack

- **Frontend / API**: Next.js 14 App Router (`app/app/`), TypeScript, Tailwind
- **Banco**: Supabase Postgres (project id `qwyxacfgoqlskidwzdxe`) — Auth via SES (us-east-1)
- **Hospedagem**: Vercel — projeto `vivassit` (id `prj_HTYSHEBUacKN8hGBeGP4XugfeIz9`), team `team_bt7LVA71g3zN0Brw0PV1jHk7`
- **Automação**: N8N self-hosted em `https://n8n.singulare.org` — workflow principal P03 Master Secretária IA (`EaZNHoaKhq0yJsiS`); listener Evolution `0LdgQcogHwx6KVSb`
- **WhatsApp**: Evolution API self-hosted (Meta Cloud API descartada por custo)
- **Atendimento humano**: Chatwoot self-hosted em `chatwoot.singulare.org` (account 1, inbox 3)
- **Multi-tenant**: `lib/auth-tenant.ts` resolve via cookie `singulare_active_tenant`; membership em `tenant_members` (CASCADE)

## Regras invioláveis

1. **Deploy é via `git push origin main`** → Vercel auto-deploya. Nunca rodar `vercel deploy`, `vercel --prod` ou similar direto.
2. **Env vars NUNCA em git**. Configurar exclusivamente no Vercel dashboard. Nada de `.env` commitado.
3. **Nunca rodar `npm run build` localmente** sem motivo concreto — o Vercel é a fonte da verdade do build.
4. **Nunca force-push em `main`**. Nunca `--no-verify`, `--no-gpg-sign`. Nunca amend de commits já no remoto.
5. **Sempre responder em português brasileiro**. Sem emojis (nem em código, nem em prosa, nem em commits).
6. **Preferir editar a criar** arquivo. Não criar `.md` de documentação proativamente — só quando pedido explicitamente.
7. **Design Apple / Linear / Vercel**: minimalismo refinado, hairlines (`1px solid` borders sutis), accent violet `#6E56CF`, micro-interações sutis (tilt leve, fade), tipografia generosa.
8. **Migrations destrutivas exigem confirmação** humana antes de aplicar (drop/truncate/alter type incompatível).
9. **`git add` específico por arquivo** — nunca `git add .` ou `git add -A` (risco de subir `.env`, exports, dumps).

## Convenções de código

- App Router em `app/app/` (rotas, pages, API handlers)
- Helpers e clientes em `app/lib/` (auth-tenant, supabase, evolution, chatwoot)
- Componentes em `app/components/`
- Scripts pontuais em `app/scripts/` (TS/MJS) ou `scripts/` na raiz (shell, infra)
- Migrations Supabase em `supabase/migrations/` no formato `YYYYMMDDHHMMSS_slug.sql`
- Workflows N8N exportados em `n8n/workflows/<id>-<slug>.json`

## Workflow padrão de deploy

1. Editar código com `Edit`/`Write`
2. `git status` — revisar arquivos modificados/untracked
3. `git diff` nos arquivos relevantes
4. `git add <arquivos específicos>`
5. `git commit -m "<mensagem PT-BR no estilo do repo>"` (ver `git log` recente)
6. `git push origin main`
7. Acompanhar build via Vercel MCP (`list_deployments` → `get_deployment_build_logs` se falhar)

## Onde olhar para contexto

- **`docs/INTEGRATIONS.md`** — mapa vivo: URLs, OAuth URIs, webhooks, env vars, endpoints, schema, cron. Ler antes de qualquer integração nova.
- **Memory system** (`~/.claude/projects/-Users-luizflavioxavierdesa-Desktop-vivassit/memory/MEMORY.md`) — preferências, decisões arquiteturais persistidas
- **`.claude/agents/`** — sub-agents especializados deste projeto

## Comandos slash

- `/deploy` — pipeline padrão git push → tail Vercel build
- `/migrate` — gerar e aplicar migration Supabase com checks
- `/sync-n8n` — exportar workflows ativos do N8N para `n8n/workflows/`
- `/onboard-tenant` — fluxo guiado de criação de novo tenant + clínica
- `/drift` — comparar `docs/INTEGRATIONS.md` com estado real (Supabase, Vercel, N8N)

## Sub-agents

- **`singulare-db`** — schema Supabase, migrations, queries, types
- **`singulare-n8n`** — workflows N8N, credenciais, execuções, validação
- **`singulare-deploy`** — git push → Vercel pipeline, build logs, rollback por SHA

## Branch / worktrees

- Branch padrão: `main`
- Worktrees vivem em `.claude/worktrees/` (isolamento por feature)
