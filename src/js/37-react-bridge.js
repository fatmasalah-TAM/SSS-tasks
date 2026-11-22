/* ═════════════ Time on tasks: a timer, or time added by hand ═════════════
   One timer runs per person. Everyone in the workspace sees the hours; each person edits only their own.
   Hours also suggest each project's share of the team's time (money stays team totals only). */
const timeMin = e => e.minutes != null ? e.minutes : Math.max(1, Math.round(((e.ended_at ? new Date(e.ended_at) : new Date()) - new Date(e.started_at)) / 60000));
const fmtDur = m => { m = Math.round(m || 0); const hh = Math.floor(m / 60), mm = m % 60; return hh ? `${hh}h${mm ? ' ' + mm + 'm' : ''}` : `${mm}m`; };
const isRunning = e => !e.ended_at && e.minutes == null;
const myTimer = () => (S.time || []).find(e => e.user_id === uid() && isRunning(e)) || null;
const taskTime = id => (S.time || []).filter(e => e.task_id === id);

async function startTimer(t) {
  const was = myTimer();
  if (was) { if (was.task_id === t.id) return; await stopTimer(true); toast(`Stopped the timer on ${taskKey(taskOf(was.task_id) || {})}`); }
  const row = { id: uuid(), workspace_id: S.ws.id, task_id: t.id, user_id: uid(), started_at: nowIso(), ended_at: null, minutes: null, note: null };
  S.time = [row, ...(S.time || [])]; refresh(); syncTimerPill();
  const { error } = await sb.from('task_time').insert(row);
  if (error) { S.time = S.time.filter(e => e !== row); refresh(); syncTimerPill(); return toast(errText(error)); }
}
async function stopTimer(quiet) {
  const e = myTimer(); if (!e) return;
  const end = nowIso(); e.ended_at = end; refresh(); syncTimerPill();
  const { error } = await sb.from('task_time').update({ ended_at: end }).eq('id', e.id);
  if (error) { e.ended_at = null; refresh(); syncTimerPill(); return toast(errText(error)); }
  if (!quiet) toast(`${fmtDur(timeMin(e))} added to ${taskKey(taskOf(e.task_id) || {})}`);
}
async function removeTime(e) {
  S.time = S.time.filter(x => x !== e); refresh(); syncTimerPill();
  const { error } = await sb.from('task_time').delete().eq('id', e.id);
  if (error) { S.time = [e, ...S.time]; refresh(); syncTimerPill(); return toast(errText(error)); }
  toast('Time removed');
}
function openAddTime(t) {
  openSheet({ title: `Add time to ${taskKey(t)}`, kind: 'center', stack: true, key: 'addtime', build: sh => {
    const hrs = h('input', { type: 'number', id: 'tmH', min: '0', max: '168', step: '1', value: '1', inputmode: 'numeric', 'aria-label': 'Hours' });
    const mins = h('input', { type: 'number', id: 'tmM', min: '0', max: '59', step: '5', value: '0', inputmode: 'numeric', 'aria-label': 'Minutes' });
    const day = h('input', { type: 'date', id: 'tmD', value: todayIso(), max: todayIso(), 'aria-label': 'Day' });
    const note = h('input', { type: 'text', id: 'tmN', maxlength: '300', placeholder: 'What you did (optional)' });
    const save = h('button', { class: 'btn pri', 'data-time-save': '1' }, 'Add time');
    save.addEventListener('click', async () => {
      const m = (Number(hrs.value) || 0) * 60 + (Number(mins.value) || 0);
      if (!(m > 0)) return toast('Add at least one minute');
      if (m > 10080) return toast('That’s more than a week. Add it in parts');
      if (!day.value || day.value > todayIso()) return toast('Pick a day up to today');
      const row = { id: uuid(), workspace_id: S.ws.id, task_id: t.id, user_id: uid(), started_at: new Date(day.value + 'T09:00:00').toISOString(), ended_at: null, minutes: m, note: note.value.trim() || null };
      const done = busy(save, 'Saving…'); const { error } = await sb.from('task_time').insert(row); done();
      if (error) return toast(errText(error));
      S.time = [row, ...(S.time || [])]; closeSheet(true); refresh(); toast(`${fmtDur(m)} added to ${taskKey(t)}`);
    });
    sh.append(h('div', { class: 'sbody' }, h('div', { class: 'grid2' }, h('label', { class: 'field' }, 'Hours', hrs), h('label', { class: 'field' }, 'Minutes', mins)),
      h('label', { class: 'field' }, 'Day', day), h('label', { class: 'field' }, 'Note', note)),
      h('div', { class: 'sfoot' }, h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), h('span', { class: 'sp' }), save));
    setTimeout(() => hrs.select(), 50);
  } });
}
/* the block in a task's side panel */
function timeBlock(t) {
  const es = taskTime(t.id); const total = es.reduce((n, e) => n + timeMin(e), 0);
  const run = myTimer(); const mine = run && run.task_id === t.id;
  const per = {}; for (const e of es) per[e.user_id] = (per[e.user_id] || 0) + timeMin(e);
  const ppl = Object.entries(per).sort((a, b) => b[1] - a[1]);
  return h('div', { class: 'timebox', 'data-time': t.id },
    h('h4', { text: 'Time' }),
    h('div', { class: 'timetop' }, h('b', { class: 'ttotal', 'data-time-total': '1', text: es.length ? fmtDur(total) : 'None yet' }),
      h('button', { class: 'btn sm' + (mine ? ' pri' : ''), 'data-timer': mine ? 'stop' : 'start', onclick: () => mine ? stopTimer() : startTimer(t) }, icon(mine ? 'pause' : 'play', 14), mine ? 'Stop' : 'Start timer'),
      h('button', { class: 'btn sm ghost', 'data-time-add': '1', onclick: () => openAddTime(t) }, icon('plus', 14), 'Add')),
    ppl.length ? h('div', { class: 'tpeople' }, ppl.map(([u, m]) => h('div', { class: 'tperson' }, avatar(prof(u), { size: 'xs' }), h('span', { class: 'grow', text: first(prof(u)) || 'Someone' }), h('span', { class: 'mono sm', text: fmtDur(m) })))) : null,
    es.filter(e => e.user_id === uid() && !isRunning(e)).slice(0, 5).map(e => h('div', { class: 'tentry sm mute' }, h('span', { class: 'grow', text: `${fmtDur(timeMin(e))} · ${fmtDate(e.started_at.slice(0, 10))}${e.note ? ' · ' + e.note : ''}` }),
      h('button', { class: 'x', 'aria-label': 'Remove this time', onclick: () => removeTime(e) }, icon('x', 12)))));
}
/* the running timer stays visible on every page */
function syncTimerPill() {
  const e = myTimer(); let el = $('#timerPill');
  if (!e) { el?.remove(); return; }
  const t = taskOf(e.task_id);
  if (!el) { el = h('div', { id: 'timerPill', class: 'timerpill', role: 'status' }); document.body.append(el); }
  el.replaceChildren(h('button', { class: 'tp-open', onclick: () => t && openTask(t.id), title: t?.title || '' }, h('span', { class: 'tp-dot', 'aria-hidden': 'true' }), h('span', { class: 'mono', text: t ? taskKey(t) : '' }), h('span', { class: 'tp-t', text: fmtDur(timeMin(e)) })),
    h('button', { class: 'tp-stop', 'aria-label': 'Stop the timer', onclick: () => stopTimer() }, icon('pause', 14)));
}
setInterval(() => { if (myTimer()) { syncTimerPill(); const b = $('.timebox [data-time-total]'); if (b) { const id = b.closest('.timebox').dataset.time; b.textContent = fmtDur(taskTime(id).reduce((n, e) => n + timeMin(e), 0)); } } }, 20000);
/* hours per project over the last 90 days: a suggestion for its share of the team's time */
function timeShare(pid) {
  const since = Date.now() - 90 * 864e5; const es = (S.time || []).filter(e => new Date(e.started_at) > since);
  const all = es.reduce((n, e) => n + timeMin(e), 0); if (all < 60) return null;
  const mine = es.filter(e => taskOf(e.task_id)?.project_id === pid).reduce((n, e) => n + timeMin(e), 0);
  return Math.round(100 * mine / all);
}

