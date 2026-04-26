# Problem Map — Arquitetura Singulare

**Data:** 2026-04-26
**Modo:** Solo / análise crítica antes de implementação

---

## Problem Statement

Existem 4 problemas estruturais entrelaçados:

1. **Setup pós-onboarding incompleto**: configurações que o N8N coleta no onboarding inicial não são editáveis no painel se o profissional pula etapas ou cadastra novo profissional via painel.

2. **Confusão entre 2 telefones**: `real_phone` (canal WhatsApp da plataforma, gerenciado por Evolution) está sendo confundido com `tenant_doctors.contact_phone` (telefone pessoal do profissional). UI ambígua.

3. **Telegram subutilizado como front**: hoje o painel é o front principal e o chat-drawer interno é "apoio". Visão certa: Telegram É o front do dia-a-dia do profissional, painel é configuração e visualização.

4. **Ordem do menu lateral pouco lógica**: Configurações no meio quebra hierarquia. Itens de uso diário (Agenda, Pacientes) deveriam vir antes de itens de setup (Profissionais, Pagamentos, Configurações).

---

## Estado real verificado no banco

### Tenant Singulare (passou completo pelo N8N)
```
real_phone               = 11953441350
phone                    = 11953441350     ← duplicado
evolution_phone_number   = 11953441350     ← MESMO número
evolution_status         = connected
evolution_instance_name  = Dra. Paula Franzon
telegram_chat_id         = 5749317361
telegram_bot_link        = https://t.me/SingulareBot?start=singulare
asaas_account_id         = NULL (Asaas pendente)
asaas_account_status     = pending
calendar_id              = ff52c2d3...@group.calendar.google.com
```

### Tenant Clínica Voda (criada via meu fluxo, sem N8N completo)
```
real_phone               = +5511945671290  ← formato diferente (E164)
evolution_phone_number   = NULL            ← FALTA — Evolution não criou instância
telegram_chat_id         = NULL            ← FALTA
telegram_bot_link        = NULL            ← FALTA
calendar_id              = NULL            ← FALTA
```

**Conclusão:** o N8N onboarding faz 4 ações que meu fluxo via painel não dispara:
1. Cria instância Evolution (vincula `real_phone` → `evolution_phone_number`)
2. Cria/vincula bot Telegram (popula `telegram_chat_id` + `telegram_bot_link`)
3. Cria calendar Google (popula `calendar_id`)
4. Configura `professionals_config` + `specialties_config` (já feito)

---

## Decisões arquiteturais

### Decisão 1: Telefone Evolution vs Telefone do Profissional

**Antes (confuso):**
- `real_phone` no onboarding pedia "WhatsApp / Telefone" sem clarificar
- `contact_phone` em tenant_doctors também é "telefone"

**Depois (claro):**
- **`real_phone`** = "Número do canal de atendimento WhatsApp" (vai virar instância Evolution, é onde IA atende paciente)
  - É da CLÍNICA ou do PROFISSIONAL, mas é PÚBLICO (paciente liga)
  - Pode ser o mesmo número da clínica/profissional ou um chip dedicado
- **`tenant_doctors.contact_phone`** = "Telefone pessoal do profissional" (privado, pra contato interno se precisar)

**Ação:** atualizar labels e hints na UI (onboarding + configurações + profissionais).

---

### Decisão 2: Telegram como front principal

**Visão (certa) do user:**
> "o telegram é para o profissional o canal de interacao com o seu agente interno"
> "ele precisa ser praticamente o front do app depois de cadastrado para o profissional"
> "td que ele for querer fazer ele vai pedir para o assistente"

**Implicações imediatas (low-risk, low-code):**
- Painel recebe destaque pro Telegram logo após o login (banner "Abra seu Telegram pra começar")
- Setup checklist inclui "Abrir Telegram" como item importante
- Welcome tour menciona Telegram como canal principal

**Implicações grandes (high-risk, requer revisão N8N):**
- Workflow "6. Assistente Interno" precisa ter intents amplas: criar paciente, ver agenda, gerar cobrança, cancelar consulta, ver faturamento, etc
- Painel passa a ser "control room visual" (gráficos, listas) e não mais "principal action surface"
- Talvez o chat-drawer no painel deva ABRIR DIRETO o Telegram em vez de duplicar a IA

**Recomendação:** fazer só o low-risk agora. Discutir o high-risk com você antes de mexer no N8N.

---

### Decisão 3: O que pode ser "configurar depois"

**Essencial (não pode ser pulado):**
- Profissional principal: nome + especialidade + registro
- Tenant: nome + admin_email + real_phone (canal IA)
- LGPD aceito

**Configurável depois (pode pular):**
- Working hours (default: seg-sex 8h-18h)
- Convênios (default: só particular)
- Valor consulta + métodos de pagamento (default: vazio, IA pergunta na hora)
- Follow-up (default: 30 dias / mesmo valor)
- Calendar Google ID (auto-criado se SA disponível)
- Telegram bot link (auto-gerado pelo N8N quando `real_phone` ok)
- ElevenLabs voice (default: voz padrão)
- IA prompt customizado (default: prompt genérico do tenant)
- Asaas payment activation (faz quando for cobrar de verdade)

**Ação:** garantir que TODOS os "configuráveis depois" tenham PATCH e UI no painel.

