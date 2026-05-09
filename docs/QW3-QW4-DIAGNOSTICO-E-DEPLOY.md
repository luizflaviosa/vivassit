# QW3 + QW4 — Diagnóstico NPS e Deploy do Review Google

Documento gerado pelo Problem Map da Dra. Paula Franzon. Status do diagnóstico
e instruções de deploy do que falta pra fechar o ciclo de feedback.

---

## QW3 — NPS automático para 100% dos completed

### Sintoma

Apenas 1 NPS enviado de 22 pacientes que passaram pela Paula no mês.
Esperado: ~22.

### Diagnóstico (validado em DB)

3 bookings com `status = 'completed'` no tenant `singulare`:

| Booking | Paciente | calendar_event_id | NPS enviado? |
|---|---|---|---|
| 9102a7ca... | Valentina Souza | NULL | ✅ Sim |
| e0000000... | Joana Pereira | `cal-s24-test` (seed) | ❌ Não |
| 648f1465... | Vanessa de Oliveira | NULL | ❌ Não |

**Root cause:** o workflow N8N "3. NPS Pesquisa" lê **eventos do Google Calendar**
em vez de `doctor_bookings.status='completed'`.

Resultado: bookings que nunca foram sincronizados pro Google Calendar
(`calendar_event_id IS NULL`) ou que têm event_id inválido (seeds de teste)
**não disparam NPS, mesmo marcados como completed**.

A única que recebeu (Valentina) provavelmente teve o cron do GCAL em ordem na
janela certa, ou a workflow tem fallback diferente.

### Fix arquitetural (recomendado)

Mudar a fonte do workflow de **Google Calendar** → **doctor_bookings**:

```sql
SELECT id, patient_phone, patient_name, doctor_id, slot_start
FROM doctor_bookings
WHERE status = 'completed'
  AND slot_start::date = CURRENT_DATE - interval '1 day'
  AND id NOT IN (
    SELECT booking_id FROM patient_feedback WHERE booking_id IS NOT NULL
  );
```

Vantagens vs ler GCAL:
- Não depende de sync GCAL → tenant_calendar_events
- Funciona pra bookings criados manualmente
- DB é source of truth de status
- 1 query indexada vs N chamadas Google API

**Migration adicional necessária** se for esse caminho:
```sql
ALTER TABLE patient_feedback ADD COLUMN booking_id uuid
  REFERENCES doctor_bookings(id) ON DELETE SET NULL;
CREATE INDEX idx_patient_feedback_booking ON patient_feedback(booking_id);
```

### Workaround imediato (5min, sem mexer no n8n)

Pra disparar NPS pra Joana + Vanessa **agora**, inserir manualmente:

```sql
INSERT INTO patient_feedback (
  tenant_id, patient_phone, patient_name, doctor_name,
  appointment_date, sent_at, status
)
SELECT
  b.tenant_id, b.patient_phone, b.patient_name, d.doctor_name,
  b.slot_start, NOW(), 'pending'
FROM doctor_bookings b
JOIN tenant_doctors d ON d.id = b.doctor_id
WHERE b.tenant_id = 'singulare'
  AND b.status = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM patient_feedback f
    WHERE f.tenant_id = b.tenant_id
      AND f.patient_phone = b.patient_phone
      AND f.appointment_date::date = b.slot_start::date
  );
```

Depois disso, o workflow envia o WhatsApp na próxima rodada de 19h.

---

## QW4 — Review Google após NPS ≥ 9

### Status

- ✅ Spec do workflow documentada em `docs/n8n/marketing-nps-review.md`
- ✅ Endpoint `/api/painel/marketing/reviews` existe pra triggar manualmente
- 🔴 **Workflow não deployado no n8n**
- 🔴 Cliente precisa ter `tenants.google_place_id` preenchido (campo agora editável em /painel/configuracoes após QW5)

### Pra deployar

**Pré-requisitos:**
1. n8n acessível em `n8n.singulare.org`
2. Webhook URL pública: `https://n8n.singulare.org/webhook/request-reviews`
3. Credentials: Header Auth `N8N_TO_VERCEL_TOKEN` (já existe)
4. Evolution API rodando + credenciais configuradas

**Passos:**

1. **Criar workflow no n8n** com 3 nós:
   - **Webhook** (POST `/webhook/request-reviews`)
   - **HTTP Request** (lookup tenant)
   - **WhatsApp Send** (Evolution)

2. **Trigger via update no patient_feedback**: precisa de mais 1 nó na entrada do
   workflow NPS atual (3. NPS Pesquisa) que detecta `nps_score >= 9` e dispara
   webhook deste novo workflow.

3. **Template da mensagem WhatsApp** (sugestão):
   ```
   Olá {{$json.patient_name}}, tudo bem?

   Que bom que você teve uma boa experiência com {{$json.doctor_name}}!
   Se quiser ajudar a gente a chegar em mais pacientes, deixa uma avaliação
   no Google em 30 segundos:

   {{$json.google_review_url}}

   Obrigada!
   ```

4. **URL Google Review**: a URL é construída assim:
   ```
   https://search.google.com/local/writereview?placeid={{google_place_id}}
   ```

5. **Após criar o workflow no n8n**, testar disparando manualmente:
   ```bash
   curl -X POST https://app.singulare.org/api/painel/marketing/reviews \
     -H "Cookie: <session_cookie>" \
     -H "Content-Type: application/json" \
     -d '{"patient_phone": "+5511988923331"}'
   ```

### Bloqueio resolvido por QW5

A coluna `tenants.google_place_id` agora está **editável** em `/painel/configuracoes`
(seção "Presença online"). Antes de rodar o workflow QW4, a Paula precisa:

1. Pegar o Google Place ID em https://business.google.com → Sobre a empresa
2. Colar em Configurações → Presença online → Google Place ID
3. Salvar

Sem isso, o workflow não tem URL pra mandar.

---

## Resumo do estado pós Sprint Quick Wins

| QW | Status atual | Próxima ação | Quem faz |
|---|---|---|---|
| 1. Asaas onboarding | 🟡 Backend pronto | Wizard UI | Dev (sprint futuro) |
| 3. NPS automático 100% | 🔴 Refactor n8n | Mudar fonte pra `doctor_bookings` | Dev + n8n |
| 4. Review Google após NPS≥9 | 🟡 Spec pronta | Deployar workflow n8n | Manual no n8n.singulare.org |
| 5. Cadastro Insta/GMN | ✅ FECHADO | — | — |
| 6. SEO `/profissionais/[cidade]` | ✅ FECHADO (JSON-LD + breadcrumb + copy) | Verificar render em prod | — |
| 7. Confirmação 24h antes | 🟡 Cron + endpoint prontos | Workflow n8n + setar `N8N_BOOKING_CONFIRMATION_URL` | Manual no n8n |
