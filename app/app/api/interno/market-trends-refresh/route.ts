/**
 * Refresh interno de market-trends (Bearer N8N_TO_VERCEL_TOKEN ou CRON_SECRET).
 * Cron mensal + invocação manual via curl.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { refreshMarketTrendsForTenant } from '@/lib/market-trends-fetcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function verifyAuth(req: NextRequest): boolean {
  const auth = (req.headers.get('authorization') ?? '').trim();
  const tokens = [
    process.env.N8N_TO_VERCEL_TOKEN?.trim(),
    process.env.CRON_SECRET?.trim(),
  ].filter(Boolean) as string[];
  return tokens.some(t => auth === `Bearer ${t}`);
}

async function listEligibleTenants(): Promise<string[]> {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from('tenants')
    .select('tenant_id, city, tenant_doctors!inner(specialty)')
    .not('city', 'is', null)
    .not('tenant_doctors.specialty', 'is', null);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of data ?? []) {
    const id = (row as { tenant_id: string }).tenant_id;
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

async function runRefresh(tenantId?: string) {
  const supabase = supabaseAdmin();
  const tenantIds = tenantId ? [tenantId] : await listEligibleTenants();
  const results: Array<{ tenant_id: string; status: string; reason?: string }> = [];
  const queue = [...tenantIds];
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(2, queue.length); i++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const id = queue.shift();
        if (!id) break;
        const r = await refreshMarketTrendsForTenant(supabase, id);
        results.push({ tenant_id: id, ...r });
      }
    })());
  }
  await Promise.all(workers);
  return {
    summary: {
      ok: results.filter(r => r.status === 'ok').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      error: results.filter(r => r.status === 'error').length,
      total: results.length,
    },
    results,
  };
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const tenantId = (body?.tenant_id as string | undefined)?.trim() || undefined;
  try {
    const out = await runRefresh(tenantId);
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  try {
    const out = await runRefresh(undefined);
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