/* ═════════════ Project timeline: when each task runs, and what it waits on ═════════════
   A task can start on a date and wait on other tasks (they must finish first). The project's Timeline tab
   draws one bar per scheduled task; anything without dates is listed underneath so it isn't forgotten. */
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);
const blockersOf = t => (t.blocked_by || []).map(taskOf).filter(Boolean);
const openBlockers = t => blockersOf(t).filter(b => !isClosed(b));
/* would making `t` wait on `b` close a loop (b already waits on t, directly or further down)? */
function makesLoop(t, b) {
  const seen = new Set(); const stack = [b.id];
  while (stack.length) { const id = stack.pop(); if (id === t.id) return true; if (seen.has(id)) continue; seen.add(id); const x = taskOf(id); if (x) stack.push(...(x.blocked_by || [])); }
  return false;
}
function pickBlocker(anchor, t) {
  const opts = S.tasks.filter(x => x.id !== t.id && !(t.blocked_by || []).includes(x.id) && !isClosed(x))
    .sort((a, b) => (a.project_id === t.project_id ? 0 : 1) - (b.project_id === t.project_id ? 0 : 1) || b.number - a.number)
    .map(x => ({ v: x.id, label: `${taskKey(x)} ${x.title}`, sub: x.project_id === t.project_id ? '' : (pjOf(x.project_id)?.name || '') }));
  picker(anchor, { options: opts, value: null, onPick: v => {
    const b = taskOf(v); if (!b) return;
    if (makesLoop(t, b)) return toast(`${taskKey(b)} already waits on this task`);
    patchTask(t.id, { blocked_by: [...(t.blocked_by || []), v] }, { toast: `Waits on ${taskKey(b)} now` });
  } });
}
/* the rows in a task's side panel: Starts goes before Due, Waits on after it */
function startRow(t, row, pick) {
  row('Starts', pick(t.start_date ? fmtDate(t.start_date) : 'No date', e => pickDate(e.currentTarget, t.start_date, v => {
    if (v && t.due_date && v > t.due_date) return toast('The start has to be on or before the due date');
    patchTask(t.id, { start_date: v });
  }), !t.start_date));
}
function waitsRow(t, row) {
  const bs = blockersOf(t);
  row('Waits on', h('div', { class: 'blockers' },
    bs.map(b => h('span', { class: 'blk' + (isClosed(b) ? ' done' : ''), 'data-blocker': b.id }, h('button', { class: 'lnk', onclick: () => openTask(b.id), text: taskKey(b), title: b.title }),
      h('button', { class: 'x', 'aria-label': `Stop waiting on ${taskKey(b)}`, onclick: () => patchTask(t.id, { blocked_by: (t.blocked_by || []).filter(id => id !== b.id) }) }, icon('x', 12)))),
    h('button', { class: 'pick blank', 'data-add-blocker': '1', onclick: e => pickBlocker(e.currentTarget, t) }, h('span', { text: bs.length ? '+ Add' : 'Not waiting on anything' }))), 'Tasks that must finish before this one can start');
}
/* the timeline tab */
function projectTimeline(p) {
  const ts = pTasks(p.id).filter(t => catOf(t) !== 'canceled');
  const dated = ts.filter(t => t.start_date || t.due_date).map(t => ({ t, s: t.start_date || t.due_date, e: t.due_date || t.start_date })).sort((a, b) => a.s.localeCompare(b.s) || a.e.localeCompare(b.e));
  const undated = ts.filter(t => !t.start_date && !t.due_date && !isClosed(t));
  const today = todayIso();
  const out = [];
  if (!dated.length) out.push(emptyState('NO DATES YET', 'Give tasks a start and a due date to see them on the timeline. Open a task and set "Starts" and "Due".', null));
  else {
    let from = dated.reduce((m, x) => x.s < m ? x.s : m, dated[0].s), to = dated.reduce((m, x) => x.e > m ? x.e : m, dated[0].e);
    if (today < from) from = today; if (today > to) to = today;
    from = addDays(from, -1); to = addDays(to, 2);
    const minDays = isPhone() ? 12 : 28; if (dayDiff(from, to) + 1 < minDays) to = addDays(from, minDays - 1); /* short plans still fill the width */
    const days = dayDiff(from, to) + 1; const W = isPhone() ? 22 : 30;
    const pos = d => dayDiff(from, d) * W;
    const heads = []; for (let i = 0; i < days; i++) { const d = addDays(from, i); const dd = new Date(d + 'T00:00:00Z'); heads.push(h('div', { class: 'tl-day' + (d === today ? ' today' : '') + ([5, 6].includes(dd.getUTCDay()) ? ' wk' : ''), style: { width: W + 'px' }, title: fmtDate(d) },
      dd.getUTCDate() === 1 || i === 0 ? h('b', { text: dd.toLocaleDateString(isAr() ? 'ar-EG' : 'en-GB', { month: 'short', timeZone: 'UTC' }) }) : null, h('span', { text: String(dd.getUTCDate()) }))); }
    const rows = dated.map(({ t, s, e }) => {
      const cat = catOf(t); const late = !isClosed(t) && t.due_date && t.due_date < today; const blocked = openBlockers(t);
      const bar = h('button', { class: 'tl-bar' + (late ? ' late' : '') + (isClosed(t) ? ' done' : '') + (blocked.length ? ' blocked' : ''), 'data-tl': t.id,
        style: { insetInlineStart: pos(s) + 'px', width: Math.max(W, (dayDiff(s, e) + 1) * W) + 'px', '--c': `var(--st-${cat})` },
        title: `${taskKey(t)} ${t.title}`, onclick: () => openTask(t.id) }, h('span', { text: t.title }));
      return h('div', { class: 'tl-row' },
        h('div', { class: 'tl-name' }, h('span', { class: 'mono sm mute', text: taskKey(t) }), h('span', { class: 'tl-t', text: shortTitle(t.title, p.name) }),
          blocked.length ? h('span', { class: 'tl-wait sm', text: `waits on ${blocked.map(taskKey).join(', ')}` }) : null,
          late ? h('span', { class: 'tl-late sm', text: 'late' }) : null),
        h('div', { class: 'tl-track', style: { width: days * W + 'px' } }, h('i', { class: 'tl-now', style: { insetInlineStart: (pos(today) + W / 2) + 'px' }, 'aria-hidden': 'true' }), bar));
    });
    // a task that starts before what it waits on is due is a scheduling clash: say so
    const clashes = dated.filter(({ t, s }) => openBlockers(t).some(b => b.due_date && b.due_date >= s));
    if (clashes.length) out.push(h('div', { class: 'tl-warn', role: 'note' }, icon('bell', 14), h('span', { text: clashes.length === 1 ? `${taskKey(clashes[0].t)} starts before what it waits on is due` : `${clashes.length} tasks start before what they wait on is due: ${clashes.map(x => taskKey(x.t)).join(', ')}` })));
    out.push(h('div', { class: 'tl', role: 'region', 'aria-label': 'Timeline' },
      h('div', { class: 'tl-head' }, h('div', { class: 'tl-name' }), h('div', { class: 'tl-days' }, heads)), ...rows));
    requestAnimationFrame(() => { const sc = $('.tl'); if (sc && !sc.dataset.scrolled) { sc.dataset.scrolled = '1'; sc.scrollLeft = Math.max(0, pos(today) - 120) * (document.dir === 'rtl' ? -1 : 1); } });
  }
  if (undated.length) out.push(h('section', { class: 'tl-undated' }, h('h2', {}, `No dates yet · ${undated.length}`), h('div', { class: 'list' }, capped(undated, taskRow, 'tlu', 30))));
  return out;
}

/* ═════════════ Field work: devices, site visits (work orders) and support tickets with SLA ═════════════
   Devices: what is installed where. Site visits: a task that happens at a client's site; it works offline (every
   change goes through the outbox) and ends with the client signing on the phone. Tickets: a client problem with an
   answer deadline and a fix deadline from the workspace's SLA. All three hang off tasks, so the usual flow
   (whose turn, review, comments, time) still applies. */
const FIELD_PAGES = {
  devices: ['hardware', 'embedded', 'hwlead', 'field', 'support', 'presales', 'success', 'operations'],
  visits: ['field', 'hwlead', 'hardware', 'support', 'presales'],
  tickets: ['support', 'success', 'hwlead', 'product', 'pm'],
};
const fieldPageHidden = v => { if (!FIELD_PAGES[v] || smallTeam() || showAllPages()) return false; const ds = myDepts(); return !!ds.length && !ds.some(d => FIELD_PAGES[v].includes(d.base || d.k)); };
const DEV_STATES = [['active', 'Working'], ['faulty', 'Faulty'], ['retired', 'Retired']];
const devState = k => (DEV_STATES.find(x => x[0] === k) || DEV_STATES[0])[1];
const devOf = id => (S.devices || []).find(d => d.id === id) || null;
const woOf = id => (S.workOrders || []).find(w => w.task_id === id) || null;
const tkOf = id => (S.tickets || []).find(x => x.task_id === id) || null;
const SLA_DEFAULT = { urgent: [1, 8], high: [4, 24], medium: [8, 72], low: [24, 168], none: [24, 168] };
const slaOf = prio => { const k = (PRIOS.find(p => p.k === prio) || {}).n?.toLowerCase() || 'none'; const s = Object.assign({}, SLA_DEFAULT, S.ws?.sla || {}); return s[k] || s.none; };
const hoursLeft = iso => (new Date(iso) - Date.now()) / 36e5;
const fmtLeft = hrs => { const a = Math.abs(hrs); const s = a < 1 ? `${Math.max(1, Math.round(a * 60))}m` : a < 48 ? `${Math.round(a)}h` : `${Math.round(a / 24)}d`; return hrs < 0 ? `${s} over` : `${s} left`; };

/* ── devices ── */
function viewDevices() {
  const q = (S.route.q || '').toLowerCase(); const st = S.route.state || 'all';
  const all = (S.devices || []).filter(d => st === 'all' || d.state === st).filter(d => !q || [d.name, d.model, d.serial, d.location, pjOf(d.project_id)?.name].some(x => (x || '').toLowerCase().includes(q)));
  const search = h('input', { type: 'search', placeholder: 'Name, serial, site…', value: S.route.q || '', 'aria-label': 'Search devices', oninput: debounce(e => { S.route.q = e.target.value; refresh(); }, 200) });
  const tools = h('div', { class: 'tools' }, h('button', { class: 'btn pri', 'data-new-device': '1', onclick: () => openDevice() }, icon('plus', 16), isPhone() ? 'Device' : 'Add device'));
  const chips = h('div', { class: 'chips' }, [['all', 'All'], ...DEV_STATES].map(([k, l]) => h('button', { class: 'chipbtn', 'aria-pressed': String(st === k), onclick: () => { S.route.state = k; refresh(); } },
    l, k === 'faulty' ? h('span', { class: 'ct', text: String((S.devices || []).filter(d => d.state === 'faulty').length || '') }) : null)));
  const groups = {}; for (const d of all) (groups[d.project_id || ''] = groups[d.project_id || ''] || []).push(d);
  const body = !(S.devices || []).length ? emptyState('NO DEVICES YET', 'Add the gates, cameras, screens and controllers you install, with their serials and where they are. Then visits and tickets can point to them.', { label: 'Add device', fn: () => openDevice() })
    : !all.length ? emptyState('NOTHING MATCHES', 'Try another word or state.')
    : h('div', { class: 'devlist' }, Object.entries(groups).sort((a, b) => (pjOf(a[0])?.name || '~').localeCompare(pjOf(b[0])?.name || '~')).map(([pid, ds]) => h('section', {},
      h('h2', {}, pjOf(pid)?.name || 'No site yet', h('span', { class: 'ct', text: String(ds.length) })),
      h('div', { class: 'list' }, capped(ds.sort((a, b) => (a.state === 'faulty' ? 0 : 1) - (b.state === 'faulty' ? 0 : 1) || a.name.localeCompare(b.name)), d => h('button', { class: 'devrow', 'data-device': d.id, onclick: () => openDevice(d) },
        h('span', { class: 'devst ' + d.state, title: devState(d.state) }), h('span', { class: 'grow' }, h('b', { text: d.name }), h('span', { class: 'sm mute', text: [d.model, d.serial ? '#' + d.serial : null, d.location].filter(Boolean).join(' · ') })),
        d.firmware ? h('span', { class: 'mono sm mute', text: 'fw ' + d.firmware }) : null), 'dev' + pid, 60)))));
  return [pageHead('Devices', h('span', {}, `${(S.devices || []).length} installed`), tools), h('div', { class: 'scroll' }, h('div', { class: 'pjpage' }, h('div', { class: 'devtools' }, search, chips), body))];
}
function openDevice(d) {
  const isNew = !d; d = d || { id: uuid(), workspace_id: S.ws.id, state: 'active' };
  openSheet({ title: isNew ? 'Add device' : d.name, kind: 'right', key: 'device', build: sh => {
    const f = {}; const inp = (k, label, attrs = {}) => { f[k] = h('input', Object.assign({ type: 'text', value: d[k] || '', id: 'dv_' + k }, attrs)); return h('label', { class: 'field' }, label, f[k]); };
    f.project_id = h('select', { id: 'dv_project' }, h('option', { value: '' }, 'No site yet'), S.projects.map(p => h('option', { value: p.id, selected: p.id === d.project_id }, p.name)));
    f.state = h('select', { id: 'dv_state' }, DEV_STATES.map(([k, l]) => h('option', { value: k, selected: k === d.state }, l)));
    f.notes = h('textarea', { id: 'dv_notes', rows: 3, maxlength: '2000' }, d.notes || '');
    const linked = isNew ? [] : (S.workOrders || []).filter(w => (w.device_ids || []).includes(d.id)).map(w => taskOf(w.task_id)).filter(Boolean);
    const save = h('button', { class: 'btn pri', 'data-device-save': '1' }, isNew ? 'Add device' : 'Save');
    save.addEventListener('click', async () => {
      const row = { id: d.id, workspace_id: S.ws.id, name: f.name.value.trim(), model: f.model.value.trim() || null, serial: f.serial.value.trim() || null, location: f.location.value.trim() || null,
        firmware: f.firmware.value.trim() || null, installed_on: f.installed_on.value || null, project_id: f.project_id.value || null, state: f.state.value, notes: f.notes.value.trim() || null, updated_at: nowIso() };
      if (!row.name) { f.name.focus(); return toast('Give the device a name'); }
      if (row.serial && (S.devices || []).some(x => x.id !== d.id && (x.serial || '').toLowerCase() === row.serial.toLowerCase())) return toast('Another device already has this serial');
      const done = busy(save, 'Saving…');
      const r = await write(isNew ? { t: 'devices', op: 'insert', row } : { t: 'devices', op: 'update', id: d.id, patch: row }); done();
      if (r?.error) return toast(errText(r.error));
      S.devices = isNew ? [Object.assign({}, row, { created_at: nowIso() }), ...(S.devices || [])] : S.devices.map(x => x.id === d.id ? Object.assign({}, x, row) : x);
      closeSheet(true); refresh(); toast(r?.queued ? 'Saved on this phone. It goes up when you’re back online' : isNew ? 'Device added' : 'Device saved');
    });
    sh.append(h('div', { class: 'sbody' }, inp('name', 'Name', { maxlength: '120', placeholder: 'e.g. Gate 3 barrier' }), h('div', { class: 'grid2' }, inp('model', 'Model', { maxlength: '120' }), inp('serial', 'Serial', { maxlength: '120' })),
      h('label', { class: 'field' }, 'Site (project)', f.project_id), inp('location', 'Where on site', { maxlength: '200', placeholder: 'e.g. North gate, left lane' }),
      h('div', { class: 'grid2' }, inp('firmware', 'Firmware', { maxlength: '60' }), inp('installed_on', 'Installed on', { type: 'date' })), h('label', { class: 'field' }, 'State', f.state), h('label', { class: 'field' }, 'Notes', f.notes),
      linked.length ? h('section', {}, h('h4', { class: 'vsub', text: 'Visits' }), h('div', { class: 'list' }, linked.map(taskRow))) : null,
      !isNew ? h('button', { class: 'btn ghost sm', 'data-device-problem': '1', onclick: () => { closeSheet(true); openTicket({ device: d }); } }, icon('bug', 14), 'Report a problem') : null),
      h('div', { class: 'sfoot' }, !isNew && isAdmin() ? h('button', { class: 'btn ghost danger', 'data-device-delete': '1', onclick: () => confirmIn($('.sbody', sh), { text: `Delete ${d.name}? Visits keep their notes.`, yes: 'Delete', danger: true, onYes: async () => { const r = await write({ t: 'devices', op: 'delete', id: d.id }); if (r?.error) return toast(errText(r.error)); S.devices = S.devices.filter(x => x.id !== d.id); closeSheet(true); refresh(); toast('Device deleted'); } }) }, 'Delete') : null,
        h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), save));
    if (isNew) setTimeout(() => f.name.focus(), 50);
  } });
}

