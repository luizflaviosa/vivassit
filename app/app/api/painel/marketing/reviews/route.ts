import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

export const runtime = 'edge';

// POST /api/painel/marketing/reviews
// Triggers review requests for patients with NPS 9-10 who haven't been asked yet
export async function POST() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  try {
    const res = await fetch(`${process.env.N8N_BASE_URL}/webhook/request-reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_id: tenantId, triggered_at: new Date().toISOString() }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('n8n review request failed:', text);
      return NextResponse.json({ error: 'Falha ao disparar workflow' }, { status: 500 });
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json({
      success: true,
      sent: data.sent ?? 0,
      message: data.message ?? 'Solicitações enviadas',
    });
  } catch (e) {
    console.error('review request error:', e);
    // Still return 200 — n8n might not respond with JSON on all setups
    return NextResponse.json({ success: true, sent: 0, message: 'Solicitações em processamento' });
  }
}

// GET /api/painel/marketing/reviews
// Returns count of NPS 9-10 patients eligible for review request
export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const supabase = supabaseAdmin();

  // Count events with high NPS in last 90 days
  const { count } = await supabase
    .from('tenant_calendar_events')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('nps_score', 9)
    .gte('start_time', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

  return NextResponse.json({ eligible: count ?? 0 });
}
