// Cliente HTTP que dispara payload simulado no webhook do P01.

import { config } from '../config.js';
import { buildWebhookPayload } from './fixtures.js';
import type { ScenarioContext, Turn } from '../types.js';

export async function sendWebhook(ctx: ScenarioContext, turn: Turn): Promise<void> {
  const payload = buildWebhookPayload(ctx, turn);
  const res = await fetch(config.n8n.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok && res.status !== 200) {
    const body = await res.text().catch(() => '');
    throw new Error(`Webhook P01 retornou ${res.status}: ${body.slice(0, 200)}`);
  }
}
