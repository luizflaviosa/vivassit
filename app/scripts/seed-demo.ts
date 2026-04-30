/**
 * Seed demo tenant via Supabase Admin SDK.
 * Roda: npx tsx scripts/seed-demo.ts
 *
 * Cria/atualiza:
 *   - auth user demo@singulare.org / SingulareDemo2026!
 *   - tenant 'demo-singulare'
 *   - tenant_member (owner)
 *   - 6 pacientes fake
 *
 * Idempotente. Usa service role (bypassa RLS).
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!url || !serviceRole) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes em .env.local');
  process.exit(1);
}

const TENANT_ID = 'demo-singulare';
const EMAIL = 'demo@singulare.org';
const PASSWORD = 'SingulareDemo2026!';

const PATIENTS = [
  { phone: '+5511999990001', name: 'Mariana Costa Demo',  birthdate: '1992-05-14', total: 8,  daysAgo: 5 },
  { phone: '+5511999990002', name: 'Carlos Almeida Demo', birthdate: '1985-09-22', total: 3,  daysAgo: 12 },
  { phone: '+5511999990003', name: 'Beatriz Souza Demo',  birthdate: '1990-02-08', total: 12, daysAgo: 2 },
  { phone: '+5511999990004', name: 'Pedro Ribeiro Demo',  birthdate: '1978-11-30', total: 5,  daysAgo: 20 },
  { phone: '+5511999990005', name: 'Ana Lima Demo',       birthdate: '1995-07-17', total: 1,  daysAgo: 60 },
  { phone: '+5511999990006', name: 'Lucas Ferreira Demo', birthdate: '1982-03-25', total: 7,  daysAgo: 8 },
];

async function main() {
  const supabase = createClient(url!, serviceRole!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Auth user — admin API
  console.log('1/5 Verificando user demo@singulare.org...');
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error('   ❌ listUsers:', listErr.message);
    process.exit(1);
  }
  let user = list.users.find((u) => u.email === EMAIL);

  if (!user) {
    console.log('   → criando');
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Conta Demo Singulare' },
    });
    if (createErr || !created.user) {
      console.error('   ❌ createUser:', createErr?.message);
      process.exit(1);
    }
    user = created.user;
  } else {
    console.log('   → existe, atualizando senha');
    const { error: updErr } = await supabase.auth.admin.updateUserById(user.id, {
      password: PASSWORD,
      email_confirm: true,
    });
    if (updErr) {
      console.error('   ⚠️  updateUserById:', updErr.message);
    }
  }
  console.log('   user_id =', user!.id);

  // 2. Tenant
  console.log('2/5 Upsert tenant demo-singulare...');
  const { error: tenantErr } = await supabase
    .from('tenants')
    .upsert(
      {
        tenant_id: TENANT_ID,
        clinic_name: 'Singulare Demo',
        email: EMAIL,
        phone: '+5511999990000',
        plan_type: 'professional',
        plan_limits: { max_patients: -1, max_messages_per_month: -1 },
        status: 'active',
        admin_email: EMAIL,
        admin_user_id: user!.id,
        doctor_name: 'Dra. Paula Demo',
        doctor_crm: 'CRM-12345-DEMO',
        speciality: 'Psicologia',
        consultation_duration: 50,
        establishment_type: 'consultorio',
        subscription_status: 'active',
        address: 'Av. Demonstração, 1000 — São Paulo, SP',
        professionals_config: [],
        specialties_config: ['Psicologia'],
      },
      { onConflict: 'tenant_id' }
    );
  if (tenantErr) {
    console.error('   ❌ tenant upsert:', tenantErr.message);
    process.exit(1);
  }
  console.log('   ok');

  // 3. tenant_members
  console.log('3/5 Upsert tenant_member (owner)...');
  const { data: existingMember } = await supabase
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', TENANT_ID)
    .eq('user_id', user!.id)
    .maybeSingle();

  if (existingMember) {
    await supabase
      .from('tenant_members')
      .update({ role: 'owner', status: 'active', updated_at: new Date().toISOString() })
      .eq('id', existingMember.id);
  } else {
    const { error: memErr } = await supabase.from('tenant_members').insert({
      tenant_id: TENANT_ID,
      user_id: user!.id,
      role: 'owner',
      status: 'active',
      accepted_at: new Date().toISOString(),
    });
    if (memErr) {
      console.error('   ❌ member insert:', memErr.message);
      process.exit(1);
    }
  }
  console.log('   ok');

  // 4. Limpa pacientes anteriores do tenant demo
  console.log('4/5 Limpando pacientes demo antigos...');
  await supabase.from('patients').delete().eq('tenant_id', TENANT_ID);

  // 5. Insere pacientes fake
  console.log('5/5 Inserindo 6 pacientes fake...');
  const now = Date.now();
  const rows = PATIENTS.map((p) => ({
    tenant_id: TENANT_ID,
    phone: p.phone,
    name: p.name,
    birthdate: p.birthdate,
    email: p.name.toLowerCase().split(' ')[0] + '.demo@example.com',
    doctor_preference: 'Dra. Paula Demo',
    total_consultations: p.total,
    last_visit_at: new Date(now - p.daysAgo * 86400000).toISOString(),
    last_doctor: 'Dra. Paula Demo',
    notes: 'Paciente demo',
    tags: [],
  }));
  const { error: patErr } = await supabase.from('patients').insert(rows);
  if (patErr) {
    console.error('   ❌ patients insert:', patErr.message);
    process.exit(1);
  }
  console.log('   ok');

  console.log('\n✨ Seed completo.');
  console.log('   Email: demo@singulare.org');
  console.log('   Senha: SingulareDemo2026!');
  console.log('   Tenant: demo-singulare');
  console.log('\nPróximo: npm run dev (em outro terminal) + npm run screenshot:painel');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
