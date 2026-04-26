# Plano de Evoluções — 90 min autônomos

**Data:** 2026-04-26
**Branch:** `feat/evolutions` (não tocar `main` sem aprovação humana)
**Modo:** Solo / autônomo

---

## Problem Statement
Tenho ~90 min para evoluir Singulare sem regressão. Trabalho atual já útil (chat drawer + senha + logos)
está em commit local na `main`, aguardando approval de push. Posso continuar criando valor em
branch separada, com 3 camadas (capotes) cada uma testável e mergeável de forma independente.

## Users & Stakeholders
- **Admin de clínica** (médico/dentista/etc): usa /painel todo dia, precisa ver agenda, pacientes, faturamento
- **Profissional individual** (consultório próprio): subset menor das features, foco em agenda + IA
- **Eu (próximas sessões)**: precisa código limpo, branch organizada, fácil de mergear

## Success Criteria
1. 3 capotes prontos, em commits separados, cada um buildando sem erro
2. Branch `feat/evolutions` testável local via `npm run dev` por capote
3. Relatório claro com **o que mergear** vs **o que descartar/iterar**
4. Zero modificação na `main` ou no que já está em produção

## Constraints
- **Tempo:** 90 min total. Cada capote ~25-30 min. Buffer pra build/push/relatório.
- **Auth blockada pra push em main**: não pode pushar nada (perfeito, alinhado com escopo)
- **Não pode tocar Supabase prod schema** (DDL) sem aprovação. Inserts/updates de teste OK.
- **Não pode adicionar env var no Vercel** (fora da minha alçada)

## Assumptions
- Build estará verde nos 3 capotes (preciso validar)
- Usuário valoriza polish premium (Apple/Linear/Vercel) sobre features genéricas
- Google OAuth provider_token tá disponível na sessão Supabase (vou confirmar)
- Tabelas existentes (`tenants`, `tenant_doctors`, `appointments`?) suportam dashboards reais

## Pain Points
- Várias páginas do /painel são stubs ("Em breve") → mata sensação de produto pronto
- Mobile do painel é desktop encolhido → não native
- Sem PWA → não dá pra instalar no celular como app
- Logo da CDN antiga (Vivassit) ainda em todo lugar → marca confusa

---

## Os 3 Capotes

### Capote 1 — Google Calendar nativo (~30 min)
**Por quê:** Você pediu explicitamente, com entusiasmo. É o feature de maior wow imediato.

**Entregáveis:**
- [ ] OAuth do Google ganhando scope `calendar.readonly` na próxima vez que logar
- [ ] `/api/painel/agenda/events` busca eventos do Google Calendar usando `provider_token`
- [ ] `/painel/agenda` substituída por UI de calendário FullCalendar-style (sem dep externa pesada — vou implementar minimal próprio)
- [ ] Empty state premium se sem eventos
- [ ] Filtro por médico (se a clínica tem múltiplos)

### Capote 2 — Painel real (Visão Geral com dados de verdade) (~25 min)
**Por quê:** Hoje é tudo placeholder. Métricas reais transformam de demo em produto.

**Entregáveis:**
- [ ] `/api/painel/stats` retorna: total pacientes, consultas próximas (7d), faturamento mês, NPS médio
- [ ] `/painel` (Visão Geral) com 4 stats cards animados + gráfico simples de últimos 30d
- [ ] Skeleton states (não loading spinner genérico)
- [ ] Empty states bonitos (nenhum paciente ainda? mostra CTA pra cadastrar)

### Capote 3 — PWA + Mobile polish + Logo Singulare (~30 min)
**Por quê:** Rebrand Vivassit→Singulare é cosmético mas crítico. PWA permite "instalar app" no celular.

**Entregáveis:**
- [ ] `manifest.webmanifest` com tema violet, name "Singulare"
- [ ] `apple-touch-icon.png` + `favicon.ico` gerados a partir da Variant A do logo (default escolhido — usuário pode trocar)
- [ ] Componente `<InstallPrompt />` que aparece em mobile depois de 30s de uso
- [ ] Substituição global do logo Vivassit (CDN antiga) → SVG local Singulare em todas as 9 páginas
- [ ] Ajustes de mobile no chat drawer + header do painel
- [ ] Title da aba: "Singulare · Painel"

---

## Estratégia de execução

```
0:00 - 0:05   Verificar build atual passou + criar branch feat/evolutions
0:05 - 0:35   Capote 1 (Google Calendar) → commit
0:35 - 1:00   Capote 2 (Stats reais) → commit
1:00 - 1:25   Capote 3 (PWA + logo) → commit
1:25 - 1:30   Build final + relatório
```

---

## Open Questions (decido sozinho conservadoramente)
- **Q:** Variant A vs B vs C do logo pro PWA? **R:** Default = A (Refined). Você troca depois com 1 comando.
- **Q:** Adicionar deps novas (FullCalendar, etc)? **R:** Evitar. Implementar versões mínimas próprias.
- **Q:** Sobrescrever páginas existentes? **R:** Quando faz sentido (substituir stub por real). Documento no relatório.
