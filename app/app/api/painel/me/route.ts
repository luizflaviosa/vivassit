import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

// Retorna o tenant do usuario autenticado.
// Estrategia: 1) procura por tenants.admin_user_id = user.id
//             2) fallback: tenants.admin_email = user.email (auto-link)

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, message: 'unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdmin();

  // Tenta por admin_user_id
  let { data: tenant } = await admin
    .from('tenants')
    .select('tenant_id, clinic_name, plan_type, subscription_status, admin_email')
    .eq('admin_user_id', user.id)
    .maybeSingle();

  // Fallback: por admin_email (pega o mais recente se houver multiplos)
  if (!tenant && user.email) {
    const { data: byEmailList } = await admin
      .from('tenants')
      .select('tenant_id, clinic_name, plan_type, subscription_status, admin_email')
      .eq('admin_email', user.email)
      .order('created_at', { ascending: false })
      .limit(1);
    const byEmail = byEmailList?.[0];
    if (byEmail) {
      tenant = byEmail;
      await admin
        .from('tenants')
        .update({ admin_user_id: user.id, updated_at: new Date().toISOString() })
        .eq('tenant_id', byEmail.tenant_id);
    }
  }

  if (!tenant) {
    return NextResponse.json({
      success: false,
      message: 'Nenhuma clínica vinculada a este email. Faça onboarding primeiro.',
      user_email: user.email,
    }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    user: { id: user.id, email: user.email },
    tenant,
  });
}
