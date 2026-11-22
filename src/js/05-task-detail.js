/* ═════════════ task detail ═════════════ */
let detail = null; // { id, sh, filter }
function openTask(id) {
  const t = taskOf(id); if (!t) { toast('That task was deleted'); return; }
  S.selected = id;
  markRead(S.notifs.filter(n => n.task_id === id && !n.read_at).map(n => n.id));
  const ctx = openSheet({ title: taskKey(t), kind: 'right', full: true, key: 'task', onClose: () => { detail = null; if (location.hash.startsWith('#task-')) history.replaceState(null, '', location.pathname + location.search); },
    headExtra: h('div', { style: { display: 'flex', gap: '4px' } },
      h('button', { class: 'x', title: 'Share to WhatsApp', 'aria-label': 'Share', 'data-tour': 'task-share', onclick: () => shareTask(taskOf(id)) }, icon('whatsapp')),
      h('button', { class: 'x', title: 'More', 'aria-label': 'More actions', onclick: e => taskMenu(e.currentTarget, taskOf(id)) }, icon('more'))),
    build: sh => { detail = { id, sh, filter: store.get('actFilter', 'comments'), comments: [], activity: [], loading: true }; drawDetail(true); loadThread(id); } });
  tours.request('detail');
}
/* mute a task or project: its updates stop; the person's turn and mentions still come (the database enforces it) */
const isMuted = id => (S.mutes || []).some(m => m.target_id === id);
async function toggleMute(kind, id) {
  S.mutes = S.mutes || [];
  if (isMuted(id)) {
    const was = S.mutes; S.mutes = S.mutes.filter(m => m.target_id !== id); render();
    const { error } = await write({ t: 'notif_mutes', op: 'delete', match: { user_id: uid(), target_id: id } });
    if (error) { S.mutes = was; render(); return toast(errText(error)); }
    toast(kind === 'project' ? 'Project updates on again' : 'Task updates on again');
  } else {
    const row = { user_id: uid(), workspace_id: S.ws.id, target_id: id, target_kind: kind }; S.mutes = [...S.mutes, row]; render();
    const { error } = await write({ t: 'notif_mutes', op: 'insert', row, plain: true });
    if (error) { S.mutes = S.mutes.filter(m => m !== row); render(); return toast(errText(error)); }
    toast('Muted. You still hear when it’s your turn or someone mentions you');
  }
}
function taskMenu(anchor, t) {
  menu(anchor, [
    { label: 'Copy link', icon: 'share', fn: () => copyText(taskLink(t), 'Link copied') },
    { label: 'Copy ID', fn: () => copyText(taskKey(t), 'ID copied') },
    { label: 'Duplicate', fn: async () => { const c = await createTask({ title: t.title + ' (copy)', description: t.description, type_id: t.type_id, priority: t.priority, project_id: t.project_id, fields: clone(t.fields), assignee_id: t.assignee_id, sprint: t.sprint }); if (c) { toast(`${taskKey(c)} created`); openTask(c.id); } } },
    { label: 'Add sub-task', fn: () => openCreate({ parent: t.id }) },
    woOf(t.id) ? null : { label: 'Make it a site visit', fn: () => makeVisit(t) },
    tkOf(t.id) ? null : { label: 'Make it a client ticket', fn: () => makeTicket(t) },
    incOf(t.id) ? null : { label: 'Make it an incident', fn: () => makeIncident(t) },
    t.project_id && isMuted(t.project_id) ? { label: 'Updates muted with its project', fn: () => toggleMute('project', t.project_id) } : { label: isMuted(t.id) ? 'Unmute updates' : 'Mute updates', fn: () => toggleMute('task', t.id) },
    '-',
    ...(t.created_by === uid() || isAdmin() ? [{ label: 'Delete task', danger: true, fn: () => confirmIn($('.sbody', currentSheet()) || $('.mainc', currentSheet()), { text: `Delete ${taskKey(t)} and its comments? This can’t be undone.`, yes: 'Delete', danger: true, onYes: async () => { if (await deleteTask(t.id)) closeSheet(); } }) }] : []), // only the person who made it, or an admin
  ]);
}
const taskLink = t => location.origin + location.pathname + '#task-' + t.id;
function shareTask(t) {
  const txt = `*${taskKey(t)}* ${t.title}\n${stOf(t.status_id)?.name || ''} · ${devLabel()}: ${dname(prof(t.assignee_id))}\n${taskLink(t)}`;
  if (navigator.share && isPhone()) navigator.share({ text: txt }).catch(() => {});
  else window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener');
}
async function loadThread(id) {
  const [c, a] = await Promise.all([
    sb.from('comments').select('*').eq('task_id', id).order('created_at', { ascending: true }),
    sb.from('activity').select('*').eq('task_id', id).order('created_at', { ascending: true }),
  ]);
  if (!detail || detail.id !== id) return;
  const off = (c.error && isNetErr(c.error)) || (a.error && isNetErr(a.error)); const had = threadCache[id];
  if (off) { detail.comments = [...(had?.c || []), ...(detail.comments || []).filter(x => !(had?.c || []).some(y => y.id === x.id))]; detail.activity = had?.a || []; }
  else { detail.comments = c.data || []; detail.activity = a.data || []; }
  detail.loading = false; threadCache[id] = { c: detail.comments, a: detail.activity, at: nowIso() }; drawThread();
}
function refreshSheet() {
  if (detail) { if (!taskOf(detail.id)) { closeSheet(); toast('That task was deleted'); return; } drawDetail(false); }
  if (settingsCtx) drawSettings(false);
  if (notifCtx) drawNotifs();
}
function drawDetail(full) {
  const t = taskOf(detail.id); const sh = detail.sh; const active = document.activeElement;
  let wrap = $('.detail', sh);
  if (full || !wrap) {
    wrap?.remove();
    wrap = h('div', { class: 'detail' }, h('div', { class: 'mainc' }), h('aside', { class: 'rail', 'aria-label': 'Fields' }));
    sh.append(wrap);
  }
  const mainc = $('.mainc', wrap); const rail = $('.rail', wrap);
  const keep = sel => active && sh.contains(active) && isTyping() && active.closest(sel);
  // header + title
  if (!keep('.d-title')) {
    const head = $('.d-head', mainc) || h('div', { class: 'd-head' }); head.replaceChildren();
    head.append(h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' } }, plate(t, true), typeChip(tyOf(t.type_id), true),
      t.parent_id && taskOf(t.parent_id) ? h('button', { class: 'meta', onclick: () => openTask(t.parent_id) }, '↑ ', taskKey(taskOf(t.parent_id))) : null,
      t.sendbacks ? h('span', { class: 'meta red', title: 'Times sent back from review' }, icon('ret', 12), `sent back ${t.sendbacks}×`) : null));
    const ttl = autoGrow(h('textarea', { class: 'ttl d-title', rows: '1', 'aria-label': 'Title', value: t.title }));
    ttl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ttl.blur(); } });
    ttl.addEventListener('blur', () => { const v = ttl.value.trim(); if (v && v !== t.title) patchTask(t.id, { title: v }, { toast: 'Title updated' }); else ttl.value = t.title; });
    head.append(ttl);
    if (!head.parentNode) mainc.append(head);
  }
  replaceIn(mainc, 'd-sentence', () => sentence(t));
  replaceIn(mainc, 'd-turn', () => turnStrip(t));
  replaceIn(mainc, 'd-client', () => clientReportBlock(t));
  if (!keep('.d-desc')) replaceIn(mainc, 'd-desc', () => descBlock(t));
  if (!keep('.d-visit')) replaceIn(mainc, 'd-visit', () => visitBlock(t) || h('span'));
  if (!keep('.d-ticket')) replaceIn(mainc, 'd-ticket', () => ticketBlock(t) || h('span'));
  if (!keep('.d-inc')) replaceIn(mainc, 'd-inc', () => incidentBlock(t) || h('span'));
  replaceIn(mainc, 'd-run', () => runBlock(t) || h('span'));
  replaceIn(mainc, 'd-waits', () => waitsBlock(t));
  replaceIn(mainc, 'd-cause', () => causeBlock(t));
  if (!keep('.d-stopped')) replaceIn(mainc, 'd-stopped', () => stoppedBlock(t));
  replaceIn(mainc, 'd-files', () => filesBlock(t));
  if (!keep('.d-check')) replaceIn(mainc, 'd-check', () => checklistBlock(t));
  replaceIn(mainc, 'd-subs', () => subtasksBlock(t));
  if (!$('.d-thread', mainc)) mainc.append(h('div', { class: 'd-thread block' }));
  else mainc.append($('.d-thread', mainc));
  if (!keep('.rail')) { rail.replaceChildren(fieldsPanel(t)); }
  drawThread();
}
function replaceIn(parent, cls, make) {
  const old = $('.' + cls, parent); const n = make(); if (!n) { old?.remove(); return; }
  n.classList.add(cls); if (old) old.replaceWith(n); else { const thr = $('.d-thread', parent); thr ? parent.insertBefore(n, thr) : parent.append(n); }
}
/* the sentence: Type for Client in Area · developer X · priority · sprint · due */
const KIND_RANK = { select: 0, multi: 1, person: 2, date: 3, text: 4, number: 5, checkbox: 6 };
const OFFICE_HIDE_FIELDS = ['area', 'tier', 'phase'];
function sentenceFields(t) { const off = !techPerson(); return S.fields.filter(f => f.show_on_card && fieldApplies(f, t) && !(off && OFFICE_HIDE_FIELDS.includes(f.key)) && !(f.key === 'client' && !isAdmin() && !smallTeam() && myDepts().length && myDepts().every(d => (d.hide || []).includes('clients')))).sort((a, b) => (KIND_RANK[a.kind] - KIND_RANK[b.kind]) || a.position - b.position); }
function sentence(t) {
  const ty = tyOf(t.type_id); const parts = [];
  const w = (label, onclick, empty, tourId) => h('button', { class: 'w' + (empty ? ' blank' : ''), onclick, 'data-tour': tourId || null }, label);
  parts.push(w(ty?.name || 'Type', e => pickType(e.currentTarget, t), false, 'sentence'));
  let usedFor = false, usedIn = false;
  for (const f of sentenceFields(t)) {
    const txt = fieldText(t, f); const word = f.kind === 'select' && !usedFor ? (usedFor = true, 'for') : f.kind === 'multi' && !usedIn ? (usedIn = true, 'in') : f.name.toLowerCase();
    parts.push(txt ? ' ' + word + ' ' : ', ', w(txt || 'no ' + f.name.toLowerCase(), e => pickField(e.currentTarget, t, f), !txt));
  }
  parts.push(devWord(), w(t.assignee_id ? dname(prof(t.assignee_id)) : 'no one yet', e => pickPerson(e.currentTarget, t.assignee_id, v => patchTask(t.id, { assignee_id: v }, { toast: v ? `${first(prof(v))}’s on it` : 'Developer cleared' })), !t.assignee_id));
  parts.push(', ', w(t.priority ? prioName(t.priority) + ' priority' : 'no priority', e => pickPriority(e.currentTarget, t), !t.priority));
  if (usesSprints() || (t.sprint && softwarePerson())) parts.push(', ', w(t.sprint ? `Sprint ${t.sprint}` : 'no sprint', e => pickSprint(e.currentTarget, t), !t.sprint));
  parts.push(', ', w(t.due_date ? 'due ' + fmtDate(t.due_date) : 'no due date', e => pickDate(e.currentTarget, t.due_date, v => patchTask(t.id, { due_date: v }, { toast: v ? 'Due date set' : 'Due date cleared' })), !t.due_date), '.');
  return h('p', { class: 'sentence', style: { margin: '0' } }, parts);
}
/* the next move(s) on a task, as the task page shows them. "Tell Ovrto" uses the same list, so every rule holds */
function nextMoves(t) {
  const c = catOf(t); const flags = t.flags || []; const out = [];
  const act = (label, fn, pri = true, ic) => out.push({ label, fn, pri, ic });
  if (flags.includes('waiting')) act('Client replied', () => handoff(t, 'Client replied', { flags: flags.filter(f => f !== 'waiting') }));
  else if (flags.includes('decision')) act('Decision made', () => handoff(t, 'Decision made', { flags: flags.filter(f => f !== 'decision') }, true));
  else if ((c === 'backlog' || c === 'unstarted') && (turnIsMine(t) || t.assignee_id === uid() || isAdmin())) act('Start work', () => moveTask(t, { status_id: (firstStatus('started') || defaultStatus()).id }));
  else if (c === 'started' && (turnIsMine(t) || t.assignee_id === uid() || !t.assignee_id || isAdmin())) { const r = firstStatus('review'); act(r ? 'Send to review' : 'Mark done', () => r ? handoff(t, 'Send to review', { status_id: r.id }) : passTask(t)); }
  else if (c === 'review') { if (canReview(t)) { act('Send back', () => sendBack(t), false, 'back'); act('Approve', () => passTask(t), true, 'pass'); } }
  else if (c === 'done' || c === 'canceled') act('Reopen', () => moveTask(t, { status_id: (firstStatus('started') || defaultStatus()).id, gate_checks: [] }), false);
  return out;
}
/* turn strip: whose turn it is + one next move */
function turnStrip(t) {
  const o = t.turn_owner; const c = catOf(t); const flags = t.flags || [];
  const ownerProf = o && !['client', 'admins'].includes(o) ? prof(o) : null;
  const tzOther = ownerProf?.tz && ownerProf.tz !== myTz() ? `${localTime(ownerProf.tz)} there` : null;
  const acts = nextMoves(t).map(m => h('button', { class: 'btn' + (m.pri ? ' pri' : ''), onclick: m.fn }, m.ic ? icon(m.ic, 16) : null, m.label));
  const strip = h('div', { class: 'turnstrip', 'data-tour': 'turn-strip' },
    turnAvatar(t, 'lg'),
    h('div', { class: 'who' }, h('b', { text: o ? (turnIsMine(t) ? 'Your turn' : `${turnName(o)}’s turn`) : c === 'done' ? 'Done' : c === 'canceled' ? 'Closed' : c === 'backlog' ? 'In the backlog' : 'Nobody’s turn yet' }),
      h('span', { text: [o ? `for ${ago(t.turn_since)}` : t.completed_at ? `finished ${fmtDate(t.completed_at)}` : '', tzOther].filter(Boolean).join(' · ') })),
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, acts));
  return reviewLocked(t) ? h('div', {}, strip, h('p', { class: 'note lock-note', role: 'note' }, icon('lock', 14), h('span', { text: lockText(t) }))) : strip;
}
function handoff(t, label, patch, needNote) {
  openSheet({ title: `${label} · ${taskKey(t)}`, kind: 'center', stack: !!currentSheet(), build: sh => {
    const ta = autoGrow(h('textarea', { id: 'handoffNote', rows: '3', placeholder: needNote ? 'What was decided?' : 'Optional handoff note: context the next person needs', style: { width: '100%' } }));
    const go_ = h('button', { class: 'btn pri', disabled: !!needNote }, label);
    if (needNote) ta.addEventListener('input', () => { go_.disabled = !ta.value.trim(); });
    go_.addEventListener('click', async () => {
      const note = ta.value.trim(); closeSheet(true);
      const prev = {}; for (const k in patch) prev[k] = clone(t[k] ?? null);
      if (note) await addComment(t.id, `→ ${label}: ${note}`);
      const ok = await patchTask(t.id, patch, { noUndo: true });
      if (ok) { const nt = taskOf(t.id); const done_ = { 'Send to review': 'Sent to review', 'Client replied': 'Back in play', 'Decision made': 'Decision recorded' }[label] || label; toast(nt.turn_owner && nt.turn_owner !== uid() ? `${done_} · over to ${first(prof(nt.turn_owner)) || turnName(nt.turn_owner)}` : done_, { label: 'Undo', fn: () => patchTask(t.id, prev) }); askPushSoon(); }
    });
    sh.append(h('div', { class: 'sbody' }, h('p', { class: 'note', text: 'The note is saved as a comment so the context travels with the task.' }), ta),
      h('div', { class: 'sfoot' }, h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), go_));
    setTimeout(() => ta.focus(), 50);
  } });
}
/* description as template sections */
function descBlock(t) {
  const secs = parseSections(t.description); const ty = tyOf(t.type_id); const tmpl = ty?.template || [];
  const have = new Set(secs.map(s => s.h)); const missing = tmpl.filter(x => !have.has(x));
  const save = newSecs => { const d = joinSections(newSecs); if (d !== t.description) patchTask(t.id, { description: d }); };
  const wrap = h('div', { class: 'block', 'data-tour': 'task-desc' }, h('h4', {}, 'Details'));
  const list = secs.length ? secs : [{ h: '', body: '' }];
  list.forEach((s, i) => {
    const box = h('div', { style: { marginBottom: '12px' } });
    if (s.h) box.append(h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' } }, h('b', { class: 'sm', style: { textTransform: 'uppercase', letterSpacing: '0', fontFamily: 'var(--display)' }, text: s.h }),
      h('button', { class: 'x', style: { width: '24px', height: '24px' }, 'aria-label': `Remove ${s.h}`, title: 'Remove section', onclick: () => { const n = secs.slice(); n.splice(i, 1); save(n); } }, icon('x', 12))));
    const view = h('div', { class: 'md mdbox', tabindex: '0', role: 'button', 'aria-label': `Edit ${s.h || 'description'}`, 'data-ph': s.h ? (secHint(s.h)?.[0].split('\n')[0] || 'Add ' + s.h.toLowerCase() + '…') : 'Add a description…', html: md(s.body) });
    const edit = () => {
      const ta = autoGrow(h('textarea', { value: s.body, rows: '3', style: { width: '100%' }, 'aria-label': s.h || 'Description' }));
      ta.addEventListener('blur', () => { const n = list.slice(); n[i] = { h: s.h, body: ta.value.trim() }; save(n); setTimeout(() => replaceIn($('.mainc', detail.sh), 'd-desc', () => descBlock(taskOf(t.id))), 0); });
      ta.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); ta.blur(); } });
      view.replaceWith(ta); ta.focus();
    };
    view.addEventListener('click', e => { if (!e.target.closest('a')) edit(); });
    view.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); edit(); } });
    box.append(view); if (s.h && !s.body && secHint(s.h)) box.append(h('small', { class: 'fhint', text: secHint(s.h)[1] })); wrap.append(box);
  });
  if (missing.length) wrap.append(h('div', { class: 'addsec' }, missing.map(m => h('button', { class: 'fchip', onclick: () => { save([...secs, { h: m, body: '' }]); setTimeout(() => { const v = $$('.d-desc .mdbox', detail.sh).pop(); v?.click(); }, 80); } }, icon('plus', 12), m))));
  return wrap;
}
/* attachments: photos, videos and PDFs on a task, kept private in the team's file storage and opened by signed links */
var TASK_FILE_MAX = 50 * 1024 * 1024;
async function signedFile(path) {
  if (waitingFiles.has(path)) return waitingFiles.get(path); // still on this phone
  const hit = fileLinks[path]; if (hit && hit.until > Date.now()) return hit.url;
  const { data, error } = await sb.storage.from('chat').createSignedUrl(path, 6 * 3600);
  if (error || !data?.signedUrl) return null;
  fileLinks[path] = { url: data.signedUrl, until: Date.now() + 5 * 3600e3 }; return data.signedUrl;
}
async function attachFiles(t, list) {
  if (reviewLocked(t)) { toast(lockText(t)); return; }
  const ok = [...list].filter(f => { if (f.size > TASK_FILE_MAX) { toast(`${f.name} is over 50 MB`); return false; } return true; });
  if (!ok.length) return;
  const note = toast(ok.length === 1 ? `Uploading ${ok[0].name}…` : `Uploading ${ok.length} files…`);
  const added = [];
  for (const f of ok) {
    const path = `${S.ws.id}/${uid()}/task-${t.id}/${uuid()}-${f.name.replace(/[^\w.\-]+/g, '_').slice(-80)}`;
    const { error, queued } = await putFile('chat', path, f);
    if (error) { toast(`Couldn’t upload ${f.name}: ${errText(error)}`); continue; }
    added.push({ name: f.name, path, type: f.type || '', size: f.size, by: uid(), at: nowIso() }); if (queued) added.waiting = true;
  }
  if (!added.length) return;
  const cur = taskOf(t.id); if (!cur) return;
  const ok2 = await patchTask(t.id, { files: [...(cur.files || []), ...added] });
  if (ok2) { track('task_attach'); toast((added.length === 1 ? 'File attached' : `${added.length} files attached`) + (added.waiting ? ' · saved on this phone, it goes up when you’re back online' : '')); }
}
async function removeFile(t, f) {
  const ok = await patchTask(t.id, { files: (t.files || []).filter(x => x.path !== f.path) }, { toast: 'Attachment removed', noUndo: true });
  if (ok && f.by === uid()) sb.storage.from('chat').remove([f.path]).catch(() => {});
}
function filesBlock(t) {
  const files = (t.files || []).filter(f => f && f.path);
  const input = h('input', { type: 'file', multiple: true, hidden: true, accept: 'image/*,video/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt', onchange: e => { const l = [...e.target.files]; e.target.value = ''; attachFiles(taskOf(t.id) || t, l); } });
  const add = h('button', { class: 'fchip', 'aria-label': 'Attach a photo, video or PDF', onclick: () => { if (reviewLocked(t)) return toast(lockText(t)); input.click(); } }, icon('clip', 13), 'Attach');
  const grid = h('div', { class: 'tfiles' });
  for (const f of files) {
    const can = f.by === uid() || isAdmin();
    const kind = /^image\//.test(f.type) ? 'img' : /^video\//.test(f.type) ? 'vid' : 'doc';
    const media = kind === 'img' ? h('img', { alt: f.name, loading: 'lazy' }) : kind === 'vid' ? h('video', { controls: true, preload: 'metadata', playsinline: true, 'aria-label': f.name }) : null;
    const link = h('a', { class: 'tf-name', target: '_blank', rel: 'noopener', title: f.name }, kind === 'doc' ? icon('export', 14) : null, h('span', { text: f.name }), h('span', { class: 'sm mute', text: fmtSize(f.size) }));
    const card = h('div', { class: 'tfile ' + kind },
      media ? (kind === 'img' ? h('a', { class: 'tf-media', target: '_blank', rel: 'noopener', 'aria-label': 'Open ' + f.name }, media) : h('div', { class: 'tf-media' }, media)) : null,
      h('div', { class: 'tf-row' }, link, can ? h('button', { class: 'x', 'aria-label': 'Remove ' + f.name, title: 'Remove', onclick: () => removeFile(taskOf(t.id) || t, f) }, icon('x', 14)) : null));
    grid.append(card);
    signedFile(f.path).then(url => { if (!url) return; $$('a', card).forEach(a => a.href = url); if (media) media.src = url; });
  }
  const block = h('div', { class: 'block' }, h('h4', {}, 'Attachments', files.length ? h('span', { class: 'prog', text: String(files.length) }) : null),
    files.length ? grid : h('p', { class: 'sm mute', style: { margin: '0 0 8px' }, text: 'Photos, videos and PDFs for this task. Up to 50 MB each.' }),
    h('div', { style: { display: 'flex', gap: '8px' } }, add, input));
  // drop files straight onto the block on a computer
  block.addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); block.classList.add('drop'); } });
  block.addEventListener('dragleave', () => block.classList.remove('drop'));
  block.addEventListener('drop', e => { e.preventDefault(); block.classList.remove('drop'); if (e.dataTransfer?.files?.length) attachFiles(taskOf(t.id) || t, e.dataTransfer.files); });
  return block;
}
function checklistBlock(t) {
  const items = t.checklist || []; const done = items.filter(x => x.done).length;
  const save = list => patchTask(t.id, { checklist: list });
  const add = h('input', { type: 'text', placeholder: 'Add a step…', 'aria-label': 'New checklist item', style: { flex: '1' } });
  add.addEventListener('keydown', e => { if (e.key === 'Enter' && add.value.trim()) { save([...items, { id: uuid(), text: add.value.trim(), done: false }]); replaceIn($('.mainc', detail.sh), 'd-check', () => checklistBlock(taskOf(t.id))); $('.d-check input[type=text]', detail.sh)?.focus(); } });
  return h('div', { class: 'block' }, h('h4', {}, 'Checklist', items.length ? h('span', { class: 'prog', text: `${done}/${items.length}` }) : null),
    items.map((it, i) => h('div', { class: 'ck-item' + (it.done ? ' done' : '') },
      h('input', { type: 'checkbox', checked: it.done, 'aria-label': it.text, onchange: e => { const l = clone(items); l[i].done = e.target.checked; save(l); } }),
      h('span', { class: 'tx', text: it.text }),
      h('button', { class: 'x del', 'aria-label': 'Remove step', onclick: () => save(items.filter((_, j) => j !== i)) }, icon('x', 14)))),
    h('div', { style: { display: 'flex', gap: '8px', marginTop: '4px' } }, add));
}
function subtasksBlock(t) {
  const subs = S.tasks.filter(x => x.parent_id === t.id); if (!subs.length) return null;
  const done = subs.filter(isClosed).length;
  return h('div', { class: 'block' }, h('h4', {}, 'Sub-tasks', h('span', { class: 'prog', text: `${done}/${subs.length}` }), h('span', { class: 'act' }, h('button', { class: 'btn sm ghost', onclick: () => openCreate({ parent: t.id }) }, icon('plus', 14), 'Add'))),
    subs.map(taskRow));
}
/* all fields (rail on desktop, below on phone) */
function fieldsPanel(t) {
  const kv = h('div', { class: 'kv', 'data-tour': 'task-fields' });
  const row = (label, val, help) => { kv.append(h('label', { text: label, title: help || '' }), h('div', { class: 'val' }, val)); };
  const pick = (txt, fn, empty, extra) => h('button', { class: 'pick' + (empty ? ' blank' : ''), onclick: fn }, extra || null, h('span', { text: txt }));
  const st = stOf(t.status_id);
  row('Status', pick(st?.name || '—', e => pickStatus(e.currentTarget, t), false, stIcon(st)));
  row('Type', pick(tyOf(t.type_id)?.name || '—', e => pickType(e.currentTarget, t)));
  row(devLabel(), pick(t.assignee_id ? dname(prof(t.assignee_id)) : 'Unassigned', e => pickPerson(e.currentTarget, t.assignee_id, v => patchTask(t.id, { assignee_id: v }, { toast: v ? `${first(prof(v))}’s on it` : 'Developer cleared' })), !t.assignee_id, avatar(prof(t.assignee_id), { size: 'xs' })));
  row('Reviewer', pick(t.reviewer_id ? dname(prof(t.reviewer_id)) : 'Workspace default', e => pickPerson(e.currentTarget, t.reviewer_id, v => patchTask(t.id, { reviewer_id: v }, { toast: 'Reviewer updated' })), !t.reviewer_id, avatar(prof(t.reviewer_id), { size: 'xs' })));
  row('Priority', pick(prioName(t.priority || 0), e => pickPriority(e.currentTarget, t), !t.priority, prioGlyph(t.priority || 0)));
  row('Project', pick(pjOf(t.project_id)?.name || 'No project', e => picker(e.currentTarget, { options: [...S.projects.map(p => ({ v: p.id, label: p.name })), { v: null, label: 'No project' }], value: t.project_id, onPick: v => patchTask(t.id, { project_id: v }, { toast: 'Project updated' }) }), !t.project_id));
  if (usesSprints() || t.sprint && softwarePerson()) row('Sprint', pick(t.sprint ? `Sprint ${t.sprint}` : 'No sprint', e => pickSprint(e.currentTarget, t), !t.sprint));
  startRow(t, row, pick);
  row('Due', pick(t.due_date ? fmtDate(t.due_date) : 'No date', e => pickDate(e.currentTarget, t.due_date, v => { if (v && t.start_date && v < t.start_date) return toast('The due date can’t be before the start'); patchTask(t.id, { due_date: v }); }), !t.due_date));
  waitsRow(t, row);
  row('Flags', pick((t.flags || []).map(k => FLAGS.find(f => f.k === k)?.n).filter(Boolean).join(', ') || 'No flags', e => picker(e.currentTarget, { options: FLAGS.map(f => ({ v: f.k, label: f.n, sub: '' })), value: t.flags || [], multi: true, search: false, onPick: v => patchTask(t.id, { flags: v }) }), !(t.flags || []).length));
  const applicable = S.fields.filter(f => fieldApplies(f, t) && !(!techPerson() && OFFICE_HIDE_FIELDS.includes(f.key))); const empty = applicable.filter(f => f.hide_empty && !hasVal(fieldVal(t, f)) && f.kind !== 'checkbox');
  const shown = applicable.filter(f => !empty.includes(f) || detail?.showEmpty);
  for (const f of shown) row(f.name, fieldEditor(t, f), f.help);
  const box = h('div', {}, h('h4', { style: { margin: '0 0 8px', font: '600 12px/16px var(--display)', letterSpacing: '0', color: 'var(--fg2)' }, text: 'Fields' }), kv);
  if (empty.length && !detail?.showEmpty) box.append(h('button', { class: 'link', style: { marginTop: '8px' }, onclick: () => { detail.showEmpty = true; $('.rail', detail.sh).replaceChildren(fieldsPanel(taskOf(t.id))); } }, `+${empty.length} empty field${empty.length > 1 ? 's' : ''}`));
  box.append(timeBlock(t));
  box.append(h('div', { class: 'sm mute', style: { marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '4px' } },
    h('span', { text: `Reported by ${!t.created_by && t.client_report ? `${t.client_report.name || 'the client'} (client)` : dname(prof(t.created_by))} · ${t.created_at ? fmtDT(t.created_at) : ''}` }), h('span', { text: `Updated ${ago(t.updated_at)} ago` })));
  return box;
}
function setField(t, f, v) { const fields = Object.assign({}, t.fields || {}); fields[f.id] = v; return patchTask(t.id, { fields }); }
function fieldEditor(t, f) {
  const v = fieldVal(t, f); const pick = (txt, fn, empty, extra) => h('button', { class: 'pick' + (empty ? ' blank' : ''), onclick: fn }, extra || null, h('span', { text: txt }));
  if (f.kind === 'select') { const o = optOf(f, v); return pick(o?.label || 'Empty', e => pickField(e.currentTarget, t, f), !o, o ? h('span', { class: 'swatch', style: { width: '10px', height: '10px', background: o.color } }) : null); }
  if (f.kind === 'multi') return h('button', { class: 'pick' + (hasVal(v) ? '' : ' blank'), onclick: e => pickField(e.currentTarget, t, f) }, hasVal(v) ? h('span', { class: 'tags' }, v.map(id => optOf(f, id)).filter(Boolean).map(o => tag(o.label, o.color))) : h('span', { text: 'Empty' }));
  if (f.kind === 'person') return pick(v ? dname(prof(v)) : 'Nobody', e => pickPerson(e.currentTarget, v, nv => setField(t, f, nv)), !v, avatar(prof(v), { size: 'xs' }));
  if (f.kind === 'checkbox') return h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!v, onchange: e => setField(t, f, e.target.checked) }), h('span', { class: 'sm', text: v ? 'Yes' : 'No' }));
  if (f.kind === 'date') return pick(v ? fmtDate(v) : 'No date', e => pickDate(e.currentTarget, v, nv => setField(t, f, nv)), !v);
  const inp = h('input', { type: f.kind === 'number' ? 'number' : 'text', value: v ?? '', 'aria-label': f.name, placeholder: 'Empty', style: { width: '100%', height: '30px', padding: '4px 8px' } });
  inp.addEventListener('change', () => setField(t, f, f.kind === 'number' ? (inp.value === '' ? null : Number(inp.value)) : inp.value.trim() || null));
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
  return inp;
}
/* pickers */
function pickStatus(a, t) { picker(a, { options: sortedStatuses().map(s => ({ v: s.id, label: s.name, icon: stIcon(s) })), value: t.status_id, onPick: v => { if (v === t.status_id) return; const s = stOf(v); if (s.category === 'done' && catOf(t) === 'review') return passTask(t); moveTask(t, { status_id: v }); } }); }
function pickType(a, t) { picker(a, { options: S.types.map(x => ({ v: x.id, label: x.name, icon: h('span', { class: 'swatch', style: { width: '10px', height: '10px', background: x.color } }) })), value: t.type_id, search: false, onPick: v => patchTask(t.id, { type_id: v }, { toast: `Now a ${tyOf(v).name.toLowerCase()}` }) }); }
function pickPriority(a, t) { picker(a, { options: PRIOS.map(p => ({ v: p.k, label: p.n, icon: prioGlyph(p.k) })), value: t.priority || 0, search: false, onPick: v => patchTask(t.id, { priority: v }, { toast: `${prioName(v)} priority` }) }); }
function pickSprint(a, t) { const c = sprintOf(); picker(a, { options: [c - 1, c, c + 1, c + 2].filter(n => n > 0).map(n => ({ v: n, label: `Sprint ${n}`, sub: n === c ? 'current' : n === c + 1 ? 'next' : '' })).concat([{ v: null, label: 'No sprint' }]), value: t.sprint, search: false, onPick: v => patchTask(t.id, { sprint: v }, { toast: v ? `Moved to Sprint ${v}` : 'Removed from sprint' }) }); }
function pickPerson(a, value, onPick, noneLabel = 'Nobody') { picker(a, { options: [...S.members.map(m => ({ v: m.user_id, label: dname(prof(m.user_id)) + (m.user_id === uid() ? ' (you)' : ''), icon: avatar(prof(m.user_id), { size: 'xs' }) })), { v: null, label: noneLabel }], value, onPick }); }
function pickField(a, t, f) {
  if (f.kind === 'multi') return picker(a, { options: f.options.map(o => ({ v: o.id, label: o.label, icon: h('span', { class: 'swatch', style: { width: '10px', height: '10px', background: o.color } }) })), value: fieldVal(t, f) || [], multi: true, onPick: vals => setField(t, f, vals) });
  if (f.kind === 'select') return picker(a, { options: [...f.options.map(o => ({ v: o.id, label: o.label, icon: h('span', { class: 'swatch', style: { width: '10px', height: '10px', background: o.color } }) })), { v: null, label: 'Empty' }], value: fieldVal(t, f), onPick: v => setField(t, f, v) });
  if (f.kind === 'person') return pickPerson(a, fieldVal(t, f), v => setField(t, f, v));
  if (f.kind === 'date') return pickDate(a, fieldVal(t, f), v => setField(t, f, v));
  if (f.kind === 'checkbox') return setField(t, f, !fieldVal(t, f));
  popover(a, pop => { const inp = h('input', { class: 'q', type: f.kind === 'number' ? 'number' : 'text', value: fieldVal(t, f) ?? '', placeholder: f.name }); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { closePop(); setField(t, f, inp.value === '' ? null : f.kind === 'number' ? Number(inp.value) : inp.value); } }); pop.append(inp, h('div', { class: 'hint', text: 'Enter to save' })); setTimeout(() => inp.focus(), 0); });
}
function pickDate(a, value, onPick) {
  popover(a, pop => {
    const today = new Date(); const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; // local date, not UTC
    const add = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
    const fri = (() => { const d = new Date(); d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7 || 7)); return iso(d); })();
    const inp = h('input', { type: 'date', value: value || '', 'aria-label': 'Date', style: { margin: '10px', width: 'calc(100% - 20px)' } });
    inp.addEventListener('change', () => { closePop(); onPick(inp.value || null); });
    const q = (label, v) => h('button', { class: 'opt', onclick: () => { closePop(); onPick(v); } }, h('span', { text: label, style: { flex: '1' } }), v ? h('span', { class: 'sub', text: fmtDate(v) }) : null);
    pop.append(inp, h('div', { class: 'opts' }, q('Today', iso(today)), q('Tomorrow', add(1)), q('End of week', fri), q('In two weeks', add(14)), value ? q('Clear date', null) : null));
  });
}
/* thread: comments + activity */
function drawThread() {
  if (!detail) return;
  if (!detail.loading && detail.comments) { threadCache[detail.id] = { c: detail.comments, a: detail.activity || [], at: nowIso() }; snapshot(); } // keep it for offline
  const box = $('.d-thread', detail.sh); if (!box) return;
  if (box.contains(document.activeElement)) { const list = $('.timeline', box); if (list) list.replaceWith(timeline()); return; }
  const filt = detail.filter;
  box.replaceChildren(h('h4', {}, 'Activity', h('span', { class: 'act' }, h('div', { class: 'seg', role: 'group', 'aria-label': 'Show' },
    h('button', { 'aria-pressed': String(filt === 'comments'), onclick: () => { detail.filter = 'comments'; store.set('actFilter', 'comments'); drawThread(); } }, 'Comments'),
    h('button', { 'aria-pressed': String(filt === 'all'), onclick: () => { detail.filter = 'all'; store.set('actFilter', 'all'); drawThread(); } }, 'All activity')))),
    timeline(), composer());
}
const FIELD_LABEL = { status: 'status', developer: 'developer', reviewer: 'reviewer', priority: 'priority', type: 'type', sprint: 'sprint', due: 'due date', project: 'project', flags: 'flags', fields: 'fields', title: 'title' };
function timeline() {
  const items = [...detail.comments.map(c => ({ k: 'c', at: c.created_at, c })), ...(detail.filter === 'all' ? detail.activity.map(a => ({ k: 'a', at: a.created_at, a })) : [])].sort((x, y) => x.at.localeCompare(y.at));
  const out = h('div', { class: 'timeline' }); let i = 0;
  if (detail.loading) { out.append(loadingRow(detail.filter === 'comments' ? 'Loading comments…' : 'Loading activity…')); return out; }
  if (!items.length) out.append(h('p', { class: 'note', text: detail.filter === 'comments' ? 'No comments yet. Mention someone with @ to ping them.' : 'No activity yet.' }));
  while (i < items.length) {
    const it = items[i];
    if (it.k === 'c') {
      const c = it.c; const a = prof(c.author_id); const isHand = /^(→|↺|✓) /.test(c.body);
      out.append(h('div', { class: 'ev' }, avatar(a, { size: 'xs' }), h('div', { class: 'b' },
        h('div', { class: 'who' }, dname(a), h('time', { text: fmtDT(c.created_at) }), isHand ? h('span', { class: 'handoff', text: c.body.startsWith('↺') ? 'send back' : c.body.startsWith('✓') ? 'approved' : 'handoff' }) : null,
          (c.author_id === uid() || isAdmin()) ? h('button', { class: 'link sm', style: { marginInlineStart: 'auto' }, onclick: async () => { await write({ t: 'comments', op: 'delete', id: c.id }); detail.comments = detail.comments.filter(x => x.id !== c.id); drawThread(); } }, 'Delete') : null),
        h('div', { class: 'txt', html: mentionHtml(c.body) }))));
      i++; continue;
    }
    // condense same actor within 10 minutes
    const actor = it.a.actor_id; const start = new Date(it.at).getTime(); const fields = new Set(); let created = false;
    while (i < items.length && items[i].k === 'a' && items[i].a.actor_id === actor && new Date(items[i].at).getTime() - start < 600e3) {
      const a = items[i].a; if (a.field === 'created') created = true; else fields.add(FIELD_LABEL[a.field] || a.field); i++;
    }
    const cr = !actor && created ? taskOf(detail.id)?.client_report : null;
    const who = cr ? `${cr.name || 'The client'} (client)` : dname(prof(actor));
    out.append(h('div', { class: 'ev small' }, h('span', {}, h('b', { text: who }), created ? (cr ? ' reported this from the client page' : ' created this task') : '', created && fields.size ? ' and' : '', fields.size ? ` changed ${[...fields].join(', ')}` : '', ` · ${ago(it.at)}`)));
  }
  return out;
}
function mentionHtml(body) { let s = esc(body); for (const m of S.members) { const n = dname(prof(m.user_id)); const f = first(prof(m.user_id)); for (const x of [n, f]) s = s.replaceAll('@' + esc(x), `<b style="color:var(--accent)">@${esc(x)}</b>`); } return s; }
function composer() {
  const ta = autoGrow(h('textarea', { id: 'commentBox', placeholder: 'Comment… use @ to mention', rows: '2', 'aria-label': 'Comment' }));
  const send = h('button', { class: 'btn pri sm', disabled: true }, 'Comment');
  ta.addEventListener('input', () => {
    send.disabled = !ta.value.trim();
    const m = ta.value.slice(0, ta.selectionStart).match(/@(\w*)$/);
    if (m) picker(ta, { options: S.members.filter(x => x.user_id !== uid()).map(x => ({ v: x.user_id, label: dname(prof(x.user_id)), icon: avatar(prof(x.user_id), { size: 'xs' }) })), search: false, onPick: id => {
      const before = ta.value.slice(0, ta.selectionStart).replace(/@(\w*)$/, '@' + first(prof(id)) + ' '); ta.value = before + ta.value.slice(ta.selectionStart); ta.focus(); ta.setSelectionRange(before.length, before.length); send.disabled = false;
    } });
    else closePop();
  });
  const go_ = async () => {
    const body = ta.value.trim(); if (!body) return; const done = busy(send, 'Sending…');
    const mentions = S.members.filter(m => m.user_id !== uid() && mentioned(body, prof(m.user_id))).map(m => m.user_id);
    const c = await addComment(detail.id, body, mentions);
    done(); if (c) { detail.comments.push(c); ta.value = ''; ta.blur(); detail.filter = detail.filter || 'comments'; drawThread(); }
  };
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) go_(); });
  send.addEventListener('click', go_);
  return h('div', { class: 'composer' }, ta, h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, h('span', { class: 'sm mute', text: isPhone() ? '' : '⌘/Ctrl + Enter to send' }), h('span', { class: 'sp' }), send));
}

