/* ═════════════ shell ═════════════ */
function badgeCount() {
  const now = Date.now();
  return S.notifs.filter(n => !n.read_at && !isChatN(n) && (n.reason === 'turn' || n.reason === 'mention') && (!n.snoozed_until || new Date(n.snoozed_until) < now)).length;
}
function myTurnCount() { return S.tasks.filter(t => turnIsMine(t) && catOf(t) !== 'backlog').length; }
/** who may approve or send back: the task's reviewer (or the workspace's default reviewer) and admins */
function reviewerOf(t) { return t.reviewer_id || S.ws?.default_reviewer || null; }
function canReview(t) { return isAdmin() || reviewerOf(t) === uid(); }
/* once a task is with its reviewer, only the reviewer (or an admin) can change it; everyone else can still comment */
function reviewLocked(t) { return !!t && catOf(t) === 'review' && !canReview(t); }
function lockText(t) { const r = reviewerOf(t); return `Waiting for ${r ? first(prof(r)) || 'the reviewer' : 'the reviewer'}’s review. Only the reviewer or an admin can change it now.`; }
/* status belongs to the people on the task: its developer, whoever has the turn, its reviewer, or an admin. A task nobody has yet is open to anyone. */
function canMoveStatus(t) { if (!t) return false; if (isAdmin()) return true; const me = uid(); return !t.assignee_id || t.assignee_id === me || t.turn_owner === me || reviewerOf(t) === me; }
function statusLockText(t) { const a = prof(t.assignee_id); return `Only ${a ? first(a) || 'the developer' : 'the developer'}, the reviewer or an admin can change this task’s status.`; }
function reviewCount() { return S.tasks.filter(t => catOf(t) === 'review' && canReview(t)).length; }
function syncBadge() {
  const c = badgeCount() + chatBadge();
  try { if (navigator.setAppBadge) c ? navigator.setAppBadge(c) : navigator.clearAppBadge(); } catch {}
}

function render() {
  if (!S.session || !S.ws) return;
  applyTheme(); syncBadge(); splashOut();
  let app = $('#app > .app');
  if (!app) { app = h('div', { class: 'app' }); $('#app').replaceChildren(app); }
  const side = renderSide(); const main = S.loaded ? renderMain() : h('main', { class: 'main', 'aria-label': 'Loading', html: bootLoader() }); const tabs = renderTabs();
  const oldScroll = $('.main .scroll', app); const sx = oldScroll?.scrollLeft || 0, sy = oldScroll?.scrollTop || 0;
  app.replaceChildren(side, main, tabs);
  const ns = $('.main .scroll', app); if (ns) { ns.scrollLeft = sx; ns.scrollTop = sy; }
  if (S.loaded) motionIn(app);
  syncTimerPill();
  tourKick();
}
const tourKick = debounce(() => tours.kick(), 500);
const refresh = debounce(() => { if (!S.session || !S.ws) return; if (!isTyping() || !$('.main')?.contains(document.activeElement)) render(); else renderNavOnly(); refreshSheet(); }, 30);
function renderNavOnly() { const s = $('.side'); if (s) s.replaceWith(renderSide()); const t = $('.tabs'); if (t) t.replaceWith(renderTabs()); }

function navItem(r, label, ic, count, badge) {
  const cur = S.route.v === r.v && (S.route.id || null) === (r.id || null);
  return h('button', { class: 'navi', 'aria-current': cur ? 'page' : null, 'data-nav': r.v + (r.id ? ':' + r.id : ''), onclick: () => go(r) },
    ic, h('span', { class: 't', text: label }), badge ? h('span', { class: 'badge', text: badge > 99 ? '99+' : String(badge) }) : count ? h('span', { class: 'n', text: String(count) }) : null);
}
function renderSide() {
  const mine = S.views.filter(v => v.owner_id === uid()); const shared = S.views.filter(v => v.shared && v.owner_id !== uid());
  const m = me();
  return h('aside', { class: 'side', 'aria-label': 'Navigation' },
    h('div', { class: 'brand' }, ...brandLockup(appName()),
      h('button', { class: 'wschip', title: 'Switch workspace', onclick: e => wsMenu(e.currentTarget) }, S.ws.name), bellButton()),
    h('button', { class: 'navi', 'data-gsearch': '1', onclick: () => cmdk.open(), style: { color: 'var(--mute)', marginBottom: '6px', border: '1px solid var(--line)' } }, icon('search', 16), h('span', { class: 't', text: 'Search or jump to…' }), h('kbd', { text: navigator.platform?.includes('Mac') ? '⌘K' : 'Ctrl K' })),
    h('nav', { class: 'nav' },
      ...sideOrder([
        ['home', homeKind() ? navItem({ v: 'home' }, HOME_NAME[homeKind()], icon(HOME_ICON[homeKind()])) : null],
        ['myturn', navItem({ v: 'myturn' }, 'My turn', icon('turn'), myTurnCount())],
        ['company', canSeeSomeMoney() ? navItem({ v: 'company' }, canSeeMoney() ? 'Company' : 'Hardware', icon('company')) : null],
        ['deals', dealsInMenu() ? navItem({ v: 'deals' }, 'Deals', icon('deal'), dealsBadge()) : null],
        ['review', navItem({ v: 'review' }, 'Review', icon('review'), reviewCount())],
        ['chat', navItem({ v: 'chat' }, 'Chat', icon('chat'), null, chatBadge() || null)],
        ['work', navItem({ v: 'work' }, 'Work', icon('work'))],
        ['bugs', navItem({ v: 'bugs' }, 'Bugs', icon('bug'), S.tasks.filter(t => isBug(t) && !isClosed(t)).length || null)],
        ['sprint', navItem({ v: 'sprint' }, `Sprint ${sprintOf()}`, icon('sprint'))],
        ['clients', navItem({ v: 'clients' }, 'Clients', icon('client'))],
        ['visits', navItem({ v: 'visits' }, 'Site visits', icon('calendar'), visitsBadge())],
        ['tickets', navItem({ v: 'tickets' }, 'Tickets', icon('headset'), ticketsBadge())],
        ['tests', navItem({ v: 'tests' }, 'Test library', icon('review'))],
        ['incidents', navItem({ v: 'incidents' }, 'Incidents', icon('bell'), incidentsBadge())],
        ['approvals', approvalsBadge() || inDept(myMember(), 'management', 'finance', 'operations', 'hr') ? navItem({ v: 'approvals' }, 'Approvals', icon('check'), approvalsBadge()) : null],
        ['stock', navItem({ v: 'stock' }, 'Stock', icon('folder'), (S.stock || []).filter(i => i.min_qty > 0 && i.qty <= i.min_qty).length || null)],
        ['devices', navItem({ v: 'devices' }, 'Devices', icon('wifi'), (S.devices || []).filter(d => d.state === 'faulty').length || null)],
        ['projects', navItem({ v: 'projects' }, 'Projects', icon('folder'))],
        ['vault', navItem({ v: 'vault' }, 'Passwords', icon('key'))],
        ['leave', h('button', { class: 'navi', 'data-nav': 'leave', onclick: () => openLeave() }, icon('leave'), h('span', { class: 't', text: 'Going on leave' }))],
        ['all', navItem({ v: 'all' }, 'All tasks', icon('all'))],
        ['insights', isAdmin() ? navItem({ v: 'insights' }, 'Insights', icon('chart')) : null],
        ['report', isAdmin() ? h('button', { class: 'navi', 'data-nav': 'report', onclick: () => openWeeklyReport() }, icon('export'), h('span', { class: 't', text: 'Weekly report' })) : null],
        ['owner', ownerAdmin ? navItem({ v: 'owner' }, 'Ovrto owner', icon('mark')) : null]].filter(([k]) => !pageHidden(k))),
      hasHiddenPages() ? h('button', { class: 'navi allpages', 'data-nav': 'allpages', onclick: () => toggleAllPages() }, icon(showAllPages() ? 'eye' : 'menu'), h('span', { class: 't', text: showAllPages() ? 'Only my department’s pages' : 'Show all pages' })) : null,
      h('h4', {}, 'Views', h('button', { 'aria-label': 'New view', title: 'New view', onclick: () => newViewFromCurrent() }, icon('plus', 14))),
      mine.length || shared.length ? [...mine, ...shared].map(v => navItem({ v: 'view', id: v.id }, v.name + (v.shared && v.owner_id !== uid() ? ' · shared' : ''), icon('view'))) : h('div', { class: 'note', style: { padding: '0 8px' }, text: 'Filter any list, then save it here.' }),
      h('h4', {}, 'Projects', isAdmin() || true ? h('button', { 'aria-label': 'New project', title: 'New project', onclick: () => openNewProject() }, icon('plus', 14)) : null),
      S.projects.map(p => navItem({ v: 'project', id: p.id }, p.name, h('span', { class: 'ico' }, h('span', { class: 'swatch', style: { width: '10px', height: '10px', background: p.color, borderRadius: '2px' } })), S.tasks.filter(t => t.project_id === p.id && !isClosed(t)).length || null))),
    h('div', { class: 'sidefoot' },
      h('button', { onclick: () => openSettings('me'), 'aria-label': 'My profile', style: { display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '0' } }, avatar(m, { size: 'lg' }), h('span', { class: 'who', text: dname(m) })),
      isAdmin() ? h('button', { class: 'x', 'aria-label': 'Add members', title: 'Add members', onclick: () => openSettings('workspace', 'invites') }, icon('invite')) : null,
      h('button', { class: 'x', 'aria-label': 'Help', title: 'Help & tours', onclick: () => openHelp() }, icon('help')),
      h('button', { class: 'x', 'aria-label': 'Settings', title: 'Settings', 'data-tour': 'settings-btn', onclick: () => openSettings(isAdmin() ? 'workspace' : 'me') }, icon('gear'))));
}
/* My turn stays first; the pages this person's job needs come next, then the rest in the usual order */
function sideOrder(pairs) {
  const pins = deptPins(); const rank = k => k === 'home' ? -2 : k === 'myturn' ? -1 : pins.includes(k) ? pins.indexOf(k) : 100;
  return pairs.map((p, i) => [p, i]).sort((x, y) => (rank(x[0][0]) - rank(y[0][0])) || (x[1] - y[1])).map(x => x[0][1]);
}
function renderTabs() {
  const t = (r, label, ic, badge) => h('button', { class: 'tab', 'aria-current': S.route.v === r.v ? 'page' : null, 'data-nav': r.v, onclick: () => go(r) }, ic, label, badge ? h('span', { class: 'badge', text: badge > 99 ? '99+' : String(badge) }) : null);
  const workish = !['myturn', 'review', 'inbox', 'chat', 'insights', 'owner', 'vault', 'company', 'home', 'deals', 'deal', 'devices', 'visits', 'tickets', 'tests', 'incidents', 'approvals', 'stock'].includes(S.route.v);
  return h('nav', { class: 'tabs', 'aria-label': 'Main' },
    t({ v: 'myturn' }, 'My turn', icon('turn', 22)),
    h('button', { class: 'tab', 'aria-current': workish ? 'page' : null, 'data-nav': 'work', onclick: () => workish ? viewSwitcher() : go({ v: 'work' }) }, icon('work', 22), 'Work'),
    h('button', { class: 'tab plus', 'aria-label': 'New task', 'data-tour': 'create-btn', onclick: () => openCreate() }, h('span', { class: 'pl' }, icon('plus', 22))),
    !pageHidden('review') || !morePins().length ? t({ v: 'review' }, 'Review', icon('review', 22), reviewCount() || null)
      : t({ v: morePins()[0] }, PAGE_LABEL[morePins()[0]], icon(PAGE_ICON[morePins()[0]], 22)),
    t({ v: 'chat' }, 'Chat', icon('chat', 22), chatBadge() || null),
    h('button', { class: 'tab', 'data-nav': 'more', 'aria-label': 'More: settings, members, import', onclick: () => openMore() }, icon('menu', 22), 'More'));
}
function wsMenu(anchor) {
  const items = [{ header: 'Workspaces' }, ...S.wsList.map(w => ({ label: w.name, sub: w.id === S.ws.id ? 'current' : '', fn: () => switchWs(w.id) })), ...(isAdmin() ? ['-', { label: 'Create a workspace', icon: 'plus', fn: () => openCreateWs() }] : [])];
  if (isAdmin()) items.push({ label: 'Workspace settings', icon: 'gear', fn: () => openSettings('workspace') });
  menu(anchor, items);
}
function viewSwitcher() {
  openSheet({ title: 'Go to', kind: 'center', build: (sh) => {
    const body = h('div', { class: 'sbody' });
    const grp = (title, items) => (items = items.filter(Boolean)).length ? h('div', {}, h('div', { class: 'ph', style: { padding: '0 0 6px', font: '600 12px var(--display)', letterSpacing: '0', color: 'var(--mute)' }, text: title }), ...items) : null;
    const it = (r, label, ic) => pageHidden(r.v) ? null : h('button', { class: 'navi', style: { height: '44px' }, onclick: () => { closeSheet(true); go(r); } }, ic, h('span', { class: 't', text: label }));
    body.append(...[
      grp('Views', [it({ v: 'work' }, 'Work', icon('work')), it({ v: 'bugs' }, 'Bugs', icon('bug')), it({ v: 'sprint' }, `Sprint ${sprintOf()}`, icon('sprint')), it({ v: 'clients' }, 'Clients', icon('client')), it({ v: 'projects' }, 'Projects', icon('folder')), it({ v: 'all' }, 'All tasks', icon('all'))]),
      grp('Saved views', S.views.map(v => it({ v: 'view', id: v.id }, v.name, icon('view')))),
      grp('Projects', S.projects.map(p => it({ v: 'project', id: p.id }, p.name, icon('folder')))),
      grp('More', [h('button', { class: 'navi', style: { height: '44px' }, onclick: () => openSettings(isAdmin() ? 'workspace' : 'me') }, icon('gear'), h('span', { class: 't', text: 'Settings' })), h('button', { class: 'navi', style: { height: '44px' }, onclick: () => openHelp() }, icon('help'), h('span', { class: 't', text: 'Help & tours' })), h('button', { class: 'navi', style: { height: '44px' }, onclick: () => { closeSheet(true); wsMenu($('.head .ptitle') || document.body); } }, icon('mark'), h('span', { class: 't', text: 'Switch workspace' }))])].filter(Boolean));
    sh.append(body);
  } });
}

