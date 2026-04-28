// Helpers client-side pra Web Push: registrar SW, pedir permissão, salvar subscription.

const SW_PATH = '/sw-push.js';

export type PushStatus = 'unsupported' | 'denied' | 'default' | 'granted-no-sub' | 'granted-subbed';

export async function detectPushStatus(): Promise<PushStatus> {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  const perm = Notification.permission;
  if (perm === 'denied') return 'denied';
  if (perm === 'default') return 'default';
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (!reg) return 'granted-no-sub';
  const sub = await reg.pushManager.getSubscription();
  return sub ? 'granted-subbed' : 'granted-no-sub';
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function subscribePush(vapidPublicKey: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;

  const reg = await navigator.serviceWorker.register(SW_PATH);
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const body = sub.toJSON();
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: body.endpoint,
      keys: body.keys,
      user_agent: navigator.userAgent,
    }),
  });
  return res.ok;
}

export async function unsubscribePush(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (!reg) return true;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return true;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  });
  return true;
}
