/* ═════════════ core: config, helpers, state, data ═════════════ */
const CFG = { url: 'https://epictdzctjgbsctobejh.supabase.co', key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwaWN0ZHpjdGpnYnNjdG9iZWpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzk1NTIsImV4cCI6MjEwODYxNTU1Mn0.AOFai2W36-RmzBX7-4BCq-B9B7a4N5mXB3p0ziAUveE', vapid: 'BHAhUBWLL6hIw5rDG2GN0kWlD_oT1shU5nyTbuuIMsmzcJEfaDB2XT_9t91O7wiOyQ6vKxagG0ZFzret7I44Ldo', brand: 'Ovrto' };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (v[sk] == null) continue; if (sk.startsWith('--')) e.style.setProperty(sk, v[sk]); else e.style[sk] = v[sk]; } }
    else if (k === 'value') { e.value = v; if (tag === 'input' && attrs.type !== 'file') e.setAttribute('value', v); }
    else if (k === 'checked') e.checked = !!v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(9)) { if (c == null || c === false || c === '') continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return e;
}
const store = {
  get(k, d) { try { const v = localStorage.getItem('baton.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('baton.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('baton.' + k); } catch {} },
};
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const clone = o => JSON.parse(JSON.stringify(o));
const nowIso = () => new Date().toISOString();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '');
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const isPhone = () => matchMedia('(max-width:820px)').matches;
const isTyping = () => { const a = document.activeElement; if (!a) return false; if (a.tagName === 'INPUT') return !/^(checkbox|radio|button|submit|file|color|range)$/.test(a.type); return /^(TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable; };

/* ── "working on it" overlay: a request that starts right after a tap or Enter (or continues one) and takes
   over a second shows the animated Ovrto mark in the middle of the page, and holds taps until it's done,
   so nobody presses twice. Background work (sync, the offline outbox, live updates) never shows it. ── */
const WAIT = { n: 0, timer: null, el: null, shownAt: 0, gesture: 0, lastEnd: 0, quiet: 0, cap: null };
['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, e => {
  if (ev === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
  if (WAIT.el && e.target && WAIT.el.contains(e.target)) return;
  WAIT.gesture = Date.now();
}, true));
function waitShow() {
  if (WAIT.el) return;
  WAIT.el = h('div', { class: 'wait-ov', role: 'status', 'aria-live': 'polite' },
    h('div', { class: 'wait-card' }, h('div', { class: 'wait-mark loop', 'aria-hidden': 'true', html: ICONS.markAnim }), h('div', { class: 'wait-t', text: 'Working on it…' })));
  ['pointerdown', 'click', 'keydown'].forEach(ev => WAIT.el.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }));
  document.body.append(WAIT.el); WAIT.shownAt = Date.now();
  clearTimeout(WAIT.cap); WAIT.cap = setTimeout(() => { WAIT.n = 0; waitHide(true); }, 60000);
}
function waitHide(now) {
  clearTimeout(WAIT.timer); WAIT.timer = null;
  if (!WAIT.el) return;
  const el = WAIT.el, wait = now ? 0 : Math.max(0, 350 - (Date.now() - WAIT.shownAt));
  WAIT.el = null; clearTimeout(WAIT.cap);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 160); }, wait);
}
function trackedFetch(url, opts) {
  const t = Date.now(), u = String(url && url.url || url);
  const act = !WAIT.quiet && !/\/realtime\//.test(u) && (t - WAIT.gesture < 800 || WAIT.n > 0 || t - WAIT.lastEnd < 300);
  if (!act) return fetch(url, opts);
  WAIT.n++;
  if (!WAIT.el && !WAIT.timer) WAIT.timer = setTimeout(() => { WAIT.timer = null; if (WAIT.n > 0) waitShow(); }, 1000);
  const done = () => { WAIT.n = Math.max(0, WAIT.n - 1); WAIT.lastEnd = Date.now(); if (!WAIT.n) waitHide(); };
  return fetch(url, opts).then(r => { done(); return r; }, e => { done(); throw e; });
}
/* long work the app runs itself (many saves in a row): show the mark after a second too */
async function withWait(fn) {
  WAIT.n++;
  if (!WAIT.el && !WAIT.timer) WAIT.timer = setTimeout(() => { WAIT.timer = null; if (WAIT.n > 0) waitShow(); }, 1000);
  try { return await fn(); } finally { WAIT.n = Math.max(0, WAIT.n - 1); WAIT.lastEnd = Date.now(); if (!WAIT.n) waitHide(); }
}
const sb = supabase.createClient(CFG.url, CFG.key, { global: { fetch: (u, o) => trackedFetch(u, o) } });

