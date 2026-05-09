/**
 * Bootstrap: cria push-notification channels pra TODOS doctors active com calendar_id
 * que ainda não têm channel ativo. Roda 1x manualmente após deploy + sempre que
 * onboardar nova clínica.
 *
 * Auth: Bearer N8N_TO_VERCEL_TOKEN
 *
 * Body opcional: { force_recreate?: boolean }
 *   - force_recreate=true: para channel existente e cria novo (debug/recovery)
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createWatchChannel, stopChannel, type WatchChannel } from '@/lib/google-calendar-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getWebhookUrl(req: NextRequest): string {
  const explicit = process.env.GOOGLE_CALENDAR_WEBHOOK_URL?.trim();
  if (explicit) return explicit;
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  return `${proto}://${host}/api/webhooks/google-calendar`;
}

export async function POST(req: NextRequest) {
  const expected = process.env.N8N_TO_VERCEL_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'server_misconfigured' }, { status: 500 });
  }
  const auth = (req.headers.get('authorization') ?? '').trim();
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: { force_recreate?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* body opcional */
  }

  const supabase = supabaseAdmin();
  const webhookUrl = getWebhookUrl(req);

  // Doctors elegíveis: active + calendar_id setado + tenant ativo
  const { data: doctors, error: dErr } = await supabase
    .from('tenant_doctors')
    .select('id, tenant_id, doctor_name, calendar_id')
    .eq('status', 'active')
    .not('calendar_id', 'is', null);

  if (dErr) {
    return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 });
  }

  // Filtra por tenants ativos
  const tenantIds = Array.from(new Set((doctors ?? []).map((d) => d.tenant_id)));
  const { data: tenants } = await supabase
    .from('tenants')
    .select('tenant_id, status')
    .in('tenant_id', tenantIds)
    .eq('status', 'active');
  const activeTenants = new Set((tenants ?? []).map((t) => t.tenant_id));
  const eligible = (doctors ?? []).filter((d) => activeTenants.has(d.tenant_id));

  // Existing channels
  const { data: existing } = await supabase
    .from('google_calendar_watch_channels')
    .select(
      'channel_id, resource_id, calendar_id, doctor_id, tenant_id, webhook_token, sync_token, expiration'
    )
    .returns<WatchChannel[]>();
  const existingByDoctorCal = new Map<string, WatchChannel>();
  for (const ch of existing ?? []) {
    existingByDoctorCal.set(`${ch.doctor_id}::${ch.calendar_id}`, ch);
  }

  const results: Array<{
    doctor_id: string;
    doctor_name: string;
    tenant_id: string;
    status: 'created' | 'skipped' | 'recreated' | 'failed';
    error?: string;
  }> = [];

  for (const d of eligible) {
    const key = `${d.id}::${d.calendar_id}`;
    const existingCh = existingByDoctorCal.get(key);

    if (existingCh && !body.force_recreate) {
      results.push({
        doctor_id: d.id,
        doctor_name: d.doctor_name,
        tenant_id: d.tenant_id,
        status: 'skipped',
      });
      continue;
    }

    if (existingCh && body.force_recreate) {
      await stopChannel({ channelId: existingCh.channel_id, resourceId: existingCh.resource_id });
    }

    const created = await createWatchChannel({
      calendarId: d.calendar_id!,
      doctorId: d.id,
      tenantId: d.tenant_id,
      webhookUrl,
    });

    if ('error' in created) {
      results.push({
        doctor_id: d.id,
        doctor_name: d.doctor_name,
        tenant_id: d.tenant_id,
        status: 'failed',
        error: created.error,
      });
    } else {
      results.push({
        doctor_id: d.id,
        doctor_name: d.doctor_name,
        tenant_id: d.tenant_id,
        status: existingCh ? 'recreated' : 'created',
      });
    }
  }

  const counts = {
    created: results.filter((r) => r.status === 'created').length,
    recreated: results.filter((r) => r.status === 'recreated').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'failed').length,
  };

  return NextResponse.json({
    ok: counts.failed === 0,
    webhook_url: webhookUrl,
    eligible: eligible.length,
    counts,
    results,
  });
}