function renderMain() {
  // an old link or a removed view: open the person's start page, not an unfiltered list of everything
  if (!BUILTIN[S.route.v] && !['view', 'project', 'deal'].includes(S.route.v) || (S.route.v === 'view' && !S.views.find(x => x.id === S.route.id)) || (S.route.v === 'project' && !S.projects.find(x => x.id === S.route.id) && S.loaded)) { setTimeout(() => go({ v: deptHome(myDept()) }), 0); }
  const r = S.route; const special = BUILTIN[r.v]?.special;
  const main = h('main', { class: 'main', 'aria-label': routeTitle() });
  if (special === 'myturn') main.append(...viewMyTurn());
  else if (special === 'inbox') main.append(...viewInbox());
  else if (special === 'review') main.append(...viewReview());
  else if (special === 'insights') main.append(...viewInsights());
  else if (special === 'owner') main.append(...viewOwner());
  else if (special === 'projects') main.append(...viewProjects());
  else if (special === 'vault') main.append(...viewVault());
  else if (special === 'company') main.append(...viewCompany());
  else if (special === 'home') main.append(...viewDeptHome());
  else if (special === 'deals') main.append(...viewDeals());
  else if (special === 'devices') main.append(...viewDevices());
  else if (special === 'visits') main.append(...viewVisits());
  else if (special === 'tickets') main.append(...viewTickets());
  else if (special === 'tests') main.append(...viewTests());
  else if (special === 'incidents') main.append(...viewIncidents());
  else if (special === 'approvals') main.append(...viewApprovals());
  else if (special === 'stock') main.append(...viewStock());
  else if (r.v === 'deal') main.append(...viewDeal());
  else if (r.v === 'project') main.append(...viewProject());
  else if (special === 'chat') { main.classList.add('chatpage'); main.append(...viewChat()); }
  else main.append(...viewTasks());
  return main;
}
function pageHead(title, sub, tools, extra) {
  const back = S.route.v === 'project' ? h('button', { class: 'btn icon ghost hback', 'aria-label': 'All projects', title: 'All projects', onclick: () => go({ v: 'projects' }) }, icon('back', 20)) : null;
  const t = back ? h('div', { class: 'ptitle-w' }, back, h('h1', { class: 'ptitle', 'data-tour': 'view-title' }, h('span', { class: 't', text: title })))
    : isPhone() && !['myturn', 'review', 'inbox', 'chat', 'insights', 'owner'].includes(S.route.v)
    ? h('button', { class: 'ptitle', 'data-tour': 'view-title', onclick: () => viewSwitcher() }, h('span', { class: 't', text: title }), h('span', { class: 'chev' }, icon('chev', 20)))
    : h('h1', { class: 'ptitle', 'data-tour': 'view-title' }, h('span', { class: 't', text: title }));
  return h('header', { class: 'head' },
    h('div', { class: 'hrow' }, t, h('span', { class: 'sp' }), tools || null, isPhone() ? h('button', { class: 'x gsearch-m', 'data-gsearch': '1', 'aria-label': 'Search', title: 'Search', onclick: () => cmdk.open() }, icon('search', 20)) : null, isPhone() && S.route.v !== 'inbox' ? bellButton() : null),
    sub ? h('div', { class: 'hsub' }, sub) : null, extra || null);
}

