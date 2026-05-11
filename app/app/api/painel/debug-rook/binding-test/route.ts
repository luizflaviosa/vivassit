import { NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';

const DEBUG_ROLES: MemberRole[] = ['owner', 'admin'];

// Testa POST /api/v1/extraction_app/binding/ (endpoint oficial doc).
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
  const basicAuth = `Basic ${Buffer.from(`${clientUuid}:${apiKey}`).toString('base64')}`;

  type Try = { method: string; url: string; payload: string; status: number; preview: string; ms: number };
  const tries: Try[] = [];

  // Payloads candidatos pra POST /extraction_app/binding/
  const candidates: Array<{ method: 'GET' | 'POST'; path: string; body?: object }> = [
    // V1: payload conforme doc
    {
      method: 'POST',
      path: '/api/v1/extraction_app/binding/',
      body: {
        user_id: uid,
        metadata: {
          client_name: 'Singulare',
          support_url: 'https://singulare.org/privacidade/saude',
          complete_log_out: false,
        },
        salt: uid,
      },
    },
    // V2: sem trailing slash
    {
      method: 'POST',
      path: '/api/v1/extraction_app/binding',
      body: { user_id: uid, metadata: { client_name: 'Singulare' }, salt: uid },
    },
    // V3: minimalista
    {
      method: 'POST',
      path: '/api/v1/extraction_app/binding/',
      body: { user_id: uid },
    },
    // V4: com client_uuid no body
    {
      method: 'POST',
      path: '/api/v1/extraction_app/binding/',
      body: { client_uuid: clientUuid, user_id: uid },
    },
    // V5: GET pra ver se aceita query
    {
      method: 'GET',
      path: `/api/v1/extraction_app/binding/?user_id=${uid}`,
    },
    // V6: variação singular sem prefixo
    {
      method: 'POST',
      path: '/extraction_app/binding/',
      body: { user_id: uid, metadata: { client_name: 'Singulare' }, salt: uid },
    },
  ];

  for (const c of candidates) {
    const start = Date.now();
    const url = `${base}${c.path}`;
    const bodyStr = c.body ? JSON.stringify(c.body) : '';
    try {
      const r = await fetch(url, {
        method: c.method,
        headers: {
          'Authorization': basicAuth,
          'Content-Type': 'application/json',
        },
        body: c.method === 'POST' ? bodyStr : undefined,
        signal: AbortSignal.timeout(10000),
      });
      const txt = await r.text();
      tries.push({
        method: c.method,
        url: c.path,
        payload: bodyStr.slice(0, 200),
        status: r.status,
        preview: txt.slice(0, 400),
        ms: Date.now() - start,
      });
    } catch (e) {
      tries.push({
        method: c.method,
        url: c.path,
        payload: bodyStr.slice(0, 200),
        status: 0,
        preview: e instanceof Error ? e.message : String(e),
        ms: Date.now() - start,
      });
    }
  }

  const interesting = tries.filter((t) => t.status !== 404 && t.status !== 0);
  return NextResponse.json({ ok: true, base, interesting, all_tries: tries });
}
