import { NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';

const DEBUG_ROLES: MemberRole[] = ['owner', 'admin'];

// Probing massivo de rotas Rook pra achar o endpoint correto de binding.
// Sandbox em api.rook-connect.review responde 404 limpo em rotas inexistentes.
export async function GET() {
  const auth = await requireTenant();
  if (!auth.ok) return auth.response;
  if (!DEBUG_ROLES.includes(auth.ctx.member.role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const clientUuid = process.env.ROOK_CLIENT_UUID ?? '';
  const apiKey = process.env.ROOK_API_KEY ?? '';
  const base = process.env.ROOK_API_URL?.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '')
    ?? 'https://api.rook-connect.review';
  const uid = 'singulare-pat-57';
  const payload = JSON.stringify({ client_uuid: clientUuid, user_id: uid });
  const basicAuth = `Basic ${Buffer.from(`${clientUuid}:${apiKey}`).toString('base64')}`;

  type Try = { method: string; url: string; status: number; preview: string; ms: number };
  const tries: Try[] = [];

  const candidates: Array<{ method: 'GET' | 'POST'; path: string; body?: string }> = [
    // Pattern 1: /api/v1/user_extraction_app POST
    { method: 'POST', path: '/api/v1/user_extraction_app', body: payload },
    // Pattern 2: /v1/user_extraction_app (sem /api)
    { method: 'POST', path: '/v1/user_extraction_app', body: payload },
    // Pattern 3: /api/v2/user_extraction_app
    { method: 'POST', path: '/api/v2/user_extraction_app', body: payload },
    // Pattern 4: estilo recommended doc — /user_id/{uid}/...
    { method: 'GET', path: `/api/v1/user_id/${uid}/extraction_app_binding` },
    { method: 'GET', path: `/api/v1/user_id/${uid}/extraction_app/binding` },
    { method: 'GET', path: `/api/v1/user_id/${uid}/extraction_app` },
    { method: 'POST', path: `/api/v1/user_id/${uid}/extraction_app`, body: payload },
    // Pattern 5: estilo deprecated — client_uuid + user_id no path
    { method: 'GET', path: `/api/v1/client_uuid/${clientUuid}/user_id/${uid}/extraction_app_binding` },
    { method: 'POST', path: `/api/v1/client_uuid/${clientUuid}/user_id/${uid}/extraction_app`, body: '{}' },
    // Pattern 6: data sources authorizer (recommended new)
    { method: 'GET', path: `/api/v1/user_id/${uid}/data_source/Apple%20Health/authorizer` },
    // Pattern 7: root / + base
    { method: 'GET', path: '/' },
    { method: 'GET', path: '/api/v1' },
    { method: 'GET', path: '/api/v2' },
  ];

  for (const c of candidates) {
    const start = Date.now();
    const url = `${base}${c.path}`;
    try {
      const r = await fetch(url, {
        method: c.method,
        headers: {
          'Authorization': basicAuth,
          'Content-Type': 'application/json',
        },
        body: c.method === 'POST' ? (c.body ?? '{}') : undefined,
        signal: AbortSignal.timeout(8000),
      });
      const txt = await r.text();
      tries.push({
        method: c.method,
        url: c.path,
        status: r.status,
        preview: txt.slice(0, 250),
        ms: Date.now() - start,
      });
    } catch (e) {
      tries.push({
        method: c.method,
        url: c.path,
        status: 0,
        preview: e instanceof Error ? e.message : String(e),
        ms: Date.now() - start,
      });
    }
  }

  return NextResponse.json({ ok: true, base, user_id: uid, tries });
}
