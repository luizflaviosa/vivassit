-- Vincula owner e admin do tenant `singulare` à Dra. Paula Franzon (única doctor do tenant)
-- para que `resolveDoctorScope` no agente interno consiga filtrar consultas por médico.
-- Sem esse vínculo, o owner era tratado como visão coletiva e nunca via "minha agenda".

-- 1. linked_user_id na tabela tenant_doctors aponta pro owner
update public.tenant_doctors
set linked_user_id = '6ae5b6da-2a7e-44f3-8e75-1965fa6fa8b3'::uuid,
    updated_at = now()
where id = 'd52102f7-5507-4416-b902-b5ff5fc12668'::uuid
  and tenant_id = 'singulare'
  and linked_user_id is null;

-- 2. doctor_id no membership do owner
update public.tenant_members
set doctor_id = 'd52102f7-5507-4416-b902-b5ff5fc12668'::uuid
where tenant_id = 'singulare'
  and user_id = '6ae5b6da-2a7e-44f3-8e75-1965fa6fa8b3'::uuid
  and doctor_id is null;

-- 3. doctor_id no membership do admin
update public.tenant_members
set doctor_id = 'd52102f7-5507-4416-b902-b5ff5fc12668'::uuid
where tenant_id = 'singulare'
  and user_id = 'ed215d16-21bc-42e8-a2f2-3654de1f684c'::uuid
  and doctor_id is null;
