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
  source?: string | null; // 'apple_health' | 'health_connect' | 'web_manual_link' | 'whatsapp_active' | 'web_protocol'
  sample_uuid?: string | null; // pra dedup persistente entre sessoes
  // coleta ATIVA via protocolo de seguimento:
  protocol_question_id?: number | null;
  confidence?: number | null; // 0..1, baixo => marca data_quality_tag='noisy'
  raw_text?: string | null;   // resposta original do paciente (pre-NLU)
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

interface ProtocolQuestionRow {
  id: number;
  protocol_id: number;
  loinc_code: string;
  kind: string;
}

// POST publico: aceita vitals via token. Sem JWT. Limit 500/batch.
// Suporta 2 modos:
//   (a) passivo/manual: observation com LOINC do mapping conhecido -> categoria automatica
//   (b) ativo de protocolo: observation com protocol_question_id -> categoria 'patient-reported',
//       provenance enriquecido com protocol_id/question_id/confidence/raw_text.
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

  // Pre-carrega perguntas de protocolo referenciadas no batch (modo ativo).
  const protocolQuestionIds = Array.from(new Set(
    body.observations
      .map((o) => o.protocol_question_id)
      .filter((v): v is number => typeof v === 'number' && v > 0)
  ));

  const protocolQuestions = new Map<number, ProtocolQuestionRow>();
  const activeProtocolIds = new Set<number>();

  if (protocolQuestionIds.length > 0) {
    const { data: pqs, error: pqErr } = await supabase
      .from('protocol_questions')
      .select('id, protocol_id, loinc_code, kind')
      .in('id', protocolQuestionIds);
    if (pqErr) {
      return NextResponse.json({ success: false, error: 'protocol_lookup_failed', detail: pqErr.message }, { status: 500 });
    }
    pqs?.forEach((q) => protocolQuestions.set(q.id, q as ProtocolQuestionRow));

    // So aceita coleta ativa de protocolo que o paciente esta ativamente seguindo.
    const { data: pps, error: ppErr } = await supabase
      .from('patient_protocols')
      .select('protocol_id')
      .eq('patient_id', patient.id)
      .eq('status', 'active');
    if (ppErr) {
      return NextResponse.json({ success: false, error: 'patient_protocol_lookup_failed', detail: ppErr.message }, { status: 500 });
    }
    pps?.forEach((p) => activeProtocolIds.add(p.protocol_id));
  }

  const batchId = randomUUID();
  const nowIso = new Date().toISOString();
  const deviceMeta = body.device ?? null;

  const rows = body.observations
    .filter((o) => {
      const hasNum = typeof o.value === 'number' && isFinite(o.value);
      const hasText = typeof o.value_text === 'string' && o.value_text.length > 0;
      if (!hasNum && !hasText) return false;

      // Modo ativo: protocol_question_id presente -> precisa pergunta valida + protocolo ativo
      if (typeof o.protocol_question_id === 'number') {
        const pq = protocolQuestions.get(o.protocol_question_id);
        if (!pq) return false;
        return activeProtocolIds.has(pq.protocol_id);
      }
      // Modo passivo/manual: precisa LOINC conhecido
      return !!LOINC_CATEGORY[o.loinc_code];
    })
    .map((o) => {
      const isNumeric = typeof o.value === 'number' && isFinite(o.value);
      const isActiveProtocol = typeof o.protocol_question_id === 'number';
      const pq = isActiveProtocol ? protocolQuestions.get(o.protocol_question_id as number) : undefined;

      // Quality: ativo segue confidence; passivo usa faixa fisiologica.
      let quality: 'clean' | 'outlier' | 'rejected' | 'noisy';
      if (isActiveProtocol) {
        quality = (typeof o.confidence === 'number' && o.confidence < 0.6) ? 'noisy' : 'clean';
      } else {
        quality = isNumeric ? classify(o.loinc_code, o.value) : 'clean';
      }

      const category = isActiveProtocol
        ? 'patient-reported'
        : LOINC_CATEGORY[o.loinc_code];

      const sourceTag = o.source ?? (
        isActiveProtocol ? 'whatsapp_active'
          : deviceMeta?.platform === 'ios' ? 'apple_health'
          : deviceMeta?.platform === 'android' ? 'health_connect'
          : 'web_manual_link'
      );

      const provenance: Record<string, unknown> = { source: sourceTag };
      if (deviceMeta) {
        if (deviceMeta.platform) provenance.platform = deviceMeta.platform;
        if (deviceMeta.os_version) provenance.os_version = deviceMeta.os_version;
        if (deviceMeta.app_version) provenance.app_version = deviceMeta.app_version;
        if (deviceMeta.device_model) provenance.device_model = deviceMeta.device_model;
      }
      if (o.metric_type) provenance.metric_type = o.metric_type;
      if (o.sample_uuid) provenance.sample_uuid = o.sample_uuid;
      if (isActiveProtocol && pq) {
        provenance.protocol_id = pq.protocol_id;
        provenance.protocol_question_id = pq.id;
        provenance.question_kind = pq.kind;
        if (typeof o.confidence === 'number') provenance.confidence = o.confidence;
        if (typeof o.raw_text === 'string' && o.raw_text.length > 0) provenance.raw_text = o.raw_text;
      }

      return {
        patient_id: patient.id,
        tenant_id: patient.tenant_id,
        category,
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
  const noisy = rows.filter((r) => r.data_quality_tag === 'noisy').length;
  const patient_reported = rows.filter((r) => r.category === 'patient-reported').length;

  return NextResponse.json({
    success: true,
    batch_id: batchId,
    total: rows.length,
    accepted,
    rejected,
    outliers,
    noisy,
    patient_reported,
  });
}
