import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Google Search Console (Search Analytics API) via Service Account.
//
// Setup:
//   - env GOOGLE_SERVICE_ACCOUNT_JSON: mesma do google-calendar.ts
//   - A SA precisa estar adicionada como usuário Restricted (ou superior) na
//     propriedade do GSC (singulare.org). Sem isso a API devolve 403.
//   - API ativada no Google Cloud Console:
//     https://console.cloud.google.com/apis/library/searchconsole.googleapis.com
// ─────────────────────────────────────────────────────────────────────────────

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

interface CachedToken {
  access_token: string;
  expires_at: number;
}

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

let cached: CachedToken | null = null;

function getServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const json = JSON.parse(raw);
    if (!json.client_email || !json.private_key) return null;
    return { client_email: json.client_email, private_key: json.private_key };
  } catch {
    return null;
  }
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (cached && cached.expires_at - Date.now() > 5 * 60_000) {
    return cached.access_token;
  }
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: sa.client_email,
    scope: SCOPE,
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

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Google OAuth (GSC scope) falhou: ${res.status} ${txt.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Analytics API
//
// Doc: https://developers.google.com/webmaster-tools/v1/searchanalytics/query
// ─────────────────────────────────────────────────────────────────────────────

export interface GscRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscQueryParams {
  siteUrl: string; // 'sc-domain:singulare.org' OU 'https://singulare.org/'
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dimensions?: ('query' | 'page' | 'country' | 'device' | 'searchAppearance' | 'date')[];
  rowLimit?: number; // max 25000
  dataState?: 'all' | 'final';
}

export async function queryGsc(params: GscQueryParams): Promise<GscRow[]> {
  const sa = getServiceAccount();
  if (!sa) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não configurado');
  }
  const token = await getAccessToken(sa);
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    params.siteUrl,
  )}/searchAnalytics/query`;

  const body: Record<string, unknown> = {
    startDate: params.startDate,
    endDate: params.endDate,
    rowLimit: params.rowLimit ?? 1000,
    dataState: params.dataState ?? 'final',
  };
  if (params.dimensions && params.dimensions.length > 0) {
    body.dimensions = params.dimensions;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`GSC API ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = (await res.json()) as { rows?: GscRow[] };
  return data.rows ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de alto nível
// ─────────────────────────────────────────────────────────────────────────────

export interface GscSnapshot {
  range: { start: string; end: string };
  summary: { clicks: number; impressions: number; ctr: number; position: number };
  topQueries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  topPages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

function dateOffset(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Coleta um snapshot completo dos últimos N dias.
 * Padrão N=7 (rolling week).
 *
 * dataState='all' inclui dados frescos (últimas 48h) que ainda não estão
 * consolidados — útil pra ter sinal mais cedo em sites novos.
 */
export async function collectSnapshot(
  siteUrl: string,
  days = 7,
  dataState: 'all' | 'final' = 'all',
): Promise<GscSnapshot> {
  // GSC tem latência de ~2-3 dias mesmo com dataState=all (apenas reduzida).
  const endDate = dateOffset(2);
  const startDate = dateOffset(2 + days);

  const [summaryRows, queryRows, pageRows] = await Promise.all([
    queryGsc({ siteUrl, startDate, endDate, dimensions: [], rowLimit: 1, dataState }),
    queryGsc({ siteUrl, startDate, endDate, dimensions: ['query'], rowLimit: 50, dataState }),
    queryGsc({ siteUrl, startDate, endDate, dimensions: ['page'], rowLimit: 50, dataState }),
  ]);

  const summary = summaryRows[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0, keys: [] };

  return {
    range: { start: startDate, end: endDate },
    summary: {
      clicks: summary.clicks,
      impressions: summary.impressions,
      ctr: summary.ctr,
      position: summary.position,
    },
    topQueries: queryRows.map(r => ({
      query: r.keys[0] ?? '',
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    })),
    topPages: pageRows.map(r => ({
      page: r.keys[0] ?? '',
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    })),
  };
}
