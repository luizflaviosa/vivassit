/**
 * GET /api/painel/performance
 *
 * Agrega 7 indicadores da clínica pra renderizar o dashboard de Performance:
 * 1. Utilização semanal (slots ocupados / capacidade)
 * 2. Cancelamentos 30d (% + tendência 4 semanas)
 * 3. Pacientes (novos vs retorno este mês)
 * 4. Receita rastreada (paid 30d + breakdown por método)
 * 5. NPS (média + qtd respondentes 30d)
 * 6. Reviews Google (placeholder até integração ativa)
 * 7. Origem do paciente (breakdown por source)
 *
 * Doctor scope: se role=doctor, filtra automaticamente pelo doctor_id linkado.
 */

import { NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DoctorRow {
  id: string;
  doctor_name: string;
  consultation_value: number | null;
  consultation_duration: number | null;
  working_hours: Record<string, string> | null;
}

// "08:00-12:00,14:00-18:00" → 8 horas de janela
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

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const tenantId = auth.ctx.tenant.tenant_id;
  const isDoctor = auth.ctx.member.role === 'doctor';
  const restrictDoctorId = isDoctor ? auth.ctx.member.doctor_id : null;

  const admin = supabaseAdmin();

  // ── DOCTORS (pra calcular capacidade total e ticket médio) ──
  let doctorsQ = admin
    .from('tenant_doctors')
    .select('id, doctor_name, consultation_value, consultation_duration, working_hours')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');
  if (restrictDoctorId) doctorsQ = doctorsQ.eq('id', restrictDoctorId);
  const { data: doctors } = await doctorsQ.returns<DoctorRow[]>();
  const doctorIds = (doctors ?? []).map((d) => d.id);

  // Capacidade total = sum(slots/semana) por doctor.
  // slots/semana = total horas × (60min / consultation_duration)
  let totalSlotsPerWeek = 0;
  let avgConsultValue = 0;
  let valueCount = 0;
  for (const d of doctors ?? []) {
    const hours = totalHoursPerWeek(d.working_hours);
    const dur = d.consultation_duration ?? 60;
    totalSlotsPerWeek += Math.floor((hours * 60) / dur);
    if (d.consultation_value && Number(d.consultation_value) > 0) {
      avgConsultValue += Number(d.consultation_value);
      valueCount++;
    }
  }
  avgConsultValue = valueCount > 0 ? avgConsultValue / valueCount : 0;

  // Helper de boundaries de tempo
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Domingo
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const days30Ago = new Date(now);
  days30Ago.setDate(now.getDate() - 30);

  // ── 1. UTILIZAÇÃO SEMANAL ──
  let bookedThisWeek = 0;
  if (doctorIds.length > 0) {
    const { count } = await admin
      .from('doctor_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('doctor_id', doctorIds)
      .in('status', ['booked', 'confirmed'])
      .gte('slot_start', weekStart.toISOString())
      .lt('slot_start', weekEnd.toISOString());
    bookedThisWeek = count ?? 0;
  }
  const utilizationPct = totalSlotsPerWeek > 0 ? (bookedThisWeek / totalSlotsPerWeek) * 100 : 0;

  // ── 2. CANCELAMENTOS 30D + tendência 4 semanas ──
  let cancellationRate = 0;
  let trend4w: Array<{ week_start: string; rate: number }> = [];
  if (doctorIds.length > 0) {
    const { data: last30 } = await admin
      .from('doctor_bookings')
      .select('status, created_at')
      .eq('tenant_id', tenantId)
      .in('doctor_id', doctorIds)
      .gte('created_at', days30Ago.toISOString());
    const total30 = (last30 ?? []).length;
    const cancelled30 = (last30 ?? []).filter((b) => b.status === 'cancelled').length;
    cancellationRate = total30 > 0 ? (cancelled30 / total30) * 100 : 0;

    // Tendência semana a semana (4 últimas)
    for (let i = 3; i >= 0; i--) {
      const wkStart = new Date(weekStart);
      wkStart.setDate(weekStart.getDate() - 7 * i);
      const wkEnd = new Date(wkStart);
      wkEnd.setDate(wkStart.getDate() + 7);
      const inWk = (last30 ?? []).filter((b) => {
        const d = new Date(b.created_at);
        return d >= wkStart && d < wkEnd;
      });
      const total = inWk.length;
      const cancelled = inWk.filter((b) => b.status === 'cancelled').length;
      trend4w.push({
        week_start: wkStart.toISOString().slice(0, 10),
        rate: total > 0 ? (cancelled / total) * 100 : 0,
      });
    }
  }

  // ── 3. PACIENTES NOVOS vs RETORNO (mês atual) ──
  let newPatientsThisMonth = 0;
  let returningPatientsThisMonth = 0;
  let totalPatients = 0;
  {
    const { data: monthBookings } = await admin
      .from('doctor_bookings')
      .select('patient_phone, created_at')
      .eq('tenant_id', tenantId)
      .gte('slot_start', monthStart.toISOString())
      .lt('slot_start', monthEnd.toISOString());

    if (monthBookings && monthBookings.length > 0) {
      const phones = Array.from(new Set(monthBookings.map((b) => b.patient_phone).filter(Boolean)));
      // Pacientes que tiveram primeira consulta antes deste mês = retorno
      const { data: firstVisits } = await admin
        .from('doctor_bookings')
        .select('patient_phone, slot_start')
        .eq('tenant_id', tenantId)
        .in('patient_phone', phones)
        .order('slot_start', { ascending: true });

      const firstVisitMap = new Map<string, Date>();
      for (const b of firstVisits ?? []) {
        if (!firstVisitMap.has(b.patient_phone)) {
          firstVisitMap.set(b.patient_phone, new Date(b.slot_start));
        }
      }

      for (const phone of phones) {
        const first = firstVisitMap.get(phone);
        if (first && first >= monthStart) newPatientsThisMonth++;
        else returningPatientsThisMonth++;
      }
    }

    const { count: total } = await admin
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    totalPatients = total ?? 0;
  }

  // ── 4. RECEITA RASTREADA (paid 30d + breakdown por método) ──
  let revenue30d = 0;
  let revenueByMethod: Record<string, number> = {};
  {
    const { data: payments } = await admin
      .from('tenant_payments')
      .select('consultation_value, payment_method, status, approved_at, created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'approved')
      .gte('created_at', days30Ago.toISOString());

    for (const p of payments ?? []) {
      const v = Number(p.consultation_value ?? 0);
      revenue30d += v;
      const method = p.payment_method ?? 'desconhecido';
      revenueByMethod[method] = (revenueByMethod[method] ?? 0) + v;
    }
  }

  // ── 5. NPS (média + qtd respondentes 30d) ──
  let npsAvg: number | null = null;
  let npsAnswered = 0;
  let npsSent = 0;
  let promoters = 0;
  let detractors = 0;
  {
    const { data: feedbacks } = await admin
      .from('patient_feedback')
      .select('nps_score, sent_at, responded_at')
      .eq('tenant_id', tenantId)
      .gte('sent_at', days30Ago.toISOString());

    npsSent = (feedbacks ?? []).length;
    const responded = (feedbacks ?? []).filter((f) => f.nps_score !== null);
    npsAnswered = responded.length;
    if (npsAnswered > 0) {
      const sum = responded.reduce((s, f) => s + (f.nps_score ?? 0), 0);
      npsAvg = sum / npsAnswered;
      promoters = responded.filter((f) => (f.nps_score ?? 0) >= 9).length;
      detractors = responded.filter((f) => (f.nps_score ?? 0) <= 6).length;
    }
  }

  // ── 6. GOOGLE REVIEWS (placeholder até integração ativa) ──
  // Quando vincularmos Google Place ID + API, substituir por contagem real.
  const { data: tenantInfo } = await admin
    .from('tenants')
    .select('google_place_id')
    .eq('tenant_id', tenantId)
    .maybeSingle<{ google_place_id: string | null }>();
  const reviewsConfigured = !!tenantInfo?.google_place_id;

  // ── 7. ORIGEM DO PACIENTE (breakdown por source 30d) ──
  let sourceBreakdown: Array<{ source: string; count: number }> = [];
  {
    const { data: srcs } = await admin
      .from('doctor_bookings')
      .select('source')
      .eq('tenant_id', tenantId)
      .gte('created_at', days30Ago.toISOString());

    const counts = new Map<string, number>();
    for (const b of srcs ?? []) {
      const s = b.source ?? 'desconhecido';
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    sourceBreakdown = Array.from(counts.entries()).map(([source, count]) => ({ source, count }));
  }

  return NextResponse.json({
    success: true,
    generated_at: now.toISOString(),
    scope: { is_doctor: isDoctor, doctors: (doctors ?? []).map((d) => ({ id: d.id, name: d.doctor_name })) },
    indicators: {
      utilization: {
        booked: bookedThisWeek,
        capacity: totalSlotsPerWeek,
        pct: Number(utilizationPct.toFixed(1)),
        target_pct: 80,
      },
      cancellation: {
        rate_pct: Number(cancellationRate.toFixed(1)),
        trend_4w: trend4w.map((p) => ({ ...p, rate: Number(p.rate.toFixed(1)) })),
        target_pct: 15,
      },
      patients: {
        total: totalPatients,
        new_this_month: newPatientsThisMonth,
        returning_this_month: returningPatientsThisMonth,
      },
      revenue: {
        last_30d_brl: Number(revenue30d.toFixed(2)),
        by_method: revenueByMethod,
        avg_consult_value_brl: Number(avgConsultValue.toFixed(2)),
      },
      nps: {
        sent_30d: npsSent,
        answered_30d: npsAnswered,
        avg_score: npsAvg !== null ? Number(npsAvg.toFixed(1)) : null,
        promoters,
        detractors,
        response_rate_pct: npsSent > 0 ? Number(((npsAnswered / npsSent) * 100).toFixed(1)) : 0,
      },
      google_reviews: {
        configured: reviewsConfigured,
        place_id: tenantInfo?.google_place_id ?? null,
        // Quando integração estiver ativa: count, avg_rating, latest_review etc.
      },
      patient_source: {
        breakdown: sourceBreakdown,
        total_30d: sourceBreakdown.reduce((s, x) => s + x.count, 0),
      },
    },
  });
}
