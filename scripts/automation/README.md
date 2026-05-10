# scripts/automation

Scripts utilitários para sincronização e drift-check entre git e sistemas externos
(N8N, Vercel, Supabase, Chatwoot). Todos seguem o padrão `--dry-run` (default) /
`--apply` para ações destrutivas; leituras são sempre safe.

Carregar env: `node --env-file=../../.env.local <script>.mjs ...` (Node 20+).

## Scripts

| Script | O que faz | Comandos |
|---|---|---|
| `n8n-sync.mjs` | Sincroniza workflows N8N ↔ `n8n/workflows/` | `pull` \| `push <id>` \| `diff <id>` \| `list` |
| `vercel-env-sync.mjs` | Compara env vars Vercel ↔ `.env.local` | `diff` \| `pull` \| `push <NAME> <VALUE>` |
| `supabase-baseline.sh` | Gera baseline migration do schema atual | `./supabase-baseline.sh` |
| `chatwoot-onboard.mjs` | Cria inbox API no Chatwoot pra novo tenant | `--slug=<s> --name=<n>` |
| `drift-check.mjs` | Relatório read-only de divergências (Vercel/Supabase/N8N) | `--report` |

## Env vars necessárias

- `N8N_API_KEY` — token Personal API N8N (n8n-sync, drift-check)
- `CHATWOOT_API_TOKEN` — token de plataforma/usuário Chatwoot (chatwoot-onboard)
- `SUPABASE_DB_URL` — opcional, usado como fallback pelo baseline.sh
- Vercel CLI deve estar autenticado (`vercel login`) e o projeto linkado.

## Convenções

- `--dry-run` (default em scripts mutativos): mostra o que seria feito.
- `--apply`: executa de fato. Operações sensíveis pedem confirmação.
- Nunca printam valores de credenciais — apenas nomes/contagens.
- ES modules (`.mjs`), Node 18+.
- Idempotentes: rodar duas vezes não estraga nada.

## Defaults

- N8N base URL: `https://n8n.singulare.org`
- Chatwoot base URL: `https://chatwoot.singulare.org`, account_id `1`
- Vercel scope: `team_bt7LVA71g3zN0Brw0PV1jHk7`, project `prj_HTYSHEBUacKN8hGBeGP4XugfeIz9`
- Supabase project ref: `qwyxacfgoqlskidwzdxe`
