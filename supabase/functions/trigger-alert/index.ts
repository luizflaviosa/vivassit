// Edge function: trigger-alert
//
// Ponto unico de disparo de alertas clinicos do modulo Seguimento de Tratamento.
// MVP v1: persiste em alert_events com notified_* = false. Despacho real
// (WhatsApp via Evolution + Chatwoot) e responsabilidade de outro componente
// (N8N P04 ou cron) que polla rows com notified_* = false.
//
// Chamado por:
//   - Trigger postgres em health_observations (passivo critico via pg_net)
//   - Endpoint /api/saude/[token]/ingest quando resposta ativa cruza threshold
//   - Painel (acao manual do medico/secretaria)
//
// Sem verify_jwt (padrao do projeto, igual ingest-vitals). v2 endurecer.

import { serve } from "std/http/server.ts";
import { createClient } from "supabase";
import { z } from "zod";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const InputSchema = z.object({
  tenant_id: z.string().min(1),
  patient_id: z.number().int().positive(),
  severity: z.enum(["info", "warning", "critical"]),
  source: z.enum(["passive_outlier", "active_keyword", "active_threshold", "manual"]),
  trigger_observation_id: z.number().int().positive().nullable().optional(),
  reason: z.string().min(1).max(500),
  payload: z.record(z.unknown()).nullable().optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const body = await req.json().catch(() => null);
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "bad_payload", details: parsed.error.flatten() }, 400);
  }
  const input = parsed.data;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Defesa: valida que o paciente pertence ao tenant antes de criar alerta.
  const { data: patient, error: pErr } = await admin
    .from("patients")
    .select("id, tenant_id")
    .eq("id", input.patient_id)
    .eq("tenant_id", input.tenant_id)
    .maybeSingle();
  if (pErr) return json({ error: "db_error", detail: pErr.message }, 500);
  if (!patient) return json({ error: "patient_not_found_in_tenant" }, 404);

  const { data: inserted, error: iErr } = await admin
    .from("alert_events")
    .insert({
      tenant_id: input.tenant_id,
      patient_id: input.patient_id,
      severity: input.severity,
      source: input.source,
      trigger_observation_id: input.trigger_observation_id ?? null,
      reason: input.reason,
      payload: input.payload ?? null,
      notified_chatwoot: false,
      notified_doctor_whatsapp: false,
    })
    .select("id, severity, source, reason, created_at")
    .single();

  if (iErr) return json({ error: "insert_failed", detail: iErr.message }, 500);

  return json({
    alert_event_id: inserted.id,
    severity: inserted.severity,
    source: inserted.source,
    reason: inserted.reason,
    created_at: inserted.created_at,
    pending_dispatch: true,
  }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
