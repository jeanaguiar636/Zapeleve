self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((k) => Promise.all(k.map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', () => {});
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) {}
  const n = d.notification || {}, dados = d.data || {};
  event.waitUntil(self.registration.showNotification(n.title || dados.titulo || 'Zap Leve', {
    body: n.body || dados.corpo || 'Você tem uma chamada',
    icon: 'icon-192.png', badge: 'badge.png', tag: 'zapleve-chamada',
    renotify: true, requireInteraction: true, vibrate: [400, 200, 400], data: dados
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((l) => {
    for (const c of l) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