/* ── task card + row ── */
function cardFields(t) {
  const out = [];
  const off = !techPerson();
  for (const f of S.fields.filter(f => f.show_on_card && fieldApplies(f, t) && !(off && OFFICE_HIDE_FIELDS.includes(f.key))).slice(0, 3)) {
    const v = fieldVal(t, f); if (!hasVal(v)) continue;
    if (f.kind === 'select') { const o = optOf(f, v); if (o) out.push(tag(o.label, o.color)); }
    else if (f.kind === 'multi') for (const id of v.slice(0, 2)) { const o = optOf(f, id); if (o) out.push(tag(o.label, o.color)); }
    else if (f.kind === 'person') out.push(tag(first(prof(v)), 'var(--fg2)'));
    else if (f.kind === 'checkbox') out.push(tag(f.name, 'var(--green)'));
    else out.push(tag(String(v), 'var(--fg2)'));
  }
  for (const k of t.flags || []) { const fl = FLAGS.find(x => x.k === k); if (fl && k !== 'regression') out.push(tag(fl.n, fl.c)); }
  return out;
}
function taskCard(t, { draggable = true } = {}) {
  const ty = tyOf(t.type_id); const dev = prof(t.assignee_id); const d = dueInfo(t); const closed = isClosed(t);
  const devIsTurn = t.turn_owner && t.turn_owner === t.assignee_id;
  const c = h('button', {
    class: 'card' + (closed ? ' closed' : '') + ((t.flags || []).includes('regression') ? ' regress' : '') + (S.selected === t.id ? ' sel' : ''),
    'data-id': t.id, draggable: draggable && !isPhone() ? 'true' : null, onclick: () => openTask(t.id),
  },
    h('div', { class: 'top' }, plate(t), typeChip(ty), h('span', { class: 'sp' }), prioGlyph(t.priority || 0)),
    h('div', { class: 't', text: t.title || 'Untitled' }),
    (() => { const f = cardFields(t); return f.length ? h('div', { class: 'tags' }, f) : null; })(),
    h('div', { class: 'foot' },
      h('span', { title: devLabel() + ': ' + dname(dev), style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } }, avatar(dev, { size: 'xs', turn: devIsTurn }), h('span', { class: 'meta', text: dev ? first(dev) : 'No dev' })),
      !devIsTurn && t.turn_owner ? h('span', { class: 'meta', title: 'Whose turn' }, '→', turnAvatar(t, 'xs')) : null,
      turnLine(t),
      h('span', { class: 'sp' }),
      t.sendbacks ? h('span', { class: 'meta red', title: `Sent back ${t.sendbacks}×` }, icon('ret', 12), String(t.sendbacks)) : null,
      (t.files || []).length ? h('span', { class: 'meta', title: 'Attachments', 'aria-label': `${t.files.length} attachments` }, icon('clip', 12), String(t.files.length)) : null,
      (t.checklist || []).length ? h('span', { class: 'meta', title: 'Checklist' }, `${t.checklist.filter(x => x.done).length}/${t.checklist.length}`) : null,
      d ? h('span', { class: 'meta' + (d.over ? ' red' : '') }, icon('calendar', 12), d.label) : null));
  if (draggable && !isPhone()) {
    c.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => c.classList.add('ghosted'), 0); });
    c.addEventListener('dragend', () => c.classList.remove('ghosted'));
  }
  if (isPhone()) longPress(c, () => quickMove(c, t));
  return c;
}
function longPress(el, fn) {
  let tm, moved = false;
  el.addEventListener('touchstart', () => { moved = false; tm = setTimeout(() => { if (!moved) { el.dataset.lp = '1'; navigator.vibrate?.(10); fn(); } }, 480); }, { passive: true });
  el.addEventListener('touchmove', () => { moved = true; clearTimeout(tm); }, { passive: true });
  el.addEventListener('touchend', e => { clearTimeout(tm); if (el.dataset.lp) { e.preventDefault(); delete el.dataset.lp; } });
  el.addEventListener('contextmenu', e => { if (isPhone()) e.preventDefault(); });
}
function quickMove(anchor, t) {
  const g = vc().group; const groups = groupTasks([], g === 'none' ? 'status' : g).filter(x => x.patch || x.fieldSet);
  picker(anchor, { options: groups.map(x => ({ v: x.key, label: x.label, icon: x.icon || null })), value: g === 'status' ? t.status_id : null, search: false,
    onPick: v => { const grp = groups.find(x => String(x.key) === String(v)); const p = groupPatch(t, grp); if (p) moveTask(t, p); } });
}
async function moveTask(t, patch) {
  const before = catOf(t); const prev = {}; for (const k in patch) prev[k] = clone(t[k] ?? null);
  const ok = await patchTask(t.id, patch, { noUndo: true });
  if (!ok) return; const after = catOf(t);
  let msg = 'Moved';
  if (patch.status_id) { msg = after === 'done' ? 'Approved — moved to Done' : after === 'review' ? 'Sent to review' : `Moved to ${stOf(patch.status_id).name}`; if (after !== before) askPushSoon(); }
  else if ('assignee_id' in patch) msg = patch.assignee_id ? `${first(prof(patch.assignee_id))}’s on it` : 'Developer cleared';
  toast(msg, { label: 'Undo', fn: () => patchTask(t.id, prev) });
}
const COLS = {
  key: { n: 'ID', get: t => taskKey(t) }, title: { n: 'Title', get: t => t.title }, type: { n: 'Type', get: t => tyOf(t.type_id)?.name || '' },
  status: { n: 'Status', get: t => stOf(t.status_id)?.name || '' }, developer: { n: 'Developer', get: t => (t.assignee_id ? dname(prof(t.assignee_id)) : '') },
  reviewer: { n: 'Reviewer', get: t => (t.reviewer_id ? dname(prof(t.reviewer_id)) : '') }, reporter: { n: 'Reporter', get: t => (t.created_by ? dname(prof(t.created_by)) : '') },
  priority: { n: 'Priority', get: t => prioName(t.priority || 0) }, project: { n: 'Project', get: t => pjOf(t.project_id)?.name || '' },
  sprint: { n: 'Sprint', get: t => (t.sprint ? String(t.sprint) : '') }, due: { n: 'Due', get: t => t.due_date || '' },
  turn: { n: 'Whose turn', get: t => (t.turn_owner ? `${turnName(t.turn_owner)} · ${ago(t.turn_since)}` : '') },
  flags: { n: 'Flags', get: t => (t.flags || []).map(k => FLAGS.find(f => f.k === k)?.n || k).join('; ') },
  sendbacks: { n: 'Send-backs', get: t => String(t.sendbacks || 0) },
  created: { n: 'Created', get: t => (t.created_at || '').slice(0, 10) }, updated: { n: 'Updated', get: t => (t.updated_at || '').slice(0, 10) },
  completed: { n: 'Completed', get: t => (t.completed_at || '').slice(0, 10) },
};
function fieldText(t, f) {
  const v = fieldVal(t, f); if (!hasVal(v)) return '';
  if (f.kind === 'select') return optOf(f, v)?.label || '';
  if (f.kind === 'multi') return v.map(id => optOf(f, id)?.label).filter(Boolean).join('; ');
  if (f.kind === 'person') return dname(prof(v));
  if (f.kind === 'checkbox') return v ? 'Yes' : 'No';
  return String(v);
}
function colDef(k) { if (COLS[k]) return COLS[k]; if (k.startsWith('f:')) { const f = fdOf(k.slice(2)); if (f) return { n: f.name, get: t => fieldText(t, f) }; } return null; }
function taskRow(t) {
  const ty = tyOf(t.type_id); const st = stOf(t.status_id); const d = dueInfo(t); const closed = isClosed(t);
  const r = h('button', { class: 'row' + (closed ? ' closed' : '') + ((t.flags || []).includes('regression') ? ' regress' : '') + (S.selected === t.id ? ' sel' : ''), 'data-id': t.id, onclick: () => openTask(t.id) },
    h('span', { style: { display: 'inline-flex', gap: '8px', alignItems: 'center' } }, prioGlyph(t.priority || 0), stIcon(st)),
    plate(t),
    h('span', { style: { display: 'flex', gap: '8px', alignItems: 'center', minWidth: '0' } }, ty?.is_bug ? typeChip(ty) : null, h('span', { class: 't', text: t.title || 'Untitled' })),
    h('span', { class: 'r' }, ...cardFields(t).slice(0, 2), t.sendbacks ? h('span', { class: 'meta red' }, icon('ret', 12), String(t.sendbacks)) : null,
      (t.files || []).length ? h('span', { class: 'meta', title: 'Attachments', 'aria-label': `${t.files.length} attachments` }, icon('clip', 12), String(t.files.length)) : null,
      d ? h('span', { class: 'meta' + (d.over ? ' red' : '') }, d.label) : null, turnLine(t), avatar(prof(t.assignee_id), { size: 'xs', turn: t.turn_owner && t.turn_owner === t.assignee_id })));
  if (isPhone()) longPress(r, () => quickMove(r, t));
  return r;
}

