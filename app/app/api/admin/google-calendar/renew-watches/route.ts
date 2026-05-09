/**
 * Renova channels do Google Calendar que estão prestes a expirar.
 * Google expira channels em 7d → cron diário renova quem tem <2d de margem.
 *
 * Auth: Bearer N8N_TO_VERCEL_TOKEN
 * Trigger: cron n8n diário (Schedule Trigger 1x/dia, 03:00 UTC)
 */
import { NextRequest, NextResponse } from 'next/server';
import { renewExpiringChannels } from '@/lib/google-calendar-sync';

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

  const result = await renewExpiringChannels({
    withinDays: 2,
    webhookUrl: getWebhookUrl(req),
  });

  return NextResponse.json({
    ok: result.failed === 0,
    ...result,
  });
}
