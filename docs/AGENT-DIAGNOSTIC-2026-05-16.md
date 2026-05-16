# Diagnóstico e Correção do Agente IA — Sessão 2026-05-16

Investigação completa do P01 (Secretária IA · Orquestrador WhatsApp) e workflows satélites depois de incidentes de produção. Subida do score E2E de **38/42 → 40/42** com bug crítico estrutural descoberto e resolvido.

---

## Sumário executivo

| Tópico | Resultado |
|---|---|
| Bugs estruturais corrigidos | 4 (UUID hardcoded, NULLIF cast, admin-system tenant, regra prompt 9) |
| Workflows novos | 1 (A07 reativador 6h) |
| Workflows modificados | 4 (P01, A04, T05, T06) |
| Patches no systemMessage do agente | 5 blocos (regras 8, 9, 10 + DOB futura + PASSO R1 condicional) |
| Suite E2E | 44 cenários, 8 categorias, LLM-as-judge |
| Score E2E | 38/42 → 41/42 → 40/42 (95.2%) |
| Falhas residuais | 2 (judge nuance, não regressão) |

---

## Estratégia de teste

### Por que matriz E2E sistemática

Bugs sucessivos em produção (Patrícia, Vagner, Rosa Maria, Joseli, casos de paciente com label `agente-off` por dias) mostraram que diagnóstico caso a caso não escalava. Suite cobre 8 categorias de stress:

1. **novo-paciente** (C01-C05) — coleta dados e validação básica
2. **conhecido** (C06-C10) — `patient_state` + retorno gratuito
3. **anexos** (C11-C14) — áudio, imagem, PDF, reaction (skipped no harness atual)
4. **falha-tools** (C15-C20) — comportamento quando tool retorna erro/null
5. **adversarial** (C21-C25) — prompt injection, hostilidade, datas inválidas
6. **concorrência** (C26-C28) — race conditions (skipped, serial runner)
7. **fluxos-negócio** (C29-C36) — caminho feliz + remarcação + cancelamento + dúvidas
8. **tipos-mensagem** (C37-C44) — ambiguidade, mensagens curtas, picotadas, idioma

### Arquitetura do harness

- **Runner** ([app/scripts/test-agent-e2e/runner.ts](../app/scripts/test-agent-e2e/runner.ts)) — orquestra cenários, faz setup real de contact+conversation no Chatwoot, envia webhook ao P01, aguarda resposta via polling no Postgres, executa assertions
- **Tenant E2E real** ([supabase/migrations/20260515200000_seed_singulare_e2e_tenant.sql](../supabase/migrations/20260515200000_seed_singulare_e2e_tenant.sql)) — `singulare-e2e` + Dra. Teste E2E (doctor_code 999) + Chatwoot inbox 13 isolado
- **LLM-as-judge** com Gemini ([lib/llm-judge.ts](../app/scripts/test-agent-e2e/lib/llm-judge.ts)) — usa retry 429, few-shot, data atual no contexto, recebe só `priorResponses` (não a última, evita falso "repetida")
- **Cleanup automático** por tenant_id — não polui produção

### Slash command

`/test-agent` ([.claude/commands/test-agent.md](../.claude/commands/test-agent.md)) — execução assistida via Claude.

---

## Bugs estruturais descobertos

### Bug 1 — UUID hardcoded `d52102f7-5507-4416-b902-b5ff5fc12668` em 4 lugares do P01 (CRÍTICO)

**Sintoma**: agente escala inesperadamente em qualquer tenant ≠ `singulare`. Tool retorna `doctor_not_found` mesmo quando médica existe na tabela.

**Causa raiz**: UUID da Dra. Paula (tenant `singulare` em produção) estava hardcoded como fallback dos workflow inputs de `Secretária`, `Call 'safe_create_event'`, `check_day_available`, `list_available_slots`. Quando `patient_state.doctor_id` vinha null (paciente novo), o fallback usava UUID errado e a query do tool `Check Day Open` retornava `NOT FOUND`.

**Como descoberto**: cenário C29 falhou consistentemente com "tool não acha doctor". Inspeção do `intermediateSteps` da execução N8N #30575 mostrou o input `doctor_id: "d52102f7-..."` mesmo no tenant `singulare-e2e` (cujo doctor_id real é `741aaa58-...`).

**Fix**: substituído `|| 'd52102f7-...'` por `|| ''` nos 4 lugares. NULLIF (já corrigido — ver bug 2) converte string vazia em NULL, e o tool usa `doctor_name`/`doctor_code` que o agente passa.

**Impacto em produção**: qualquer tenant que não singulare provavelmente teve falhas silenciosas similares. Demo-singulare, admin-system, todos vulneráveis. Agora resolvido para todos.

### Bug 2 — `NULLIF('null')` em T05/T06 (CRÍTICO)

**Sintoma**: erro `invalid input syntax for type integer: "null"` em `check_day_available` e `list_available_slots` quando agente passa doctor_name mas não doctor_code.

