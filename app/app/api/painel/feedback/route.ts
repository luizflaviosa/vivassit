import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('patient_feedback')
    .select(
      'id, patient_name, patient_phone, doctor_name, appointment_date, nps_score, feedback_text, sent_at, responded_at, status'
    )
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .order('sent_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  // Agregados
  const responded = (data ?? []).filter((f) => f.nps_score !== null);
  const avgNps =
    responded.length > 0
      ? responded.reduce((sum, f) => sum + Number(f.nps_score || 0), 0) / responded.length
      : null;

  const promoters = responded.filter((f) => Number(f.nps_score) >= 9).length;
  const detractors = responded.filter((f) => Number(f.nps_score) <= 6).length;
  const npsScore =
    responded.length > 0
      ? Math.round(((promoters - detractors) / responded.length) * 100)
      : null;

  return NextResponse.json({
    success: true,
    feedbacks: data ?? [],
    summary: {
      total_sent: data?.length ?? 0,
      total_responded: responded.length,
      avg_score: avgNps,
      nps: npsScore,
      promoters,
      detractors,
      passives: responded.length - promoters - detractors,
    },
  });
}
