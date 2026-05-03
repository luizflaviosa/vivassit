# Audit: Onboarding Flow + WhatsApp Connection (v2)

**Data:** 2026-05-03
**Lentes:** problem-mapping, frontend-design, mobile-app-ui-design
**Inspiração:** Apple (AirPods setup, Apple TV setup, iCloud onboarding)

---

## TL;DR — 3 achados de impacto

1. **🚨 Gap crítico de placement:** A UI `WhatsAppConnect` que acabamos de construir **só aparece pra tenants `is_sob_medida`** — que justamente o n8n PULA provisionamento. Tenants pagantes são redirecionados pra `/checkout/${ref}` ANTES de ver a SuccessScreen. **A maior parte do trabalho recém-implementado é invisível pro customer real.** Ver §A.

2. **🚨 Gap crítico de fluxo:** O `evolution_status` no Supabase nunca atualiza após a conexão real do WhatsApp. O listener do Evolution (Phase 6) ainda não existe. Conclusão: o **polling no `WhatsAppConnect` nunca resolve** — o card "✅ WhatsApp conectado" não aparece nunca, mesmo quando o cliente conecta de fato. Ver §B.

3. **⚠ UX desalinhado com Apple:** Várias decisões pequenas geram ansiedade em vez de confiança calma. Polling com bolinha amber pulsando, copy "expira em 3 minutos", instruções de 4 passos numerados. Apple priorizaria 1 ação grande, copy serena, motion sutil. Ver §D.

---

## Estado pós-implementação (o que está pronto e onde)

| Camada | Item | Status |
|---|---|---|
| Supabase | Colunas `evolution_qr_string`, `evolution_pairing_code`, `welcomed_at` | ✅ Migration aplicada |
| n8n | Workflow v4.5 com fix de paths + captura pair code | ✅ Publicado, ativo no path `/webhook/singulare-onboarding-v44` |
| Vercel API | `/api/onboarding/route.ts` mapeia 3 campos novos | ✅ Editado, build em progresso |
| Vercel API | `/api/onboarding/status` (polling endpoint) | ✅ Criado |
| Vercel UI | `WhatsAppConnect.tsx` (pair default, QR fallback, polling) | ✅ Criado |
| Vercel UI | Plug do componente em `SuccessScreen` | ✅ Editado |
| n8n | Listener de eventos do Evolution (Phase 6) | ❌ NÃO FEITO |
| Welcome WA msg pós-conexão | (parte da Phase 6) | ❌ NÃO FEITO |

---

## §A. Gap de placement — o componente está no lugar errado

### Diagnóstico

