/* ═════════════ Deals: sales and pre-sales ═════════════
   Sales follows each client from the first call until they sign, then hands over. A deal has no prices: the numbers
   live in the project's Money tab, written by the owner (software) and the hardware head (hardware), and signed by
   the people who see all money (the CEO). Pre-sales requests (demo, site survey, technical proposal) are ordinary
   tasks that point at their deal, so they have an owner, a date and "whose turn" like everything else. */
const STAGES = [['lead', 'Lead'], ['meeting', 'Meeting'], ['proposal', 'Proposal'], ['won', 'Won'], ['lost', 'Lost']];
const OPEN_STAGES = ['lead', 'meeting', 'proposal'];
const DEAL_KINDS = [['software', 'Software'], ['hardware', 'Hardware'], ['both', 'Software + Hardware']];
const PRESALES = [['demo', 'Demo'], ['survey', 'Site survey'], ['proposal', 'Technical proposal']];
const stageName = k => (STAGES.find(s => s[0] === k) || [k, k])[1];
const kindName = k => (DEAL_KINDS.find(s => s[0] === k) || [k, 'Software'])[1];
const dealOf = id => (S.deals || []).find(d => d.id === id);
const dealTasks = id => S.tasks.filter(t => t.deal_id === id);
const isPresalesTask = t => PRESALES.some(([k]) => tyOf(t.type_id)?.key === k);
const dealLate = d => OPEN_STAGES.includes(d.stage) && (!d.next_date || d.next_date <= todayIso());
/* who sees Deals in the menu: sales, pre-sales, admins, and anyone once there are deals */
const dealsInMenu = () => ['sales', 'presales', 'success', 'management', 'product', 'pm'].includes(myMember()?.department) || isAdmin() || canSeeSomeMoney();
const dealsBadge = () => ['sales', 'presales'].includes(myMember()?.department) ? (S.deals || []).filter(dealLate).length || null : null;
/* who writes the contract of a won deal: the owner for software, the hardware head(s) for hardware */
const contractWriters = dept => dept === 'hardware' && (S.ws.money_hw_viewers || []).length ? S.ws.money_hw_viewers : [S.ws.owner_id].filter(Boolean);
const namesOf = ids => ids.map(id => first(prof(id)) || 'someone').join(' and ');