/* ── state ── */
const S = {
  session: null, ws: null, wsList: [], members: [], profiles: {}, statuses: [], types: [], fields: [], rules: [],
  views: [], projects: [], leaves: [], deploys: [], deals: [], tasks: [], notifs: [], invites: [], channels: [], clientContacts: [], messages: [], reactions: [], reads: {}, huddles: [], prefs: null, loaded: false, online: navigator.onLine,
  route: store.get('route', { v: 'myturn' }), vc: null, selected: null, outbox: store.get('outbox', []),
};
const CATS = ['backlog', 'unstarted', 'started', 'review', 'done', 'canceled'];
const CAT_NAME = { backlog: 'Backlog', unstarted: 'Unstarted', started: 'Started', review: 'Review', done: 'Done', canceled: 'Canceled' };
const PRIOS = [{ k: 1, n: 'Urgent' }, { k: 2, n: 'High' }, { k: 3, n: 'Medium' }, { k: 4, n: 'Low' }, { k: 0, n: 'No priority' }];
const FLAGS = [
  { k: 'waiting', n: 'Waiting on client', c: '#B54708', help: 'Turn goes to the client until someone taps Client replied.' },
  { k: 'decision', n: 'Needs decision', c: '#8A5300', help: 'Turn goes to the admins until a decision is recorded.' },
  { k: 'regression', n: 'Regression', c: '#B42318', help: 'Came back after Done. Red edge on the card.' },
];
const ACCENTS = [
  { k: 'teal', n: 'Drafting Teal', l: '#0B6B70', d: '#4CC3BF' }, { k: 'orange', n: 'Safety Orange', l: '#B54708', d: '#FF9A52' },
  { k: 'cobalt', n: 'Cobalt Ink', l: '#2A44B0', d: '#8FA3FF' }, { k: 'green', n: 'Site Green', l: '#2F6A2F', d: '#7DCB6E' },
  { k: 'plum', n: 'Plum Mark', l: '#8A2C6E', d: '#F08ACB' }, { k: 'graphite', n: 'Graphite', l: '#3A4652', d: '#AEB9C4' },
];
const OPT_COLORS = ['#0B6B70', '#B54708', '#2A44B0', '#2F6A2F', '#8A2C6E', '#3A4652', '#B42318', '#8A5300', '#6A3FB5', '#1E6B3A'];
const KIND_NAME = { text: 'Text', number: 'Number', select: 'Single select', multi: 'Multi select', date: 'Date', person: 'Person', checkbox: 'Checkbox' };

