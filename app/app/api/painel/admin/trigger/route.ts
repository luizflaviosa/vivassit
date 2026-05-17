/**
 * Proxy admin pra disparar endpoints /api/interno/* sem expor o Bearer token.
 *
 * Frontend chama POST /api/painel/admin/trigger { path, query?, body? }.
 * Server valida que user é admin via lib/admin-auth, injeta Authorization
 * Bearer ${N8N_TO_VERCEL_TOKEN} e encaminha pra o endpoint interno.
 *
 * Aceita só paths que começam com /api/interno/ pra evitar SSRF.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let payload: { path?: string; query?: Record<string, string>; body?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const { path, query, body } = payload;
  if (!path || typeof path !== 'string' || !path.startsWith('/api/interno/')) {
    return NextResponse.json(
      { ok: false, error: 'path deve comecar com /api/interno/' },
      { status: 400 },
    );
  }

  const token = process.env.N8N_TO_VERCEL_TOKEN ?? process.env.CRON_SECRET;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'N8N_TO_VERCEL_TOKEN nao configurado' },
      { status: 500 },
    );
  }

  const origin = req.nextUrl.origin;
  const url = new URL(path, origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }

  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: `fetch: ${msg}` }, { status: 502 });
  }

  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // resposta não-JSON, devolve raw
  }

  return NextResponse.json({
    ok: res.ok,
    status: res.status,
    latency_ms: Date.now() - t0,
    response: parsed,
  });
}
