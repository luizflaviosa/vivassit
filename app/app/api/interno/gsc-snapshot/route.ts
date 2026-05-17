/**
 * Snapshot semanal do Google Search Console.
 *
 * Coleta clicks/impressions/ctr/position + top 50 queries + top 50 pages
 * dos últimos 7 dias (com defasagem de 3 dias pra dados estarem consolidados)
 * e salva em seo_snapshots. Lido pelo dashboard /painel/seo.
 *
 * Auth: Bearer N8N_TO_VERCEL_TOKEN (manual) ou CRON_SECRET (Vercel Cron).
 *
 * Schedule: 0 11 * * 1 (toda segunda 11:00 UTC = 8h BRT).
 *
 * Requisitos:
 *   - env GOOGLE_SERVICE_ACCOUNT_JSON (já configurado, reaproveitado do Calendar)
 *   - SA com permissão Restricted na propriedade do GSC singulare.org
 *   - API Search Console ativada no projeto do Google Cloud
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { collectSnapshot } from '@/lib/gsc';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Propriedade no GSC. Confirmada via /api/interno/gsc-sites como
// sc-domain:singulare.org (Domain property — cobre apex + subdomínios).
// Override via env GSC_SITE_URL se a propriedade mudar.
const SITE_URL = process.env.GSC_SITE_URL ?? 'sc-domain:singulare.org';

function verifyAuth(req: NextRequest): boolean {
  const auth = (req.headers.get('authorization') ?? '').trim();
  const tokens = [
    process.env.N8N_TO_VERCEL_TOKEN?.trim(),
    process.env.CRON_SECRET?.trim(),
  ].filter(Boolean) as string[];
  // Vercel Cron injeta x-vercel-cron sem precisar de auth — aceitar tb
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';
  if (isVercelCron) return true;
  return tokens.some(t => auth === `Bearer ${t}`);
}

async function handler(req: NextRequest) {
  if (!verifyAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const t0 = Date.now();

  // Query param ?days=N pra teste manual com janela maior (default 7).
  const url = new URL(req.url);
  const daysParam = url.searchParams.get('days');
  const days = daysParam ? Math.max(1, Math.min(490, parseInt(daysParam, 10))) : 7;

  try {
    const snapshot = await collectSnapshot(SITE_URL, days);
    const latencyMs = Date.now() - t0;

    const supabase = supabaseAdmin();
    const { data: inserted, error } = await supabase
      .from('seo_snapshots')
      .insert({
        range_start: snapshot.range.start,
        range_end: snapshot.range.end,
        summary: snapshot.summary,
        top_queries: snapshot.topQueries,
        top_pages: snapshot.topPages,
        raw_meta: {
          site_url: SITE_URL,
          latency_ms: latencyMs,
          queries_count: snapshot.topQueries.length,
          pages_count: snapshot.topPages.length,
        },
      })
      .select('id, snapshot_at, range_start, range_end')
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: `supabase insert: ${error.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      snapshot_id: inserted?.id,
      range: snapshot.range,
      summary: snapshot.summary,
      counts: {
        queries: snapshot.topQueries.length,
        pages: snapshot.topPages.length,
      },
      latency_ms: latencyMs,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Mesmo em erro, grava snapshot vazio com raw_meta.error pra ver no painel.
    try {
      const supabase = supabaseAdmin();
      const today = new Date().toISOString().slice(0, 10);
      await supabase.from('seo_snapshots').insert({
        range_start: today,
        range_end: today,
        summary: {},
        top_queries: [],
        top_pages: [],
        raw_meta: { site_url: SITE_URL, error: msg, latency_ms: Date.now() - t0 },
      });
    } catch {
      // engole — já tem error original pra retornar
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