/* ── site visits ── */
async function saveWo(t, patch, msg) {
  const w = woOf(t.id); const row = Object.assign({ task_id: t.id, workspace_id: S.ws.id, device_ids: [] }, w || {}, patch, { updated_at: nowIso() });
  const r = await write(w ? { t: 'work_orders', op: 'update', key: 'task_id', id: t.id, patch: Object.assign({}, patch, { updated_at: row.updated_at }) } : { t: 'work_orders', op: 'insert', row });
  if (r?.error) { toast(errText(r.error)); return false; }
  S.workOrders = w ? S.workOrders.map(x => x.task_id === t.id ? row : x) : [row, ...(S.workOrders || [])];
  refresh(); if (msg) toast(r?.queued ? msg + ' · saved on this phone, it goes up when you’re back online' : msg); return true;
}
const makeVisit = t => saveWo(t, { visit_on: t.start_date || t.due_date || todayIso() }, 'Now a site visit');
function visitBlock(t) {
  const w = woOf(t.id); if (!w) return null;
  const devs = (w.device_ids || []).map(devOf).filter(Boolean);
  const txt = (k, label, attrs) => { const i = h('input', Object.assign({ type: 'text', value: w[k] || '', 'data-wo': k, onchange: e => saveWo(t, { [k]: e.target.value.trim() || null }) }, attrs)); return h('label', { class: 'field' }, label, i); };
  const report = h('textarea', { rows: 3, maxlength: '4000', 'data-wo': 'report', placeholder: 'What you found and what you did', onchange: e => saveWo(t, { report: e.target.value.trim() || null }) }, w.report || '');
  const state = w.done_at ? `Finished ${fmtDT(w.done_at)}${w.signed_by ? ' · signed by ' + w.signed_by : ''}` : w.arrived_at ? `On site since ${fmtDT(w.arrived_at)}` : w.visit_on ? `Planned for ${fmtDate(w.visit_on)}` : 'Not planned yet';
  return h('section', { class: 'visitbox', 'data-visit': t.id },
    h('h3', {}, icon('calendar', 16), 'Site visit', h('span', { class: 'sm ' + (w.done_at ? 'good' : 'mute'), 'data-visit-state': '1', text: state })),
    h('div', { class: 'grid2' }, txt('site', 'Site / address', { maxlength: '300', placeholder: 'e.g. Marassi, North gate' }), txt('contact', 'Contact on site', { maxlength: '120', placeholder: 'Name and phone' })),
    h('div', { class: 'grid2' }, h('label', { class: 'field' }, 'Visit day', h('input', { type: 'date', value: w.visit_on || '', 'data-wo': 'visit_on', onchange: e => saveWo(t, { visit_on: e.target.value || null }) })),
      h('div', { class: 'field' }, h('span', { text: 'Devices' }), h('div', { class: 'blockers' }, devs.map(d => h('span', { class: 'blk', 'data-wo-dev': d.id }, h('button', { class: 'lnk', onclick: () => openDevice(d), text: d.name }),
        h('button', { class: 'x', 'aria-label': `Remove ${d.name}`, onclick: () => saveWo(t, { device_ids: w.device_ids.filter(x => x !== d.id) }) }, icon('x', 12)))),
        h('button', { class: 'pick blank', 'data-wo-add-dev': '1', onclick: e => picker(e.currentTarget, { options: (S.devices || []).filter(d => !(w.device_ids || []).includes(d.id) && d.state !== 'retired').map(d => ({ v: d.id, label: d.name, sub: [pjOf(d.project_id)?.name, d.serial].filter(Boolean).join(' · ') })), value: null, onPick: v => saveWo(t, { device_ids: [...(w.device_ids || []), v] }) }) }, h('span', { text: devs.length ? '+ Add' : 'Pick devices' }))))),
    h('label', { class: 'field' }, 'Report', report),
    w.done_at ? (w.signature ? h('div', { class: 'sigdone' }, h('img', { src: w.signature, alt: `Signature of ${w.signed_by || 'the client'}` }), h('span', { class: 'sm mute', text: w.signed_by || '' })) : null)
      : h('div', { class: 'visitacts' }, !w.arrived_at ? h('button', { class: 'btn', 'data-wo-arrive': '1', onclick: () => saveWo(t, { arrived_at: nowIso() }, 'Marked as on site') }, 'I’m on site') : null,
        h('button', { class: 'btn pri', 'data-wo-finish': '1', onclick: () => finishVisit(t) }, icon('check', 14), 'Finish and get signature')));
}
function finishVisit(t) {
  const w = woOf(t.id); if (!w) return;
  if (!(w.report || '').trim()) return toast('Write what you did in the report first');
  openSheet({ title: 'Client signature', kind: 'center', stack: true, key: 'sign', build: sh => {
    const cv = h('canvas', { class: 'sigpad', width: 600, height: 220, 'aria-label': 'Sign here' }); const who = h('input', { type: 'text', id: 'sigName', maxlength: '120', placeholder: 'Client’s name' });
    const ctx = cv.getContext('2d'); let drawing = false, inked = false;
    const at = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111827';
    cv.addEventListener('pointerdown', e => { drawing = true; cv.setPointerCapture(e.pointerId); const [x, y] = at(e); ctx.beginPath(); ctx.moveTo(x, y); });
    cv.addEventListener('pointermove', e => { if (!drawing) return; const [x, y] = at(e); ctx.lineTo(x, y); ctx.stroke(); inked = true; });
    ['pointerup', 'pointercancel'].forEach(ev => cv.addEventListener(ev, () => { drawing = false; }));
    const save = h('button', { class: 'btn pri', 'data-sign-save': '1' }, 'Finish visit');
    save.addEventListener('click', async () => {
      if (!who.value.trim()) { who.focus(); return toast('Write the client’s name'); }
      const done = busy(save, 'Saving…');
      const ok = await saveWo(t, { done_at: nowIso(), signed_by: who.value.trim(), signature: inked ? cv.toDataURL('image/png') : null }, inked ? 'Visit finished and signed' : 'Visit finished (no signature)'); done();
      if (ok) closeSheet(true);
    });
    sh.append(h('div', { class: 'sbody' }, h('p', { class: 'note', text: 'Ask the client to check the work and sign below.' }), cv, h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, who, h('button', { class: 'btn ghost sm', onclick: () => { ctx.clearRect(0, 0, cv.width, cv.height); inked = false; } }, 'Clear'))),
      h('div', { class: 'sfoot' }, h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), h('span', { class: 'sp' }), save));
  } });
}
function viewVisits() {
  const mineOnly = S.route.who !== 'all'; const today = todayIso();
  const ws = (S.workOrders || []).map(w => ({ w, t: taskOf(w.task_id) })).filter(x => x.t && (!mineOnly || x.t.assignee_id === uid()));
  const open = ws.filter(x => !x.w.done_at).sort((a, b) => (a.w.visit_on || '9999').localeCompare(b.w.visit_on || '9999'));
  const done = ws.filter(x => x.w.done_at).sort((a, b) => b.w.done_at.localeCompare(a.w.done_at)).slice(0, 20);
  const card = ({ w, t }) => h('button', { class: 'visitcard' + (w.visit_on && w.visit_on < today && !w.done_at ? ' late' : '') + (w.visit_on === today ? ' today' : ''), 'data-visit-card': t.id, onclick: () => openTask(t.id) },
    h('span', { class: 'vday' }, h('b', { text: w.visit_on ? (w.visit_on === today ? 'Today' : fmtDate(w.visit_on)) : 'No day' }), w.arrived_at && !w.done_at ? h('span', { class: 'sm good', text: 'on site' }) : null),
    h('span', { class: 'grow' }, h('b', { text: t.title }), h('span', { class: 'sm mute', text: [w.site, (w.device_ids || []).map(devOf).filter(Boolean).map(d => d.name).join(', '), mineOnly ? null : dname(prof(t.assignee_id))].filter(Boolean).join(' · ') || taskKey(t) })),
    w.done_at ? h('span', { class: 'sm good', text: w.signed_by ? 'signed' : 'done' }) : null);
  const tools = h('div', { class: 'tools' }, h('div', { class: 'seg' }, h('button', { 'aria-pressed': String(mineOnly), onclick: () => go({ v: 'visits' }) }, 'Mine'), h('button', { 'aria-pressed': String(!mineOnly), onclick: () => go({ v: 'visits', who: 'all' }) }, 'Everyone')),
    h('button', { class: 'btn pri', 'data-new-visit': '1', onclick: () => newVisit() }, icon('plus', 16), isPhone() ? 'Visit' : 'New visit'));
  const todayN = open.filter(x => x.w.visit_on === today).length;
  return [pageHead('Site visits', h('span', {}, todayN ? `${todayN} today` : 'Nothing today'), tools), h('div', { class: 'scroll' }, h('div', { class: 'pjpage' },
    !ws.length ? emptyState('NO VISITS', mineOnly ? 'Visits you go on show here, with the site, the devices and the client’s signature at the end. They work without internet.' : 'No site visits yet.', { label: 'New visit', fn: () => newVisit() })
      : [h('section', {}, h('h2', {}, 'Coming up', h('span', { class: 'ct', text: String(open.length) })), open.length ? h('div', { class: 'list' }, open.map(card)) : h('p', { class: 'note', text: 'Nothing planned.' })),
        done.length ? h('section', {}, h('h2', {}, 'Done lately'), h('div', { class: 'list' }, done.map(card))) : null]))];
}
function newVisit() { openCreate({ preset: { assignee_id: uid() }, extra: { start_date: todayIso() }, onCreated: t => makeVisit(t) }); }

