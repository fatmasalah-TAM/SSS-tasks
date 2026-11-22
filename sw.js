// Ovrto service worker: installable app, push alerts, open the right task or chat from an alert.
// The app itself is kept for offline use (technicians on site): always the network first, so every upload of
// index.html shows up right away, and the saved copy only when there is no internet. Data never goes through here.
const SHELL = 'ovrto-shell-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('ovrto-shell-') && k !== SHELL) await caches.delete(k);
  await self.clients.claim();
})()));
const keepable = url => (url.origin === self.location.origin && !url.search.includes('c=') ) || url.href.startsWith('https://cdn.jsdelivr.net/npm/@supabase/') || url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com';
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (!keepable(url)) return;
  e.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const key = req.mode === 'navigate' ? new URL('./', self.registration.scope).href : req;
    try {
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') cache.put(key, res.clone()).catch(() => {}); // the database script comes from a CDN as an opaque response
      return res;
    } catch (err) {
      const hit = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      throw err;
    }
  })());
});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: e.data && e.data.text() }; }
  e.waitUntil((async () => {
    if (typeof d.badge === 'number' && self.navigator.setAppBadge) {
      try { d.badge ? await self.navigator.setAppBadge(d.badge) : await self.navigator.clearAppBadge(); } catch {}
    }
    await self.registration.showNotification(d.title || 'Ovrto', {
      body: d.body || '', tag: d.tag, icon: 'icon-192.png', badge: 'icon-192.png', data: { task: d.task, chat: d.chat, url: d.url },
    });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const task = e.notification.data && e.notification.data.task, chat = e.notification.data && e.notification.data.chat;
  const own = e.notification.data && e.notification.data.url; // a client's alert opens their own link
  const url = own ? new URL(own, self.registration.scope).href : new URL('./' + (task ? '#task-' + task : chat ? '#chat-' + chat : ''), self.registration.scope).href;
  e.waitUntil((async () => {
    if (own && url.startsWith(self.registration.scope)) {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const w = wins.find(x => x.url === url); if (w) return w.focus();
      return self.clients.openWindow(url);
    }
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) { await w.focus(); if (task) w.postMessage({ task }); else if (chat) w.postMessage({ chat }); return; }
    }
    await self.clients.openWindow(url);
  })());
});
