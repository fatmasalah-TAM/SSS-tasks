/* ═════════════ push alerts ═════════════ */
let pushAsked = false;
function askPushSoon() {
  if (pushAsked || !('Notification' in window) || Notification.permission !== 'default' || S.prefs?.push === false) return;
  pushAsked = true;
  setTimeout(() => toast('Get an alert when it’s your turn?', { label: 'Turn on', fn: () => enablePush(true) }, 9000), 1200);
}
async function enablePush(ask) {
  try {
    if (!('Notification' in window) || !navigator.serviceWorker) return toast('This browser can’t show alerts. On iPhone, add the app to your home screen first.');
    let perm = Notification.permission;
    if (perm === 'default' && ask) perm = await Notification.requestPermission();
    if (perm !== 'granted') { if (ask) toast('Alerts stay off. You can allow them in your browser settings.'); return; }
    const reg = await navigator.serviceWorker.ready;
    if (!('PushManager' in window) || !CFG.vapid || CFG.vapid.startsWith('{{')) { render(); return; }
    const key = Uint8Array.from(atob(CFG.vapid.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - CFG.vapid.length % 4) % 4)), c => c.charCodeAt(0));
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
    const j = sub.toJSON();
    // the phone belongs to whoever is signed in now (works even if someone else used it before)
    const cl = await sb.rpc('claim_push', { ep: j.endpoint, key: j.keys.p256dh, au: j.keys.auth });
    if (cl.error) await sb.from('push_subscriptions').upsert({ endpoint: j.endpoint, user_id: uid(), p256dh: j.keys.p256dh, auth: j.keys.auth });
    if (S.prefs.push === false) savePrefs({ push: true });
    if (ask) toast('Alerts are on for this device');
    render();
  } catch (e) { if (ask) toast('Couldn’t turn on alerts: ' + errText(e)); }
}
async function disablePush() {
  try { const reg = await navigator.serviceWorker?.ready; const sub = await reg?.pushManager?.getSubscription(); if (sub) { await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint); await sub.unsubscribe(); } } catch {}
}
function alertLocal(n) {
  // in-app toast for new "your turn"/mention while the app is open
  if (!(n.reason === 'turn' || n.reason === 'mention')) return;
  if (isChatN(n)) {
    const c = chOf(n.channel_id); if (!c || (S.route.v === 'chat' && S.route.id === c.id && document.visibilityState === 'visible') || chatUi.thread) return;
    return toast(`${first(prof(n.actor_id)) || 'Someone'}${c.kind === 'channel' ? ' in #' + c.name : ''}: ${n.detail || ''}`, { label: 'Open', fn: () => openChat(c.id) }, 7000);
  }
  const t = taskOf(n.task_id); if (!t) return;
  toast(`${REASON[n.reason]}: ${taskKey(t)} ${t.title}`, { label: 'Open', fn: () => openTask(t.id) }, 7000);
}

