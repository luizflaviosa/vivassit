# A01 Confirmação Diária — Migrado pra DB-source

**Workflow:** `A01 — Disparador · Confirmações Diárias de Consulta · v1.0`
**ID:** `sOB9YWGkmDpW3NP4`
**Data da migração:** 2026-05-09 (via API n8n)
**Estratégia escolhida:** Opção A — manter LLM (Gemini) como compositor

## O que mudou

### Antes (lia GCal via MCP)

```
Gatilho Diário → Buscar Tenants Ativos → Loop Tenants → Info Tenant
   → Assistente de confirmação (Gemini Agent)
        tools: MCP Google Calendar, Enviar agendamento, Salvar memoria, Refletir1
        memory: Postgres Chat Memory
```

O agente recebia instruções "liste eventos do GCal de amanhã, pegue
patient_phone na descrição". Bookings sem `calendar_event_id` ou eventos
mal-formatados sumiam.

### Depois (lê doctor_bookings)

```
Gatilho Diário → Buscar Tenants Ativos → Loop Tenants → Info Tenant
   → Assistente de confirmação (Gemini Agent)
        tools: Listar_consultas_amanha (NEW · postgresTool), Enviar agendamento,
               Salvar memoria, Refletir1
        memory: Postgres Chat Memory
```

**Nó novo `Listar_consultas_amanha`** — postgresTool com query:

```sql
SELECT
  b.id::text                                        AS booking_id,
  b.patient_name,
  b.patient_phone,
  b.conversation_id,
  d.doctor_name,
  d.specialty,
  TO_CHAR(b.slot_start AT TIME ZONE 'America/Sao_Paulo',
          'TMDay, DD/MM "às" HH24:MI')              AS quando_formatado,
  (b.slot_start AT TIME ZONE 'America/Sao_Paulo')::text AS slot_start_brt
FROM public.doctor_bookings b
JOIN public.tenant_doctors d ON d.id = b.doctor_id
WHERE b.tenant_id = '{{ $('Info Tenant').item.json.tenant_id }}'
  AND b.status IN ('booked','confirmed')
  AND (b.slot_start AT TIME ZONE 'America/Sao_Paulo')::date
      = ((now() AT TIME ZONE 'America/Sao_Paulo')::date + 1)
ORDER BY b.slot_start;
```

**System message atualizado:** instrui agent a chamar `Listar_consultas_amanha`
PRIMEIRO, depois iterar sobre cada linha enviando confirmação. Mantém regras
existentes (não revelar booking_id, usar Salvar_memoria após cada envio,
Refletir1 antes de operações complexas).

## Ganhos

- **100% das consultas reais cobertas** — não depende de sync GCal estar perfeito
- **+ campo `quando_formatado`** já formatado em PT-BR ("Quinta, 14/05 às 14:00") evita LLM ter que parsear datas
- **+ campo `conversation_id`** linkado direto da booking (antes vinha da descrição do GCal, frágil)
- **Respeita `status='cancelled'`** — booking cancelado entre criação e D-1 não dispara confirmação
- **Fallback robusto** — se zero consultas amanhã, agent encerra limpo via Salvar_memoria

## Não mudou (preservado)

- LLM Gemini compõe mensagem com personalidade do tenant (`assistant_prompt`)
- Tool `Enviar agendamento` (manda WhatsApp via Chatwoot)
- Tool `Salvar memoria` (registra no chat memory)
- Tool `Refletir1` (raciocínio interno)
- Memory `Postgres Chat Memory`
- Pre-Router `Master Secretária — Confirmação Pre-Router` (`OqxxLRm33tSe69HS`)
  continua interceptando respostas sim/cancelar/reagendar antes do AI agent
  principal

## Validação pós-migração (próxima execução: amanhã 8h BRT)

A próxima rodada do cron disparará seg-sex 8h. Pra validar antes:

1. Abre https://n8n.singulare.org/workflow/sOB9YWGkmDpW3NP4
2. Clica **Execute Workflow** (disparo manual)
3. Inspeciona output do nó `Loop Tenants → Assistente de confirmação`
4. Confere que o agent chamou `Listar_consultas_amanha` e iterou pelas linhas
5. Em DEV: trocar query temporariamente pra `(...)::date = (now() AT TIME ZONE
   'America/Sao_Paulo')::date` (hoje em vez de amanhã) pra testar com dados reais

## Rollback

Se algo der errado, restaurar via histórico do n8n:
1. Workflow → menu (⋯) → "Workflow versions"
2. Selecionar versão de 2026-05-09 (antes da migração)
3. "Restore"

Original tinha 11 nodes incluindo `MCP Google Calendar`. Versão nova também
tem 11 nodes mas com `Listar_consultas_amanha` no lugar.
