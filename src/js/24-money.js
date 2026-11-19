/* ═════════════ Money: what a project brings in, what it costs, and what is left ═════════════
   Only the workspace owner and the people they pick see any of it (the database enforces this).
   Salaries are never per person: only the team's monthly total, split by the share of time a project takes. */
const M = { rows: {}, settings: null, salary: null, hwSalary: null, loaded: null };
const canSeeMoney = () => !!S.ws && (S.ws.owner_id === uid() || (S.ws.money_viewers || []).includes(uid()));
const isWsOwner = () => !!S.ws && S.ws.owner_id === uid();
/* Software / Hardware: the people the owner picks for "hardware money only" (e.g. the hardware CTO) see hardware projects' money */
const pDept = p => (p && p.department) || 'software';
const canSeeHwMoney = () => !!S.ws && !canSeeMoney() && (S.ws.money_hw_viewers || []).includes(uid());
const canSeeSomeMoney = () => canSeeMoney() || canSeeHwMoney();
const canSeeProjMoney = p => canSeeMoney() || (canSeeHwMoney() && pDept(p) === 'hardware');
/* salaries: only the owner and the people they pick (e.g. the CEO); other money people see money without them */
/* who WRITES the numbers: the owner for everything, the hardware head for hardware projects. The rest picked only look (and the CEO signs). */
const canEditProjMoney = p => !!S.ws && (S.ws.owner_id === uid() || ((S.ws.money_hw_viewers || []).includes(uid()) && pDept(p) === 'hardware'));
const canEditSalaries = () => !!S.ws && S.ws.owner_id === uid();
const signedOf = p => (moneyOf(p.id).contract || {}).signed_at || null;
async function signContract(p) {
  const { data, error } = await sb.rpc('sign_contract', { pid: p.id }); if (error) return toast(errText(error));
  const m = moneyOf(p.id); M.rows[p.id] = Object.assign({}, m, { contract: data || Object.assign({}, m.contract, { signed_at: nowIso(), signed_by: uid() }) });
  toast(`${p.name}: signed`); refresh();
}
const signLine = p => { const c = moneyOf(p.id).contract || {};
  if (c.signed_at) return `Signed by ${first(prof(c.signed_by)) || 'someone'} · ${fmtDate(c.signed_at.slice(0, 10))}`;
  const sg = S.ws.money_viewers || []; return sg.length ? `Waiting for ${namesOf(sg)} to sign` : 'Not signed yet'; };