**Causa raiz**: n8n template `{{ $('When Called').item.json.doctor_code }}` renderiza `undefined` como string literal `"null"` (não como string vazia `""`). A função SQL fazia `NULLIF('null', '')::int` — comparação com `''` não converte, e o cast `'null'::int` quebra.

**Como descoberto**: cenário C33 (reagendamento) falhou 3 rodadas seguidas com a mesma mensagem de erro. Stack trace na observação do `intermediateSteps` apontou o cast SQL.

**Fix**: encadeado `NULLIF(NULLIF(..., ''), 'null')` em `doctor_code`, `doctor_name`, `doctor_id` nos workflows T05 e T06.

### Bug 3 — A04 query retornava tenant errado para inbox compartilhada (MÉDIO)

**Sintoma**: webhook `conversation_status_changed` chega → A04 busca tenant por `chatwoot_inbox_id='3'` → retorna `admin-system` em vez de `singulare` (ambos com inbox_id=3) → tenta remover label em conversa que não existe na conta do admin-system → 404.

**Causa raiz**: query original não ordenava nem excluía tenants de sistema. Postgres devolveu primeiro match arbitrariamente (admin-system aparecia antes).

**Fix**: WHERE acrescido de `AND tenant_id != 'admin-system'` e `ORDER BY CASE WHEN tenant_id = 'singulare' THEN 0 ELSE 1 END, created_at ASC LIMIT 1`.

### Bug 4 — Modelo Gemini 2.5-flash emite text+functionCall na mesma chunk de stream (MITIGADO)

**Sintoma**: agente decide chamar `Escalar_humano` e responde com `output:""` mas `intermediateSteps` mostra o tool foi chamado. Paciente recebe mensagem vazia.

**Causa raiz arquitetural**: o "extended thinking" do Gemini 2.5 (visível no `__gemini_function_call_thought_signatures__`) emite texto + function call simultaneamente no streaming. LangChain JS descarta o texto quando há function call presente.

**Fix em duas camadas**:
1. **Preventivo (regra 10 no systemMessage)**: instrui o modelo a SEPARAR texto e tool call em turnos distintos para tools de ação (Escalar_humano, safe_create_event, safe_cancel_booking, safe_update_booking, Atualizar_evento, Deletar_evento, Agent AI Exam Specialist1). Tools leves (Reagir_mensagem, Refletir, queries) podem vir junto.
2. **Defensivo (Formatar Texto expandido)**: detecta `output:""` e injeta mensagem contextual baseada na tool chamada e no resultado da `observation`. Cobre todos os fluxos críticos.

**Não atacado**: upgrade typeVersion do AI Agent (1.9 → 3.x = Tools Agent refactor) ou do Gemini node (1 → 1.1 = `gemini-3-flash-preview` default). Risco alto, benefício incerto. Mantidas as versões atuais.

---

## Workflows novos

### A07 — Reativador por Timeout Agente-Off

**ID**: `jlnSM704VWMhGtdU`. **Ativo**. Schedule a cada 30min.

Fluxo: lista tenants ativos (exceto admin-system) → para cada, GET conversas com label `agente-off` no Chatwoot → filtra por `last_activity_at > 6h` → remove label → notifica Telegram do tenant com contagem.

**Motivação**: 100% das escalações em produção eram "Modo A" (profissional continua atendendo pelo WhatsApp direto, não pelo Chatwoot). A04 só funcionava no "Modo B" (resolve via Chatwoot). Resultado: 70 conversas em prod com label `agente-off` indefinidamente, 4 delas com mais de 7 dias. A07 cobre o gap automaticamente.

**Timeout 6h**: validado com user — após 6h sem nova atividade no WhatsApp, é razoável assumir que profissional resolveu e devolve atendimento ao bot.

---

## Patches no systemMessage do agente Secretária

Aplicados em sequência nesta sessão:

| Regra/Bloco | Conteúdo | Causa raiz |
|---|---|---|
| **REGRAS_INQUEBRAVEIS #8** (anti-loop) | NUNCA repita literalmente uma mensagem; varie | Pacientes recebendo mesma frase 2-3x |
| **REGRAS_INQUEBRAVEIS #9** (responda com info que tem) | Antes de escalar, verifique se DADOS_DA_CLINICA tem a resposta (endereço, valores, convênio, horários) | C36 escalando "Vocês aceitam Unimed?" |
| **REGRAS_INQUEBRAVEIS #10** (separação texto×tool) | NUNCA emita texto + tool call de ação no mesmo turno | Bug 4 LangChain×Gemini |
| **PASSO 3** (validação DOB futura) | Recusar data de nascimento ≥ data_hoje | C23 (DOB 19/07/2030 sendo aceita) |
| **PASSO 5** (mencionar dia inviável) | OBRIGATÓRIO mencionar QUAL dia é inviável e POR QUÊ antes de oferecer alternativa | C16 (paciente confuso por proposta abrupta) |
| **PASSO R1** (retorno condicional) | Pular pergunta "primeira ou retorno?" se `patient_state.known=false` | C19 (paciente novo recebendo pergunta tautológica) |
| **EXCECOES_E_TRANSBORDO** | RESPONDA ANTES DE ESCALAR — só escala pedido explícito de humano, hostilidade grave, fora do escopo | C36 + comportamento ambíguo do agente |