| Campo | PATCH existe? | UI no painel? | Ação |
|---|---|---|---|
| working_hours | ✅ | ✅ | OK |
| accepts_insurance + insurance_note | ✅ | ✅ | OK |
| consultation_value + duration | ✅ | ✅ | OK |
| follow-up | ✅ | ✅ | OK |
| calendar_id | ✅ | ✅ | OK |
| evolution_phone_number | ⚠️ ler-only | ⚠️ | Adicionar fluxo: trigger N8N pra criar instância se não tiver |
| telegram_bot_link | ⚠️ ler-only | ⚠️ | Adicionar trigger N8N pra criar bot se não tiver |
| elevenlabs_voice_id | ❌ | ❌ | Adicionar PATCH + UI |
| assistant_prompt | ✅ | ✅ | OK |

---

### Decisão 4: Ordem do menu lateral

**Atual (caótico):**
1. Visão geral
2. Profissionais
3. Pacientes
4. **Configurações** ← no meio
5. Cobranças
6. Agenda
7. Mensagens
8. Notas fiscais
9. NPS / feedback
10. Ativar pagamentos
11. Visibilidade (em breve)

**Proposto (uso diário primeiro, setup no fim):**
1. Visão geral
2. **Agenda** ← uso diário
3. **Pacientes** ← uso diário
4. **Mensagens** ← uso diário
5. **Cobranças** ← uso diário
6. Notas fiscais
7. NPS / feedback
8. **Profissionais** ← estrutura, baixa frequência
9. **Ativar pagamentos** ← setup
10. Visibilidade (em breve)
11. **Configurações** ← setup, último

---

## Workflow N8N onboarding — recomendações

**Sem MCP enabled** no workflow `eNE9x7664nbUVa5q` ("0. On Boarding Latest v10.0 - Completo e Correto"), eu não consigo nem ler nem modificar.

**Recomendações pra você revisar lá manualmente:**

1. **Salvar incompletude no banco**: hoje o N8N só completa se TODOS os passos rodam. Se falha em algum (ex: Evolution down, Asaas timeout), o tenant fica órfão. Sugiro:
   - Salvar `tenants.status = 'partial'` quando alguma integração falhar
   - Deixar o painel + checklist mostrar o que precisa concluir
   - Ter botão no painel "Reprocessar onboarding" que chama o N8N de novo

2. **Trigger Evolution sob demanda**: quando user adiciona profissional novo no painel, chamar workflow N8N pra criar instância Evolution dele (se ele tem `real_phone` próprio). Hoje o painel não faz isso.

3. **Trigger Telegram bot vinculação**: quando user clica "Conectar meu Telegram" no painel, gerar deep link `t.me/SingulareBot?start=tenant_id` e atualizar `telegram_chat_id` quando ele clicar /start.

4. **Habilitar MCP no workflow** pra eu poder ajudar nas próximas iterações.

---

## Plano de implementação (ordem de menor risco → maior)

### 🟢 Camada 1 — Low risk (faço agora)

| # | Ação | Arquivos |
|---|---|---|
| 1 | Reordenar menu lateral | `painel/layout.tsx` |
| 2 | Clarificar labels: real_phone = canal Evolution | `onboarding/page.tsx`, `painel/configuracoes/page.tsx` |
| 3 | Banner "Abra seu Telegram" no painel após login | `painel/components/telegram-cta.tsx` (novo) |
| 4 | PATCH + UI pra `elevenlabs_voice_id` | `api/painel/tenant/route.ts`, `configuracoes/page.tsx` |
| 5 | Adicionar item Telegram link no setup checklist | `setup-checklist.tsx` |

### 🟡 Camada 2 — Médio (proposto, faço se aprovar)

| # | Ação | Risco |
|---|---|---|
| 6 | Endpoint POST `/api/painel/tenant/sync-n8n` que dispara N8N onboarding pra completar campos faltantes | Precisa env `N8N_ONBOARDING_RESYNC_URL` + workflow N8N preparado pra receber |
| 7 | Substituir chat-drawer interno do painel por botão "Abrir Telegram" (se o objetivo é unificar canal) | Médio — perde funcionalidade web mas alinha com visão |
| 8 | Toggle no painel: "Modo profissional (Telegram-first)" vs "Modo admin (web-first)" | Implementação leve mas decisão UX importante |

### 🔴 Camada 3 — Alto (você decide e implementa no N8N)

| # | Ação | Por que fora do meu escopo |
|---|---|---|
| 9 | Revisar workflow N8N onboarding (status partial, error handling) | Sem MCP enabled, eu não posso |
| 10 | Adicionar intents no workflow "6. Assistente Interno" pra ele virar control center | Você conhece melhor a lógica do agente |

---

## Perguntas críticas antes de codar

1. **Real_phone vs Evolution**: confirma que o `real_phone` cadastrado no onboarding **automaticamente** vira a instância Evolution (mesmo número)? Ou tem caso onde são diferentes?

2. **Telegram bot único ou por tenant**: vi `telegram_bot_link = https://t.me/SingulareBot?start=singulare` — então é UM bot único pra Singulare, e diferentes tenants são diferenciados por `chat_id`. Confirma?

3. **Camada 2 #7** (substituir chat-drawer por botão Telegram): você quer **manter** o chat web do painel OU é melhor **unificar tudo no Telegram**? Eu acho que manter os dois faz sentido (web pra desktop em frente do PC, Telegram pra mobile/durante atendimento), mas preciso da sua opinião.

4. **Sobre habilitar MCP no N8N**: pode habilitar nos workflows "0. On Boarding Latest v10.0" e "6. Assistente Interno"? Sem isso, qualquer revisão de N8N tem que ser feita manualmente por você.
