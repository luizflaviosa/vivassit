// Briefing pre-consulta — agregacao de health_observations + alert_events
// pro medico ler antes da consulta de retorno. Pure functions: recebe dados
// brutos do banco e devolve estrutura pronta pra renderizar.
//
// LOINC referenciados (subset):
//   8480-6  SBP (sistolica)
//   8462-4  DBP (diastolica)
//   8867-4  HR (frequencia cardiaca)
//   40443-4 Resting HR
//   59408-5 SpO2
//   29463-7 Peso
//   2339-0  Glicemia
//   55423-8 Passos
//   41950-7 Distancia caminhada
//   93832-4 Sono (duracao em segundos)
//   71799-1 Adherence (MMAS-8 like)
//
// Codes singulare: prefixo 'singulare:' pra observacoes autorrelatadas sem LOINC oficial.

export type ClinicalFlag = "green" | "yellow" | "red";
export type Severity = "info" | "warning" | "critical";

export interface BriefingPatient {
  id: number;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  phone: string | null;
}

export interface BriefingProtocol {
  slug: string;
  name: string;
  description: string | null;
  duration_weeks: number;
}

export interface RawObservation {
  id?: number;
  loinc_code: string;
  category: string;
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  effective_time: string;
  data_quality_tag: string;
  device_provenance: Record<string, unknown> | null;
}

export interface RawAlertEvent {
  id: number;
  severity: Severity;
  source: string;
  reason: string;
  created_at: string;
  acknowledged_at: string | null;
}

export interface BriefingData {
  patient_protocol_id: number;
  patient: BriefingPatient;
  protocol: BriefingProtocol;
  period: { start: string; end: string; days: number };
  age_years: number | null;
  flag: ClinicalFlag;
  flag_reasons: string[];
  tldr: string[];
  adherence: {
    answered: number;
    perfect: number;
    pct: number | null;
  };
  vitals: {
    sbp_avg: number | null;
    sbp_max: number | null;
    dbp_avg: number | null;
    dbp_max: number | null;
    hr_resting_avg: number | null;
    spo2_min: number | null;
    weight_first: number | null;
    weight_last: number | null;
    weight_delta_kg: number | null;
    glucose_avg: number | null;
  };
  activity: {
    steps_avg_per_day: number | null;
    sessions_reported_avg_per_week: number | null;
    sleep_hours_avg: number | null;
  };
  symptoms_reported: Array<{
    when: string;
    raw_text: string | null;
    severity_hint: Severity;
  }>;
  alerts_summary: { warning: number; critical: number };
  alerts: RawAlertEvent[];
  observations_count: number;
  observations_tail: RawObservation[];
}

const LOINC = {
  SBP: "8480-6",
  DBP: "8462-4",
  HR: "8867-4",
  HR_RESTING: "40443-4",
  SPO2: "59408-5",
  WEIGHT: "29463-7",
  GLUCOSE: "2339-0",
  STEPS: "55423-8",
  DISTANCE: "41950-7",
  SLEEP_DURATION: "93832-4",
  ADHERENCE: "71799-1",
} as const;

function avg(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function pickNumeric(obs: RawObservation[], code: string): number[] {
  return obs
    .filter((o) => o.loinc_code === code && typeof o.value_numeric === "number" && o.data_quality_tag !== "rejected")
    .map((o) => o.value_numeric as number);
}

function pickPatientReported(obs: RawObservation[], kind: string): RawObservation[] {
  return obs.filter((o) => {
    if (o.category !== "patient-reported" && o.category !== "survey") return false;
    const k = (o.device_provenance as Record<string, unknown> | null)?.question_kind;
    return k === kind;
  });
}

function ageFromBirthdate(birth: string | null, ref: Date): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  if (Number.isNaN(b.getTime())) return null;
  let age = ref.getFullYear() - b.getFullYear();
  const m = ref.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < b.getDate())) age--;
  return age;
}

