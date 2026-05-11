import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';

interface RouteContext {
  params: { token: string };
}

// LOINC cardio/clinico - inclui sinais de wearable (HR/HRV/steps/sleep)
// pra app mobile usar o mesmo endpoint da pagina web.
const LOINC = {
  HEART_RATE: '8867-4',
  HRV_SDNN: '80404-7',
  RESTING_HEART_RATE: '40443-4',
  STEPS: '55423-8',
  DISTANCE_WALKING: '41950-7',
  ACTIVE_ENERGY: '41981-2',
  SLEEP_DURATION: '93832-4',
  SLEEP_STAGE: '93830-8',
  BP_SYSTOLIC: '8480-6',
  BP_DIASTOLIC: '8462-4',
  BODY_WEIGHT: '29463-7',
  BODY_TEMPERATURE: '8310-5',
  SPO2: '59408-5',
  GLUCOSE: '2339-0',
} as const;

const LOINC_CATEGORY: Record<string, string> = {
  [LOINC.HEART_RATE]: 'vital-signs',
  [LOINC.HRV_SDNN]: 'vital-signs',
  [LOINC.RESTING_HEART_RATE]: 'vital-signs',
  [LOINC.STEPS]: 'activity',
  [LOINC.DISTANCE_WALKING]: 'activity',
  [LOINC.ACTIVE_ENERGY]: 'activity',
  [LOINC.SLEEP_DURATION]: 'sleep',
  [LOINC.SLEEP_STAGE]: 'sleep',
  [LOINC.BP_SYSTOLIC]: 'vital-signs',
  [LOINC.BP_DIASTOLIC]: 'vital-signs',
  [LOINC.BODY_WEIGHT]: 'vital-signs',
  [LOINC.BODY_TEMPERATURE]: 'vital-signs',
  [LOINC.SPO2]: 'vital-signs',
  [LOINC.GLUCOSE]: 'laboratory',
};

const LOINC_DISPLAY: Record<string, string> = {
  [LOINC.HEART_RATE]: 'Heart rate',
  [LOINC.HRV_SDNN]: 'Heart rate variability',
  [LOINC.RESTING_HEART_RATE]: 'Resting heart rate',
  [LOINC.STEPS]: 'Number of steps',
  [LOINC.DISTANCE_WALKING]: 'Distance walked',
  [LOINC.ACTIVE_ENERGY]: 'Active calories burned',
  [LOINC.SLEEP_DURATION]: 'Sleep duration',
  [LOINC.SLEEP_STAGE]: 'Sleep stage',
  [LOINC.BP_SYSTOLIC]: 'Systolic blood pressure',
  [LOINC.BP_DIASTOLIC]: 'Diastolic blood pressure',
  [LOINC.BODY_WEIGHT]: 'Body weight',
  [LOINC.BODY_TEMPERATURE]: 'Body temperature',
  [LOINC.SPO2]: 'Oxygen saturation',
  [LOINC.GLUCOSE]: 'Glucose',
};

const LOINC_UNIT: Record<string, string> = {
  [LOINC.HEART_RATE]: 'bpm',
  [LOINC.HRV_SDNN]: 'ms',
  [LOINC.RESTING_HEART_RATE]: 'bpm',
  [LOINC.STEPS]: 'count',
  [LOINC.DISTANCE_WALKING]: 'm',
  [LOINC.ACTIVE_ENERGY]: 'kcal',
  [LOINC.SLEEP_DURATION]: 's',
  [LOINC.SLEEP_STAGE]: 'stage',
  [LOINC.BP_SYSTOLIC]: 'mmHg',
  [LOINC.BP_DIASTOLIC]: 'mmHg',
  [LOINC.BODY_WEIGHT]: 'kg',
  [LOINC.BODY_TEMPERATURE]: 'Cel',
  [LOINC.SPO2]: '%',
  [LOINC.GLUCOSE]: 'mg/dL',
};

