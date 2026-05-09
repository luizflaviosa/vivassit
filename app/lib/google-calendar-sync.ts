/**
 * Sync Google Calendar → tenant_calendar_events via push notifications.
 *
 * Fluxo:
 *   1. createWatchChannel(): chama events.watch + initial full sync, persiste channel
 *   2. Google manda POST pro /api/webhooks/google-calendar quando algo muda
 *   3. Webhook chama syncByChannelId() → events.list?syncToken= → upsert/delete
 *   4. renewExpiringChannels() roda diariamente (cron n8n) — Google expira channel em 7d
 *
 * fn_get_available_slots() lê tenant_calendar_events, então o bot do agendamento
 * passa a respeitar bloqueios manuais que o profissional cria direto no Google Calendar.
 */
import crypto from 'crypto';
import { getAccessToken } from '@/lib/google-calendar';
import { supabaseAdmin } from '@/lib/supabase';

const SYNC_LOOKAHEAD_DAYS = 90;
const WATCH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // Google max é 7 dias
const SP_TZ_OFFSET = '-03:00'; // Brasil sem DST desde 2019; America/Sao_Paulo permanente UTC-3

export interface WatchChannel {
  channel_id: string;
  resource_id: string;
  calendar_id: string;
  doctor_id: string;
  tenant_id: string;
  webhook_token: string;
  sync_token: string | null;
  expiration: string;
  last_synced_at?: string | null;
}

interface GEvent {
  id: string;
  status?: string; // 'confirmed' | 'tentative' | 'cancelled'
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
}

interface ListEventsResult {
  events: GEvent[];
  nextSyncToken: string | null;
  syncTokenExpired?: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// events.list paginado (com syncToken OU timeMin/timeMax). 410 = syncToken expirado.
// ─────────────────────────────────────────────────────────────────────
async function listEventsRaw(opts: {
  calendarId: string;
  syncToken?: string;
  timeMin?: string;
  timeMax?: string;
}): Promise<ListEventsResult | { error: string }> {
  const token = await getAccessToken();
  if (!token) return { error: 'no_service_account' };

  const events: GEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  while (true) {
    const params = new URLSearchParams({ singleEvents: 'true', maxResults: '250' });
    if (opts.syncToken) {
      params.set('syncToken', opts.syncToken);
    } else {
      if (opts.timeMin) params.set('timeMin', opts.timeMin);
      if (opts.timeMax) params.set('timeMax', opts.timeMax);
    }
    if (pageToken) params.set('pageToken', pageToken);

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(opts.calendarId)}/events?${params}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });

    if (res.status === 410) {
      // syncToken inválido — caller deve fazer full re-sync
      return { events: [], nextSyncToken: null, syncTokenExpired: true };
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { error: `Google API ${res.status}: ${txt.slice(0, 200)}` };
    }

    const data = (await res.json()) as {
      items?: GEvent[];
      nextPageToken?: string;
      nextSyncToken?: string;
    };
    if (data.items) events.push(...data.items);
    if (data.nextPageToken) {
      pageToken = data.nextPageToken;
      continue;
    }
    nextSyncToken = data.nextSyncToken ?? null;
    break;
  }

  return { events, nextSyncToken };
}

