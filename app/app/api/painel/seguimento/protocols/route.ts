// Lista templates de protocolo (globais + do tenant ativo).
// Usado pelo modal de atribuicao no drawer do paciente.

import { NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const { tenant } = auth.ctx;

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('treatment_protocols')
    .select('id, tenant_id, specialty, slug, name, description, duration_weeks, cadence_days, is_active')
    .or(`tenant_id.is.null,tenant_id.eq.${tenant.tenant_id}`)
    .eq('is_active', true)
    .order('specialty', { ascending: true })
    .order('slug', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, protocols: data ?? [] });
}