function dealCard(d) {
  const late = dealLate(d); const open = dealTasks(d.id).filter(t => !isClosed(t)).length;
  const next = d.next_step ? `Next: ${d.next_step}${d.next_date ? ' · ' + fmtDate(d.next_date) : ''}` : 'No next step yet';
  return h('button', { class: 'row tc dealcard', 'data-deal': d.id, onclick: () => go({ v: 'deal', id: d.id }) },
    h('span', { class: 'tile ' + (d.stage === 'won' ? 'st-done' : d.stage === 'lost' ? 'st-canceled' : late ? 'bad' : 'st-started'), 'aria-hidden': 'true' }, icon('deal', 18)),
    h('span', { class: 'tt' }, h('b', { class: 'notr', text: d.name }),
      h('span', {}, h('span', { text: kindName(d.kind) }), ' · ', h('span', { class: late && OPEN_STAGES.includes(d.stage) ? 'over' : '', text: d.stage === 'won' ? `Won ${d.won_at ? fmtDate(d.won_at.slice(0, 10)) : ''}` : d.stage === 'lost' ? (d.lost_reason ? `Lost: ${d.lost_reason}` : 'Lost') : next }),
        open ? h('span', { text: ` · ${plural(open, 'pre-sales request')}` }) : null)),
    d.owner_id ? avatar(prof(d.owner_id), { size: 'xs' }) : null);
}
function viewDeals() {
  const all = S.deals || []; const tab = store.get('dealsTab.' + S.ws.id, 'open');
  const open = all.filter(d => OPEN_STAGES.includes(d.stage));
  const follow = open.filter(dealLate);
  const week = Date.now() - 7 * 864e5;
  const ready = S.tasks.filter(t => t.deal_id && isPresalesTask(t) && t.completed_at && new Date(t.completed_at) > week && OPEN_STAGES.includes(dealOf(t.deal_id)?.stage));
  const stat = (n, label, sel, cls) => h('button', { class: 'tstat' + (cls ? ' ' + cls : ''), onclick: () => $(sel)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, h('b', { text: String(n) }), h('span', { text: label }));
  const hero = h('header', { class: 'thero' }, h('div', { class: 'hrow' },
    h('div', { style: { minWidth: '0', flex: '1' } }, h('h1', { class: 'ptitle', text: 'Deals' }), h('div', { class: 'thsub', text: 'From the first call until the client signs' }),
      h('div', { class: 'seg cosplit', role: 'group', 'data-deals-tab': tab }, [['open', `Open ${open.length}`], ['won', 'Won'], ['lost', 'Lost']].map(([v, l]) => h('button', { 'aria-pressed': String(tab === v), onclick: () => { store.set('dealsTab.' + S.ws.id, v); render(); } }, l)))),
    isPhone() ? h('button', { class: 'x', 'data-gsearch': '1', 'aria-label': 'Search', title: 'Search', onclick: () => cmdk.open() }, icon('search', 22)) : null,
    isPhone() ? bellButton() : null));
  const stats = h('div', { class: 'tstats' }, stat(open.length, open.length === 1 ? 'open deal' : 'open deals', '.d-lead'), stat(follow.length, 'to follow up', '.d-lead', follow.length ? 'late' : ''), stat(ready.length, 'ready from pre-sales', '.d-ready'));
  const quick = h('div', { class: 'tsec quickacts' }, h('button', { class: 'btn pri', 'data-new-deal': '1', onclick: () => editDeal() }, icon('plus', 15), 'New deal'));
  const sec = (title, cls, list, card, empty) => h('section', { class: 'tsec ' + cls }, h('h3', {}, title, list.length ? h('span', { class: 'ct', text: String(list.length) }) : null),
    list.length ? h('div', { class: 'tlist' }, list.map(card)) : h('div', { class: 'colempty', text: empty }));
  const order = (a, b) => (dealLate(b) - dealLate(a)) || (a.next_date || '9').localeCompare(b.next_date || '9') || a.name.localeCompare(b.name);
  const body = tab === 'open' ? [
    ready.length ? sec('Ready from pre-sales', 'd-ready', ready, t => turnCard(t, { sub: `${dealOf(t.deal_id)?.name || ''} · done by ${first(prof(t.assignee_id)) || 'pre-sales'}` }), '') : null,
    ...['lead', 'meeting', 'proposal'].map(s => sec(stageName(s), 'd-' + s, open.filter(d => d.stage === s).sort(order), dealCard,
      s === 'lead' ? 'No new leads. Tap New deal when a client calls.' : s === 'meeting' ? 'No meetings set.' : 'No proposals out.'))]
    : [sec(tab === 'won' ? 'Won' : 'Lost', 'd-' + tab, all.filter(d => d.stage === tab).sort((a, b) => (b.won_at || b.updated_at || '').localeCompare(a.won_at || a.updated_at || '')), dealCard, tab === 'won' ? 'No deals won yet.' : 'No deals lost.')];
  return [h('div', { class: 'scroll turnpage cosite dealspage' }, hero, tab === 'open' ? stats : null, quick, tab === 'open' ? agentCard() : null, ...body)];
}

function viewDeal() {
  const d = dealOf(S.route.id);
  if (!d) return [h('div', { class: 'scroll' }, pageHead('Deal'), emptyState('NOT FOUND', 'This deal was deleted or you can’t see it.', { label: 'All deals', fn: () => go({ v: 'deals' }) }))];
  const open = OPEN_STAGES.includes(d.stage); const ts = dealTasks(d.id).sort((a, b) => isClosed(a) - isClosed(b));
  const sec = (title, cls, body, act) => h('section', { class: 'tsec ' + cls }, h('h3', {}, title, act ? h('button', { class: 'lnk sm', style: { marginInlineStart: 'auto' }, onclick: act[1] }, act[0]) : null), body);
  const hero = h('header', { class: 'thero' }, h('div', { class: 'hrow' },
    h('button', { class: 'btn icon ghost hback', 'aria-label': 'All deals', title: 'All deals', onclick: () => go({ v: 'deals' }) }, icon('back', 20)),
    h('div', { style: { minWidth: '0', flex: '1' } }, h('h1', { class: 'ptitle notr', text: d.name }),
      h('div', { class: 'thsub' }, [stageName(d.stage), kindName(d.kind), d.owner_id ? first(prof(d.owner_id)) : null].filter(Boolean).flatMap((x, i) => i ? [' · ', h('span', { text: x })] : [h('span', { text: x })])),
      open ? h('div', { class: 'seg cosplit', role: 'group', 'data-stage': d.stage }, OPEN_STAGES.map(s => h('button', { 'aria-pressed': String(d.stage === s), onclick: () => d.stage !== s && cfgUpsert('deals', { id: d.id, stage: s, updated_at: nowIso() }, `Moved to ${stageName(s)}`) }, stageName(s)))) : null)));
  const c = d.contact || {};
  const nextRow = h('div', { class: 'row tc' + (dealLate(d) && open ? ' lateish' : '') }, h('span', { class: 'tile' + (dealLate(d) && open ? ' bad' : ' st-started'), 'aria-hidden': 'true', html: ST_TILE.clock }),
    h('span', { class: 'tt' }, h('b', { text: d.next_step || 'No next step yet' }), h('span', { class: dealLate(d) && open ? 'over' : '', text: d.next_date ? fmtDate(d.next_date) + (d.next_date < todayIso() ? ' · late' : d.next_date === todayIso() ? ' · today' : '') : 'No date yet' })),
    open && d.next_step ? h('button', { class: 'btn sm', 'data-next-done': '1', onclick: () => editDeal(d, true) }, 'Done') : null);
  const contact = c.name || c.phone || c.email ? h('div', { class: 'row tc' }, h('span', { class: 'tile st-review', 'aria-hidden': 'true' }, icon('person', 18)),
    h('span', { class: 'tt' }, h('b', { class: 'notr', text: [c.name, c.role].filter(Boolean).join(' · ') || 'Contact' }), h('span', { class: 'notr', dir: 'auto', text: [c.phone, c.email].filter(Boolean).join(' · ') || '' })))
    : h('div', { class: 'colempty', text: 'Who do we talk to? Add their name and phone.' });
  const asks = PRESALES.filter(([k]) => typeByKey(k));
  const pre = h('div', {}, ts.length ? h('div', { class: 'tlist' }, ts.map(t => turnCard(t))) : h('div', { class: 'colempty', text: asks.length ? 'Ask pre-sales for a demo, a site survey or a technical proposal.' : 'An admin adds the Demo, Site survey and Technical proposal task types in Settings.' }),
    open && asks.length ? h('div', { class: 'quickacts', style: { marginTop: '10px' }, 'data-ask-presales': '1' }, asks.map(([k, l]) => h('button', { class: 'btn', onclick: () => askPresales(d, k) }, icon('plus', 15), l))) : null);
  const projs = (d.project_ids || []).map(pjOf).filter(Boolean);
  const projBody = h('div', { class: 'tlist' }, projs.map(p => { const x = canSeeProjMoney(p) && M.loaded === S.ws.id ? moneyMath(p.id) : null; const sig = (moneyOf(p.id).contract || {}).signed_at;
    return h('button', { class: 'row tc', onclick: () => go({ v: 'project', id: p.id }) }, h('span', { class: 'tile st-done', 'aria-hidden': 'true' }, icon('folder', 18)),
      h('span', { class: 'tt' }, h('b', { class: 'notr', text: p.name }), h('span', { text: [pDept(p) === 'hardware' ? 'Hardware' : 'Software',
        x ? (x.value ? (sig ? 'contract signed' : 'waiting for the signature') : `waiting for ${namesOf(contractWriters(pDept(p)))} to add the contract`) : `${namesOf(contractWriters(pDept(p)))} adds the contract`].join(' · ') }))); }));
  const acts = h('div', { class: 'tsec quickacts dealacts' }, open ? [
    h('button', { class: 'btn pri', 'data-won': '1', onclick: () => markWon(d) }, icon('check', 15), 'Mark as won'),
    h('button', { class: 'btn', onclick: () => editDeal(d) }, 'Edit'),
    h('button', { class: 'btn ghost', 'data-lost': '1', onclick: () => markLost(d) }, 'Mark as lost')]
    : [h('button', { class: 'btn', onclick: () => editDeal(d) }, 'Edit'), d.stage === 'lost' || !projs.length ? h('button', { class: 'btn ghost', onclick: () => cfgUpsert('deals', { id: d.id, stage: 'proposal', lost_reason: null, updated_at: nowIso() }, 'Reopened') }, 'Reopen') : null,
      d.created_by === uid() || isAdmin() ? h('button', { class: 'btn ghost danger', 'data-del-deal': '1', onclick: async e => { const b = e.currentTarget; if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Tap again to delete'; return; } await cfgDelete('deals', d.id, 'Deal deleted'); go({ v: 'deals' }); } }, 'Delete') : null]);
  if (M.loaded !== S.ws.id && canSeeSomeMoney() && projs.length) loadMoney().then(() => refresh());
  return [h('div', { class: 'scroll turnpage cosite dealpage', 'data-deal-page': d.id }, hero, h('div', { style: { height: '14px' } }),
    open ? sec('Next step', 'd-next', h('div', { class: 'tlist' }, nextRow), ['Change', () => editDeal(d, true)]) : null,
    projs.length ? sec('Projects', 'd-projects', projBody) : null,
    sec('Contact', 'd-contact', contact, ['Edit', () => editDeal(d)]),
    sec('From pre-sales', 'd-pre', pre),
    d.notes ? sec('Notes', 'd-notes', h('p', { class: 'dnotes', dir: 'auto', text: d.notes })) : null,
    acts)];
}

/* new deal, edit, or (nextOnly) just the next step */
function editDeal(d, nextOnly) {
  const c = d?.contact || {};
  const sellers = S.members.filter(m => m.department === 'sales' || m.user_id === uid() || m.user_id === d?.owner_id).map(m => [m.user_id, first(prof(m.user_id)) || 'Someone']);
  const nextF = [{ key: 'next_step', id: 'dNext', label: 'Next step', value: nextOnly && d?.next_step && d.next_date && d.next_date <= todayIso() ? '' : d?.next_step, ph: 'e.g. Call Mr. Adel about the proposal' }, { key: 'next_date', id: 'dDate', label: 'When', type: 'date', value: d?.next_date }];
  const fields = nextOnly ? nextF : [{ key: 'name', id: 'dName', label: 'Client name', value: d?.name, ph: 'e.g. Royal City', required: true },
    { key: 'kind', label: 'What they want', type: 'choice', value: d?.kind || 'software', options: DEAL_KINDS },
    { key: 'stage', label: 'Where it is', type: 'choice', value: d?.stage && OPEN_STAGES.includes(d.stage) ? d.stage : 'lead', options: STAGES.slice(0, 3), skip: d && !OPEN_STAGES.includes(d.stage) },
    { key: 'owner_id', label: 'Sales person', type: 'choice', value: d?.owner_id || uid(), options: sellers },
    { key: 'c_name', id: 'dCName', label: 'Contact name', value: c.name, ph: 'e.g. Adel Samir' }, { key: 'c_role', id: 'dCRole', label: 'Their job', value: c.role, ph: 'e.g. Facility manager' },
    { key: 'c_phone', id: 'dCPhone', label: 'Phone', type: 'tel', value: c.phone, ph: 'e.g. 0100 000 0000' }, { key: 'c_email', id: 'dCEmail', label: 'Email', type: 'email', value: c.email, ph: 'e.g. adel@royalcity.com' },
    ...nextF, { key: 'notes', id: 'dNotes', label: 'Notes', value: d?.notes, ph: 'e.g. They use another app now; contract ends in March' }].filter(f => !f.skip);
  moneyForm(nextOnly ? 'Next step' : d ? d.name : 'New deal', fields, async v => {
    const row = nextOnly ? { id: d.id, next_step: v.next_step || null, next_date: v.next_date || null, updated_at: nowIso() }
      : Object.assign({ id: d?.id || uuid(), name: v.name, kind: v.kind, owner_id: v.owner_id, contact: { name: v.c_name || '', role: v.c_role || '', phone: v.c_phone || '', email: v.c_email || '' },
        next_step: v.next_step || null, next_date: v.next_date || null, notes: v.notes || null, updated_at: nowIso() }, v.stage ? { stage: v.stage } : {},
        d ? {} : { workspace_id: S.ws.id, project_ids: [], created_by: uid(), created_at: nowIso() });
    const ok = await cfgUpsert('deals', row, d ? 'Saved' : 'Deal added');
    if (ok && !d) go({ v: 'deal', id: row.id });
    return ok;
  });
}
function askPresales(d, key) {
  const ty = typeByKey(key); if (!ty) return;
  const pre = S.members.filter(m => m.department === 'presales');
  openCreate({ typeKey: key, showDetails: true, prefill: { title: `${ty.name} · ${d.name}` }, extra: { deal_id: d.id }, preset: { assignee_id: pre.length === 1 ? pre[0].user_id : null } });
}
/* won: make the project(s) — one per side — and tell who writes each contract */
function markWon(d) {
  const sides = d.kind === 'both' ? ['software', 'hardware'] : [d.kind || 'software'];
  openSheet({ title: `${d.name} is won 🎉`, kind: 'center', key: 'won', build: sh => {
    const ins = sides.map(s => [s, h('input', { type: 'text', 'data-won-name': s, value: sides.length > 1 ? `${d.name} · ${s === 'hardware' ? 'Hardware' : 'Software'}` : d.name, style: { width: '100%' } })]);
    const go_ = h('button', { class: 'btn pri', 'data-won-go': '1' }, sides.length > 1 ? 'Make the 2 projects' : 'Make the project');
    go_.addEventListener('click', async () => {
      if (ins.some(([, el]) => !el.value.trim())) return toast('Give each project a name');
      const done = busy(go_, 'Making…'); const ids = [];
      for (const [s, el] of ins) { const row = { id: uuid(), workspace_id: S.ws.id, name: el.value.trim(), color: s === 'hardware' ? '#B54708' : '#2A44B0', kind: 'client', department: s, about: '', docs: [], created_at: nowIso() };
        if (!(await cfgUpsert('projects', row))) { done(); return; } ids.push(row.id); }
      const ok = await cfgUpsert('deals', { id: d.id, stage: 'won', won_at: nowIso(), project_ids: [...(d.project_ids || []), ...ids], updated_at: nowIso() });
      done(); if (!ok) return; closeSheet(true);
      toast(`Won. ${namesOf([...new Set(sides.flatMap(contractWriters))])} will add the contract`);
    });
    sh.append(h('div', { class: 'sbody' }, h('p', { class: 'note', text: sides.length > 1 ? 'One project for the software and one for the hardware, so each side sees its own work and money.' : 'Ovrto makes the project now. Its tasks and money live there.' }),
      ins.map(([s, el]) => h('label', { class: 'field' }, sides.length > 1 ? (s === 'hardware' ? 'Hardware project' : 'Software project') : 'Project name', el)),
      h('p', { class: 'note', text: sides.map(s => `${namesOf(contractWriters(s))} adds the ${sides.length > 1 ? s + ' ' : ''}contract and payments.`).join(' ') + ' You won’t see the numbers.' })),
      h('div', { class: 'sfoot' }, h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), go_));
  } });
}
function markLost(d) {
  moneyForm(`${d.name}: lost`, [{ key: 'why', id: 'dWhy', label: 'Why?', ph: 'e.g. Went with a cheaper company', required: true }],
    v => cfgUpsert('deals', { id: d.id, stage: 'lost', lost_reason: v.why, updated_at: nowIso() }, 'Marked as lost'));
}

/* pre-sales home: the requests sales sent, soonest first */
function presalesParts() {
  const me_ = uid(); const week = Date.now() - 7 * 864e5;
  const mine = S.tasks.filter(t => isPresalesTask(t) && !isClosed(t) && (t.assignee_id === me_ || !t.assignee_id || turnIsMine(t)));
  const back = mine.filter(t => (t.sendbacks || 0) > 0 && turnIsMine(t)).sort(SORTS.turnage);
  const rest = mine.filter(t => !back.includes(t)).sort((a, b) => (a.due_date || '9').localeCompare(b.due_date || '9') || SORTS.turnage(a, b));
  const done = S.tasks.filter(t => isPresalesTask(t) && t.assignee_id === me_ && t.completed_at && new Date(t.completed_at) > week);
  const forWho = t => { const d = dealOf(t.deal_id); return [d ? d.name : null, d?.owner_id ? `for ${first(prof(d.owner_id))}` : null, t.due_date ? fmtDate(t.due_date) : null].filter(Boolean).join(' · '); };
  const surveys = mine.filter(t => tyOf(t.type_id)?.key === 'survey').length;
  return { sub: `Pre-sales · ${plural(mine.length, 'request')}`,
    stats: [[rest.length, rest.length === 1 ? 'request open' : 'requests open', '.h-req'], [surveys, surveys === 1 ? 'site survey' : 'site surveys', '.h-req'], [back.length, 'sent back', '.h-back', back.length ? 'late' : '']],
    quick: PRESALES.map(([k, l]) => newOf(k, l)),
    sections: [
      ['Sent back by sales', 'h-back', back, t => withBtn(turnCard(t, { sub: `${forWho(t)} · open it for the reason` }), 'Fix', () => openTask(t.id)), 'Nothing came back.'],
      ['Requests, soonest first', 'h-req', rest, t => withBtn(turnCard(t, { sub: forWho(t) || undefined }), 'Open', () => openTask(t.id)), 'No requests. Sales asks from a deal’s page.'],
      ['Done this week', 'h-done', done, t => turnCard(t, { sub: forWho(t) || 'Done' }), 'Nothing finished this week yet.']] };
}

