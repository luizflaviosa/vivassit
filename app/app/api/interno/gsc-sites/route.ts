/**
 * Diagnóstico: lista todas as propriedades GSC que a Service Account tem acesso.
 *
 * Auth: mesma dos outros internos.
 * Uso: descobrir o siteUrl exato (URL prefix vs domain property) pra usar
 * em /api/interno/gsc-snapshot.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function verifyAuth(req: NextRequest): boolean {
  const auth = (req.headers.get('authorization') ?? '').trim();
  const tokens = [
    process.env.N8N_TO_VERCEL_TOKEN?.trim(),
    process.env.CRON_SECRET?.trim(),
  ].filter(Boolean) as string[];
  if (req.headers.get('x-vercel-cron') === '1') return true;
  return tokens.some(t => auth === `Bearer ${t}`);
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não configurado');
  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), sa.private_key);
  const jwt = `${signingInput}.${base64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`OAuth: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const token = await getAccessToken();
    const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '{}');

    const res = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return NextResponse.json(
        {
          ok: false,
          error: `GSC API ${res.status}`,
          body: txt.slice(0, 500),
          hint:
            res.status === 403
              ? 'A SA não tem permissão em nenhuma propriedade. Adicione ela como usuário no GSC.'
              : undefined,
          sa_email: sa.client_email,
        },
        { status: 500 },
      );
    }

    const data = await res.json();
    return NextResponse.json({
      ok: true,
      sa_email: sa.client_email,
      sites_count: data.siteEntry?.length ?? 0,
      sites: data.siteEntry ?? [],
      hint:
        (data.siteEntry?.length ?? 0) === 0
          ? 'A SA está autenticada mas não tem nenhuma propriedade. Adicione no GSC: Configurações → Usuários e permissões → Adicionar usuário'
          : 'Use um dos siteUrl listados acima como GSC_SITE_URL no env.',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
