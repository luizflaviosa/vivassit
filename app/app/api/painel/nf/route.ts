import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('nf_requests')
    .select(
      'id, patient_name, patient_cpf, patient_phone, doctor_name, consultation_date, status, requested_at, sent_to_accountant_at, completed_at, notes'
    )
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .order('requested_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  const summary = (data ?? []).reduce(
    (acc, n) => {
      acc[n.status] = (acc[n.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return NextResponse.json({ success: true, requests: data ?? [], summary });
}
