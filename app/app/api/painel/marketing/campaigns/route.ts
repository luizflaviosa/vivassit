import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireTenant } from '@/lib/auth-tenant';

export const runtime = 'edge';

export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const supabase = supabaseAdmin();
  const { data: campaigns } = await supabase
    .from('tenant_campaigns')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  return NextResponse.json({ campaigns: campaigns || [] });
}

export async function POST(req: Request) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  const tenantId = auth.ctx.tenant.tenant_id;

  const supabase = supabaseAdmin();
  const body = await req.json();

  const budget = parseFloat(body.monthly_budget);
  let feeRate = 0.5;
  if (budget >= 1000) feeRate = 0.25;
  else if (budget >= 500) feeRate = 0.30;
  else if (budget >= 300) feeRate = 0.40;

  const managementFee = Math.round(budget * feeRate);

  const { data: campaign, error } = await supabase
    .from('tenant_campaigns')
    .insert({
      tenant_id: tenantId,
      platform: body.platform || 'google_ads',
      campaign_name: body.campaign_name || `${body.platform} - ${new Date().toLocaleDateString('pt-BR')}`,
      campaign_type: body.campaign_type || 'search',
      monthly_budget: budget,
      daily_budget: Math.round((budget / 30) * 100) / 100,
      management_fee: managementFee,
      total_charged: budget + managementFee,
      target_specialty: body.specialty,
      target_location: body.location,
      target_radius_km: body.radius || 30,
      target_keywords: body.keywords || [],
      status: 'pending_payment',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await fetch(`${process.env.N8N_BASE_URL}/webhook/create-campaign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id: campaign.id, tenant_id: tenantId, ...campaign }),
    });
  } catch (e) {
    console.error('Failed to trigger n8n campaign creation:', e);
  }

  return NextResponse.json({ campaign });
}
