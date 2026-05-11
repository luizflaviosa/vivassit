import { NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';

const DEBUG_ROLES: MemberRole[] = ['owner', 'admin'];

// Testa o POST /user_extraction_app do Rook sem efeitos colaterais.
// Retorna body cru + status pra debug do binding.
export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  if (!DEBUG_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const clientUuid = process.env.ROOK_CLIENT_UUID ?? '';
  const apiKey = process.env.ROOK_API_KEY ?? '';
  const apiBaseUrl = process.env.ROOK_API_URL ?? 'https://api.rook-connect.review/api/v1';
  const testUserId = 'singulare-pat-57';
  const payload = { client_uuid: clientUuid, user_id: testUserId };
  const basicAuth = `Basic ${Buffer.from(`${clientUuid}:${apiKey}`).toString('base64')}`;

  const tries: Array<{ auth: string; url: string; status: number; body: unknown; ms: number }> = [];

  // Tentativa 1: POST /user_extraction_app com Basic auth
  for (const attempt of [
    { auth: 'Basic', header: basicAuth, url: `${apiBaseUrl}/user_extraction_app` },
    { auth: 'Api-Key', header: `Api-Key ${apiKey}`, url: `${apiBaseUrl}/user_extraction_app` },
    { auth: 'Basic', header: basicAuth, url: `${apiBaseUrl}/users` },
  ]) {
    const start = Date.now();
    try {
      const r = await fetch(attempt.url, {
        method: 'POST',
        headers: {
          'Authorization': attempt.header,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });
      const txt = await r.text();
      let body: unknown = txt;
      try { body = JSON.parse(txt); } catch { /* keep as text */ }
      tries.push({
        auth: attempt.auth,
        url: attempt.url,
        status: r.status,
        body,
        ms: Date.now() - start,
      });
    } catch (e) {
      tries.push({
        auth: attempt.auth,
        url: attempt.url,
        status: 0,
        body: e instanceof Error ? e.message : String(e),
        ms: Date.now() - start,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    api_base_url: apiBaseUrl,
    test_user_id: testUserId,
    client_uuid_prefix: clientUuid.slice(0, 8),
    tries,
  });
}
