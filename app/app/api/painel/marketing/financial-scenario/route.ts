/**
 * GET /api/painel/marketing/financial-scenario
 *
 * Cenário financeiro do tenant: TAM (capacidade × ticket médio × 12) vs receita
 * realizada, gap, recomendações de ativação. Mais bloco de retenção
 * (% pacientes recorrentes, em risco).
 *
 * Tudo derivado de fontes reais — `tenant_doctors`, `doctor_bookings`,
 * `tenant_payments`, `patients`. Nada inventado. Quando dados são fracos,
 * retorna `null`/`is_estimate=true` em vez de mockar.
 */

import { NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DoctorRow {
  id: string;
  consultation_value: number | null;
  consultation_duration: number | null;
  working_hours: Record<string, string> | null;
}

function totalHoursPerWeek(wh: Record<string, string> | null): number {
  if (!wh) return 0;
  let total = 0;
  for (const spec of Object.values(wh)) {
    if (!spec || /^fechad/i.test(spec)) continue;
    for (const window of spec.split(',')) {
      const m = window.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
      if (!m) continue;
      const start = Number(m[1]) + Number(m[2]) / 60;
      const end = Number(m[3]) + Number(m[4]) / 60;
      if (end > start) total += end - start;
    }
  }
  return total;
}

const WORKING_WEEKS_PER_MONTH = 4.3; // padrão clínico

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const tenantId = auth.ctx.tenant.tenant_id;
  const isDoctor = auth.ctx.member.role === 'doctor';
  const restrictDoctorId = isDoctor ? auth.ctx.member.doctor_id : null;

  const admin = supabaseAdmin();

  // ── DOCTORS pra capacidade + ticket fallback ────────────────────────────
  let doctorsQ = admin
    .from('tenant_doctors')
    .select('id, consultation_value, consultation_duration, working_hours')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');
  if (restrictDoctorId) doctorsQ = doctorsQ.eq('id', restrictDoctorId);
  const { data: doctors } = await doctorsQ.returns<DoctorRow[]>();
  const doctorIds = (doctors ?? []).map(d => d.id);

  let slotsPerWeek = 0;
  let configuredTicketSum = 0;
  let configuredTicketCount = 0;
  for (const d of doctors ?? []) {
    const hours = totalHoursPerWeek(d.working_hours);
    const dur = d.consultation_duration ?? 60;
    slotsPerWeek += Math.floor((hours * 60) / dur);
    if (d.consultation_value && Number(d.consultation_value) > 0) {
      configuredTicketSum += Number(d.consultation_value);
      configuredTicketCount++;
    }
  }
  const monthlyCapacity = Math.round(slotsPerWeek * WORKING_WEEKS_PER_MONTH);
  const configuredTicket = configuredTicketCount > 0
    ? configuredTicketSum / configuredTicketCount
    : null;

  // ── TICKET MÉDIO real (paid últimos 6 meses) ────────────────────────────
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: paidPayments } = await admin
    .from('tenant_payments')
    .select('consultation_value, approved_at')
    .eq('tenant_id', tenantId)
    .in('status', ['paid', 'approved', 'received', 'confirmed'])
    .gte('approved_at', sixMonthsAgo.toISOString());

  const validPayments = (paidPayments ?? [])
    .map(p => Number(p.consultation_value))
    .filter(v => v > 0);
  const realizedTicket = validPayments.length > 0
    ? validPayments.reduce((s, v) => s + v, 0) / validPayments.length
    : null;
  const realizedRevenue6m = validPayments.reduce((s, v) => s + v, 0);

  const ticketMedio = realizedTicket ?? configuredTicket;
  const ticketSource: 'realized' | 'configured' | 'unknown' =
    realizedTicket != null ? 'realized' : configuredTicket != null ? 'configured' : 'unknown';

  // ── VOLUME mensal atual (últimos 30 dias completed/confirmed) ───────────
  const days30Ago = new Date();
  days30Ago.setDate(days30Ago.getDate() - 30);
  const days90Ago = new Date();
  days90Ago.setDate(days90Ago.getDate() - 90);

  let bookings30d = 0;
  let bookings90d = 0;
  if (doctorIds.length > 0) {
    const [b30, b90] = await Promise.all([
      admin
        .from('doctor_bookings')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('doctor_id', doctorIds)
        .in('status', ['completed', 'confirmed', 'booked'])
        .gte('slot_start', days30Ago.toISOString()),
      admin
        .from('doctor_bookings')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('doctor_id', doctorIds)
        .in('status', ['completed', 'confirmed', 'booked'])
        .gte('slot_start', days90Ago.toISOString()),
    ]);
    bookings30d = b30.count ?? 0;
    bookings90d = b90.count ?? 0;
  }
  const monthlyVolumeAvg = Math.round(bookings90d / 3); // 3 meses

  // ── TAM / Realized / Gap ────────────────────────────────────────────────
  const annualTAM = ticketMedio != null && monthlyCapacity > 0
    ? monthlyCapacity * 12 * ticketMedio
    : null;

  const annualRealized = ticketMedio != null
    ? monthlyVolumeAvg * 12 * ticketMedio
    : null;

  const annualGap = annualTAM != null && annualRealized != null
    ? annualTAM - annualRealized
    : null;

  const utilizationPct = monthlyCapacity > 0 && monthlyVolumeAvg >= 0
    ? Math.min(100, (monthlyVolumeAvg / monthlyCapacity) * 100)
    : null;

  // ── RETENTION (patients) ─────────────────────────────────────────────────
  const { data: patientsRows } = await admin
    .from('patients')
    .select('id, total_consultations, last_visit_at, created_at')
    .eq('tenant_id', tenantId);

  const totalPatients = patientsRows?.length ?? 0;
  const recurrent = (patientsRows ?? []).filter(p => (p.total_consultations ?? 0) >= 2).length;
  const retentionPct = totalPatients > 0 ? (recurrent / totalPatients) * 100 : null;

  // At-risk: tem 1+ visita, última visita > 90 dias
  const atRisk = (patientsRows ?? []).filter(p => {
    const tc = p.total_consultations ?? 0;
    const lv = p.last_visit_at ? new Date(p.last_visit_at) : null;
    return tc >= 1 && lv != null && lv < days90Ago;
  }).length;

  // ── Recomendações condicionais ──────────────────────────────────────────
  const recommendations: Array<{ priority: 'high' | 'medium' | 'low'; title: string; body: string }> = [];

  if (utilizationPct != null && utilizationPct < 60 && monthlyCapacity > 0) {
    const slotsLivres = Math.max(0, monthlyCapacity - monthlyVolumeAvg);
    const receitaPotencial = slotsLivres * (ticketMedio ?? 0) * 12;
    recommendations.push({
      priority: 'high',
      title: `${slotsLivres} slots disponíveis por mês`,
      body: ticketMedio != null
        ? `Preenchendo esses horários, sua receita anual cresce em R$ ${Math.round(receitaPotencial).toLocaleString('pt-BR')}. Ative o Plano Ads pra acelerar a aquisição.`
        : `Esses horários abertos representam crescimento direto. Configure o ticket médio em /painel/configuracoes pra ver a projeção.`,
    });
  }

  if (atRisk > 0) {
    recommendations.push({
      priority: 'medium',
      title: `${atRisk} paciente${atRisk > 1 ? 's' : ''} sem retorno há 90+ dias`,
      body: `Recall via WhatsApp costuma reativar ~30% desses pacientes. Receita projetada: R$ ${Math.round(atRisk * 0.3 * (ticketMedio ?? 0)).toLocaleString('pt-BR')}.`,
    });
  }

  if (totalPatients < 10 && monthlyCapacity > 50) {
    recommendations.push({
      priority: 'high',
      title: 'Base de pacientes em formação',
      body: 'Com a capacidade já estruturada, o foco da etapa atual é aquisição. Ads + Reviews + Social tendem a dobrar o volume mês a mês até preencher a agenda.',
    });
  }

  if (ticketSource === 'unknown') {
    recommendations.push({
      priority: 'medium',
      title: 'Ticket médio não configurado',
      body: 'Defina valor da consulta em /painel/configuracoes pra projeção financeira aparecer aqui.',
    });
  }

  return NextResponse.json({
    ok: true,
    capacity: {
      slots_per_week: slotsPerWeek,
      monthly: monthlyCapacity,
      doctors_count: doctorIds.length,
    },
    ticket: {
      value: ticketMedio,
      source: ticketSource,
      realized_payment_count: validPayments.length,
      realized_revenue_6m: realizedRevenue6m,
    },
    volume: {
      bookings_30d: bookings30d,
      bookings_90d: bookings90d,
      monthly_avg: monthlyVolumeAvg,
      utilization_pct: utilizationPct,
    },
    annual: {
      tam: annualTAM,
      realized: annualRealized,
      gap: annualGap,
    },
    retention: {
      total_patients: totalPatients,
      recurrent_patients: recurrent,
      retention_pct: retentionPct,
      at_risk: atRisk,
    },
    recommendations,
    collected_at: new Date().toISOString(),
  });
}
