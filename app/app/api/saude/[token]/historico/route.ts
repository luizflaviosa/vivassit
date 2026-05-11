import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';

interface RouteContext {
  params: { token: string };
}

// Endpoint pra BATCH HISTORICO. Aceita milhares de amostras de uma vez.
// Diferente de /quick (1 valor por param) e /ingest (JSON estruturado).
//
// 3 formatos aceitos (escolhe pelo Content-Type):
//
// 1) text/plain (mais facil pra Shortcuts iOS):
//    Cada linha = "loinc|value|isoTimestamp"
//    Ex:
//      8867-4|72|2026-05-01T08:00:00Z
//      8867-4|75|2026-05-01T09:00:00Z
//      80404-7|45|2026-05-01T08:30:00Z
//
// 2) application/x-www-form-urlencoded (Pedir Corpo: Formulario no Shortcut):
//    Campo "dados" contendo o texto acima
//
// 3) application/json:
//    { "samples": [{"loinc":"8867-4","value":72,"time":"ISO"}, ...] }
//
// Limite: 5000 samples por request (Vercel body limit ~4MB; com format CSV
// cada linha ~30 bytes, ~150KB pra 5000 linhas, folgado).

const LOINC_META: Record<string, { unit: string; display: string; category: string }> = {
  '8867-4': { unit: 'bpm', display: 'Heart rate', category: 'vital-signs' },
  '80404-7': { unit: 'ms', display: 'Heart rate variability (SDNN)', category: 'vital-signs' },
  '40443-4': { unit: 'bpm', display: 'Resting heart rate', category: 'vital-signs' },
  '80350-9': { unit: 'count', display: 'Palpitations', category: 'vital-signs' },
  '55423-8': { unit: 'count', display: 'Number of steps', category: 'activity' },
  '41950-7': { unit: 'm', display: 'Distance walked/running', category: 'activity' },
  '41981-2': { unit: 'kcal', display: 'Active calories burned', category: 'activity' },
  '41980-4': { unit: 'kcal', display: 'Resting energy expenditure (basal)', category: 'activity' },
  '75923-3': { unit: 'min', display: 'Apple exercise time', category: 'activity' },
  '41947-3': { unit: 'min', display: 'Apple move time', category: 'activity' },
  '93832-4': { unit: 'min', display: 'Sleep duration', category: 'activity' },
  '8480-6': { unit: 'mmHg', display: 'Systolic blood pressure', category: 'vital-signs' },
  '8462-4': { unit: 'mmHg', display: 'Diastolic blood pressure', category: 'vital-signs' },
  '29463-7': { unit: 'kg', display: 'Body weight', category: 'vital-signs' },
  '8310-5': { unit: 'Cel', display: 'Body temperature', category: 'vital-signs' },
  '59408-5': { unit: '%', display: 'Oxygen saturation', category: 'vital-signs' },
  '2339-0': { unit: 'mg/dL', display: 'Glucose', category: 'laboratory' },
};

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

interface ParsedSample {
  loinc: string;
  value: number;
  time: string;
}

function parseCsv(text: string): ParsedSample[] {
  const lines = text.split(/\r?\n/);
  const result: ParsedSample[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.toLowerCase().startsWith('loinc')) continue; // pula header
    const parts = line.split('|');
    if (parts.length < 3) continue;
    const loinc = parts[0].trim();
    const value = Number(parts[1].trim().replace(',', '.'));
    const time = parts[2].trim();
    if (!loinc || !isFinite(value) || !time) continue;
    result.push({ loinc, value, time });
  }
  return result;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const token = params.token;
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ success: false, error: 'invalid_token' }, { status: 400 });
  }

  const contentType = (req.headers.get('content-type') ?? '').toLowerCase();
  let samples: ParsedSample[] = [];

  try {
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const arr = Array.isArray(body?.samples) ? body.samples : Array.isArray(body) ? body : [];
      samples = arr
        .map((s: unknown): ParsedSample | null => {
          if (!s || typeof s !== 'object') return null;
          const obj = s as Record<string, unknown>;
          const loinc = typeof obj.loinc === 'string' ? obj.loinc : typeof obj.loinc_code === 'string' ? obj.loinc_code : null;
          const value = typeof obj.value === 'number' ? obj.value : typeof obj.value_numeric === 'number' ? obj.value_numeric : Number(obj.value);
          const time = typeof obj.time === 'string' ? obj.time : typeof obj.effective_time === 'string' ? obj.effective_time : null;
          if (!loinc || !isFinite(value) || !time) return null;
          return { loinc, value, time };
        })
        .filter((x: ParsedSample | null): x is ParsedSample => x !== null);
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      const dados = form.get('dados');
      if (typeof dados === 'string') samples = parseCsv(dados);
    } else {
      // text/plain ou sem content-type explicito
      const text = await req.text();
      samples = parseCsv(text);
    }
  } catch (e) {
    return NextResponse.json({ success: false, error: 'parse_failed', detail: String(e) }, { status: 400 });
  }

  if (samples.length === 0) {
    return NextResponse.json({ success: false, error: 'no_samples' }, { status: 400 });
  }
  if (samples.length > 5000) {
    return NextResponse.json({ success: false, error: 'too_many_samples', max: 5000, sent: samples.length }, { status: 400 });
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
  const rows = samples
    .filter((s) => LOINC_META[s.loinc])
    .map((s) => {
      const meta = LOINC_META[s.loinc];
      const quality = classify(s.loinc, s.value);
      return {
        patient_id: patient.id,
        tenant_id: patient.tenant_id,
        category: meta.category,
        loinc_code: s.loinc,
        display_name: meta.display,
        value_numeric: s.value,
        unit: meta.unit,
        effective_time: s.time,
        device_provenance: { source: 'ios_shortcut_backfill' },
        data_quality_tag: quality,
        ingest_batch_id: batchId,
      };
    });

  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: 'no_recognized_loinc', total_received: samples.length }, { status: 400 });
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
    unrecognized_loinc: samples.length - rows.length,
  });
}