/* ── tickets ── */
function openTicket({ device } = {}) {
  openCreate({ type: 'bug', preset: device ? { project_id: device.project_id } : {}, prefill: device ? { title: `${device.name}: ` } : undefined, onCreated: async t => {
    const [a, b] = slaOf(t.priority || 0); const now = Date.now();
    const row = { task_id: t.id, workspace_id: S.ws.id, channel: null, reporter: null, respond_by: new Date(now + a * 36e5).toISOString(), resolve_by: new Date(now + b * 36e5).toISOString(), created_at: nowIso() };
    const r = await write({ t: 'tickets', op: 'insert', row }); if (r?.error) return toast(errText(r.error));
    S.tickets = [row, ...(S.tickets || [])];
    refresh(); toast(`Ticket opened: answer within ${a}h, fix within ${b}h`);
  } });
}
const makeTicket = t => { const [a, b] = slaOf(t.priority || 0); const base = new Date(t.created_at || Date.now()).getTime();
  const row = { task_id: t.id, workspace_id: S.ws.id, respond_by: new Date(base + a * 36e5).toISOString(), resolve_by: new Date(base + b * 36e5).toISOString(), created_at: nowIso(), resolved_at: isClosed(t) ? nowIso() : null };
  return write({ t: 'tickets', op: 'insert', row }).then(r => { if (r?.error) return toast(errText(r.error)); S.tickets = [row, ...(S.tickets || [])]; refresh(); toast(`Now a ticket: answer within ${a}h, fix within ${b}h`); }); };
async function saveTicket(t, patch, msg) {
  const r = await write({ t: 'tickets', op: 'update', key: 'task_id', id: t.id, patch }); if (r?.error) return toast(errText(r.error));
  S.tickets = S.tickets.map(x => x.task_id === t.id ? Object.assign({}, x, patch) : x); refresh(); if (msg) toast(msg);
}
const slaBadge = (k, by, doneAt) => { if (doneAt) return h('span', { class: 'sla ok', 'data-sla': k, text: k === 'respond' ? 'answered' : 'fixed' }); const hl = hoursLeft(by); return h('span', { class: 'sla ' + (hl < 0 ? 'over' : hl < 2 ? 'soon' : 'fine'), 'data-sla': k, text: (k === 'respond' ? 'answer: ' : 'fix: ') + fmtLeft(hl) }); };
function ticketBlock(t) {
  const k = tkOf(t.id); if (!k) return null;
  return h('section', { class: 'visitbox ticketbox', 'data-ticket': t.id },
    h('h3', {}, icon('headset', 16), 'Ticket', slaBadge('respond', k.respond_by, k.responded_at), slaBadge('resolve', k.resolve_by, k.resolved_at)),
    h('div', { class: 'grid2' }, h('label', { class: 'field' }, 'From', h('input', { type: 'text', value: k.reporter || '', maxlength: '120', placeholder: 'Who reported it', 'data-tk': 'reporter', onchange: e => saveTicket(t, { reporter: e.target.value.trim() || null }) })),
      h('label', { class: 'field' }, 'Came by', h('select', { 'data-tk': 'channel', onchange: e => saveTicket(t, { channel: e.target.value || null }) }, h('option', { value: '' }, '—'), [['phone', 'Phone'], ['whatsapp', 'WhatsApp'], ['email', 'Email'], ['visit', 'Site visit'], ['other', 'Other']].map(([v, l]) => h('option', { value: v, selected: k.channel === v }, l))))),
    h('p', { class: 'sm mute', text: `Answer by ${fmtDT(k.respond_by)} · fix by ${fmtDT(k.resolve_by)}` }),
    !k.responded_at ? h('button', { class: 'btn sm', 'data-tk-answered': '1', onclick: () => saveTicket(t, { responded_at: nowIso() }, 'First answer recorded') }, icon('check', 14), 'We answered the client') : null);
}
/* a ticket is fixed when its task closes (and open again if the task reopens) */
function syncTicketClosed(t) { const k = tkOf(t.id); if (!k) return; if (isClosed(t) && !k.resolved_at) saveTicket(t, { resolved_at: nowIso(), responded_at: k.responded_at || nowIso() }); else if (!isClosed(t) && k.resolved_at) saveTicket(t, { resolved_at: null }); }
function viewTickets() {
  const open = (S.tickets || []).map(k => ({ k, t: taskOf(k.task_id) })).filter(x => x.t && !x.k.resolved_at).sort((a, b) => a.k.resolve_by.localeCompare(b.k.resolve_by));
  const shut = (S.tickets || []).map(k => ({ k, t: taskOf(k.task_id) })).filter(x => x.t && x.k.resolved_at);
  const ontime = shut.filter(x => x.k.resolved_at <= x.k.resolve_by).length;
  const over = open.filter(x => hoursLeft(x.k.resolve_by) < 0 || (!x.k.responded_at && hoursLeft(x.k.respond_by) < 0)).length;
  const row = ({ k, t }) => h('button', { class: 'tkrow', 'data-ticket-row': t.id, onclick: () => openTask(t.id) }, prioGlyph(t.priority || 0),
    h('span', { class: 'grow' }, h('b', { text: t.title }), h('span', { class: 'sm mute', text: [taskKey(t), pjOf(t.project_id)?.name, k.reporter, t.assignee_id ? dname(prof(t.assignee_id)) : 'nobody yet'].filter(Boolean).join(' · ') })),
    h('span', { class: 'slas' }, slaBadge('respond', k.respond_by, k.responded_at), slaBadge('resolve', k.resolve_by, k.resolved_at)));
  const stat = (n, l, cls) => h('div', { class: 'pjnum' + (cls ? ' ' + cls : '') }, h('b', { text: n }), h('span', { text: l }));
  return [pageHead('Tickets', h('span', {}, `${open.length} open`), h('div', { class: 'tools' }, h('button', { class: 'btn pri', 'data-new-ticket': '1', onclick: () => openTicket() }, icon('plus', 16), isPhone() ? 'Ticket' : 'New ticket'))),
    h('div', { class: 'scroll' }, h('div', { class: 'pjpage' },
      h('div', { class: 'pjnums' }, stat(String(open.length), 'open'), stat(String(over), 'past a promise', over ? 'bad' : ''), stat(shut.length ? Math.round(100 * ontime / shut.length) + '%' : '—', 'fixed on time', shut.length && ontime / shut.length < .8 ? 'bad' : 'good')),
      open.length ? h('div', { class: 'list' }, capped(open, row, 'tk', 60)) : emptyState('NO OPEN TICKETS', 'When a client reports a problem, open a ticket. It gets an answer deadline and a fix deadline from your promises (SLA).', { label: 'New ticket', fn: () => openTicket() })))];
}
/* the promises (SLA) in Settings → Workspace */
function slaPanel() {
  const s = Object.assign({}, SLA_DEFAULT, S.ws?.sla || {}); const rows = ['urgent', 'high', 'medium', 'low'];
  const inputs = {};
  const save = h('button', { class: 'btn', 'data-sla-save': '1', onclick: async () => {
    const out = {}; for (const r of rows) { const a = Number(inputs[r][0].value), b = Number(inputs[r][1].value); if (!(a > 0 && b > 0 && a <= b && b <= 2000)) return toast('Each answer time must be at least 1 hour and no more than the fix time'); out[r] = [a, b]; }
    await saveWs({ sla: out }, 'Promises saved. New tickets use them');
  } }, 'Save promises');
  return h('div', { class: 'pbody' }, h('p', { class: 'note', text: 'How fast you promise clients to answer and to fix, by priority. New tickets get these deadlines.' }),
    h('div', { class: 'slagrid' }, h('span'), h('b', { class: 'sm', text: 'Answer within (hours)' }), h('b', { class: 'sm', text: 'Fix within (hours)' }),
      ...rows.flatMap(r => { inputs[r] = [h('input', { type: 'number', min: '1', max: '2000', value: String(s[r][0]), 'data-sla-a': r, 'aria-label': `${r} answer hours` }), h('input', { type: 'number', min: '1', max: '2000', value: String(s[r][1]), 'data-sla-b': r, 'aria-label': `${r} fix hours` })]; return [h('span', { text: r[0].toUpperCase() + r.slice(1) }), ...inputs[r]]; })),
    save);
}

const visitsBadge = () => (S.workOrders || []).filter(w => !w.done_at && w.visit_on === todayIso() && taskOf(w.task_id)?.assignee_id === uid()).length || null;
const ticketsBadge = () => (S.tickets || []).filter(k => !k.resolved_at && (hoursLeft(k.resolve_by) < 0 || (!k.responded_at && hoursLeft(k.respond_by) < 0))).length || null;

/* ═════════════ QA test library and DevOps incidents ═════════════
   Test cases are reusable checks per project. A test run is a task; inside it every case gets Pass / Fail /
   Blocked / Skip, and a failure opens a bug linked to the case. Incidents: something is broken for clients now,
   attached to a task: severity, state (investigating → identified → monitoring → resolved), impact, then a
   postmortem with follow-up tasks. */