/* ── lookups ── */
const uid = () => S.session?.user?.id;
const me = () => S.profiles[uid()];
const member = id => S.members.find(m => m.user_id === id);
const isAdmin = () => member(uid())?.role === 'admin';
const prof = id => (id ? S.profiles[id] : null);
const dname = p => (p ? (p.full_name || p.email?.split('@')[0] || 'Someone') : 'Unassigned');
const first = p => dname(p).split(/\s+/)[0];
const initials = p => dname(p).split(/[\s._-]+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const stOf = id => S.statuses.find(s => s.id === id);
const tyOf = id => S.types.find(t => t.id === id);
const fdOf = id => S.fields.find(f => f.id === id);
const fdKey = k => S.fields.find(f => f.key === k);
const pjOf = id => S.projects.find(p => p.id === id);
const taskOf = id => S.tasks.find(t => t.id === id);
const catOf = t => stOf(t.status_id)?.category || 'unstarted';
const isClosed = t => ['done', 'canceled'].includes(catOf(t));
const isBug = t => !!tyOf(t.type_id)?.is_bug;
const prioName = k => PRIOS.find(p => p.k === k)?.n || 'No priority';
const sortedStatuses = () => S.statuses.slice().sort((a, b) => a.position - b.position);
const firstStatus = cat => sortedStatuses().find(s => s.category === cat);
const defaultStatus = () => S.statuses.find(s => s.is_default) || firstStatus('unstarted') || sortedStatuses()[0];
const taskKey = t => `${S.ws?.prefix || 'TSK'}-${t.number ?? '…'}`;
const appName = () => S.ws?.app_name || CFG.brand;
const optOf = (f, id) => (f?.options || []).find(o => o.id === id);
const fieldVal = (t, f) => (t.fields || {})[f.id];
const fieldApplies = (f, t) => (!f.type_ids?.length || f.type_ids.includes(t.type_id)) && (!f.project_ids?.length || f.project_ids.includes(t.project_id));
const hasVal = v => !(v == null || v === '' || (Array.isArray(v) && !v.length) || v === false);

/* ── sprints ── */
function sprintOf(date = new Date()) {
  if (!S.ws) return 1;
  const start = new Date(S.ws.sprint_start + 'T00:00:00'); const len = S.ws.sprint_len || 14;
  return Math.max(1, Math.floor((date - start) / 864e5 / len) + 1);
}
function sprintRange(n) {
  const start = new Date(S.ws.sprint_start + 'T00:00:00'); const len = S.ws.sprint_len || 14;
  const a = new Date(start.getTime() + (n - 1) * len * 864e5); const b = new Date(a.getTime() + (len - 1) * 864e5);
  return [a, b];
}
const sprintLabel = n => (n ? `Sprint ${n}` : 'No sprint');

/* ── time ── */
function ago(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'now'; if (s < 3600) return Math.floor(s / 60) + 'm'; if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}
const fmtDate = d => (d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString(UI_LOC, { month: 'short', day: 'numeric' }) : '');
const fmtDT = d => new Date(d).toLocaleString(UI_LOC, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
function dueInfo(t) {
  if (!t.due_date) return null;
  const d = new Date(t.due_date + 'T00:00:00'); const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 864e5);
  const label = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : fmtDate(t.due_date);
  return { label, over: diff < 0 && !isClosed(t) };
}
function localTime(tz) { try { return new Date().toLocaleTimeString(UI_LOC, { hour: '2-digit', minute: '2-digit', timeZone: tz }); } catch { return ''; } }
const myTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/* ── turn (mirrors the database rule so the screen updates instantly) ── */
function computeTurn(t) {
  const flags = t.flags || [];
  if (flags.includes('waiting')) return 'client';
  if (flags.includes('decision')) return 'admins';
  const c = catOf(t);
  if (c === 'done' || c === 'canceled') return null;
  if (c === 'review') return t.reviewer_id || S.ws?.default_reviewer || null;
  return t.assignee_id || null;
}
function turnIsMine(t) { const o = t.turn_owner; return o && (o === uid() || (o === 'admins' && isAdmin())); }
function turnName(o) { if (!o) return 'Nobody'; if (o === 'client') return 'Client'; if (o === 'admins') return 'Admins'; return dname(prof(o)); }

/* ── routing (mirrors the database rule) ── */
function routeFor(t) {
  const ty = tyOf(t.type_id); if (!ty?.auto_route) return null;
  const rules = S.rules.slice().sort((a, b) => a.position - b.position);
  for (const r of rules) {
    if (r.type_id && r.type_id !== t.type_id) continue;
    if (!r.field_id) return { user: r.user_id, why: 'default rule' };
    const v = (t.fields || {})[r.field_id];
    if (v === r.option_id || (Array.isArray(v) && v.includes(r.option_id))) {
      const f = fdOf(r.field_id); return { user: r.user_id, why: `${optOf(f, r.option_id)?.label || 'match'} rule` };
    }
  }
  if (ty.is_bug && S.ws?.bug_owner) return { user: S.ws.bug_owner, why: 'bug owner' };
  return null;
}

/* ── errors ── */
function errText(e) {
  const m = e?.message || String(e);
  if (/not been invited|Database error saving new user/i.test(m)) return 'This email hasn’t been invited, or the invite expired. Ask an admin for a new one.';
  if (/Invalid login credentials/i.test(m)) return 'Email or password is incorrect.';
  if (/Email not confirmed/i.test(m)) return 'Confirm your email first. Check your inbox.';
  if (/already registered/i.test(m)) return 'This email already has an account. Sign in instead.';
  if (/row-level security|permission|violates/i.test(m)) return 'You don’t have permission to do that.';
  if (/at least one admin/i.test(m)) return 'The workspace needs at least one admin.';
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) return 'Can’t reach the server. Check your connection.';
  return m;
}
const isNetErr = e => /Failed to fetch|NetworkError|Load failed|network|fetch/i.test(e?.message || String(e)) || !navigator.onLine;

