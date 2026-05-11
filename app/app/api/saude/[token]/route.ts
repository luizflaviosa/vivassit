import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface RouteContext {
  params: { token: string };
}

// GET publico: identifica paciente pelo token e retorna info minima
// (primeiro nome + ultimas leituras). Usado pela pagina /saude/[token].
export async function GET(_req: Request, { params }: RouteContext) {
  const token = params.token;
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ success: false, error: 'invalid_token' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: patient, error: pErr } = await supabase
    .from('patients')
    .select('id, tenant_id, name, phone')
    .eq('health_collection_token', token)
    .maybeSingle();

  if (pErr || !patient) {
    return NextResponse.json({ success: false, error: 'not_found' }, { status: 404 });
  }

  // Primeiro nome (privacidade: nao vazar sobrenome).
  const firstName = (patient.name ?? '').trim().split(/\s+/)[0] || 'paciente';

  // Ultimas 10 leituras desse paciente (qualquer LOINC, clean ou outlier).
  const { data: observations } = await supabase
    .from('health_observations')
    .select('id, loinc_code, display_name, value_numeric, unit, effective_time, data_quality_tag')
    .eq('patient_id', patient.id)
    .neq('data_quality_tag', 'rejected')
    .order('effective_time', { ascending: false })
    .limit(10);

  return NextResponse.json({
    success: true,
    patient: {
      first_name: firstName,
      tenant_id: patient.tenant_id,
    },
    observations: observations ?? [],
  });
}
