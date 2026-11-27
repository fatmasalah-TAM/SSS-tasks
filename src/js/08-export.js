/* ═════════════ export ═════════════ */
const EXPORT_PRESETS = {
  basic: ['key', 'title', 'type', 'status', 'developer', 'priority', 'due'],
  all: () => [...Object.keys(COLS), ...S.fields.map(f => 'f:' + f.id)],
  client: () => ['key', 'title', 'type', 'status', ...(clientField() ? ['f:' + clientField().id] : []), 'developer', 'due', 'completed'],
};
/* What each person may export: admins export the team's tasks; everyone else exports the tasks they work on
   (theirs, given to them, sent to them for review, or that they created). Never exported, for anyone: money,
   salaries, logins from Passwords, and (for members) other people's emails. */
const involvedIn = t => t.assignee_id === uid() || t.turn_owner === uid() || t.created_by === uid() || t.reviewer_id === uid() || waitsOf(t).some(w => w.user === uid() || w.by === uid());
const exportable = list => isAdmin() ? list : list.filter(involvedIn);
function openExport() {
  const st = { fmt: 'xlsx', scope: isAdmin() ? 'view' : 'mine', cols: EXPORT_PRESETS.basic.slice(), comments: 'none', email: false };
  openSheet({ title: 'Export', kind: 'center', key: 'export', build: sh => {
    const body = h('div', { class: 'sbody' });
    const draw = () => {
      const mine = S.tasks.filter(involvedIn); const viewN = exportable(visibleTasks()).length;
      const all = [...Object.keys(COLS), ...S.fields.map(f => 'f:' + f.id)];
      body.replaceChildren(
        h('div', { class: 'field', 'data-tour': 'export-format' }, 'Format', h('div', { class: 'seg', role: 'group' }, [['xlsx', 'Excel'], ['csv', 'CSV'], ['json', 'JSON'], ['md', 'Client summary']].map(([v, l]) => h('button', { 'aria-pressed': String(st.fmt === v), onclick: () => { st.fmt = v; draw(); } }, l)))),
        h('div', { class: 'field' }, 'Tasks', h('div', { class: 'seg', role: 'group' }, h('button', { 'aria-pressed': String(st.scope === 'view'), onclick: () => { st.scope = 'view'; draw(); } }, isAdmin() ? `This view (${viewN})` : `Mine in this view (${viewN})`), isAdmin() ? h('button', { 'aria-pressed': String(st.scope === 'all'), onclick: () => { st.scope = 'all'; draw(); } }, `Everything (${S.tasks.length})`) : null, h('button', { 'aria-pressed': String(st.scope === 'mine'), onclick: () => { st.scope = 'mine'; draw(); } }, `My work (${mine.length})`))),
        h('p', { class: 'note', 'data-export-note': '1', text: isAdmin() ? 'Money, salaries and logins from Passwords are never exported.' : 'You can export the tasks you work on. Money, salaries, logins and other people’s emails are never exported.' }),
        st.fmt === 'json' ? h('p', { class: 'note', text: 'JSON includes every field, the checklist and comments, ready to import into other tools.' }) :
          h('div', { class: 'field', 'data-tour': 'export-cols' }, 'Columns',
            h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, [['basic', 'Basic'], ['all', 'All fields'], ['client', 'Client report']].map(([k, l]) => h('button', { class: 'fchip', onclick: () => { const p = EXPORT_PRESETS[k]; st.cols = typeof p === 'function' ? p() : p.slice(); draw(); } }, l))),
            h('div', { class: 'grid2', style: { gap: '4px 12px', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))' } }, all.map(k => h('label', { class: 'check sm' }, h('input', { type: 'checkbox', checked: st.cols.includes(k), onchange: e => { if (e.target.checked) st.cols.push(k); else st.cols = st.cols.filter(x => x !== k); } }), colDef(k).n)))),
        st.fmt === 'csv' || st.fmt === 'xlsx' ? h('div', { style: { display: 'flex', gap: '18px', flexWrap: 'wrap' } },
          h('label', { class: 'check sm' }, h('input', { type: 'checkbox', checked: st.comments === 'last', onchange: e => { st.comments = e.target.checked ? 'last' : 'none'; } }), 'Add the last comment'),
          isAdmin() ? h('label', { class: 'check sm' }, h('input', { type: 'checkbox', checked: st.email, onchange: e => { st.email = e.target.checked; } }), 'Add developer email') : null,
          h('label', { class: 'check sm' }, h('input', { type: 'checkbox', checked: st.link !== false, onchange: e => { st.link = e.target.checked; } }), 'Add task link')) : null);
    };
    draw();
    const go_ = h('button', { class: 'btn pri' }, icon('export', 16), 'Export');
    go_.addEventListener('click', async () => {
      const done = busy(go_, 'Exporting…'); track('export'); try {
      const pickd = st.scope === 'view' ? visibleTasks() : st.scope === 'mine' ? S.tasks.filter(involvedIn) : S.tasks; if (!isAdmin()) st.email = false;
      const tasks = exportable(pickd).slice().sort((a, b) => (a.number || 0) - (b.number || 0));
      if (!tasks.length) { toast('Nothing of yours to export here'); return; }
      const stamp = todayIso(); const base = `${S.ws.prefix.toLowerCase()}-tasks-${stamp}`;
      if (st.fmt === 'json') {
        const ids = tasks.map(t => t.id); const { data: comments } = await sb.from('comments').select('*').in('task_id', ids);
        download(base + '.json', JSON.stringify({ workspace: S.ws.name, exported_at: nowIso(), statuses: S.statuses, types: S.types, fields: S.fields, projects: S.projects, people: S.members.map(m => Object.assign({ id: m.user_id, name: dname(prof(m.user_id)), role: m.role }, isAdmin() ? { email: prof(m.user_id)?.email } : {})), tasks: tasks.map(t => Object.assign({ key: taskKey(t), link: taskLink(t), status: stOf(t.status_id)?.name, type: tyOf(t.type_id)?.name, developer: dname(prof(t.assignee_id)) }, t, { comments: (comments || []).filter(c => c.task_id === t.id) })) }, null, 2), 'application/json');
      } else if (st.fmt === 'md') {
        const txt = clientSummary(tasks); await copyText(txt, 'Summary copied'); download(base + '.md', txt, 'text/markdown');
      } else {
        let last = {};
        if (st.comments === 'last') { const { data } = await sb.from('comments').select('*').in('task_id', tasks.map(t => t.id)).order('created_at', { ascending: true }); for (const c of data || []) last[c.task_id] = `${dname(prof(c.author_id))}: ${c.body}`; }
        const cols = st.cols.map(k => [k, colDef(k)]).filter(x => x[1]);
        const header = cols.map(([, c]) => c.n); if (st.email) header.push('Developer email'); if (st.comments === 'last') header.push('Last comment'); if (st.link !== false) header.push('Link');
        const q = v => { v = String(v ?? ''); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }; // a cell can never run as a formula
        const rows = tasks.map(t => { const r = cols.map(([, c]) => c.get(t)); if (st.email) r.push(prof(t.assignee_id)?.email || ''); if (st.comments === 'last') r.push(last[t.id] || ''); if (st.link !== false) r.push(taskLink(t)); return r; });
        if (st.fmt === 'xlsx') {
          const widths = header.map((hd, j) => Math.min(60, Math.max(10, String(hd).length + 2, ...rows.map(r => String(r[j] ?? '').length + 2))));
          const cell = v => { v = String(v ?? ''); return v.length > 32000 ? v.slice(0, 32000) + '…' : v; }; // Excel's limit per cell
          const blob = XL.book([{ name: 'Tasks', rows: [header.map(v => ({ v, s: 1 })), ...rows.map(r => r.map(v => ({ v: cell(v), s: 0 })))], widths, freeze: [0, 1], heights: { 0: 24 }, rtl: isAr() }]);
          downloadBlob(base + '.xlsx', blob);
          closeSheet(true); toast(`Exported ${tasks.length} task${tasks.length === 1 ? '' : 's'}`); return;
        }
        const lines = [header.map(q).join(',')];
        for (const r of rows) { lines.push(r.map(q).join(',')); }
        download(base + '.csv', '﻿' + lines.join('\r\n'), 'text/csv;charset=utf-8');
      }
      closeSheet(true); toast(`Exported ${tasks.length} task${tasks.length === 1 ? '' : 's'}`);
      } finally { done(); }
    });
    sh.append(body, h('div', { class: 'sfoot' }, h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), go_));
  } });
  tours.request('export');
}
function clientSummary(tasks) {
  const cf = clientField(); const by = {};
  for (const t of tasks) { const k = cf ? (fieldText(t, cf) || 'No client') : (pjOf(t.project_id)?.name || 'No project'); (by[k] ||= []).push(t); }
  const out = [`*${S.ws.name} · status update · ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}*`, ''];
  for (const [k, list] of Object.entries(by)) {
    const done = list.filter(t => catOf(t) === 'done'); const rev = list.filter(t => catOf(t) === 'review'); const prog = list.filter(t => catOf(t) === 'started'); const wait = list.filter(t => t.turn_owner === 'client');
    const plan = list.filter(t => catOf(t) === 'unstarted' && t.turn_owner !== 'client');
    out.push(`*${k}*: ${done.length} done, ${rev.length} in review, ${prog.length} in progress, ${plan.length} planned${wait.length ? `, ${wait.length} waiting on you` : ''}`);
    for (const t of [...done.slice(0, 5)]) out.push(`✓ ${t.title}`);
    for (const t of rev.concat(prog).slice(0, 6)) out.push(`• ${t.title} (${stOf(t.status_id)?.name})`);
    for (const t of plan.slice(0, 5)) out.push(`◦ ${t.title} (planned)`);
    for (const t of wait) out.push(`⏳ ${t.title}: waiting on your reply`);
    out.push('');
  }
  return out.join('\n').trim();
}
async function fullBackup() {
  toast('Preparing backup…');
  const ids = S.tasks.map(t => t.id);
  const [{ data: comments }, { data: activity }] = await Promise.all([sb.from('comments').select('*').in('task_id', ids), sb.from('activity').select('*').in('task_id', ids)]);
  download(`${S.ws.prefix.toLowerCase()}-backup-${todayIso()}.json`, JSON.stringify({ workspace: S.ws, members: S.members, profiles: S.members.map(m => prof(m.user_id)), statuses: S.statuses, types: S.types, fields: S.fields, rules: S.rules, views: S.views.filter(v => v.shared || v.owner_id === uid()), projects: S.projects, tasks: S.tasks, comments, activity }, null, 2), 'application/json');
}