/* ── generic task views (board / list) ── */
function viewTasks() {
  const cfg = vc(); const tasks = visibleTasks(cfg).sort(SORTS[cfg.sort] || SORTS.priority);
  const special = BUILTIN[S.route.v]?.special;
  const tools = h('div', { class: 'tools' },
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Layout', 'data-tour': 'layout' },
      h('button', { 'aria-pressed': String(cfg.layout === 'board'), onclick: () => setVc({ layout: 'board' }), title: 'Board' }, icon('board', 16), isPhone() ? null : 'Board'),
      h('button', { 'aria-pressed': String(cfg.layout === 'list'), onclick: () => setVc({ layout: 'list' }), title: 'List' }, icon('list', 16), isPhone() ? null : 'List')),
    isPhone() ? null : h('button', { class: 'btn icon ghost', title: 'Import from a file', 'aria-label': 'Import', 'data-tour': 'import-btn', onclick: () => openImport() }, icon('upload')),
    isPhone() ? null : h('button', { class: 'btn icon ghost', title: 'Export', 'aria-label': 'Export', 'data-tour': 'export-btn', onclick: () => openExport() }, icon('export')),
    isPhone() ? null : h('button', { class: 'btn pri', 'data-tour': 'create-btn', onclick: () => openCreate(special === 'bugs' ? { type: 'bug' } : {}) }, icon('plus', 16), special === 'bugs' ? 'Report bug' : 'New task'));
  let sub = null, extra = null;
  if (special === 'sprint') {
    const n = sprintOf(); const [a, b] = sprintRange(n); const all = tasks; const done = all.filter(t => catOf(t) === 'done');
    const reviewed = all.filter(t => catOf(t) === 'done'); const firstPass = reviewed.length ? Math.round(100 * reviewed.filter(t => !t.sendbacks).length / reviewed.length) : null;
    const left = Math.max(0, Math.ceil((b - new Date()) / 864e5) + 1);
    const segs = CATS.map(c => ({ c, n: all.filter(t => catOf(t) === c).length })).filter(x => x.n);
    extra = h('div', { class: 'stat' },
      h('div', {}, h('div', { class: 'k', text: 'Dates' }), h('div', { class: 'sm', style: { fontWeight: '600' }, text: `${fmtDate(a.toISOString())} – ${fmtDate(b.toISOString())} · ${left} day${left === 1 ? '' : 's'} left` })),
      h('div', {}, h('div', { class: 'k', text: 'Done' }), h('div', { class: 'v', text: `${done.length}/${all.length}` })),
      h('div', { title: 'Share of finished tasks that passed review without being sent back' }, h('div', { class: 'k', text: 'First-pass' }), h('div', { class: 'v', text: firstPass == null ? '—' : firstPass + '%' })),
      h('div', { class: 'bar', role: 'img', 'aria-label': 'Sprint progress by status' }, segs.map(s => h('i', { style: { width: (100 * s.n / Math.max(1, all.length)) + '%', background: `var(--st-${s.c})` }, title: `${CAT_NAME[s.c]}: ${s.n}` }))));
  }
  const head = pageHead(routeTitle(), sub, tools, h('div', {}, S.route.v === 'project' ? projectTabs() : null, extra, deptFocusBar(), filterBar(cfg)));
  let body;
  if (!S.tasks.length) body = emptyState('0 TASKS', 'Clear ground. Add the first task.', { label: 'New task', fn: () => openCreate() }, { label: 'Import from a file', fn: () => openImport() });
  else if (!tasks.length && special === 'bugs') body = emptyState('0 BUGS', 'No open bugs. Keep it that way.', null);
  else if (!tasks.length) body = emptyState('NO FILTER MATCH', 'No tasks match this view.', vcDirty() || searchQ ? { label: 'Reset filters', fn: () => { searchQ = ''; S.vc = null; render(); } } : null);
  else if (cfg.layout === 'board') body = boardView(tasks, cfg);
  else if (special === 'bugs') body = h('div', {}, bugsTriage(tasks), listView(tasks.filter(t => !['backlog', 'unstarted'].includes(catOf(t))), cfg));
  else body = listView(tasks, cfg);
  return [head, h('div', { class: 'scroll' + (cfg.layout === 'board' ? ' hz' : '') }, body)];
}
function bugsTriage(tasks) {
  const tri = tasks.filter(t => ['backlog', 'unstarted'].includes(catOf(t))).sort(SORTS.created);
  return h('div', { class: 'list', 'data-tour': 'triage', style: { paddingBottom: '0' } }, h('div', { class: 'group' },
    h('div', { class: 'ghead' }, h('span', { class: 'no', text: '00' }), h('span', { class: 'nm', text: 'Triage' }), h('span', { class: 'ct', text: String(tri.length) })),
    tri.length ? capped(tri, taskRow, 'tri') : h('div', { class: 'colempty', style: { margin: '8px 0' }, text: 'Nothing new' })));
}
function setVc(patch) { Object.assign(vc(), patch); if (patch.layout && !['view'].includes(S.route.v)) savePrefs({ layout: patch.layout }); render(); }
/* long lists draw in pages: the first rows at once, the rest as the person scrolls (or taps "Show more").
   What someone already opened stays open across re-renders, so an edit never jumps them back to the top. */
const SHOWN = new Map();
function capped(items, draw, key, step = 100, tag = 'div') {
  const k = S.route.v + (S.route.id || '') + ':' + key; let n = Math.max(step, SHOWN.get(k) || step);
  if (items.length <= n) return items.map(draw);
  const out = items.slice(0, n).map(draw);
  const more = h(tag === 'tr' ? 'tr' : 'div', { class: 'moreload', 'data-more': key }, h(tag === 'tr' ? 'td' : 'span', { colspan: 99 },
    h('button', { class: 'lnk sm', onclick: () => grow() }, `Show ${Math.min(step, items.length - n)} more of ${items.length - n}`)));
  const grow = () => {
    const next = items.slice(n, n + step); n += next.length; SHOWN.set(k, n);
    more.before(...next.map(draw));
    if (n >= items.length) { io.disconnect(); more.remove(); } else more.querySelector('button').textContent = `Show ${Math.min(step, items.length - n)} more of ${items.length - n}`;
  };
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && more.isConnected) grow(); }, { rootMargin: '600px' });
  requestAnimationFrame(() => { if (more.isConnected) io.observe(more); });
  return [...out, more];
}
function boardView(tasks, cfg) {
  const groups = groupTasks(tasks, cfg.group === 'none' ? 'status' : cfg.group);
  const board = h('div', { class: 'board', 'data-tour': 'board' });
  groups.forEach((g, i) => {
    const col = h('section', { class: 'col', 'data-key': String(g.key), 'aria-label': g.label },
      h('div', { class: 'colhead' }, h('span', { class: 'no', text: String(i + 1).padStart(2, '0') }), g.icon || (g.color ? h('span', { class: 'swatch', style: { width: '10px', height: '10px', background: g.color } }) : null),
        h('span', { class: 'nm', text: g.label }), h('span', { class: 'ct', text: String(g.tasks.length) }),
        (g.patch || g.fieldSet) && !(g.patch?.status_id && ['done', 'canceled'].includes(stOf(g.patch.status_id)?.category)) ? h('button', { class: 'add', 'aria-label': `New task in ${g.label}`, onclick: () => openCreate({ preset: groupPatch({ fields: {} }, g) }) }, icon('plus', 16)) : null),
      h('div', { class: 'cards' }, g.tasks.length ? capped(g.tasks, t => taskCard(t), 'b' + g.key, 40) : h('div', { class: 'colempty', text: 'Empty' })));
    if (g.patch || g.fieldSet) {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drop'); });
      col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('drop'); });
      col.addEventListener('drop', e => {
        e.preventDefault(); col.classList.remove('drop'); const t = taskOf(e.dataTransfer.getData('text/plain')); if (!t) return;
        const p = groupPatch(t, g); if (!p) return;
        const prev = {}; for (const k in p) prev[k] = clone(t[k] ?? null);
        if (JSON.stringify(prev) !== JSON.stringify(p)) moveTask(t, p);
      });
    }
    board.append(col);
  });
  return board;
}
function listView(tasks, cfg) {
  const groups = cfg.group === 'none' ? [{ key: 'all', label: 'All tasks', tasks }] : groupTasks(tasks, cfg.group).filter(g => g.tasks.length);
  if (!isPhone() && cfg.columns?.length && cfg.table) {
    const cols = cfg.columns.map(k => [k, colDef(k)]).filter(x => x[1]);
    const tb = h('tbody');
    groups.forEach(g => {
      if (cfg.group !== 'none') tb.append(h('tr', { class: 'gh' }, h('td', { colspan: cols.length, text: `${g.label} · ${g.tasks.length}` })));
      tb.append(...capped(g.tasks, t => h('tr', { class: 'trow', onclick: () => openTask(t.id), 'data-id': t.id }, cols.map(([k, c]) => h('td', { class: k === 'key' ? 'mono' : '', text: c.get(t) }))), 't' + g.key, 100, 'tr'));
    });
    return h('div', { class: 'tbl' }, h('table', {}, h('thead', {}, h('tr', {}, cols.map(([, c]) => h('th', { text: c.n })))), tb));
  }
  const cf = clientField();
  return h('div', { class: 'list' }, groups.map((g, i) => {
    let extra = null;
    if (BUILTIN[S.route.v]?.special === 'clients' && cf && cfg.group === 'f:' + cf.id) {
      const all = S.tasks.filter(t => { const v = (t.fields || {})[cf.id]; return g.key === '__none' ? !hasVal(v) : (v === g.key || (Array.isArray(v) && v.includes(g.key))); });
      const done = all.filter(t => catOf(t) === 'done').length; const waiting = all.filter(t => t.turn_owner === 'client');
      const days = waiting.reduce((s, t) => s + (Date.now() - new Date(t.turn_since)) / 864e5, 0);
      extra = h('span', { class: 'extra', text: `${g.tasks.length} open · ${done} done${waiting.length ? ` · waiting on client ${Math.round(days)}d total` : ''}` });
    }
    return h('div', { class: 'group' },
      cfg.group !== 'none' ? h('div', { class: 'ghead' }, h('span', { class: 'no', text: String(i + 1).padStart(2, '0') }), g.icon || (g.color ? h('span', { class: 'swatch', style: { width: '10px', height: '10px', background: g.color } }) : null), h('span', { class: 'nm', text: g.label }), extra, h('span', { class: 'ct', text: String(g.tasks.length) })) : null,
      capped(g.tasks, taskRow, 'l' + g.key));
  }));
}

