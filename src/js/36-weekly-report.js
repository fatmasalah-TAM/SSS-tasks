/* ═════════════ Weekly report for leadership: what the team delivered, who worked on what, who can take more ═════════════ */
// Built from the tasks and their history. Opens as a clean document the PM can save as PDF or paste into an email.
var reportState = { week: 'this' };
const R = (en, ar) => (typeof LANG !== 'undefined' && LANG === 'ar' ? ar : en); // sentences built from numbers are written in both languages here
function weekBounds(which) {
  const now = new Date(); const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() - WEEK.first + 7) % 7)); // the week starts on the local first day (Sunday in Egypt, Monday in most places)
  if (which === 'last') { const end = new Date(start); start.setDate(start.getDate() - 7); return { from: start, to: end, label: 'Last week' }; }
  return { from: start, to: now, label: 'This week' };
}
const inRange = (iso, b) => !!iso && new Date(iso) >= b.from && new Date(iso) < b.to;
const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function reportData(which) {
  const b = weekBounds(which); const acts = insightsState.acts || [];
  const today = isoDay(new Date()); const in7 = isoDay(new Date(Date.now() + 7 * 864e5));
  const tasks = S.tasks.filter(t => !t.parent_id);
  const statusActs = acts.filter(a => a.field === 'status' && inRange(a.created_at, b));
  const cat = id => stOf(id)?.category;
  const done = tasks.filter(t => catOf(t) === 'done' && inRange(t.completed_at, b));
  const startedIds = new Set(statusActs.filter(a => cat(a.new_value) === 'started' && ['unstarted', 'backlog'].includes(cat(a.old_value))).map(a => a.task_id));
  const sentBack = statusActs.filter(a => cat(a.old_value) === 'review' && ['started', 'unstarted'].includes(cat(a.new_value)));
  const added = tasks.filter(t => inRange(t.created_at, b));
  const open = tasks.filter(t => !isClosed(t));
  const overdue = open.filter(t => t.due_date && t.due_date < today && catOf(t) !== 'backlog');
  const review = open.filter(t => catOf(t) === 'review');
  const doing = open.filter(t => catOf(t) === 'started');
  const waitingClient = open.filter(t => (t.flags || []).includes('waiting'));
  const decision = open.filter(t => (t.flags || []).includes('decision'));
  const stuck = open.filter(t => t.turn_owner && catOf(t) !== 'backlog' && Date.now() - new Date(t.turn_since) > 3 * 864e5 && !(t.flags || []).includes('waiting'));
  const comingUp = open.filter(t => t.due_date && t.due_date >= today && t.due_date <= in7).sort((a, c) => a.due_date.localeCompare(c.due_date));
  const people = S.members.map(m => {
    const id = m.user_id; const mine = open.filter(t => t.assignee_id === id);
    const active = mine.filter(t => ['unstarted', 'started'].includes(catOf(t))); const late = mine.filter(t => overdue.includes(t));
    const toReview = review.filter(t => (t.reviewer_id || S.ws.default_reviewer) === id);
    const fin = done.filter(t => t.assignee_id === id);
    const work = active.length + toReview.length * 0.5; // reviewing is lighter than building
    const cap = late.length >= 2 || work > 6 ? ['full', 'Full this week', 'Finish or move current work before adding more.']
      : work > 3 || late.length === 1 ? ['some', 'Room for 1–2 small tasks', 'Busy, but can take something small.']
      : ['free', 'Can take new tasks', 'Light load right now.'];
    return { id, name: dname(prof(id)) || 'Former member', fin, now: mine.filter(t => catOf(t) === 'started'), next: mine.filter(t => catOf(t) === 'unstarted'), inReview: mine.filter(t => catOf(t) === 'review'), toReview, late, active, cap,
      sentBack: sentBack.filter(a => taskOf(a.task_id)?.assignee_id === id).length };
  }).filter(p => p.fin.length || p.now.length || p.next.length || p.inReview.length || p.toReview.length || p.late.length) // an account with no work (a second email, someone who left) adds nothing
    .sort((a, c) => c.fin.length - a.fin.length || c.active.length - a.active.length);
  for (const p of people) if (people.some(o => o !== p && o.name.toLowerCase() === p.name.toLowerCase())) p.name += ` (${(prof(p.id)?.email || '').split('@')[1] || 'other'})`;
  const cf = clientField();
  const groupOf = t => { if (cf) { const v = (t.fields || {})[cf.id]; const id = Array.isArray(v) ? v[0] : v; const o = (cf.options || []).find(x => x.id === id); if (o) return o.label; } return S.projects.find(p => p.id === t.project_id)?.name || 'Other'; };
  const delivered = {}; for (const t of done) (delivered[groupOf(t)] = delivered[groupOf(t)] || []).push(t);
  return { b, done, started: startedIds.size, sentBack: sentBack.length, added, open, overdue, review, doing, waitingClient, decision, stuck, comingUp, people, delivered, bugsFixed: done.filter(isBug).length };
}
const rangeText = b => { const last = new Date(b.to - 1); return `${fmtDate(isoDay(b.from))} – ${fmtDate(isoDay(last))}`; };
function reportSummary(d) {
  const free = d.people.filter(p => p.cap[0] === 'free').map(p => first(prof(p.id)) || p.name); const full = d.people.filter(p => p.cap[0] === 'full').map(p => first(prof(p.id)) || p.name);
  let s = R(`The team finished ${d.done.length} task${d.done.length === 1 ? '' : 's'}${d.bugsFixed ? ` (${d.bugsFixed} bug fix${d.bugsFixed === 1 ? '' : 'es'})` : ''}, started ${d.started}, and has ${d.review.length} waiting for review.`,
    `الفريق خلّص ${d.done.length} مهمة${d.bugsFixed ? ` (منها ${d.bugsFixed} تصليح باج)` : ''}، وبدأ ${d.started}، و${d.review.length} مستنية المراجعة.`);
  // name people when it's a handful; give a count when the team is big
  const names = (arr, sepEn, sepAr) => arr.length > 4 ? null : R(arr.join(sepEn), arr.join(sepAr));
  if (free.length) s += names(free, ', ', '، ') ? R(` ${names(free, ', ', '، ')} can take new work.`, ` ${names(free, ', ', '، ')} ${free.length === 1 ? 'يقدر ياخد' : 'يقدروا ياخدوا'} شغل جديد.`) : R(` ${free.length} people can take new work.`, ` ${free.length} شخص يقدروا ياخدوا شغل جديد.`);
  if (full.length) s += names(full, ', ', '، ') ? R(` ${names(full, ', ', '، ')} ${full.length === 1 ? 'is' : 'are'} at full capacity.`, ` ${names(full, ', ', '، ')} ${full.length === 1 ? 'مليان' : 'مليانين'} الأسبوع ده.`) : R(` ${full.length} people are at full capacity.`, ` ${full.length} شخص مليانين الأسبوع ده.`);
  if (d.overdue.length) s += R(` ${d.overdue.length} task${d.overdue.length === 1 ? ' is' : 's are'} past due.`, ` ${d.overdue.length} مهمة عدّى ميعادها.`);
  return s;
}
function reportDoc(d, print) {
  const M = print ? { del: 4, att: 4, per: 3, up: 6 } : { del: 12, att: 8, per: 5, up: 12 };
  const li = (t, extra) => h('li', {}, h('span', { class: 'rp-key', text: taskKey(t) }), ' ', h('span', { class: 'rp-t', dir: 'auto', text: t.title }), extra ? h('span', { class: 'rp-x notr', text: ' · ' + extra }) : null);
  const list = (arr, max, extra) => arr.length ? h('ul', { class: 'rp-list' }, ...arr.slice(0, max).map(t => li(t, extra?.(t))), arr.length > max ? h('li', { class: 'rp-more', text: `+ ${arr.length - max} more` }) : null) : h('p', { class: 'rp-none', text: 'None' });
  const stat = (n, l) => h('div', { class: 'rp-stat' }, h('b', { text: String(n) }), h('span', { text: l }));
  const who = t => t.assignee_id ? first(prof(t.assignee_id)) : R('Unassigned', 'من غير مسؤول');
  return h('article', { class: 'report-doc' + (print ? ' rp-print' : '') },
    h('header', { class: 'rp-head' },
      h('div', {}, h('div', { class: 'rp-eyebrow', text: `${S.ws.name} · weekly team report` }), h('h1', { text: `${d.b.label}: ${rangeText(d.b)}` })),
      h('div', { class: 'rp-meta' }, h('span', { text: `Prepared by ${dname(me())}` }), h('span', { text: fmtDT(nowIso()) }))),
    h('p', { class: 'rp-summary notr', text: reportSummary(d) }),
    h('div', { class: 'rp-stats' }, stat(d.done.length, 'Finished'), stat(d.started, 'Started'), stat(d.review.length, 'In review'), stat(d.added.length, 'New requests'), stat(d.sentBack, 'Sent back'), stat(d.overdue.length, 'Past due')),
    h('section', { class: 'rp-sec' }, h('h2', { text: 'Delivered this week' }),
      Object.keys(d.delivered).length ? h('div', { class: 'rp-groups' }, ...Object.entries(d.delivered).sort((a, c) => c[1].length - a[1].length).map(([g, arr]) => h('div', { class: 'rp-group' }, h('h3', { dir: 'auto', text: `${g} (${arr.length})` }), list(arr, M.del, who))))
        : h('p', { class: 'rp-none', text: 'Nothing was finished in this period.' })),
    // who can take work: the answer a CEO wants first, in three short lines however big the team is
    print ? null : h('section', { class: 'rp-sec' }, h('h2', { text: 'Who can take new work' }),
      h('div', { class: 'rp-capgroups' }, ...[['free', 'Can take new tasks'], ['some', 'Room for 1–2 small tasks'], ['full', 'Full this week']].map(([k, l]) => {
        const ps = d.people.filter(p => p.cap[0] === k);
        return h('div', { class: 'rp-capg' }, h('span', { class: 'rp-cap ' + k, text: `${l} (${ps.length})` }), h('span', { class: 'rp-names notr', text: ps.length ? ps.map(p => p.name).join(R(', ', '، ')) : '—' }));
      })),
      h('p', { class: 'rp-note', text: 'Capacity is based on each person’s open tasks (reviews count half) and anything past due.' })),
    // one row per person: fits 5 or 50 people on a page
    h('section', { class: 'rp-sec' }, h('h2', { text: 'The team at a glance' }),
      h('div', { class: 'rp-tablewrap' }, h('table', { class: 'rp-table' },
        h('thead', {}, h('tr', {}, ...['Person', 'Finished', 'In progress', 'Up next', 'To review', 'Past due', 'Capacity'].map((c, i) => h('th', { class: i && i < 6 ? 'num' : null, text: c })))),
        h('tbody', {}, ...d.people.map(p => h('tr', { class: p.late.length ? 'late' : null },
          h('td', { class: 'notr' }, h('b', { text: p.name })), ...[p.fin.length, p.now.length, p.next.length, p.toReview.length, p.late.length].map((n, i) => h('td', { class: 'num' + (i === 4 && n ? ' bad' : ''), text: n ? String(n) : '–' })),
          h('td', {}, h('span', { class: 'rp-cap ' + p.cap[0], text: p.cap[1] }))))),
        h('tfoot', {}, h('tr', {}, h('td', { text: R(`${d.people.length} people`, `${d.people.length} شخص`), class: 'notr' }), ...['fin', 'now', 'next', 'toReview', 'late'].map(k => h('td', { class: 'num', text: String(d.people.reduce((n, p) => n + p[k].length, 0)) })), h('td')))))),
    // the detail behind each row (kept short when the team is big)
    h('section', { class: 'rp-sec' }, h('h2', { text: 'What each person worked on' }),
      h('div', { class: 'rp-people' + (d.people.length > 8 ? ' big' : '') }, ...d.people.map(p => { const big = print || d.people.length > 8, n = print ? M.per : big ? 3 : 5; return h('div', { class: 'rp-person' },
        h('div', { class: 'rp-p-head' }, h('b', { class: 'notr', text: p.name }), h('span', { class: 'rp-cap ' + p.cap[0], text: p.cap[1] })),
        p.fin.length ? h('div', {}, h('h4', { text: 'Finished' }), list(p.fin, n)) : null,
        p.now.length ? h('div', {}, h('h4', { text: 'Working on now' }), list(p.now, n)) : null,
        !big && p.next.length ? h('div', {}, h('h4', { text: 'Up next' }), list(p.next, 3)) : null,
        !p.fin.length && !p.now.length ? h('p', { class: 'rp-none', text: 'Nothing finished or in progress this week.' }) : null); }))),
    h('section', { class: 'rp-sec' }, h('h2', { text: 'Needs attention' }),
      h('div', { class: 'rp-groups' },
        h('div', { class: 'rp-group' }, h('h3', { text: `Past due (${d.overdue.length})` }), list(d.overdue, M.att, t => `${who(t)} · ${R('due', 'ميعادها')} ${fmtDate(t.due_date)}`)),
        h('div', { class: 'rp-group' }, h('h3', { text: `Stuck 3+ days (${d.stuck.length})` }), list(d.stuck, M.att, t => R(`with ${first(prof(t.turn_owner)) || turnName(t.turn_owner)} for ${ago(t.turn_since)}`, `عند ${first(prof(t.turn_owner)) || turnName(t.turn_owner)} من ${ago(t.turn_since)}`))),
        h('div', { class: 'rp-group' }, h('h3', { text: `Waiting on clients (${d.waitingClient.length})` }), list(d.waitingClient, M.att)),
        h('div', { class: 'rp-group' }, h('h3', { text: `Needs a decision (${d.decision.length})` }), list(d.decision, M.att)))),
    h('section', { class: 'rp-sec' }, h('h2', { text: 'Coming up (next 7 days)' }), list(d.comingUp, M.up, t => `${who(t)} · ${R('due', 'ميعادها')} ${fmtDate(t.due_date)}`)),
    h('footer', { class: 'rp-foot', text: `Made with Ovrto from live task data · ${S.ws.name}` }));
}
function reportText(d) {
  const T = x => (typeof LANG !== 'undefined' && LANG === 'ar' ? I18N.tr(x) : x);
  const L = []; const line = t => `• ${taskKey(t)} ${t.title}`;
  L.push(`*${T(`${S.ws.name} · weekly team report`)}*`, T(`${d.b.label}: ${rangeText(d.b)}`), '', reportSummary(d), '');
  L.push([[d.done.length, 'Finished'], [d.started, 'Started'], [d.review.length, 'In review'], [d.added.length, 'New requests'], [d.sentBack, 'Sent back'], [d.overdue.length, 'Past due']].map(([n, l]) => `${T(l)} ${n}`).join(' · '), '');
  L.push(`*${T('Delivered this week')}*`); for (const [g, arr] of Object.entries(d.delivered)) { L.push(`${g}:`); arr.slice(0, 12).forEach(t => L.push(line(t))); } if (!d.done.length) L.push(T('Nothing was finished in this period.'));
  L.push('', `*${T('The team')}*`);
  for (const p of d.people) {
    L.push(`${p.name} — ${T(p.cap[1])} (${R(`${p.fin.length} finished, ${p.now.length} in progress, ${p.next.length} up next${p.late.length ? `, ${p.late.length} past due` : ''}`, `${p.fin.length} خلصت، ${p.now.length} شغّال فيها، ${p.next.length} الجاية${p.late.length ? `، ${p.late.length} عدّى ميعادها` : ''}`)})`);
    p.now.slice(0, d.people.length > 8 ? 1 : 3).forEach(t => L.push(`  ${R('now', 'دلوقتي')}: ${taskKey(t)} ${t.title}`));
  }
  if (d.overdue.length || d.stuck.length || d.waitingClient.length) {
    L.push('', `*${T('Needs attention')}*`);
    d.overdue.slice(0, 8).forEach(t => L.push(`${line(t)} (${R('past due', 'عدّى ميعادها')} ${fmtDate(t.due_date)})`));
    d.stuck.slice(0, 8).forEach(t => L.push(`${line(t)} (${R('stuck with', 'واقفة عند')} ${turnName(t.turn_owner)})`));
    d.waitingClient.slice(0, 8).forEach(t => L.push(`${line(t)} (${R('waiting on client', 'مستنية العميل')})`));
  }
  return L.join('\n');
}
function printReport(doc) {
  document.getElementById('print-root')?.remove();
  const root = h('div', { id: 'print-root', dir: document.documentElement.dir || 'ltr' }, doc.cloneNode(true));
  document.body.append(root); document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); root.remove(); removeEventListener('afterprint', done); };
  addEventListener('afterprint', done); setTimeout(() => { try { window.print(); } catch {} setTimeout(done, 60e3); }, 80);
}
function openWeeklyReport() {
  if (!isAdmin()) return toast('The weekly report is for admins');
  track('weekly_report');
  openSheet({ title: 'Weekly report', kind: 'right', full: true, key: 'report', build: async sh => {
    const body = h('div', { class: 'sbody report-body' }, loadingRow('Reading this week’s work…'));
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Week' });
    const pdf = h('button', { class: 'btn pri' }, icon('export', 16), 'Save as PDF');
    const copy = h('button', { class: 'btn' }, 'Copy for email');
    sh.append(h('div', { class: 'report-bar' }, seg, h('span', { class: 'sp' }), copy, pdf), body);
    await loadInsightActs();
    let d, doc;
    const draw = () => {
      seg.replaceChildren(...[['this', 'This week'], ['last', 'Last week']].map(([k, l]) => h('button', { 'aria-pressed': String(reportState.week === k), onclick: () => { reportState.week = k; draw(); } }, l)));
      d = reportData(reportState.week); doc = reportDoc(d); body.replaceChildren(doc);
    };
    pdf.onclick = () => printReport(reportDoc(d, true));
    copy.onclick = () => copyText(reportText(d), 'Report copied. Paste it into your email or WhatsApp');
    draw();
  } });
}

