import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

// Lista todos os tenants vinculados ao usuario logado.
// Util pra multi-tenant switcher: mesmo email administrando varias clinicas.

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });

  const admin = supabaseAdmin();

  // Busca por user_id OU email (qualquer match)
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
  const tenants: Array<{ tenant_id: string; clinic_name: string; plan_type: string; subscription_status: string; created_at: string }> = [];
  for (const r of results) {
    for (const t of (r.data ?? []) as Array<{ tenant_id: string; clinic_name: string; plan_type: string; subscription_status: string; created_at: string }>) {
      if (seen.has(t.tenant_id)) continue;
      seen.add(t.tenant_id);
      tenants.push(t);
    }
  }

  return NextResponse.json({ success: true, tenants, count: tenants.length });
}

export async function POST(req: Request) {
  // Switch active tenant: salva preferencia em cookie http-only (lib usa pra resolver tenant_id em vez do "primeiro")
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });

  let body: { tenant_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 }); }
  const tenantId = body.tenant_id?.trim();
  if (!tenantId) return NextResponse.json({ success: false, error: 'missing_tenant_id' }, { status: 400 });

  // Verifica que o tenant pertence ao user
  const admin = supabaseAdmin();
  const { data: tenant } = await admin
    .from('tenants')
    .select('tenant_id, clinic_name')
    .eq('tenant_id', tenantId)
    .or(`admin_user_id.eq.${user.id}${user.email ? `,admin_email.eq.${user.email}` : ''}`)
    .maybeSingle();

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
