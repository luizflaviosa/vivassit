/**
 * Webhook do Google Calendar push notifications.
 *
 * Google manda POST sempre que algo muda no calendar:
 *   X-Goog-Channel-ID:      nosso uuid (lookup na tabela google_calendar_watch_channels)
 *   X-Goog-Channel-Token:   nosso segredo (validamos antes de tudo)
 *   X-Goog-Resource-State:  'sync' (init, ignorar) | 'exists' | 'not_exists'
 *   X-Goog-Resource-ID:     id do resource no Google
 *
 * Resposta DEVE ser 200 mesmo em "no-op" — Google reenfileira em 5xx.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getChannelById, syncChannel } from '@/lib/google-calendar-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const channelId = req.headers.get('x-goog-channel-id');
  const channelToken = req.headers.get('x-goog-channel-token');
  const resourceState = req.headers.get('x-goog-resource-state');

  if (!channelId) {
    return NextResponse.json({ ok: false, error: 'missing_channel_id' }, { status: 400 });
  }

  // 'sync' é o ping inicial logo após events.watch — não tem mudança real.
  if (resourceState === 'sync') {
    return NextResponse.json({ ok: true, ignored: 'sync_ping' });
  }

  const channel = await getChannelById(channelId);
  if (!channel) {
    // Channel não conhecido — provavelmente foi deletado mas Google ainda manda. 200 pra parar reenvio.
    console.warn(`[gcal-webhook] channel desconhecido: ${channelId}`);
    return NextResponse.json({ ok: true, ignored: 'unknown_channel' });
  }

  // Valida token (defesa contra forjas — Google ecoa o token que setamos no watch)
  if (channel.webhook_token !== channelToken) {
    console.warn(`[gcal-webhook] token inválido channel=${channelId}`);
    return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 401 });
  }

  const result = await syncChannel(channel);
  if ('error' in result) {
    console.error(`[gcal-webhook] sync falhou channel=${channelId}:`, result.error);
    // 500 pro Google reenfileirar (até X tentativas) caso seja erro transitório
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    channel_id: channelId,
    upserted: result.upserted,
    deleted: result.deleted,
    full_sync: result.full,
  });
}
