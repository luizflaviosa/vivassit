import { serve } from "std/http/server.ts";
import { createClient } from "supabase";
import { z } from "zod";
import { corsHeaders } from "../_shared/cors.ts";

// LOINC subset cardio.
const LOINC = {
  HEART_RATE: "8867-4",
  HRV_SDNN: "80404-7",
  STEPS: "55423-8",
  DISTANCE_WALKING: "41950-7",
  SLEEP_DURATION: "93832-4",
  SLEEP_STAGE: "93831-6",
  BP_SYSTOLIC: "8480-6",
  BP_DIASTOLIC: "8462-4",
  BODY_TEMPERATURE: "8310-5",
  SPO2: "59408-5",
} as const;

const LOINC_CATEGORY: Record<string, "vital-signs" | "activity" | "sleep"> = {
  [LOINC.HEART_RATE]: "vital-signs",
  [LOINC.HRV_SDNN]: "vital-signs",
  [LOINC.STEPS]: "activity",
  [LOINC.DISTANCE_WALKING]: "activity",
  [LOINC.SLEEP_DURATION]: "sleep",
  [LOINC.SLEEP_STAGE]: "sleep",
  [LOINC.BP_SYSTOLIC]: "vital-signs",
  [LOINC.BP_DIASTOLIC]: "vital-signs",
  [LOINC.BODY_TEMPERATURE]: "vital-signs",
  [LOINC.SPO2]: "vital-signs",
};

const LOINC_DISPLAY: Record<string, string> = {
  [LOINC.HEART_RATE]: "Heart rate",
  [LOINC.HRV_SDNN]: "R-R interval standard deviation (SDNN)",
  [LOINC.STEPS]: "Number of steps",
  [LOINC.DISTANCE_WALKING]: "Distance walked",
  [LOINC.SLEEP_DURATION]: "Sleep duration",
  [LOINC.SLEEP_STAGE]: "Sleep stage",
  [LOINC.BP_SYSTOLIC]: "Systolic blood pressure",
  [LOINC.BP_DIASTOLIC]: "Diastolic blood pressure",
  [LOINC.BODY_TEMPERATURE]: "Body temperature",
  [LOINC.SPO2]: "Oxygen saturation",
};

// [reject_below, outlier_below, outlier_above, reject_above]
const PHYSIOLOGICAL_RANGES: Record<string, [number, number, number, number]> = {
  [LOINC.HEART_RATE]: [25, 35, 220, 240],
  [LOINC.HRV_SDNN]: [0, 5, 250, 500],
  [LOINC.BP_SYSTOLIC]: [50, 80, 200, 260],
  [LOINC.BP_DIASTOLIC]: [30, 50, 130, 180],
  [LOINC.BODY_TEMPERATURE]: [32, 35, 40, 43],
  [LOINC.SPO2]: [70, 85, 100, 100],
};

function classifyQuality(code: string, value: number): "clean" | "outlier" | "rejected" {
  const range = PHYSIOLOGICAL_RANGES[code];
  if (!range) return "clean";
  const [rejLow, outLow, outHigh, rejHigh] = range;
  if (value < rejLow || value > rejHigh) return "rejected";
  if (value < outLow || value > outHigh) return "outlier";
  return "clean";
}

const ObservationSchema = z.object({
  loinc_code: z.string().min(1),
  value_numeric: z.number().finite().nullable().optional(),
  value_text: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  effective_time: z.string().datetime(),
  effective_period_end: z.string().datetime().nullable().optional(),
  source: z.string().min(1),
}).refine(
  (o) => (o.value_numeric !== null && o.value_numeric !== undefined) || (o.value_text !== null && o.value_text !== undefined),
  { message: "either value_numeric or value_text required" },
);

const BatchSchema = z.object({
  tenant_id: z.string().min(1),
  patient_id: z.number().int().positive(),
  device: z.object({
    platform: z.enum(["ios", "android", "test"]),
    os_version: z.string().optional(),
    app_version: z.string().optional(),
    device_model: z.string().optional(),
  }).optional(),
  observations: z.array(ObservationSchema).min(1).max(500),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => null);
  const parsed = BatchSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "bad_payload", details: parsed.error.flatten() }, 400);
  }
  const batch = parsed.data;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Verifica paciente existe nesse tenant.
  const { data: patient, error: pErr } = await admin
    .from("patients")
    .select("id, tenant_id")
    .eq("id", batch.patient_id)
    .eq("tenant_id", batch.tenant_id)
    .maybeSingle();
  if (pErr) return json({ error: "db_error", detail: pErr.message }, 500);
  if (!patient) return json({ error: "patient_not_found_in_tenant" }, 404);

  const batchId = crypto.randomUUID();

  const rows = batch.observations.map((o) => {
    const quality = o.value_numeric != null
      ? classifyQuality(o.loinc_code, o.value_numeric)
      : "clean";
    return {
      patient_id: patient.id,
      tenant_id: patient.tenant_id,
      category: LOINC_CATEGORY[o.loinc_code] ?? "vital-signs",
      loinc_code: o.loinc_code,
      display_name: LOINC_DISPLAY[o.loinc_code] ?? o.loinc_code,
      value_numeric: o.value_numeric ?? null,
      value_text: o.value_text ?? null,
      unit: o.unit ?? null,
      effective_time: o.effective_time,
      effective_period_end: o.effective_period_end ?? null,
      device_provenance: batch.device
        ? {
            source: o.source,
            platform: batch.device.platform,
            os_version: batch.device.os_version,
            app_version: batch.device.app_version,
            device_model: batch.device.device_model,
          }
        : { source: o.source },
      data_quality_tag: quality,
      ingest_batch_id: batchId,
    };
  });

  const { error: iErr, count } = await admin
    .from("health_observations")
    .upsert(rows, {
      onConflict: "patient_id,loinc_code,effective_time",
      ignoreDuplicates: true,
      count: "exact",
    });
  if (iErr) return json({ error: "insert_failed", detail: iErr.message }, 500);

  const accepted = count ?? rows.length;
  const rejected = rows.filter((r) => r.data_quality_tag === "rejected").length;
  const outliers = rows.filter((r) => r.data_quality_tag === "outlier").length;

  return json(
    { batch_id: batchId, total: rows.length, accepted, rejected, outliers },
    200,
  );
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
