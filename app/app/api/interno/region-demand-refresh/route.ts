/**
 * Refresh do cache de demanda regional (DataForSEO).
 *
 * Auth: Bearer N8N_TO_VERCEL_TOKEN (server-to-server, mesmo padrão de /api/interno/tools).
 *
 * POST /api/interno/region-demand-refresh
 *   Body: { tenant_id?: string }
 *     - se tenant_id presente, refresca só esse tenant
 *     - se ausente, refresca TODOS os tenants com city + specialty (chamada
 *       paralela com concorrência limitada)
 *
 * GET /api/interno/region-demand-refresh
 *   Forma alternativa pra Vercel Cron (sem body). Comporta como POST sem
 *   tenant_id — refresca todos.
 *
 * Custo por chamada: ~12 keywords × US$ 0.05/1000 = US$ 0.0006/profissional.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { refreshRegionDemandForTenant, type RefreshResult } from '@/lib/region-demand-fetcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function verifyAuth(req: NextRequest): boolean {
  const auth = (req.headers.get('authorization') ?? '').trim();
  // Aceita N8N_TO_VERCEL_TOKEN (chamadas manuais/n8n) ou CRON_SECRET (Vercel Cron)
  const tokens = [
    process.env.N8N_TO_VERCEL_TOKEN?.trim(),
    process.env.CRON_SECRET?.trim(),
  ].filter(Boolean) as string[];
  return tokens.some(t => auth === `Bearer ${t}`);
}

async function listEligibleTenants(): Promise<string[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('tenants')
    .select('tenant_id, city, tenant_doctors!inner(specialty)')
    .not('city', 'is', null)
    .not('tenant_doctors.specialty', 'is', null);
  if (error) throw new Error(`list tenants: ${error.message}`);
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

async function runRefresh(tenantId?: string): Promise<{ summary: { ok: number; skipped: number; error: number; total: number }; results: RefreshResult[] }> {
  const supabase = supabaseAdmin();
  const tenantIds = tenantId ? [tenantId] : await listEligibleTenants();

  // Concorrência limitada: 3 paralelas (DataForSEO aceita, mas evita rate limit)
  const results: RefreshResult[] = [];
  const queue = [...tenantIds];
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(3, queue.length); i++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const id = queue.shift();
        if (!id) break;
        const r = await refreshRegionDemandForTenant(supabase, id);
        results.push(r);
      }
    })());
  }
  await Promise.all(workers);

  const summary = {
    ok: results.filter(r => r.status === 'ok').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    error: results.filter(r => r.status === 'error').length,
    total: results.length,
  };
  return { summary, results };
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const tenantId = (body?.tenant_id as string | undefined)?.trim() || undefined;
  try {
    const { summary, results } = await runRefresh(tenantId);
    return NextResponse.json({ ok: true, summary, results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  try {
    const { summary, results } = await runRefresh(undefined);
    return NextResponse.json({ ok: true, summary, results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
