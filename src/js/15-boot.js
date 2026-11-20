/* ═════════════ boot ═════════════ */
let recovering = false, booting = false;
async function switchWs(id) {
  const w = S.wsList.find(x => x.id === id); if (!w) return;
  closeAllSheets(true); vaultLock(true); V.loaded = false; M.loaded = null; S.ws = w; S.vc = null; S.loaded = false; S.route = { v: S.prefs?.default_view || 'myturn' };
  for (const k of ['members', 'statuses', 'types', 'fields', 'rules', 'views', 'projects', 'tasks', 'invites', 'notifs', 'channels', 'messages', 'reactions', 'huddles']) S[k] = [];
  S.reads = {}; huddleCfg = null;
  restoreSnapshot(id); render();
  savePrefs({ last_workspace: id }); store.set('appName', w.app_name);
  await loadAll(); S.route = { v: startView() }; render(); setupRealtime(); checkDept();
}
async function boot() {
  if (clientTok || personTok) return clientPage(); // a client's status link or a person's own link: no sign-in
  if (booting) return; booting = true;
  try {
    if (!S.session) { S.ws = null; authScreen('in'); return; }
    if (recovering) return recoveryScreen();
    S.loaded = false; $('#app').innerHTML = bootLoader();
    try { await sb.rpc('accept_invites'); } catch {} // invited to another workspace with an account you already have
    await Promise.all([loadPrefs(), loadWorkspaces()]); applyTheme();
    if (!S.wsList.length) { await setupTeamScreen(); return; }
    const want = S.prefs.last_workspace && S.wsList.find(w => w.id === S.prefs.last_workspace);
    S.ws = want || S.wsList[0]; store.set('appName', S.ws.app_name);
    if (restoreSnapshot(S.ws.id)) render();
    await loadAll();
    const sv = startView(); if (!store.get('route', null)) S.route = { v: sv };
    if (!pageAllowed(S.route.v)) S.route = { v: 'myturn' };
    if (!S.profiles[uid()]?.tz) write({ t: 'profiles', op: 'update', id: uid(), patch: { tz: myTz() } }).then(() => { if (me()) me().tz = myTz(); });
    if (store.get('newcomer', false)) return welcomeScreen();
    if (store.get('teamJustMade', false)) { store.del('teamJustMade'); setTimeout(() => toast(`${S.ws.name} is ready`), 600); }
    else if (new URLSearchParams(location.search).has('start')) setTimeout(() => toast(`You’re already signed in as ${S.session.user?.email || first(me())}. To start a new team, sign out first.`, { label: 'Sign out', fn: () => signOut() }, 10000), 700); // "Start free" on the website while signed in
    history.replaceState(null, '', location.pathname + location.hash);
    render(); setupRealtime(); flushOutbox(); renderPill(); checkOwner(); checkVaultReset(); checkDept();
    if (isAr() && store.get('arTracked', '') !== new Date().toDateString()) { store.set('arTracked', new Date().toDateString()); track('arabic'); }
    if ('Notification' in window && Notification.permission === 'granted' && S.prefs.push !== false) enablePush(false);
    const m = location.hash.match(/^#task-(.+)$/); if (m && taskOf(m[1])) openTask(m[1]);
    const ch = location.hash.match(/^#chat-(.+)$/); if (ch && chOf(ch[1])) { history.replaceState(null, '', location.pathname); openChat(ch[1]); }
    tours.onRoute();
  } finally { booting = false; splashOut(); }
}
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', e => { const id = e.data?.task; if (id && taskOf(id)) openTask(id); const ch = e.data?.chat; if (ch && chOf(ch)) { closeAllSheets(true); openChat(ch); } });
}
addEventListener('hashchange', () => { const m = location.hash.match(/^#task-(.+)$/); if (m && taskOf(m[1])) openTask(m[1]); const c = location.hash.match(/^#chat-(.+)$/); if (c && chOf(c[1])) { history.replaceState(null, '', location.pathname); openChat(c[1]); } });
addEventListener('resize', debounce(() => { if (S.ws && S.session && !isTyping()) render(); }, 200));
applyTheme();
sb.auth.onAuthStateChange((event, s) => {
  const prev = S.session?.user?.id; S.session = s;
  setTimeout(() => {
    if (event === 'PASSWORD_RECOVERY') { recovering = true; recoveryScreen(); return; }
    if (event === 'SIGNED_OUT') { S.ws = null; S.tasks = []; ownerAdmin = null; ownerState.data = null; ownerState.open = null; authScreen('in'); return; }
    if (event === 'INITIAL_SESSION' || prev !== s?.user?.id) boot();
  }, 0);
});