Object.assign(FIELD_PAGES, {
  tests: ['qa'],
  incidents: ['devops', 'data'],
});
const RESULTS = [['pass', 'Pass'], ['fail', 'Fail'], ['blocked', 'Blocked'], ['skip', 'Skip']];
const casesOf = pid => (S.testCases || []).filter(c => !c.archived && (c.project_id || null) === (pid || null)).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
const resultsOf = runId => (S.testResults || []).filter(r => r.run_id === runId);
const lastResult = caseId => (S.testResults || []).filter(r => r.case_id === caseId).sort((a, b) => b.tested_at.localeCompare(a.tested_at))[0] || null;
const isRun = t => tyOf(t.type_id)?.key === 'testrun' || resultsOf(t.id).length > 0;

function viewTests() {
  /* the project: the one picked here before, else the one with the most cases, else the first */
  const known = id => id === '' || S.projects.some(p => p.id === id);
  const saved = store.get('tests.pid.' + S.ws.id, null);
  const busiest = S.projects.slice().sort((a, b) => casesOf(b.id).length - casesOf(a.id).length)[0];
  const pid = S.route.pid ?? (saved != null && known(saved) ? saved : (busiest && casesOf(busiest.id).length ? busiest.id : (S.projects[0]?.id || '')));
  const cs = casesOf(pid);
  const runs = S.tasks.filter(t => (t.project_id || '') === (pid || '') && tyOf(t.type_id)?.key === 'testrun').sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 5);
  const lastFails = cs.filter(c => lastResult(c.id)?.result === 'fail').length;
  const tools = h('div', { class: 'tools' }, h('button', { class: 'btn', 'data-add-cases': '1', onclick: () => openCases(pid) }, icon('plus', 16), isPhone() ? 'Cases' : 'Add cases'),
    cs.length ? h('button', { class: 'btn pri', 'data-start-run': '1', onclick: () => startRun(pid) }, icon('play', 14), isPhone() ? 'Run' : 'Start a test run') : null);
  /* one project picker, not a wall of buttons: projects with cases first */
  const opts = [...S.projects.map(p => [p.id, p.name]), ['', 'No project']].map(([id, n]) => ({ id, n, k: casesOf(id).length }));
  const withCases = opts.filter(o => o.k), without = opts.filter(o => !o.k);
  const opt = o => h('option', { value: o.id, selected: (pid || '') === o.id }, o.k ? `${o.n} (${o.k})` : o.n);
  const sel = h('select', { id: 'tcProject', 'aria-label': 'Project', onchange: e => { store.set('tests.pid.' + S.ws.id, e.target.value); go({ v: 'tests', pid: e.target.value }); } },
    withCases.length && without.length ? [h('optgroup', { label: 'With test cases' }, withCases.map(opt)), h('optgroup', { label: 'No cases yet' }, without.map(opt))] : opts.map(opt));
  const pick = h('label', { class: 'field tcproj' }, 'Project', sel);
  const row = c => { const lr = lastResult(c.id); return h('button', { class: 'tcrow', 'data-case': c.id, onclick: () => openCases(pid, c) },
    h('span', { class: 'tres ' + (lr?.result || 'none'), text: lr ? RESULTS.find(x => x[0] === lr.result)[1] : 'Not run' }),
    h('span', { class: 'grow' }, h('b', { text: c.title }), c.area || c.expected ? h('span', { class: 'sm mute', text: [c.area, c.expected ? 'Expect: ' + c.expected : null].filter(Boolean).join(' · ') }) : null)); };
  return [pageHead('Test library', h('span', {}, `${cs.length} cases${lastFails ? ` · ${lastFails} failing` : ''}`), tools),
    h('div', { class: 'scroll' }, h('div', { class: 'pjpage' }, pick,
      cs.length ? h('div', { class: 'list' }, capped(cs, row, 'tc' + pid, 80)) : emptyState('NO TEST CASES', 'Write the checks you repeat every release once, then run them in a test run. A failed check opens a bug for you.', { label: 'Add cases', fn: () => openCases(pid) }),
      runs.length ? h('section', {}, h('h2', {}, 'Recent runs'), h('div', { class: 'list' }, runs.map(taskRow))) : null))];
}
function openCases(pid, c) {
  const isNew = !c;
  openSheet({ title: isNew ? 'Add test cases' : 'Test case', kind: 'right', key: 'cases', build: sh => {
    const title = h('input', { type: 'text', id: 'tcTitle', maxlength: '200', value: c?.title || '', placeholder: 'e.g. Owner can book the gym for tomorrow' });
    const steps = h('textarea', { id: 'tcSteps', rows: 4, maxlength: '4000', placeholder: '1. Open the app\n2. …' }, c?.steps || '');
    const exp = h('input', { type: 'text', id: 'tcExp', maxlength: '2000', value: c?.expected || '', placeholder: 'What should happen' });
    const area = h('input', { type: 'text', id: 'tcArea', maxlength: '60', value: c?.area || '', placeholder: 'e.g. Bookings' });
    const bulk = h('textarea', { id: 'tcBulk', rows: 6, placeholder: 'Or paste many: one check per line' });
    const save = h('button', { class: 'btn pri', 'data-case-save': '1' }, isNew ? 'Add' : 'Save');
    save.addEventListener('click', async () => {
      const base = { workspace_id: S.ws.id, project_id: pid || null };
      const lines = isNew ? bulk.value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 200) : [];
      const rows = [];
      if (title.value.trim()) rows.push(Object.assign({ id: c?.id || uuid(), title: title.value.trim(), steps: steps.value.trim() || null, expected: exp.value.trim() || null, area: area.value.trim() || null }, base));
      for (const l of lines) rows.push(Object.assign({ id: uuid(), title: l.slice(0, 200), area: area.value.trim() || null }, base));
      if (!rows.length) { title.focus(); return toast('Write at least one check'); }
      const done = busy(save, 'Saving…'); let n = casesOf(pid).length;
      for (const r of rows) {
        if (isNew) r.position = n++, r.created_at = nowIso();
        const res = await write(isNew ? { t: 'test_cases', op: 'insert', row: r } : { t: 'test_cases', op: 'update', id: r.id, patch: r });
        if (res?.error) { done(); return toast(errText(res.error)); }
        S.testCases = isNew ? [...(S.testCases || []), r] : S.testCases.map(x => x.id === r.id ? Object.assign({}, x, r) : x);
      }
      done(); closeSheet(true); refresh(); toast(isNew ? (rows.length === 1 ? 'Test case added' : `${rows.length} test cases added`) : 'Test case saved');
    });
    sh.append(h('div', { class: 'sbody' }, h('label', { class: 'field' }, 'Check', title), h('label', { class: 'field' }, 'Steps', steps), h('label', { class: 'field' }, 'Expected result', exp), h('label', { class: 'field' }, 'Area', area),
      isNew ? h('label', { class: 'field' }, 'Many at once', bulk) : null),
      h('div', { class: 'sfoot' }, !isNew ? h('button', { class: 'btn ghost', 'data-case-archive': '1', onclick: async () => { const r = await write({ t: 'test_cases', op: 'update', id: c.id, patch: { archived: true } }); if (r?.error) return toast(errText(r.error)); c.archived = true; closeSheet(true); refresh(); toast('Test case archived'); } }, 'Archive') : null,
        h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), save));
    setTimeout(() => title.focus(), 50);
  } });
}
async function startRun(pid) {
  const ty = S.types.find(x => x.key === 'testrun') || S.types.find(x => !x.is_bug);
  const p = pjOf(pid);
  const t = await createTask({ title: `Test run · ${p ? p.name : 'No project'} · ${fmtDate(todayIso())}`, type_id: ty?.id, project_id: pid || null, assignee_id: uid(), description: '' });
  if (t) { openTask(t.id); toast(`${casesOf(pid).length} checks ready. Mark each one`); }
}
async function setResult(t, c, result) {
  const was = resultsOf(t.id).find(r => r.case_id === c.id);
  if (result === 'fail' && !was?.bug_id) return failCase(t, c);
  const row = { run_id: t.id, case_id: c.id, workspace_id: S.ws.id, result, note: was?.note || null, bug_id: was?.bug_id || null, tested_by: uid(), tested_at: nowIso() };
  const r = await write(was ? { t: 'test_results', op: 'update', key: 'run_id', id: t.id, patch: row, extraEq: ['case_id', c.id] } : { t: 'test_results', op: 'insert', row });
  if (r?.error) return toast(errText(r.error));
  S.testResults = [...(S.testResults || []).filter(x => !(x.run_id === t.id && x.case_id === c.id)), row]; refresh();
}
function failCase(t, c) {
  openSheet({ title: `Fails: ${c.title}`, kind: 'center', stack: true, key: 'failcase', build: sh => {
    const note = h('textarea', { id: 'failNote', rows: 3, maxlength: '1000', placeholder: 'What happened instead' });
    const go_ = h('button', { class: 'btn pri', 'data-fail-save': '1' }, 'Save and open a bug');
    go_.addEventListener('click', async () => {
      const done = busy(go_, 'Saving…');
      const bug = await createTask({ title: `Fails: ${c.title}`.slice(0, 200), type_id: S.types.find(x => x.is_bug)?.id, project_id: t.project_id, priority: 2,
        description: [c.steps ? '### Steps\n' + c.steps : null, c.expected ? '### Expected\n' + c.expected : null, note.value.trim() ? '### Actual\n' + note.value.trim() : null, `Found in ${taskKey(t)}`].filter(Boolean).join('\n\n') });
      if (!bug) return done();
      const row = { run_id: t.id, case_id: c.id, workspace_id: S.ws.id, result: 'fail', note: note.value.trim() || null, bug_id: bug.id, tested_by: uid(), tested_at: nowIso() };
      const had = resultsOf(t.id).some(x => x.case_id === c.id);
      const r = await write(had ? { t: 'test_results', op: 'update', key: 'run_id', id: t.id, patch: row, extraEq: ['case_id', c.id] } : { t: 'test_results', op: 'insert', row }); done();
      if (r?.error) return toast(errText(r.error));
      S.testResults = [...(S.testResults || []).filter(x => !(x.run_id === t.id && x.case_id === c.id)), row];
      closeSheet(true); refresh(); toast(`${taskKey(bug)} opened for this failure`, { label: 'Open', fn: () => openTask(bug.id) });
    });
    sh.append(h('div', { class: 'sbody' }, c.expected ? h('p', { class: 'note', text: 'Expected: ' + c.expected }) : null, h('label', { class: 'field' }, 'What happened', note)),
      h('div', { class: 'sfoot' }, h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), h('span', { class: 'sp' }), go_));
    setTimeout(() => note.focus(), 50);
  } });
}
function runBlock(t) {
  if (!isRun(t)) return null;
  const cs = casesOf(t.project_id); const rs = resultsOf(t.id); const by = Object.fromEntries(rs.map(r => [r.case_id, r]));
  const n = k => rs.filter(r => r.result === k).length; const doneN = rs.length;
  return h('section', { class: 'visitbox runbox', 'data-run': t.id },
    h('h3', {}, icon('review', 16), 'Test run', h('span', { class: 'sm mute', 'data-run-sum': '1', text: `${doneN} of ${cs.length} checked · ${n('pass')} passed · ${n('fail')} failed${n('blocked') ? ` · ${n('blocked')} blocked` : ''}` })),
    h('div', { class: 'runbar', 'aria-hidden': 'true' }, ['pass', 'fail', 'blocked', 'skip'].map(k => h('i', { class: k, style: { flexGrow: String(n(k)) } })), h('i', { class: 'todo', style: { flexGrow: String(Math.max(0, cs.length - doneN)) } })),
    !cs.length ? h('p', { class: 'note', text: 'This project has no test cases yet. Add them in the Test library.' }) : h('div', { class: 'runlist' }, cs.map(c => { const r = by[c.id];
      return h('div', { class: 'runrow', 'data-run-case': c.id }, h('span', { class: 'grow' }, h('b', { text: c.title }), c.expected ? h('span', { class: 'sm mute', text: 'Expect: ' + c.expected }) : null,
        r?.bug_id && taskOf(r.bug_id) ? h('button', { class: 'lnk sm', onclick: () => openTask(r.bug_id), text: `${taskKey(taskOf(r.bug_id))} opened` }) : null),
        h('span', { class: 'rbtns', role: 'group', 'aria-label': c.title }, RESULTS.map(([k, l]) => h('button', { class: 'rbtn ' + k, 'data-r': k, 'aria-pressed': String(r?.result === k), onclick: () => setResult(t, c, k) }, l)))); })));
}

