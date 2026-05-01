# Arquitetura de Prompt do Agente Master Secretária

> **Última atualização**: 2026-05-01
> **Caminho 3 implementado**: ataca confiabilidade hoje (Problema A) preparando arquitetura pra enterprise/marketplace (Problema B).

## Visão geral

O Master Secretária IA (Gemini via N8N) usa **3 camadas de prompt** + **defesas server-side** + **regras estruturadas por médico**. Esta doc é a fonte da verdade — qualquer mudança em prompt deve consultar aqui antes.

```
┌─────────────────────────────────────────────────────────────────────┐
│ SYSTEM MESSAGE (~14k chars + ~1k de injeções dinâmicas)             │
│                                                                       │
│  ╔═ Camada 1 (HARDCODED N8N — igual pra todos) ═══════════════════╗ │
│  ║  • CONTEXTO_TEMPORAL (now, BLOQUEIO TEMPORAL)                  ║ │
│  ║  • CONTEXTO_E_PAPEL                                             ║ │
│  ║  • REGRAS_INQUEBRAVEIS (sem emoji, sem revelar IA, etc)        ║ │
│  ║  • USO_DA_FERRAMENTA_REFLETIR                                   ║ │
│  ║  • FLUXO_SOP_AGENDAMENTO (10 passos com validações)             ║ │
│  ║  • FLUXO_RETORNO_CONSULTA                                       ║ │
│  ║  • EXCECOES_E_TRANSBORDO                                        ║ │
│  ║  • <DADOS_DA_CLINICA> ⬅ injeta Camada 2                         ║ │
│  ║  • <DIRETRIZES_DA_CLINICA> ⬅ injeta Camada 3                    ║ │
│  ║  • GUIA_DE_FERRAMENTAS                                          ║ │
│  ╚════════════════════════════════════════════════════════════════╝ │
│                                                                       │
│  ╔═ Camada 2 (rendered_prompt PG-generated, ~877 chars Paula) ════╗ │
│  ║  ## PROFISSIONAIS E ESPECIALIDADES                              ║ │
│  ║  **Dra. Paula Franzon** — Reumatologia                          ║ │
│  ║  - Calendar ID: ff52c2d3...                                     ║ │
│  ║  - Consulta: R$ 350,00                                          ║ │
│  ║  - Pagamento: PIX, dinheiro                                     ║ │
│  ║  - Horários: seg: 14:00-18:00 | ter: fechado | ...              ║ │
│  ║  - Endereço: ...                                                ║ │
│  ║  - Telefone: ... | Email: ...                                   ║ │
│  ║  - [opcional] Regras especiais: ...                             ║ │
│  ║  - [opcional] Antecedência mínima pra agendar: 4h               ║ │
│  ║                                                                   ║ │
│  ║  ## LOCALIZAÇÃO E CONTATO                                        ║ │
│  ║  ## CONVÊNIOS (se houver)                                        ║ │
│  ╚════════════════════════════════════════════════════════════════╝ │
│                                                                       │
│  ╔═ Camada 3 (assistant_prompt, texto livre por tenant) ═══════════╗ │
│  ║  Texto editável pela Dra em /painel/configuracoes               ║ │
│  ║  Hoje: vazio na maioria. Use pra regras texto-livre da clínica  ║ │
│  ╚════════════════════════════════════════════════════════════════╝ │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  Gemini Flash     │
                    │  (LLM probabilist)│
                    └────────┬──────────┘
                             │
                             ▼ (decide tool calls)
            ┌────────────────────────────────────────┐
            │ DEFESAS SERVER-SIDE                     │
            │  • safe_create_event (gate Calendar)    │
            │  • Refletir (LLM checklist — soft)      │
            │  • check_temporal (BLOQUEIO no prompt)  │
            └────────────────────────────────────────┘
                             │
                             ▼
                    Google Calendar API
```

## Caminho 3 — O que foi entregue (2026-05-01)

### M3 — Granularidade por médico via `business_rules` jsonb
- **Migration**: coluna `tenant_doctors.business_rules jsonb DEFAULT '{}'`
- **Trigger PG**: `fn_rebuild_tenant_prompt` lê `business_rules` e injeta linhas condicionais no `rendered_prompt`
- **API**: `/api/painel/profissionais` POST/PATCH aceita `business_rules`
- **UI**: nova seção "Regras de agendamento" no modal `/painel/profissionais` com:
  - Antecedência mínima (h)
  - Janela máxima (dias)
  - Máx por dia
  - Toggle "Atende emergência fim de semana"
  - Toggle "Exige formulário de anamnese"
  - Textarea "Outras regras especiais"