// ─────────────────────────────────────────────────────────────────────
// Persiste eventos: cancelled → DELETE, ativos → UPSERT
// ─────────────────────────────────────────────────────────────────────
async function persistEvents(opts: {
  events: GEvent[];
  doctorId: string;
  tenantId: string;
  calendarId: string;
}): Promise<{ upserted: number; deleted: number }> {
  const supabase = supabaseAdmin();
  let upserted = 0;
  let deleted = 0;

  const cancelled = opts.events.filter((e) => e.status === 'cancelled');
  const active = opts.events.filter((e) => e.status !== 'cancelled');

  if (cancelled.length > 0) {
    const ids = cancelled.map((e) => e.id);
    const { error } = await supabase.from('tenant_calendar_events').delete().in('event_id', ids);
    if (!error) deleted = ids.length;
  }

  const rows = active
    .filter((e) => (e.start?.dateTime ?? e.start?.date) && (e.end?.dateTime ?? e.end?.date))
    .map((e) => {
      // All-day usa só `date` (end é exclusivo). Converte pra ISO TZ Sao_Paulo
      // pra bater com o range que fn_get_available_slots gera com America/Sao_Paulo.
      const startIso = e.start!.dateTime ?? `${e.start!.date}T00:00:00${SP_TZ_OFFSET}`;
      const endIso = e.end!.dateTime ?? `${e.end!.date}T00:00:00${SP_TZ_OFFSET}`;
      return {
        event_id: e.id,
        tenant_id: opts.tenantId,
        doctor_id: opts.doctorId,
        calendar_id: opts.calendarId,
        event_start: startIso,
        event_end: endIso,
        summary: e.summary ?? null,
        description: e.description ?? null,
        // Constraint tenant_calendar_events_source_check exige
        // 'calendar_sync' | 'app_created'. Valor 'google_calendar' (anterior)
        // violava o CHECK e fazia o upsert falhar silenciosamente.
        source: 'calendar_sync',
        synced_at: new Date().toISOString(),
      };
    });

  if (rows.length > 0) {
    const { error } = await supabase
      .from('tenant_calendar_events')
      .upsert(rows, { onConflict: 'event_id' });
    if (error) {
      console.error('[google-calendar-sync] persistEvents upsert falhou:', error.message);
    } else {
      upserted = rows.length;
    }
  }

  return { upserted, deleted };
}

