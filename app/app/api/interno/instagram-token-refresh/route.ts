/**
 * Renova long-lived tokens Instagram (Facebook Login for Business) antes da expiração de 60 dias.
 * Chama fb_exchange_token pra cada tenant com instagram_token_enc setado.
 *
 * Auth: Bearer N8N_TO_VERCEL_TOKEN (cron Vercel também funciona se CRON_SECRET == N8N_TO_VERCEL_TOKEN).
 * Trigger: cron Vercel mensal — `0 5 1 * *`.
 *
 * Idempotente: pode rodar várias vezes; sempre estende a janela.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { refreshLongLivedToken } from '@/lib/instagram-publisher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
}

function authOk(req: NextRequest): boolean {
  const expected = process.env.N8N_TO_VERCEL_TOKEN?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!expected && !cronSecret) return false;

  const auth = (req.headers.get('authorization') ?? '').trim();
  if (expected && auth === `Bearer ${expected}`) return true;
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  return false;
}

async function handler(req: NextRequest) {
  if (!authOk(req)) return unauthorized();

  const metaAppId = process.env.META_APP_ID?.trim();
  const metaAppSecret = process.env.META_APP_SECRET?.trim();
  if (!metaAppId || !metaAppSecret) {
    return NextResponse.json({ ok: false, error: 'META_APP_ID / META_APP_SECRET ausentes' }, { status: 500 });
  }

  const supabase = supabaseAdmin();
  const { data: tenants, error } = await supabase
    .from('marketing_subscriptions')
    .select('tenant_id, instagram_token_expires_at')
    .not('instagram_token_enc', 'is', null);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const results: Array<{ tenant_id: string; extended: boolean; expires_at: string | null; reason?: string }> = [];

  for (const t of tenants ?? []) {
    try {
      const r = await refreshLongLivedToken(supabase, t.tenant_id, metaAppId, metaAppSecret);
      results.push({ tenant_id: t.tenant_id, extended: r.extended, expires_at: r.expiresAt, reason: r.reason });
    } catch (e) {
      results.push({
        tenant_id: t.tenant_id,
        extended: false,
        expires_at: t.instagram_token_expires_at,
        reason: e instanceof Error ? e.message : 'unknown',
      });
    }
  }

  const extended = results.filter((r) => r.extended).length;
  const failed = results.length - extended;

  console.log(`[ig-token-refresh] processed=${results.length} extended=${extended} failed=${failed}`);

  return NextResponse.json({ ok: failed === 0, processed: results.length, extended, failed, results });
}

export const GET = handler;
export const POST = handler;
