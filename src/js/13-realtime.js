/* ═════════════ realtime ═════════════ */
let channel = null;
function setupRealtime() {
  if (channel) { sb.removeChannel(channel); channel = null; }
  if (!S.ws || S.prefs?.data_saver) return;
  const ws = S.ws.id; const timers = {};
  const reload = (t, fn) => { clearTimeout(timers[t]); timers[t] = setTimeout(async () => { await fn(); refresh(); snapshot(); }, 200); };
  channel = sb.channel('ws-' + ws);
  for (const t of WS_TABLES) channel.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `workspace_id=eq.${ws}` }, () => reload(t, () => loadTable(t)));
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${ws}` }, () => reload('m', loadMembers));
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => reload('m', loadMembers));
  channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'workspaces', filter: `id=eq.${ws}` }, p => { if (p.new) { Object.assign(S.ws, p.new); refresh(); } });
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid()}` }, p => {
    reload('n', async () => { const before = new Set(S.notifs.map(n => n.id)); await loadNotifs(); for (const n of S.notifs) if (!before.has(n.id) && !n.read_at) alertLocal(n); });
  });
  chatRealtime(channel, ws);
  channel.on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, p => { const r = p.new || p.old; if (detail && r && r.task_id === detail.id) loadThread(detail.id); });
  channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity' }, p => { if (detail && p.new?.task_id === detail.id) loadThread(detail.id); });
  // phones drop the live connection when they sleep or switch networks: reconnect and catch up straight away
  channel.subscribe(status => {
    if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status) && channel) { clearTimeout(rtRetry); rtRetry = setTimeout(() => { if (S.ws && S.session) { setupRealtime(); catchUp(); } }, 3000); }
  });
}
let rtRetry = null, catching = false;
async function refreshData() { if (!S.ws) return; await loadAll(); render(); refreshSheet(); }
/* catch up quietly (also the safety net when the live connection is down): new tasks, comments and alerts within seconds */
async function catchUp() {
  if (!S.ws || !S.session || booting || catching || document.visibilityState !== 'visible' || !navigator.onLine) return;
  catching = true;
  try {
    const before = new Set(S.notifs.map(n => n.id)); const seen = new Set(S.messages.map(m => m.id));
    const sig = () => JSON.stringify([S.tasks, S.notifs, S.members, S.statuses, S.types, S.fields, S.projects, S.views, S.channels, S.messages, S.reactions, S.huddles, S.invites]);
    const was = sig();
    await loadAll();
    if (sig() === was) return; // nothing new: leave the screen (and anything half-typed or half-confirmed) alone
    refresh(); snapshot(); if (S.route.v === 'chat' || chatUi.thread) refreshChat();
    for (const m of S.messages) if (!seen.has(m.id)) onChatArrive(m);
    for (const n of S.notifs) if (!before.has(n.id) && !n.read_at) alertLocal(n);
    if (detail) loadThread(detail.id);
  } catch (_) { /* try again next round */ } finally { catching = false; }
}
setInterval(() => quietly(catchUp), 15000); // the 15-second check for news never shows the loading mark
addEventListener('online', () => { if (S.ws) { flushOutbox(); setupRealtime(); catchUp(); } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { checkUpdate(); if (S.ws) { flushOutbox(); setupRealtime(); catchUp(); } } });

/* a new version was uploaded: phones (and apps saved to the home screen) pick it up by themselves */
const BUILD = '__BUILD__';
let updLast = 0, updShown = false;
async function checkUpdate(force) {
  if (!force && Date.now() - updLast < 60000) return; updLast = Date.now();
  try {
    const r = await fetch('./?v=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
    const m = (await r.text()).match(/name="ovrto-build" content="([0-9a-f]+)"/);
    if (!m || m[1] === BUILD) return;
    navigator.serviceWorker?.getRegistration?.().then(g => g && g.update()).catch(() => {});
    const busy_ = currentSheet() || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || (S.outbox || []).length > 0;
    if (!busy_) { location.reload(); return; }
    if (!updShown) { updShown = true; toast('A new version of Ovrto is ready', { label: 'Update', fn: () => location.reload() }, 20000); }
  } catch (_) { /* offline: try next time */ }
}
setTimeout(() => checkUpdate(true), 4000); setInterval(checkUpdate, 10 * 60000);

