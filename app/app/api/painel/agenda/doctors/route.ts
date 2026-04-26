import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

// Lista profissionais ativos do tenant pra dropdown da agenda.

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;
  const supabase = supabaseAdmin();

  const { data: doctors } = await supabase
    .from('tenant_doctors')
    .select('id, doctor_name, doctor_crm, specialty, calendar_id, is_primary')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('is_primary', { ascending: false })
    .order('doctor_name');

  return NextResponse.json({
    success: true,
    doctors: (doctors ?? []).map((d) => ({
      id: d.id,
      name: d.doctor_name,
      crm: d.doctor_crm,
      specialty: d.specialty,
      has_calendar: !!d.calendar_id,
      is_primary: d.is_primary,
    })),
  });
}