/* ── filter bar + saved views ── */
function filterBar(cfg) {
  const chips = (cfg.filters || []).map((f, i) => {
    const ff = filterFields().find(x => x.k === f.f); if (!ff) return null;
    const opts = filterOptions(f.f); const labels = f.op === 'contains' ? [`“${f.v[0]}”`] : f.v.map(v => opts.find(o => o.v === v)?.label || String(v));
    const label = f.f === 'kind' && f.v.length === 1 && f.v[0] === 'bug' ? (f.op === 'none' ? 'Hiding bugs' : 'Only bugs')
      : f.f === 'closed' && f.v.length === 1 ? ((f.op === 'none') === (f.v[0] === 'closed') ? 'Open only' : 'Closed only')
      : f.f === 'sprint' && f.v.length === 1 && f.op !== 'none' && String(f.v[0]).toLowerCase() === 'current' ? 'This sprint' : `${ff.n} ${f.op === 'none' ? 'is not' : f.op === 'contains' ? 'contains' : 'is'} ${labels.join(', ')}`;
    return h('span', { class: 'fchip on' },
      h('button', { onclick: e => editFilter(e.currentTarget, i), text: label, style: { maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' } }),
      h('button', { class: 'x', style: { width: '22px', height: '22px' }, 'aria-label': 'Remove filter', onclick: () => { cfg.filters.splice(i, 1); render(); } }, icon('x', 14)));
  });
  const dirty = vcDirty(); const isSaved = S.route.v === 'view'; const savedView = isSaved && S.views.find(v => v.id === S.route.id);
  const canSave = isSaved && savedView && (savedView.owner_id === uid() || isAdmin());
  const search = h('input', { type: 'search', id: 'q', placeholder: 'Search…', 'aria-label': 'Search tasks', value: searchQ, style: { height: '30px', width: isPhone() ? '120px' : '170px', flex: 'none', padding: '4px 9px', fontSize: isPhone() ? '16px' : '13px' } });
  search.addEventListener('input', debounce(() => { searchQ = search.value; const m = $('.main'); const pos = search.selectionStart; render(); const ns = $('#q'); if (ns) { ns.focus(); ns.setSelectionRange(pos, pos); } }, 150));
  return h('div', { class: 'toolbar', 'data-tour': 'filters', style: { marginTop: '10px' } },
    search, ...chips,
    h('button', { class: 'fchip', onclick: e => addFilter(e.currentTarget) }, icon('plus', 14), 'Filter'),
    h('button', { class: 'fchip', onclick: e => picker(e.currentTarget, { options: groupOptions(), value: cfg.group, search: false, onPick: v => setVc({ group: v }) }) }, 'Group: ' + (groupOptions().find(g => g.v === cfg.group)?.label || 'Status')),
    h('button', { class: 'fchip', onclick: e => picker(e.currentTarget, { options: Object.entries(SORT_NAMES).map(([v, label]) => ({ v, label })), value: cfg.sort, search: false, onPick: v => setVc({ sort: v }) }) }, 'Sort: ' + SORT_NAMES[cfg.sort || 'priority']),
    cfg.layout === 'list' && !isPhone() ? h('button', { class: 'fchip' + (cfg.table ? ' on' : ''), onclick: e => columnsMenu(e.currentTarget, cfg) }, 'Columns') : null,
    dirty && canSave ? h('button', { class: 'fchip on', onclick: () => saveView(savedView) }, 'Save') : null,
    dirty ? h('button', { class: 'fchip', onclick: () => newViewFromCurrent() }, 'Save as new') : null,
    dirty ? h('button', { class: 'fchip', onclick: () => { S.vc = null; render(); } }, 'Reset') : null,
    isSaved && savedView && canSave ? h('button', { class: 'fchip', 'aria-label': 'View options', onclick: e => viewMenu(e.currentTarget, savedView) }, icon('more', 14)) : null);
}
function columnsMenu(anchor, cfg) {
  const all = [...Object.keys(COLS), ...S.fields.map(f => 'f:' + f.id)];
  picker(anchor, { options: [{ v: '__table', label: cfg.table ? 'Show as rows' : 'Show as table' }, ...all.map(k => ({ v: k, label: colDef(k).n }))], value: cfg.table ? [...(cfg.columns || []), '__table'] : cfg.columns || [], multi: true, search: true,
    onPick: vals => { cfg.table = vals.includes('__table'); cfg.columns = vals.filter(v => v !== '__table'); render(); } });
}
function addFilter(anchor) {
  picker(anchor, { options: filterFields().map(f => ({ v: f.k, label: f.n })), placeholder: 'Filter by…', onPick: k => {
    const ff = filterFields().find(x => x.k === k);
    const isText = ff.field && ['text', 'number', 'date'].includes(ff.field.kind);
    vc().filters.push({ f: k, op: 'any', v: [] }); const i = vc().filters.length - 1;
    render(); setTimeout(() => { const chips = $$('.toolbar .fchip.on > button:first-child'); const a = chips[i]; if (a) editFilter(a, i, isText); }, 40);
  } });
}
function editFilter(anchor, i, textMode) {
  const f = vc().filters[i]; const opts = filterOptions(f.f);
  const ff = filterFields().find(x => x.k === f.f);
  if (textMode || f.op === 'contains') {
    popover(anchor, pop => {
      const inp = h('input', { class: 'q', type: 'search', placeholder: `${ff.n} contains…`, value: f.v[0] || '' });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { f.op = 'contains'; f.v = [inp.value]; closePop(); render(); } });
      pop.append(inp, h('div', { class: 'hint', text: 'Press Enter to apply' })); setTimeout(() => inp.focus(), 0);
    });
    return;
  }
  picker(anchor, { options: [{ v: '__op', label: f.op === 'none' ? 'Switch to “is”' : 'Switch to “is not”' }, ...opts], value: f.v, multi: true,
    onPick: vals => { if (vals.includes('__op')) { f.op = f.op === 'none' ? 'any' : 'none'; vals = vals.filter(v => v !== '__op'); } f.v = vals; render(); },
    footer: () => h('div', { class: 'hint' }, 'Pick one or more · ', h('button', { class: 'link', onclick: () => { closePop(); if (!f.v.length) { vc().filters.splice(i, 1); } render(); } }, 'Done')) });
}
async function newViewFromCurrent() {
  const cfg = clone(vc()); const name = await promptText('Name this view', routeTitle() + (vcDirty() ? ' (custom)' : ''), 'Save view');
  if (!name) return;
  const row = { id: uuid(), workspace_id: S.ws.id, owner_id: uid(), name, shared: false, config: cfg, position: S.views.length, created_at: nowIso() };
  if (await cfgUpsert('views', row, 'View saved')) go({ v: 'view', id: row.id });
}
async function saveView(v) { await cfgUpsert('views', Object.assign({}, v, { config: clone(vc()) }), 'View saved'); S.vc = null; render(); }
function viewMenu(anchor, v) {
  menu(anchor, [
    { label: v.shared ? 'Make private' : 'Share with workspace', fn: () => cfgUpsert('views', Object.assign({}, v, { shared: !v.shared }), v.shared ? 'View is private' : 'Shared with the team') },
    { label: 'Rename', fn: async () => { const n = await promptText('Rename view', v.name, 'Rename'); if (n) cfgUpsert('views', Object.assign({}, v, { name: n }), 'Renamed'); } },
    '-', { label: 'Delete view', danger: true, fn: async () => { if (await cfgDelete('views', v.id, 'View deleted')) go({ v: 'work' }); } },
  ]);
}
function promptText(title, value = '', okLabel = 'Save') {
  return new Promise(res => {
    let done = false;
    openSheet({ title, kind: 'center', stack: !!currentSheet(), onClose: () => { if (!done) res(null); }, build: sh => {
      const inp = h('input', { type: 'text', id: 'promptIn', value, 'aria-label': title, style: { width: '100%' } });
      const ok = () => { const v = inp.value.trim(); if (!v) { inp.focus(); return; } done = true; closeSheet(true); res(v); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
      sh.append(h('div', { class: 'sbody' }, inp), h('div', { class: 'sfoot' }, h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), h('button', { class: 'btn pri', onclick: ok }, okLabel)));
      setTimeout(() => { inp.focus(); inp.select(); }, 30);
    } });
  });
}

/* ── My turn: the band with your day in numbers, then what needs you, your tasks, and what others hold ── */
const ST_TILE = {
  backlog: '<svg viewBox="0 0 18 18"><circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="2.6 2.4"/></svg>',
  unstarted: '<svg viewBox="0 0 18 18"><circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  started: '<svg viewBox="0 0 18 18"><path fill="currentColor" fill-rule="evenodd" d="M9 2a7 7 0 1 1 0 14A7 7 0 0 1 9 2zm0 2v10a5 5 0 0 0 0-10z"/></svg>',
  review: '<svg viewBox="0 0 18 18"><path fill="currentColor" fill-rule="evenodd" d="M1.6 9S4.3 4 9 4s7.4 5 7.4 5-2.7 5-7.4 5S1.6 9 1.6 9zM9 6.9a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2z"/></svg>',
  done: '<svg viewBox="0 0 18 18"><path fill="currentColor" fill-rule="evenodd" d="M9 2a7 7 0 1 1 0 14A7 7 0 0 1 9 2zm3.3 4.4-4.2 4.3-2-2-1.1 1.1 3.1 3.1 5.3-5.4z"/></svg>',
  canceled: '<svg viewBox="0 0 18 18"><path fill="currentColor" fill-rule="evenodd" d="M9 2a7 7 0 1 1 0 14A7 7 0 0 1 9 2zM6.6 5.5 5.5 6.6 7.9 9l-2.4 2.4 1.1 1.1L9 10.1l2.4 2.4 1.1-1.1L10.1 9l2.4-2.4-1.1-1.1L9 7.9z"/></svg>',
  clock: '<svg viewBox="0 0 18 18"><path fill="currentColor" fill-rule="evenodd" d="M9 2a7 7 0 1 1 0 14A7 7 0 0 1 9 2zm-.9 3.2v4.4l3.3 2 .8-1.3-2.6-1.6V5.2z"/></svg>',
};
const stTile = t => { const c = catOf(t); return h('span', { class: 'tile st-' + c, 'aria-hidden': 'true', html: ST_TILE[c] || ST_TILE.unstarted }); };
const whoTile = p => h('span', { class: 'tile who', 'aria-hidden': 'true', text: initials(p) });
function turnCard(t, { lead, sub } = {}) {
  const d = dueInfo(t); const pj = S.projects.find(p => p.id === t.project_id); const st = stOf(t.status_id);
  const line = sub || [pj?.name, st?.name].filter(Boolean).join(' · ');
  const r = h('button', { class: 'row tc' + (isClosed(t) ? ' closed' : ''), 'data-id': t.id, onclick: () => openTask(t.id) }, lead || stTile(t),
    h('span', { class: 'tt' }, h('b', { text: t.title || 'Untitled' }), h('span', {}, line, d && !sub ? h('span', { class: d.over ? 'over' : '', text: (line ? ' · ' : '') + (d.over ? 'was due ' : 'due ') + d.label.toLowerCase() }) : null)),
    (t.files || []).length ? h('span', { class: 'meta', title: 'Attachments', 'aria-label': `${t.files.length} attachments` }, icon('clip', 12), String(t.files.length)) : null);
  if (isPhone()) longPress(r, () => quickMove(r, t));
  return r;
}
function viewMyTurn() {
  const mine = S.tasks.filter(t => turnIsMine(t));
  const now = mine.filter(t => catOf(t) !== 'backlog').sort((a, b) => ((a.priority || 9) - (b.priority || 9)) || (a.turn_since || '').localeCompare(b.turn_since || ''));
  const upcoming = mine.filter(t => catOf(t) === 'backlog');
  const waiting = S.tasks.filter(t => !isClosed(t) && !turnIsMine(t) && (t.assignee_id === uid() || t.created_by === uid() || t.reviewer_id === uid())).sort(SORTS.turnage);
  const late = mine.filter(t => dueInfo(t)?.over).length; const team = waitingOnMe().length;
  const m = me(); const hr = new Date().getHours();
  const hello = `${hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'}, ${first(m)}`;
  const day = new Date().toLocaleDateString(UI_LOC, { weekday: 'long', day: 'numeric', month: 'short' });
  const jump = sel => () => { const el = $(sel); if (!el) return; el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1300); };
  const stat = (n, label, sel, cls) => h(n ? 'button' : 'div', { class: 'tstat' + (cls ? ' ' + cls : '') + (n ? '' : ' zero'), onclick: n ? jump(sel) : null }, h('b', { text: String(n) }), h('span', { text: label }));
  const hero = h('header', { class: 'thero' }, h('div', { class: 'hrow' },
    h('div', { style: { minWidth: '0', flex: '1' } }, h('h1', { class: 'ptitle', text: hello }), h('div', { class: 'thsub', text: day })),
    isPhone() ? h('button', { class: 'x gsearch-m', 'data-gsearch': '1', 'aria-label': 'Search', title: 'Search', onclick: () => cmdk.open() }, icon('search', 22)) : null,
    isPhone() ? bellButton() : h('button', { class: 'btn pri', onclick: () => openCreate() }, icon('plus', 16), 'New task')));
  const stats = h('div', { class: 'tstats' }, stat(now.length, now.length === 1 ? 'your task' : 'your tasks', '[data-tour="turn-now"]'),
    stat(team, 'team waiting', '.waitsec'), stat(late, 'late', '[data-tour="turn-now"]', late ? 'late' : ''));
  const sec = (title, list, tourKey, emptyTxt, card) => h('section', { class: 'tsec', 'data-tour': tourKey },
    h('h3', {}, title, list.length ? h('span', { class: 'ct', text: String(list.length) }) : null),
    list.length ? h('div', { class: 'tlist' }, list.map(card || (t => turnCard(t)))) : h('div', { class: 'colempty', text: emptyTxt }));
  const withWho = t => { const o = t.turn_owner === 'admins' ? null : prof(t.turn_owner);
    return turnCard(t, { lead: o ? whoTile(o) : stTile(t), sub: `With ${o ? first(o) : t.turn_owner === 'admins' ? 'an admin' : 'nobody yet'}${t.turn_since ? ' · ' + ago(t.turn_since) : ''}` }); };
  // a team of one: a quiet nudge to bring the others in (until someone joins, or the admin hides it)
  const lonely = isAdmin() && S.members.length < 2 && !S.invites.length && !store.get('hideInviteNudge.' + S.ws.id, false) ? h('div', { class: 'info invite-nudge', role: 'note' },
    h('span', { text: 'It’s just you here so far. Ovrto works best when the whole team is in.' }),
    h('button', { class: 'btn sm pri', onclick: () => openSettings('workspace', 'invites') }, icon('invite', 14), 'Invite teammates'),
    h('button', { class: 'x', 'aria-label': 'Hide', onclick: () => { store.set('hideInviteNudge.' + S.ws.id, true); render(); } }, icon('x', 14))) : null;
  const top = [hero, stats, tellBar(), agentCard(), leaveBanners(), waitingSection(), lonely];
  if (!S.tasks.length) return [h('div', { class: 'scroll turnpage' }, ...top, h('div', { 'data-tour': 'turn-now' }, emptyState('0 TASKS', 'Clear ground. Add the first task.', { label: 'New task', fn: () => openCreate() }, { label: 'Import from a file', fn: () => openImport() })))];
  return [h('div', { class: 'scroll turnpage' }, ...top,
    now.length ? sec('Your tasks', now, 'turn-now') : h('div', { 'data-tour': 'turn-now' }, emptyState('YOUR MOVE · 0', 'No tasks of yours right now.', { label: 'See the board', fn: () => go({ v: 'work' }) })),
    sec('Waiting on others', waiting, 'turn-waiting', 'You haven’t handed anything to anyone', withWho),
    upcoming.length ? sec('Upcoming', upcoming, null) : null)];
}

