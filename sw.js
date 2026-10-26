// SSS Tasks service worker — makes the site installable as an app and opens tasks from alerts.
// It deliberately caches nothing, so every upload of index.html shows up right away.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const task = e.notification.data && e.notification.data.task;
  const url = new URL('./' + (task ? '#task-' + task : ''), self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) {
        await w.focus();
        if (task) w.postMessage({ task });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
