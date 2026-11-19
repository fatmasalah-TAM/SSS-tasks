/* ═════════════ views: definitions, filtering, grouping ═════════════ */
const clientField = () => fdKey('client') || S.fields.find(f => f.kind === 'select' && f.show_on_card);
const BUILTIN = {
  myturn: { name: 'My turn', icon: 'turn', special: 'myturn' },
  inbox: { name: 'Notifications', icon: 'bell', special: 'inbox' },
  review: { name: 'Review', icon: 'review', special: 'review' },
  chat: { name: 'Chat', icon: 'chat', special: 'chat' },
  insights: { name: 'Insights', icon: 'chart', special: 'insights' },
  owner: { name: 'Ovrto owner', icon: 'chart', special: 'owner' },
  work: { name: 'Work', icon: 'work', config: () => ({ filters: [], group: 'status', sort: 'priority', layout: S.prefs?.layout || 'board', columns: DEFAULT_COLS }) },
  bugs: { name: 'Bugs', icon: 'bug', special: 'bugs', config: () => ({ filters: [{ f: 'kind', op: 'any', v: ['bug'] }], group: 'status', sort: 'priority', layout: 'list', columns: DEFAULT_COLS }) },
  sprint: { name: 'Sprint', icon: 'sprint', special: 'sprint', config: () => ({ filters: [{ f: 'sprint', op: 'any', v: ['current'] }], group: 'status', sort: 'priority', layout: S.prefs?.layout || 'board', columns: DEFAULT_COLS }) },
  clients: { name: 'Clients', icon: 'client', special: 'clients', config: () => ({ filters: [{ f: 'closed', op: 'none', v: ['closed'] }], group: clientField() ? 'f:' + clientField().id : 'project', sort: 'priority', layout: 'list', columns: DEFAULT_COLS }) },
  projects: { name: 'Projects', icon: 'folder', special: 'projects' },
  vault: { name: 'Access', icon: 'key', special: 'vault' },
  company: { name: 'Company', icon: 'company', special: 'company' },
  home: { name: 'Home', icon: 'turn', special: 'home' },
  deals: { name: 'Deals', icon: 'deal', special: 'deals' },
  all: { name: 'All tasks', icon: 'all', config: () => ({ filters: [], group: 'status', sort: 'priority', layout: S.prefs?.layout || 'board', columns: DEFAULT_COLS }) },
};
const DEFAULT_COLS = ['key', 'title', 'type', 'status', 'developer', 'priority', 'turn', 'due'];

function routeConfig(r = S.route) {
  if (BUILTIN[r.v]?.config) return BUILTIN[r.v].config();
  if (r.v === 'view') { const v = S.views.find(x => x.id === r.id); if (v) return Object.assign({ filters: [], group: 'status', sort: 'priority', layout: 'board', columns: DEFAULT_COLS }, clone(v.config)); }
  if (r.v === 'project') return { filters: [], group: 'status', sort: 'priority', layout: S.prefs?.layout || 'board', columns: DEFAULT_COLS };
  return BUILTIN.all.config();
}
function routeTitle(r = S.route) {
  if (BUILTIN[r.v]) return BUILTIN[r.v].name;
  if (r.v === 'view') return S.views.find(x => x.id === r.id)?.name || 'View';
  if (r.v === 'project') return pjOf(r.id)?.name || 'Project';
  if (r.v === 'deal') return dealOf(r.id)?.name || 'Deal';
  return 'Tasks';
}
function go(route, keepVc) {
  S.route = route; store.set('route', route); S.selected = null;
  $$('.toasts .toast').forEach(t => { if (!t.querySelector('button') && Date.now() - Number(t.dataset.at || 0) > 1500) t.remove(); }); // older plain messages don't follow you to the next screen
  if (!keepVc) S.vc = null;
  closePop(); render(); scrollMainTop(); tours.onRoute();
}
function scrollMainTop() { const m = $('.main .scroll'); if (m) m.scrollTop = 0; }
const vc = () => (S.vc ||= routeConfig());
const vcDirty = () => !!S.vc && JSON.stringify(S.vc) !== JSON.stringify(routeConfig());

