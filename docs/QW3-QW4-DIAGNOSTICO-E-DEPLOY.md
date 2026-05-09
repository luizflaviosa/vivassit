# Quick Wins do Problem Map — Estado real (corrigido)

Documento gerado pelo Problem Map da Dra. Paula Franzon. Revisado após
descobrirmos que vários workflows JÁ EXISTEM no n8n e estavam só no
`docs/STATUS-DRA-PAULA.md`.

---

## QW7 — Confirmação 24h antes ✅ JÁ EXISTE

**Workflow N8N:** `2. Confirmação Diária` (`sOB9YWGkmDpW3NP4`) — **ATIVO**

- **Cron:** seg-sex às 8h da manhã
- **Lógica:** lista todas consultas do **dia seguinte** (D+1, ~24h antes)
- **Ação:** envia mensagem WhatsApp via Evolution: "Confirma sua consulta amanhã às X?"
- **Captura da resposta:** workflow `Master Secretária — Confirmação Pre-Router`
  (`OqxxLRm33tSe69HS`) intercepta resposta `sim/cancelar/reagendar` e age:
  - `sim` → `appointments.status='confirmed'`
  - `cancelar` → cancela
  - `reagendar` → fluxo de reagendamento

**O que precisa ser verificado:**

⚠️ Workflow lê de `appointments` (legacy) ou `doctor_bookings` (atual)? Após o
commit `ec0451a` migramos as tools internas pra `doctor_bookings`. Se o workflow
ainda lê `appointments`, ele **NÃO ENXERGA bookings recentes** (porque
`appointments` virou tabela morta com 2 seeds dummy).

**Pra validar:** abrir https://n8n.singulare.org/workflow/sOB9YWGkmDpW3NP4 e
checar nó SQL/Postgres — se `FROM appointments`, trocar pra `FROM doctor_bookings`.

**Migration auxiliar aplicada:** colunas `confirmation_sent_at` +
`confirmation_status` em `doctor_bookings` (agora disponíveis pro workflow
n8n marcar idempotência se quiser usar).

**Cron Vercel `/api/cron/booking-confirmations` REVERTIDO:** ia conflitar com o
workflow existente (mandaria 2 mensagens pro mesmo paciente).

---

## QW3 — NPS automático ⚠️ EXISTE MAS INATIVO

**Workflow N8N:** `3. NPS Pesquisa Pós-Consulta` (`87vZl62KFCOqFbyI`) —
**INATIVO**

**Pra ativar:**
1. Abre https://n8n.singulare.org/workflow/87vZl62KFCOqFbyI
2. Toggle **"Active"** no canto superior direito
3. Verifica env vars do n8n:
   - `EVOLUTION_BASE_URL`
   - `EVOLUTION_API_KEY` (se exigir)
4. Clica **"Execute Workflow"** uma vez pra teste
5. Confere `patient_feedback` com novas rows `status=pending`

**Pre-router pra capturar resposta:** documentado em
`docs/n8n/master-secretaria-nps-handler.md` — adicionar 3 nós no início do
workflow `1. Master Secretária` pra interceptar números 0-10 dos pacientes
com NPS pendente.

**ROOT CAUSE confirmado do "1 NPS de 22":**

3 bookings da Paula com `status='completed'` foram analisados:

| Paciente | calendar_event_id | NPS enviado? |
|---|---|---|
| Valentina Souza | NULL | ✅ Sim |
| Joana Pereira | `cal-s24-test` (seed) | ❌ Não |
| Vanessa de Oliveira | NULL | ❌ Não |

O workflow lê **eventos do Google Calendar**, então pula bookings sem sync GCAL.
Como estão INATIVOS hoje, mesmo isso não está rodando — só ativando + corrigindo
o gap arquitetural resolve.

**Fix arquitetural recomendado:** o workflow lê `doctor_bookings.status='completed'`
em vez de Google Calendar. Mais robusto + cobre 100% dos casos.

```sql
SELECT id, patient_phone, patient_name, doctor_id, slot_start
FROM doctor_bookings
WHERE status = 'completed'
  AND slot_start::date = CURRENT_DATE - interval '1 day'
  AND id NOT IN (
    SELECT booking_id FROM patient_feedback WHERE booking_id IS NOT NULL
  );
```

Migration adicional necessária:
```sql
ALTER TABLE patient_feedback ADD COLUMN booking_id uuid
  REFERENCES doctor_bookings(id) ON DELETE SET NULL;
CREATE INDEX idx_patient_feedback_booking ON patient_feedback(booking_id);
```

---

## QW4 — Review Google após NPS ≥ 9 🔴 SPEC PRONTA, NÃO DEPLOYADA

**Workflow N8N:** **NÃO existe ainda**

**Spec:** `docs/n8n/marketing-nps-review.md` (linha-a-linha)

**Endpoint API existe:** `POST /api/painel/marketing/reviews` (chama webhook
`/webhook/request-reviews` no n8n).

**Deploy passos:**

1. Criar workflow no n8n com 5 nós (Webhook → Postgres lookup → IF → Build msg → Evolution send → Postgres log)
2. Configurar webhook URL `/webhook/marketing-nps-review`
3. Ligar o workflow `3. NPS Pesquisa` → quando salvar `nps_score >= 9`,
   chamar HTTP Request pro novo workflow
4. Template msg WhatsApp: "Que bom que sua consulta foi ótima! Avalia em 30s no Google: {{review_url}}"
5. URL Google Review = `https://search.google.com/local/writereview?placeid={{google_place_id}}`

**Bloqueio agora resolvido:** `tenants.google_place_id` é editável em
`/painel/configuracoes` → Presença online (após QW5).

---

## Resumo do estado pós Sprint Quick Wins (corrigido)

| QW | Status real | Próxima ação | Quem faz |
|---|---|---|---|
| 1. Asaas onboarding | 🟡 Backend pronto | Wizard UI | Dev (sprint futuro) |
| 3. NPS automático | ⚠️ Workflow EXISTE inativo | **Ativar workflow `87vZl62KFCOqFbyI` no n8n** | 1min user |
| 4. Review Google | 🔴 Spec pronta | **Criar workflow novo no n8n** seguindo spec | Manual no n8n |
| 5. Cadastro Insta/GMN | ✅ FECHADO | — | — |
| 6. SEO `/profissionais/[cidade]` | ✅ FECHADO | Verificar render em prod | — |
| 7. Confirmação 24h antes | ✅ JÁ EXISTE no n8n | **Verificar se lê de `doctor_bookings` ou legacy `appointments`** | 5min user |

---

## Workaround imediato pro NPS dos 2 órfãos

Pra disparar NPS pra Joana + Vanessa **agora** (antes de fix arquitetural):

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

Após inserir + ativar workflow → próxima rodada 19h dispara WhatsApp.
