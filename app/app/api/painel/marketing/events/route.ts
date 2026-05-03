// app/app/api/painel/marketing/events/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth-tenant';
import { getMarketingMetrics } from '@/lib/marketing-queries';

// GET: marketing metrics for the tenant
export async function GET(req: NextRequest) {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10);
  const metrics = await getMarketingMetrics(
    auth.ctx.tenant.tenant_id,
    Math.min(days, 365)
  );

  return NextResponse.json({ success: true, metrics });
}
