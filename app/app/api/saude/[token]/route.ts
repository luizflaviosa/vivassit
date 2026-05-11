import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface RouteContext {
  params: { token: string };
}

// GET publico: identifica paciente pelo token e retorna info minima
// (primeiro nome + ultimas leituras). Registra consent_type='health_monitoring'
// na primeira vez (LGPD art. 7/11). Usado pela pagina /saude/[token].
export async function GET(req: Request, { params }: RouteContext) {
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

  // LGPD: registra consent na 1a abertura do link.
  // Idempotente: se ja existe registro ativo, nao re-insere (filtro abaixo).
  const { data: existingConsent } = await supabase
    .from('patient_consents')
    .select('id')
    .eq('patient_id', patient.id)
    .eq('consent_type', 'health_monitoring')
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle();
  if (!existingConsent) {
    const ipHeader = req.headers.get('x-forwarded-for') ?? '';
    const ip = ipHeader.split(',')[0].trim() || null;
    await supabase.from('patient_consents').insert({
      patient_id: patient.id,
      tenant_id: patient.tenant_id,
      consent_type: 'health_monitoring',
      source: 'web_link',
      ip_address: ip,
      user_agent: req.headers.get('user-agent'),
    });
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
