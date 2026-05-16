-- ============================================================================
-- Tenant + médico dedicados pra suite E2E do agente IA
-- ============================================================================
-- IMPORTANTE: este tenant é isolado. Bookings, histórico e patient_state
-- gerados pela suite ficam marcados com tenant_id = 'singulare-e2e'.
-- Limpeza após cada rodada via DELETE WHERE tenant_id = 'singulare-e2e'.
-- ============================================================================

INSERT INTO tenants (
  tenant_id,
  clinic_name,
  email,
  phone,
  address,
  city,
  state,
  plan_type,
  status,
  doctor_name,
  speciality,
  consultation_duration,
  establishment_type,
  chatwoot_url,
  chatwoot_account_id,
  chatwoot_inbox_id,
  evolution_instance_name,
  evolution_phone_number,
  assistant_prompt
)
VALUES (
  'singulare-e2e',
  'Clinica E2E Testes',
  'e2e-tests@singulare.org',
  '+5511900000000',
  'Rua de Teste, 1 - Sao Paulo - SP',
  'Sao Paulo',
  'SP',
  'enterprise',
  'active',
  'Dra. Teste E2E',
  'Reumatologia',
  60,
  'small_clinic',
  'https://chatwoot.singulare.org',
  '1',
  '3',
  'singulare-e2e',
  '+5511900000000',
  'Tenant isolado pra suite automatizada de testes E2E. Nao usar pra atendimento real.'
)
ON CONFLICT (tenant_id) DO UPDATE
  SET clinic_name = EXCLUDED.clinic_name,
      status = EXCLUDED.status,
      updated_at = NOW();

INSERT INTO tenant_doctors (
  tenant_id,
  doctor_name,
  doctor_crm,
  specialty,
  status,
  consultation_value,
  payment_methods,
  address,
  contact_phone,
  contact_email,
  working_hours,
  consultation_duration,
  accepts_insurance,
  insurance_note,
  followup_value,
  followup_duration,
  followup_window_days,
  business_rules,
  doctor_code,
  calendar_id
)
VALUES (
  'singulare-e2e',
  'Dra. Teste E2E',
  'CRM/SP 999999',
  'Reumatologia',
  'active',
  300.00,
  'PIX, dinheiro',
  'Rua de Teste, 1 - Sao Paulo - SP',
  '+5511900000000',
  'e2e-tests@singulare.org',
  jsonb_build_object(
    'seg', '14:00-18:00',
    'ter', 'fechado',
    'qua', 'fechado',
    'qui', '14:00-18:00',
    'sex', '14:00-18:00',
    'sab', 'fechado',
    'dom', 'fechado'
  ),
  60,
  false,
  null,
  0.00,
  30,
  30,
  jsonb_build_object(
    'return_is_free', true,
    'require_birthdate', true,
    'min_advance_hours', 2,
    'max_advance_days', 60
  ),
  999,
  'e2e-test-calendar@singulare.local'
)
ON CONFLICT DO NOTHING;

-- Rebuild rendered_prompt do tenant (trigger automatico cuida disso)
SELECT fn_rebuild_tenant_prompt('singulare-e2e');
