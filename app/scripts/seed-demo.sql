-- ============================================================
-- SEED DEMO TENANT — Singulare Demo
-- Cole este bloco no Supabase Studio → SQL Editor → Run.
-- Cria 1 usuário fake + tenant fake + 6 pacientes fake (nomes inventados, sem PHI real).
-- Idempotente: pode rodar múltiplas vezes sem duplicar.
-- ============================================================

DO $$
DECLARE
  v_user_id uuid;
  v_tenant_id varchar := 'demo-singulare';
BEGIN
  -- 1. Criar/upsert auth user com senha
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'demo@singulare.org',
    crypt('SingulareDemo2026!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Conta Demo Singulare"}'::jsonb,
    now(), now(),
    '', '', '', ''
  )
  ON CONFLICT (email) DO UPDATE SET
    encrypted_password = EXCLUDED.encrypted_password,
    updated_at = now()
  RETURNING id INTO v_user_id;

  -- Caso já existisse (ON CONFLICT DO UPDATE pode não retornar), buscar
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'demo@singulare.org';
  END IF;

  -- 2. auth.identities (necessário pra signInWithPassword funcionar)
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', 'demo@singulare.org', 'email_verified', true),
    'email',
    now(), now(), now()
  )
  ON CONFLICT (provider, provider_id) DO NOTHING;

  -- 3. Tenant Demo
  INSERT INTO public.tenants (
    tenant_id, clinic_name, email, phone, plan_type, plan_limits,
    status, admin_email, admin_user_id,
    doctor_name, doctor_crm, speciality, consultation_duration,
    establishment_type, subscription_status,
    address, professionals_config, specialties_config,
    created_at, updated_at
  )
  VALUES (
    v_tenant_id,
    'Singulare Demo',
    'demo@singulare.org',
    '+5511999990000',
    'professional',
    '{"max_patients": -1, "max_messages_per_month": -1}'::jsonb,
    'active',
    'demo@singulare.org',
    v_user_id,
    'Dra. Paula Demo',
    'CRM-12345-DEMO',
    'Psicologia',
    50,
    'consultorio',
    'active',
    'Av. Demonstração, 1000 — São Paulo, SP',
    '[]'::jsonb,
    '["Psicologia"]'::jsonb,
    now(), now()
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    clinic_name = EXCLUDED.clinic_name,
    admin_user_id = EXCLUDED.admin_user_id,
    updated_at = now();

  -- 4. tenant_members — owner
  INSERT INTO public.tenant_members (
    id, tenant_id, user_id, role, status,
    accepted_at, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_tenant_id,
    v_user_id,
    'owner',
    'active',
    now(), now(), now()
  )
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET
    role = 'owner',
    status = 'active',
    updated_at = now();

  -- 5. Pacientes fake (nomes inventados, telefones inválidos +5511999990001..)
  INSERT INTO public.patients (
    tenant_id, phone, name, birthdate, email,
    doctor_preference, total_consultations, last_visit_at, last_doctor,
    notes, tags, created_at, updated_at
  )
  VALUES
    (v_tenant_id, '+5511999990001', 'Mariana Costa Demo',  '1992-05-14', 'mariana.demo@example.com',
     'Dra. Paula Demo', 8, now() - interval '5 days',  'Dra. Paula Demo', 'Paciente demo', '[]'::jsonb, now(), now()),
    (v_tenant_id, '+5511999990002', 'Carlos Almeida Demo', '1985-09-22', 'carlos.demo@example.com',
     'Dra. Paula Demo', 3, now() - interval '12 days', 'Dra. Paula Demo', 'Paciente demo', '[]'::jsonb, now(), now()),
    (v_tenant_id, '+5511999990003', 'Beatriz Souza Demo',  '1990-02-08', 'beatriz.demo@example.com',
     'Dra. Paula Demo', 12, now() - interval '2 days', 'Dra. Paula Demo', 'Paciente demo', '[]'::jsonb, now(), now()),
    (v_tenant_id, '+5511999990004', 'Pedro Ribeiro Demo',  '1978-11-30', 'pedro.demo@example.com',
     'Dra. Paula Demo', 5, now() - interval '20 days', 'Dra. Paula Demo', 'Paciente demo', '[]'::jsonb, now(), now()),
    (v_tenant_id, '+5511999990005', 'Ana Lima Demo',       '1995-07-17', 'ana.demo@example.com',
     'Dra. Paula Demo', 1, now() - interval '60 days', 'Dra. Paula Demo', 'Paciente demo', '[]'::jsonb, now(), now()),
    (v_tenant_id, '+5511999990006', 'Lucas Ferreira Demo', '1982-03-25', 'lucas.demo@example.com',
     'Dra. Paula Demo', 7, now() - interval '8 days',  'Dra. Paula Demo', 'Paciente demo', '[]'::jsonb, now(), now())
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Demo seed concluído. user_id=% tenant_id=%', v_user_id, v_tenant_id;
END $$;

-- Para limpar depois:
-- DELETE FROM public.patients WHERE tenant_id = 'demo-singulare';
-- DELETE FROM public.tenant_members WHERE tenant_id = 'demo-singulare';
-- DELETE FROM public.tenants WHERE tenant_id = 'demo-singulare';
-- DELETE FROM auth.identities WHERE user_id = (SELECT id FROM auth.users WHERE email='demo@singulare.org');
-- DELETE FROM auth.users WHERE email = 'demo@singulare.org';