/* ── data loading ── */
const WS_TABLES = ['statuses', 'task_types', 'fields', 'routing_rules', 'views', 'projects', 'tasks', 'invites', 'leaves', 'deploys', 'deals'];
const LOCAL = { statuses: 'statuses', task_types: 'types', fields: 'fields', routing_rules: 'rules', views: 'views', projects: 'projects', tasks: 'tasks', invites: 'invites', leaves: 'leaves', deploys: 'deploys', deals: 'deals' };
const ORDER = { statuses: 'position', task_types: 'position', fields: 'position', routing_rules: 'position', views: 'position', projects: 'created_at', tasks: 'number', invites: 'created_at', leaves: 'start_date', deploys: 'at', deals: 'created_at' };

async function loadTable(t) {
  if (!S.ws) return;
  const ws = S.ws.id;
  const { data, error } = await sb.from(t).select('*').eq('workspace_id', ws).order(ORDER[t], { ascending: true });
  if (S.ws?.id !== ws) return; // switched workspace while this was loading
  if (error) { if (t === 'invites' || t === 'leaves' || t === 'deploys' || t === 'deals') S[LOCAL[t]] = []; return; }
  S[LOCAL[t]] = data || [];
}
async function loadMembers() {
  const ws = S.ws.id;
  const [{ data: mem }, { data: profs }] = await Promise.all([
    sb.from('workspace_members').select('*').eq('workspace_id', ws),
    sb.from('profiles').select('*'),
  ]);
  if (S.ws?.id !== ws) return;
  if (mem) S.members = mem;
  if (profs) { S.profiles = {}; for (const p of profs) S.profiles[p.id] = p; }
}
async function loadNotifs() {
  const ws = S.ws?.id;
  const { data, error } = await sb.from('notifications').select('*').eq('user_id', uid()).order('created_at', { ascending: false }).limit(300);
  if (S.ws?.id !== ws) return;
  if (!error && data) S.notifs = data.filter(n => !n.workspace_id || n.workspace_id === S.ws?.id);
}
async function loadWorkspaces() {
  const { data } = await sb.from('workspaces').select('*').order('created_at', { ascending: true });
  S.wsList = data || [];
}
async function loadPrefs() {
  const { data } = await sb.from('prefs').select('*').eq('user_id', uid()).maybeSingle();
  if (data) S.prefs = data;
  else {
    S.prefs = { user_id: uid(), theme: 'system', density: 'comfortable', default_view: 'myturn', layout: 'board', tours: {}, tours_off: false, push: true, data_saver: false, last_workspace: null };
    await sb.from('prefs').upsert(S.prefs);
  }
}
async function loadAll() {
  const ws = S.ws?.id;
  await Promise.all([loadMembers(), ...WS_TABLES.map(loadTable), loadNotifs(), loadChat()]);
  if (S.ws?.id !== ws) return;
  S.loaded = true; snapshot();
}
const snapshot = debounce(() => {
  if (!S.ws) return;
  store.set('snap.' + S.ws.id, { members: S.members, profiles: S.profiles, statuses: S.statuses, types: S.types, fields: S.fields, rules: S.rules, views: S.views, projects: S.projects, tasks: S.tasks, notifs: S.notifs, invites: S.invites, channels: S.channels, messages: S.messages.slice(-800), reactions: S.reactions, reads: S.reads, huddles: S.huddles });
}, 800);
function restoreSnapshot(wsId) {
  const s = store.get('snap.' + wsId, null); if (!s) return false;
  Object.assign(S, s); S.loaded = true; return true;
}

