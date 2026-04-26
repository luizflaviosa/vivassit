import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { ACTIVE_TENANT_COOKIE } from '@/lib/auth-tenant';

// Retorna o tenant ATIVO do usuario autenticado.
// Resolução em ordem:
//   1) Cookie singulare_active_tenant (se válido pro user)
//   2) tenants.admin_user_id = user.id (mais recente, se múltiplos)
//   3) tenants.admin_email = user.email (auto-link, mais recente)

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, message: 'unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const cookieStore = cookies();
  const preferredTenantId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value;

  type T = {
    tenant_id: string;
    clinic_name: string;
    plan_type: string;
    subscription_status: string;
    admin_email: string;
  };
  let tenant: T | null = null;

  // 1. Cookie de tenant ativo (verifica autorização)
  if (preferredTenantId) {
    const { data } = await admin
      .from('tenants')
      .select('tenant_id, clinic_name, plan_type, subscription_status, admin_email')
      .eq('tenant_id', preferredTenantId)
      .or(`admin_user_id.eq.${user.id}${user.email ? `,admin_email.eq.${user.email}` : ''}`)
      .limit(1);
    if (data?.[0]) tenant = data[0];
  }

  // 2. admin_user_id (com order + limit pra suportar múltiplos tenants no mesmo user)
  if (!tenant) {
    const { data } = await admin
      .from('tenants')
      .select('tenant_id, clinic_name, plan_type, subscription_status, admin_email')
      .eq('admin_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);
    if (data?.[0]) tenant = data[0];
  }

  // 3. admin_email (auto-link)
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
      // Auto-link só dispara se o tenant ainda não tem admin_user_id
      // (evita thrashing quando 2 users diferentes têm o mesmo email)
      await admin
        .from('tenants')
        .update({ admin_user_id: user.id, updated_at: new Date().toISOString() })
        .eq('tenant_id', byEmail.tenant_id)
        .is('admin_user_id', null);
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
