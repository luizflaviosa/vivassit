import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('patients')
    .select(
      'id, name, phone, email, birthdate, total_consultations, last_visit_at, last_doctor, doctor_preference, notes, tags, created_at'
    )
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .order('last_visit_at', { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) {
    console.error('[painel/pacientes GET] erro:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, patients: data ?? [] });
}
