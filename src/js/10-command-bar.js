/* ═════════════ command bar ═════════════ */
/* search stays quick with thousands of tasks: each task's searchable text is prepared once (until it changes),
   and only the few best matches are sorted */
const SEARCH_IDX = new Map();
const idx = t => { const v = t.updated_at + '|' + t.title; let x = SEARCH_IDX.get(t.id); if (!x || x.v !== v) { x = { v, k: `${taskKey(t)} ${t.title}`.toLowerCase(), d: norm(t.description || '') }; SEARCH_IDX.set(t.id, x); } return x; };
function topN(arr, cmp, n) { const out = []; for (const x of arr) { if (out.length < n) { out.push(x); out.sort(cmp); } else if (cmp(x, out[n - 1]) < 0) { out[n - 1] = x; out.sort(cmp); } } return out; }
const cmdk = (() => {
  let el = null;
  function open() {
    track('search');
    close(); closePop();
    const inp = h('input', { type: 'search', placeholder: 'Search everything in Ovrto…', 'aria-label': 'Search everything' });
    if (!V.loaded && S.ws) loadVault().then(() => el && draw());
    const box = h('div', { class: 'opts', role: 'listbox' });
    const scrim = h('div', { class: 'scrim', style: { zIndex: '60' }, onclick: close });
    el = [scrim, h('div', { class: 'cmdk', role: 'dialog', 'aria-label': 'Command bar' }, inp, box)];
    document.body.append(...el);
    let act = 0, items = [];
    const draw = () => {
      const q = inp.value.trim().toLowerCase(); items = [];
      const cmds = [
        { label: 'New task', sub: 'C', fn: () => openCreate() }, { label: 'Report a bug', fn: () => openCreate({ type: 'bug' }) },
        { label: 'Go to My turn', fn: () => go({ v: 'myturn' }) }, { label: 'Open notifications', fn: () => openNotifs() }, ...(isAdmin() ? [{ label: 'Add members', fn: () => openSettings('workspace', 'invites') }] : []), { label: 'Go to Review', fn: () => go({ v: 'review' }) },
        { label: 'Go to Work', fn: () => go({ v: 'work' }) }, { label: 'Go to Bugs', fn: () => go({ v: 'bugs' }) }, { label: 'Go to Sprint', fn: () => go({ v: 'sprint' }) },
        { label: 'Go to Clients', fn: () => go({ v: 'clients' }) }, { label: 'Go to All tasks', fn: () => go({ v: 'all' }) }, { label: 'Go to Projects', fn: () => go({ v: 'projects' }) }, { label: 'Go to Access', fn: () => go({ v: 'vault' }) }, ...(canSeeMoney() ? [{ label: 'Go to Company', fn: () => go({ v: 'company' }) }] : []), { label: 'Going on leave', fn: () => openLeave() },
        ...S.views.map(v => ({ label: 'View: ' + v.name, fn: () => go({ v: 'view', id: v.id }) })), 
        { label: 'Open chat', fn: () => go({ v: 'chat' }) }, ...(isAdmin() ? [{ label: 'Client pages (status links)', fn: () => openSettings('workspace', 'clientlinks') }, { label: 'Insights', fn: () => go({ v: 'insights' }) }] : []), { label: 'New message to…', fn: () => pickDmPerson() }, { label: 'New channel…', fn: () => newChannel() },
        { label: 'Import tasks from a file…', fn: () => openImport() }, { label: 'Download the import template', fn: () => downloadTemplate() }, { label: 'Export…', fn: () => openExport() }, { label: 'Settings', fn: () => openSettings(isAdmin() ? 'workspace' : 'me') }, { label: 'Help & tours', fn: () => openHelp() },
        { label: 'Switch theme', fn: () => savePrefs({ theme: S.prefs.theme === 'dark' ? 'light' : 'dark' }) },
      ];
      // everything here was already limited by the server to what this person may see; admin-only places are left out below
      const nq = norm(q); const has = s => nq && norm(s).includes(nq);
      const tasks = topN(S.tasks.filter(t => { if (!q) return true; const x = idx(t); return x.k.includes(q) || (q.length > 2 && !!nq && x.d.includes(nq)); }), SORTS.updated, q ? 8 : 5);
      const more = [];
      if (q) {
        for (const p of S.projects.filter(p => has(p.name)).slice(0, 4)) more.push({ g: 'Projects', label: p.name, sub: pKind(p) === 'client' ? 'Client' : 'Our own', ic: 'folder', fn: () => go({ v: 'project', id: p.id }) });
        for (const p of S.projects) for (const d of (p.docs || []).filter(d => has(d.title) || (q.length > 2 && has(d.body))).slice(0, 3)) more.push({ g: 'Docs', label: d.title, sub: p.name, ic: 'folder', fn: () => { go({ v: 'project', id: p.id, tab: 'docs' }); setTimeout(() => openDoc(p, d), 200); } });
        for (const p of S.members.map(m => prof(m.user_id)).filter(p => p && p.id !== uid() && (has(dname(p)) || has(p.email))).slice(0, 4)) more.push({ g: 'People', label: dname(p), sub: 'Message', ic: 'person', fn: () => openDm(p.id) });
        for (const i of (V.items || []).filter(i => canOpenItem(i) && (has(i.name) || has(i.url) || has(i.kind))).slice(0, 4)) more.push({ g: 'Logins', label: i.name, sub: i.kind, ic: 'key', fn: () => { go({ v: 'vault' }); if (vaultUnlocked()) setTimeout(() => openLoginView(i), 200); } });
      }
      const c2 = cmds.filter(c => !q || c.label.toLowerCase().includes(q)).slice(0, q ? 8 : 6);
      box.replaceChildren();
      if (tasks.length) { box.append(h('div', { class: 'ph', text: 'Tasks' })); for (const t of tasks) items.push({ el: h('button', { class: 'opt' }, plate(t), h('span', { text: t.title, style: { flex: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }), stIcon(stOf(t.status_id))), fn: () => openTask(t.id) }); }
      items.forEach(i => box.append(i.el));
      let lastG = null;
      for (const m of more) { if (m.g !== lastG) { box.append(h('div', { class: 'ph', text: m.g })); lastG = m.g; } const it = { el: h('button', { class: 'opt' }, icon(m.ic, 16), h('span', { text: m.label, style: { flex: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }), m.sub ? h('span', { class: 'sub', text: m.sub }) : null), fn: m.fn }; items.push(it); box.append(it.el); }
      if (c2.length) { box.append(h('div', { class: 'ph', text: 'Actions' })); for (const c of c2) { const it = { el: h('button', { class: 'opt' }, h('span', { text: c.label, style: { flex: '1' } }), c.sub ? h('kbd', { text: c.sub }) : null), fn: c.fn }; items.push(it); box.append(it.el); } }
      if (!items.length) box.append(h('div', { class: 'hint', text: 'Nothing found' }));
      act = Math.min(act, items.length - 1); items.forEach((it, i) => { it.el.classList.toggle('act', i === act); it.el.onclick = () => { close(); it.fn(); }; });
    };
    inp.addEventListener('input', () => { act = 0; draw(); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); act = Math.min(items.length - 1, act + 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); act = Math.max(0, act - 1); draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); const it = items[act]; if (it) { close(); it.fn(); } }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    draw(); setTimeout(() => inp.focus(), 0);
  }
  function close() { el?.forEach(e => e.remove()); el = null; }
  return { open, close, get isOpen() { return !!el; } };
})();