// [reject_below, outlier_below, outlier_above, reject_above]
const RANGES: Record<string, [number, number, number, number]> = {
  [LOINC.HEART_RATE]: [25, 35, 220, 240],
  [LOINC.HRV_SDNN]: [0, 5, 250, 500],
  [LOINC.RESTING_HEART_RATE]: [25, 35, 100, 120],
  [LOINC.BP_SYSTOLIC]: [50, 80, 200, 260],
  [LOINC.BP_DIASTOLIC]: [30, 50, 130, 180],
  [LOINC.BODY_WEIGHT]: [20, 30, 250, 400],
  [LOINC.BODY_TEMPERATURE]: [32, 35, 40, 43],
  [LOINC.SPO2]: [70, 85, 100, 100],
  [LOINC.GLUCOSE]: [20, 50, 400, 800],
};

function classify(code: string, value: number): 'clean' | 'outlier' | 'rejected' {
  const r = RANGES[code];
  if (!r) return 'clean';
  const [rl, ol, oh, rh] = r;
  if (value < rl || value > rh) return 'rejected';
  if (value < ol || value > oh) return 'outlier';
  return 'clean';
}

interface IncomingVital {
  loinc_code: string;
  value: number;
  value_text?: string | null;
  effective_time?: string; // ISO; default = now
  effective_period_end?: string | null;
  metric_type?: 'sdnn' | 'rmssd' | null; // pra HRV: distingue qual algoritmo
  source?: string | null; // 'apple_health' | 'health_connect' | 'web_manual_link'
  sample_uuid?: string | null; // pra dedup persistente entre sessoes
}

interface IngestBody {
  observations?: IncomingVital[];
  device?: {
    platform?: 'ios' | 'android' | 'web';
    os_version?: string;
    app_version?: string;
    device_model?: string;
  };
}

// POST publico: aceita vitals via token. Sem JWT. Limit 500/batch.
export async function POST(req: Request, { params }: RouteContext) {
  const token = params.token;
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ success: false, error: 'invalid_token' }, { status: 400 });
  }

  const body = await req.json().catch(() => null) as IngestBody | null;
  if (!body || !Array.isArray(body.observations) || body.observations.length === 0) {
    return NextResponse.json({ success: false, error: 'no_observations' }, { status: 400 });
  }
  if (body.observations.length > 500) {
    return NextResponse.json({ success: false, error: 'too_many_observations' }, { status: 400 });
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

  const batchId = randomUUID();
  const nowIso = new Date().toISOString();
  const deviceMeta = body.device ?? null;

  const rows = body.observations
    .filter((o) => (typeof o.value === 'number' && isFinite(o.value) || typeof o.value_text === 'string') && LOINC_CATEGORY[o.loinc_code])
    .map((o) => {
      const isNumeric = typeof o.value === 'number' && isFinite(o.value);
      const quality = isNumeric ? classify(o.loinc_code, o.value) : 'clean';
      const sourceTag = o.source ?? (deviceMeta?.platform === 'ios' ? 'apple_health'
        : deviceMeta?.platform === 'android' ? 'health_connect'
        : 'web_manual_link');
      const provenance: Record<string, unknown> = { source: sourceTag };
      if (deviceMeta) {
        provenance.platform = deviceMeta.platform;
        provenance.os_version = deviceMeta.os_version;
        provenance.app_version = deviceMeta.app_version;
        provenance.device_model = deviceMeta.device_model;
      }
      if (o.metric_type) provenance.metric_type = o.metric_type;
      if (o.sample_uuid) provenance.sample_uuid = o.sample_uuid;
      return {
        patient_id: patient.id,
        tenant_id: patient.tenant_id,
        category: LOINC_CATEGORY[o.loinc_code],
        loinc_code: o.loinc_code,
        display_name: LOINC_DISPLAY[o.loinc_code] ?? o.loinc_code,
        value_numeric: isNumeric ? o.value : null,
        value_text: !isNumeric ? (o.value_text ?? null) : null,
        unit: LOINC_UNIT[o.loinc_code] ?? null,
        effective_time: o.effective_time ?? nowIso,
        effective_period_end: o.effective_period_end ?? null,
        device_provenance: provenance,
        data_quality_tag: quality,
        ingest_batch_id: batchId,
      };
    });

  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: 'no_valid_observations' }, { status: 400 });
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

  const accepted = count ?? rows.length;
  const rejected = rows.filter((r) => r.data_quality_tag === 'rejected').length;
  const outliers = rows.filter((r) => r.data_quality_tag === 'outlier').length;

  return NextResponse.json({
    success: true,
    batch_id: batchId,
    total: rows.length,
    accepted,
    rejected,
    outliers,
  });
}
