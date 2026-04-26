import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from './supabase-server';
import { supabaseAdmin } from './supabase';

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
  let { data: tenant } = await admin
    .from('tenants')
    .select('tenant_id, clinic_name, plan_type, subscription_status, admin_email')
    .eq('admin_user_id', user.id)
    .maybeSingle();

  if (!tenant) {
    // Suporta multiplos tenants com mesmo email - pega o mais recente
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
