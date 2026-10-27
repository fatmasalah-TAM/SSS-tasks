// Ovrto service worker: installable app, push alerts, open the right task from an alert.
// It caches nothing, so every upload of index.html shows up right away.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    if (typeof d.badge === 'number' && self.navigator.setAppBadge) {
      try { d.badge ? await self.navigator.setAppBadge(d.badge) : await self.navigator.clearAppBadge(); } catch {}
    }
    await self.registration.showNotification(d.title || 'Ovrto', {
      body: d.body || '', tag: d.tag, icon: 'icon-192.png', badge: 'icon-192.png', data: { task: d.task },
    });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const task = e.notification.data && e.notification.data.task;
  const url = new URL('./' + (task ? '#task-' + task : ''), self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) { await w.focus(); if (task) w.postMessage({ task }); return; }
    }
    await self.clients.openWindow(url);
  })());
});
