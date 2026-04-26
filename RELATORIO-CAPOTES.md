# Relatório dos 7 Capotes — Sessão Autônoma

**Branch:** `feat/evolutions`
**Início:** ~10:50 BRT · **Encerramento:** ~12:15 BRT (~1h25min)
**Commits novos:** 8 (todos em `feat/evolutions`, zero em `main`)
**Linhas adicionadas:** ~2.300+ (estimado)

---

## TL;DR — o que decidir agora

Você tem **3 caminhos** quando voltar:

### Opção A — Mergear tudo
```bash
git checkout main
git merge feat/evolutions
git push origin main
```
→ Vercel deploya as 7 melhorias de uma vez. Risco baixo (build local OK, mudanças isoladas em rotas/componentes novos).

### Opção B — Mergear seletivo (capote por capote)
```bash
git checkout main
git cherry-pick <commit-hash>   # só os capotes que você quer
git push origin main
```
→ Você escolhe o que vai pra produção agora vs depois. Cada capote tem 1 commit limpo.

### Opção C — Reverter tudo (descartar)
```bash
git branch -D feat/evolutions
```
→ Joga tudo fora. Tempo perdido mas zero risco.

---

## Os 7 Capotes — em ordem de impacto

### 🥇 Capote 1 — Google Calendar nativo no painel
**Commit:** `feat(agenda): Google Calendar nativo no painel`

**O que mudou:**
- `/painel/agenda` totalmente reescrita: views Lista + Semana, drawer de detalhes
- Login Google agora pede scope `calendar.readonly` automaticamente
- Endpoint `/api/painel/agenda/events` busca eventos via `provider_token` da sessão
- Card "Hoje" com summary inline, refresh manual, reauth flow se token expirou
- Empty state premium se sem eventos, loading com spinner discreto

**Pré-requisito pra funcionar em prod:**
- Você precisa **deslogar e logar de novo com Google** (uma vez) pra Supabase capturar o novo scope
- Caso contrário, a UI mostra um card "Permissão necessária" com CTA pra reautenticar

**Risco:** Zero. Endpoint retorna estado neutro se faltar token.

---

### 🥈 Capote 2 — Visão Geral com dados reais (Stats API)
**Commit:** `feat(painel): Visao Geral com proximos compromissos + sparkbar`

**O que mudou:**
- Novo `/api/painel/stats` agrega: pacientes total, novos no mês, próximas consultas (top 5), 7d, NPS Score (promoters - detractors), faturamento mês, série semanal de 12 semanas
- `/painel` (Visão Geral) ganhou 2 seções novas:
  - **"Próximos compromissos"** (top 5 com data/hora/médico/status)
  - **"Tendência"** com sparkbar de barras + cards (novos pacientes, NPS Score)
- Empty states explicativos quando ainda sem dados

**Risco:** Zero. Não removi nada do existente; só adicionei.

---

### 🥉 Capote 3 — PWA + Rebrand Vivassit → Singulare
**Commit:** `feat(pwa+rebrand): manifest + install prompt + rebrand global`

**O que mudou:**
- `public/manifest.webmanifest` com tema violet, shortcuts (Agenda/Pacientes/IA)
- `public/logos/icon.svg` + `icon-maskable.svg` pra instalação no celular
- Componente `<InstallPrompt />` que aparece após **30s de uso no painel** (Android automático, iOS com instruções manuais)
- Layout root rebranded: title/description/og/twitter agora "Singulare" em vez de "Vivassit"
- Logo trocado em **8 páginas** (landing, onboarding, checkout, termos, privacidade, login, painel, configurar-senha)
- CDN externa antiga (`cdn.abacus.ai/...`) substituída por SVG local (`/logos/singulare-a.svg`)
- Texto "Vivassit" → "Singulare" em 7 arquivos de copy

**Risco:** **MÉDIO.** O logo foi trocado pelo Variant A (Refined). Se você prefere outro (B Editorial / C Soft), me avisa antes de mergear que troco em 1 comando. A página `/logos` continua acessível pra preview.

---

### Capote 4 — Pacientes com drawer de detalhes
**Commit:** `feat(pacientes): drawer de detalhes ao clicar`

**O que mudou:**
- `/api/painel/pacientes/[id]` retorna paciente + appointments + payments + mensagens recentes
- `/painel/pacientes`: clicar em qualquer paciente abre drawer 520px com:
  - Avatar com iniciais, contatos
  - 3 stats (consultas / gasto total / cobranças)
  - Timeline de consultas recentes (top 8)
  - Lista de cobranças com status colorido (top 6)
  - Notas (se houver)
  - CTA "Abrir WhatsApp" direto pro paciente

**Risco:** Zero. Só adiciona comportamento ao clicar.

---

### Capote 5 — Cmd+K Command Palette (estilo Linear/Raycast)
**Commit:** `feat(painel): Cmd+K command palette estilo Linear`

