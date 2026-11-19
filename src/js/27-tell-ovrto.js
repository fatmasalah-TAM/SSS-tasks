/* ═════════════ Tell Ovrto: say or type one thing, Ovrto finds the task and offers the right button ═════════════
   The AI only understands; the app's own buttons do the work (Send to review, Approve, waiting on someone,
   where I stopped, New task), so review rights, root causes and checklists all still apply. */
var aiChecked = null; // workspace id we already asked about AI
function aiKnown() {
  if (aiOn && aiOn.ws === S.ws?.id) return true;
  if (aiChecked !== S.ws?.id) { aiChecked = S.ws?.id; aiReady().then(on => { if (on && ['myturn', 'company'].includes(S.route.v)) render(); }); }
  return false;
}
function askCtx() {
  const open = S.tasks.filter(t => !isClosed(t));
  const mine = t => t.assignee_id === uid() || turnIsMine(t) || t.reviewer_id === uid();
  const list = [...open.filter(mine), ...open.filter(t => !mine(t))].slice(0, 150);
  return { tasks: list.map(t => ({ key: taskKey(t), title: (t.title || '').slice(0, 120), status: stOf(t.status_id)?.name || '', mine: mine(t) })),
    people: S.members.map(m => dname(prof(m.user_id))).filter(Boolean) };
}
function tellBar() {
  if (!aiKnown()) return null;
  const inp = h('input', { type: 'text', id: 'tellInput', placeholder: 'Tell Ovrto what you did…', 'aria-label': 'Tell Ovrto', autocomplete: 'off', enterkeyhint: 'send' });
  const send = h('button', { class: 'x tellsend', 'aria-label': 'Send', title: 'Send' }, icon('send', 18));
  const mic = h('button', { class: 'x tellmic', 'aria-label': 'Say it', title: 'Say it out loud' }, icon('mic', 18));
  const go_ = async () => { const text = inp.value.trim(); if (!text) { inp.focus(); return toast('Type or say what happened, in any language'); } await runTell({ text }, send); };
  send.addEventListener('click', go_); inp.addEventListener('keydown', e => { if (e.key === 'Enter') go_(); });
  mic.addEventListener('click', async () => { const v = await recordVoice('Tell Ovrto'); if (v) runTell({ audio: v.blob }, mic); });
  return h('div', { class: 'tsec tellsec' }, h('div', { class: 'tellbar', 'data-tour': 'tell' }, h('span', { class: 'tellspark', 'aria-hidden': 'true', text: '✦' }), inp, mic, send));
}
async function runTell(input, btn) {
  const done = busy(btn, ''); track(input.audio ? 'tell_voice' : 'tell_text');
  const body = { op: 'act', ws: S.ws.id, text: input.text || '', ctx: askCtx() };
  if (input.audio) body.audio = { mime: input.audio.type || 'audio/wav', data: await blobB64(input.audio) };
  const res = await withTimeout(sb.functions.invoke('notify', { body }), 60000).catch(() => ({ timedOut: true })); done();
  if (res.timedOut) return toast('The AI took too long. Try again.');
  const a = res.data?.act; if (res.error || !a) return toast(res.data?.error || 'AI didn’t answer. Check your connection and try again.');
  const box = $('#tellInput'); if (box) box.value = '';
  showTell(a, input.text || a.transcript || '');
}
function showTell(a, said) {
  const t = a.task ? S.tasks.find(x => taskKey(x) === a.task) : null;
  const pid = a.person ? matchPerson(a.person) : null;
  openSheet({ title: 'Tell Ovrto', kind: 'center', key: 'tell', build: sh => {
    const body = h('div', { class: 'sbody' });
    if (said) body.append(h('p', { class: 'note tellsaid' }, h('span', { text: 'You said: ' }), h('span', { class: 'notr', text: `“${said}”` })));
    if (a.reply) body.append(h('p', { class: 'tellreply', text: a.reply }));
    const card = t ? h('button', { class: 'row tc', 'data-id': t.id, onclick: () => { closeSheet(); openTask(t.id); } }, stTile(t),
      h('span', { class: 'tt' }, h('b', { class: 'notr', text: t.title || 'Untitled' }), h('span', { text: `${taskKey(t)} · ${stOf(t.status_id)?.name || ''}` }))) : null;
    if (card) body.append(card);
    const foot = h('div', { class: 'sfoot' }, h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), h('span', { class: 'sp' }));
    const btn = (label, fn, pri = true) => h('button', { class: 'btn' + (pri ? ' pri' : ''), onclick: () => { closeSheet(true); fn(); } }, label);
    const asTask = () => btn('Make it a new task', async () => { const hold = toast('AI is writing it up…', null, 20000); const r = await aiDraft({ text: said }); hold.remove(); r.error ? openCreate({ prefill: { title: said.slice(0, 120) } }) : openCreate({ draft: r.draft }); }, !t);
    const intent = a.intent;
    if (intent === 'create' || (!t && intent !== 'none')) {
      if (!t && intent !== 'create') body.append(h('p', { class: 'note', text: 'I couldn’t tell which task you mean. You can make it a new task, or open the task and do it there.' }));
      foot.append(asTask());
    } else if (intent === 'progress') {
      const moves = nextMoves(t).filter(m => m.label !== 'Send back');
      if (!moves.length) body.append(h('p', { class: 'note', text: 'There’s nothing for you to move on this task right now.' }));
      if (a.note) body.append(h('p', { class: 'note', text: `Your note goes in as a comment: “${a.note}”` }));
      foot.append(btn('Open task', () => openTask(t.id), false), ...moves.map(m => btn(m.label, async () => { if (a.note) await addComment(t.id, a.note); m.fn(); }, m.pri)));
    } else if (intent === 'wait') {
      if (!pid) body.append(h('p', { class: 'note', text: 'Who do you need it from? Open the task and use “Waiting on someone”.' }));
      else body.append(h('p', { class: 'note', text: `${first(prof(pid))} will see “${a.what || 'this'}” at the top of their My turn.` }));
      foot.append(btn('Open task', () => openTask(t.id), !pid), pid ? btn(`Tell ${first(prof(pid))}`, async () => {
        const cur = taskOf(t.id); const list = [...waitsOf(cur), { id: uuid(), user: pid, what: a.what || 'help with this', by: uid(), at: nowIso() }];
        if (await patchTask(t.id, { waits: list }, { noUndo: true })) { track('wait_add'); toast(`${first(prof(pid))} will see it in My turn`); } }) : null);
    } else if (intent === 'stopped') {
      const mine = t.assignee_id === uid() || t.turn_owner === uid() || isAdmin() || !t.assignee_id;
      if (a.note) body.append(h('p', { class: 'note', text: `Where you stopped: “${a.note}”` }));
      foot.append(btn('Open task', () => openTask(t.id), !mine || !a.note), mine && a.note && !reviewLocked(t) ? btn('Save where I stopped', async () => {
        if (await patchTask(t.id, { stopped: { text: a.note, by: uid(), at: nowIso() } }, { noUndo: true })) { track('stopped_note'); toast('Saved. Anyone can now continue from here'); } }) : null);
    } else if (intent === 'open') {
      foot.append(btn('Open task', () => openTask(t.id)));
    } else {
      body.append(h('p', { class: 'note', text: 'Try something like “I finished SSS-171”, “I’m waiting on Karim for the API” or “I stopped at the payment screen”.' }));
      if (said) foot.append(asTask());
    }
    sh.append(body, foot);
  } });
}

