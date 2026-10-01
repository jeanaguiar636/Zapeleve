// Service worker do Zap Leve: recebe push de chamada (app fechado)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch (e) {}
  const d = p.data || p;
  if (d.tipo !== 'chamada') return;
  const teste = d.teste === '1';
  const titulo = teste ? 'Teste do Zap Leve' : (d.nome || 'Alguém') + ' está te ligando';
  const corpo = teste ? 'Se você viu este aviso, as notificações estão funcionando ✅' : (d.video === '1' ? '📹 Chamada de vídeo' : '📞 Chamada de áudio');
  event.waitUntil((async () => {
    const lista = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (!teste && lista.some((c) => c.visibilityState === 'visible')) return; // app aberto: o toque já toca dentro dele
    await self.registration.showNotification(titulo, {
      body: corpo, tag: 'chamada', renotify: true, requireInteraction: true,
      icon: 'icon-192.png', badge: 'icon-192.png',
      vibrate: [500, 250, 500, 250, 500, 250, 500],
    });
    await new Promise((r) => setTimeout(r, 30000));
    (await self.registration.getNotifications({ tag: 'chamada' })).forEach((n) => n.close());
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const lista = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (lista.length) return lista[0].focus();
    return self.clients.openWindow('./');
  })());
});
