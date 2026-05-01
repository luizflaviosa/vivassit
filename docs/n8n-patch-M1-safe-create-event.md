# M1.2 — Plugar `safe_create_event` no Master Secretária

**Patch UI N8N** (não dá pra fazer via SDK sem refazer todo o systemMessage de 14k). Custo: ~10 min. Risco: médio.

## Pré-requisitos
- ✅ Sub-workflow `safe_create_event` (id `t7d0reakz8IMPDBp`) criado e ativo
- ✅ Migration `tenant_doctors.business_rules` aplicada
- ✅ Trigger `fn_rebuild_tenant_prompt` atualizado (única função canônica)

## Mudança 1 — Adicionar tool `safe_create_event` ao agente

1. Abre https://n8n.singulare.org/workflow/OOT4JZyKZUyB0SxB
2. Clica no nó **Secretária** (AI Agent)
3. Vai em **Tools** (subnodes do agente)
4. Adiciona um **Call Sub-Workflow Tool** (tipo `n8n-nodes-langchain.toolWorkflow`)
   - **Name** (visível pro LLM): `safe_create_event`
   - **Description** (CRÍTICA — o LLM lê isso pra decidir quando chamar):
     ```
     SUBSTITUI Criar_evento. Cria evento no Google Calendar APÓS validar
     server-side: dia/horário do médico, janela de antecedência (2h-60d),
     business_rules. Retorna {success:true, event_id} OU {success:false,
     reason: 'closed_day'|'out_of_hours'|'too_soon'|'too_advanced'|'doctor_inactive',
     message}. Use SEMPRE essa tool em vez de Criar_evento direto pra
     evitar agendamentos inválidos.
     ```
   - **Workflow**: seleciona `safe_create_event — Gate Servidor pra Agendamento` (id `t7d0reakz8IMPDBp`)
   - **Workflow Inputs** (mapeamento do que o LLM passa):
     - `tenant_id` = `={{ $('Buscar Config Tenant').item.json.tenant_id }}`
     - `doctor_id` = LLM define (do rendered_prompt: lookup `Calendar ID` ou nome → vai precisar incluir id no rendered_prompt — ver "Mudança 2")
     - `patient_phone` = `={{ $('Info').item.json.telefone }}`
     - `patient_name` = LLM define
     - `patient_birth` = LLM define (opcional)
     - `start_iso` = LLM define (formato ISO 8601 BRT, ex: `2026-05-08T15:00:00-03:00`)
     - `duration_minutes` = LLM define (opcional, default 60)
     - `conversation_id` = `={{ $('Info').item.json.id_conversa }}`
     - `summary` = LLM define (default `Consulta`)

## Mudança 2 — Incluir `doctor_id` no rendered_prompt

Hoje o rendered_prompt mostra `Calendar ID: ff52c2d3...` mas não o `doctor_id` (uuid). O LLM precisa do `doctor_id` pra passar pra `safe_create_event`.

**Opção rápida**: editar `fn_rebuild_tenant_prompt` pra incluir uma linha extra:
```sql
'- Doctor ID (uso interno): ' || (v_doc->>'id') || E'\n'
```

Mas como isso é técnico, melhor:
- **Alternativa**: o `safe_create_event` aceitar `doctor_name` como fallback e fazer lookup. Adicionar input opcional + lógica de fallback em `Lookup Doctor`. Vou marcar isso como TODO no próprio workflow.

## Mudança 3 — Atualizar instruções no systemMessage

No system message do agente Secretária, mudar a referência `Criar_evento` pra `safe_create_event` em:
- `<GUIA_DE_FERRAMENTAS>` linha que descreve `Criar_evento` → trocar por:
  ```
  - "safe_create_event": NOVA. Substitui Criar_evento. Valida server-side antes
    de criar. Sempre use essa, NUNCA Criar_evento direto.
  - "Criar_evento": LEGADO. Não use diretamente — só como fallback se
    safe_create_event retornar erro 'doctor_not_found' ou 'missing_field'.
  ```
- `<FLUXO_SOP_AGENDAMENTO>` PASSO 9 → trocar `Execute "Criar_evento"` por `Execute "safe_create_event"` + lidar com `{success: false}` retornando reason.

## Como testar (sem mexer em produção)

1. Cria conversa de teste em `n8n_historico_mensagens` simulando paciente
2. Manda mensagem: "quero marcar com a Dra. Paula sábado às 10h"
3. Espera o agente chamar `safe_create_event` → deve retornar `{success: false, reason: 'closed_day', message: 'O profissional não atende em sábados...'}`
4. Confere log: `SELECT * FROM n8n_historico_mensagens WHERE message->>'name' = 'safe_create_event' ORDER BY created_at DESC LIMIT 5`
5. Agente deve responder ao paciente em linguagem natural (recusar + ofertar alternativas)

## Rollback

Se algo quebrar:
1. Remove o nó `safe_create_event` do agente Secretária (UI N8N)
2. Restaura referências a `Criar_evento` no systemMessage (do backup `.n8n-backups/master-secretaria-OOT4JZyKZUyB0SxB-pre-M1234-20260501-202757.json`)
3. Desativa workflow `t7d0reakz8IMPDBp` (toggle Active)

## Backup
Workflow Master Secretária ANTES desta mudança: [`.n8n-backups/master-secretaria-OOT4JZyKZUyB0SxB-pre-M1234-20260501-202757.json`](../.n8n-backups/master-secretaria-OOT4JZyKZUyB0SxB-pre-M1234-20260501-202757.json)

## Métrica de sucesso (rodar após 7 dias da Mudança 1)

```sql
-- Quantos agendamentos foram bloqueados pelo gate vs total tentado
SELECT
  message->'content'->>'success' AS resultado,
  message->'content'->>'reason' AS motivo,
  COUNT(*) AS total
FROM n8n_historico_mensagens
WHERE message->>'name' = 'safe_create_event'
  AND created_at > now() - interval '7 days'
GROUP BY 1, 2
ORDER BY total DESC;
```

Esperado: 0 ocorrências de "agendou em fds" no Calendar (verificar via Google Calendar API).
