/* ═════════════ Waiting on someone: a task can't move until a person gives something ═════════════
   The person waited on sees it at the top of My turn and gets told. Done clears it. */
const waitsOf = t => (Array.isArray(t.waits) ? t.waits : []);
const waitingOnMe = () => S.tasks.filter(t => !isClosed(t) && waitsOf(t).some(w => w.user === uid()));
function waitsBlock(t) {
  const ws = waitsOf(t); const canEdit = !reviewLocked(t);
  if (!ws.length && isClosed(t)) return null;
  const add = canEdit ? h('button', { class: 'btn sm', 'data-add-wait': '1', onclick: e => addWait(e.currentTarget, t) }, icon('plus', 14), ws.length ? 'Someone else' : 'Waiting on someone') : null;
  return h('div', { class: 'block' }, h('h4', {}, 'Waiting on', ws.length ? h('span', { class: 'prog', text: String(ws.length) }) : null),
    ws.length ? h('div', { class: 'waits' }, ws.map(w => h('div', { class: 'wait' }, avatar(prof(w.user), { size: 'xs' }),
      h('span', { class: 'grow' }, h('b', { text: first(prof(w.user)) || 'Someone' }), h('span', { class: 'sm', text: w.what }), h('span', { class: 'sm mute', text: `asked by ${w.by === uid() ? 'you' : first(prof(w.by)) || 'someone'} · ${ago(w.at)} ago` })),
      canEdit && (w.user === uid() || w.by === uid() || t.assignee_id === uid() || isAdmin()) ? h('button', { class: 'btn sm', onclick: () => clearWait(t, w) }, icon('check', 14), w.user === uid() ? 'Done, I gave it' : 'Got it') : null)))
      : h('p', { class: 'sm mute', style: { margin: '0 0 8px' }, text: plainOnly() ? 'Waiting for a document, a signature or an answer? Say who, and it lands in their My turn.' : 'Waiting for an API, a design, an answer? Say who, and it lands in their My turn.' }),
    add);
}
function addWait(anchor, t) {
  picker(anchor, { options: S.members.filter(m => m.user_id !== uid() || t.assignee_id !== uid()).map(m => ({ v: m.user_id, label: dname(prof(m.user_id)) })).sort((a, b) => a.label.localeCompare(b.label)), value: null, placeholder: 'Waiting on who?',
    onPick: who => { closePop(); if (!who) return;
      openSheet({ title: `Waiting on ${first(prof(who))}`, kind: 'center', stack: !!currentSheet(), build: sh => {
        const what = h('input', { type: 'text', id: 'waitWhat', placeholder: 'For what? e.g. the login API', style: { width: '100%' } });
        const go_ = h('button', { class: 'btn pri' }, 'Tell them');
        const run = async () => { const w = what.value.trim(); if (!w) { what.focus(); return toast('Say what you need'); }
          const cur = taskOf(t.id); const list = [...waitsOf(cur), { id: uuid(), user: who, what: w, by: uid(), at: nowIso() }];
          closeSheet(true); if (await patchTask(t.id, { waits: list }, { noUndo: true })) { track('wait_add'); toast(`${first(prof(who))} will see it in My turn`); } };
        go_.addEventListener('click', run); what.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
        sh.append(h('div', { class: 'sbody' }, h('label', { class: 'field' }, 'What do you need from them?', what)), h('div', { class: 'sfoot' }, h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), go_));
        setTimeout(() => what.focus(), 80);
      } }); } });
}
async function clearWait(t, w) {
  const cur = taskOf(t.id); const list = waitsOf(cur).filter(x => x.id !== w.id);
  if (await patchTask(t.id, { waits: list }, { noUndo: true })) toast(w.user === uid() ? `${first(prof(w.by)) || 'They'} can carry on` : 'Cleared');
}
function waitingSection() {
  const list = waitingOnMe(); if (!list.length) return null;
  return h('section', { class: 'tsec waitsec' }, h('h3', {}, 'Your team is waiting 👋', h('span', { class: 'ct', text: String(list.length) })),
    h('div', { class: 'tlist' }, list.map(t => { const w = waitsOf(t).find(x => x.user === uid()); const who = first(prof(w.by)) || 'Someone';
      return h('div', { class: 'row tc waitrow', 'data-id': t.id }, h('span', { class: 'tile', 'aria-hidden': 'true', html: ST_TILE.clock }),
        h('button', { class: 'tt lvopen', onclick: () => openTask(t.id), title: `${taskKey(t)} · ${t.title}` }, h('b', {}, who, ' ', h('span', { text: 'needs' }), ' ', h('span', { class: 'notr', text: w.what })), h('span', { text: `So ${who} can keep going · ${ago(w.at)} ago` })),
        h('button', { class: 'btn sm pri', onclick: () => clearWait(t, w) }, 'Done')); })));
}

