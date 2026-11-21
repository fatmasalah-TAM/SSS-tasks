/* ═════════════ Departments ═════════════
   Each person has a department in each workspace. It doesn't hide anything (everyone still sees every task, so
   "waiting on someone" works across teams); it decides where they land, what their Work and Bugs pages show first,
   and which pages sit at the top of More. An admin picks it in the invite; if nobody did, Ovrto asks on first sign-in.
   areas: words matched against the options of the workspace's Area field. */
const BASE_DEPTS = [
  { k: 'backend', g: 'Software', l: 'Backend development', home: 'home', areas: ['backend', 'api', 'server', 'database'], pins: ['work', 'bugs', 'vault'], hide: ['deals', 'clients', 'company'], types: ['feature', 'bug', 'improvement', 'chore', 'task'] },
  { k: 'frontend', g: 'Software', l: 'Frontend / web', home: 'home', areas: ['dashboard', 'portal', 'web', 'frontend', 'website'], pins: ['work', 'bugs', 'vault'], hide: ['deals', 'clients', 'company'], types: ['feature', 'bug', 'improvement', 'chore', 'task'] },
  { k: 'mobile', g: 'Software', l: 'Mobile apps', home: 'home', areas: ['mobile', 'app', 'ios', 'android'], pins: ['work', 'bugs', 'vault'], hide: ['deals', 'clients', 'company'], types: ['feature', 'bug', 'improvement', 'chore', 'task'] },
  { k: 'qa', g: 'Software', l: 'QA / testing', home: 'home', areas: [], pins: ['review', 'tests', 'bugs', 'projects', 'vault'], hide: ['deals', 'company', 'clients', 'sprint'], types: ['testrun', 'testcase', 'bug', 'task'] },
  { k: 'design', g: 'Software', l: 'UI / UX design', home: 'myturn', areas: ['design', 'ui', 'ux'], pins: ['work', 'projects'], hide: ['bugs', 'vault', 'deals', 'company'], types: ['task', 'feature', 'improvement'] },
  { k: 'devops', g: 'Software', l: 'DevOps / infrastructure', home: 'home', areas: ['devops', 'infra', 'server', 'security', 'cloud'], pins: ['incidents', 'work', 'bugs', 'vault'], hide: ['deals', 'clients', 'company'], types: ['chore', 'bug', 'task', 'improvement'] },
  { k: 'data', g: 'Software', l: 'Data / AI', home: 'home', areas: ['data', 'ai', 'analytics', 'report'], pins: ['work', 'insights'], hide: ['deals', 'vault', 'company'], types: ['task', 'feature', 'improvement'] },
  { k: 'hardware', g: 'Hardware', l: 'Hardware engineering', home: 'myturn', areas: ['gates', 'hardware', 'device', 'signage', 'parking'], pins: ['work', 'bugs', 'projects'], hide: ['sprint', 'deals', 'company'], types: ['task', 'bug', 'issue', 'chore'] },
  { k: 'embedded', g: 'Hardware', l: 'Embedded / firmware', home: 'home', areas: ['gates', 'firmware', 'embedded', 'device'], pins: ['work', 'bugs', 'vault'], hide: ['deals', 'clients', 'company'], types: ['task', 'bug', 'improvement', 'chore'] },
  { k: 'hwlead', g: 'Hardware', l: 'Head of hardware / CTO', home: 'company', areas: ['gates', 'hardware', 'device', 'firmware', 'installation'], pins: ['company', 'visits', 'devices', 'projects', 'work'], hide: ['sprint', 'all'], types: ['task', 'issue', 'survey', 'bug'] },
  { k: 'field', g: 'Hardware', l: 'Installation & field', home: 'myturn', areas: ['gates', 'installation', 'site', 'field'], pins: ['visits', 'devices', 'work', 'vault'], hide: ['sprint', 'review', 'insights', 'all', 'deals', 'company'], types: ['task', 'survey', 'issue', 'followup'] },
  { k: 'support', g: 'Hardware', l: 'Technical support', home: 'bugs', areas: [], pins: ['tickets', 'bugs', 'devices'], hide: ['sprint', 'deals', 'company'], types: ['bug', 'issue', 'followup', 'task'] },
  { k: 'product', g: 'Business', l: 'Product / PM', home: 'home', areas: [], pins: ['company', 'projects', 'insights', 'clients'], hide: ['vault'], types: ['feature', 'brd', 'improvement', 'bug', 'task'] },
  { k: 'pm', g: 'Business', l: 'Project management', home: 'home', areas: [], pins: ['projects', 'clients', 'insights'], hide: ['bugs', 'vault'], types: ['task', 'followup', 'brd', 'issue'] },
  { k: 'management', g: 'Business', l: 'Management', home: 'company', areas: [], pins: ['company', 'projects', 'insights', 'approvals'], hide: ['sprint', 'bugs', 'review', 'vault', 'all'], types: ['task', 'followup', 'issue'] },
  { k: 'sales', g: 'Business', l: 'Sales', home: 'deals', areas: [], pins: ['deals', 'clients', 'projects'], hide: ['bugs', 'sprint', 'review', 'vault', 'company'], types: ['followup', 'task', 'demo'] },
  { k: 'presales', g: 'Business', l: 'Pre-sales', home: 'home', areas: [], pins: ['deals', 'projects', 'clients'], hide: ['sprint', 'bugs', 'company'], types: ['proposal', 'demo', 'survey', 'followup'] },
  { k: 'success', g: 'Business', l: 'Customer success / accounts', home: 'myturn', areas: [], pins: ['clients', 'bugs', 'projects'], hide: ['sprint', 'review', 'company'], types: ['followup', 'issue', 'bug', 'task'] },
  { k: 'marketing', g: 'Business', l: 'Marketing', home: 'myturn', areas: [], pins: ['projects', 'work'], hide: ['bugs', 'sprint', 'review', 'vault', 'clients', 'deals'], types: ['task', 'followup'] },
  { k: 'finance', g: 'Business', l: 'Finance & accounts', home: 'company', areas: [], pins: ['company', 'approvals', 'projects', 'work'], hide: ['bugs', 'sprint', 'review', 'vault', 'clients'], types: ['task', 'followup', 'issue'] },
  { k: 'operations', g: 'Business', l: 'Operations & procurement', home: 'myturn', areas: [], pins: ['approvals', 'stock', 'projects', 'work'], hide: ['bugs', 'sprint', 'review', 'deals', 'company'], types: ['task', 'followup', 'issue'] },
  { k: 'hr', g: 'Business', l: 'HR & admin', home: 'myturn', areas: [], pins: ['approvals', 'work', 'projects'], hide: ['bugs', 'sprint', 'review', 'clients', 'deals', 'vault'], types: ['task', 'followup', 'issue'] },
];
/* each company sets its departments: which built-in ones it uses, their names, its own extra ones (each works like a
   built-in one: same pages, task types and agents), and "small team" (everyone sees every page). Empty = all built-in. */
