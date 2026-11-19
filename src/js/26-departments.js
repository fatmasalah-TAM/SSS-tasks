/* ═════════════ Departments ═════════════
   Each person has a department in each workspace. It doesn't hide anything (everyone still sees every task, so
   "waiting on someone" works across teams); it decides where they land, what their Work and Bugs pages show first,
   and which pages sit at the top of More. An admin picks it in the invite; if nobody did, Ovrto asks on first sign-in.
   areas: words matched against the options of the workspace's Area field. */
const DEPTS = [
  { k: 'backend', g: 'Software', l: 'Backend development', home: 'home', areas: ['backend', 'api', 'server', 'database'], pins: ['work', 'bugs', 'vault'] },
  { k: 'frontend', g: 'Software', l: 'Frontend / web', home: 'home', areas: ['dashboard', 'portal', 'web', 'frontend', 'website'], pins: ['work', 'bugs', 'vault'] },
  { k: 'mobile', g: 'Software', l: 'Mobile apps', home: 'home', areas: ['mobile', 'app', 'ios', 'android'], pins: ['work', 'bugs', 'vault'] },
  { k: 'qa', g: 'Software', l: 'QA / testing', home: 'home', areas: [], pins: ['review', 'bugs', 'projects', 'vault'] },
  { k: 'design', g: 'Software', l: 'UI / UX design', home: 'myturn', areas: ['design', 'ui', 'ux'], pins: ['work', 'projects'] },
  { k: 'devops', g: 'Software', l: 'DevOps / infrastructure', home: 'home', areas: ['devops', 'infra', 'server', 'security', 'cloud'], pins: ['work', 'bugs', 'vault'] },
  { k: 'data', g: 'Software', l: 'Data / AI', home: 'home', areas: ['data', 'ai', 'analytics', 'report'], pins: ['work', 'insights'] },
  { k: 'hardware', g: 'Hardware', l: 'Hardware engineering', home: 'myturn', areas: ['gates', 'hardware', 'device', 'signage', 'parking'], pins: ['work', 'bugs', 'projects'] },
  { k: 'embedded', g: 'Hardware', l: 'Embedded / firmware', home: 'home', areas: ['gates', 'firmware', 'embedded', 'device'], pins: ['work', 'bugs', 'vault'] },
  { k: 'hwlead', g: 'Hardware', l: 'Head of hardware / CTO', home: 'company', areas: ['gates', 'hardware', 'device', 'firmware', 'installation'], pins: ['company', 'projects', 'work', 'bugs'] },
  { k: 'field', g: 'Hardware', l: 'Installation & field', home: 'myturn', areas: ['gates', 'installation', 'site', 'field'], pins: ['work', 'clients', 'vault'] },
  { k: 'support', g: 'Hardware', l: 'Technical support', home: 'bugs', areas: [], pins: ['bugs', 'clients', 'vault'] },
  { k: 'product', g: 'Business', l: 'Product / PM', home: 'home', areas: [], pins: ['company', 'projects', 'insights', 'clients'] },
  { k: 'pm', g: 'Business', l: 'Project management', home: 'home', areas: [], pins: ['projects', 'clients', 'insights'] },
  { k: 'management', g: 'Business', l: 'Management', home: 'company', areas: [], pins: ['company', 'projects', 'insights'] },
  { k: 'sales', g: 'Business', l: 'Sales', home: 'deals', areas: [], pins: ['deals', 'clients', 'projects'] },
  { k: 'presales', g: 'Business', l: 'Pre-sales', home: 'home', areas: [], pins: ['deals', 'projects', 'clients'] },
  { k: 'success', g: 'Business', l: 'Customer success / accounts', home: 'myturn', areas: [], pins: ['clients', 'bugs', 'projects'] },
  { k: 'marketing', g: 'Business', l: 'Marketing', home: 'myturn', areas: [], pins: ['projects', 'work'] },
  { k: 'finance', g: 'Business', l: 'Finance & accounts', home: 'myturn', areas: [], pins: ['company', 'projects'] },
  { k: 'operations', g: 'Business', l: 'Operations & procurement', home: 'myturn', areas: [], pins: ['projects', 'work'] },
  { k: 'hr', g: 'Business', l: 'HR & admin', home: 'myturn', areas: [], pins: ['work'] },
];
const deptOf = k => DEPTS.find(d => d.k === k) || null;
const myMember = () => S.members.find(m => m.user_id === uid());
const myDept = () => deptOf(myMember()?.department);
const PAGE_LABEL = { get home() { return HOME_NAME[homeKind()] || 'Home'; }, work: 'Work', bugs: 'Bugs', review: 'Review', projects: 'Projects', clients: 'Clients', vault: 'Access', insights: 'Insights', company: 'Company', myturn: 'My turn', deals: 'Deals' };
const PAGE_ICON = { get home() { return HOME_ICON[homeKind()] || 'turn'; }, work: 'work', bugs: 'bug', review: 'review', projects: 'folder', clients: 'client', vault: 'key', insights: 'chart', company: 'company', myturn: 'turn', deals: 'deal' };
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
  const d = myDept(); const a = deptAreas(d); if (!a.ids.length) return null;
  return { d, test: t => { const v = (t.fields || {})[a.field.id]; const vals = Array.isArray(v) ? v : v ? [v] : [];
    return vals.some(x => a.ids.includes(x)) || t.assignee_id === uid() || t.reviewer_id === uid() || t.turn_owner === uid(); },
    labels: (a.field.options || []).filter(o => a.ids.includes(o.id)).map(o => o.label) };
}
function deptFocusBar() {
  if (!FOCUS_ROUTES.includes(S.route.v)) return null;
  const d = myDept(); const a = deptAreas(d); if (!a.ids.length) return null;
  const on = deptFocusOn(); const names = (a.field.options || []).filter(o => a.ids.includes(o.id)).map(o => o.label).join(', ');
  return h('div', { class: 'deptbar', 'data-deptbar': on ? 'on' : 'off' }, h('span', { class: 'grow', text: on ? `Showing ${names} and your own tasks` : 'Showing every department' }),
    h('button', { class: 'lnk sm', onclick: () => { store.set(focusKey(), !on); render(); } }, on ? 'Show everything' : `Only ${names}`));
}
/* pick a department: for yourself (first time) or, as an admin, for someone else */
function openDeptPicker({ forUser = uid(), first = false } = {}) {
  const m = S.members.find(x => x.user_id === forUser); if (!m) return;
  const self = forUser === uid();
  openSheet({ title: self ? 'What do you work on?' : `${first_(prof(forUser))}’s department`, kind: 'center', key: 'dept', build: sh => {
    let val = m.department || null;
    const list = h('div', { class: 'deptlist' });
    const draw = () => list.replaceChildren(...['Software', 'Hardware', 'Business'].map(g => h('div', { class: 'deptgrp' }, h('h4', { class: 'vsub', text: g }),
      h('div', { class: 'chips' }, DEPTS.filter(d => d.g === g).map(d => h('button', { class: 'chipbtn', 'data-dept': d.k, 'aria-pressed': String(val === d.k), onclick: () => { val = d.k; draw(); go_.disabled = false; } }, d.l))))));
    const go_ = h('button', { class: 'btn pri', disabled: !val }, self ? 'Show me my pages' : 'Save');
    go_.addEventListener('click', async () => {
      if (!val) return; const done = busy(go_, 'Saving…');
      const res = self && !isAdmin() ? await sb.rpc('set_my_department', { ws: S.ws.id, dept: val }) : await sb.from('workspace_members').update({ department: val }).eq('workspace_id', S.ws.id).eq('user_id', forUser).select();
      done(); if (res.error) return toast(errText(res.error));
      if (self && !isAdmin() && res.data === false) return toast('Your department is already set. Ask an admin to change it');
      m.department = val; closeSheet(true);
      if (self) { const d = deptOf(val); store.set(homedKey(), true); if ((S.prefs.default_view || 'myturn') === 'myturn' && deptHome(d) !== 'myturn') savePrefs({ default_view: deptHome(d) }); go({ v: deptHome(d) }); toast(`Set to ${d.l}. Your pages are at the top of ${isPhone() ? 'More' : 'the menu'}`); }
      else { toast(`${first_(prof(forUser))}: ${deptOf(val).l}`); drawSettings?.(); }
      render();
    });
    sh.append(h('div', { class: 'sbody' }, h('p', { class: 'note', text: self ? 'Ovrto opens on the pages your job needs and shows your area’s work first. You can still see everything.' : 'They land on the pages this job needs and see this area’s work first. They can still see everything.' }), list),
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
function deptPins() { const d = myDept(); if (!d) return []; const p = d.pins.filter(pageAllowed); return homeKind() ? ['home', ...p] : p; }
/* on the phone, pages already in the bottom bar don't repeat in More */
const morePins = () => deptPins().filter(v => !['myturn', 'work', 'review', 'chat'].includes(v));

