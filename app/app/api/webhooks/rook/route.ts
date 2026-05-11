import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';

// Webhook Rook -> Singulare health_observations.
//
// Rook envia JSONs com 3 pilares: physical_health, body_health, sleep_health.
// Cada pilar tem "events" (granular, com array) e/ou "summary" (consolidado).
//
// Esse handler:
// 1. Identifica o paciente via user_id (formato: singulare_pat_<id>)
// 2. Procura campos numericos conhecidos no payload (heart_rate, hrv, etc)
// 3. Mapeia pra LOINC + insere em health_observations
// 4. Atualiza patients.rook_connected_at na primeira chegada
//
// Sem HMAC por ora (sandbox). Em prod adicionar verificacao X-ROOK-HASH.

interface MetricMap {
  loinc: string;
  unit: string;
  display: string;
  category: string;
}

// Mapeamento de campos comuns do Rook -> LOINC.
// Chave = nome do campo no payload (pode aparecer em qualquer nivel do JSON).
const FIELD_TO_LOINC: Record<string, MetricMap> = {
  'heart_rate_bpm_int': { loinc: '8867-4', unit: 'bpm', display: 'Heart rate', category: 'vital-signs' },
  'heart_rate_avg_bpm_int': { loinc: '8867-4', unit: 'bpm', display: 'Heart rate (avg)', category: 'vital-signs' },
  'heart_rate_resting_bpm_int': { loinc: '40443-4', unit: 'bpm', display: 'Resting heart rate', category: 'vital-signs' },
  'hrv_sdnn_ms_float': { loinc: '80404-7', unit: 'ms', display: 'HRV SDNN', category: 'vital-signs' },
  'hrv_rmssd_ms_float': { loinc: '80404-7', unit: 'ms', display: 'HRV RMSSD', category: 'vital-signs' },
  'steps_int': { loinc: '55423-8', unit: 'count', display: 'Number of steps', category: 'activity' },
  'steps_count_int': { loinc: '55423-8', unit: 'count', display: 'Number of steps', category: 'activity' },
  'distance_meters_float': { loinc: '41950-7', unit: 'm', display: 'Distance walked/running', category: 'activity' },
  'distance_meters_int': { loinc: '41950-7', unit: 'm', display: 'Distance walked/running', category: 'activity' },
  'active_calories_kcal_float': { loinc: '41981-2', unit: 'kcal', display: 'Active calories burned', category: 'activity' },
  'active_kilocalories_float': { loinc: '41981-2', unit: 'kcal', display: 'Active calories burned', category: 'activity' },
  'resting_calories_kcal_float': { loinc: '41980-4', unit: 'kcal', display: 'Resting energy expenditure', category: 'activity' },
  'systolic_bp_mmHg_int': { loinc: '8480-6', unit: 'mmHg', display: 'Systolic blood pressure', category: 'vital-signs' },
  'diastolic_bp_mmHg_int': { loinc: '8462-4', unit: 'mmHg', display: 'Diastolic blood pressure', category: 'vital-signs' },
  'spo2_percentage_int': { loinc: '59408-5', unit: '%', display: 'Oxygen saturation', category: 'vital-signs' },
  'oxygenation_percentage_int': { loinc: '59408-5', unit: '%', display: 'Oxygen saturation', category: 'vital-signs' },
  'duration_seconds_int': { loinc: '93832-4', unit: 'min', display: 'Sleep duration', category: 'activity' },
  'temperature_celsius_float': { loinc: '8310-5', unit: 'Cel', display: 'Body temperature', category: 'vital-signs' },
  'blood_glucose_mg_per_dL_int': { loinc: '2339-0', unit: 'mg/dL', display: 'Glucose', category: 'laboratory' },
};

interface ExtractedRow {
  loinc_code: string;
  display_name: string;
  value_numeric: number;
  unit: string;
  category: string;
  effective_time: string;
}

