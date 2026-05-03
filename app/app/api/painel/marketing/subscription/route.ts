// app/app/api/painel/marketing/subscription/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { supabaseAdmin } from '@/lib/supabase';
import type { MarketingPlanKey } from '@/lib/marketing-types';

const VALID_PLANS: MarketingPlanKey[] = ['presenca', 'social', 'ads'];

// GET: current subscription for this tenant
export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const { data } = await supabaseAdmin()
    .from('marketing_subscriptions')
    .select('*')
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .maybeSingle();

  return NextResponse.json({ success: true, subscription: data });
}

// POST: create new subscription
export async function POST(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const plan = body.plan as MarketingPlanKey;
  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json(
      { success: false, message: 'Plano inválido' },
      { status: 400 }
    );
  }

  const tenantId = auth.ctx.tenant.tenant_id;

  // Upsert: one subscription per tenant
  const { data, error } = await supabaseAdmin()
    .from('marketing_subscriptions')
    .upsert(
      {
        tenant_id: tenantId,
        plan,
        status: 'trial',
        google_review_url: body.google_review_url ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id' }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, subscription: data });
}

// PATCH: update google_review_url or plan
export async function PATCH(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.plan && VALID_PLANS.includes(body.plan)) updates.plan = body.plan;
  if (body.google_review_url !== undefined) updates.google_review_url = body.google_review_url;
  if (body.status) updates.status = body.status;

  const { data, error } = await supabaseAdmin()
    .from('marketing_subscriptions')
    .update(updates)
    .eq('tenant_id', auth.ctx.tenant.tenant_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, subscription: data });
}
