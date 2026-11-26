/* ═════════════ tours ═════════════ */
const TOURS = {
  myturn: { name: 'My turn', route: 'myturn', steps: [
    { sel: '[data-tour="turn-now"]', t: 'This is your desk.', b: 'Only tasks where it’s your turn.' },
    { sel: '.turnline, .av.turn', t: 'Ring and days.', b: 'The ring shows whose turn it is; the number shows how long they’ve had it.' },
    { sel: '[data-tour="turn-waiting"]', t: 'Waiting on others.', b: 'Tasks you passed on wait here until they come back.' } ] },
  board: { name: 'Board', steps: [
    { sel: '[data-tour="board"] .colhead', t: 'Columns are statuses.', b: 'Your admin sets their names, colors and order.' },
    { sel: '[data-tour="board"] .card', t: 'Move a card.', b: 'Drag it on desktop. On the phone, press and hold.' },
    { sel: '[data-tour="view-title"]', t: 'Change the view.', b: 'Tap the title to switch views, projects or sprints.', phone: true },
    { sel: '[data-tour="filters"]', t: 'Filter, group, sort.', b: 'Shape the list any way you like, then save it as a view.' } ] },
  create: { name: 'Create', steps: [
    { sel: '[data-tour="create-types"]', t: 'Pick a type.', b: 'Bugs and development work stay separate.' },
    { sel: '#newTitle', t: 'Type shortcuts.', b: '@karim sets the developer, !high the priority, #mg the client.' },
    { sel: '[data-tour="create-sentence"]', t: 'Bugs route themselves.', b: 'A rule picks the developer. Tap any bold word to change it.' },
    { sel: '.sheet[data-key="create"] .btn.pri', t: 'Only the title is required.', b: 'Add details now or later.' } ] },
  detail: { name: 'Task detail', steps: [
    { sel: '.sheet .sentence', t: 'Read it like a sentence.', b: 'Tap any bold word to change it.' },
    { sel: '[data-tour="turn-strip"]', t: 'One next move.', b: 'The strip shows whose turn it is and the action for this step.' },
    { sel: '[data-tour="task-fields"]', t: 'Everything else.', b: 'All fields live here. Empty ones are folded away.' },
    { sel: '[data-tour="task-share"]', t: 'Share it.', b: 'Send this task to WhatsApp in one tap.' } ] },
  chat: { name: 'Chat', route: 'chat', steps: [
    { sel: '[data-tour="chat-list"]', t: 'Talk to the team here.', b: 'Channels are for everyone; direct messages are just between two people. Unread ones are bold.' },
    { sel: '[data-tour="chat-composer"]', t: 'Write, mention, attach.', b: 'Type @ to mention someone, a task key like SSS-12 to link a task, and use the clip to send photos or files.' },
    { sel: '[data-tour="huddle-btn"]', t: 'Need to talk? Start a huddle.', b: 'A voice or video call for this conversation. Everyone sees it’s live and can join in one tap.' } ] },
  review: { name: 'Review', route: 'review', steps: [
    { sel: '[data-tour="review-list"]', t: 'Everything waiting for your review.', b: 'Most urgent first. Tap any task to open it, or pass / send back right from the list.' },
    { sel: '[data-tour="review-list"] .btn', t: 'Send back needs a reason.', b: 'It becomes a comment for the developer and counts as a send-back.' },
    { sel: '[data-tour="review-list"]', t: 'Critical needs its checklist.', b: 'Tick every check before it can pass.' } ] },
  inbox: { name: 'Notifications', steps: [
    { sel: '[data-tour="inbox-list"]', t: 'Grouped by task.', b: 'One row per task, showing the latest reason.' },
    { sel: '[data-tour="inbox-list"] .reason', t: 'Only what needs you buzzes.', b: 'Your turn and mentions notify you; the rest wait here.' },
    { sel: '[data-tour="inbox-list"] .inrow', t: 'Swipe to clear.', b: 'Right marks it done, left snoozes it. On desktop, right-click.' } ] },
  bugs: { name: 'Bugs', route: 'bugs', steps: [
    { sel: '[data-tour="triage"]', t: 'Triage first.', b: 'New bugs wait here until someone starts them.' },
    { sel: '[data-tour="filters"]', t: 'Regressions stand out.', b: 'Bugs that came back after Done get a red edge.' } ] },
  settings: { name: 'Settings', admin: true, steps: [
    { sel: '[data-set="workflow"]', t: 'Your workflow.', b: 'Rename, recolor or reorder statuses.' },
    { sel: '[data-set="items"]', t: 'Types and fields.', b: 'Each type brings its own sections. Add Client, Area, Tier, or anything you track.' },
    { sel: '[data-set="automation"]', t: 'Routing and owners.', b: 'Decide who gets new bugs and who reviews.' } ] },
  import: { name: 'Import', steps: [
    { sel: '[data-tour="import-template"]', t: 'Start from the template.', b: 'It already has your types, fields and team. Only Title is required.' },
    { sel: '[data-tour="import-upload"]', t: 'Upload it back.', b: 'Typos, nicknames and odd dates are fine. You review every fix before anything is created.' } ] },
  export: { name: 'Export', steps: [
    { sel: '[data-tour="export-format"]', t: 'Pick a format.', b: 'CSV opens in Excel. The client summary is ready for WhatsApp or email.' },
    { sel: '[data-tour="export-cols"]', t: 'Pick the columns.', b: 'Start from a preset, then add any field.' } ] },
  cmdk: { name: 'Command bar', steps: [
    { sel: '.cmdk input', t: 'Anything, from here.', b: 'Search tasks, jump to a view, or create. C creates, / searches.' } ] },
};
const tours = (() => {
  let queue = [], running = null, idx = 0, els = null;
  const state = k => (S.prefs?.tours || {})[k];
  const seen = k => !!state(k);
  const mark = (k, v) => { const t = Object.assign({}, S.prefs.tours || {}, { [k]: v }); savePrefs({ tours: t }); };
  function canRun() { return S.prefs && !S.prefs.tours_off && !running && !document.querySelector('.pop') && !document.querySelector('.dragging'); }
  function request(k) { if (!S.prefs || S.prefs.tours_off || seen(k) || (TOURS[k]?.admin && !isAdmin())) return; if (!queue.includes(k)) queue.push(k); setTimeout(kick, 450); }
  function kick() {
    if (!canRun() || !queue.length) return;
    if (S.ws && typeof myMember === 'function' && myMember() && !myMember().department) return void setTimeout(kick, 1500); // the first-time job question comes first
    const sheet = currentSheet();
    const k = queue.find(q => { const firstStep = TOURS[q].steps.find(s => findEl(s)); if (!firstStep) return false; const el = findEl(firstStep); return !sheet || sheet.contains(el); });
    if (!k) return; queue = queue.filter(q => q !== k); start(k);
  }
  function findEl(s) { if (s.phone && !isPhone()) return null; for (const sel of s.sel.split(',')) { const e = $$(sel.trim()).find(x => x.offsetParent !== null || x.getClientRects().length); if (e) return e; } return null; }
  let prevFocus = null;
  function start(k, replay) { running = k; idx = 0; prevFocus = document.activeElement; show(replay); }
  function end(result) { if (!running) return; const k = running; running = null; els?.forEach(e => e.remove()); els = null; if (result) mark(k, result); if (prevFocus && prevFocus.isConnected && prevFocus !== document.body) prevFocus.focus(); prevFocus = null; setTimeout(kick, 300); }
  function show() {
    els?.forEach(e => e.remove()); const steps = TOURS[running].steps;
    while (idx < steps.length && !findEl(steps[idx])) idx++;
    if (idx >= steps.length) return end('done');
    const s = steps[idx]; const target = findEl(s); target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = target.getBoundingClientRect(); const pad = 6;
    const hole = h('div', { class: 'tourhole', style: { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: Math.min(r.height + pad * 2, innerHeight * .6) + 'px' } });
    const mask = h('div', { class: 'tourmask', onclick: () => {} });
    const total = steps.filter(x => findEl(x)).length; const num = steps.slice(0, idx + 1).filter(x => findEl(x)).length;
    const last = !steps.slice(idx + 1).some(x => findEl(x));
    const bub = h('div', { class: 'tourbub', role: 'dialog', 'aria-label': 'Tour' },
      h('span', { class: 'k', text: `${num}/${total} · ${TOURS[running].name}` }), h('h5', { text: s.t }), h('p', { text: s.b }),
      h('div', { class: 'row2' }, h('button', { class: 'link sm', style: { color: 'var(--mute)' }, onclick: () => { savePrefs({ tours_off: true }); end(null); toast('Tours turned off', { label: 'Undo', fn: () => savePrefs({ tours_off: false }) }); } }, 'Turn off tours'),
        h('span', { class: 'sp' }), h('button', { class: 'btn sm ghost', onclick: () => end('skipped') }, 'Skip'), h('button', { class: 'btn sm pri', id: 'tourNext', onclick: () => { idx++; if (last) end('done'); else show(); } }, last ? 'Got it' : 'Next')));
    document.body.append(mask, hole, bub); els = [mask, hole, bub];
    const bw = bub.offsetWidth, bh = bub.offsetHeight; let top = r.bottom + 12; let left = Math.min(Math.max(12, r.left), innerWidth - bw - 12);
    if (top + bh > innerHeight - 12) top = r.top - bh - 12; if (top < 12) top = Math.min(innerHeight - bh - 12, r.bottom + 12);
    if (isPhone()) { left = 12; top = Math.max(12, innerHeight - bh - 86); if (r.bottom > top - 8) top = Math.max(12, r.top - bh - 12); }
    bub.style.left = left + 'px'; bub.style.top = top + 'px';
  }
  addEventListener('keydown', e => { if (running && e.key === 'Escape') { e.stopPropagation(); end('skipped'); } }, true);
  addEventListener('resize', debounce(() => { if (running) show(); }, 150));
  function onRoute() {
    const v = S.route.v;
    if (TOURS[v]?.route === v) request(v);
    if (!['myturn', 'inbox', 'review'].includes(v)) { if ((vc().layout === 'board')) request('board'); if (v === 'bugs') request('bugs'); }
  }
  return { request, kick, onRoute, state, seen, finish: k => { if (running === k) end('done'); }, replay: k => { if (k === 'inbox') { closeAllSheets(true); openNotifs(); } if (TOURS[k].route && S.route.v !== TOURS[k].route) go({ v: TOURS[k].route }); if (k === 'board' && vc().layout !== 'board') setVc({ layout: 'board' }); if (k === 'create') openCreate(); if (k === 'export') openExport(); if (k === 'detail' && S.tasks[0]) openTask(S.tasks[0].id); if (k === 'settings') openSettings('workspace'); if (k === 'cmdk') cmdk.open(); setTimeout(() => start(k, true), 400); }, get running() { return running; } };
})();