/* filter fields catalogue */
function filterFields() {
  const list = [
    { k: 'type', n: 'Type' }, { k: 'kind', n: 'Kind' }, { k: 'status', n: 'Status' }, { k: 'category', n: 'Status group' },
    { k: 'developer', n: 'Developer' }, { k: 'reviewer', n: 'Reviewer' }, { k: 'turn', n: 'Whose turn' }, { k: 'priority', n: 'Priority' },
    { k: 'project', n: 'Project' }, { k: 'sprint', n: 'Sprint' }, { k: 'flag', n: 'Flag' }, { k: 'due', n: 'Due date' }, { k: 'closed', n: 'Open or closed' }, { k: 'finished', n: 'Finished' },
  ];
  for (const f of S.fields) list.push({ k: 'f:' + f.id, n: f.name, field: f });
  return list;
}
function filterOptions(k) {
  const people = [{ v: 'me', label: 'Me' }, ...S.members.map(m => ({ v: m.user_id, label: dname(prof(m.user_id)) })), { v: '__none', label: 'Nobody' }];
  if (k === 'type') return S.types.map(t => ({ v: t.id, label: t.name }));
  if (k === 'kind') return [{ v: 'bug', label: 'Bugs' }];
  if (k === 'status') return sortedStatuses().map(s => ({ v: s.id, label: s.name, icon: stIcon(s) }));
  if (k === 'category') return CATS.map(c => ({ v: c, label: CAT_NAME[c], icon: stGlyph(c) }));
  if (k === 'developer' || k === 'reviewer') return people;
  if (k === 'turn') return [...people.slice(0, -1), { v: 'client', label: 'Client' }, { v: 'admins', label: 'Admins' }];
  if (k === 'priority') return PRIOS.map(p => ({ v: p.k, label: p.n, icon: prioGlyph(p.k) }));
  if (k === 'project') return [...S.projects.map(p => ({ v: p.id, label: p.name })), { v: '__none', label: 'No project' }];
  if (k === 'sprint') { const c = sprintOf(); return [{ v: 'current', label: `Current (${c})` }, { v: 'next', label: `Next (${c + 1})` }, { v: 'previous', label: `Previous (${c - 1})` }, { v: '__none', label: 'No sprint' }]; }
  if (k === 'flag') return FLAGS.map(f => ({ v: f.k, label: f.n }));
  if (k === 'due') return [{ v: 'overdue', label: 'Overdue' }, { v: 'week', label: 'Due this week' }, { v: 'set', label: 'Has a due date' }, { v: '__none', label: 'No due date' }];
  if (k === 'closed') return [{ v: 'closed', label: 'Done or canceled' }];
  if (k === 'finished') return [7, 14, 30, 90].map(n => ({ v: String(n), label: `Last ${n} days` }));
  if (k.startsWith('f:')) {
    const f = fdOf(k.slice(2)); if (!f) return [];
    if (f.kind === 'select' || f.kind === 'multi') return [...f.options.map(o => ({ v: o.id, label: o.label })), { v: '__none', label: 'Empty' }];
    if (f.kind === 'person') return people;
    if (f.kind === 'checkbox') return [{ v: true, label: 'Checked' }, { v: false, label: 'Not checked' }];
    return [{ v: '__set', label: 'Has a value' }, { v: '__none', label: 'Empty' }];
  }
  return [];
}
function valuesOf(t, k) {
  const me_ = uid();
  const mapMe = v => (v === me_ ? [v, 'me'] : [v]);
  switch (k) {
    case 'type': return [t.type_id];
    case 'kind': return isBug(t) ? ['bug'] : ['work'];
    case 'status': return [t.status_id];
    case 'category': return [catOf(t)];
    case 'developer': return t.assignee_id ? mapMe(t.assignee_id) : ['__none'];
    case 'reviewer': return t.reviewer_id ? mapMe(t.reviewer_id) : ['__none'];
    case 'turn': return t.turn_owner ? mapMe(t.turn_owner) : ['__none'];
    case 'priority': return [t.priority || 0];
    case 'project': return [t.project_id || '__none'];
    case 'sprint': { const c = sprintOf(); const out = [t.sprint ?? '__none']; if (t.sprint === c) out.push('current'); if (t.sprint === c + 1) out.push('next'); if (t.sprint === c - 1) out.push('previous'); return out; }
    case 'flag': return t.flags || [];
    case 'closed': return isClosed(t) ? ['closed'] : ['open'];
    case 'finished': { if (!t.completed_at || !isClosed(t)) return []; const d = (Date.now() - new Date(t.completed_at).getTime()) / 864e5; return [7, 14, 30, 90].filter(n => d <= n).map(String); }
    case 'due': { const d = dueInfo(t); if (!d) return ['__none']; const out = ['set']; if (d.over) out.push('overdue'); const days = (new Date(t.due_date + 'T00:00:00') - new Date()) / 864e5; if (days < 7 && days > -1) out.push('week'); return out; }
  }
  if (k.startsWith('f:')) {
    const f = fdOf(k.slice(2)); const v = (t.fields || {})[k.slice(2)];
    if (!f) return [];
    if (!hasVal(v) && f.kind !== 'checkbox') return ['__none'];
    if (f.kind === 'multi') return v;
    if (f.kind === 'person') return mapMe(v);
    if (f.kind === 'checkbox') return [!!v];
    if (f.kind === 'select') return [v];
    return ['__set', String(v).toLowerCase()];
  }
  return [];
}
function matches(t, flt) {
  for (const f of flt) {
    const vals = valuesOf(t, f.f);
    if (f.op === 'any' && !f.v.some(x => vals.includes(x))) return false;
    if (f.op === 'none' && f.v.some(x => vals.includes(x))) return false;
    if (f.op === 'contains') { const s = String(f.v[0] || '').toLowerCase(); if (s && !vals.some(x => String(x).includes(s))) return false; }
  }
  return true;
}
let searchQ = '';
function visibleTasks(cfg = vc()) {
  const q = searchQ.trim().toLowerCase();
  const pj = S.route.v === 'project' ? S.route.id : null; // a project page shows only its own tasks, without a filter chip
  const fo = deptFocus();
  return S.tasks.filter(t => (!pj || t.project_id === pj) && (!fo || fo.test(t)) && matches(t, cfg.filters || []) && (!q || `${taskKey(t)} ${t.title} ${t.description}`.toLowerCase().includes(q)));
}
const SORTS = {
  priority: (a, b) => ((a.priority || 9) - (b.priority || 9)) || (b.updated_at || '').localeCompare(a.updated_at || ''),
  updated: (a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''),
  created: (a, b) => (b.created_at || '').localeCompare(a.created_at || ''),
  due: (a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'),
  number: (a, b) => (b.number || 1e9) - (a.number || 1e9),
  turnage: (a, b) => (a.turn_since || '').localeCompare(b.turn_since || ''),
  manual: (a, b) => (a.position || 0) - (b.position || 0),
};
const SORT_NAMES = { priority: 'Priority', updated: 'Last updated', created: 'Newest', due: 'Due date', number: 'Number', turnage: 'Longest wait', manual: 'Manual' };
function groupOptions() {
  const g = [{ v: 'status', label: 'Status' }, { v: 'type', label: 'Type' }, { v: 'developer', label: 'Developer' }, { v: 'turn', label: 'Whose turn' }, { v: 'priority', label: 'Priority' }, { v: 'project', label: 'Project' }, { v: 'sprint', label: 'Sprint' }, { v: 'none', label: 'No grouping' }];
  for (const f of S.fields) if (['select', 'multi', 'person', 'checkbox'].includes(f.kind)) g.push({ v: 'f:' + f.id, label: f.name });
  return g;
}
/* returns [{key, label, icon, color, tasks, set(task)→patch}] */
function groupTasks(tasks, g) {
  const out = []; const add = (key, label, extra = {}) => { const e = { key, label, tasks: [], ...extra }; out.push(e); return e; };
  if (g === 'status') { for (const s of sortedStatuses()) add(s.id, s.name, { icon: stIcon(s), patch: { status_id: s.id } }); for (const t of tasks) (out.find(e => e.key === t.status_id) || out[0])?.tasks.push(t); return out; }
  if (g === 'type') { for (const ty of S.types) add(ty.id, ty.name, { color: ty.color, patch: { type_id: ty.id } }); for (const t of tasks) (out.find(e => e.key === t.type_id) || out[0])?.tasks.push(t); return out; }
  if (g === 'priority') { for (const p of PRIOS) add(p.k, p.n, { icon: prioGlyph(p.k), patch: { priority: p.k } }); for (const t of tasks) (out.find(e => e.key === (t.priority || 0)) || out[out.length - 1]).tasks.push(t); return out; }
  if (g === 'developer' || g === 'turn') {
    const col = g === 'developer' ? 'assignee_id' : 'turn_owner';
    for (const m of S.members) add(m.user_id, dname(prof(m.user_id)), { icon: avatar(prof(m.user_id), { size: 'xs' }), patch: g === 'developer' ? { assignee_id: m.user_id } : null });
    if (g === 'turn') { add('client', 'Client'); add('admins', 'Admins'); }
    add('__none', g === 'developer' ? 'No developer' : 'Nobody', { patch: g === 'developer' ? { assignee_id: null } : null });
    for (const t of tasks) (out.find(e => e.key === (t[col] || '__none')) || out[out.length - 1]).tasks.push(t);
    return out.filter(e => e.tasks.length || g === 'developer');
  }
  if (g === 'project') { for (const p of S.projects) add(p.id, p.name, { patch: { project_id: p.id } }); add('__none', 'No project', { patch: { project_id: null } }); for (const t of tasks) (out.find(e => e.key === (t.project_id || '__none')) || out[out.length - 1]).tasks.push(t); return out; }
  if (g === 'sprint') {
    const ns = [...new Set(tasks.map(t => t.sprint ?? null))].sort((a, b) => (b ?? -1) - (a ?? -1)); const c = sprintOf();
    for (const n of ns) add(n ?? '__none', n ? `Sprint ${n}${n === c ? ' · current' : ''}` : 'No sprint', { patch: { sprint: n } });
    for (const t of tasks) out.find(e => e.key === (t.sprint ?? '__none'))?.tasks.push(t); return out;
  }
  if (g.startsWith('f:')) {
    const f = fdOf(g.slice(2)); if (!f) return [{ key: 'all', label: 'All', tasks }];
    const setF = v => ({ fields: v });
    if (f.kind === 'select' || f.kind === 'multi') {
      for (const o of f.options) add(o.id, o.label, { color: o.color, fieldSet: { f, v: o.id } });
      add('__none', 'No ' + f.name.toLowerCase(), { fieldSet: { f, v: null } });
      for (const t of tasks) { const v = (t.fields || {})[f.id]; const vs = Array.isArray(v) ? v : hasVal(v) ? [v] : []; if (!vs.length) out[out.length - 1].tasks.push(t); else vs.forEach(x => out.find(e => e.key === x)?.tasks.push(t)); }
      return out;
    }
    if (f.kind === 'person') { for (const m of S.members) add(m.user_id, dname(prof(m.user_id)), { fieldSet: { f, v: m.user_id } }); add('__none', 'Nobody', { fieldSet: { f, v: null } }); for (const t of tasks) (out.find(e => e.key === (t.fields || {})[f.id]) || out[out.length - 1]).tasks.push(t); return out; }
    if (f.kind === 'checkbox') { add('yes', f.name, { fieldSet: { f, v: true } }); add('no', 'Not ' + f.name.toLowerCase(), { fieldSet: { f, v: false } }); for (const t of tasks) out[(t.fields || {})[f.id] ? 0 : 1].tasks.push(t); return out; }
  }
  return [{ key: 'all', label: 'All tasks', tasks }];
}
function groupPatch(t, grp) {
  if (grp.patch) return grp.patch;
  if (grp.fieldSet) {
    const { f, v } = grp.fieldSet; const fields = Object.assign({}, t.fields || {});
    if (f.kind === 'multi') { fields[f.id] = v == null ? [] : [v]; } else fields[f.id] = v;
    return { fields };
  }
  return null;
}