/* ── writes with offline outbox ── */
function persistOutbox() { store.set('outbox', S.outbox); renderPill(); }
async function exec(op) {
  WAIT.quiet++; try { return await execNow(op); } finally { WAIT.quiet--; }
}
async function execNow(op) {
  let q = sb.from(op.t);
  if (op.op === 'insert') q = q.insert(op.row).select().single();
  else if (op.op === 'upsert') q = q.upsert(op.row).select();
  else if (op.op === 'update') q = q.update(op.patch).eq(op.key || 'id', op.id).select();
  else if (op.op === 'delete') q = q.delete().eq(op.key || 'id', op.id);
  return await q;
}
async function write(op) {
  // offline, or older changes still waiting: queue so changes land in the order they were made
  if (!navigator.onLine || S.outbox.length) { S.outbox.push(op); persistOutbox(); if (navigator.onLine) flushOutbox(); return { queued: true }; }
  try {
    const r = await exec(op);
    if (r.error) {
      if (op.op === 'insert' && /duplicate key/i.test(r.error.message)) return { data: null };
      if (isNetErr(r.error)) { S.outbox.push(op); persistOutbox(); return { queued: true }; }
      return { error: r.error };
    }
    return { data: r.data };
  } catch (e) {
    if (isNetErr(e)) { S.outbox.push(op); persistOutbox(); return { queued: true }; }
    return { error: e };
  }
}
let flushing = false;
async function flushOutbox() {
  if (flushing || !S.outbox.length || !navigator.onLine) return;
  flushing = true; let failed = 0, saved = 0;
  while (S.outbox.length && navigator.onLine) {
    const op = S.outbox[0];
    try {
      const r = await exec(op);
      if (r.error && isNetErr(r.error)) break;
      if (r.error && !(op.op === 'insert' && /duplicate key/i.test(r.error.message || ''))) failed++; else saved++;
      S.outbox.shift(); persistOutbox();
    } catch (e) { if (isNetErr(e)) break; failed++; S.outbox.shift(); persistOutbox(); }
  }
  flushing = false;
  if (!S.outbox.length && (saved || failed)) {
    if (failed) toast(`${failed} change${failed === 1 ? '' : 's'} couldn’t be saved (someone may have changed or removed ${failed === 1 ? 'it' : 'them'}). Showing the latest.`, null, 8000);
    else toast('All changes saved');
    refreshData();
  }
}
addEventListener('online', () => { S.online = true; renderPill(); flushOutbox(); });
addEventListener('offline', () => { S.online = false; renderPill(); });
setInterval(flushOutbox, 15000);