const wsDeptCfg = () => S.ws?.departments || null;
let _deptCache = { cfg: undefined, list: null };
function deptList() {
  const c = wsDeptCfg(); if (_deptCache.cfg === c && _deptCache.list) return _deptCache.list;
  const names = c?.names || {};
  const base = BASE_DEPTS.map(d => names[d.k] ? Object.assign({}, d, { l: names[d.k] }) : d);
  const custom = (c?.custom || []).filter(x => x && x.k && x.l).map(x => { const b = BASE_DEPTS.find(d => d.k === x.base) || BASE_DEPTS.find(d => d.k === 'operations'); return Object.assign({}, b, { k: x.k, l: x.l, base: b.k }); });
  _deptCache = { cfg: c, list: [...base, ...custom] }; return _deptCache.list;
}
const deptsOn = () => { const c = wsDeptCfg(); const all = deptList(); return c?.on ? all.filter(d => d.base || c.on.includes(d.k)) : all; };
const smallTeam = () => !!wsDeptCfg()?.small;
const baseKey = k => deptOf(k)?.base || k;
const deptOf = k => deptList().find(d => d.k === k) || null;
const myMember = () => S.members.find(m => m.user_id === uid());
const myDept = () => deptOf(myMember()?.department);
/* a small team's people wear several hats: the main department decides the home; the others add their pages, types and agents */
const extrasOf = m => (m?.extra_departments || []).filter(k => k !== m?.department && deptOf(k));
const myDepts = () => { const m = myMember(); return [m?.department, ...extrasOf(m)].map(deptOf).filter(Boolean); };
/* HR, finance, operations, marketing and sales (admins still see everything): plain work, no bugs, sprints, areas or developers */
const OFFICE = ['hr', 'finance', 'operations', 'marketing', 'sales'];
const officeOnly = () => { const ds = myDepts(); return !isAdmin() && !!ds.length && !smallTeam() && ds.every(d => OFFICE.includes(baseKey(d.k))); };
/* plus management: plain words (no developer, sprint or area) while still seeing the whole company's work */
const plainOnly = () => { const ds = myDepts(); return !isAdmin() && !!ds.length && !smallTeam() && ds.every(d => [...OFFICE, 'management'].includes(baseKey(d.k))); };
const deptPeople = () => { const ks = myDepts().map(d => baseKey(d.k)); return new Set(S.members.filter(m => inDept(m, ...ks)).map(m => m.user_id)); };
const inDept = (m, ...ks) => !!m && (ks.includes(baseKey(m.department)) || extrasOf(m).some(k => ks.includes(baseKey(k))));
const deptLabel = m => { const d = deptOf(m?.department); const n = extrasOf(m).length; return d ? d.l + (n ? ` +${n}` : '') : null; };
const PAGE_LABEL = { get home() { return HOME_NAME[homeKind()] || 'Home'; }, work: 'Work', bugs: 'Bugs', review: 'Review', projects: 'Projects', clients: 'Clients', vault: 'Access', insights: 'Insights', company: 'Company', myturn: 'My turn', deals: 'Deals', devices: 'Devices', visits: 'Site visits', tickets: 'Tickets', tests: 'Test library', incidents: 'Incidents', approvals: 'Approvals', stock: 'Stock' };
const PAGE_ICON = { get home() { return HOME_ICON[homeKind()] || 'turn'; }, work: 'work', bugs: 'bug', review: 'review', projects: 'folder', clients: 'client', vault: 'key', insights: 'chart', company: 'company', myturn: 'turn', deals: 'deal', devices: 'wifi', visits: 'calendar', tickets: 'headset', tests: 'review', incidents: 'bell', approvals: 'check', stock: 'folder' };
/* pages this person may open: Company needs money access, Insights needs admin */
const pageAllowed = v => v === 'company' ? canSeeSomeMoney() : v === 'insights' ? isAdmin() : v === 'home' ? !!homeKind() : true;
const deptHome = d => (d && pageAllowed(d.home) ? d.home : 'myturn');
/* the Area options this department works on (by name, so it follows the workspace's own areas) */
function deptAreas(d = myDept()) {
  const f = fdKey('area') || S.fields.find(x => /^area$/i.test(x.name || ''));
  if (!d || !f || !d.areas.length) return { field: f, ids: [] };
  const ids = (f.options || []).filter(o => d.areas.some(w => String(o.label).toLowerCase().split(/[^a-z0-9]+/).includes(w) || String(o.id).toLowerCase() === w)).map(o => o.id);
  return { field: f, ids };
}
const focusKey = () => 'deptFocus.' + (S.ws?.id || '') + '.' + uid();
const homedKey = () => 'deptHomed2.' + (S.ws?.id || '') + '.' + uid(); // per person: a shared phone or laptop keeps each person's own
const deptFocusOn = () => store.get(focusKey(), true) !== false;
const FOCUS_ROUTES = ['work', 'bugs', 'sprint'];
/* Work, Bugs and Sprint show the department's areas first, plus anything that is the person's own */
function deptFocus() {
  if (!FOCUS_ROUTES.includes(S.route.v) || !deptFocusOn()) return null;
  const d = myDept(); const a = deptAreas(d);
  if (!a.ids.length) { if (!officeOnly()) return null; const ppl = deptPeople();
    return { d, test: t => !tyOf(t.type_id)?.is_bug && [t.assignee_id, t.turn_owner, t.created_by, t.reviewer_id].some(u => u && ppl.has(u)), labels: [d.l] }; }
  return { d, test: t => { const v = (t.fields || {})[a.field.id]; const vals = Array.isArray(v) ? v : v ? [v] : [];
    return vals.some(x => a.ids.includes(x)) || t.assignee_id === uid() || t.reviewer_id === uid() || t.turn_owner === uid(); },
    labels: (a.field.options || []).filter(o => a.ids.includes(o.id)).map(o => o.label) };
}
function deptFocusBar() {
  if (!FOCUS_ROUTES.includes(S.route.v)) return null;
  const d = myDept(); const a = deptAreas(d); if (!a.ids.length && !officeOnly()) return null;
  const on = deptFocusOn(); const names = a.ids.length ? (a.field.options || []).filter(o => a.ids.includes(o.id)).map(o => o.label).join(', ') : d.l;
  return h('div', { class: 'deptbar', 'data-deptbar': on ? 'on' : 'off' }, h('span', { class: 'grow', text: on ? `Showing ${names} and your own tasks` : 'Showing every department' }),
    h('button', { class: 'lnk sm', onclick: () => { store.set(focusKey(), !on); render(); } }, on ? 'Show everything' : `Only ${names}`));
}
/* pick departments: the main job (decides where Ovrto opens) and any others the person also does.
   A member sets their main job once (then an admin changes it) and their other jobs any time. */
