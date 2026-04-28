// Helper server-side pra mandar push notification a um user (em todos os devices).
// Usa web-push lib + VAPID keys configuradas via env.
//
// Como acionar:
//   import { sendPushToUser } from '@/lib/push-server';
//   await sendPushToUser(userId, { type: 'new_patient', title: '...', body: '...', url: '/painel/pacientes' });

import webpush from 'web-push';
import { supabaseAdmin } from './supabase';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contato@singulare.org';

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn('[push] VAPID keys ausentes — push notifications desativados');
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidConfigured = true;
  return true;
}

export type NotificationType =
  | 'new_patient'
  | 'appointment_booked'
  | 'appointment_cancel'
  | 'payment_confirmed'
  | 'payment_overdue'
  | 'nps_received'
  | 'daily_summary'
  | 'next_day_agenda'
  | 'ia_handoff'
  | 'system';

export interface PushPayload {
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  priority?: 'low' | 'normal' | 'high';
  data?: Record<string, unknown>;
}

// Envia push pra um usuário em todos os endpoints registrados.
// Respeita prefs por tipo (notification_prefs).
export async function sendPushToUser(
  userId: string,
  tenantId: string | null,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!ensureVapid()) return { sent: 0, failed: 0 };

  const admin = supabaseAdmin();

  // Checa preferência do user pro tipo (se tenantId fornecido)
  if (tenantId) {
    const { data: prefs } = await admin
      .from('notification_prefs')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (prefs && payload.type in prefs && (prefs as Record<string, unknown>)[payload.type] === false) {
      return { sent: 0, failed: 0 };
    }
  }

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_secret')
    .eq('user_id', userId);

  if (!subs?.length) return { sent: 0, failed: 0 };

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/painel',
    tag: payload.tag ?? payload.type,
    type: payload.type,
    priority: payload.priority ?? 'normal',
    data: payload.data ?? {},
  });

  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_secret } },
          message
        );
        sent++;
      } catch (e: unknown) {
        const err = e as { statusCode?: number };
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expirada — remove
          expiredIds.push(s.id);
        }
        failed++;
        console.error('[push] falha endpoint', s.endpoint.slice(-30), err);
      }
    })
  );

  if (expiredIds.length) {
    await admin.from('push_subscriptions').delete().in('id', expiredIds);
  }

  // Log
  await admin.from('notification_log').insert({
    user_id: userId,
    tenant_id: tenantId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    url: payload.url ?? null,
    payload: payload.data ?? null,
    delivery_status: sent > 0 ? 'sent' : 'failed',
  });

  return { sent, failed };
}

// Helper pra mandar pro tenant inteiro (todos members ativos)
export async function sendPushToTenant(
  tenantId: string,
  payload: PushPayload,
  excludeUserId?: string
): Promise<{ sent: number; failed: number; recipients: number }> {
  const admin = supabaseAdmin();
  const { data: members } = await admin
    .from('tenant_members')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .not('user_id', 'is', null);

  if (!members?.length) return { sent: 0, failed: 0, recipients: 0 };

  let sent = 0, failed = 0;
  const recipients = members.filter((m) => m.user_id && m.user_id !== excludeUserId);
  for (const m of recipients) {
    const r = await sendPushToUser(m.user_id!, tenantId, payload);
    sent += r.sent;
    failed += r.failed;
  }
  return { sent, failed, recipients: recipients.length };
}