export function aggregate(input: {
  patient_protocol_id: number;
  patient: BriefingPatient;
  protocol: BriefingProtocol;
  period_start: string;
  period_end: string;
  observations: RawObservation[];
  alerts: RawAlertEvent[];
}): BriefingData {
  const start = new Date(input.period_start);
  const end = new Date(input.period_end);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 3600 * 1000)));
  const obs = input.observations.filter((o) => o.data_quality_tag !== "rejected");

  // ----- ADERENCIA: MMAS-8 like ------
  // value_numeric = dias esquecidos na semana (0 = perfeito).
  // Se vier value_text 'sim'/'nao', mapeamos: 'sim' = 0 esquecidos, 'nao' = 7.
  const adherenceObs = obs.filter((o) => o.loinc_code === LOINC.ADHERENCE);
  let answered = adherenceObs.length;
  let perfect = 0;
  for (const o of adherenceObs) {
    if (typeof o.value_numeric === "number") {
      if (o.value_numeric === 0) perfect++;
    } else if (o.value_text) {
      const t = o.value_text.toLowerCase();
      if (t.startsWith("sim") || t.includes("todos")) perfect++;
    }
  }
  const adherencePct = answered > 0 ? perfect / answered : null;

  // ----- VITAIS ------
  const sbp = pickNumeric(obs, LOINC.SBP);
  const dbp = pickNumeric(obs, LOINC.DBP);
  const hr = pickNumeric(obs, LOINC.HR_RESTING).concat(
    obs.filter((o) => o.loinc_code === LOINC.HR && ((o.device_provenance as Record<string, unknown> | null)?.is_resting === true))
      .map((o) => o.value_numeric as number)
  );
  const spo2 = pickNumeric(obs, LOINC.SPO2);
  const weights = obs
    .filter((o) => o.loinc_code === LOINC.WEIGHT && typeof o.value_numeric === "number")
    .sort((a, b) => new Date(a.effective_time).getTime() - new Date(b.effective_time).getTime());
  const weightFirst = weights[0]?.value_numeric ?? null;
  const weightLast = weights[weights.length - 1]?.value_numeric ?? null;
  const weightDelta = weightFirst != null && weightLast != null ? Number((weightLast - weightFirst).toFixed(1)) : null;
  const glucose = pickNumeric(obs, LOINC.GLUCOSE);

  // ----- ATIVIDADE ------
  const stepsObs = pickNumeric(obs, LOINC.STEPS);
  const stepsAvgPerDay = stepsObs.length > 0 ? Math.round((stepsObs.reduce((a, b) => a + b, 0) / Math.max(days, 1))) : null;
  const activitySelfReported = pickPatientReported(obs, "activity_self_report");
  const activitySessions = activitySelfReported
    .map((o) => o.value_numeric)
    .filter((v): v is number => typeof v === "number");
  const sessionsAvgPerWeek = activitySessions.length > 0 ? Number(avg(activitySessions)!.toFixed(1)) : null;
  const sleepObs = pickNumeric(obs, LOINC.SLEEP_DURATION); // segundos
  const sleepHoursAvg = sleepObs.length > 0 ? Number(((avg(sleepObs) as number) / 3600).toFixed(1)) : null;

  // ----- SINTOMAS REPORTADOS ------
  const symptomsKind = pickPatientReported(obs, "symptom_keyword").concat(pickPatientReported(obs, "symptom_open"));
  const symptoms_reported = symptomsKind
    .map((o) => {
      const rawText = (o.device_provenance as Record<string, unknown> | null)?.raw_text as string | null
        ?? o.value_text
        ?? null;
      const t = (rawText ?? "").toLowerCase();
      const critical = /(dor.*peito|sufoco|sincope|desmai|sangue.*urin|hematom)/i.test(t);
      const warning = /(falta.*ar|tontur|cans|palpita|edema|incha)/i.test(t);
      const sev: Severity = critical ? "critical" : warning ? "warning" : "info";
      return { when: o.effective_time, raw_text: rawText, severity_hint: sev };
    })
    .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());

  // ----- ALERTAS ------
  const alertsCritical = input.alerts.filter((a) => a.severity === "critical").length;
  const alertsWarning = input.alerts.filter((a) => a.severity === "warning").length;

  // ----- BANDEIRA CLINICA ------
  const flagReasons: string[] = [];
  let flag: ClinicalFlag = "green";

  if (alertsCritical > 0) {
    flag = "red";
    flagReasons.push(`${alertsCritical} alerta(s) critico(s) no periodo`);
  }
  if (adherencePct !== null && adherencePct < 0.6) {
    flag = flag === "red" ? "red" : "red";
    flagReasons.push(`Adesao baixa (${Math.round(adherencePct * 100)}%)`);
  } else if (adherencePct !== null && adherencePct < 0.8) {
    if (flag === "green") flag = "yellow";
    flagReasons.push(`Adesao parcial (${Math.round(adherencePct * 100)}%)`);
  }
  if (symptoms_reported.some((s) => s.severity_hint === "critical")) {
    flag = "red";
    flagReasons.push("Sintoma critico relatado");
  }
  if (alertsWarning > 0 && flag === "green") {
    flag = "yellow";
    flagReasons.push(`${alertsWarning} alerta(s) de atencao`);
  }
  const sbpMax = sbp.length > 0 ? Math.max(...sbp) : null;
  const dbpMax = dbp.length > 0 ? Math.max(...dbp) : null;
  if ((sbpMax !== null && sbpMax >= 180) || (dbpMax !== null && dbpMax >= 110)) {
    flag = "red";
    flagReasons.push(`Pico hipertensivo (PA ${sbpMax ?? "?"}/${dbpMax ?? "?"})`);
  } else if ((sbpMax !== null && sbpMax >= 160) || (dbpMax !== null && dbpMax >= 100)) {
    if (flag === "green") flag = "yellow";
    flagReasons.push(`Pico de PA fora da meta (${sbpMax ?? "?"}/${dbpMax ?? "?"})`);
  }
  if (weightDelta !== null && Math.abs(weightDelta) >= 2 && input.protocol.slug === "icc") {
    flag = "red";
    flagReasons.push(`Variacao de peso ${weightDelta > 0 ? "+" : ""}${weightDelta}kg em IC`);
  }
  if (flagReasons.length === 0) {
    flagReasons.push("Dentro da meta clinica e do protocolo");
  }

  // ----- TL;DR (3 bullets, heuristico) ------
  const tldr: string[] = [];
  if (adherencePct !== null) {
    tldr.push(`Adesao ${Math.round(adherencePct * 100)}% (${perfect}/${answered} semanas com tratamento completo).`);
  }
  if (sbpMax !== null || dbpMax !== null) {
    const sbpAvg = sbp.length ? Math.round(avg(sbp) as number) : null;
    const dbpAvg = dbp.length ? Math.round(avg(dbp) as number) : null;
    tldr.push(`PA media ${sbpAvg ?? "?"}/${dbpAvg ?? "?"} mmHg (pico ${sbpMax ?? "?"}/${dbpMax ?? "?"}).`);
  }
  if (symptoms_reported.length > 0) {
    const last = symptoms_reported[0];
    tldr.push(`Ultimo sintoma reportado: "${(last.raw_text ?? "").slice(0, 60)}".`);
  } else if (weightDelta !== null) {
    tldr.push(`Peso ${weightDelta > 0 ? "+" : ""}${weightDelta}kg no periodo.`);
  } else if (stepsAvgPerDay !== null) {
    tldr.push(`Atividade media ${stepsAvgPerDay} passos/dia.`);
  }
  while (tldr.length < 3) tldr.push("Sem dado relevante adicional no periodo.");

  return {
    patient_protocol_id: input.patient_protocol_id,
    patient: input.patient,
    protocol: input.protocol,
    period: { start: input.period_start, end: input.period_end, days },
    age_years: ageFromBirthdate(input.patient.birth_date, end),
    flag,
    flag_reasons: flagReasons,
    tldr,
    adherence: {
      answered,
      perfect,
      pct: adherencePct !== null ? Number((adherencePct * 100).toFixed(0)) : null,
    },
    vitals: {
      sbp_avg: sbp.length ? Math.round(avg(sbp) as number) : null,
      sbp_max: sbpMax,
      dbp_avg: dbp.length ? Math.round(avg(dbp) as number) : null,
      dbp_max: dbpMax,
      hr_resting_avg: hr.length ? Math.round(avg(hr) as number) : null,
      spo2_min: spo2.length ? Math.min(...spo2) : null,
      weight_first: weightFirst,
      weight_last: weightLast,
      weight_delta_kg: weightDelta,
      glucose_avg: glucose.length ? Math.round(avg(glucose) as number) : null,
    },
    activity: {
      steps_avg_per_day: stepsAvgPerDay,
      sessions_reported_avg_per_week: sessionsAvgPerWeek,
      sleep_hours_avg: sleepHoursAvg,
    },
    symptoms_reported: symptoms_reported.slice(0, 10),
    alerts_summary: { warning: alertsWarning, critical: alertsCritical },
    alerts: input.alerts.slice(0, 20),
    observations_count: obs.length,
    observations_tail: obs.slice(-20),
  };
}
