import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Google Calendar API via Service Account (sem dep externa, JWT signing nativo)
//
// Setup esperado:
//   - env GOOGLE_SERVICE_ACCOUNT_JSON: o JSON inteiro do service account (string)
//     (gere no Google Cloud Console → IAM → Service Accounts → Keys → Add JSON)
//   - cada profissional compartilha o calendar dele com o email do service account
//     (1 click em Calendar settings → Share with specific people)
//
// Vantagem: o painel não precisa do OAuth do usuário pra ler agenda.
// O mesmo SA pode ler agenda de qualquer profissional cadastrado, com base no
// calendar_id armazenado em tenant_doctors.
// ─────────────────────────────────────────────────────────────────────────────

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

interface CachedToken {
  access_token: string;
  expires_at: number;
}

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

async function fetchAccessToken(sa: ServiceAccount): Promise<string> {
  // Reusa token se ainda tem >5min de vida
  if (cached && cached.expires_at - Date.now() > 5 * 60_000) {
    return cached.access_token;
  }

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
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
    throw new Error(`Google OAuth falhou: ${res.status} ${txt.slice(0, 200)}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start: string | null;
  end: string | null;
  all_day: boolean;
  attendees: string[];
  status: string;
  link: string | null;
  meet_link: string | null;
}

export async function listEvents(opts: {
  calendarId: string;
  timeMin: string;
  timeMax: string;
  maxResults?: number;
}): Promise<{ events: CalendarEvent[] } | { error: string; code: 'no_sa' | 'no_access' | 'fetch_error' }> {
  const sa = getServiceAccount();
  if (!sa) return { error: 'GOOGLE_SERVICE_ACCOUNT_JSON não configurado', code: 'no_sa' };

  let token: string;
  try {
    token = await fetchAccessToken(sa);
  } catch (e) {
    console.error('[google-calendar] erro token:', e);
    return { error: 'Falha ao autenticar service account', code: 'fetch_error' };
  }

  const params = new URLSearchParams({
    timeMin: opts.timeMin,
    timeMax: opts.timeMax,
    maxResults: String(opts.maxResults ?? 250),
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(opts.calendarId)}/events?${params}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (res.status === 403 || res.status === 404) {
    // 404 = calendar não existe / não tem acesso. 403 = acesso negado.
    return {
      error: `Acesso negado à agenda. Compartilhe o calendar "${opts.calendarId}" com ${sa.client_email}`,
      code: 'no_access',
    };
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.error('[google-calendar] api erro', res.status, txt.slice(0, 200));
    return { error: `Google API erro ${res.status}`, code: 'fetch_error' };
  }

  type GEvent = {
    id: string;
    summary?: string;
    description?: string;
    location?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    attendees?: Array<{ email?: string; displayName?: string }>;
    status?: string;
    htmlLink?: string;
    hangoutLink?: string;
  };
  const data = (await res.json()) as { items?: GEvent[] };
  const events: CalendarEvent[] = (data.items ?? []).map((ev) => ({
    id: ev.id,
    title: ev.summary ?? '(sem título)',
    description: ev.description ?? null,
    location: ev.location ?? null,
    start: ev.start?.dateTime ?? ev.start?.date ?? null,
    end: ev.end?.dateTime ?? ev.end?.date ?? null,
    all_day: !ev.start?.dateTime,
    attendees: (ev.attendees ?? []).map((a) => a.displayName ?? a.email ?? '').filter(Boolean),
    status: ev.status ?? 'confirmed',
    link: ev.htmlLink ?? null,
    meet_link: ev.hangoutLink ?? null,
  }));

  return { events };
}

export function getServiceAccountEmail(): string | null {
  const sa = getServiceAccount();
  return sa?.client_email ?? null;
}