/* ── Review (deck on phone, queue on desktop) ── */
let reviewIdx = 0;
function reviewQueue() {
  const tf = S.ws.tier_field ? fdOf(S.ws.tier_field) : null; const rank = { critical: 0, standard: 1, low: 2 };
  return S.tasks.filter(t => catOf(t) === 'review').sort((a, b) => {
    const ta = tf ? rank[(a.fields || {})[tf.id]] ?? 3 : 3; const tb = tf ? rank[(b.fields || {})[tf.id]] ?? 3 : 3;
    return (ta - tb) || (a.turn_since || '').localeCompare(b.turn_since || '');
  });
}
function viewReview() {
  const q = reviewQueue(); reviewIdx = Math.min(reviewIdx, Math.max(0, q.length - 1)); track('review_list');
  const head = pageHead('Review', h('span', { text: q.length ? `${q.length} waiting · most urgent first` : '' }),
    isPhone() ? null : h('span', { class: 'sm mute' }, h('kbd', { text: 'J' }), ' ', h('kbd', { text: 'K' }), ' move · ', h('kbd', { text: 'P' }), ' approve · ', h('kbd', { text: 'B' }), ' send back'));
  if (!q.length) return [head, h('div', { class: 'scroll' }, emptyState('QUEUE · 0', 'Review queue is clear.', null))];
  // every waiting task in one list (phone too): open any of them, pass or send back from the row
  const ph = isPhone();
  const rk = 'review:rv'; if ((SHOWN.get(rk) || 100) <= reviewIdx) SHOWN.set(rk, reviewIdx + 50); /* J/K never lands on an undrawn row */
  return [head, h('div', { class: 'scroll' }, h('div', { class: 'list rv-list', 'data-tour': 'review-list' }, capped(q.map((t, i) => [t, i]), ([t, i]) => {
    const r = taskRow(t); if (i === reviewIdx && !ph) r.classList.add('sel');
    const acts = canReview(t) ? h('span', { class: 'rv-acts' },
      h('button', { class: 'btn sm', onclick: e => { e.stopPropagation(); sendBack(t); } }, icon('back', 14), 'Send back'),
      h('button', { class: 'btn sm pri', onclick: e => { e.stopPropagation(); passTask(t); } }, icon('pass', 14), 'Approve'))
      : h('span', { class: 'rv-acts sm mute', text: `${first(prof(reviewerOf(t))) || 'An admin'} reviews this` });
    return h('div', { class: 'rv-item' }, r, acts);
  }, 'rv')))];
}
function reviewDeck(q) {
  const wrap = h('div', { 'data-tour': 'review-deck' });
  const deck = h('div', { class: 'deck' });
  const t = q[reviewIdx]; const next = q.slice(reviewIdx + 1, reviewIdx + 3);
  next.slice().reverse().forEach((n, i) => deck.append(deckCard(n, next.length - i === 2 ? 'under2' : 'under')));
  const top = deckCard(t, ''); deck.append(top);
  // swipe
  let x0 = null, dx = 0;
  top.addEventListener('pointerdown', e => { if (e.target.closest('button,a,input')) return; x0 = e.clientX; top.setPointerCapture(e.pointerId); top.style.transition = 'none'; });
  top.addEventListener('pointermove', e => { if (x0 == null) return; dx = e.clientX - x0; top.style.transform = `translateX(${dx}px) rotate(${dx / 30}deg)`; $('.stamp.pass', top).style.opacity = Math.max(0, dx / 120); $('.stamp.back', top).style.opacity = Math.max(0, -dx / 120); });
  const end = () => { if (x0 == null) return; x0 = null; top.style.transition = 'transform .2s'; if (dx > 110) { top.style.transform = 'translateX(120%) rotate(12deg)'; setTimeout(() => passTask(t), 150); } else if (dx < -110) { top.style.transform = 'translateX(-120%) rotate(-12deg)'; setTimeout(() => sendBack(t, () => { top.style.transform = ''; }), 150); } else { top.style.transform = ''; $$('.stamp', top).forEach(s => s.style.opacity = 0); } dx = 0; };
  top.addEventListener('pointerup', end); top.addEventListener('pointercancel', end);
  wrap.append(h('div', { class: 'hsub', style: { justifyContent: 'center', paddingTop: '10px' } }, h('span', { class: 'mono sm', text: `${reviewIdx + 1} / ${q.length}` })), deck,
    h('div', { class: 'deckbtns' },
      h('button', { class: 'btn lg', onclick: () => sendBack(t) }, icon('back'), 'Send back'),
      h('button', { class: 'btn lg ghost', 'aria-label': 'Skip for now', onclick: () => { reviewIdx = (reviewIdx + 1) % q.length; render(); } }, 'Skip'),
      h('button', { class: 'btn lg pri', onclick: () => passTask(t) }, icon('pass'), 'Approve')));
  return wrap;
}
function deckCard(t, cls) {
  const ty = tyOf(t.type_id); const tf = S.ws.tier_field ? fdOf(S.ws.tier_field) : null; const tier = tf ? optOf(tf, (t.fields || {})[tf.id]) : null;
  const secs = parseSections(t.description);
  return h('article', { class: 'dcard ' + cls, 'aria-label': t.title },
    h('span', { class: 'stamp pass', text: 'Approve' }), h('span', { class: 'stamp back', text: 'Send back' }),
    h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } }, plate(t, true), typeChip(ty), tier ? tag(tier.label + ' tier', tier.color) : null, t.sendbacks ? h('span', { class: 'meta red' }, icon('ret', 12), `${t.sendbacks}×`) : null),
    h('h3', { style: { margin: '0', font: '700 20px/26px var(--ui)' }, text: t.title }),
    h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, avatar(prof(t.assignee_id), { size: 'lg' }), h('span', { class: 'sm fg2', text: `${first(prof(t.assignee_id))} · in review ${ago(t.turn_since)}` })),
    h('div', { class: 'body md', html: secs.map(s => (s.h ? `<p><b>${esc(s.h)}</b></p>` : '') + md(s.body)).join('') || '<p class="mute">No description.</p>' }),
    h('button', { class: 'btn sm ghost', onclick: () => openTask(t.id) }, 'Open details'));
}
function tierGates(t) {
  const tf = S.ws.tier_field ? fdOf(S.ws.tier_field) : null; if (!tf) return { items: [], tier: null };
  const tierId = (t.fields || {})[tf.id]; const items = (S.ws.gates || {})[tierId] || [];
  return { items, tier: optOf(tf, tierId) };
}
function passTask(t, note, skipCause) {
  if (!canReview(t)) return toast(`Only ${first(prof(reviewerOf(t))) || 'the reviewer'} or an admin can approve this`);
  const { items, tier } = tierGates(t); const checked = new Set(t.gate_checks || []);
  const missing = items.filter(i => !checked.has(i));
  if (missing.length) return openGates(t, () => passTask(taskOf(t.id), note));
  const done = firstStatus('done'); if (!done) return toast('Add a Done status in Settings first');
  if (!skipCause && causeFirst(t, () => passTask(taskOf(t.id), note, true))) return; // a bug: ask what caused it, once
  const prev = { status_id: t.status_id };
  patchTask(t.id, { status_id: done.id }, { noUndo: true }).then(ok => {
    if (!ok) return; if (note) addComment(t.id, '✓ Passed review: ' + note);
    toast('Approved — moved to Done', { label: 'Undo', fn: () => patchTask(t.id, prev) }); render();
  });
}
function openGates(t, after) {
  const { items, tier } = tierGates(t); const critical = /critical/i.test(tier?.label || '');
  openSheet({ title: `${tier?.label || ''} checklist · ${taskKey(t)}`, kind: 'center', stack: !!currentSheet(), build: sh => {
    const body = h('div', { class: 'sbody' }); const sel = new Set(t.gate_checks || []);
    const passBtn = h('button', { class: 'btn pri' }, 'Approve');
    const upd = () => { passBtn.disabled = items.some(i => !sel.has(i)); };
    body.append(h('p', { class: 'note', text: critical ? 'Critical work can’t be approved until every check is ticked.' : 'Tick each check this task has been through.' }),
      ...items.map(i => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: sel.has(i), onchange: e => { e.target.checked ? sel.add(i) : sel.delete(i); upd(); } }), h('span', { text: i }))));
    passBtn.addEventListener('click', async () => { await patchTask(t.id, { gate_checks: [...sel] }, { noUndo: true }); closeSheet(true); after(); });
    upd();
    sh.append(body, h('div', { class: 'sfoot' }, !critical ? h('button', { class: 'btn ghost', onclick: async () => { await patchTask(t.id, { gate_checks: [...sel] }, { noUndo: true }); closeSheet(true); const done = firstStatus('done'); patchTask(t.id, { status_id: done.id }, { toast: 'Approved without all checks — moved to Done' }); } }, 'Approve anyway') : null, h('span', { class: 'sp' }),
      h('button', { class: 'btn', onclick: async () => { await patchTask(t.id, { gate_checks: [...sel] }, { noUndo: true }); closeSheet(); } }, 'Save checks'), passBtn));
  } });
}
function sendBack(t, onCancel) {
  if (!canReview(t)) { onCancel?.(); return toast(`Only ${first(prof(reviewerOf(t))) || 'the reviewer'} or an admin can send this back`); }
  let done = false;
  openSheet({ title: `Send back ${taskKey(t)}`, kind: 'center', stack: !!currentSheet(), onClose: () => { if (!done) onCancel?.(); }, build: sh => {
    const ta = autoGrow(h('textarea', { id: 'sendbackReason', placeholder: 'What needs to change? This becomes a comment for the developer.', rows: '3', style: { width: '100%' } }));
    const reg = h('input', { type: 'checkbox', id: 'markRegression', checked: false });
    const go_ = h('button', { class: 'btn pri', disabled: true }, 'Send back');
    ta.addEventListener('input', () => { go_.disabled = !ta.value.trim(); });
    setTimeout(() => ta.focus(), 80); // ready to type the reason
    go_.addEventListener('click', async () => {
      const reason = ta.value.trim(); if (!reason) return; done = true;
      const started = firstStatus('started') || defaultStatus(); const flags = new Set(t.flags || []); if (reg.checked) flags.add('regression');
      closeSheet(true);
      await addComment(t.id, '↺ Sent back: ' + reason);
      await patchTask(t.id, { status_id: started.id, sendbacks: (t.sendbacks || 0) + 1, flags: [...flags], gate_checks: [] }, { noUndo: true });
      toast(`Sent back to ${first(prof(t.assignee_id))}`); render();
    });
    sh.append(h('div', { class: 'sbody' }, h('label', { class: 'field' }, 'Reason (required)', ta), h('label', { class: 'check' }, reg, h('span', {}, 'Mark as regression (it worked before and broke)'))),
      h('div', { class: 'sfoot' }, h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), go_));
    setTimeout(() => ta.focus(), 50);
  } });
}

