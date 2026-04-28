// Service Worker pra Web Push notifications.
// Registrado pelo client em /lib/push-client.ts.

const APP_URL = self.registration?.scope || '/';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Singulare', body: event.data.text() };
  }

  const title = payload.title || 'Singulare';
  const options = {
    body: payload.body || '',
    icon: '/logos/icon.svg',
    badge: '/logos/icon.svg',
    tag: payload.tag || payload.type || 'default',
    data: { url: payload.url || '/painel', type: payload.type, ...payload.data },
    requireInteraction: payload.priority === 'high',
    silent: payload.priority === 'low',
    vibrate: payload.priority === 'high' ? [200, 100, 200] : [100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/painel';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Foca em aba existente se houver
      for (const client of clientList) {
        if (client.url.includes(new URL(url, APP_URL).pathname) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
