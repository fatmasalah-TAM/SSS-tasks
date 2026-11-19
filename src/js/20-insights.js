/* ═════════════ Insights: where tasks waited (built from each task's history) ═════════════ */
var insightsState = { days: 30, acts: null, loadedFor: null, loading: false };
async function loadInsightActs() {
  const key = S.ws.id + ':' + S.tasks.length + ':' + S.tasks.reduce((m, t) => (t.updated_at > m ? t.updated_at : m), '');
  if (insightsState.loadedFor === key || insightsState.loading) return;
  insightsState.loading = true;
  const ids = S.tasks.map(t => t.id); const out = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await sb.from('activity').select('*').in('task_id', ids.slice(i, i + 150));
    if (error) { insightsState.loading = false; insightsState.error = errText(error); render(); return; }
    out.push(...(data || []));
  }
  insightsState.acts = out; insightsState.loadedFor = key; insightsState.loading = false; insightsState.error = null;
  if (S.route.v === 'insights') render();
}
/** who held the turn, when: replay the task's history backwards from today, then forwards */
function turnSegments(t, acts) {
  const hist = acts.filter(a => a.task_id === t.id && ['status', 'developer', 'reviewer', 'flags'].includes(a.field)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const key = { status: 'status_id', developer: 'assignee_id', reviewer: 'reviewer_id', flags: 'flags' };
  const val = (f, v) => f === 'flags' ? (v ? String(v).split(',').filter(Boolean) : []) : (v || null);
  // undo every change (newest first) to get the state the task was created with
  let init = { status_id: t.status_id, assignee_id: t.assignee_id, reviewer_id: t.reviewer_id, flags: t.flags || [] };
  for (const a of hist.slice().reverse()) init = Object.assign({}, init, { [key[a.field]]: val(a.field, a.old_value) });
  const owner = s => {
    const f = s.flags || []; if (f.includes('waiting')) return 'client'; if (f.includes('decision')) return 'admins';
    const c = stOf(s.status_id)?.category; if (c === 'done' || c === 'canceled') return null;
    if (c === 'review') return s.reviewer_id || S.ws.default_reviewer || null;
    return s.assignee_id || null;
  };
  const segs = []; const end = t.completed_at && isClosed(t) ? t.completed_at : nowIso();
  const push = (who, from, to) => { if (!who || !from || !to || to <= from) return; const last = segs[segs.length - 1]; if (last && last.who === who && last.to === from) last.to = to; else segs.push({ who, from, to, task: t.id }); };
  let cur = init, from = t.created_at;
  for (const a of hist) { if (a.created_at < from) continue; push(owner(cur), from, a.created_at); cur = Object.assign({}, cur, { [key[a.field]]: val(a.field, a.new_value) }); from = a.created_at; }
  push(owner(cur), from, end);
  return segs;
}
function insightsData(days) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const acts = insightsState.acts || [];
  const per = new Map(); let handoffs = 0;
  for (const t of S.tasks) {
    for (const g of turnSegments(t, acts)) {
      const from = g.from < since ? since : g.from; if (g.to <= from) continue;
      const ms = new Date(g.to) - new Date(from);
      const p = per.get(g.who) || { who: g.who, ms: 0, turns: 0, longest: 0 };
      p.ms += ms; p.longest = Math.max(p.longest, ms); if (g.from >= since) { p.turns++; handoffs++; }
      per.set(g.who, p);
    }
  }
  const people = [...per.values()].sort((a, b) => b.ms - a.ms);
  const done = S.tasks.filter(t => t.completed_at && t.completed_at >= since && isClosed(t));
  const cycles = done.map(t => new Date(t.completed_at) - new Date(t.created_at)).sort((a, b) => a - b);
  const median = a => a.length ? a[Math.floor(a.length / 2)] : null;
  const stuck = S.tasks.filter(t => !isClosed(t) && t.turn_owner && catOf(t) !== 'backlog' && Date.now() - new Date(t.turn_since) > 3 * 864e5).sort((a, b) => a.turn_since.localeCompare(b.turn_since));
  const sendbacks = new Map();
  for (const a of acts) if (a.field === 'status' && a.created_at >= since) {
    const from = stOf(a.old_value)?.category, to = stOf(a.new_value)?.category;
    if (from === 'review' && (to === 'started' || to === 'unstarted')) { const t = taskOf(a.task_id); if (t?.assignee_id) sendbacks.set(t.assignee_id, (sendbacks.get(t.assignee_id) || 0) + 1); }
  }
  return { people, handoffs, done: done.length, cycle: median(cycles), stuck, sendbacks: [...sendbacks.entries()].sort((a, b) => b[1] - a[1]) };
}
const dur = ms => { if (ms == null) return '—'; const ar = typeof LANG !== 'undefined' && LANG === 'ar'; return ms < 3600e3 ? Math.max(1, Math.round(ms / 60e3)) + (ar ? ' دقيقة' : ' min') : ms < 2 * 864e5 ? Math.round(ms / 3600e3) + (ar ? ' ساعة' : ' h') : (ms / 864e5).toFixed(ms < 10 * 864e5 ? 1 : 0) + (ar ? ' يوم' : ' days'); };
const whoName = w => w === 'client' ? 'Waiting on the client' : w === 'admins' ? 'Needs a decision (admins)' : dname(prof(w)) || 'Former member';

