import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';

interface RouteContext {
  params: { token: string };
}

// LOINC subset cardio/clinico - igual ao da edge function ingest-vitals.
const LOINC = {
  HEART_RATE: '8867-4',
  BP_SYSTOLIC: '8480-6',
  BP_DIASTOLIC: '8462-4',
  BODY_WEIGHT: '29463-7',
  BODY_TEMPERATURE: '8310-5',
  SPO2: '59408-5',
  GLUCOSE: '2339-0',
} as const;

const LOINC_CATEGORY: Record<string, string> = {
  [LOINC.HEART_RATE]: 'vital-signs',
  [LOINC.BP_SYSTOLIC]: 'vital-signs',
  [LOINC.BP_DIASTOLIC]: 'vital-signs',
  [LOINC.BODY_WEIGHT]: 'vital-signs',
  [LOINC.BODY_TEMPERATURE]: 'vital-signs',
  [LOINC.SPO2]: 'vital-signs',
  [LOINC.GLUCOSE]: 'laboratory',
};

const LOINC_DISPLAY: Record<string, string> = {
  [LOINC.HEART_RATE]: 'Heart rate',
  [LOINC.BP_SYSTOLIC]: 'Systolic blood pressure',
  [LOINC.BP_DIASTOLIC]: 'Diastolic blood pressure',
  [LOINC.BODY_WEIGHT]: 'Body weight',
  [LOINC.BODY_TEMPERATURE]: 'Body temperature',
  [LOINC.SPO2]: 'Oxygen saturation',
  [LOINC.GLUCOSE]: 'Glucose',
};

const LOINC_UNIT: Record<string, string> = {
  [LOINC.HEART_RATE]: 'bpm',
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
  effective_time?: string; // ISO; default = now
}

// POST publico: aceita vitals via token. Sem JWT.
export async function POST(req: Request, { params }: RouteContext) {
  const token = params.token;
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ success: false, error: 'invalid_token' }, { status: 400 });
  }

  const body = await req.json().catch(() => null) as { observations?: IncomingVital[] } | null;
  if (!body || !Array.isArray(body.observations) || body.observations.length === 0) {
    return NextResponse.json({ success: false, error: 'no_observations' }, { status: 400 });
  }
  if (body.observations.length > 50) {
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

  const rows = body.observations
    .filter((o) => typeof o.value === 'number' && isFinite(o.value) && LOINC_CATEGORY[o.loinc_code])
    .map((o) => {
      const quality = classify(o.loinc_code, o.value);
      return {
        patient_id: patient.id,
        tenant_id: patient.tenant_id,
        category: LOINC_CATEGORY[o.loinc_code],
        loinc_code: o.loinc_code,
        display_name: LOINC_DISPLAY[o.loinc_code] ?? o.loinc_code,
        value_numeric: o.value,
        unit: LOINC_UNIT[o.loinc_code] ?? null,
        effective_time: o.effective_time ?? nowIso,
        device_provenance: { source: 'web_manual_link' },
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
