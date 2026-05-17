import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { ACTIVE_TENANT_COOKIE } from '@/lib/auth-tenant';
import { isAdminEmail } from '@/lib/admin-auth';

// Retorna o tenant ATIVO do usuario autenticado.
// Resolução em ordem:
//   1) Cookie singulare_active_tenant (se válido pro user)
//      válido = admin_user_id, admin_email, OU tenant_members.user_id
//   2) tenant_members.user_id = user.id (membership ativa, mais recente)
//   3) tenants.admin_user_id = user.id (mais recente, se múltiplos)
//   4) tenants.admin_email = user.email (auto-link, mais recente)

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
    chatwoot_url: string | null;
    chatwoot_domain: string | null;
    chatwoot_account_id: string | number | null;
    addon_rpm: boolean | null;
  };
  let tenant: T | null = null;

  const TENANT_FIELDS = 'tenant_id, clinic_name, plan_type, subscription_status, admin_email, chatwoot_url, chatwoot_domain, chatwoot_account_id, addon_rpm';

  // 1. Cookie de tenant ativo (verifica autorização)
  if (preferredTenantId) {
    // 1a. via admin_user_id ou admin_email
    const { data } = await admin
      .from('tenants')
      .select(TENANT_FIELDS)
      .eq('tenant_id', preferredTenantId)
      .or(`admin_user_id.eq.${user.id}${user.email ? `,admin_email.eq.${user.email}` : ''}`)
      .limit(1);
    if (data?.[0]) tenant = data[0];

    // 1b. via tenant_members (member ativo do tenant escolhido no cookie)
    if (!tenant) {
      const { data: memberJoin } = await admin
        .from('tenant_members')
        .select(`tenant:tenants!inner(${TENANT_FIELDS})`)
        .eq('tenant_id', preferredTenantId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle<{ tenant: T }>();
      if (memberJoin?.tenant) tenant = memberJoin.tenant;
    }
  }

  // 2. tenant_members (membership ativa mais recente — alinhado com requireTenant)
  if (!tenant) {
    const { data: memberJoin } = await admin
      .from('tenant_members')
      .select(`tenant:tenants!inner(${TENANT_FIELDS})`)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<{ tenant: T }>();
    if (memberJoin?.tenant) tenant = memberJoin.tenant;
  }

  // 3. admin_user_id (com order + limit pra suportar múltiplos tenants no mesmo user)
  if (!tenant) {
    const { data } = await admin
      .from('tenants')
      .select(TENANT_FIELDS)
      .eq('admin_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);
    if (data?.[0]) tenant = data[0];
  }

  // 4. admin_email (auto-link)
  if (!tenant && user.email) {
    const { data: byEmailList } = await admin
      .from('tenants')
      .select(TENANT_FIELDS)
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

  // Fallback drift de schema: leitores no frontend usam chatwoot_url; tenants
  // antigos podem ter apenas chatwoot_domain preenchido.
  // is_admin: flag de admin de plataforma (lista hardcoded em lib/admin-auth)
  // usado pra mostrar/esconder grupo "Administração" no menu lateral.
  const tenantOut = {
    ...tenant,
    chatwoot_url: tenant.chatwoot_url ?? tenant.chatwoot_domain ?? null,
    is_admin: isAdminEmail(user.email),
  };

  return NextResponse.json({
    success: true,
    user: { id: user.id, email: user.email },
    tenant: tenantOut,
  });
}