function extractMetrics(payload: unknown, fallbackTime: string): ExtractedRow[] {
  const rows: ExtractedRow[] = [];
  const visited = new WeakSet<object>();

  function walk(node: unknown, contextTime: string) {
    if (!node || typeof node !== 'object') return;
    if (visited.has(node as object)) return;
    visited.add(node as object);

    if (Array.isArray(node)) {
      for (const item of node) walk(item, contextTime);
      return;
    }

    const obj = node as Record<string, unknown>;
    // Atualiza o context de tempo se o objeto tem datetime
    let myTime = contextTime;
    const dt = obj.datetime ?? obj.event_datetime ?? obj.start_datetime ?? obj.timestamp;
    if (typeof dt === 'string' && dt) myTime = dt;

    for (const [key, val] of Object.entries(obj)) {
      const meta = FIELD_TO_LOINC[key];
      if (meta && typeof val === 'number' && isFinite(val) && val > 0) {
        let value = val;
        // Sono: Rook entrega em segundos; converte pra minutos.
        if (meta.loinc === '93832-4' && value > 1000) value = Math.round(value / 60);
        rows.push({
          loinc_code: meta.loinc,
          display_name: meta.display,
          value_numeric: value,
          unit: meta.unit,
          category: meta.category,
          effective_time: myTime,
        });
      } else if (val && typeof val === 'object') {
        walk(val, myTime);
      }
    }
  }

  walk(payload, fallbackTime);
  return rows;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 });
  }

  const userId = typeof body.user_id === 'string' ? body.user_id : null;
  if (!userId) {
    return NextResponse.json({ success: false, error: 'missing_user_id' }, { status: 400 });
  }

  const supa = supabaseAdmin();
  const { data: patient } = await supa
    .from('patients')
    .select('id, tenant_id, rook_connected_at')
    .eq('rook_user_id', userId)
    .maybeSingle();

  if (!patient) {
    // 200 mesmo assim pra Rook nao reenviar; loga pra investigar.
    console.error('[rook/webhook] patient not found for user_id:', userId);
    return NextResponse.json({ success: false, error: 'patient_not_found', user_id: userId });
  }

  const topLevelTime = typeof body.datetime === 'string' ? body.datetime : new Date().toISOString();
  const extracted = extractMetrics(body, topLevelTime);

  if (extracted.length === 0) {
    console.log('[rook/webhook] no metrics extracted for', userId, 'data_structure:', body.data_structure);
    return NextResponse.json({ success: true, accepted: 0, note: 'no_metrics_extracted' });
  }

  const batchId = randomUUID();
  const rows = extracted.map((m) => ({
    patient_id: patient.id,
    tenant_id: patient.tenant_id,
    category: m.category,
    loinc_code: m.loinc_code,
    display_name: m.display_name,
    value_numeric: m.value_numeric,
    unit: m.unit,
    effective_time: m.effective_time,
    device_provenance: { source: 'rook_webhook', data_structure: body.data_structure ?? null },
    data_quality_tag: 'clean',
    ingest_batch_id: batchId,
  }));

  const { error: iErr, count } = await supa
    .from('health_observations')
    .upsert(rows, {
      onConflict: 'patient_id,loinc_code,effective_time',
      ignoreDuplicates: true,
      count: 'exact',
    });

  if (iErr) {
    console.error('[rook/webhook] insert error:', iErr);
    return NextResponse.json({ success: false, error: 'insert_failed', detail: iErr.message }, { status: 500 });
  }

  // Marca rook_connected_at na primeira chegada
  if (!patient.rook_connected_at) {
    await supa.from('patients').update({ rook_connected_at: new Date().toISOString() }).eq('id', patient.id);
  }

  return NextResponse.json({
    success: true,
    batch_id: batchId,
    accepted: count ?? rows.length,
    extracted: extracted.length,
  });
}

// GET pra Rook validar o endpoint quando configurar webhook no portal.
export async function GET() {
  return NextResponse.json({ ok: true, service: 'singulare/rook-webhook' });
}
