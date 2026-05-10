---
description: Commit changes + push to main + tail Vercel build until done
argument-hint: [optional commit message]
allowed-tools: Bash, Read, Agent
---

# /deploy — Singulare deploy workflow

Deploy completo: commit -> push -> tail Vercel até READY/ERROR.

## Passos

1. **Diagnóstico** — rode `git status` (sem `-uall`) e `git diff --stat` e mostre o estado atual ao usuário.

2. **Mensagem de commit**:
   - Se `$ARGUMENTS` não estiver vazio, use-o como mensagem: `Commit message: $ARGUMENTS`.
   - Se vazio, peça uma mensagem curta ao usuário (não invente).

3. **Stage seletivo** — use `git add <arquivos específicos>`. NUNCA `git add .` ou `git add -A` (evita pegar `.env`, exports, dumps, e os muitos untracked do repo).

4. **Commit** com HEREDOC, incluindo a linha de coautoria padrão:

   ```bash
   git commit -m "$(cat <<'EOF'
   <mensagem aqui>

   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
   EOF
   )"
   ```

5. **Push** — `git push origin main`. Pegue o SHA com `git rev-parse HEAD`.

6. **Tail do build Vercel** — invoque o sub-agent `singulare-deploy` com a instrução:
   > "Acompanhe o deploy do projeto `vivassit` no Vercel para o commit `<SHA>` na branch `main`. Use `mcp__claude_ai_Vercel__list_deployments` para achar o deployment, depois faça polling com `get_deployment` até o estado virar READY ou ERROR. Reporte intermediariamente a cada mudança de fase (BUILDING -> DEPLOYING -> ...)."

7. **Resultado**:
   - Se **ERROR**: chame `mcp__claude_ai_Vercel__get_deployment_build_logs`, sumarize o erro (linhas relevantes, não dump cru), pare aqui e devolva ao usuário.
   - Se **READY**: confirme a URL final de produção (`https://app.singulare.org` + URL do deployment) e devolva o link.

## Regras

- Nunca use `--no-verify` nem pula hooks.
- Nunca commita arquivos suspeitos de segredos (`.env*`, `credentials*`, `*-token*`).
- Nunca faz `--amend`. Se hook falhar, corrija e crie NOVO commit.
- Nunca faz `git push --force` em `main`.
