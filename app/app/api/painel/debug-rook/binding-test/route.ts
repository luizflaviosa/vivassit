import { NextResponse } from 'next/server';
import { requireTenant, type MemberRole } from '@/lib/auth-tenant';

const DEBUG_ROLES: MemberRole[] = ['owner', 'admin'];

// Probing v3: pattern user_id/{uid}/data_source/{name}/authorizer existe (422).
// Testa nomes alternativos do Apple Health + endpoints de criacao de user.
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

  type Try = { method: string; url: string; status: number; preview: string; ms: number };
  const tries: Try[] = [];

  const candidates: Array<{ method: 'GET' | 'POST' | 'PUT'; path: string; body?: string }> = [
    // === Criação de user (várias formas) ===
    { method: 'POST', path: `/api/v1/user_id/${uid}/time_zone`, body: JSON.stringify({ time_zone: 'America/Sao_Paulo', offset: '-03:00' }) },
    { method: 'PUT', path: `/api/v1/user_id/${uid}/time_zone`, body: JSON.stringify({ time_zone: 'America/Sao_Paulo', offset: '-03:00' }) },
    { method: 'POST', path: `/api/v1/user_id/${uid}/user_information`, body: JSON.stringify({ user_id: uid, time_zone: 'America/Sao_Paulo' }) },
    { method: 'POST', path: '/api/v1/users', body: JSON.stringify({ user_id: uid, time_zone: 'America/Sao_Paulo' }) },

    // === Nomes alternativos pro Apple Health ===
    { method: 'GET', path: `/api/v1/user_id/${uid}/data_source/AppleHealth/authorizer` },
    { method: 'GET', path: `/api/v1/user_id/${uid}/data_source/apple_health/authorizer` },
    { method: 'GET', path: `/api/v1/user_id/${uid}/data_source/Apple/authorizer` },
    { method: 'GET', path: `/api/v1/user_id/${uid}/data_source/ios/authorizer` },
    { method: 'GET', path: `/api/v1/user_id/${uid}/data_source/iOS/authorizer` },
    { method: 'GET', path: `/api/v1/user_id/${uid}/data_source/HealthKit/authorizer` },
    { method: 'GET', path: `/api/v1/user_id/${uid}/data_source/health_kit/authorizer` },
    { method: 'GET', path: `/api/v1/user_id/${uid}/data_source/Garmin/authorizer` },
    { method: 'GET', path: `/api/v1/user_id/${uid}/data_source/Fitbit/authorizer` },

    // === Listar data_sources permitidos ===
    { method: 'GET', path: `/api/v1/data_sources` },
    { method: 'GET', path: `/api/v1/user_id/${uid}/data_sources` },
    { method: 'GET', path: `/api/v1/user_id/${uid}/data_sources/authorized` },
    { method: 'GET', path: `/api/v1/user_id/${uid}/data_sources/enabled` },

    // === Variantes do extraction app sob user_id/ ===
    { method: 'GET', path: `/api/v1/user_id/${uid}/extraction_app` },
    { method: 'POST', path: `/api/v1/user_id/${uid}/extraction_app`, body: '{}' },
    { method: 'GET', path: `/api/v1/user_id/${uid}/extraction-app/link` },
    { method: 'GET', path: `/api/v1/user_id/${uid}/extraction-app` },
    { method: 'GET', path: `/api/v1/user_id/${uid}/binding` },
    { method: 'GET', path: `/api/v1/user_id/${uid}/app` },
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
        body: c.method !== 'GET' ? (c.body ?? '{}') : undefined,
        signal: AbortSignal.timeout(8000),
      });
      const txt = await r.text();
      tries.push({
        method: c.method,
        url: c.path,
        status: r.status,
        preview: txt.slice(0, 300),
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

  // Filtra so resultados interessantes (nao-404) no topo
  const interesting = tries.filter((t) => t.status !== 404);
  return NextResponse.json({
    ok: true,
    base,
    user_id: uid,
    interesting,
    all_tries: tries,
  });
}