Em [app/app/onboarding/page.tsx:861-875](app/app/onboarding/page.tsx#L861), após o submit do onboarding:

```tsx
if (response.ok && result.success) {
  if (result.data?.is_sob_medida || result.data?.next_step === 'awaiting_proposal') {
    setSuccessData(result.data as SuccessData);  // ← SuccessScreen aparece
    return;
  }
  // Demais planos: redireciona pro checkout
  const ref = result.data?.external_reference as string | undefined;
  if (ref) {
    window.location.href = `/checkout/${encodeURIComponent(ref)}`;  // ← redirect, SuccessScreen NUNCA renderiza
    return;
  }
}
```

**Implicação:**
- **Sob Medida (não-paganté ainda):** Vê SuccessScreen ✅. Mas o n8n pula provisionamento (não tem Evolution instance, não tem QR, não tem pair). O `WhatsAppConnect` não renderiza nada (early return em `!hasQr && !hasPair`).
- **Plano pago (Professional, Enterprise):** **Pulado pra `/checkout`** sem ver a tela. n8n provisiona Evolution e devolve QR/pair. Esses dados ficam no Supabase mas o cliente nunca vê na tela.

### Conclusão

O componente que construí cobre o caso **menos relevante** (sob medida, sem WhatsApp pra conectar) e **deixa de fora** o caso principal (cliente pagou e precisa conectar).

### Recomendação (priorizada)

**Curto prazo (urgente):**
- Pós-checkout success page (rota tipo `/checkout/${ref}/success` ou `/painel/setup`) deve renderizar `WhatsAppConnect` com os campos `evolution_*` lidos do tenant.
- Banner persistente em `/painel` enquanto `evolution_status !== 'open'`.

**Médio prazo:**
- Reescrever fluxo: tela única "Configurando sua clínica" pós-submit que mostra progressivamente:
  1. Cobrança (link checkout)
  2. WhatsApp Connect (quando provisionamento conclui)
  3. Próximos passos
  Com transições calmas em vez de window.location.href hard.

---

## §B. Gap de fluxo — polling sem resolução

### Diagnóstico

O `WhatsAppConnect` chama `/api/onboarding/status?tenant_id=X` a cada 4s, lendo `tenants.evolution_status`. Quando vira `open`/`connected`, morfa pra "WhatsApp conectado".

**Mas:** a coluna `evolution_status` é gravada UMA vez (no momento da criação da instância, valor é `close` ou `created`). **Não existe nenhum gatilho hoje que UPDATE essa coluna** quando o cliente efetivamente conecta o WhatsApp.

O que falta: um listener n8n no path `/webhook/evolution/v44/{tenant_id}` (já registrado em `Configurar Tenant v4.4` mas o workflow legado `Evolution Webhook Router v6.0` está inativo) que receba eventos `connection.update` e:
1. Faça `UPDATE tenants SET evolution_status='connected', updated_at=NOW()`
2. (Phase 6) Envie welcome WhatsApp
3. (Phase 6) Notifique admin via Telegram

### Conclusão

**Sem o listener Phase 6, o polling é dead code.** O cliente pareou, conectou, está usando — e a tela nunca atualiza. Pior UX possível: cliente confuso, vai pra suporte.

### Recomendação

**Implementar Phase 6 antes de smoke test em produção.** Sem ela, a feature inteira é "conectar mas nunca confirmar conexão". É o nó górdio do plano.

Alternativa de curto prazo: o endpoint `/api/onboarding/status` poderia chamar Evolution API diretamente pra checar status real. Mas requer Evolution credentials no env Vercel — outro caminho com fricção.

---

## §C. Front-back fluency — onde o handshake quebra

| Camada → Camada | Como flui hoje | Problemas |
|---|---|---|
| Frontend → Vercel API | POST `/api/onboarding`, await até 30s | Síncrono. UI fica "submitting" 30s sem feedback intermediário. Apple: progressive optimistic UI. |
| Vercel API → n8n | POST webhook, await JSON response | Idem. Se n8n timeout, frontend recebe erro genérico. |
| n8n → Supabase (insert) | `Salvar Supabase v4.4` | **Sempre falha em produção** com duplicate key (Vercel já inseriu antes). Workflow continua via `onError: continueRegularOutput`. Persistência real é via UPDATE da Vercel. Confuso, com lógica duplicada. |
| n8n → Vercel | Respond Webhook JSON | OK pós-fix v4.5. |
| Vercel → Frontend | response.json() | OK. |
| Evolution → n8n | webhook `/evolution/v44/{tid}` | **Buraco negro hoje** (listener inativo). |
| Frontend → Status endpoint | Polling 4s | OK MAS sem listener acima, status nunca muda. |

### Inconsistências de naming

Mesma coisa, 3 nomes:
| Camada | Nome |
|---|---|
| Supabase | `evolution_pairing_code` |
| n8n response | `whatsapp_pairing_code` |
| Frontend prop | `pairingCode` |
| Onboarding return | `whatsapp_pairing_code` |

Apple-style: 1 nome. Sugestão: `pairing_code` em todas as camadas.

### Recomendações de fluência

1. **Eliminar `Salvar Supabase` no n8n** — é dead code, remove. Vercel UPDATE é a fonte de verdade.
2. **Adotar Supabase Realtime** em vez de polling. Channel subscribe na tabela `tenants` filtrado por `tenant_id`. Atualização instantânea, não 4s de delay.
3. **Renomear `whatsapp_pairing_code` → `pairing_code`** em todas as camadas (1 PR, baixo risco).
4. **Status endpoint mais rico:** retornar `{ phases: { tenant_created, calendar_ready, drive_ready, evolution_provisioned, evolution_connected, welcomed } }` — frontend renderiza checklist progressivo Apple-style.
5. **Mover provisionamento pra fila assíncrona** (médio prazo): submit retorna 202 Accepted, frontend conecta em realtime channel pra ver progresso. Elimina os 30s de await síncrono.

---

## §D. Frontend design audit (lente Apple-inspired)

### O que está bom
- Tipografia: serif italic em "Pronto." é Apple-y ✓
- Hairlines: `border-black/[0.07]`, divisores sutis ✓
- Violet accent em pair code ✓
- Spring animation no checkmark verde ✓
- Generous whitespace nas seções ✓

### O que precisa refino

**1. Polling indicator (`WhatsAppConnect.tsx:218-221`)**
```
<span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
Aguardando conexão... O código expira em ~3 minutos. Atualize a página se vencer.
```
- Amber = warning. Errado. Apple usaria neutro ou accent color.
- "Expira em 3 minutos" cria ansiedade. Apple não fala em deadlines visíveis. Usaria "Conectando..." sem prazo.
- "Atualize a página se vencer" é instrução defensiva — Apple silenciaria isso e regeneraria automático no backend.

**Refino:** trocar bolinha amber por respiração lenta no ícone do WhatsApp (1.6s opacity 0.5→1). Copy: "Conectando..." só.

**2. Copy button (`WhatsAppConnect.tsx:118-128`)**
- Tamanho `h-9 w-9` (36px). Apple HIG recomenda 44×44pt mínimo pra touch.
- Sem haptic feedback (limitação web).
- Refino: aumentar pra `h-11 w-11`. Adicionar sutil bounce no copy success.

**3. Instruções (4 passos)**
- Lista numerada de 4 itens. Verbose pra mobile.
- Apple condensa em 2 linhas: "Abra o WhatsApp → Aparelhos conectados → Cole o código."
- Refino: comprimir pra 3 linhas grandes. Ou ainda melhor: ícone + label horizontal flow.

**4. Toggle QR/Pair**
- Posição top-right do card. Fora do thumb zone em mobile.
- Visual: pill com bg preto quando ativo. Apple usaria segmented control nativo.
- Refino: se ambos disponíveis, deixar Pair como hero; QR vira link discreto "Prefiro QR Code" embaixo das instruções. Não precisa ser igualmente proeminente.

**5. Estado conectado (`WhatsAppConnect.tsx:67-83`)**
- Card emerald com ícone check. Funciona, mas é genérico SaaS.
- Apple celebraria mais: maior, com motion (sparkle leve, scale spring), copy mais quente ("Tudo pronto, Dr(a). [Nome]. Sua secretária IA já está atendendo.").

**6. Empty state quando ambos faltam**
- Hoje: `if (!hasQr && !hasPair) return null` — desaparece silenciosamente.
- Apple: card de fallback "Estamos preparando sua conexão WhatsApp..." com retry button.

### Gestalt do success screen (lente: muitos elementos, pouco foco)

A SuccessScreen hoje empilha:
1. Logo
2. Checkmark spring
3. "Pronto." + nome
4. Tenant ID
5. Services checklist (6 items)
6. **WhatsApp Connect (NOVO)**
7. Access links (3 items)
8. Email reminder
9. Botão "Acessar painel"

9 sections. **Apple jamais faria assim.** Em uma tela de pós-onboarding, Apple priorizaria UMA ação: "Conecte seu WhatsApp." O resto fica em transition pós-conexão ou em /painel.

**Refino estrutural recomendado:** dividir em 2 telas:
- **Tela 1 — Conectar WhatsApp** (foco único, hero, pair code centralizado, instrução curta).
- **Tela 2 — Pronto** (auto-transição quando conectar): logo, "Bem-vindo Dr(a)" + acessos + CTA painel.

---

## §E. Mobile UX audit (lente: industry conventions)

### Pontos fortes (já bons)
- 8-point grid: spacing usado é múltiplo de 4/8 ✓
- 1 família de fonte (provável: Geist ou system serif pra display) ✓
- Cards com `rounded-xl` modernos ✓
- Hierarchy via opacity (`text-zinc-500` etc) ✓

### Problemas

**1. Thumb zone**
- Toggle QR/Pair está em top-right do card. Em telas grandes (Pro Max), fora do thumb reach.
- Botão "Acessar painel" provavelmente lá embaixo (fora do viewport inicial). OK pra paying customer mas mobile-first deveria estar mais perto.

**2. Touch targets**
- Copy button 36px é abaixo do mínimo (44pt iOS / 48dp Android).
- Toggle pills são 30px de altura. Apertado.

**3. Reading width**
- Container `max-w-xl` (576px) — bom pra desktop, MAS em mobile (375px) os 4 passos numerados quebram em multilinhas inconsistentes.
- Sugestão: max-w-md em mobile, max-w-xl em desktop.

**4. Loading/empty states**
- Onboarding submit (30s síncrono!): durante esses 30s o que o usuário vê? Provável: spinner no botão. Apple-grade: full-screen "Configurando sua clínica..." com checkmarks progressivos.

**5. Hierarchy**
- Pair code é grande (`text-[28px] sm:text-[32px]`) — bom.
- MAS o título do card "Conectar WhatsApp" é tiny uppercase tracking. Apple inverteria: pair code é grande mas o "Conectar WhatsApp" também merece destaque (semibold 18-20px) pra estabelecer contexto.

**6. Peak/end (Peak-End rule)**
- Peak deveria ser o momento de CONEXÃO. Hoje é só um card morfando pra emerald. Apple celebraria mais (sparkle, motion mais expressivo, copy quente).
- End é o redirect pro painel. Apple manteria momento "Bem-vindo" antes do hard cut.

---

## §F. Recomendações priorizadas

### P0 — Bloqueadores funcionais (sem isso, feature é teatro)
1. **Phase 6 — listener Evolution + welcome message** — sem isso, polling é dead. Inclui criar workflow n8n + handler Evolution events + UPDATE tenants + send welcome msg.
2. **Placement do `WhatsAppConnect`** — mover pra pós-checkout success page OU /painel banner. Hoje só tenants sob_medida veem (= ninguém que precisa).
3. **Verificar build TypeScript do trabalho atual** — confirmar que Vercel auto-deploy não vai falhar.

### P1 — Refinos Apple-style (UX percebida)
4. Renomear `whatsapp_pairing_code` → `pairing_code` em todas camadas.
5. Trocar amber pulse por respiração no ícone WhatsApp.
6. Copy button 44×44.
7. Comprimir instruções pra 3 linhas curtas.
8. Trocar polling por Supabase Realtime.

### P2 — Reestruturação maior
9. Single-screen mode pós-submit: "Conectando seu WhatsApp" hero, depois auto-transição.
10. Status endpoint richer (phases progressivas).
11. Eliminar `Salvar Supabase` no n8n (dead code).
12. Async submission (202 Accepted + realtime channel).

### P3 — Polish
13. Sparkle/celebration motion no estado conectado.
14. Copy quente ("Tudo pronto, Dr(a). [Nome]. Sua secretária IA já está atendendo.").
15. Toggle QR como link sutil em vez de pill button.
16. Haptic-feel via micro animation no copy.

---

## §G. Sugestão de próximo step

**P0 prioridade absoluta:** Phase 6 — listener Evolution. Sem isso, o trabalho atual entrega 50% da feature. O cliente conecta mas a UI nunca confirma; a equipe não recebe notificação; o welcome message do user direction nunca dispara.

Ordem sugerida:
1. Confirmar build atual passa (3 min)
2. Commitar + push das Phases 3-5 (pra deploy preview do que está pronto)
3. Construir Phase 6 (listener n8n + welcome) — auto-bind credentials já provada que funciona em workflow novo
4. Reposicionar `WhatsAppConnect` em pós-checkout (P0 #2)
5. Iterar P1 refinos Apple

Sem o reposicionamento (P0 #2), as Phases 3-5 são quase invisíveis. **Sem Phase 6, polling é dead code.** Esses dois são os gargalos.

---

## §H. Pontos não cobertos por esse audit

- Performance: bundle size do `WhatsAppConnect`, lighthouse score na onboarding page.
- A11y: contraste pair code violet em fundo zinc-50, navegação por teclado, screen reader labels.
- I18n: copy hard-coded em PT-BR. OK pro mercado atual mas trava expansão.
- Testes: zero testes automatizados nas mudanças deste ciclo.
- Observabilidade: não há logs estruturados pra monitorar conversion rate "submit → evolution_connected".
