import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenant');
  if (!tenantId) {
    return NextResponse.json({ success: false, message: 'tenant obrigatório' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('patients')
    .select(
      'id, name, phone, email, birthdate, total_consultations, last_visit_at, last_doctor, doctor_preference, notes, tags, created_at'
    )
    .eq('tenant_id', tenantId)
    .order('last_visit_at', { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) {
    console.error('[painel/pacientes GET] erro:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, patients: data ?? [] });
}
