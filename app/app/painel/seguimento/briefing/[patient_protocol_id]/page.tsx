// Briefing pre-consulta — pagina printable do modulo Seguimento de Tratamento.
// Server Component. Resolve patient_protocol_id, fetcha health_observations
// e alert_events do periodo (90 dias por padrao) e renderiza relatorio em
// 1 pagina HTML compativel com Cmd+P -> Save as PDF.
//
// MVP: sem PDF binario, sem upload pra Supabase Storage. Fase 2 evolui pra
// puppeteer + storage. Por enquanto, appointments.briefing_pdf_url pode
// apontar pra esta URL.

import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { ACTIVE_TENANT_COOKIE } from "@/lib/auth-tenant";
import { aggregate, type BriefingData, type RawObservation, type RawAlertEvent } from "@/lib/seguimento/briefing";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: { patient_protocol_id: string };
  searchParams: { period_days?: string };
}

export default async function BriefingPage({ params, searchParams }: PageProps) {
  // ---- auth + tenant
  const supa = createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) redirect("/login");

  const tenantId = cookies().get(ACTIVE_TENANT_COOKIE)?.value ?? null;
  if (!tenantId) redirect("/painel");

  const admin = supabaseAdmin();
  const { data: member } = await admin
    .from("tenant_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .maybeSingle();
  if (!member) redirect("/painel");

  // ---- params
  const ppId = Number(params.patient_protocol_id);
  if (!Number.isFinite(ppId) || ppId <= 0) notFound();

  const periodDays = Math.min(Math.max(Number(searchParams.period_days ?? "90") || 90, 7), 365);

  // ---- patient_protocol
  const { data: pp, error: ppErr } = await admin
    .from("patient_protocols")
    .select(`
      id, patient_id, tenant_id, protocol_id, started_at, ends_at,
      next_consultation_at, status, notes,
      protocol:treatment_protocols(slug, name, description, duration_weeks),
      patient:patients(id, name, birthdate, phone)
    `)
    .eq("id", ppId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (ppErr || !pp || !pp.patient || !pp.protocol) notFound();

  // ---- period
  const end = pp.next_consultation_at ? new Date(pp.next_consultation_at) : new Date();
  const start = new Date(end.getTime() - periodDays * 24 * 3600 * 1000);

  // ---- observations + alerts
  const [{ data: obsRaw }, { data: alertsRaw }] = await Promise.all([
    admin
      .from("health_observations")
      .select("id, loinc_code, category, value_numeric, value_text, unit, effective_time, data_quality_tag, device_provenance")
      .eq("patient_id", pp.patient_id)
      .eq("tenant_id", tenantId)
      .gte("effective_time", start.toISOString())
      .lte("effective_time", end.toISOString())
      .order("effective_time", { ascending: true })
      .limit(2000),
    admin
      .from("alert_events")
      .select("id, severity, source, reason, created_at, acknowledged_at")
      .eq("patient_id", pp.patient_id)
      .eq("tenant_id", tenantId)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const patientRow: any = pp.patient;
  const protocolRow: any = pp.protocol;

  const data: BriefingData = aggregate({
    patient_protocol_id: pp.id,
    patient: {
      id: patientRow.id,
      name: patientRow.name ?? null,
      birth_date: patientRow.birthdate ?? null,
      phone: patientRow.phone ?? null,
    },
    protocol: {
      slug: protocolRow.slug,
      name: protocolRow.name,
      description: protocolRow.description ?? null,
      duration_weeks: protocolRow.duration_weeks ?? 12,
    },
    period_start: start.toISOString(),
    period_end: end.toISOString(),
    observations: (obsRaw ?? []) as RawObservation[],
    alerts: (alertsRaw ?? []) as RawAlertEvent[],
  });

  return <BriefingReport data={data} />;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function flagColor(f: BriefingData["flag"]): string {
  return f === "green" ? "#10b981" : f === "yellow" ? "#f59e0b" : "#ef4444";
}

function flagLabel(f: BriefingData["flag"]): string {
  return f === "green" ? "Estavel" : f === "yellow" ? "Atencao" : "Critico";
}

function BriefingReport({ data }: { data: BriefingData }) {
  const fullName = data.patient.name || "(sem nome)";
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4; margin: 14mm 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .printable { max-width: 760px; margin: 0 auto; padding: 28px 24px; }
        .hairline { border: 1px solid rgba(0,0,0,0.08); }
        .hairline-b { border-bottom: 1px solid rgba(0,0,0,0.08); }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .quad { padding: 14px 16px; border-radius: 12px; }
        .label { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #71717a; font-weight: 600; }
        .num { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; }
        .row { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 0; }
      `}</style>

      <div className="no-print" style={{ background: "#f4f4f5", borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "12px 16px" }}>
        <div className="printable" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 0 }}>
          <span style={{ fontSize: 12, color: "#71717a" }}>
            Briefing pre-consulta · {fmtDate(data.period.start)} - {fmtDate(data.period.end)} · {data.period.days} dias
          </span>
          <PrintButton />
        </div>
      </div>

      <div className="printable">
        {/* Cabecalho */}
        <header className="hairline-b" style={{ paddingBottom: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div className="label" style={{ marginBottom: 4 }}>Singulare — Seguimento</div>
              <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>{fullName}</h1>
              <div style={{ fontSize: 13, color: "#52525b", marginTop: 2 }}>
                {data.age_years !== null ? `${data.age_years} anos` : "idade ?"} · {data.protocol.name}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  display: "inline-block",
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: flagColor(data.flag),
                  color: "white",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {flagLabel(data.flag)}
              </div>
              <div style={{ fontSize: 11, color: "#71717a", marginTop: 6 }}>
                {fmtDate(data.period.start)} → {fmtDate(data.period.end)}
              </div>
            </div>
          </div>
          <ul style={{ marginTop: 12, paddingLeft: 18, fontSize: 13, color: "#3f3f46" }}>
            {data.flag_reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </header>

        {/* TL;DR */}
        <section style={{ marginBottom: 20 }}>
          <div className="label" style={{ marginBottom: 8 }}>Resumo</div>
          <ol style={{ paddingLeft: 22, margin: 0, fontSize: 14, lineHeight: 1.6, color: "#18181b" }}>
            {data.tldr.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ol>
        </section>

        {/* 4 quadrantes */}
        <section className="grid-2" style={{ marginBottom: 20 }}>
          <div className="quad hairline">
            <div className="label">Adesao medicamentosa</div>
            <div className="num" style={{ marginTop: 6 }}>
              {data.adherence.pct !== null ? `${data.adherence.pct}%` : "—"}
            </div>
            <div style={{ fontSize: 12, color: "#71717a", marginTop: 2 }}>
              {data.adherence.perfect}/{data.adherence.answered} semanas completas (MMAS-8)
            </div>
          </div>

          <div className="quad hairline">
            <div className="label">Sinais vitais</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              <div className="row hairline-b">
                <span>PA media</span>
                <span style={{ fontWeight: 600 }}>{data.vitals.sbp_avg ?? "—"}/{data.vitals.dbp_avg ?? "—"}</span>
              </div>
              <div className="row hairline-b">
                <span>Pico</span>
                <span style={{ fontWeight: 600 }}>{data.vitals.sbp_max ?? "—"}/{data.vitals.dbp_max ?? "—"}</span>
              </div>
              <div className="row hairline-b">
                <span>FC repouso</span>
                <span style={{ fontWeight: 600 }}>{data.vitals.hr_resting_avg ?? "—"} bpm</span>
              </div>
              <div className="row">
                <span>SpO2 minima</span>
                <span style={{ fontWeight: 600 }}>{data.vitals.spo2_min ?? "—"}%</span>
              </div>
            </div>
          </div>

          <div className="quad hairline">
            <div className="label">Atividade e sono</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              <div className="row hairline-b">
                <span>Passos/dia</span>
                <span style={{ fontWeight: 600 }}>
                  {data.activity.steps_avg_per_day !== null ? data.activity.steps_avg_per_day.toLocaleString("pt-BR") : "—"}
                </span>
              </div>
              <div className="row hairline-b">
                <span>Sessoes/sem</span>
                <span style={{ fontWeight: 600 }}>{data.activity.sessions_reported_avg_per_week ?? "—"}</span>
              </div>
              <div className="row">
                <span>Sono medio</span>
                <span style={{ fontWeight: 600 }}>{data.activity.sleep_hours_avg ?? "—"} h</span>
              </div>
            </div>
          </div>

          <div className="quad hairline">
            <div className="label">Peso e metabolico</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              <div className="row hairline-b">
                <span>Peso primeiro</span>
                <span style={{ fontWeight: 600 }}>{data.vitals.weight_first ?? "—"} kg</span>
              </div>
              <div className="row hairline-b">
                <span>Peso ultimo</span>
                <span style={{ fontWeight: 600 }}>{data.vitals.weight_last ?? "—"} kg</span>
              </div>
              <div className="row hairline-b">
                <span>Variacao</span>
                <span style={{ fontWeight: 600, color: data.vitals.weight_delta_kg !== null && Math.abs(data.vitals.weight_delta_kg) >= 2 ? "#ef4444" : undefined }}>
                  {data.vitals.weight_delta_kg !== null ? `${data.vitals.weight_delta_kg > 0 ? "+" : ""}${data.vitals.weight_delta_kg} kg` : "—"}
                </span>
              </div>
              <div className="row">
                <span>Glicemia media</span>
                <span style={{ fontWeight: 600 }}>{data.vitals.glucose_avg ?? "—"} mg/dL</span>
              </div>
            </div>
          </div>
        </section>

        {/* Alertas + sintomas */}
        <section style={{ marginBottom: 20 }}>
          <div className="label" style={{ marginBottom: 8 }}>
            Alertas no periodo: {data.alerts_summary.critical} critico(s), {data.alerts_summary.warning} atencao
          </div>
          {data.alerts.length === 0 ? (
            <div style={{ fontSize: 13, color: "#71717a", padding: "10px 14px", borderRadius: 8, background: "#f4f4f5" }}>
              Sem alertas registrados.
            </div>
          ) : (
            <div className="hairline" style={{ borderRadius: 10 }}>
              {data.alerts.map((a, i) => (
                <div
                  key={a.id}
                  className={i < data.alerts.length - 1 ? "hairline-b" : ""}
                  style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", fontSize: 13 }}
                >
                  <div>
                    <span style={{ fontWeight: 600, color: a.severity === "critical" ? "#ef4444" : a.severity === "warning" ? "#f59e0b" : "#71717a" }}>
                      [{a.severity}]
                    </span>{" "}
                    {a.reason}
                  </div>
                  <div style={{ color: "#71717a", whiteSpace: "nowrap", marginLeft: 12 }}>{fmtDateTime(a.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {data.symptoms_reported.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <div className="label" style={{ marginBottom: 8 }}>Sintomas relatados</div>
            <div className="hairline" style={{ borderRadius: 10 }}>
              {data.symptoms_reported.map((s, i) => (
                <div
                  key={i}
                  className={i < data.symptoms_reported.length - 1 ? "hairline-b" : ""}
                  style={{ padding: "10px 14px", fontSize: 13 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, color: s.severity_hint === "critical" ? "#ef4444" : s.severity_hint === "warning" ? "#f59e0b" : "#52525b" }}>
                      [{s.severity_hint}]
                    </span>
                    <span style={{ color: "#71717a" }}>{fmtDateTime(s.when)}</span>
                  </div>
                  <div style={{ color: "#18181b" }}>{s.raw_text ?? "(sem texto)"}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="hairline-b" style={{ borderBottom: "none", borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 12, marginTop: 24, fontSize: 11, color: "#a1a1aa" }}>
          {data.observations_count} observacoes processadas · Protocolo {data.protocol.slug} · ID {data.patient_protocol_id}
          {" · "}Gerado em {fmtDateTime(new Date().toISOString())}.
        </footer>
      </div>
    </div>
  );
}
