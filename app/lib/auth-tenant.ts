import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from './supabase-server';
import { supabaseAdmin } from './supabase';

export const ACTIVE_TENANT_COOKIE = 'singulare_active_tenant';

export interface TenantContext {
  user: { id: string; email: string };
  tenant: {
    tenant_id: string;
    clinic_name: string;
    plan_type: string;
    subscription_status: string;
    admin_email: string;
  };
}

// Helper para route handlers do painel: valida session e retorna tenant
// linkado ao user. Use em todo /api/painel/*.
//
// Resolução do tenant ativo (em ordem):
//   1. Cookie `singulare_active_tenant` (escolha explicita do usuario)
//   2. tenants.admin_user_id == user.id
//   3. tenants.admin_email == user.email (mais recente, auto-link)
export async function requireTenant(): Promise<
  | { ok: true; ctx: TenantContext }
  | { ok: false; response: NextResponse }
> {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, message: 'unauthorized' }, { status: 401 }),
    };
  }

  const admin = supabaseAdmin();
  const cookieStore = cookies();
  const preferredTenantId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value;

  let tenant: TenantContext['tenant'] | null = null;

  // 1. Tenta usar tenant ativo do cookie (verifica autorização)
  if (preferredTenantId) {
    const { data } = await admin
      .from('tenants')
      .select('tenant_id, clinic_name, plan_type, subscription_status, admin_email')
      .eq('tenant_id', preferredTenantId)
      .or(`admin_user_id.eq.${user.id},admin_email.eq.${user.email}`)
      .maybeSingle();
    if (data) tenant = data;
  }

  // 2. Por user_id
  if (!tenant) {
    const { data } = await admin
      .from('tenants')
      .select('tenant_id, clinic_name, plan_type, subscription_status, admin_email')
      .eq('admin_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) tenant = data;
  }

  // 3. Por email (auto-link)
  if (!tenant) {
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
    return {
      ok: false,
      response: NextResponse.json({ success: false, message: 'no_tenant' }, { status: 404 }),
    };
  }

  return {
    ok: true,
    ctx: {
      user: { id: user.id, email: user.email },
      tenant,
    },
  };
}
