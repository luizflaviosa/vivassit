import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';

interface RouteContext {
  params: { token: string };
}

// Atalho do iOS / curl simples: aceita medicoes via query params.
// Ex: GET /api/saude/<token>/quick?fc=72&peso=70&passos=5000
//
// Aceita: GET ou POST (Apple Shortcuts manda GET por padrao quando
// nao tem body; aceita POST tambem pra compatibilidade).
// Cada param e mapeado pra LOINC + unidade canonica e inserido em
// health_observations com source=ios_shortcut.

const PARAM_MAP: Record<string, { loinc: string; unit: string; display: string; category: string }> = {
  // Cardio
  fc: { loinc: '8867-4', unit: 'bpm', display: 'Heart rate', category: 'vital-signs' },
  hrv: { loinc: '80404-7', unit: 'ms', display: 'Heart rate variability (SDNN)', category: 'vital-signs' },
  fc_rep: { loinc: '40443-4', unit: 'bpm', display: 'Resting heart rate', category: 'vital-signs' },
  palpitacao: { loinc: '80350-9', unit: 'count', display: 'Palpitations (rapid pounding/fluttering)', category: 'vital-signs' },
  // Atividade
  passos: { loinc: '55423-8', unit: 'count', display: 'Number of steps', category: 'activity' },
  distancia: { loinc: '41950-7', unit: 'm', display: 'Distance walked/running', category: 'activity' },
  calorias: { loinc: '41981-2', unit: 'kcal', display: 'Active calories burned', category: 'activity' },
  calorias_ativas: { loinc: '41981-2', unit: 'kcal', display: 'Active calories burned', category: 'activity' },
  calorias_repouso: { loinc: '41980-4', unit: 'kcal', display: 'Resting energy expenditure (basal)', category: 'activity' },
  exercicio_min: { loinc: '75923-3', unit: 'min', display: 'Apple exercise time', category: 'activity' },
  move_min: { loinc: '41947-3', unit: 'min', display: 'Apple move time (active minutes)', category: 'activity' },
  sono: { loinc: '93832-4', unit: 'min', display: 'Sleep duration', category: 'activity' },
  // Pressao
  pa_sis: { loinc: '8480-6', unit: 'mmHg', display: 'Systolic blood pressure', category: 'vital-signs' },
  pa_dia: { loinc: '8462-4', unit: 'mmHg', display: 'Diastolic blood pressure', category: 'vital-signs' },
  // Corpo
  peso: { loinc: '29463-7', unit: 'kg', display: 'Body weight', category: 'vital-signs' },
  temp: { loinc: '8310-5', unit: 'Cel', display: 'Body temperature', category: 'vital-signs' },
  spo2: { loinc: '59408-5', unit: '%', display: 'Oxygen saturation', category: 'vital-signs' },
  glicose: { loinc: '2339-0', unit: 'mg/dL', display: 'Glucose', category: 'laboratory' },
};

// [reject_below, outlier_below, outlier_above, reject_above]
const RANGES: Record<string, [number, number, number, number]> = {
  '8867-4': [25, 35, 220, 240],
  '80404-7': [0, 5, 250, 500],
  '40443-4': [25, 35, 100, 120],
  '8480-6': [50, 80, 200, 260],
  '8462-4': [30, 50, 130, 180],
  '29463-7': [20, 30, 250, 400],
  '8310-5': [32, 35, 40, 43],
  '59408-5': [70, 85, 100, 100],
  '2339-0': [20, 50, 400, 800],
};

function classify(code: string, value: number): 'clean' | 'outlier' | 'rejected' {
  const r = RANGES[code];
  if (!r) return 'clean';
  const [rl, ol, oh, rh] = r;
  if (value < rl || value > rh) return 'rejected';
  if (value < ol || value > oh) return 'outlier';
  return 'clean';
}

async function handle(req: NextRequest, params: { token: string }) {
  const token = params.token;
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ success: false, error: 'invalid_token' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: patient, error: pErr } = await supabase
    .from('patients')
    .select('id, tenant_id')
    .eq('health_collection_token', token)
    .maybeSingle();
  if (pErr || !patient) {
    return NextResponse.json({ success: false, error: 'invalid_token' }, { status: 404 });
  }

  const url = new URL(req.url);
  const batchId = randomUUID();
  const nowIso = new Date().toISOString();
  const rows: Array<Record<string, unknown>> = [];

  for (const [key, meta] of Object.entries(PARAM_MAP)) {
    const raw = url.searchParams.get(key);
    if (!raw) continue;
    let value = Number(String(raw).replace(',', '.'));
    if (!isFinite(value) || value <= 0) continue;
    // Sono: iOS Shortcuts envia em segundos (Duração); converte pra minutos.
    if (meta.loinc === '93832-4' && value > 1000) value = Math.round(value / 60);
    // Distância: se vier em km (valor < 100), converte pra metros.
    if (meta.loinc === '41950-7' && value < 100) value = Math.round(value * 1000);
    const quality = classify(meta.loinc, value);
    rows.push({
      patient_id: patient.id,
      tenant_id: patient.tenant_id,
      category: meta.category,
      loinc_code: meta.loinc,
      display_name: meta.display,
      value_numeric: value,
      unit: meta.unit,
      effective_time: nowIso,
      device_provenance: { source: 'ios_shortcut' },
      data_quality_tag: quality,
      ingest_batch_id: batchId,
    });
  }

  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: 'no_valid_params' }, { status: 400 });
  }

  const { error: iErr, count } = await supabase
    .from('health_observations')
    .upsert(rows, {
      onConflict: 'patient_id,loinc_code,effective_time',
      ignoreDuplicates: true,
      count: 'exact',
    });
  if (iErr) {
    return NextResponse.json({ success: false, error: 'insert_failed', detail: iErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    batch_id: batchId,
    total: rows.length,
    accepted: count ?? rows.length,
    rejected: rows.filter((r) => r.data_quality_tag === 'rejected').length,
    outliers: rows.filter((r) => r.data_quality_tag === 'outlier').length,
  });
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  return handle(req, params);
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  return handle(req, params);
}