/* ── task mutations (optimistic) ── */
function applyLocal(t) {
  const prevTurn = t.turn_owner;
  t.turn_owner = computeTurn(t);
  if (t.turn_owner !== prevTurn) t.turn_since = nowIso();
  t.updated_at = nowIso();
}
async function patchTask(id, patch, opts = {}) {
  const t = taskOf(id); if (!t) return;
  if (reviewLocked(t)) { toast(lockText(t)); return false; }
  if ('status_id' in patch && patch.status_id !== t.status_id && !canMoveStatus(t)) { toast(statusLockText(t)); refresh(); return false; }
  const prev = {}; for (const k in patch) prev[k] = clone(t[k] ?? null);
  Object.assign(t, clone(patch)); applyLocal(t); refresh();
  const r = await write({ t: 'tasks', op: 'update', id, patch });
  if (r.error) { Object.assign(t, prev); applyLocal(t); refresh(); toast(errText(r.error)); return false; }
  if (r.data && r.data[0]) Object.assign(t, r.data[0]);
  refresh(); snapshot();
  const fixedForClient = 'status_id' in patch && t.client_report?.phone && catOf(t) === 'done' && stOf(prev.status_id)?.category !== 'done';
  // a client reported it: once it is done, offer to tell them on WhatsApp (after the caller's own toast, so its Undo stays)
  if (fixedForClient) setTimeout(() => toast(`${taskKey(t)} is done. Tell ${String(t.client_report.name || 'the client').split(' ')[0]} on WhatsApp?`, { label: 'WhatsApp', fn: () => clientFixedWhatsApp(taskOf(id) || t) }, 12000, true), 60);
  if (opts.toast) toast(opts.toast, opts.noUndo ? null : { label: 'Undo', fn: () => patchTask(id, prev) });
  return true;
}
/* software teams talk about developers and sprints; agencies and other teams just have an owner */
function softwareTeam() { return !['agency', 'general'].includes(S.ws?.template); }
function devWord() { return softwareTeam() ? ', developer ' : ', assigned to '; }
function usesSprints() { return softwareTeam(); }
async function createTask(row, opts = {}) {
  row = Object.assign({ id: uuid(), workspace_id: S.ws.id, title: '', description: '', priority: 0, flags: [], fields: {}, checklist: [], gate_checks: [], created_by: uid(), created_at: nowIso(), updated_at: nowIso(), sendbacks: 0 }, row);
  if (!row.status_id) row.status_id = tyOf(row.type_id)?.default_status || defaultStatus()?.id;
  if (!row.reviewer_id) row.reviewer_id = S.ws.default_reviewer || null;
  if (!row.assignee_id) { const r = routeFor(row); if (r) row.assignee_id = r.user; }
  if (!row.assignee_id && S.members.length === 1) row.assignee_id = uid(); // a team of one: it's your turn, not nobody's
  const local = Object.assign({ number: null }, clone(row)); applyLocal(local); local.turn_since = nowIso();
  S.tasks.push(local); refresh();
  const r = await write({ t: 'tasks', op: 'insert', row });
  if (r.error) { S.tasks = S.tasks.filter(x => x.id !== row.id); refresh(); toast(errText(r.error)); return null; }
  if (r.data) Object.assign(local, r.data);
  refresh(); snapshot();
  if (opts.cleanFranco && looksFranco(row.title + ' ' + (row.description || ''))) cleanFranco(local).catch(() => {});
  return local;
}
async function deleteTask(id) {
  const t = taskOf(id); if (!t) return;
  if (reviewLocked(t)) { toast(lockText(t)); return false; }
  S.tasks = S.tasks.filter(x => x.id !== id); refresh();
  const r = await write({ t: 'tasks', op: 'delete', id });
  if (r.error) { S.tasks.push(t); refresh(); toast(errText(r.error)); return false; }
  toast(`${taskKey(t)} deleted`); return true;
}
async function addComment(taskId, body, mentions = [], meta = {}) {
  const row = { id: uuid(), task_id: taskId, author_id: uid(), body, mentions, created_at: nowIso() };
  const r = await write({ t: 'comments', op: 'insert', row });
  if (r.error) { toast(errText(r.error)); return null; }
  return row;
}
async function savePrefs(patch) {
  Object.assign(S.prefs, patch); applyTheme();
  await write({ t: 'prefs', op: 'upsert', row: Object.assign({}, S.prefs) });
}
async function saveWs(patch, msg) {
  const prev = {}; for (const k in patch) prev[k] = S.ws[k];
  Object.assign(S.ws, patch); applyTheme(); refresh();
  const r = await write({ t: 'workspaces', op: 'update', id: S.ws.id, patch });
  if (r.error) { Object.assign(S.ws, prev); applyTheme(); refresh(); toast(errText(r.error)); return false; }
  if (msg) toast(msg); return true;
}
/* generic config writes (statuses, types, fields, rules, projects, views) */
async function cfgUpsert(table, row, msg) {
  const list = S[LOCAL[table]]; const i = list.findIndex(x => x.id === row.id);
  const prev = i >= 0 ? clone(list[i]) : null;
  if (i >= 0) list[i] = Object.assign(list[i], row); else list.push(row);
  refresh();
  const r = await write(i >= 0 ? { t: table, op: 'update', id: row.id, patch: strip(row) } : { t: table, op: 'insert', row });
  if (r.error) { if (prev) Object.assign(list[i], prev); else list.splice(list.indexOf(row), 1); refresh(); toast(errText(r.error)); return false; }
  if (msg) toast(msg); snapshot(); return true;
}
function strip(row) { const o = Object.assign({}, row); delete o.id; return o; }
async function cfgDelete(table, id, msg) {
  const list = S[LOCAL[table]]; const i = list.findIndex(x => x.id === id); if (i < 0) return;
  const [prev] = list.splice(i, 1); refresh();
  const r = await write({ t: table, op: 'delete', id });
  if (r.error) { list.splice(i, 0, prev); refresh(); toast(errText(r.error)); return false; }
  if (msg) toast(msg); snapshot(); return true;
}