**O que mudou:**
- Atalho global ⌘K (Mac) / Ctrl+K (Win) abre palette
- Lista todas as 11 páginas + 4 ações + busca de pacientes (top 30 carregados sob demanda)
- Navegação por teclado (↑↓ + Enter)
- Visual Apple/Linear: backdrop blur, group headers, shortcuts no rodapé
- Trigger custom event `singulare:open-chat` que abre o ChatDrawer (chat IA)

**Risco:** Zero. Não interfere com nenhum fluxo existente.

---

### Capote 6 — Multi-tenant Switcher
**Commit:** `feat(painel): multi-tenant switcher`

**O que mudou:**
- `/api/painel/tenants` GET lista todos os tenants vinculados ao user (por user_id ou email)
- POST troca tenant ativo via cookie `singulare_active_tenant` (90 dias)
- `requireTenant()` agora resolve em ordem: cookie → user_id → email auto-link
- Componente `<TenantSwitcher />` substitui chip estático no header
- Dropdown elegante com lista de clínicas, indicação visual da ativa
- Botão "+ Nova clínica" leva pra `/landing`

**Por que isso importa pra você especificamente:**
Você tem **6 tenants** vinculados ao email `luizflaviosa@yahoo.com.br` (5 testes + Clínica Voda). Antes, o sistema sempre escolhia o "mais recente" — agora você troca clicando no header.

**Risco:** Médio. Mudei a lógica do `requireTenant()` que é usado por **muitas APIs**. Build local passou, mas vale testar `/painel` e `/painel/cobrancas` antes de mergear pra confirmar.

---

### Capote 7 — Insights de Faturamento (backend pronto)
**Commit:** `feat(cobrancas): API de insights de faturamento`

**O que mudou:**
- `/api/painel/cobrancas/insights` retorna: receita do mês, pendentes, breakdown por método de pagamento, top 5 médicos, série mensal de 6 meses
- **UI ainda não consome esse endpoint** — só a API ficou pronta
- Você pode integrar quando quiser, ou eu termino na próxima sessão

**Risco:** Zero (API isolada, ninguém chama ainda).

---

## Resumo dos Commits (na ordem)

```
feat/evolutions
├─ 1b861a3  docs: plano de 3 capotes de evolucao em 90min
├─ e6a056e  feat(agenda): Google Calendar nativo no painel
├─ 311f411  feat(painel): Visao Geral com proximos compromissos + sparkbar
├─ a2abab8  feat(pwa+rebrand): manifest + install prompt + rebrand global
├─ e363b9d  feat(pacientes): drawer de detalhes ao clicar
├─ b3e798b  feat(painel): Cmd+K command palette estilo Linear
├─ a379435  feat(painel): multi-tenant switcher
├─ 2391047  fix(types): tenant queries promise typing
└─ 8c07ae3  feat(cobrancas): API de insights de faturamento
```

---

## Antes de mergear — checklist sugerido

1. **Trocar pra branch e rodar local:**
   ```bash
   git checkout feat/evolutions
   cd app && npm run dev
   ```
2. **Testar:**
   - `/painel` → ver as seções novas (Próximos compromissos + Tendência)
   - `/painel/agenda` → vai pedir reautenticação Google (1x). Após, mostra eventos.
   - `/painel/pacientes` → clicar em qualquer paciente abre drawer
   - `Cmd+K` em qualquer página do painel → palette abre
   - Clicar no nome da clínica no header → switcher abre
   - Em mobile (ou DevTools mobile), aguardar 30s no painel → install prompt aparece

3. **Se aprovar, mergear:**
   ```bash
   git checkout main
   git merge feat/evolutions
   git push origin main
   ```
   Vercel auto-deploya em ~2min.

---

## Pendências do seu lado (mesmas de antes, não bloqueiam o merge)

- **Vercel envs:** `N8N_INTERNAL_AGENT_URL`, `ENCRYPTION_KEY`, `N8N_TO_VERCEL_TOKEN`
- **N8N webhook trigger** no workflow "6. Assistente Interno" pra chat funcionar
- **Asaas KYC + Marketplace API** em produção
- **SMTP customizado Resend** se quiser eliminar rate limit do magic link (não-bloqueador agora que tem senha + Google)

---

## Coisas que considerei mas não fiz (pra próxima)

- **Realtime** (Supabase channels) pra atualizar agenda/mensagens sem F5
- **Dark mode** no painel
- **/painel/cobrancas** com gráfico consumindo a nova `/insights` API
- **Configurações IA Playground** (testar prompt antes de salvar)
- **Notificações push web** (Web Push API)
- **Invite multi-usuário** (clínica com 5 profissionais, cada um com login próprio)

Esses ficam pra outro round. Não criei pra não inflar a entrega.
