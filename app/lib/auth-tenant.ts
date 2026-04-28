import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from './supabase-server';
import { supabaseAdmin } from './supabase';

export const ACTIVE_TENANT_COOKIE = 'singulare_active_tenant';

export type MemberRole = 'owner' | 'admin' | 'doctor' | 'staff' | 'viewer';

export interface TenantContext {
  user: { id: string; email: string };
  tenant: {
    tenant_id: string;
    clinic_name: string;
    plan_type: string;
    subscription_status: string;
    admin_email: string;
  };
  member: {
    role: MemberRole;
    doctor_id: string | null;
    telegram_chat_id: string | null;
  };
}

// Helper pra route handlers do painel: valida session e retorna tenant
// linkado ao user. Use em todo /api/painel/*.
//
// Resolução do tenant ativo (Onda 2.5):
//   1. Cookie `singulare_active_tenant` validado contra tenant_members
//   2. tenant_members.user_id = user.id (active, mais recente)
//   3. FALLBACK transição: tenants.admin_user_id ou admin_email do user
//      (auto-link cria tenant_members.role=owner)
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
  let member: TenantContext['member'] | null = null;

  type MemberJoin = {
    role: MemberRole;
    doctor_id: string | null;
    telegram_chat_id: string | null;
    tenant: {
      tenant_id: string;
      clinic_name: string;
      plan_type: string;
      subscription_status: string;
      admin_email: string;
    } | null;
  };

  // 1. Cookie do switcher → valida que user é membro daquele tenant
  if (preferredTenantId) {
    const { data } = await admin
      .from('tenant_members')
      .select(
        'role, doctor_id, telegram_chat_id, tenant:tenants!inner(tenant_id, clinic_name, plan_type, subscription_status, admin_email)'
      )
      .eq('user_id', user.id)
      .eq('tenant_id', preferredTenantId)
      .eq('status', 'active')
      .maybeSingle<MemberJoin>();

    if (data?.tenant) {
      tenant = data.tenant;
      member = { role: data.role, doctor_id: data.doctor_id, telegram_chat_id: data.telegram_chat_id };
    }
  }

  // 2. Membership ativa mais recente (qualquer tenant onde é member)
  if (!tenant) {
    const { data } = await admin
      .from('tenant_members')
      .select(
        'role, doctor_id, telegram_chat_id, tenant:tenants!inner(tenant_id, clinic_name, plan_type, subscription_status, admin_email)'
      )
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<MemberJoin>();

    if (data?.tenant) {
      tenant = data.tenant;
      member = { role: data.role, doctor_id: data.doctor_id, telegram_chat_id: data.telegram_chat_id };
    }
  }

  // 3. FALLBACK transição — busca por admin_email (convite legado / auto-link)
  if (!tenant) {
    const { data } = await admin
      .from('tenants')
      .select('tenant_id, clinic_name, plan_type, subscription_status, admin_email')
      .eq('admin_email', user.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      tenant = data;
      member = { role: 'owner', doctor_id: null, telegram_chat_id: null };
      // Auto-link: cria membership e seta admin_user_id
      await admin
        .from('tenant_members')
        .insert({
          tenant_id: data.tenant_id,
          user_id: user.id,
          role: 'owner',
          status: 'active',
          accepted_at: new Date().toISOString(),
        })
        .then(() => admin
          .from('tenants')
          .update({ admin_user_id: user.id, updated_at: new Date().toISOString() })
          .eq('tenant_id', data.tenant_id)
        );
    }
  }

  if (!tenant || !member) {
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
      member,
    },
  };
}
