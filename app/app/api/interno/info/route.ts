import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// Edge: usado pelo chat-drawer pra buscar saudação + capacidades do agente.
// Mesma lógica de tenant lookup que /api/interno/comando.
export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return new Response('unauthorized', { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const preferredTenantId = req.cookies.get('singulare_active_tenant')?.value;
  let tenant: { tenant_id: string; clinic_name: string; internal_agent_capabilities: string | null } | null = null;
  type Row = { tenant: { tenant_id: string; clinic_name: string; internal_agent_capabilities: string | null } | null };

  if (preferredTenantId) {
    const { data } = await admin
      .from('tenant_members')
      .select('tenant:tenants!inner(tenant_id, clinic_name, internal_agent_capabilities)')
      .eq('user_id', user.id)
      .eq('tenant_id', preferredTenantId)
      .eq('status', 'active')
      .maybeSingle<Row>();
    if (data?.tenant) tenant = data.tenant;
  }

  if (!tenant) {
    const { data } = await admin
      .from('tenant_members')
      .select('tenant:tenants!inner(tenant_id, clinic_name, internal_agent_capabilities, status)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .eq('tenant.status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<Row>();
    if (data?.tenant) tenant = data.tenant;
  }

  // Fallback transição
  if (!tenant) {
    const { data } = await admin
      .from('tenants')
      .select('tenant_id, clinic_name, internal_agent_capabilities')
      .or(`admin_user_id.eq.${user.id},admin_email.eq.${user.email}`)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) tenant = data;
  }

  if (!tenant) return new Response('tenant_not_found', { status: 404 });

  return Response.json({
    clinic_name: tenant.clinic_name,
    capabilities: tenant.internal_agent_capabilities ?? '',
  });
}
