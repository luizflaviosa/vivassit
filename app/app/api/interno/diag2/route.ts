import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const tokenRaw = process.env.N8N_TO_VERCEL_TOKEN ?? '';
  const tokenTrimmed = tokenRaw.trim();
  const url = (process.env.N8N_INTERNAL_AGENT_URL ?? '').trim();

  async function ping(label: string, t: string) {
    if (!url || !t) return { label, error: 'missing url or token' };
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
        body: JSON.stringify({ test: true, message: 'diag2', tenant_id: 'demo-singulare', user_id: 'diag', role: 'owner', clinic_name: 'Diag' }),
      });
      const txt = await r.text();
      return { label, status: r.status, body: txt.slice(0, 80) };
    } catch (e) {
      return { label, error: (e as Error).message };
    }
  }

  const [trimmed, raw] = await Promise.all([
    ping('trimmed', tokenTrimmed),
    ping('raw', tokenRaw),
  ]);

  return NextResponse.json({
    deploy_marker: 'diag2-v1',
    raw_len: tokenRaw.length,
    trimmed_len: tokenTrimmed.length,
    has_whitespace: tokenRaw !== tokenTrimmed,
    trimmed_test: trimmed,
    raw_test: raw,
  });
}