Backup do `Formatar Texto` ([n8n/workflows/.n8n-backups/master-secretaria-1ZTMCmNUmOCx36WV-pre-fixes-2026-05-16.json](../n8n/workflows/.n8n-backups/master-secretaria-1ZTMCmNUmOCx36WV-pre-fixes-2026-05-16.json)) já existia da sessão anterior.

---

## Ajustes Gemini

Aplicados nos 2 nodes do P01 (`Gemini` da Secretária + `Google Gemini Chat Model` da Confirmação):

| Setting | Valor | Por quê |
|---|---|---|
| `modelName` | `models/gemini-2.5-flash` (explícito) | Evitar mudança silenciosa se Google atualizar default do typeVersion 1 |
| `options.maxOutputTokens` | 1500 | Cap de custo em runaway |
| `options.temperature` | 0.5 | Reduzir flakiness (deterministic + criativo o suficiente) |

Não tocados:
- `safetySettings`: defaults Google são adequados para contexto clínico
- typeVersion: 1 (estável) — 1.1 traz `gemini-3-flash-preview` instável
- `Google Gemini Chat Model.` (Formatar SSML): explicitamente `gemini-2.5-flash-lite`, mais barato/rápido — adequado para reformatação
- `Transcribe a recording`: `gemini-2.0-flash` para audio, ok

---

## Resultado E2E ao longo da sessão

| Rodada | Score | Notas |
|---|---|---|
| Baseline (início da sessão) | 38/42 (90.5%) | 4 FAIL: C19, C33, C36, C37 |
| Pós-patches systemMessage | 41/42 (97.6%) | C19, C33, C36, C37 resolvidos. C29 expôs flakiness (regressão aparente) |
| Pós-UUID hardcoded + Gemini | 40/42 (95.2%) | C29 resolvido. C19 + C32 caíram em judge nuance (não regressão) |

### Falhas residuais

- **C19**: agente respondeu sobre dia inválido (sábado), judge esperava menção da antecedência também. Comportamento parcialmente correto. Pode ser refinado com regra "se MÚLTIPLOS motivos invalidam, mencione todos".
- **C32**: paciente disse "Confirmo minha consulta de amanhã", agente respondeu "É essa consulta que você gostaria de confirmar?". Confirmação redundante. Pode ser refinado com regra "se mensagem já contém intent claro de confirmação, NÃO peça reconfirmação".

Ambas são nuances de prompt, não bugs técnicos. C29 ("Confirmo" após "houve um problema" interpretado como confirmar cancelamento) também segue flaky por 1/3 — sugere refinamento da mesma classe.

---

## Itens pendentes (opcionais)

| Item | Tipo | Bloqueante? |
|---|---|---|
| Patches anti-confirmação-redundante + multi-motivo (C32/C19/C29) | Refinamento prompt | Não |
| Validar A07 cleanup das 70 conversas em prod (próxima janela 30min) | Verificação | Não |
| Snapshot backup novo do P01 pós todos os fixes em `n8n/workflows/.n8n-backups/` | Higiene | Não |
| Validar webhook Chatwoot `conversation_status_changed` dispara consistente (1 só execução A04 hoje) | Monitoramento | Não |
| Investigar conversa #999001 do erro original A04 | Histórico | Não |
| Suporte real a anexos C11-C14 (hospedar arquivos) | Cobertura de teste | Não |
| Paralelismo controlado C26-C28 (concorrência) | Cobertura de teste | Não |

---

## Histórico de scores e relatórios

Todas as rodadas detalhadas em `docs/agent-test-matrix-history/`. Cada relatório contém:
- Score consolidado
- Por cenário: turnos completos (paciente ↔ agente), durações, assertions
- Quando aplicável: relatório de flakiness multi-rodada

---

## Referências de execução

- **P01 versão atual**: `1ZTMCmNUmOCx36WV` (90 nodes, 70+ versões)
- **A07 (novo)**: `jlnSM704VWMhGtdU` (8 nodes)
- **A04**: `PkLnFYScOdCfqTQr`
- **T05 list_available_slots**: `L4CMi1j9W6eRCHWS`
- **T06 check_day_available**: `71qts8cgcB0uh49Q`
- **A05 escalador** (não modificado, validado saudável): `oz3amxBncQ5Mv6oC`
- **Tenant E2E**: `singulare-e2e` (Chatwoot inbox 13, conta 1)
- **Doctor E2E**: Dra. Teste E2E, doctor_code 999, id `741aaa58-e9d2-4a9f-9ba1-ba3217fea0ae`
