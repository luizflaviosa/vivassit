# Migração workflow NPS — Fonte GCal → DB (5 min manual)

Workflow: `3. NPS Pesquisa Pós-Consulta` (`87vZl62KFCOqFbyI`)

## Por quê

Hoje o workflow lê de Google Calendar (`List Events Today` node), então
bookings sem `calendar_event_id` (~9 dos 22 da Paula) **nunca disparam NPS**.

Migração faz fonte ser `doctor_bookings.status='completed'` — pega 100%.

## Mudanças no workflow (n8n UI)

### 1. Renomear nó "List Events Today"

Em `https://n8n.singulare.org/workflow/87vZl62KFCOqFbyI`:

- Acha o nó **"List Events Today"** (tipo googleCalendar)
- Clica nele → muda para **Postgres** node
- Renomeia pra **"List Completed Bookings Today"**
- Cola query SQL abaixo

### 2. Query SQL nova

```sql
SELECT
  b.id                   AS booking_id,
  b.tenant_id,
  b.patient_name,
  b.patient_phone,
  b.slot_start           AS appointment_date,
  d.doctor_name,
  t.evolution_instance_name,
  t.chatwoot_url,
  t.chatwoot_account_id,
  t.chatwoot_inbox_id
FROM public.doctor_bookings b
JOIN public.tenant_doctors d ON d.id = b.doctor_id
JOIN public.tenants t        ON t.tenant_id = b.tenant_id
WHERE b.doctor_id = '{{ $json.doctor_id }}'
  AND b.status   = 'completed'
  AND b.slot_start::date = ((now() AT TIME ZONE 'America/Sao_Paulo')::date)
  AND NOT EXISTS (
    SELECT 1 FROM public.patient_feedback f
    WHERE f.booking_id = b.id
  );
```

**O que a query faz:**
- Filtra `doctor_bookings.status='completed'` (não depende de GCal)
- `slot_start::date = hoje em BRT` (mesma janela do antigo)
- `NOT EXISTS` no `patient_feedback.booking_id` evita reenvio (dedupe via FK
  nova adicionada pela migration `patient_feedback_booking_link`)
- Já traz tenant + chatwoot pra próximos nós

### 3. Atualizar nó "Filter + Extract"

Como a query nova já filtra e extrai, esse nó vira simples passagem. Ou pode
**deletar** e conectar direto `List Completed Bookings Today → Insert Pending`.

### 4. Atualizar nó "Insert Pending"

Adiciona o campo `booking_id` no INSERT:

```sql
INSERT INTO public.patient_feedback
  (tenant_id, patient_name, patient_phone, doctor_name,
   appointment_date, status, sent_at, booking_id)
VALUES
  ('{{ $('List Completed Bookings Today').item.json.tenant_id }}',
   '{{ $('List Completed Bookings Today').item.json.patient_name }}',
   '{{ $('List Completed Bookings Today').item.json.patient_phone }}',
   '{{ $('List Completed Bookings Today').item.json.doctor_name }}',
   '{{ $('List Completed Bookings Today').item.json.appointment_date }}',
   'pending',
   NOW(),
   '{{ $('List Completed Bookings Today').item.json.booking_id }}')
RETURNING id;
```

### 5. Deletar nó "Dedupe"

A query nova já dedupe via `NOT EXISTS`. Apaga o nó "Dedupe" + o IF "Já enviou hoje?".

Conexão fica:

```
Cron → List Doctors → Loop → List Completed Bookings Today
                              → Insert Pending → Chatwoot Send → ...
```

## Migration de DB já aplicada

```sql
-- Já rodada em 2026-05-09
ALTER TABLE patient_feedback
  ADD COLUMN booking_id uuid REFERENCES doctor_bookings(id) ON DELETE SET NULL;
CREATE INDEX idx_patient_feedback_booking ON patient_feedback(booking_id) WHERE booking_id IS NOT NULL;
```

## Backfill imediato pros 22→1 da Paula

Pra disparar NPS pros bookings completed que ficaram pendentes:

```sql
INSERT INTO patient_feedback (
  tenant_id, patient_phone, patient_name, doctor_name,
  appointment_date, sent_at, status, booking_id
)
SELECT
  b.tenant_id, b.patient_phone, b.patient_name, d.doctor_name,
  b.slot_start, NOW(), 'pending', b.id
FROM doctor_bookings b
JOIN tenant_doctors d ON d.id = b.doctor_id
WHERE b.tenant_id = 'singulare'
  AND b.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM patient_feedback f WHERE f.booking_id = b.id
  );
```

Roda 1× — próxima execução do cron 19h vai mandar WhatsApp pra essas rows.

## Validação pós-migration

1. **Save** o workflow no n8n
2. **Execute Workflow** manualmente uma vez (botão no canto superior)
3. Inspeciona output do nó "List Completed Bookings Today" — deve listar
   bookings de hoje completed sem feedback
4. Confere `patient_feedback` no DB tem novas rows com `status='pending'` +
   `booking_id` populado
5. Aguarda Chatwoot/Evolution disparar mensagem

Se algo falhar, o original vai estar no histórico de versões do n8n —
basta restaurar.
