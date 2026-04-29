import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

export async function GET(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const status = req.nextUrl.searchParams.get('status'); // pending, approved, etc
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '100', 10);

  const supabase = supabaseAdmin();
  let query = supabase
    .from('tenant_payments')
    .select(
      'id, external_reference, asaas_payment_id, patient_name, patient_email, patient_phone, doctor_name, consultation_date, consultation_value, asaas_fee_value, asaas_net_value, estimated_fee_value, status, payment_method, payment_url, created_at, approved_at'
    )
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 500));

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  // Resumo (modelo B: separa bruto, taxa Asaas e líquido pro médico)
  const summary = (data ?? []).reduce(
    (acc, p) => {
      const v = Number(p.consultation_value || 0);
      if (p.status === 'approved' || p.status === 'paid') {
        acc.received += v;
        acc.received_net += Number(p.asaas_net_value ?? v);
        acc.received_fee += Number(p.asaas_fee_value ?? 0);
        acc.received_count += 1;
      } else if (p.status === 'pending') {
        acc.pending += v;
        acc.pending_count += 1;
      }
      return acc;
    },
    {
      received: 0,
      received_net: 0,
      received_fee: 0,
      pending: 0,
      received_count: 0,
      pending_count: 0,
    }
  );

  return NextResponse.json({ success: true, payments: data ?? [], summary });
}