// ─────────────────────────────────────────────────────────────────────
// Cria novo watch channel + initial full sync. Idempotente: se já existe
// channel pra (doctor_id, calendar_id), o caller deve chamar stopChannel antes.
// ─────────────────────────────────────────────────────────────────────
export async function createWatchChannel(opts: {
  calendarId: string;
  doctorId: string;
  tenantId: string;
  webhookUrl: string;
}): Promise<{ ok: true; channel: WatchChannel } | { error: string }> {
  const token = await getAccessToken();
  if (!token) return { error: 'GOOGLE_SERVICE_ACCOUNT_JSON não configurado' };

  const channelId = crypto.randomUUID();
  const webhookToken = crypto.randomBytes(24).toString('hex');
  const expirationMs = Date.now() + WATCH_TTL_MS;

  const watchRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(opts.calendarId)}/events/watch`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address: opts.webhookUrl,
        token: webhookToken,
        expiration: String(expirationMs),
      }),
    }
  );

  if (!watchRes.ok) {
    const txt = await watchRes.text().catch(() => '');
    return { error: `events.watch falhou: ${watchRes.status} ${txt.slice(0, 200)}` };
  }

  const watchData = (await watchRes.json()) as {
    id: string;
    resourceId: string;
    expiration: string;
  };

  // Initial full sync — captura nextSyncToken pros próximos increments
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + SYNC_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const syncRes = await listEventsRaw({ calendarId: opts.calendarId, timeMin, timeMax });

  let syncToken: string | null = null;
  let initialUpserted = 0;
  if (!('error' in syncRes)) {
    syncToken = syncRes.nextSyncToken;
    const persisted = await persistEvents({
      events: syncRes.events,
      doctorId: opts.doctorId,
      tenantId: opts.tenantId,
      calendarId: opts.calendarId,
    });
    initialUpserted = persisted.upserted;
  } else {
    // Não bloqueia — channel já está criado no Google. Webhook seguinte tentará de novo.
    console.error('[google-calendar-sync] initial sync falhou:', syncRes.error);
  }

  const expiration = new Date(Number(watchData.expiration)).toISOString();

  const supabase = supabaseAdmin();
  const { error: insErr } = await supabase
    .from('google_calendar_watch_channels')
    .upsert(
      {
        channel_id: watchData.id,
        resource_id: watchData.resourceId,
        calendar_id: opts.calendarId,
        doctor_id: opts.doctorId,
        tenant_id: opts.tenantId,
        webhook_token: webhookToken,
        sync_token: syncToken,
        expiration,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'doctor_id,calendar_id' }
    );

  if (insErr) {
    return { error: `Falhou salvar channel: ${insErr.message}` };
  }

  console.log(
    `[google-calendar-sync] channel criado doctor=${opts.doctorId} cal=${opts.calendarId} initial_upsert=${initialUpserted}`
  );

  return {
    ok: true,
    channel: {
      channel_id: watchData.id,
      resource_id: watchData.resourceId,
      calendar_id: opts.calendarId,
      doctor_id: opts.doctorId,
      tenant_id: opts.tenantId,
      webhook_token: webhookToken,
      sync_token: syncToken,
      expiration,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// Para um channel no Google. Idempotente — 404 conta como sucesso.
// ─────────────────────────────────────────────────────────────────────
export async function stopChannel(opts: {
  channelId: string;
  resourceId: string;
}): Promise<{ ok: true } | { error: string }> {
  const token = await getAccessToken();
  if (!token) return { error: 'no_service_account' };

  const res = await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: opts.channelId, resourceId: opts.resourceId }),
  });

  if (res.ok || res.status === 404 || res.status === 410) return { ok: true };
  const txt = await res.text().catch(() => '');
  return { error: `channels.stop falhou: ${res.status} ${txt.slice(0, 200)}` };
}

// ─────────────────────────────────────────────────────────────────────
// Sync incremental (chamado pelo webhook). Se syncToken inválido → full sync.
// ─────────────────────────────────────────────────────────────────────
export async function syncChannel(channel: WatchChannel): Promise<
  { ok: true; upserted: number; deleted: number; full: boolean } | { error: string }
> {
  const supabase = supabaseAdmin();
  let result: ListEventsResult | { error: string };
  let full = false;

  if (channel.sync_token) {
    result = await listEventsRaw({ calendarId: channel.calendar_id, syncToken: channel.sync_token });
  } else {
    full = true;
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + SYNC_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000).toISOString();
    result = await listEventsRaw({ calendarId: channel.calendar_id, timeMin, timeMax });
  }

  if (!('error' in result) && result.syncTokenExpired) {
    full = true;
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + SYNC_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000).toISOString();
    result = await listEventsRaw({ calendarId: channel.calendar_id, timeMin, timeMax });
  }

  if ('error' in result) return { error: result.error };

  const persisted = await persistEvents({
    events: result.events,
    doctorId: channel.doctor_id,
    tenantId: channel.tenant_id,
    calendarId: channel.calendar_id,
  });

  if (result.nextSyncToken) {
    await supabase
      .from('google_calendar_watch_channels')
      .update({ sync_token: result.nextSyncToken, last_synced_at: new Date().toISOString() })
      .eq('channel_id', channel.channel_id);
  }

  return { ok: true, upserted: persisted.upserted, deleted: persisted.deleted, full };
}

// ─────────────────────────────────────────────────────────────────────
// Lookup channel pelo ID (chamado pelo webhook após validar X-Goog-Channel-Token)
// ─────────────────────────────────────────────────────────────────────
export async function getChannelById(channelId: string): Promise<WatchChannel | null> {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from('google_calendar_watch_channels')
    .select(
      'channel_id, resource_id, calendar_id, doctor_id, tenant_id, webhook_token, sync_token, expiration, last_synced_at'
    )
    .eq('channel_id', channelId)
    .maybeSingle<WatchChannel>();
  return data ?? null;
}

// ─────────────────────────────────────────────────────────────────────
// Renova channels que expiram dentro de `withinDays`
// ─────────────────────────────────────────────────────────────────────
export async function renewExpiringChannels(opts: {
  withinDays: number;
  webhookUrl: string;
}): Promise<{ renewed: number; failed: number; errors: string[] }> {
  const supabase = supabaseAdmin();
  const cutoff = new Date(Date.now() + opts.withinDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: channels } = await supabase
    .from('google_calendar_watch_channels')
    .select(
      'channel_id, resource_id, calendar_id, doctor_id, tenant_id, webhook_token, sync_token, expiration, last_synced_at'
    )
    .lt('expiration', cutoff)
    .returns<WatchChannel[]>();

  let renewed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const ch of channels ?? []) {
    await stopChannel({ channelId: ch.channel_id, resourceId: ch.resource_id });
    const created = await createWatchChannel({
      calendarId: ch.calendar_id,
      doctorId: ch.doctor_id,
      tenantId: ch.tenant_id,
      webhookUrl: opts.webhookUrl,
    });

    if ('error' in created) {
      failed++;
      errors.push(`doctor=${ch.doctor_id}: ${created.error}`);
    } else {
      renewed++;
    }
  }

  return { renewed, failed, errors };
}
