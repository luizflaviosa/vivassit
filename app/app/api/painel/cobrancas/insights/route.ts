import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

// Insights agregados de faturamento (mes corrente + breakdown).
// Usado pelo dashboard de cobrancas pra grafico e cards.

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;
  const supabase = supabaseAdmin();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const { data: payments } = await supabase
    .from('tenant_payments')
    .select('id, consultation_value, status, payment_method, created_at, approved_at, doctor_name')
    .eq('tenant_id', tenantId)
    .gte('created_at', sixMonthsAgo.toISOString())
    .order('created_at', { ascending: true });

  type Payment = {
    consultation_value: number | null;
    status: string | null;
    payment_method: string | null;
    created_at: string;
    approved_at: string | null;
    doctor_name: string | null;
  };
  const list = (payments ?? []) as Payment[];
  const isPaid = (p: Payment) => ['paid', 'received', 'approved', 'confirmed'].includes((p.status ?? '').toLowerCase());

  // Mes corrente
  const monthList = list.filter((p) => new Date(p.created_at) >= monthStart);
  const monthRevenue = monthList.filter(isPaid).reduce((a, p) => a + (Number(p.consultation_value) || 0), 0);
  const monthPending = monthList.filter((p) => !isPaid(p) && (p.status ?? '').toLowerCase() === 'pending');
  const monthPendingValue = monthPending.reduce((a, p) => a + (Number(p.consultation_value) || 0), 0);

  // Por método
  const methodMap: Record<string, { count: number; value: number }> = {};
  monthList.filter(isPaid).forEach((p) => {
    const m = (p.payment_method ?? 'desconhecido').toLowerCase();
    if (!methodMap[m]) methodMap[m] = { count: 0, value: 0 };
    methodMap[m].count++;
    methodMap[m].value += Number(p.consultation_value) || 0;
  });

  // Por médico (top 5 do mês)
  const doctorMap: Record<string, { count: number; value: number }> = {};
  monthList.filter(isPaid).forEach((p) => {
    const d = p.doctor_name ?? 'Sem profissional';
    if (!doctorMap[d]) doctorMap[d] = { count: 0, value: 0 };
    doctorMap[d].count++;
    doctorMap[d].value += Number(p.consultation_value) || 0;
  });
  const topDoctors = Object.entries(doctorMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Série mensal (últimos 6 meses)
  const monthBuckets: Record<string, { revenue: number; count: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthBuckets[key] = { revenue: 0, count: 0 };
  }
  list.filter(isPaid).forEach((p) => {
    const d = new Date(p.approved_at ?? p.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (key in monthBuckets) {
      monthBuckets[key].revenue += Number(p.consultation_value) || 0;
      monthBuckets[key].count++;
    }
  });
  const monthly = Object.entries(monthBuckets).map(([month, v]) => ({ month, ...v }));

  return NextResponse.json({
    success: true,
    insights: {
      revenue_month: monthRevenue,
      revenue_count: monthList.filter(isPaid).length,
      pending_value: monthPendingValue,
      pending_count: monthPending.length,
      methods: Object.entries(methodMap).map(([name, v]) => ({ name, ...v })),
      top_doctors: topDoctors,
      monthly,
    },
  });
}