/* ── incidents ── */
const SEV = { 1: 'SEV 1 · everyone is affected', 2: 'SEV 2 · many are affected', 3: 'SEV 3 · a few are affected' };
const ISTATES = [['investigating', 'Investigating'], ['identified', 'Cause found'], ['monitoring', 'Fixed, watching'], ['resolved', 'Resolved']];
const incOf = id => (S.incidents || []).find(x => x.task_id === id) || null;
const activeIncidents = () => (S.incidents || []).filter(x => x.state !== 'resolved' && taskOf(x.task_id));
const durText = (a, b) => fmtDur(Math.round(((b ? new Date(b) : new Date()) - new Date(a)) / 6e4));
function openIncident() {
  openSheet({ title: 'Report an incident', kind: 'center', key: 'incident', build: sh => {
    const title = h('input', { type: 'text', id: 'incTitle', maxlength: '200', placeholder: 'What is broken, e.g. Owner app can’t log in' });
    const sev = h('select', { id: 'incSev' }, [1, 2, 3].map(s => h('option', { value: String(s), selected: s === 2 }, SEV[s])));
    const impact = h('textarea', { id: 'incImpact', rows: 3, maxlength: '1000', placeholder: 'Who is affected and how' });
    const proj = h('select', { id: 'incProj' }, h('option', { value: '' }, 'No project'), S.projects.map(p => h('option', { value: p.id }, p.name)));
    const go_ = h('button', { class: 'btn pri danger', 'data-inc-save': '1' }, 'Report incident');
    go_.addEventListener('click', async () => {
      if (!title.value.trim()) { title.focus(); return toast('Say what is broken'); }
      const done = busy(go_, 'Reporting…'); const s = Number(sev.value);
      const t = await createTask({ title: title.value.trim(), type_id: (S.types.find(x => x.key === 'issue') || S.types.find(x => x.is_bug))?.id, project_id: proj.value || null, priority: s === 1 ? 1 : 2, assignee_id: uid(), description: impact.value.trim() });
      if (!t) return done();
      const row = { task_id: t.id, workspace_id: S.ws.id, severity: s, state: 'investigating', impact: impact.value.trim() || null, started_at: nowIso(), followups: [], created_at: nowIso() };
      const r = await write({ t: 'incidents', op: 'insert', row }); done();
      if (r?.error) return toast(errText(r.error));
      S.incidents = [row, ...(S.incidents || [])]; closeSheet(true); openTask(t.id); toast('Incident reported. Keep its state up to date');
    });
    sh.append(h('div', { class: 'sbody' }, h('label', { class: 'field' }, 'What is broken', title), h('label', { class: 'field' }, 'How bad', sev), h('label', { class: 'field' }, 'Impact', impact), h('label', { class: 'field' }, 'Project', proj)),
      h('div', { class: 'sfoot' }, h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), h('span', { class: 'sp' }), go_));
    setTimeout(() => title.focus(), 50);
  } });
}
async function saveInc(t, patch, msg) {
  const r = await write({ t: 'incidents', op: 'update', key: 'task_id', id: t.id, patch }); if (r?.error) return toast(errText(r.error));
  S.incidents = S.incidents.map(x => x.task_id === t.id ? Object.assign({}, x, patch) : x); refresh(); if (msg) toast(msg);
}
const makeIncident = t => { const row = { task_id: t.id, workspace_id: S.ws.id, severity: 2, state: 'investigating', impact: null, started_at: t.created_at || nowIso(), followups: [], created_at: nowIso() };
  return write({ t: 'incidents', op: 'insert', row }).then(r => { if (r?.error) return toast(errText(r.error)); S.incidents = [row, ...(S.incidents || [])]; refresh(); toast('Now an incident'); }); };
function incidentBlock(t) {
  const x = incOf(t.id); if (!x) return null;
  const pm = x.postmortem || {};
  const pmField = (k, label, ph) => h('label', { class: 'field' }, label, h('textarea', { rows: 2, maxlength: '2000', 'data-pm': k, placeholder: ph, onchange: e => saveInc(t, { postmortem: Object.assign({}, x.postmortem || {}, { [k]: e.target.value.trim() }) }) }, pm[k] || ''));
  const fus = (x.followups || []).map(taskOf).filter(Boolean);
  return h('section', { class: 'visitbox incbox sev' + x.severity, 'data-incident': t.id },
    h('h3', {}, icon('bell', 16), 'Incident', h('select', { class: 'sm', 'data-inc-sev': '1', 'aria-label': 'Severity', onchange: e => saveInc(t, { severity: Number(e.target.value) }) }, [1, 2, 3].map(s => h('option', { value: String(s), selected: s === x.severity }, `SEV ${s}`))),
      h('span', { class: 'sm mute', 'data-inc-time': '1', text: x.resolved_at ? `Lasted ${durText(x.started_at, x.resolved_at)}` : `Going on for ${durText(x.started_at)}` })),
    h('div', { class: 'istates', role: 'group', 'aria-label': 'State' }, ISTATES.map(([k, l]) => h('button', { class: 'istate', 'data-inc-state': k, 'aria-pressed': String(x.state === k),
      onclick: () => saveInc(t, k === 'resolved' ? { state: k, resolved_at: x.resolved_at || nowIso() } : { state: k, resolved_at: null }, k === 'resolved' ? 'Resolved. Write the postmortem while it’s fresh' : `State: ${l}`) }, l))),
    h('label', { class: 'field' }, 'Impact', h('textarea', { rows: 2, maxlength: '1000', 'data-inc-impact': '1', onchange: e => saveInc(t, { impact: e.target.value.trim() || null }) }, x.impact || '')),
    x.state === 'resolved' ? h('div', { class: 'pm' }, h('h4', { class: 'vsub', text: 'Postmortem' }), pmField('what', 'What happened', 'The timeline in a few lines'), pmField('cause', 'Root cause', 'Why it happened'),
      pmField('fix', 'How it was fixed', ''), pmField('lessons', 'What we change', 'So it doesn’t happen again'),
      h('div', { class: 'field' }, h('span', { text: 'Follow-up tasks' }), h('div', { class: 'list' }, fus.map(taskRow)),
        h('button', { class: 'btn sm', 'data-inc-followup': '1', onclick: () => openCreate({ preset: { project_id: t.project_id }, onCreated: f => saveInc(t, { followups: [...(x.followups || []), f.id] }, `${taskKey(f)} added as a follow-up`) }) }, icon('plus', 14), 'Add follow-up task'))) : null);
}
function viewIncidents() {
  const all = (S.incidents || []).map(x => ({ x, t: taskOf(x.task_id) })).filter(y => y.t);
  const act = all.filter(y => y.x.state !== 'resolved').sort((a, b) => a.x.severity - b.x.severity);
  const past = all.filter(y => y.x.state === 'resolved').sort((a, b) => b.x.started_at.localeCompare(a.x.started_at));
  const since = Date.now() - 90 * 864e5; const recent = past.filter(y => new Date(y.x.started_at) > since);
  const mttr = recent.length ? Math.round(recent.reduce((n, y) => n + (new Date(y.x.resolved_at) - new Date(y.x.started_at)) / 6e4, 0) / recent.length) : null;
  const noPm = past.filter(y => !(y.x.postmortem?.cause)).length;
  const row = ({ x, t }) => h('button', { class: 'tkrow', 'data-inc-row': t.id, onclick: () => openTask(t.id) }, h('span', { class: 'sevtag s' + x.severity, text: `SEV ${x.severity}` }),
    h('span', { class: 'grow' }, h('b', { text: t.title }), h('span', { class: 'sm mute' }, ...[ISTATES.find(s => s[0] === x.state)[1], x.resolved_at ? `lasted ${durText(x.started_at, x.resolved_at)}` : `for ${durText(x.started_at)}`, fmtDT(x.started_at)].flatMap((p, i) => i ? [' · ', h('span', { text: p })] : [h('span', { text: p })]))),
    x.state === 'resolved' && !x.postmortem?.cause ? h('span', { class: 'sla soon', text: 'no postmortem' }) : null);
  const stat = (n, l, cls) => h('div', { class: 'pjnum' + (cls ? ' ' + cls : '') }, h('b', { text: n }), h('span', { text: l }));
  return [pageHead('Incidents', h('span', {}, act.length ? `${act.length} going on now` : 'All clear'), h('div', { class: 'tools' }, h('button', { class: 'btn pri danger', 'data-new-incident': '1', onclick: () => openIncident() }, icon('plus', 16), isPhone() ? 'Report' : 'Report incident'))),
    h('div', { class: 'scroll' }, h('div', { class: 'pjpage' },
      h('div', { class: 'pjnums' }, stat(String(act.length), 'going on now', act.length ? 'bad' : 'good'), stat(String(recent.length), 'in 90 days'), stat(mttr == null ? '—' : fmtDur(mttr), 'average time to fix'), stat(String(noPm), 'without a postmortem', noPm ? 'bad' : '')),
      act.length ? h('section', {}, h('h2', {}, 'Going on now'), h('div', { class: 'list' }, act.map(row))) : null,
      past.length ? h('section', {}, h('h2', {}, 'Past incidents'), h('div', { class: 'list' }, capped(past, row, 'inc', 40))) : !act.length ? emptyState('ALL CLEAR', 'When something breaks for clients, report it here. Keep its state up to date while you fix it, then write what you learned.', { label: 'Report incident', fn: () => openIncident() }) : null))];
}
const incidentsBadge = () => activeIncidents().length || null;

/* ═════════════ Back office (Phase 4): approvals, stock, onboarding, invoices ═════════════
   Approvals: anyone asks (purchase, expense, leave, other); the approver or an admin decides; nobody approves
   their own request; a decided request can't change (the database enforces all of it). An approved purchase
   tied to a stock item adds to stock when it arrives. Stock moves only through moves in or out. Onboarding: a task
   for the new person's first days with the company's checklist. Invoices print from a project payment. */
