# NPS workflow migrado pra DB-source — APLICADO 2026-05-09 via API

**Workflow:** `3. NPS Pesquisa Pós-Consulta` (`87vZl62KFCOqFbyI`)
**Status:** ATIVO, mudanças via PUT API n8n

## O que mudou

### Removido (4 nós)
- `List Events Today` (googleCalendar)
- `Filter + Extract` (code)
- `Dedupe` (postgres)
- `Já enviou hoje?` (if)

### Adicionado (1 nó)
- `List Bookings Completed Today` (postgres) — substitui os 4 acima com query única

```sql
SELECT
  b.id::text                AS booking_id,
  b.tenant_id,
  b.patient_name,
  b.patient_phone,
  b.slot_start              AS appointment_date,
  d.doctor_name,
  t.evolution_instance_name,
  t.chatwoot_url,
  t.chatwoot_account_id,
  t.chatwoot_inbox_id
FROM public.doctor_bookings b
JOIN public.tenant_doctors d ON d.id = b.doctor_id
JOIN public.tenants t        ON t.tenant_id = b.tenant_id
WHERE b.doctor_id = '{{ $json.doctor_id }}'
  AND b.status = 'completed'
  AND (b.slot_start AT TIME ZONE 'America/Sao_Paulo')::date
      = ((now() AT TIME ZONE 'America/Sao_Paulo')::date)
  AND NOT EXISTS (
    SELECT 1 FROM public.patient_feedback f
    WHERE f.booking_id = b.id
  );
```

A query já filtra (status=completed + hoje em BRT) E faz dedupe via NOT EXISTS
em `patient_feedback.booking_id`. Não precisa mais dos 3 nós intermediários.

### Atualizado
- `Insert Pending` → agora inclui campo `booking_id` no INSERT (FK pra `doctor_bookings`)

## Topologia nova

```
Cron 19:00 BRT → List Doctors → Loop Doctors[1] → List Bookings Completed Today
                                                  ↓
                                                Insert Pending → Chatwoot Send
                                                  ↓
                                                Send OK? → [ok] Loop Doctors
                                                          → [fail] Mark Send Failed → Loop Doctors
```

(Loop Doctors[0] continua → Done quando termina iteração)

## Workflow Marketing → Review GATILHO criado

**Workflow:** `Master Secretária — NPS Pre-Router` (`ZWzRBjClOdA5xRNQ`)

Adicionado nó **`Trigger Marketing Review`** (httpRequest) entre `Reply Thanks`
e `Return: handled score`. Topologia:

```
Save NPS Score → Score <= 6?
  [0] true  → Reply Followup Ask → Return
  [1] false → Reply Thanks → Trigger Marketing Review → Return
```

Ou seja: SÓ dispara webhook Marketing quando paciente respondeu NPS >= 7. O
webhook M01 (`marketing-nps-review`) internamente filtra >= 9 e
`google_place_id IS NOT NULL` antes de enviar a mensagem de pedir review.

**HTTP config:**
- Method: POST
- URL: `http://n8n:5678/webhook/marketing-nps-review` (interno, mesma rede)
- Body: `{ "feedback_id": {{ $('Lookup Pending NPS').item.json.id }} }`
- onError: `continueRegularOutput` — falha não quebra o fluxo NPS

## Validação

Todos workflows ATIVOS após mudanças. Próxima execução automática:
- NPS workflow: hoje 19h BRT (cron diário)
- NPS Pre-Router: a cada mensagem de paciente recebida

Pra teste manual sem aguardar:
1. https://n8n.singulare.org/workflow/87vZl62KFCOqFbyI → **Execute Workflow**
2. Inspeciona output do nó `List Bookings Completed Today` — deve listar
   bookings completed de hoje com `booking_id` populado
3. Inspeciona `Insert Pending` — INSERT deve incluir `booking_id`
4. Confere `patient_feedback` no DB:
   ```sql
   SELECT id, patient_name, booking_id, sent_at, status
   FROM patient_feedback
   WHERE sent_at::date = CURRENT_DATE
   ORDER BY id DESC LIMIT 10;
   ```

## Rollback

Histórico de versão do n8n preserva versão anterior. Restaurar via:
- Workflow → menu (⋯) → "Workflow versions" → versão anterior a 2026-05-09 → Restore
