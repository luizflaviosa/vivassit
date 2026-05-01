import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Google Calendar API via Service Account (sem dep externa, JWT signing nativo)
//
// Setup:
//   - env GOOGLE_SERVICE_ACCOUNT_JSON: JSON inteiro do service account
//   - SA é DONO dos calendars criados via createCalendar()
//   - Profissionais ganham acesso via shareCalendarWith(email)
//   - Calendars já existentes (criados por outros) precisam ser compartilhados
//     com o SA antes de poderem ser lidos via API
// ─────────────────────────────────────────────────────────────────────────────

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

interface CachedToken {
  access_token: string;
  expires_at: number;
  scope: string;
}

const SCOPE_FULL = 'https://www.googleapis.com/auth/calendar';

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

async function fetchAccessToken(sa: ServiceAccount, scope: string = SCOPE_FULL): Promise<string> {
  if (cached && cached.scope === scope && cached.expires_at - Date.now() > 5 * 60_000) {
    return cached.access_token;
  }
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: sa.client_email,
    scope,
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
    scope,
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
  color_id: string | null;
  color_hex: string | null;
}

// Google Calendar event color palette (matches Google's default colorId values).
// Mantém as cores que o profissional vê dentro do Google Calendar.
export const GCAL_EVENT_COLORS: Record<string, string> = {
  '1': '#7986cb', // Lavender
  '2': '#33b679', // Sage
  '3': '#8e24aa', // Grape
  '4': '#e67c73', // Flamingo
  '5': '#f6c026', // Banana
  '6': '#f5511d', // Tangerine
  '7': '#039be5', // Peacock
  '8': '#616161', // Graphite
  '9': '#3f51b5', // Blueberry
  '10': '#0b8043', // Basil
  '11': '#d60000', // Tomato
};

// ─────────────────────────────────────────────────────────────────────────────
// READ: lista eventos
// ─────────────────────────────────────────────────────────────────────────────
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

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });

  if (res.status === 403 || res.status === 404) {
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
    colorId?: string;
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
    color_id: ev.colorId ?? null,
    color_hex: ev.colorId ? (GCAL_EVENT_COLORS[ev.colorId] ?? null) : null,
  }));

  return { events };
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE: cria novo calendar de propriedade do SA
// ─────────────────────────────────────────────────────────────────────────────
export async function createCalendar(opts: {
  summary: string;
  description?: string;
  timeZone?: string;
}): Promise<{ calendar_id: string; summary: string } | { error: string; code: 'no_sa' | 'fetch_error' }> {
  const sa = getServiceAccount();
  if (!sa) return { error: 'GOOGLE_SERVICE_ACCOUNT_JSON não configurado', code: 'no_sa' };

  let token: string;
  try {
    token = await fetchAccessToken(sa);
  } catch (e) {
    console.error('[google-calendar] erro token:', e);
    return { error: 'Falha ao autenticar', code: 'fetch_error' };
  }

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: opts.summary,
      description: opts.description ?? `Agenda Singulare · ${opts.summary}`,
      timeZone: opts.timeZone ?? 'America/Sao_Paulo',
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.error('[google-calendar] createCalendar erro', res.status, txt.slice(0, 300));
    return { error: `Google API erro ${res.status}: ${txt.slice(0, 100)}`, code: 'fetch_error' };
  }

  const data = (await res.json()) as { id: string; summary: string };
  return { calendar_id: data.id, summary: data.summary };
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARE: compartilha o calendar com um email externo
// ─────────────────────────────────────────────────────────────────────────────
export async function shareCalendarWith(opts: {
  calendarId: string;
  email: string;
  role: 'reader' | 'writer' | 'owner';
}): Promise<{ ok: true } | { error: string; code: 'no_sa' | 'no_access' | 'fetch_error' }> {
  const sa = getServiceAccount();
  if (!sa) return { error: 'GOOGLE_SERVICE_ACCOUNT_JSON não configurado', code: 'no_sa' };

  let token: string;
  try {
    token = await fetchAccessToken(sa);
  } catch {
    return { error: 'Falha ao autenticar', code: 'fetch_error' };
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(opts.calendarId)}/acl`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: opts.role,
        scope: { type: 'user', value: opts.email },
      }),
    }
  );

  if (res.status === 403) {
    return {
      error: `Sem permissão pra adicionar ACL no calendar "${opts.calendarId}". O Service Account precisa ser dono ou ter role 'owner' nele.`,
      code: 'no_access',
    };
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.error('[google-calendar] shareCalendarWith erro', res.status, txt.slice(0, 200));
    return { error: `Google API erro ${res.status}`, code: 'fetch_error' };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// ENSURE ACCESS: verifica se o SA consegue ler o calendar
// ─────────────────────────────────────────────────────────────────────────────
export async function ensureSAAccess(calendarId: string): Promise<
  { ok: true; level: 'owner' | 'reader' | 'writer' | 'unknown' } | { error: string; code: 'no_sa' | 'no_access' | 'fetch_error' }
> {
  const sa = getServiceAccount();
  if (!sa) return { error: 'GOOGLE_SERVICE_ACCOUNT_JSON não configurado', code: 'no_sa' };

  let token: string;
  try {
    token = await fetchAccessToken(sa);
  } catch {
    return { error: 'Falha ao autenticar', code: 'fetch_error' };
  }

  // Tenta ler metadata do calendar — se acessar, tem permissão
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
  );

  if (res.status === 403 || res.status === 404) {
    return {
      error: `Sem acesso ao calendar "${calendarId}". Compartilhe com ${sa.client_email}`,
      code: 'no_access',
    };
  }
  if (!res.ok) {
    return { error: `Google API erro ${res.status}`, code: 'fetch_error' };
  }
  return { ok: true, level: 'unknown' };
}

export function getServiceAccountEmail(): string | null {
  const sa = getServiceAccount();
  return sa?.client_email ?? null;
}