function openDeptPicker({ forUser = uid(), first = false } = {}) {
  const m = S.members.find(x => x.user_id === forUser); if (!m) return;
  const self = forUser === uid(); const mainLocked = self && !isAdmin() && !!m.department;
  openSheet({ title: self ? 'What do you work on?' : `${first_(prof(forUser))}’s departments`, kind: 'center', key: 'dept', build: sh => {
    let val = m.department || null; const extra = new Set(extrasOf(m)); let mode = 'main';
    const list = h('div', { class: 'deptlist' }); const head = h('div', { class: 'depthead' });
    const draw = () => {
      extra.delete(val);
      head.replaceChildren(mode === 'main'
        ? h('p', { class: 'note', text: mainLocked ? 'Your main job is set. Ask an admin to change it. You can add the other jobs you do.' : 'Main job: Ovrto opens on its pages.' })
        : h('p', { class: 'note', text: 'Other jobs you also do: their pages, task types and agents join your main job’s. Pick as many as you like.' }));
      list.replaceChildren(...['Software', 'Hardware', 'Business'].map(g => h('div', { class: 'deptgrp' }, h('h4', { class: 'vsub', text: g }),
        h('div', { class: 'chips' }, deptsOn().concat(deptList().filter(d => (d.k === m.department || extrasOf(m).includes(d.k)) && !deptsOn().includes(d))).filter(d => d.g === g && (mode === 'main' || d.k !== val)).map(d => mode === 'main'
          ? h('button', { class: 'chipbtn', 'data-dept': d.k, 'aria-pressed': String(val === d.k), disabled: mainLocked && val !== d.k, onclick: () => { val = d.k; draw(); } }, d.l)
          : h('button', { class: 'chipbtn', 'data-extra': d.k, 'aria-pressed': String(extra.has(d.k)), onclick: () => { extra.has(d.k) ? extra.delete(d.k) : extra.add(d.k); draw(); } }, extra.has(d.k) ? h('span', { 'aria-hidden': 'true', text: '✓ ' }) : null, h('span', { text: d.l })))))));
      more.textContent = mode === 'main' ? (extra.size ? `Other jobs: ${[...extra].map(k => deptOf(k).l).join(', ')}` : '+ I also do other jobs') : '← Back to main job';
      more.disabled = !val; go_.disabled = !val;
    };
    const more = h('button', { class: 'lnk sm deptmore', 'data-dept-more': '1', onclick: () => { mode = mode === 'main' ? 'extra' : 'main'; draw(); } });
    const go_ = h('button', { class: 'btn pri' }, self ? 'Show me my pages' : 'Save');
    go_.addEventListener('click', async () => {
      if (!val) return; const done = busy(go_, 'Saving…'); const ex = [...extra];
      let res;
      if (self && !isAdmin()) {
        if (!m.department) { res = await sb.rpc('set_my_department', { ws: S.ws.id, dept: val }); if (!res.error && res.data === false) { done(); return toast('Your department is already set. Ask an admin to change it'); } }
        if (!res?.error) res = await sb.rpc('set_my_extra_departments', { ws: S.ws.id, depts: ex });
      } else res = await sb.from('workspace_members').update({ department: val, extra_departments: ex }).eq('workspace_id', S.ws.id).eq('user_id', forUser).select();
      done(); if (res.error) return toast(errText(res.error));
      const was = m.department; m.department = val; m.extra_departments = ex; closeSheet(true);
      if (self) {
        const d = deptOf(val);
        if (was !== val) { store.set(homedKey(), true); if ((S.prefs.default_view || 'myturn') === 'myturn' && deptHome(d) !== 'myturn') savePrefs({ default_view: deptHome(d) }); go({ v: deptHome(d) }); }
        toast(ex.length ? `Set to ${d.l} and ${ex.length} more` : `Set to ${d.l}. Your pages are at the top of ${isPhone() ? 'More' : 'the menu'}`);
      } else { toast(`${first_(prof(forUser))}: ${deptLabel(m)}`); drawSettings?.(); }
      render();
    });
    sh.append(h('div', { class: 'sbody' }, head, list, h('div', { class: 'deptmorerow' }, more)),
      h('div', { class: 'sfoot' }, first ? null : h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), h('span', { class: 'sp' }), go_));
    draw();
  } });
}
const first_ = p => first(p) || 'Someone';
/* after sign-in: ask once if nobody set it; if an admin set it in the invite, land on that department's home once */
function checkDept() {
  const m = myMember(); if (!m) return;
  if (!m.department && !currentSheet()) setTimeout(() => !currentSheet() && openDeptPicker({ first: true }), 700);
}
/* where the app opens: the person's own choice, or (the first time, if they never chose) their department's home */
function startView() {
  const d = myDept();
  if (d && S.ws && !store.get(homedKey(), false)) {
    store.set(homedKey(), true);
    if (['myturn', 'review', 'bugs'].includes(S.prefs.default_view || 'myturn') && deptHome(d) !== (S.prefs.default_view || 'myturn')) savePrefs({ default_view: deptHome(d) });
  }
  const v = S.prefs.default_view || 'myturn'; return pageAllowed(v) ? v : 'myturn';
}
/* the "for your job" group at the top of More (phone) and the sidebar (computer) */
function deptPins() { const ds = myDepts(); if (!ds.length) return []; const p = [...new Set(ds.flatMap(d => d.pins))].filter(pageAllowed); return homeKind() ? ['home', ...p] : p; }
/* on the phone, pages already in the bottom bar don't repeat in More */
/* pages this department doesn't need leave its menu (they still open from links, search and alerts, so
   "waiting on someone" keeps working across teams). "Show all pages" brings them back, per person. */
