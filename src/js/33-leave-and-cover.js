/* ═════════════ Leave and cover: Ovrto asks who covers you, and hands over your work and logins ═════════════ */
const todayIso = () => new Date().toISOString().slice(0, 10);
const leaveState = l => (todayIso() < l.start_date ? 'soon' : todayIso() > l.end_date ? 'over' : 'now');
const coveringFor = () => (S.leaves || []).filter(l => l.cover_id === uid() && leaveState(l) !== 'over');
function leaveBanners() {
  // the leave bars need to know who has set up access; load that quietly once
  if (!V.loaded && !V.loading && (S.leaves || []).some(l => leaveState(l) !== 'over' && (l.user_id === uid() || l.cover_id === uid()))) { V.loading = true; loadVault().then(() => { V.loading = false; refresh(); }); }
  const out = [];
  for (const l of coveringFor()) { const n = (l.handover?.tasks || []).length, k = (l.handover?.items || []).length;
    out.push(h('button', { class: 'leavebar', 'data-cover': l.id, onclick: () => openHandover(l) }, icon('leave', 18), h('span', { class: 'grow' },
      h('b', { text: `You’re covering ${first(prof(l.user_id))} · ${fmtDate(l.start_date)} – ${fmtDate(l.end_date)}` }),
      h('span', { class: 'sm', text: [n ? plural(n, 'task') : null, k ? plural(k, 'login') : null, 'Open the handover'].filter(Boolean).join(' · ') })), icon('back', 16))); }
  for (const l of (S.leaves || []).filter(l => l.user_id === uid())) {
    const st = leaveState(l); if (st === 'over' && l.handover?.returned) continue;
    out.push(h('button', { class: 'leavebar mine', onclick: () => openHandover(l) }, icon('leave', 18), h('span', { class: 'grow' },
      h('b', { text: st === 'over' ? 'Welcome back. Take your work back' : `Your leave · ${fmtDate(l.start_date)} – ${fmtDate(l.end_date)}` }),
      h('span', { class: 'sm', text: st === 'over' ? `${first(prof(l.cover_id))} covered for you` : `${first(prof(l.cover_id)) || 'Nobody'} covers you` }),
      st !== 'over' && coverWaitText() ? h('span', { class: 'sm pjalert', text: 'Open Access to share your logins with them' }) : null), icon('back', 16)));
  }
  return out.length ? h('div', { class: 'leavebars' }, out) : null;
}
async function openLeave() {
  if (!V.loaded) await loadVault();
  if (V.unavailable) return toast('Leave cover is almost ready. Check back soon');
  openSheet({ title: 'Going on leave', kind: 'center', full: true, build: sh => {
    const d0 = todayIso(); let cover = null;
    const from = h('input', { type: 'date', id: 'lvFrom', value: d0, 'aria-label': 'From' }); const to = h('input', { type: 'date', id: 'lvTo', value: d0, 'aria-label': 'To' });
    const coverBtn = h('button', { class: 'btn', id: 'lvCover', type: 'button' }, 'Pick someone');
    const mine = S.tasks.filter(t => t.assignee_id === uid() && !isClosed(t)).sort(SORTS.priority);
    const myItems = V.items.filter(i => canOpenItem(i));
    const tSel = new Set(mine.filter(t => catOf(t) !== 'backlog').map(t => t.id)); const iSel = new Set(myItems.map(i => i.id));
    const box = (set, id) => { const c = h('input', { type: 'checkbox', checked: set.has(id), onchange: e => { e.target.checked ? set.add(id) : set.delete(id); } }); return c; };
    const taskList = h('div', { class: 'pjlist lvlist' }, mine.length ? mine.map(t => h('label', { class: 'pjrow' }, box(tSel, t.id), h('span', { class: 'grow' }, h('b', { text: t.title }), h('span', { class: 'sm mute', text: `${taskKey(t)} · ${stOf(t.status_id)?.name || ''}` }), t.stopped?.text ? h('span', { class: 'sm stopline', text: '↳ ' + t.stopped.text }) : h('span', { class: 'sm pjalert soft', text: catOf(t) === 'started' ? 'Write where you stopped before you go' : '' }))))
      : [h('p', { class: 'note', style: { padding: '12px' }, text: 'You have no open tasks.' })]);
    const itemsPart = h('div', {});
    const drawItems = () => {
      if (!myItems.length) return itemsPart.replaceChildren(h('p', { class: 'note', text: 'No logins shared with you.' }));
      if (!vaultUnlocked()) { const p = passField('lvPass', 'Your access passphrase', 'current-password'); const b = h('button', { class: 'btn' }, 'Unlock');
        b.addEventListener('click', async () => { if (await vaultUnlock(p.value)) drawItems(); else toast('Wrong passphrase'); });
        return itemsPart.replaceChildren(h('p', { class: 'sm mute', text: `Unlock to share your ${plural(myItems.length, 'login')} until you’re back.` }), h('div', { style: { display: 'flex', gap: '6px' } }, pwEye(p), b), h('button', { class: 'lnk sm', onclick: () => openVaultForgot() }, 'Forgot your passphrase?')); }
      itemsPart.replaceChildren(...[h('div', { class: 'pjlist lvlist' }, myItems.map(i => h('label', { class: 'pjrow' }, box(iSel, i.id), h('span', { class: 'vkind', text: i.kind }), h('span', { class: 'grow' }, h('b', { text: i.name }), h('span', { class: 'sm mute', text: pjOf(i.project_id)?.name || '' }))))),
        cover && !V.keys[cover] ? h('p', { class: 'sm pjalert', text: `${first(prof(cover))} hasn’t set up access yet. They’ll be asked to, and a keeper can share these with them.` }) : null].filter(Boolean));
    };
    coverBtn.addEventListener('click', e => picker(e.currentTarget, { options: memberOptions([uid()]).map(o => Object.assign(o, { sub: '' })), value: cover, placeholder: 'Who covers you?', onPick: v => { cover = v; coverBtn.textContent = dname(prof(v)); drawItems(); sync(); } }));
    const note = autoGrow(h('textarea', { id: 'lvNote', rows: '2', placeholder: 'Anything they should know: who to call, what is urgent', style: { width: '100%' } }));
    const save = h('button', { class: 'btn pri', disabled: true }, 'Hand over');
    const sync = () => { save.disabled = !cover || !from.value || !to.value || to.value < from.value; };
    from.addEventListener('change', () => { if (to.value < from.value) to.value = from.value; sync(); }); to.addEventListener('change', sync);
    save.addEventListener('click', async () => {
      save.disabled = true;
      const items = vaultUnlocked() ? myItems.filter(i => iSel.has(i.id)) : [];
      const row = { id: uuid(), workspace_id: S.ws.id, user_id: uid(), cover_id: cover, start_date: from.value, end_date: to.value, note: note.value.trim(), handover: { tasks: [...tSel], items: (vaultUnlocked() ? myItems.filter(i => iSel.has(i.id)) : myItems).map(i => i.id), names: Object.fromEntries(myItems.map(i => [i.id, { name: i.name, kind: i.kind }])), got: [] }, created_at: nowIso() };
      const { error } = await sb.from('leaves').insert(row); if (error) { save.disabled = false; return toast(errText(error)); }
      (S.leaves ||= []).push(row);
      for (const id of tSel) await patchTask(id, { assignee_id: cover }, { noUndo: true });
      let miss = []; for (const i of items) miss = await shareItem(i, [cover], to.value);
      closeSheet(true); track('leave_new');
      toast(miss.length ? `Handed over to ${first(prof(cover))}. Logins reach them once they set up access` : `Handed over to ${first(prof(cover))}. Enjoy your leave`); refresh();
    });
    sh.append(h('div', { class: 'sbody' },
      h('div', { class: 'field' }, 'When', h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, from, h('span', { class: 'mute', text: '→' }), to)),
      h('div', { class: 'field' }, 'Who covers you?', h('div', {}, coverBtn)),
      h('div', { class: 'field' }, 'Tasks to give them while you’re away', taskList),
      h('div', { class: 'field' }, 'Logins to share until you’re back', itemsPart),
      h('label', { class: 'field' }, 'Note for them', note)),
      h('div', { class: 'sfoot' }, h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), save));
    drawItems();
  } });
}
function openHandover(l) {
  const mineL = l.user_id === uid(); const st = leaveState(l);
  openSheet({ title: mineL ? 'Your leave' : `Covering ${first(prof(l.user_id))}`, kind: 'right', full: isPhone(), key: 'handover', build: async sh => {
    if (!V.loaded) await loadVault();
    const got = new Set(l.handover?.got || []);
    const tick = id => mineL ? h('span', { class: 'gotmark', text: got.has(id) ? '✓' : '' }) : h('input', { type: 'checkbox', checked: got.has(id), 'aria-label': 'Got it', onchange: async e => {
      e.target.checked ? got.add(id) : got.delete(id); const ho = Object.assign({}, l.handover, { got: [...got] });
      const { error } = await sb.from('leaves').update({ handover: ho }).eq('id', l.id); if (error) return toast(errText(error)); l.handover = ho; } });
    const ts = (l.handover?.tasks || []).map(taskOf).filter(Boolean); const its = (l.handover?.items || []).map(id => V.items.find(i => i.id === id) || { id, name: l.handover?.names?.[id]?.name || 'A login', kind: l.handover?.names?.[id]?.kind || '' });
    const giver = first(prof(l.user_id)) || 'They';
    /* tasks still with the cover (and not finished) come back; logins shared only for the leave stop */
    const takeBack = async () => {
      const mineBack = ts.filter(t => t.assignee_id === l.cover_id && !isClosed(t));
      for (const t of mineBack) await patchTask(t.id, { assignee_id: uid() }, { noUndo: true });
      for (const i of its) if (V.grants.some(g => g.item_id === i.id && g.user_id === l.cover_id && g.until)) await unshare(i, l.cover_id);
      return mineBack.length;
    };
    const back = mineL && st === 'over' && !l.handover?.returned ? h('button', { class: 'btn pri', onclick: async () => {
      closeSheet(true);
      const n = await withWait(async () => { const n = await takeBack(); const ho = Object.assign({}, l.handover, { returned: true }); await sb.from('leaves').update({ handover: ho }).eq('id', l.id); l.handover = ho; return n; });
      toast(`${plural(n, 'task')} back with you`); refresh(); } }, 'Take my tasks back') : null;
    sh.append(h('div', { class: 'sbody' },
      h('p', { class: 'note', text: `${fmtDate(l.start_date)} – ${fmtDate(l.end_date)} · ${mineL ? (first(prof(l.cover_id)) || 'Nobody') + ' covers you' : first(prof(l.user_id)) + ' is away'}` }),
      l.note ? h('div', { class: 'block' }, h('h4', {}, 'Note'), h('p', { class: 'sm', style: { margin: 0, whiteSpace: 'pre-wrap' }, text: l.note })) : null,
      back,
      h('h4', { class: 'vsub', text: `Logins · ${its.length}` }),
      its.length ? h('div', { class: 'pjlist' }, its.map(i => h('div', { class: 'pjrow' }, tick(i.id), i.kind ? h('span', { class: 'vkind', text: i.kind }) : null,
        h('button', { class: 'grow lvopen', onclick: () => { if (!V.items.includes(i)) return toast(myKey() ? `${giver} will share it automatically the next time they open Access` : 'Set up your access first, then it will be shared with you'); closeSheet(true); go({ v: 'vault' }); setTimeout(() => vaultUnlocked() && openLoginView(i), 300); } }, h('b', { text: i.name }), h('span', { class: 'sm mute', text: V.items.includes(i) ? 'Open in Access' : mineL ? (V.keys[l.cover_id] ? 'Shared when you unlock Access' : `Waiting for ${first(prof(l.cover_id))} to set up access`) : myKey() ? `Arrives when ${giver} opens Access` : 'Set up access to receive it' })))))
        : h('p', { class: 'note', text: 'No logins handed over.' }),
      !mineL && !myKey() ? h('button', { class: 'btn', onclick: () => { closeSheet(true); go({ v: 'vault' }); } }, icon('key', 16), 'Set up access to receive logins') : null,
      h('h4', { class: 'vsub', text: `Tasks · ${ts.length}` }),
      ts.length ? h('div', { class: 'pjlist' }, ts.map(t => h('div', { class: 'pjrow' }, tick(t.id), h('button', { class: 'grow lvopen', onclick: () => openTask(t.id) }, h('b', { text: t.title }),
        h('span', { class: 'sm mute', text: `${taskKey(t)} · ${stOf(t.status_id)?.name || ''} · with ${first(prof(t.assignee_id)) || 'nobody'}` }), t.stopped?.text ? h('span', { class: 'sm stopline', text: '↳ ' + t.stopped.text }) : null))))
        : h('p', { class: 'note', text: 'No tasks handed over.' }),
      mineL && st !== 'over' ? h('button', { class: 'btn ghost danger', style: { marginTop: '16px' }, onclick: e => confirmIn(sh, { text: 'Cancel this leave? Your tasks and the logins you shared come back to you.', yes: 'Cancel leave', danger: true, onYes: async () => { closeSheet(true);
        const r = await withWait(async () => { const n = await takeBack(); const { error } = await sb.from('leaves').delete().eq('id', l.id); return { n, error }; });
        if (r.error) { refresh(); return toast(errText(r.error)); }
        S.leaves = S.leaves.filter(x => x.id !== l.id); toast(r.n ? `Leave canceled · ${plural(r.n, 'task')} back with you` : 'Leave canceled'); refresh(); } }) }, 'Cancel leave') : null));
  } });
}