Object.assign(FIELD_PAGES, { stock: ['operations', 'hardware', 'field', 'hwlead', 'management', 'finance', 'embedded'] });
const AKINDS = [['purchase', 'Purchase'], ['expense', 'Expense'], ['leave', 'Time off'], ['other', 'Other']];
const ASTATE = { pending: 'Waiting', approved: 'Approved', rejected: 'Rejected', canceled: 'Canceled', received: 'Received' };
const apOf = id => (S.approvals || []).find(a => a.id === id) || null;
const stockOf = id => (S.stock || []).find(s => s.id === id) || null;
const waitingForMe = () => (S.approvals || []).filter(a => a.state === 'pending' && a.requested_by !== uid() && (a.approver_id === uid() || (!a.approver_id && isAdmin())));
const approvalsBadge = () => waitingForMe().length || null;
const approvers = () => S.members.filter(m => m.user_id !== uid() && (m.role === 'admin' || inDept(m, 'management', 'finance', 'operations', 'hr', 'hwlead'))).map(m => m.user_id);
const fmtAmt = (n, cur) => n == null ? '' : `${Number(n).toLocaleString('en-US')} ${cur || ''}`.trim();

function viewApprovals() {
  const tab = S.route.tab || (waitingForMe().length ? 'me' : 'mine');
  const lists = { me: waitingForMe(), mine: (S.approvals || []).filter(a => a.requested_by === uid()), all: S.approvals || [] };
  const list = (lists[tab] || []).slice().sort((a, b) => (a.state === 'pending' ? 0 : 1) - (b.state === 'pending' ? 0 : 1) || b.created_at.localeCompare(a.created_at));
  const tabs = h('div', { class: 'seg' }, [['me', `For me (${lists.me.length})`], ['mine', 'My requests'], isAdmin() ? ['all', 'All'] : null].filter(Boolean).map(([k, l]) => h('button', { 'aria-pressed': String(tab === k), 'data-ap-tab': k, onclick: () => go({ v: 'approvals', tab: k }) }, l)));
  const row = a => h('button', { class: 'tkrow', 'data-ap': a.id, onclick: () => openApproval(a) },
    h('span', { class: 'apst ' + a.state, text: ASTATE[a.state] }),
    h('span', { class: 'grow' }, h('b', { text: a.title }), h('span', { class: 'sm mute' }, ...[AKINDS.find(k => k[0] === a.kind)[1], a.amount != null ? fmtAmt(a.amount, a.currency) : null, a.qty ? `× ${a.qty}` : null, dname(prof(a.requested_by)), ago(a.created_at)].filter(Boolean).flatMap((p, i) => i ? [' · ', h('span', { text: p })] : [h('span', { text: p })]))));
  return [pageHead('Approvals', h('span', {}, lists.me.length ? `${lists.me.length} waiting for you` : 'Nothing waiting for you'), h('div', { class: 'tools' }, h('button', { class: 'btn pri', 'data-new-ap': '1', onclick: () => openApproval() }, icon('plus', 16), isPhone() ? 'Ask' : 'Ask for approval'))),
    h('div', { class: 'scroll' }, h('div', { class: 'pjpage' }, tabs, list.length ? h('div', { class: 'list' }, capped(list, row, 'ap' + tab, 60))
      : emptyState(tab === 'me' ? 'NOTHING TO DECIDE' : 'NO REQUESTS', tab === 'me' ? 'Requests that need your yes or no show here.' : 'Need to buy something, claim an expense or take a day off? Ask here and see the answer in one place.', tab === 'me' ? null : { label: 'Ask for approval', fn: () => openApproval() })))];
}
function openApproval(a) {
  const isNew = !a;
  openSheet({ title: isNew ? 'Ask for approval' : a.title, kind: 'right', key: 'approval', build: sh => {
    const body = h('div', { class: 'sbody' }); const foot = h('div', { class: 'sfoot' });
    if (isNew) {
      const kind = h('select', { id: 'apKind' }, AKINDS.map(([k, l]) => h('option', { value: k }, l)));
      const title = h('input', { type: 'text', id: 'apTitle', maxlength: '200', placeholder: 'e.g. 4 barrier motors for Marassi' });
      const details = h('textarea', { id: 'apDetails', rows: 3, maxlength: '4000', placeholder: 'Why, from where, any link' });
      const amount = h('input', { type: 'number', id: 'apAmount', min: '0', step: '0.01', inputmode: 'decimal', placeholder: 'Optional' });
      const cur = h('input', { type: 'text', id: 'apCur', maxlength: '8', value: M.settings?.currency || 'EGP' });
      const item = h('select', { id: 'apItem' }, h('option', { value: '' }, 'Not a stock item'), (S.stock || []).map(s => h('option', { value: s.id }, s.name)));
      const qty = h('input', { type: 'number', id: 'apQty', min: '1', step: '1', placeholder: 'How many' });
      const who = h('select', { id: 'apWho' }, approvers().map(u => h('option', { value: u }, dname(prof(u)))));
      const go_ = h('button', { class: 'btn pri', 'data-ap-save': '1' }, 'Send request');
      go_.addEventListener('click', async () => {
        if (!title.value.trim()) { title.focus(); return toast('Say what you need'); }
        if (!who.value) return toast('Nobody can approve yet. Ask an admin to add one');
        if (amount.value && !(Number(amount.value) >= 0)) return toast('Check the amount');
        if (item.value && !(Number(qty.value) > 0)) { qty.focus(); return toast('How many?'); }
        const row = { id: uuid(), workspace_id: S.ws.id, kind: kind.value, title: title.value.trim(), details: details.value.trim() || null, amount: amount.value ? Number(amount.value) : null, currency: amount.value ? cur.value.trim().toUpperCase() || null : null,
          stock_item_id: item.value || null, qty: item.value ? Number(qty.value) : null, requested_by: uid(), approver_id: who.value, state: 'pending', created_at: nowIso() };
        const done = busy(go_, 'Sending…'); const r = await write({ t: 'approvals', op: 'insert', row }); done();
        if (r?.error) return toast(errText(r.error));
        S.approvals = [row, ...(S.approvals || [])]; closeSheet(true); go({ v: 'approvals', tab: 'mine' }); toast(`Sent to ${first(prof(row.approver_id))}`);
      });
      const showStock = () => { stockRow.style.display = kind.value === 'purchase' && (S.stock || []).length ? '' : 'none'; };
      const stockRow = h('div', { class: 'grid2' }, h('label', { class: 'field' }, 'Stock item', item), h('label', { class: 'field' }, 'Quantity', qty));
      kind.addEventListener('change', showStock);
      body.append(h('label', { class: 'field' }, 'Kind', kind), h('label', { class: 'field' }, 'What you need', title), h('label', { class: 'field' }, 'Details', details),
        h('div', { class: 'grid2' }, h('label', { class: 'field' }, 'Amount', amount), h('label', { class: 'field' }, 'Currency', cur)), stockRow, h('label', { class: 'field' }, 'Who approves', who));
      showStock();
      foot.append(h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), h('span', { class: 'sp' }), go_);
      setTimeout(() => title.focus(), 50);
    } else {
      const canDecide = a.state === 'pending' && a.requested_by !== uid() && (a.approver_id === uid() || isAdmin());
      const note = h('textarea', { id: 'apNote', rows: 2, maxlength: '1000', placeholder: 'A note for them (optional)' });
      const it = stockOf(a.stock_item_id);
      body.append(...[h('div', { class: 'apdetail' }, h('span', { class: 'apst ' + a.state, 'data-ap-state': '1', text: ASTATE[a.state] }),
        h('p', {}, h('b', { text: AKINDS.find(k => k[0] === a.kind)[1] }), ` · asked by ${dname(prof(a.requested_by))} · ${fmtDT(a.created_at)}`),
        a.amount != null ? h('p', { class: 'apamt', text: fmtAmt(a.amount, a.currency) }) : null, it ? h('p', { text: `${a.qty} × ${it.name}` }) : null,
        a.details ? h('p', { class: 'note', text: a.details }) : null,
        h('p', { class: 'sm mute', text: a.decided_at ? `${ASTATE[a.state]} by ${dname(prof(a.approver_id))} · ${fmtDT(a.decided_at)}` : `Waiting for ${dname(prof(a.approver_id))}` }),
        a.decision_note ? h('p', { class: 'note', text: '“' + a.decision_note + '”' }) : null),
        canDecide ? h('label', { class: 'field' }, 'Note', note) : null].filter(Boolean));
      const decide = async st => {
        const r = await write({ t: 'approvals', op: 'update', id: a.id, patch: { state: st, decision_note: note.value.trim() || null } });
        if (r?.error) return toast(errText(r.error));
        Object.assign(a, { state: st, decision_note: note.value.trim() || null, decided_at: nowIso() }); closeSheet(true); refresh(); toast(st === 'approved' ? 'Approved' : 'Rejected');
      };
      foot.append(...[
        a.state === 'pending' && a.requested_by === uid() ? h('button', { class: 'btn ghost', 'data-ap-cancel': '1', onclick: async () => { const r = await write({ t: 'approvals', op: 'update', id: a.id, patch: { state: 'canceled' } }); if (r?.error) return toast(errText(r.error)); a.state = 'canceled'; closeSheet(true); refresh(); toast('Request canceled'); } }, 'Cancel request') : null,
        a.state === 'approved' && a.kind === 'purchase' && (a.requested_by === uid() || isAdmin() || a.approver_id === uid()) ? h('button', { class: 'btn', 'data-ap-received': '1', onclick: () => receivePurchase(a) }, it ? `It arrived: add ${a.qty} to stock` : 'It arrived') : null,
        h('span', { class: 'sp' }),
        canDecide ? h('button', { class: 'btn ghost danger', 'data-ap-reject': '1', onclick: () => decide('rejected') }, 'Reject') : null,
        canDecide ? h('button', { class: 'btn pri', 'data-ap-approve': '1', onclick: () => decide('approved') }, 'Approve') : h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Close')].filter(Boolean));
    }
    sh.append(body, foot);
  } });
}
async function receivePurchase(a) {
  const it = stockOf(a.stock_item_id);
  if (it) { const ok = await moveStock(it, Number(a.qty), `Purchase: ${a.title}`, { approval_id: a.id }); if (!ok) return; }
  const r = await write({ t: 'approvals', op: 'update', id: a.id, patch: { state: 'received' } }); if (r?.error) return toast(errText(r.error));
  a.state = 'received'; closeSheet(true); refresh(); toast(it ? `${a.qty} added to ${it.name}` : 'Marked as received');
}

/* ── stock ── */
async function moveStock(it, change, reason, extra = {}) {
  if (!change) return false;
  if (it.qty + change < 0) { toast(`Only ${it.qty} ${it.unit || ''} in stock`.trim()); return false; }
  const row = Object.assign({ id: uuid(), workspace_id: S.ws.id, item_id: it.id, change, reason: reason || null, moved_by: uid(), created_at: nowIso() }, extra);
  const r = await write({ t: 'stock_moves', op: 'insert', row }); if (r?.error) { toast(errText(r.error)); return false; }
  it.qty = Number(it.qty) + change; S.stockMoves = [row, ...(S.stockMoves || [])]; refresh(); return true;
}
function viewStock() {
  const items = (S.stock || []).slice().sort((a, b) => ((a.qty <= a.min_qty) ? 0 : 1) - ((b.qty <= b.min_qty) ? 0 : 1) || a.name.localeCompare(b.name));
  const low = items.filter(i => i.qty <= i.min_qty && i.min_qty > 0).length;
  const row = i => h('button', { class: 'devrow', 'data-stock': i.id, onclick: () => openStockItem(i) },
    h('span', { class: 'devst ' + (i.qty <= 0 ? 'faulty' : i.qty <= i.min_qty ? 'retired' : 'active') }),
    h('span', { class: 'grow' }, h('b', { text: i.name }), h('span', { class: 'sm mute', text: [i.sku, i.location, i.min_qty ? `reorder at ${i.min_qty}` : null].filter(Boolean).join(' · ') })),
    h('b', { class: 'stqty' + (i.qty <= i.min_qty && i.min_qty > 0 ? ' low' : ''), 'data-stock-qty': i.id, text: `${Number(i.qty)} ${i.unit || ''}`.trim() }));
  return [pageHead('Stock', h('span', {}, low ? `${low} running low` : `${items.length} items`), h('div', { class: 'tools' }, h('button', { class: 'btn pri', 'data-new-stock': '1', onclick: () => openStockItem() }, icon('plus', 16), isPhone() ? 'Item' : 'Add item'))),
    h('div', { class: 'scroll' }, h('div', { class: 'pjpage' }, items.length ? h('div', { class: 'list' }, capped(items, row, 'st', 80))
      : emptyState('NO STOCK YET', 'Add the parts and materials you keep: motors, cables, cards. Then record what comes in and goes out, and Ovrto tells you when to reorder.', { label: 'Add item', fn: () => openStockItem() })))];
}
function openStockItem(i) {
  const isNew = !i;
  openSheet({ title: isNew ? 'Add stock item' : i.name, kind: 'right', key: 'stock', build: sh => {
    const f = {}; const inp = (k, label, attrs = {}) => { f[k] = h('input', Object.assign({ type: 'text', id: 'st_' + k, value: i?.[k] ?? '' }, attrs)); return h('label', { class: 'field' }, label, f[k]); };
    const body = h('div', { class: 'sbody' }, inp('name', 'Name', { maxlength: '120', placeholder: 'e.g. Barrier motor 24V' }), h('div', { class: 'grid2' }, inp('sku', 'Code', { maxlength: '60' }), inp('unit', 'Unit', { maxlength: '20', placeholder: 'pcs, m, box' })),
      h('div', { class: 'grid2' }, inp('min_qty', 'Reorder at', { type: 'number', min: '0', step: '1', value: String(i?.min_qty ?? 0) }), inp('location', 'Where it’s kept', { maxlength: '120' })));
    if (!isNew) {
      const q = h('input', { type: 'number', id: 'stMoveQty', min: '1', step: '1', placeholder: 'How many' }); const why = h('input', { type: 'text', id: 'stMoveWhy', maxlength: '300', placeholder: 'Why, e.g. Marassi install' });
      const mv = sign => async () => { const n = Number(q.value); if (!(n > 0)) { q.focus(); return toast('How many?'); } if (await moveStock(i, sign * n, why.value.trim())) { q.value = ''; why.value = ''; toast(sign > 0 ? `${n} in · now ${i.qty}` : `${n} out · now ${i.qty}`); drawMoves(); $('[data-stock-now]', sh).textContent = `${Number(i.qty)} ${i.unit || ''}`.trim(); } };
      const moves = h('div', { class: 'list', 'data-moves': '1' });
      const drawMoves = () => moves.replaceChildren(...(S.stockMoves || []).filter(m => m.item_id === i.id).slice(0, 12).map(m => h('div', { class: 'tentry sm' }, h('b', { class: m.change > 0 ? 'good' : '', text: (m.change > 0 ? '+' : '') + m.change }), h('span', { class: 'grow', text: [m.reason, dname(prof(m.moved_by)), fmtDT(m.created_at)].filter(Boolean).join(' · ') }))));
      drawMoves();
      body.prepend(h('div', { class: 'stnow' }, h('span', { class: 'sm mute', text: 'In stock' }), h('b', { 'data-stock-now': '1', text: `${Number(i.qty)} ${i.unit || ''}`.trim() })),
        h('div', { class: 'stmove' }, q, why, h('button', { class: 'btn', 'data-move-in': '1', onclick: mv(1) }, 'In'), h('button', { class: 'btn', 'data-move-out': '1', onclick: mv(-1) }, 'Out')), h('h4', { class: 'vsub', text: 'Moves' }), moves, h('h4', { class: 'vsub', text: 'Details' }));
    }
    const save = h('button', { class: 'btn pri', 'data-stock-save': '1' }, isNew ? 'Add item' : 'Save');
    save.addEventListener('click', async () => {
      const row = { name: f.name.value.trim(), sku: f.sku.value.trim() || null, unit: f.unit.value.trim() || null, min_qty: Math.max(0, Number(f.min_qty.value) || 0), location: f.location.value.trim() || null };
      if (!row.name) { f.name.focus(); return toast('Give it a name'); }
      const done = busy(save, 'Saving…');
      if (isNew) Object.assign(row, { id: uuid(), workspace_id: S.ws.id, qty: 0, created_at: nowIso() });
      const r = await write(isNew ? { t: 'stock_items', op: 'insert', row } : { t: 'stock_items', op: 'update', id: i.id, patch: row }); done();
      if (r?.error) return toast(errText(r.error));
      if (isNew) S.stock = [...(S.stock || []), row]; else Object.assign(i, row);
      closeSheet(true); refresh(); toast(isNew ? 'Item added. Record what comes in' : 'Item saved');
    });
    sh.append(body, h('div', { class: 'sfoot' }, h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Close'), save));
  } });
}

/* ── onboarding ── */
const ONB_DEFAULT = { _all: ['Send the welcome message and the first-day plan', 'Create their email and add them to Ovrto', 'Laptop, phone and accounts ready', 'Introduce them to the team', 'Walk through the company policies', 'Set goals for the first 30 days', 'Check in after the first week'] };
const onbCfg = () => Object.assign({}, ONB_DEFAULT, S.ws?.onboarding || {});
function openOnboarding() {
  openSheet({ title: 'Start onboarding', kind: 'center', key: 'onboard', build: sh => {
    const name = h('input', { type: 'text', id: 'obName', maxlength: '120', placeholder: 'New person’s name' });
    const dept = h('select', { id: 'obDept' }, h('option', { value: '' }, 'Department (optional)'), deptsOn().map(d => h('option', { value: d.k }, d.l)));
    const day = h('input', { type: 'date', id: 'obDay', value: todayIso() });
    const go_ = h('button', { class: 'btn pri', 'data-ob-save': '1' }, 'Start');
    go_.addEventListener('click', async () => {
      if (!name.value.trim()) { name.focus(); return toast('Write their name'); }
      const c = onbCfg(); const steps = [...(c._all || []), ...(dept.value ? (c[baseKey(dept.value)] || c[dept.value] || []) : [])];
      const done = busy(go_, 'Starting…');
      const t = await createTask({ title: `Onboarding: ${name.value.trim()}`, assignee_id: uid(), start_date: day.value || null, due_date: day.value ? addDays(day.value, 30) : null,
        checklist: steps.map(s => ({ id: uuid(), text: s, done: false })), description: dept.value ? `Joining ${deptOf(dept.value)?.l}.` : '' }); done();
      if (t) { closeSheet(true); openTask(t.id); toast(`${steps.length} steps ready`); }
    });
    sh.append(h('div', { class: 'sbody' }, h('label', { class: 'field' }, 'Name', name), h('label', { class: 'field' }, 'Department', dept), h('label', { class: 'field' }, 'First day', day),
      h('p', { class: 'note', text: 'Ovrto makes a task with your onboarding checklist, due 30 days after the first day. Change the checklist in Settings → Workspace.' })),
      h('div', { class: 'sfoot' }, h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), h('span', { class: 'sp' }), go_));
    setTimeout(() => name.focus(), 50);
  } });
}
function onboardingPanel() {
  const c = onbCfg(); const ta = h('textarea', { id: 'obAll', rows: 7, maxlength: '4000' }, (c._all || []).join('\n'));
  return h('div', { class: 'pbody' }, h('p', { class: 'note', text: 'The checklist every new person gets, one step per line. HR starts it from More → Start onboarding.' }), ta,
    h('button', { class: 'btn', 'data-ob-cfg-save': '1', style: { marginTop: '8px' }, onclick: () => saveWs({ onboarding: Object.assign({}, S.ws.onboarding || {}, { _all: ta.value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 60) }) }, 'Onboarding checklist saved') }, 'Save checklist'));
}

/* ── a printable invoice for one project payment (money people only see payments at all) ── */
function printInvoice(p, y) {
  const tr = x => (isAr() ? I18N.tr(x) : x);
  const n = `${S.ws.prefix || 'INV'}-${(y.due || todayIso()).slice(0, 4)}-${String(((moneyOf(p.id).payments || []).findIndex(z => z.id === y.id) + 1) || 1).padStart(3, '0')}`;
  const cur = M.settings?.currency || 'EGP'; const client = '';
  const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups to print the invoice');
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  w.document.write(`<!doctype html><html dir="${isAr() ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(n)}</title><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;color:#161B33}h1{margin:0 0 4px}table{width:100%;border-collapse:collapse;margin:24px 0}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:start}.tot{font-size:22px;font-weight:700}.mute{color:#5A6082}@media print{button{display:none}}</style></head><body>
    <h1>${esc(tr('Invoice'))} ${esc(n)}</h1><div class="mute">${esc(S.ws.name)} · ${esc(fmtDate(todayIso()))}</div>
    <p><b>${esc(tr('Project'))}:</b> ${esc(p.name)}</p>
    <table><tr><th>${esc(tr('What for'))}</th><th>${esc(tr('Due'))}</th><th>${esc(tr('Amount'))}</th></tr><tr><td>${esc(y.label || p.name)}</td><td>${esc(y.due ? fmtDate(y.due) : '—')}</td><td>${esc(fmtAmt(y.amount, cur))}</td></tr></table>
    <p class="tot">${esc(tr('Total'))}: ${esc(fmtAmt(y.amount, cur))}</p><p class="mute">${esc(y.paid_at ? tr('Paid') + ' ' + fmtDate(y.paid_at.slice(0, 10)) : tr('Not paid yet'))}</p>
    <button onclick="print()">${esc(tr('Print or save as PDF'))}</button></body></html>`);
  w.document.close();
}