### M1 — Server-side gate `safe_create_event`
- **Sub-workflow N8N** (id `t7d0reakz8IMPDBp`)
- 6 validações antes de criar evento
- **Loga** sucesso E rejeição em `n8n_historico_mensagens` (type='tool')
- **Pendente**: plug no Master Secretária ATIVO (ver `n8n-patch-M1-safe-create-event.md`)

### M4 — Source of truth declarado
- Patch manual UI N8N (5min) — ver `n8n-patch-M4-source-of-truth.md`

### Cleanup — única função canônica
- Removidas 2 funções/triggers redundantes que sobrescreviam um ao outro
- Hoje só `fn_rebuild_tenant_prompt(varchar)` gera `rendered_prompt`

## Pra onde escala

### Solo (hoje — Paula)
- 1 médico em `tenant_doctors` → 1 bloco no `rendered_prompt`
- Working hours simples
- `business_rules` vazio (defaults sensatos)

### Enterprise dedicada (próximo — clínicas com 5+ médicos)
- Cada médico vira 1 bloco em `rendered_prompt`
- `business_rules` por médico permite divergência (Dr X aceita fds, Dra Y não)
- `safe_create_event` valida regra do `doctor_id` específico (não mistura)
- Token cost: ~877 chars × 5 médicos = ~4.4KB Camada 2 (ainda OK em 1M)

### Marketplace sob consulta (futuro — clínicas heterogêneas)
- Talvez precise variantes do `systemMessage` por **vertical** (psico vs oftalmo vs fisio)
- Path provável: agentes especializados (1 workflow N8N por vertical) com sub-workflows comuns (`safe_create_event`, etc)
- Decisão pendente até ter 2-3 verticais reais

## Métricas a observar (post-deploy de M1)

```sql
-- Quantas validações server-side por dia
SELECT
  DATE(created_at) AS dia,
  message->'content'->>'success' AS resultado,
  message->'content'->>'reason' AS motivo,
  COUNT(*) AS total
FROM n8n_historico_mensagens
WHERE message->>'name' = 'safe_create_event'
  AND created_at > now() - interval '14 days'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 4 DESC;

-- Médicos sem business_rules configurado (oportunidade de tightening)
SELECT tenant_id, doctor_name, business_rules
FROM tenant_doctors
WHERE status = 'active' AND business_rules = '{}'::jsonb;
```

## Follow-ups identificados (não bloqueantes)

1. **LangChain memory loga só 4 tool calls em 14d** (anomalia)
   - Investigar settings do AI Agent (returnIntermediateSteps?)
   - Provavelmente fix em UI N8N: `Secretária node → Options → Return Intermediate Steps = true`
2. **`safe_create_event` aceita só `doctor_id`**
   - Adicionar fallback `doctor_name` (lookup interno) pro LLM não precisar memorizar UUIDs
3. **Sem versionamento de prompt**
   - Hoje: edita systemMessage no UI N8N e perde histórico
   - Considerar: pasta `n8n-prompts/` no repo com diff git, sync via SDK
4. **Sem evals automatizados**
   - Quando enterprise vier, qualquer mudança de prompt vai ter risco regressão
   - Considerar: dataset de 20-50 conversas marcadas como "ouro" + script que roda agente sintético
5. **`assistant_prompt` desperdiçado** (vazio na Paula)
   - UI `/painel/configuracoes` poderia ter exemplos pré-prontos

## Onde encontrar tudo

| Recurso | Path |
|---|---|
| Workflow ATIVO Master Secretária | https://n8n.singulare.org/workflow/OOT4JZyKZUyB0SxB |
| Workflow safe_create_event | https://n8n.singulare.org/workflow/t7d0reakz8IMPDBp |
| Skill arquitetura (pra Claude Code) | `~/.claude/skills/singulare-appointment-rules/SKILL.md` |
| Patch UI M4 (source of truth) | `docs/n8n-patch-M4-source-of-truth.md` |
| Patch UI M1 (plugar safe_create_event) | `docs/n8n-patch-M1-safe-create-event.md` |
| Backup pré-Caminho-3 | `.n8n-backups/master-secretaria-OOT4JZyKZUyB0SxB-pre-M1234-*.json` |