function viewInsights() {
  if (!isAdmin()) return [pageHead('Insights'), h('div', { class: 'scroll' }, emptyState('ADMINS', 'Insights are for workspace admins.', null))];
  loadInsightActs(); track('insights');
  const days = insightsState.days;
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Period' }, ...[[14, '2 weeks'], [30, '30 days'], [90, '90 days']].map(([d, l]) => h('button', { 'aria-pressed': String(days === d), onclick: () => { insightsState.days = d; render(); } }, l)));
  const head = pageHead('Insights', h('span', { text: 'Where tasks waited, and for how long' }), h('button', { class: 'btn sm' + (isPhone() ? ' icon' : ''), 'aria-label': 'Weekly report', title: 'Weekly report', onclick: () => openWeeklyReport() }, icon('export', 14), isPhone() ? null : 'Weekly report'), seg);
  if (!insightsState.acts) return [head, h('div', { class: 'scroll' }, insightsState.error ? h('p', { class: 'note', style: { padding: '20px' }, text: insightsState.error }) : loadingRow('Reading the history of every task…'))];
  const d = insightsData(days);
  if (!d.people.length && !d.done) return [head, h('div', { class: 'scroll' }, emptyState('INSIGHTS', 'Not enough history yet. Insights fill in as tasks move between people.', null))];
  const max = Math.max(...d.people.map(p => p.ms), 1);
  const kpi = (n, l, sub) => h('div', { class: 'kpi' }, h('b', { text: n }), h('span', { text: l }), sub ? h('span', { class: 'sm mute', text: sub }) : null);
  const body = h('div', { class: 'ins' },
    h('div', { class: 'kpis' },
      kpi(String(d.done), 'tasks finished', `in the last ${days} days`),
      kpi(dur(d.cycle), 'typical time to finish', 'from created to done (median)'),
      kpi(String(d.handoffs), 'handoffs', '“over to you” moments'),
      kpi(String(d.stuck.length), 'stuck now', 'same person for 3+ days')),
    h('section', { class: 'card ins-card' }, h('h3', { text: 'Where tasks waited' }), h('p', { class: 'note', text: 'Total time tasks sat with each person (their turn), in this period.' }),
      ...d.people.map(p => h('div', { class: 'bar-row', 'data-who': p.who },
        p.who === 'client' || p.who === 'admins' ? h('span', { class: 'av lg none' }, h('span', { class: 'b', text: p.who === 'client' ? '⏳' : '⚖' })) : avatar(prof(p.who), { size: 'lg' }),
        h('div', { class: 'bar-main' },
          h('div', { class: 'bar-top' }, h('b', { text: whoName(p.who) }), h('span', { class: 'mono sm', text: dur(p.ms) })),
          h('div', { class: 'bar' }, h('i', { style: { width: Math.max(2, Math.round(p.ms / max * 100)) + '%', background: p.who === 'client' ? 'var(--amber)' : 'var(--accent)' } })),
          h('div', { class: 'sm mute', text: `${p.turns} handoff${p.turns === 1 ? '' : 's'} · longest ${dur(p.longest)}${p.turns ? ' · about ' + dur(p.ms / Math.max(1, p.turns)) + ' each' : ''}` }))))),
    h('section', { class: 'card ins-card' }, h('h3', { text: 'Stuck now' }), h('p', { class: 'note', text: 'Open tasks that have been with the same person for more than 3 days.' }),
      d.stuck.length ? h('div', { class: 'list' }, ...d.stuck.slice(0, 15).map(t => h('div', { class: 'stuck-row' }, taskRow(t), h('span', { class: 'meta red', text: `${whoName(t.turn_owner)} · ${dur(Date.now() - new Date(t.turn_since))}` })))) : h('p', { class: 'mute', text: 'Nothing is stuck. 🎉' })),
    h('section', { class: 'card ins-card' }, h('h3', { text: 'Sent back after review' }), h('p', { class: 'note', text: 'How often each developer’s work came back from review in this period.' }),
      d.sendbacks.length ? h('div', {}, ...d.sendbacks.map(([u, n]) => h('div', { class: 'sb-row' }, avatar(prof(u), { size: 'lg' }), h('b', { text: dname(prof(u)) }), h('span', { class: 'sp' }), h('span', { class: 'mono', text: `${n}×` })))) : h('p', { class: 'mute', text: 'Nothing was sent back. 👌' })));
  return [head, h('div', { class: 'scroll' }, body)];
}

