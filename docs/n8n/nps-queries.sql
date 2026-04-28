-- docs/n8n/nps-queries.sql
-- SQL pra colar nos Postgres nodes dos workflows n8n.
-- Cada bloco é uma query independente — nome do bloco indica o nó destino.

-- ============================================================================
-- WORKFLOW "3. NPS Pesquisa Pós-Consulta"
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Nó: "List Tenants"
-- ----------------------------------------------------------------------------
SELECT
  tenant_id,
  clinic_name,
  evolution_instance_name,
  evolution_phone_number
FROM public.tenants
WHERE evolution_status = 'connected'
  AND evolution_instance_name IS NOT NULL;


-- ----------------------------------------------------------------------------
-- Nó: "List Doctors" (parametrizado por tenant_id do loop)
-- Parâmetro $1 = {{ $json.tenant_id }}
-- ----------------------------------------------------------------------------
SELECT
  id           AS doctor_id,
  doctor_name,
  calendar_id
FROM public.tenant_doctors
WHERE tenant_id = $1
  AND status = 'active'
  AND calendar_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- Nó: "Dedupe" (parametrizado)
-- $1 = tenant_id, $2 = patient_phone (E.164)
-- Retorna 1 row se já existe pesquisa hoje pra esse paciente nesse tenant.
-- ----------------------------------------------------------------------------
SELECT 1
FROM public.patient_feedback
WHERE tenant_id = $1
  AND patient_phone = $2
  AND appointment_date::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date
LIMIT 1;


-- ----------------------------------------------------------------------------
-- Nó: "Insert Pending"
-- $1 = tenant_id, $2 = patient_name, $3 = patient_phone,
-- $4 = doctor_name, $5 = appointment_date (timestamp do event.start.dateTime)
-- ----------------------------------------------------------------------------
INSERT INTO public.patient_feedback
  (tenant_id, patient_name, patient_phone, doctor_name,
   appointment_date, status, sent_at)
VALUES
  ($1, $2, $3, $4, $5, 'pending', now())
RETURNING id;


-- ----------------------------------------------------------------------------
-- Nó: "Mark Send Failed" (rollback de envio)
-- $1 = id do row recém-inserido
-- ----------------------------------------------------------------------------
UPDATE public.patient_feedback
SET status = 'send_failed'
WHERE id = $1;


-- ============================================================================
-- WORKFLOW "1. Master Secretária" — pre-router NPS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Nó: "Lookup Pending NPS"
-- $1 = tenant_id, $2 = patient_phone (E.164, msg recebida)
-- ----------------------------------------------------------------------------
SELECT id, status, nps_score
FROM public.patient_feedback
WHERE tenant_id = $1
  AND patient_phone = $2
  AND status IN ('pending', 'awaiting_followup')
  AND sent_at > now() - interval '24 hours'
ORDER BY sent_at DESC
LIMIT 1;


-- ----------------------------------------------------------------------------
-- Nó: "Save Score" (resposta numérica 0-10)
-- $1 = nps_score (int), $2 = id do feedback row
-- ----------------------------------------------------------------------------
UPDATE public.patient_feedback
SET nps_score = $1,
    responded_at = now(),
    status = CASE WHEN $1 <= 6 THEN 'awaiting_followup' ELSE 'closed' END
WHERE id = $2
RETURNING status, nps_score;


-- ----------------------------------------------------------------------------
-- Nó: "Save Feedback Text" (texto livre após nota baixa)
-- $1 = feedback_text, $2 = id do feedback row
-- ----------------------------------------------------------------------------
UPDATE public.patient_feedback
SET feedback_text = $1,
    status = 'closed'
WHERE id = $2;