/* ── Inbox ── */
function inboxGroups() {
  const now = Date.now(); const by = new Map();
  for (const n of S.notifs) {
    if (n.snoozed_until && new Date(n.snoozed_until) > now) continue;
    if (!n.task_id || !taskOf(n.task_id)) continue;
    if (!by.has(n.task_id)) by.set(n.task_id, []); by.get(n.task_id).push(n);
  }
  return [...by.entries()].map(([tid, list]) => ({ t: taskOf(tid), list: list.sort((a, b) => b.created_at.localeCompare(a.created_at)) }))
    .sort((a, b) => b.list[0].created_at.localeCompare(a.list[0].created_at));
}
const REASON = { turn: 'Your turn', mention: 'Mentioned', updated: 'Updated', fyi: 'FYI' };
function notifLine(n) {
  const who = first(prof(n.actor_id)) || 'Someone'; const t = taskOf(n.task_id); const key = t ? taskKey(t) : '';
  switch (n.kind) {
    case 'assigned': return `${who} handed you ${key}`;
    case 'client': return `${n.detail || t?.client_report?.name || 'A client'} reported ${key}`;
    case 'review': return `${who} sent ${key} to you for review`;
    case 'decision': return `${key} needs a decision`;
    case 'mention': return `${who} mentioned you`;
    case 'comment': return `${who} commented`;
    case 'status': return `${who} moved it to ${n.detail || 'a new status'}`;
    case 'waiting': return `${who} is waiting on you`;
    case 'retest': return `Please retest. It is on`;
    default: return `${who} updated ${key}`;
  }
}
function viewInbox() {
  const groups = inboxGroups(); const unread = groups.filter(g => g.list.some(n => !n.read_at));
  const head = pageHead('Notifications', h('span', { text: unread.length ? `${unread.length} unread` : '' }),
    unread.length ? h('button', { class: 'btn ghost', onclick: () => markRead(S.notifs.filter(n => !n.read_at).map(n => n.id)) }, 'Mark all read') : null);
  if (!groups.length) return [head, h('div', { class: 'scroll' }, emptyState('All caught up', 'Nothing needs you right now.', null), pushTip())];
  return [head, h('div', { class: 'scroll' }, pushTip(), h('div', { 'data-tour': 'inbox-list' }, groups.map(g => inboxRow(g))))];
}
function inboxRow({ t, list }) {
  const latest = list[0]; const unread = list.some(n => !n.read_at);
  const top = list.find(n => !n.read_at && (n.reason === 'turn' || n.reason === 'mention')) || latest;
  const row = h('button', { class: 'inrow' + (unread ? ' unread' : ''), onclick: () => openTask(t.id) },
    avatar(prof(top.actor_id), { size: 'lg' }),
    h('div', { class: 'b' },
      h('div', { class: 'ln1' }, h('span', { class: 'reason ' + top.reason, text: REASON[top.reason] || 'FYI' }), plate(t), h('span', { class: 't', text: t.title })),
      h('div', { class: 'ln2', text: notifLine(top) + (top.detail && top.kind !== 'status' && top.kind !== 'client' ? ': ' + top.detail : '') }),
      list.length > 1 ? h('div', { class: 'sm mute', text: `+${list.length - 1} more update${list.length > 2 ? 's' : ''}` }) : null),
    h('span', { class: 'meta', text: ago(latest.created_at) }));
  const wrap = h('div', { class: 'swipewrap' }, h('div', { class: 'swipebg', 'aria-hidden': 'true' }, h('span', { text: 'Done' }), h('span', { text: 'Snooze' })), row);
  // swipe: right = done (read), left = snooze menu
  let x0 = null, dx = 0;
  row.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; dx = 0; row.style.transition = 'none'; }, { passive: true });
  row.addEventListener('touchmove', e => { if (x0 == null) return; dx = e.touches[0].clientX - x0; if (Math.abs(dx) > 8) { row.style.transform = `translateX(${dx}px)`; $('.swipebg', wrap).style.background = dx > 0 ? 'var(--green)' : 'var(--amber)'; } }, { passive: true });
  row.addEventListener('touchend', () => {
    row.style.transition = 'transform .18s'; const d = dx; x0 = null; dx = 0; row.style.transform = '';
    if (d > 90) { row.dataset.swiped = '1'; markRead(list.map(n => n.id)); toast('Marked done'); }
    else if (d < -90) { row.dataset.swiped = '1'; snoozeMenu(row, list); }
  });
  row.addEventListener('click', e => { if (row.dataset.swiped) { e.preventDefault(); e.stopImmediatePropagation(); delete row.dataset.swiped; } }, true);
  if (!isPhone()) row.addEventListener('contextmenu', e => { e.preventDefault(); snoozeMenu(row, list); });
  return wrap;
}
function snoozeMenu(anchor, list) {
  const later = new Date(Date.now() + 3 * 3600e3); const tom = new Date(); tom.setDate(tom.getDate() + 1); tom.setHours(9, 0, 0, 0);
  menu(anchor, [{ header: 'Snooze until' }, { label: 'Later today', sub: later.toLocaleTimeString(UI_LOC, { hour: 'numeric', minute: '2-digit' }), fn: () => snooze(list, later) }, { label: 'Tomorrow', sub: '9:00', fn: () => snooze(list, tom) }, '-', { label: 'Mark done', fn: () => markRead(list.map(n => n.id)) }]);
}
async function snooze(list, until) {
  const iso = until.toISOString();
  for (const n of list) { n.snoozed_until = iso; write({ t: 'notifications', op: 'update', id: n.id, patch: { snoozed_until: iso } }); }
  render(); refreshSheet(); toast('Snoozed');
}
async function markRead(ids) {
  if (!ids.length) return; const ts = nowIso(); let any = false;
  for (const n of S.notifs) if (ids.includes(n.id) && !n.read_at) { n.read_at = ts; any = true; }
  if (!any) return;
  render(); refreshSheet();
  // one call per batch keeps it cheap
  try { await sb.from('notifications').update({ read_at: ts }).in('id', ids); } catch { for (const id of ids) S.outbox.push({ t: 'notifications', op: 'update', id, patch: { read_at: ts } }); persistOutbox(); }
}
function pushTip() {
  if (!('Notification' in window)) {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent); const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (ios && !standalone) return h('div', { class: 'section' }, h('div', { class: 'info' }, h('b', { text: 'Get alerts on your iPhone. ' }), 'In Safari tap Share → Add to Home Screen, then open ' + appName() + ' from your home screen.'));
    return null;
  }
  if (Notification.permission !== 'default' || S.prefs?.push === false) return null;
  return h('div', { class: 'section' }, h('div', { class: 'info', style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } },
    h('span', { style: { flex: '1 1 220px' }, text: 'Get an alert on this device when it’s your turn or someone mentions you.' }),
    h('button', { class: 'btn sm pri', onclick: () => enablePush(true) }, 'Turn on alerts')));
}