const allPagesKey = () => 'deptAll.' + (S.ws?.id || '') + '.' + uid();
const showAllPages = () => !!store.get(allPagesKey(), false);
const pageHidden = v => { if (typeof FIELD_PAGES !== 'undefined' && FIELD_PAGES[v]) return fieldPageHidden(v); if (v === 'all' && officeOnly() && !showAllPages()) return true; const ds = myDepts(); return !!(ds.length && !smallTeam() && ds.every(d => (d.hide || []).includes(v)) && !showAllPages() && !(v === 'review' && reviewCount())); };
const hasHiddenPages = () => { const ds = myDepts(); return !!ds.length && !smallTeam() && (ds[0].hide || []).some(v => ds.every(d => (d.hide || []).includes(v))); };
function toggleAllPages() { const on = !showAllPages(); store.set(allPagesKey(), on); render(); toast(on ? 'Showing all pages' : 'Showing your department’s pages'); }
/* task types: the department's own first, the rest one tap away */
const deptTypeKeys = () => [...new Set(myDepts().flatMap(d => d.types || []))];
const morePins = () => deptPins().filter(v => !['myturn', 'work', 'review', 'chat'].includes(v));

/* ── company setup: how the team works, which departments it has, their names, and its own ones ── */
const DEPT_STARTER = ['backend', 'frontend', 'product', 'sales'];
function openDeptSetup({ first = false } = {}) {
  if (!isAdmin()) return;
  const c = wsDeptCfg() || {};
  const st = { small: c.small ?? first, on: new Set(c.on || (first ? DEPT_STARTER : BASE_DEPTS.map(d => d.k))), names: Object.assign({}, c.names || {}), custom: (c.custom || []).map(x => Object.assign({}, x)), renaming: false };
  openSheet({ title: first ? 'Set up your departments' : 'Your departments', kind: 'center', key: 'deptsetup', build: sh => {
    const body = h('div', { class: 'sbody deptsetup' });
    const mode = (v, t, s) => h('button', { class: 'dsmode', 'data-small': String(v), 'aria-pressed': String(st.small === v), onclick: () => { st.small = v; draw(); } }, h('b', { text: t }), h('span', { text: s }));
    const draw = () => {
      const newName = h('input', { type: 'text', id: 'dsNewName', placeholder: 'Department name, e.g. Legal', maxlength: '40' });
      const like = h('select', { id: 'dsLike', 'aria-label': 'Works like' }, ...['Software', 'Hardware', 'Business'].map(g => h('optgroup', { label: g }, BASE_DEPTS.filter(d => d.g === g).map(d => h('option', { value: d.k, selected: d.k === 'operations' }, st.names[d.k] || d.l)))));
      body.replaceChildren(
        h('h4', { class: 'vsub', text: 'How does your team work?' }),
        h('div', { class: 'dsmodes' }, mode(true, 'Small team', 'People do a bit of everything. Everyone sees every page.'), mode(false, 'Teams with clear jobs', 'Each department sees the pages it needs. Anyone can still show all pages.')),
        h('h4', { class: 'vsub', text: 'Which departments do you have?' }),
        h('p', { class: 'note', text: 'People pick from these when they join. Each one comes with its own pages, task types and AI helpers.' }),
        ...['Software', 'Hardware', 'Business'].map(g => h('div', { class: 'deptgrp' }, h('h5', { class: 'sm mute', text: g }), h('div', { class: 'chips' },
          BASE_DEPTS.filter(d => d.g === g).map(d => h('button', { class: 'chipbtn', 'data-ds': d.k, 'aria-pressed': String(st.on.has(d.k)), onclick: () => { st.on.has(d.k) ? st.on.delete(d.k) : st.on.add(d.k); draw(); } }, st.on.has(d.k) ? h('span', { 'aria-hidden': 'true', text: '✓ ' }) : null, h('span', { text: st.names[d.k] || d.l })))))),
        h('button', { class: 'lnk sm', 'data-ds-rename': '1', onclick: () => { st.renaming = !st.renaming; draw(); } }, st.renaming ? 'Done renaming' : 'Rename departments'),
        st.renaming ? h('div', { class: 'dsrename' }, BASE_DEPTS.filter(d => st.on.has(d.k)).map(d => h('label', { class: 'field' }, d.l,
          h('input', { type: 'text', value: st.names[d.k] || '', placeholder: d.l, maxlength: '40', 'data-ds-name': d.k, oninput: e => { const v = e.target.value.trim(); if (v) st.names[d.k] = v; else delete st.names[d.k]; } })))) : null,
        h('h4', { class: 'vsub', text: 'Your own departments' }),
        st.custom.length ? h('div', { class: 'chips' }, st.custom.map(x => h('span', { class: 'chipbtn on dscustom', 'data-ds-custom': x.l }, h('span', { class: 'notr', text: x.l }), h('span', { class: 'sm mute', text: ' · like ' + (st.names[x.base] || deptOfBase(x.base)?.l || '') }),
          h('button', { class: 'x', 'aria-label': `Remove ${x.l}`, onclick: () => { st.custom = st.custom.filter(y => y !== x); draw(); } }, icon('x', 12))))) : h('p', { class: 'note', text: 'Add any department we don’t have. Pick the one it works most like, so it gets the right pages.' }),
        h('div', { class: 'dsadd' }, newName, h('label', { class: 'sm' }, 'works like ', like), h('button', { class: 'btn sm', 'data-ds-add': '1', onclick: () => {
          const l = newName.value.trim(); if (!l) return newName.focus();
          if ([...deptList(), ...st.custom].some(d => d.l.toLowerCase() === l.toLowerCase())) return toast('You already have a department with that name');
          st.custom.push({ k: 'c_' + Math.random().toString(36).slice(2, 8), l, base: like.value }); draw();
        } }, icon('plus', 14), 'Add')));
      save.disabled = !st.on.size && !st.custom.length;
    };
    const save = h('button', { class: 'btn pri', 'data-ds-save': '1' }, first ? 'Done' : 'Save');
    save.addEventListener('click', async () => {
      const cfg = { small: st.small, on: BASE_DEPTS.map(d => d.k).filter(k => st.on.has(k)), names: st.names, custom: st.custom };
      const done = busy(save, 'Saving…'); const ok = await saveWs({ departments: cfg }, 'Departments saved'); done();
      if (ok === false) return; closeSheet(true); render();
    });
    sh.append(body, h('div', { class: 'sfoot' }, first ? h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Later') : h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), h('span', { class: 'sp' }), save));
    draw();
  } });
}
const deptOfBase = k => BASE_DEPTS.find(d => d.k === k) || null;
function deptSummary() {
  const c = wsDeptCfg(); if (!c) return 'All 22 departments';
  const n = (c.on || []).length + (c.custom || []).length;
  return `${n} department${n === 1 ? '' : 's'} · ${c.small ? 'small team: everyone sees every page' : 'each sees its own pages'}`;
}