const canSign = () => canSeeMoney();
const canSeeSalaries = () => canSeeMoney() && (S.ws.owner_id === uid() || (S.ws.salary_viewers || []).includes(uid()));
async function loadMoney() {
  if (!canSeeSomeMoney()) return; const ws = S.ws.id;
  const [a, b, c] = await Promise.all([sb.from('project_money').select('*').eq('workspace_id', ws), sb.from('money_settings').select('*').eq('workspace_id', ws),
    canSeeSalaries() ? sb.from('team_salaries').select('*').eq('workspace_id', ws) : Promise.resolve({ data: [] })]);
  if (S.ws?.id !== ws) return;
  M.rows = {}; for (const r of a.data || []) M.rows[r.project_id] = r; M.settings = (b.data || [])[0] || { workspace_id: ws, currency: 'EGP' }; M.salary = canSeeSalaries() ? ((c.data || [])[0]?.team_monthly ?? null) : null; M.hwSalary = canSeeSalaries() ? ((c.data || [])[0]?.hw_monthly ?? null) : null; M.loaded = ws;
}
const moneyOf = pid => M.rows[pid] || { project_id: pid, workspace_id: S.ws.id, contract: {}, payments: [], costs: [], share: null };
const cur = () => M.settings?.currency || 'EGP';
const fmtMoney = n => (n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('en-US') + ' ' + cur());
const monthsBetween = (a, b) => { if (!a) return 0; const s = new Date(a), e = b ? new Date(b) : new Date(); return Math.max(0, (e - s) / (30.44 * 864e5)); };
/* the numbers for one project */
function moneyMath(pid) {
  const m = moneyOf(pid); const c = m.contract || {}; const value = Number(c.value) || 0;
  const end = c.end && c.end < todayIso() ? c.end : null; const months = monthsBetween(c.start, end);
  const pays = m.payments || []; const received = pays.filter(x => x.paid_at).reduce((n, x) => n + (Number(x.amount) || 0), 0);
  const late = pays.filter(x => !x.paid_at && x.due && x.due < todayIso());
  const once = (m.costs || []).filter(x => x.every !== 'month').reduce((n, x) => n + (Number(x.amount) || 0), 0);
  const monthly = (m.costs || []).filter(x => x.every === 'month').reduce((n, x) => n + (Number(x.amount) || 0), 0);
  const costs = once + monthly * months;
  const pay = pDept(S.projects.find(p => p.id === pid)) === 'hardware' ? M.hwSalary : M.salary;
  const team = canSeeSalaries() && pay && m.share != null ? (Number(pay) * Number(m.share) / 100) * months : null;
  return { value, received, outstanding: value - received, late, costs, monthly, months, before: value - costs, team, net: team == null ? null : value - costs - team, share: m.share };
}
/* how much of the team's finished work went to this project lately: a starting point for the share */
function suggestedShare(pid) {
  const since = Date.now() - 90 * 864e5; const done = S.tasks.filter(t => t.completed_at && new Date(t.completed_at) > since);
  if (!done.length) return null; return Math.round(100 * done.filter(t => t.project_id === pid).length / done.length);
}
async function saveMoney(pid, patch, msg) {
  const row = Object.assign({}, moneyOf(pid), patch, { workspace_id: S.ws.id, project_id: pid, updated_by: uid(), updated_at: nowIso() });
  const { error } = await sb.from('project_money').upsert(row); if (error) { toast(errText(error)); return false; }
  M.rows[pid] = row; if (msg) toast(msg); refresh(); return true;
}
function projectMoney(p) {
  if (M.loaded !== S.ws.id) { loadMoney().then(() => refresh()); return [h('p', { class: 'note', text: 'Loading…' })]; }
  const m = moneyOf(p.id); const x = moneyMath(p.id); const c = m.contract || {};
  const stat = (n, l, cls) => h('div', { class: 'pjnum' + (cls ? ' ' + cls : '') }, h('b', { text: n }), h('span', { text: l }));
  const sec = (title, action, body) => h('section', {}, h('h2', {}, title, action ? h('button', { class: 'lnk sm', style: { marginInlineStart: 'auto' }, onclick: action[1] }, action[0]) : null), body);
  const ed = canEditProjMoney(p); const act = a => ed ? a : null;
  if (!x.value && !(m.payments || []).length && !(m.costs || []).length) return [
    ed ? emptyState('NO NUMBERS YET', 'Add the contract to see what this project brings in, what it costs and what is left. Only you and the people you pick see this.', { label: 'Add the contract', fn: () => editContract(p) })
      : emptyState('NO NUMBERS YET', `${namesOf(contractWriters(pDept(p)))} adds the contract and payments. They show up here.`)];
  const out = [
    h('div', { class: 'pjnums' }, stat(fmtMoney(x.value), 'contract'), stat(fmtMoney(x.received), 'received'), stat(fmtMoney(x.outstanding), x.late.length ? `still to come · ${x.late.length} late` : 'still to come', x.late.length ? 'bad' : ''),
      stat(fmtMoney(x.net != null ? x.net : x.before), x.net != null ? 'profit after the team' : 'profit before the team', (x.net != null ? x.net : x.before) < 0 ? 'bad' : 'good')),
    sec('Contract', act(['Edit', () => editContract(p)]), h('div', { class: 'pjlist' }, h('div', { class: 'pjrow' }, h('span', { class: 'grow' }, h('b', { text: fmtMoney(x.value) }),
      h('span', { class: 'sm mute', text: [c.start ? 'from ' + fmtDate(c.start) : null, c.end ? 'to ' + fmtDate(c.end) : null, c.note || null].filter(Boolean).join(' · ') || 'No dates yet' }),
      x.value ? h('span', { class: 'sm ' + (c.signed_at ? 'mute' : 'pjalert'), 'data-sign-line': '1', text: signLine(p) }) : null),
      x.value && !c.signed_at && canSign() && (!(S.ws.money_viewers || []).length || (S.ws.money_viewers || []).includes(uid())) ? h('button', { class: 'btn sm pri', 'data-sign': '1', onclick: () => signContract(p) }, icon('check', 14), 'Signed') : null))),
    sec('Payments', act(['+ Payment', () => editPayment(p)]), (m.payments || []).length ? h('div', { class: 'pjlist' }, (m.payments || []).slice().sort((a, b) => (a.due || '').localeCompare(b.due || '')).map(y => {
      const late = !y.paid_at && y.due && y.due < todayIso();
      return h('div', { class: 'pjrow' }, h('span', { class: 'grow' }, h('b', { text: `${fmtMoney(Number(y.amount))} · ${y.label || 'Payment'}` }),
        h('span', { class: 'sm ' + (late ? 'pjalert' : 'mute'), text: y.paid_at ? `Paid ${fmtDate(y.paid_at.slice(0, 10))}` : y.due ? (late ? `Late · was due ${fmtDate(y.due)}` : `Due ${fmtDate(y.due)}`) : 'No due date' })),
        !ed ? null : y.paid_at ? h('button', { class: 'btn sm ghost', onclick: () => editPayment(p, y) }, 'Edit') : h('button', { class: 'btn sm', 'data-mark-paid': '1', onclick: () => saveMoney(p.id, { payments: m.payments.map(z => z.id === y.id ? Object.assign({}, z, { paid_at: nowIso() }) : z) }, 'Marked as paid') }, icon('check', 14), 'Paid'));
    })) : h('p', { class: 'note', text: 'Add the payments in the contract and mark each one when it arrives.' })),
    sec('Costs', act(['+ Cost', () => editCost(p)]), (m.costs || []).length ? h('div', { class: 'pjlist' }, m.costs.map(y => h(ed ? 'button' : 'div', { class: 'pjrow', onclick: ed ? () => editCost(p, y) : null }, h('span', { class: 'grow' }, h('b', { text: `${fmtMoney(Number(y.amount))}${y.every === 'month' ? ' a month' : ''} · ${y.label}` }),
      h('span', { class: 'sm mute', text: y.every === 'month' ? `${fmtMoney(Number(y.amount) * x.months)} so far (${x.months.toFixed(1)} months)` : 'One time' })))))
      : h('p', { class: 'note', text: 'Servers, licences, hardware: anything this project costs besides the team.' })),
    canSeeSalaries() ? sec('The team', canEditSalaries() ? ['Edit', () => editShare(p)] : null, h('div', { class: 'pjlist' }, h('div', { class: 'pjrow' }, h('span', { class: 'grow' },
      h('b', { text: x.team != null ? `${fmtMoney(x.team)} so far` : 'Not set yet' }),
      h('span', { class: 'sm mute', text: salOf(p) ? (m.share != null ? `${m.share}% of the team’s time × ${fmtMoney(Number(salOf(p)))} a month × ${x.months.toFixed(1)} months` : `Set what share of the team’s time this project takes${suggestedShare(p.id) != null ? ` (about ${suggestedShare(p.id)}% of tasks done lately)` : ''}`) : 'Set the team’s total monthly salaries first' }))))) : null,
    h('section', { class: 'moneysum' }, h('div', { class: 'mrow' }, h('span', { text: 'Contract' }), h('b', { text: fmtMoney(x.value) })), h('div', { class: 'mrow' }, h('span', { text: 'Costs' }), h('b', { text: '− ' + fmtMoney(x.costs) })),
      h('div', { class: 'mrow tot' }, h('span', { text: 'Profit before the team' }), h('b', { text: fmtMoney(x.before) })),
      x.team != null ? [h('div', { class: 'mrow' }, h('span', { text: 'Team' }), h('b', { text: '− ' + fmtMoney(x.team) })), h('div', { class: 'mrow tot' + (x.net < 0 ? ' bad' : '') }, h('span', { text: 'Profit after the team' }), h('b', { text: fmtMoney(x.net) }))] : null),
    moneyPeople(),
  ];
  return out;
}
const salOf = p => pDept(p) === 'hardware' ? M.hwSalary : M.salary;
function moneyPeople() {
  const ids = [S.ws.owner_id, ...(S.ws.money_viewers || [])].filter(Boolean);
  return h('section', {}, h('h2', {}, 'Who sees money', isWsOwner() ? h('button', { class: 'lnk sm', style: { marginInlineStart: 'auto' }, 'data-money-people': '1', onclick: e => pickMoneyPeople(e.currentTarget) }, 'Change') : null),
    h('div', { class: 'pjpeople' }, ids.map(id => h('span', { class: 'pjperson' }, avatar(prof(id), { size: 'xs' }), h('span', { text: first(prof(id)) || 'Someone' }), id === S.ws.owner_id ? h('span', { class: 'sm mute', text: 'owner' }) : null))),
    h('p', { class: 'note', text: isWsOwner() ? 'They see everything and sign contracts. Only you write the numbers. Nobody else sees any of this, admins included.' : 'Only the owner writes the numbers. Nobody else sees any of this, admins included.' }),
    h('h2', { class: 'gapt' }, 'Hardware money only', isWsOwner() ? h('button', { class: 'lnk sm', style: { marginInlineStart: 'auto' }, 'data-hw-money-people': '1', onclick: e => pickHwMoneyPeople(e.currentTarget) }, 'Change') : null),
    (S.ws.money_hw_viewers || []).length ? h('div', { class: 'pjpeople' }, (S.ws.money_hw_viewers || []).map(id => h('span', { class: 'pjperson' }, avatar(prof(id), { size: 'xs' }), h('span', { text: first(prof(id)) || 'Someone' })))) : null,
    h('p', { class: 'note', text: 'They write and see contracts and payments of Hardware projects only, and no salaries. For the head of hardware.' }),
    h('h2', { class: 'gapt' }, 'Who sees salaries', isWsOwner() ? h('button', { class: 'lnk sm', style: { marginInlineStart: 'auto' }, 'data-salary-people': '1', onclick: e => pickSalaryPeople(e.currentTarget) }, 'Change') : null),
    h('div', { class: 'pjpeople' }, [S.ws.owner_id, ...(S.ws.salary_viewers || [])].filter(Boolean).map(id => h('span', { class: 'pjperson' }, avatar(prof(id), { size: 'xs' }), h('span', { text: first(prof(id)) || 'Someone' }), id === S.ws.owner_id ? h('span', { class: 'sm mute', text: 'owner' }) : null))),
    h('p', { class: 'note', text: 'Only the team’s monthly total, never per person. The others above see contracts and payments, and profit before the team.' }));
}
function pickHwMoneyPeople(anchor) {
  const all = S.ws.money_viewers || [];
  picker(anchor, { options: S.members.map(m => m.user_id).filter(id => id !== S.ws.owner_id && !all.includes(id)).map(id => ({ v: id, label: dname(prof(id)) })).sort((a, b) => a.label.localeCompare(b.label)), multi: true, value: S.ws.money_hw_viewers || [], placeholder: 'Who sees hardware money?',
    onPick: async v => { const list = [...(v || [])]; const { error } = await sb.from('workspaces').update({ money_hw_viewers: list }).eq('id', S.ws.id); if (error) return toast(errText(error)); S.ws.money_hw_viewers = list; toast('Saved'); refresh(); } });
}
function pickSalaryPeople(anchor) {
  const can = (S.ws.money_viewers || []);
  if (!can.length) return toast('First add them to “Who sees money”');
  picker(anchor, { options: can.map(id => ({ v: id, label: dname(prof(id)) })).sort((a, b) => a.label.localeCompare(b.label)), multi: true, value: (S.ws.salary_viewers || []).filter(id => can.includes(id)), placeholder: 'Who else sees salaries?',
    onPick: async v => { const list = [...(v || [])]; const { error } = await sb.from('workspaces').update({ salary_viewers: list }).eq('id', S.ws.id); if (error) return toast(errText(error)); S.ws.salary_viewers = list; toast('Saved'); refresh(); } });
}
function pickMoneyPeople(anchor) {
  picker(anchor, { options: S.members.filter(m => m.user_id !== S.ws.owner_id).map(m => ({ v: m.user_id, label: dname(prof(m.user_id)) })).sort((a, b) => a.label.localeCompare(b.label)), multi: true, value: S.ws.money_viewers || [], placeholder: 'Who else sees money?',
    onPick: async v => { const list = [...(v || [])]; const sal = (S.ws.salary_viewers || []).filter(id => list.includes(id)); // off money means off salaries too
      const { error } = await sb.from('workspaces').update({ money_viewers: list, salary_viewers: sal }).eq('id', S.ws.id); if (error) return toast(errText(error)); S.ws.money_viewers = list; S.ws.salary_viewers = sal; toast('Saved'); refresh(); } });
}
function moneyForm(title, fields, onSave, onDelete) {
  openSheet({ title, kind: 'center', build: sh => {
    const els = fields.map(f => { const el = f.type === 'choice' ? h('div', { class: 'chips' }) : h('input', { type: f.type || 'text', id: f.id, value: f.value ?? '', placeholder: f.ph || '', inputmode: f.type === 'number' ? 'decimal' : null, style: { width: '100%' } });
      if (f.type === 'choice') { let val = f.value; const draw = () => el.replaceChildren(...f.options.map(([k, l]) => h('button', { class: 'chipbtn', 'aria-pressed': String(k === val), onclick: () => { val = k; draw(); } }, l))); draw(); el.val = () => val; } else if (f.type === 'number') el.type = 'text'; else if (f.type === 'tel') { el.type = 'text'; el.inputMode = 'tel'; el.dir = 'ltr'; }
      return [f, el]; });
    const go_ = h('button', { class: 'btn pri' }, 'Save');
    go_.addEventListener('click', async () => {
      const vals = {}; for (const [f, el] of els) { let v = f.type === 'choice' ? el.val() : el.value.trim(); if (f.type === 'number') { v = v.replace(/[,\s]/g, ''); if (v !== '' && isNaN(Number(v))) { el.focus(); return toast(`${f.label}: numbers only`); } v = v === '' ? null : Number(v); } if (f.required && (v == null || v === '')) { el.focus(); return toast(`Add ${f.label.toLowerCase()}`); } if (f.positive && v != null && v <= 0) { el.focus(); return toast(`${f.label}: more than 0`); } vals[f.key] = v; }
      go_.disabled = true; if (await onSave(vals)) closeSheet(true); else go_.disabled = false;
    });
    sh.append(h('div', { class: 'sbody' }, els.map(([f, el]) => h(f.type === 'choice' ? 'div' : 'label', { class: 'field' }, f.label, el))),
      h('div', { class: 'sfoot' }, onDelete ? h('button', { class: 'btn ghost danger', onclick: async () => { if (await onDelete()) closeSheet(true); } }, 'Delete') : null, h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), go_));
    setTimeout(() => els[0]?.[1].focus?.(), 80);
  } });
}
function editContract(p) {
  const c = moneyOf(p.id).contract || {};
  moneyForm('Contract', [{ key: 'value', id: 'mValue', label: 'Contract value', type: 'number', value: c.value, ph: 'e.g. 500000', required: true, positive: true }, { key: 'start', id: 'mStart', label: 'Starts', type: 'date', value: c.start }, { key: 'end', id: 'mEnd', label: 'Ends', type: 'date', value: c.end }, { key: 'note', id: 'mNote', label: 'Note', value: c.note, ph: 'e.g. 3 apps + dashboard + hardware' }],
    v => { const changed = ['value', 'start', 'end'].some(k => (v[k] ?? null) !== (c[k] ?? null)); const nc = Object.assign({}, c, v); if (changed && nc.signed_at) { delete nc.signed_at; delete nc.signed_by; }
      return saveMoney(p.id, { contract: nc }, changed && c.signed_at ? 'Contract saved. It needs signing again' : 'Contract saved'); });
}
function editPayment(p, y) {
  const m = moneyOf(p.id);
  moneyForm(y ? 'Payment' : 'New payment', [{ key: 'amount', id: 'mAmt', label: 'Amount', type: 'number', value: y?.amount, required: true, positive: true }, { key: 'label', id: 'mLabel', label: 'What for', value: y?.label, ph: 'e.g. Down payment, Phase 2' }, { key: 'due', id: 'mDue', label: 'Due', type: 'date', value: y?.due },
    { key: 'paid', label: 'Paid?', type: 'choice', value: y?.paid_at ? 'yes' : 'no', options: [['no', 'Not yet'], ['yes', 'Paid']] }],
    v => { const row = { id: y?.id || uuid(), amount: v.amount, label: v.label, due: v.due || null, paid_at: v.paid === 'yes' ? (y?.paid_at || nowIso()) : null };
      return saveMoney(p.id, { payments: y ? m.payments.map(z => z.id === y.id ? row : z) : [...(m.payments || []), row] }, 'Payment saved'); },
    y ? () => saveMoney(p.id, { payments: m.payments.filter(z => z.id !== y.id) }, 'Payment removed') : null);
}
function editCost(p, y) {
  const m = moneyOf(p.id);
  moneyForm(y ? 'Cost' : 'New cost', [{ key: 'label', id: 'mCLabel', label: 'What', value: y?.label, ph: 'e.g. Server, Google Play, hardware', required: true }, { key: 'amount', id: 'mCAmt', label: 'Amount', type: 'number', value: y?.amount, required: true, positive: true },
    { key: 'every', label: 'How often', type: 'choice', value: y?.every || 'month', options: [['month', 'Every month'], ['once', 'One time']] }],
    v => { const row = Object.assign({ id: y?.id || uuid() }, v); return saveMoney(p.id, { costs: y ? m.costs.map(z => z.id === y.id ? row : z) : [...(m.costs || []), row] }, 'Cost saved'); },
    y ? () => saveMoney(p.id, { costs: m.costs.filter(z => z.id !== y.id) }, 'Cost removed') : null);
}
function editShare(p) {
  const m = moneyOf(p.id); const sug = suggestedShare(p.id);
  const hw = pDept(p) === 'hardware';
  moneyForm('The team on this project', [{ key: 'team', id: 'mTeam', label: hw ? 'All hardware salaries together, per month (the hardware team)' : 'All software salaries together, per month (the software team)', type: 'number', value: salOf(p), ph: 'e.g. 250000', positive: true },
    { key: 'share', id: 'mShare', label: `Share of the team’s time on ${p.name}, in %${sug != null ? ` (about ${sug}% of tasks done lately)` : ''}`, type: 'number', value: m.share ?? sug, ph: 'e.g. 20' }],
    async v => {
      if (v.share != null && (v.share < 0 || v.share > 100)) { toast('Share is between 0 and 100'); return false; }
      if (v.team !== (salOf(p) ?? null)) { const row = { workspace_id: S.ws.id, team_monthly: hw ? M.salary : v.team, hw_monthly: hw ? v.team : M.hwSalary, updated_by: uid(), updated_at: nowIso() };
        const { error } = await sb.from('team_salaries').upsert(row); if (error) { toast(errText(error)); return false; } if (hw) M.hwSalary = v.team; else M.salary = v.team; }
      return saveMoney(p.id, { share: v.share }, 'Saved');
    });
}
/* the money line on the projects list, for those who see money */
function moneyTotals() {
  if (!canSeeSomeMoney() || M.loaded !== S.ws?.id) return null;
  let value = 0, received = 0, late = 0; for (const p of S.projects.filter(canSeeProjMoney)) { const x = moneyMath(p.id); value += x.value; received += x.received; late += x.late.length; }
  if (!value) return null;
  return h('div', { class: 'pjnums' }, h('div', { class: 'pjnum' }, h('b', { text: fmtMoney(value) }), h('span', { text: 'in contracts' })), h('div', { class: 'pjnum' }, h('b', { text: fmtMoney(received) }), h('span', { text: 'received' })),
    h('div', { class: 'pjnum' }, h('b', { text: fmtMoney(value - received) }), h('span', { text: 'still to come' })), h('div', { class: 'pjnum' + (late ? ' bad' : '') }, h('b', { text: String(late) }), h('span', { text: late === 1 ? 'late payment' : 'late payments' })));
}

