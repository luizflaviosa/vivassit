import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

// Lista todos os tenants onde o user é membro ativo (Onda 2.5).
// Usado pelo TenantSwitcher pra trocar de clínica sem refazer login.

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });

  const admin = supabaseAdmin();

  type Row = {
    role: 'owner' | 'admin' | 'doctor' | 'staff' | 'viewer';
    tenant: {
      tenant_id: string;
      clinic_name: string;
      plan_type: string;
      subscription_status: string;
      created_at: string;
    } | null;
  };

  const { data: members } = await admin
    .from('tenant_members')
    .select(
      'role, tenant:tenants!inner(tenant_id, clinic_name, plan_type, subscription_status, created_at)'
    )
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .returns<Row[]>();

  const tenants = (members ?? [])
    .filter((m): m is Row & { tenant: NonNullable<Row['tenant']> } => !!m.tenant)
    .map((m) => ({ ...m.tenant, role: m.role }));

  // Fallback transição: se membership ainda não existe, busca por email/admin_user_id
  if (tenants.length === 0) {
    const queries = [
      admin
        .from('tenants')
        .select('tenant_id, clinic_name, plan_type, subscription_status, created_at')
        .eq('admin_user_id', user.id)
        .order('created_at', { ascending: false }),
    ];
    if (user.email) {
      queries.push(
        admin
          .from('tenants')
          .select('tenant_id, clinic_name, plan_type, subscription_status, created_at')
          .eq('admin_email', user.email)
          .order('created_at', { ascending: false })
      );
    }
    const results = await Promise.all(queries);
    const seen = new Set<string>();
    for (const r of results) {
      for (const t of (r.data ?? []) as Array<{ tenant_id: string; clinic_name: string; plan_type: string; subscription_status: string; created_at: string }>) {
        if (seen.has(t.tenant_id)) continue;
        seen.add(t.tenant_id);
        tenants.push({ ...t, role: 'owner' as const });
      }
    }
  }

  return NextResponse.json({ success: true, tenants, count: tenants.length });
}

export async function POST(req: Request) {
  // Switch active tenant: salva preferencia em cookie http-only.
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });

  let body: { tenant_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 }); }
  const tenantId = body.tenant_id?.trim();
  if (!tenantId) return NextResponse.json({ success: false, error: 'missing_tenant_id' }, { status: 400 });

  // Verifica que o tenant pertence ao user (membership ou fallback admin_*)
  const admin = supabaseAdmin();
  const { data: membership } = await admin
    .from('tenant_members')
    .select('tenant_id, tenants!inner(tenant_id, clinic_name)')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .maybeSingle();

  let tenant: { tenant_id: string; clinic_name: string } | null = null;
  if (membership?.tenants) {
    const t = membership.tenants as unknown as { tenant_id: string; clinic_name: string };
    tenant = t;
  } else {
    // Fallback transição
    const { data } = await admin
      .from('tenants')
      .select('tenant_id, clinic_name')
      .eq('tenant_id', tenantId)
      .or(`admin_user_id.eq.${user.id}${user.email ? `,admin_email.eq.${user.email}` : ''}`)
      .maybeSingle();
    if (data) tenant = data;
  }

  if (!tenant) return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 });

  const res = NextResponse.json({ success: true, tenant });
  res.cookies.set('singulare_active_tenant', tenant.tenant_id, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 90, // 90 dias
    path: '/',
  });
  return res;
}