/* ── Notifications center (bell) ── */
let notifCtx = null;
function bellButton() {
  const n = badgeCount();
  return h('button', { class: 'x bell', 'data-nav': 'inbox', 'data-tour': 'bell', title: 'Notifications', 'aria-label': n ? `Notifications, ${n} unread` : 'Notifications', onclick: () => openNotifs() },
    icon('bell', 20), n ? h('span', { class: 'badge', text: n > 99 ? '99+' : String(n) }) : null);
}
function openNotifs() {
  if (notifCtx) return;
  notifCtx = { filter: S.notifs.some(n => !n.read_at && !(n.snoozed_until && new Date(n.snoozed_until) > Date.now())) ? 'unread' : 'all' };
  openSheet({ title: 'Notifications', kind: 'right', full: isPhone(), key: 'notifs', onClose: () => { notifCtx = null; }, build: sh => { sh.classList.add('notifs'); notifCtx.sh = sh; drawNotifs(); } });
  tours.request('inbox');
}
function drawNotifs() {
  const c = notifCtx; if (!c?.sh) return;
  const groups = inboxGroups(); const unreadG = groups.filter(g => g.list.some(n => !n.read_at));
  const shown = c.filter === 'unread' ? unreadG : groups;
  let body = $('.sbody', c.sh); const st = body?.scrollTop || 0; body?.remove();
  body = h('div', { class: 'sbody notif-body' });
  body.append(h('div', { class: 'notif-tools' },
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Show' },
      h('button', { 'aria-pressed': String(c.filter === 'unread'), onclick: () => { c.filter = 'unread'; drawNotifs(); } }, unreadG.length ? `Unread · ${unreadG.length}` : 'Unread'),
      h('button', { 'aria-pressed': String(c.filter === 'all'), onclick: () => { c.filter = 'all'; drawNotifs(); } }, 'All')),
    h('span', { class: 'sp' }),
    unreadG.length ? h('button', { class: 'btn sm ghost', onclick: () => markRead(S.notifs.filter(n => !n.read_at).map(n => n.id)) }, 'Mark all read') : null,
    h('button', { class: 'x', 'aria-label': 'Alert settings', title: 'Alert settings', onclick: () => openSettings('me', 'notify') }, icon('gear', 18))));
  const tip = pushTip(); if (tip) body.append(tip);
  if (!shown.length) body.append(emptyState('All caught up', c.filter === 'unread' ? 'Nothing needs you right now.' : 'When it’s your turn or someone mentions you, it shows up here.', null));
  else body.append(h('div', { class: 'notif-list', 'data-tour': 'inbox-list' }, shown.map(g => inboxRow(g))));
  c.sh.append(body); body.scrollTop = st;
}

/* ── More (phone): everything that lives in the sidebar on a computer ── */
function openMore() {
  const m = me();
  openSheet({ title: 'More', kind: 'right', key: 'more', build: sh => {
    const it = (ic, label, fn, extra) => h('button', { class: 'navi more-i', onclick: () => { closeSheet(true); fn(); } }, icon(ic), h('span', { class: 't', text: label }), extra || null);
    const n = badgeCount(); const pinned = v => morePins().includes(v);
    sh.append(h('div', { class: 'sbody more' },
      h('button', { class: 'more-me', onclick: () => { closeSheet(true); openSettings('me'); } }, avatar(m, { size: 'lg' }), h('span', { class: 'who' }, h('b', { text: dname(m) }), h('span', { class: 'sm mute', text: m?.email || '' })), icon('chev', 16)),
      morePins().length ? h('div', { class: 'more-g', 'data-dept-pins': '1' }, h('div', { class: 'more-h', text: 'Your pages' }), morePins().map(v => it(PAGE_ICON[v], PAGE_LABEL[v], () => go({ v }), v === 'approvals' && approvalsBadge() ? h('span', { class: 'badge', text: String(approvalsBadge()) }) : null))) : null,
      h('div', { class: 'more-g' },
        it('bell', 'Notifications', () => openNotifs(), n ? h('span', { class: 'badge', text: n > 99 ? '99+' : String(n) }) : null),
        canSeeSomeMoney() && !pinned('company') && !pageHidden('company') ? it('company', canSeeMoney() ? 'Company' : 'Hardware', () => go({ v: 'company' })) : null,
        dealsInMenu() && !pinned('deals') && !pageHidden('deals') ? it('deal', 'Deals', () => go({ v: 'deals' })) : null,
        pinned('projects') || pageHidden('projects') ? null : it('folder', 'Projects', () => go({ v: 'projects' })),
        pinned('approvals') ? null : it('check', 'Approvals', () => go({ v: 'approvals' }), approvalsBadge() ? h('span', { class: 'badge', text: String(approvalsBadge()) }) : null),
        inDept(myMember(), 'hr', 'management') || isAdmin() ? it('invite', 'Start onboarding', () => openOnboarding()) : null,
        ...['visits', 'tickets', 'devices', 'tests', 'incidents', 'stock'].filter(v => !pinned(v) && !pageHidden(v)).map(v => it(PAGE_ICON[v], PAGE_LABEL[v], () => go({ v }))),
        pinned('vault') || pageHidden('vault') ? null : it('key', 'Passwords', () => go({ v: 'vault' })),
        it('leave', 'Going on leave', () => openLeave()),
        canInvite() ? it('invite', 'Add members', () => openInviteSheet()) : null,
        isAdmin() && !pinned('insights') && !pageHidden('insights') ? it('chart', 'Insights', () => go({ v: 'insights' })) : null,
        isAdmin() ? it('export', 'Weekly report', () => openWeeklyReport()) : null,
        ownerAdmin ? it('mark', 'Ovrto owner', () => go({ v: 'owner' })) : null,
        hasHiddenPages() ? it(showAllPages() ? 'eye' : 'menu', showAllPages() ? 'Only my department’s pages' : 'Show all pages', () => toggleAllPages()) : null,
        it('upload', 'Import tasks', () => openImport()),
        it('export', 'Export', () => openExport())),
      h('div', { class: 'more-g' },
        isAdmin() ? it('gear', 'Workspace settings', () => openSettings('workspace')) : null,
        it('person', 'My settings', () => openSettings('me')),
        it('bell', 'Notifications & sounds', () => openSettings('me', 'notify')),
        h('button', { class: 'navi more-i', onclick: e => wsMenu(e.currentTarget) }, icon('folder'), h('span', { class: 't', text: 'Workspace' }), h('span', { class: 'n', text: S.ws.name })),
        it('help', 'Help & tours', () => openHelp())),
      h('div', { class: 'more-g' }, it('out', 'Sign out', () => signOut()))));
  } });
}

