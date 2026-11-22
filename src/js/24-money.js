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
  if ([a, b, c].some(x => x.error && isNetErr(x.error))) { // offline: the copy on this phone, or nothing rather than wrong zeros
    if (M.cached !== ws) { M.rows = {}; M.settings = { workspace_id: ws, currency: 'EGP' }; M.salary = null; M.hwSalary = null; if (!M.warned) { M.warned = true; toast('Money shows here after you open Ovrto once with internet'); } }
    M.loaded = ws; return;
  }
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
  const total = Number(c.total) || value; // what the client pays, VAT included; VAT is not the company's money, so profit uses value
  return { value, total, received, outstanding: total - received, late, costs, monthly, months, before: value - costs, team, net: team == null ? null : value - costs - team, share: m.share };
}
/* how much of the team's finished work went to this project lately: a starting point for the share */
function suggestedShare(pid) {
  const byTime = timeShare(pid); if (byTime != null) return byTime; // logged hours first, finished tasks otherwise
  const since = Date.now() - 90 * 864e5; const done = S.tasks.filter(t => t.completed_at && new Date(t.completed_at) > since);
  if (!done.length) return null; return Math.round(100 * done.filter(t => t.project_id === pid).length / done.length);
}
async function saveMoney(pid, patch, msg) {
  const row = Object.assign({}, moneyOf(pid), patch, { workspace_id: S.ws.id, project_id: pid, updated_by: uid(), updated_at: nowIso() });
  const { error, queued } = await write({ t: 'project_money', op: 'upsert', row, plain: true }); if (error) { toast(errText(error)); return false; }
  M.rows[pid] = row; M.cached = S.ws.id; snapshot(); if (msg) toast(queued ? msg + ' · saved on this phone' : msg); refresh(); return true;
}
function projectMoney(p) {
  if (M.loaded !== S.ws.id) { loadMoney().then(() => refresh()); return [h('p', { class: 'note', text: 'Loading…' })]; }
  const m = moneyOf(p.id); const x = moneyMath(p.id); const c = m.contract || {};
  const stat = (n, l, cls) => h('div', { class: 'pjnum' + (cls ? ' ' + cls : '') }, h('b', { text: n }), h('span', { text: l }));
  const sec = (title, action, body) => h('section', {}, h('h2', {}, title, action ? h('button', { class: 'lnk sm', style: { marginInlineStart: 'auto' }, onclick: action[1] }, action[0]) : null), body);
  const ed = canEditProjMoney(p); const act = a => ed ? a : null;
  if (!x.value && !(m.payments || []).length && !(m.costs || []).length) return [
    ed ? emptyState('NO NUMBERS YET', 'Add the contract to see what this project brings in, what it costs and what is left. Only you and the people you pick see this.', { label: '✦ Read the contract with AI', fn: () => readContract(p) }, { label: 'Type it in', fn: () => editContract(p) })
      : emptyState('NO NUMBERS YET', `${namesOf(contractWriters(pDept(p)))} adds the contract and payments. They show up here.`)];
  const out = [
    h('div', { class: 'pjnums' }, stat(fmtMoney(x.value), 'contract'), stat(fmtMoney(x.received), 'received'), stat(fmtMoney(x.outstanding), x.late.length ? `still to come · ${x.late.length} late` : 'still to come', x.late.length ? 'bad' : ''),
      stat(fmtMoney(x.net != null ? x.net : x.before), x.net != null ? 'profit after the team' : 'profit before the team', (x.net != null ? x.net : x.before) < 0 ? 'bad' : 'good')),
    sec('Contract', act(['Edit', () => editContract(p)]), h('div', { class: 'pjlist' }, ...contractFiles(p), ...contractFacts(p), ed ? h('button', { class: 'pjrow lnk-row', onclick: () => readContract(p) }, icon('upload', 14), h('span', { class: 'grow', text: (c.files || []).length ? '✦ Read another contract or addendum with AI' : '✦ Upload the contract: AI reads the price and payments' })) : null, h('div', { class: 'pjrow' }, h('span', { class: 'grow' }, h('b', { text: fmtMoney(x.value) }),
      h('span', { class: 'sm mute', text: [c.start ? 'from ' + fmtDate(c.start) : null, c.end ? 'to ' + fmtDate(c.end) : null, c.note || null].filter(Boolean).join(' · ') || 'No dates yet' }),
      ...contractMoneyLines(p, ed),
      x.value ? h('span', { class: 'sm ' + (c.signed_at ? 'mute' : 'pjalert'), 'data-sign-line': '1', text: signLine(p) }) : null),
      x.value && !c.signed_at && canSign() && (!(S.ws.money_viewers || []).length || (S.ws.money_viewers || []).includes(uid())) ? h('button', { class: 'btn sm pri', 'data-sign': '1', onclick: () => signContract(p) }, icon('check', 14), 'Signed') : null))),
    sec('Payments', act(['+ Payment', () => editPayment(p)]), (m.payments || []).length ? h('div', { class: 'pjlist' }, (m.payments || []).slice().sort((a, b) => (a.due || '').localeCompare(b.due || '')).map(y => {
      const late = !y.paid_at && y.due && y.due < todayIso();
      return h('div', { class: 'pjrow' }, h('span', { class: 'grow' }, h('b', { text: `${fmtMoney(Number(y.amount))} · ${y.label || 'Payment'}` }),
        h('span', { class: 'sm ' + (late ? 'pjalert' : 'mute'), text: y.paid_at ? `Paid ${fmtDate(y.paid_at.slice(0, 10))}` : y.due ? (late ? `Not paid · late, was due ${fmtDate(y.due)}` : `Not paid yet · due ${fmtDate(y.due)}`) : 'Not paid yet · no due date' })),
        h('button', { class: 'btn sm ghost', 'data-invoice': y.id, onclick: () => printInvoice(p, y) }, 'Invoice'), !ed ? null : y.paid_at ? h('button', { class: 'btn sm ghost', onclick: () => editPayment(p, y) }, 'Edit') : h('button', { class: 'btn sm', 'data-mark-paid': '1', 'aria-label': `Mark ${y.label || 'this payment'} as paid`, onclick: async () => {
          const before = m.payments; if (!(await saveMoney(p.id, { payments: m.payments.map(z => z.id === y.id ? Object.assign({}, z, { paid_at: nowIso() }) : z) }))) return;
          toast(`Marked as paid: ${fmtMoney(Number(y.amount))}`, { label: 'Undo', fn: () => saveMoney(p.id, { payments: before }, 'Back to not paid') }, 8000);
        } }, icon('check', 14), 'Mark as paid'));
    })) : h('p', { class: 'note', text: 'Add the payments in the contract and mark each one when it arrives.' })),
    sec('Costs', act(['+ Cost', () => editCost(p)]), (m.costs || []).length ? h('div', { class: 'pjlist' }, m.costs.map(y => h(ed ? 'button' : 'div', { class: 'pjrow', onclick: ed ? () => editCost(p, y) : null }, h('span', { class: 'grow' }, h('b', { text: `${fmtMoney(Number(y.amount))}${y.every === 'month' ? ' a month' : ''} · ${y.label}` }),
      h('span', { class: 'sm mute', text: y.every === 'month' ? `${fmtMoney(Number(y.amount) * x.months)} so far (${x.months.toFixed(1)} months)` : 'One time' })))))
      : h('p', { class: 'note', text: 'Servers, licences, hardware: anything this project costs besides the team.' })),
    canSeeSalaries() ? sec('The team', canEditSalaries() ? ['Edit', () => editShare(p)] : null, h('div', { class: 'pjlist' }, h('div', { class: 'pjrow' }, h('span', { class: 'grow' },
      h('b', { text: x.team != null ? `${fmtMoney(x.team)} so far` : 'Not set yet' }),
      ...teamWhyZero(p, x, m),
      h('span', { class: 'sm mute', text: salOf(p) ? (m.share != null ? `${m.share}% of the team’s time × ${fmtMoney(Number(salOf(p)))} a month × ${x.months.toFixed(1)} months` : `Set what share of the team’s time this project takes${suggestedShare(p.id) != null ? ` (about ${suggestedShare(p.id)}${timeShare(p.id) != null ? '% of logged hours lately' : '% of tasks done lately'})` : ''}`) : 'Set the team’s total monthly salaries first' }))))) : null,
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
  moneyForm('Contract', [{ key: 'value', id: 'mValue', label: 'Contract value', type: 'number', value: c.value, ph: 'e.g. 500000', required: true, positive: true }, { key: 'start', id: 'mStart', label: 'Starts', type: 'date', value: c.start }, { key: 'end', id: 'mEnd', label: 'Ends', type: 'date', value: c.end }, { key: 'expires', id: 'mExp', label: 'Expires', type: 'date', value: c.expires }, { key: 'note', id: 'mNote', label: 'Note', value: c.note, ph: 'e.g. 3 apps + dashboard + hardware' }],
    v => { const changed = ['value', 'start', 'end'].some(k => (v[k] ?? null) !== (c[k] ?? null)); const nc = Object.assign({}, c, v); if (changed && nc.signed_at) { delete nc.signed_at; delete nc.signed_by; }
      return saveMoney(p.id, { contract: nc }, changed && c.signed_at ? 'Contract saved. It needs signing again' : 'Contract saved'); },
    c.value || (c.files || []).length ? () => deleteContract(p) : null);
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
    { key: 'share', id: 'mShare', label: `Share of the team’s time on ${p.name}, in %${sug ? ` (about ${sug}${timeShare(p.id) != null ? '% of logged hours lately' : '% of tasks done lately'})` : ''}`, type: 'number', value: m.share || (sug || null), ph: 'e.g. 20' }],
    async v => {
      if (v.share != null && (v.share < 0 || v.share > 100)) { toast('Share is between 0 and 100'); return false; }
      if (!v.share) { $('#mShare')?.focus(); toast('Write how much of the team’s time this project takes, e.g. 20'); return false; }
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


/* ── the contract file: kept privately (only money people open it); AI reads the price, dates and payments as a draft ── */
function contractFiles(p) {
  return ((moneyOf(p.id).contract || {}).files || []).map(fl => h('div', { class: 'pjrow' }, h('button', { class: 'grow cd-file', onclick: async () => {
    const { data, error } = await sb.storage.from('contracts').createSignedUrl(fl.path, 600); if (error || !data?.signedUrl) return toast(errText(error || 'Couldn’t open the file'));
    window.open(data.signedUrl, '_blank', 'noopener');
  } }, icon('export', 14), h('span', { class: 'grow' }, h('b', { dir: 'auto', text: fl.name }), h('span', { class: 'sm mute', text: `Contract file · ${fmtDate((fl.at || '').slice(0, 10))}` }))),
    canEditProjMoney(p) ? h('button', { class: 'x', 'aria-label': `Remove ${fl.name}`, title: 'Remove the file', onclick: e => confirmIn(e.currentTarget.closest('.pjlist'), { text: `Remove the file ${fl.name}? The contract numbers stay.`, yes: 'Remove', danger: true,
      onYes: async () => { const c = moneyOf(p.id).contract || {}; if (await saveMoney(p.id, { contract: Object.assign({}, c, { files: (c.files || []).filter(x => x.path !== fl.path) }) }, 'File removed')) sb.storage.from('contracts').remove([fl.path]).catch(() => {}); } }) }, icon('x', 14)) : null));
}
function readContract(p) {
  if (!canEditProjMoney(p)) return toast('Only the people who write this project’s money can do this');
  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const typeOf = f => /\.docx$/i.test(f.name) ? DOCX : /\.pdf$/i.test(f.name) ? 'application/pdf' : f.type; // some phones send Word files with no type
  const pick = h('input', { type: 'file', accept: `application/pdf,.pdf,${DOCX},.docx,image/jpeg,image/png,image/webp`, multiple: true, hidden: true });
  pick.addEventListener('change', async () => {
    const files = [...pick.files].slice(0, 6); pick.remove(); if (!files.length) return;
    if (files.some(f => /\.doc$/i.test(f.name))) return toast('This is an old Word file (.doc). Save it as .docx or PDF, then upload it');
    if (files.some(f => !/^(application\/pdf|image\/(jpeg|png|webp))$/.test(typeOf(f)) && typeOf(f) !== DOCX)) return toast('Use a PDF, a Word file (.docx) or photos (JPG, PNG) of the contract');
    if (files.reduce((n, f) => n + f.size, 0) > 18 * 1024 * 1024) return toast('The contract is too big. Keep it under 18 MB');
    if (!(await aiReady())) return toast('Turn on AI in Settings → AI first, or type the contract in');
    const hold = toast(files.length === 1 ? 'Uploading the contract…' : `Uploading ${files.length} pages…`, null, 60000);
    const saved = [];
    for (const f of files) {
      const path = `${p.id}/${uuid()}-${f.name.replace(/[^\w.\-]+/g, '_').slice(-80)}`;
      const { error } = await sb.storage.from('contracts').upload(path, f, { contentType: typeOf(f) });
      if (error) { hold.remove(); return toast(`Couldn’t upload ${f.name}: ${errText(error)}`); }
      saved.push({ path, name: f.name, type: typeOf(f), size: f.size, at: nowIso() });
    }
    hold.querySelector('span') ? hold.querySelector('span').textContent = 'AI is reading the contract…' : null;
    const { data, error } = await sb.functions.invoke('contract-read', { body: { pid: p.id, paths: saved.map(x => x.path) } });
    hold.remove(); track('contract_read_ai');
    if (error || !data || data.error || !data.draft) {
      toast(data?.error || errText(error) || 'AI didn’t answer. Try again.');
      return saveMoney(p.id, { contract: Object.assign({}, moneyOf(p.id).contract, { files: [...((moneyOf(p.id).contract || {}).files || []), ...saved] }) }, 'Contract file kept. Type the numbers in');
    }
    contractDraftSheet(p, data.draft, saved);
  });
  document.body.append(pick); pick.click();
}
function contractDraftSheet(p, d, files) {
  const m = moneyOf(p.id); const c = m.contract || {};
  openSheet({ title: 'Check what AI read', kind: 'center', key: 'contractdraft', build: sh => {
    const inp = (type, value, ph, label) => h('input', { type, value: value ?? '', placeholder: ph || '', 'aria-label': label, inputmode: type === 'text' && /amount|value/i.test(label) ? 'decimal' : null, style: { width: '100%' } });
    const val = inp('text', d.value != null ? String(d.value) : '', 'e.g. 500000', 'Contract value');
    const start = inp('date', d.start, '', 'Starts'); const end = inp('date', d.end, '', 'Ends');
    const note = inp('text', d.note, 'e.g. 3 apps + dashboard + hardware', 'Note');
    const signedOn = inp('date', d.signed_on, '', 'Contract date'); const expires = inp('date', d.expires, '', 'Expires'); const warranty = inp('date', d.warranty_until, '', 'Warranty until');
    const terms = (d.terms || []).map(x => Object.assign({ on: true }, x));
    const termEls = terms.map((t, i) => { const cb = h('input', { type: 'checkbox', checked: true, 'aria-label': `Keep ${t.label}` });
      const row = h('label', { class: 'cd-term' }, cb, h('span', {}, h('b', { dir: 'auto', text: t.label + ': ' }), h('span', { dir: 'auto', text: [t.value, t.date ? fmtDate(t.date) : ''].filter(Boolean).join(' · ') })));
      cb.addEventListener('change', () => { t.on = cb.checked; row.classList.toggle('off', !t.on); }); return row; });
    const rows = (d.payments || []).map(x => Object.assign({ on: true }, x));
    // currency and exchange rate: amounts stay as written; Ovrto keeps them in the workspace currency at the rate below
    const ccy = h('input', { type: 'text', value: (d.currency || cur()).toUpperCase(), maxlength: '3', 'aria-label': 'Contract currency', style: { width: '100%', textTransform: 'uppercase' } });
    const rate = h('input', { type: 'text', inputmode: 'decimal', value: '', 'aria-label': 'Exchange rate', style: { width: '100%' } });
    const rateSrc = h('span', { class: 'sm mute' }); let fx = { rate: 1, at: nowIso(), source: '' };
    const rateBox = h('div', { class: 'cd-fx' }, h('label', { class: 'field' }, h('span', { class: 'cd-ratel' }), rate), rateSrc,
      d.pay_currency || d.fx_rule ? h('p', { class: 'note', text: `The contract says it is paid in ${d.pay_currency || cur()}${d.fx_rule ? ' at: ' + d.fx_rule : ''}. Use that rate if you have it.` }) : null);
    const getRate = async () => {
      const from = ccy.value.trim().toUpperCase(); rateBox.hidden = !/^[A-Z]{3}$/.test(from) || from === cur();
      $('.cd-ratel', rateBox).textContent = `1 ${from} = ? ${cur()}`;
      if (rateBox.hidden) { fx = { rate: 1, at: nowIso(), source: '' }; drawSum(); return; }
      rateSrc.textContent = 'Getting today’s rate…';
      const { data, error } = await sb.functions.invoke('fx-rate', { body: { base: from, quote: cur() } });
      if (error || !data || data.error) { rateSrc.textContent = data?.error || 'Couldn’t get today’s rate. Type the rate yourself.'; return; }
      fx = { rate: data.rate, at: data.at, source: data.source }; rate.value = String(data.rate);
      rateSrc.textContent = `Today’s rate from ${data.source} (${fmtDateY(String(data.at).slice(0, 10))}). You can change it, e.g. to the bank rate.`; drawSum();
    };
    ccy.addEventListener('change', getRate);
    rate.addEventListener('input', () => { const r = Number(rate.value.replace(/[,\s]/g, '')); if (r > 0) fx = { rate: r, at: nowIso(), source: 'typed in' }; rateSrc.textContent = ''; drawSum(); });
    // VAT: Egypt's standard rate is 14%; if the contract doesn't include it, Ovrto adds it to what the client pays
    let vatMode = d.vat === 'included' ? 'in' : d.vat === 'none' ? 'none' : 'add';
    const vatRate = h('input', { type: 'text', inputmode: 'decimal', value: String(d.vat_rate || 14), 'aria-label': 'VAT %', style: { width: '5em' } });
    const vatChips = h('div', { class: 'chips' });
    const drawVat = () => { vatChips.replaceChildren(...[['add', d.vat === 'not_stated' ? 'Not in the contract: add VAT' : 'Not in the prices: add VAT'], ['in', 'Already in the prices'], ['none', 'No VAT']].map(([k, l]) =>
      h('button', { type: 'button', class: 'chipbtn', 'aria-pressed': String(vatMode === k), onclick: () => { vatMode = k; drawVat(); drawSum(); } }, l))); vatRate.disabled = vatMode === 'none'; };
    vatRate.addEventListener('input', () => drawSum());
    const calc = h('p', { class: 'cd-calc' });
    const money = (n, c) => (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + c;
    const sum = h('p', { class: 'sm mute cd-sum' });
    const vatPct = () => vatMode === 'none' ? 0 : Math.max(0, Number(vatRate.value.replace(/[,\s%]/g, '')) || 0);
    const parts_ = () => { const v = Number(String(val.value).replace(/[,\s]/g, '')) || 0; const r = vatPct() / 100;
      const ex = vatMode === 'in' ? v / (1 + r) : v; const tot = vatMode === 'add' ? v * (1 + r) : v; return { v, ex, vat: tot - ex, tot }; };
    const drawSum = () => {
      const c3 = ccy.value.trim().toUpperCase() || cur(); const tot = rows.filter(r => r.on).reduce((n, r) => n + (Number(r.amount) || 0), 0); const v = Number(String(val.value).replace(/[,\s]/g, '')) || 0;
      sum.textContent = rows.length ? `Payments add up to ${money(tot, c3)}${v && Math.abs(tot - v) > 1 ? ` · the contract says ${money(v, c3)}` : ''}` : ''; sum.classList.toggle('pjalert', !!(rows.length && v && Math.abs(tot - v) > 1));
      if (!calc.isConnected && !calc.parentNode) return;
      const x = parts_(); const conv = c3 !== cur() && fx.rate > 0;
      calc.replaceChildren(h('span', { text: `Before VAT ${money(x.ex, c3)}` }), h('span', { text: `VAT ${vatPct()}% ${money(x.vat, c3)}` }),
        h('b', { text: `The client pays ${money(x.tot, c3)}` }), conv ? h('b', { text: `≈ ${money(x.tot * fx.rate, cur())} today` }) : null);
    };
    val.addEventListener('input', drawSum);
    const payEls = rows.map((r, i) => {
      const amt = inp('text', String(r.amount), '', `Payment ${i + 1} amount`); const lab = inp('text', r.label + (r.when && !r.label.toLowerCase().includes(r.when.toLowerCase()) ? ` (${r.when})` : ''), 'e.g. Down payment', `Payment ${i + 1} what for`); const due = inp('date', r.due, '', `Payment ${i + 1} due`);
      const cb = h('input', { type: 'checkbox', checked: true, 'aria-label': `Add payment ${i + 1}` });
      const row = h('div', { class: 'cd-pay' }, h('label', { class: 'cd-on' }, cb), h('div', { class: 'cd-f' }, lab, h('div', { class: 'cd-two' }, amt, due)));
      cb.addEventListener('change', () => { r.on = cb.checked; row.classList.toggle('off', !r.on); drawSum(); });
      amt.addEventListener('input', () => { r.amount = Number(amt.value.replace(/[,\s]/g, '')) || 0; drawSum(); });
      r.read = () => ({ amount: Number(amt.value.replace(/[,\s]/g, '')), label: lab.value.trim(), due: due.value || null });
      return row;
    });
    drawVat(); drawSum(); getRate();
    const curNote = null;
    const go_ = h('button', { class: 'btn pri' }, 'Save');
    go_.addEventListener('click', async () => {
      const v = Number(String(val.value).replace(/[,\s]/g, ''));
      if (!(v > 0)) { val.focus(); return toast('Contract value: write the total price'); }
      const c3 = ccy.value.trim().toUpperCase() || cur(); if (!/^[A-Z]{3}$/.test(c3)) { ccy.focus(); return toast('Currency: 3 letters, like USD or EGP'); }
      const fxr = c3 === cur() ? 1 : fx.rate; if (!(fxr > 0)) { rate.focus(); return toast('Type the exchange rate first'); }
      const x = parts_(); const r2 = n => Math.round(n * 100) / 100; const payFactor = vatMode === 'add' ? 1 + vatPct() / 100 : 1;
      const pays = rows.filter(r => r.on).map(r => r.read()).map(y => Object.assign(y, { amount_orig: r2(y.amount * payFactor), amount: r2(y.amount * payFactor * fxr) }));
      if (pays.some(x => !(x.amount > 0))) return toast('Each payment needs an amount above 0');
      const nv = r2(x.ex * fxr);
      const changed = nv !== (c.value ?? null) || (start.value || null) !== (c.start ?? null) || (end.value || null) !== (c.end ?? null);
      const nc = Object.assign({}, c, { value: nv, total: r2(x.tot * fxr), currency: c3, value_orig: r2(x.ex), total_orig: r2(x.tot), vat_mode: vatMode, vat_rate: vatPct(),
        fx: c3 === cur() ? null : { rate: fxr, at: fx.at, source: fx.source, rule: d.fx_rule || '', paid_in: d.pay_currency || cur() }, start: start.value || null, end: end.value || null, note: note.value.trim() || c.note || '', files: [...(c.files || []), ...files],
        signed_on: signedOn.value || c.signed_on || null, expires: expires.value || c.expires || null, warranty_until: warranty.value || c.warranty_until || null,
        terms: terms.some(t => t.on) ? terms.filter(t => t.on).map(({ label, value, date }) => ({ label, value, date: date || null })) : (c.terms || []) });
      if (changed && nc.signed_at) { delete nc.signed_at; delete nc.signed_by; }
      go_.disabled = true;
      const ok = await saveMoney(p.id, { contract: nc, payments: [...(m.payments || []), ...pays.map(y => Object.assign({ id: uuid(), amount: y.amount, label: y.label, due: y.due, paid_at: null }, c3 !== cur() ? { amount_orig: y.amount_orig, currency: c3 } : {}))] },
        pays.length ? `Contract saved with ${pays.length} payment${pays.length === 1 ? '' : 's'}` : 'Contract saved');
      if (ok) closeSheet(true); else go_.disabled = false;
    });
    sh.append(h('div', { class: 'sbody cd' },
      h('p', { class: 'ai-note', text: '✦ AI read the contract. Check every number before you save; nothing is saved until you press Save.' }),
      d.check ? h('p', { class: 'note pjalert', text: d.check }) : null, curNote,
      h('div', { class: 'cd-two' }, h('label', { class: 'field' }, 'Contract value', val), h('label', { class: 'field' }, 'Currency', ccy)), rateBox,
      h('div', { class: 'field' }, 'VAT', h('div', { class: 'cd-vat' }, vatChips, h('label', { class: 'cd-vr' }, vatRate, '%'))), calc,
      h('div', { class: 'cd-two' }, h('label', { class: 'field' }, 'Starts', start), h('label', { class: 'field' }, 'Ends', end)),
      h('label', { class: 'field' }, 'Note', note),
      h('div', { class: 'cd-three' }, h('label', { class: 'field' }, 'Contract date', signedOn), h('label', { class: 'field' }, 'Expires', expires), h('label', { class: 'field' }, 'Warranty until', warranty)),
      terms.length ? h('h4', { text: 'Other important terms' }) : null, ...termEls,
      h('h4', { text: rows.length ? 'Payments in the contract' : 'No payments found in the contract' }),
      (m.payments || []).length && rows.length ? h('p', { class: 'note', text: `This project already has ${m.payments.length} payment${m.payments.length === 1 ? '' : 's'}. The ticked ones are added to them.` }) : null,
      ...payEls, sum),
      h('div', { class: 'sfoot' }, h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), go_));
  } });
}

/* the dates and terms a manager must not miss; an expiry within 60 days (or past) is called out */
const fmtDateY = d => new Date(d + 'T00:00:00').toLocaleDateString(UI_LOC, { day: 'numeric', month: 'short', year: 'numeric' });
function contractFacts(p) {
  const c = moneyOf(p.id).contract || {}; const out = [];
  const dates = [['Contract date', c.signed_on], ['Expires', c.expires], ['Warranty until', c.warranty_until]].filter(x => x[1]);
  if (dates.length) {
    const days = c.expires ? Math.round((new Date(c.expires) - new Date(todayIso())) / 864e5) : null;
    const warn = days == null ? null : days < 0 ? `Expired ${fmtDateY(c.expires)}` : days <= 60 ? `Expires in ${days} day${days === 1 ? '' : 's'}` : null;
    out.push(h('div', { class: 'pjrow' }, h('span', { class: 'grow' }, h('span', { class: 'sm cd-dates' }, ...dates.map(([l, d]) => h('span', {}, h('span', { class: 'mute', text: l + ' ' }), h('b', { text: fmtDateY(d) })))),
      warn ? h('span', { class: 'sm pjalert', text: warn }) : null)));
  }
  if ((c.terms || []).length) out.push(h('details', { class: 'pjrow cd-terms' }, h('summary', { class: 'sm', text: `Key terms (${c.terms.length})` }),
    ...c.terms.map(t => h('p', { class: 'sm' }, h('b', { dir: 'auto', text: t.label + ': ' }), h('span', { dir: 'auto', text: [t.value, t.date ? fmtDate(t.date) : ''].filter(Boolean).join(' · ') })))));
  return out;
}

/* VAT and currency on the contract: what the client pays, and today's value in the workspace currency */
function contractMoneyLines(p, ed) {
  const c = moneyOf(p.id).contract || {}; const out = [];
  if (c.vat_rate > 0 && c.total) out.push(h('span', { class: 'sm mute', text: `Before VAT · the client pays ${fmtMoney(c.total)} with ${c.vat_rate}% VAT` }));
  if (c.currency && c.currency !== cur() && c.fx?.rate) {
    out.push(h('span', { class: 'sm cd-fxline' }, h('span', { text: `${(c.total_orig || c.value_orig || 0).toLocaleString('en-US')} ${c.currency} · 1 ${c.currency} = ${c.fx.rate} ${cur()} (${fmtDateY(String(c.fx.at || '').slice(0, 10))})` }),
      ed ? h('button', { class: 'lnk sm', onclick: () => refreshFx(p) }, 'Update rate') : null));
    if (c.fx.rule) out.push(h('span', { class: 'sm mute', text: `Contract rate: ${c.fx.rule}` }));
  }
  return out;
}
async function refreshFx(p) {
  const m = moneyOf(p.id); const c = m.contract || {}; if (!c.currency || c.currency === cur()) return;
  const hold = toast('Getting today’s rate…');
  const { data, error } = await sb.functions.invoke('fx-rate', { body: { base: c.currency, quote: cur() } }); hold.remove();
  if (error || !data || data.error) return toast(data?.error || 'Couldn’t get today’s rate');
  const r = data.rate; const r2 = n => Math.round(n * 100) / 100;
  const nc = Object.assign({}, c, { value: r2((c.value_orig || 0) * r), total: r2((c.total_orig || c.value_orig || 0) * r), fx: Object.assign({}, c.fx, { rate: r, at: data.at, source: data.source }) });
  const pays = (m.payments || []).map(y => !y.paid_at && y.amount_orig && y.currency === c.currency ? Object.assign({}, y, { amount: r2(y.amount_orig * r) }) : y); // paid ones keep what really arrived
  await saveMoney(p.id, { contract: nc, payments: pays }, `Rate updated: 1 ${c.currency} = ${r} ${cur()}`);
}

/* delete the contract: its numbers, dates, terms and files; the payments too only if asked */
function deleteContract(p) {
  return new Promise(res => {
    const m = moneyOf(p.id); const c = m.contract || {}; const n = (m.payments || []).length;
    const body = $('.sbody', currentSheet()) || document.body;
    const done = async withPays => {
      box.remove();
      const ok = await saveMoney(p.id, { contract: {}, payments: withPays ? [] : (m.payments || []) }, withPays ? 'Contract and its payments deleted' : 'Contract deleted');
      if (ok && (c.files || []).length) sb.storage.from('contracts').remove(c.files.map(x => x.path)).catch(() => {});
      res(ok);
    };
    const box = h('div', { class: 'info cd-del', role: 'alertdialog', 'aria-label': 'Delete the contract?' },
      h('b', { text: 'Delete the contract?' }),
      h('span', { class: 'sm', text: n ? `Its price, dates, terms and file go. This project also has ${n} payment${n === 1 ? '' : 's'}.` : 'Its price, dates, terms and file go.' }),
      h('div', { class: 'cd-del-b' },
        n ? h('button', { class: 'btn sm danger', onclick: () => done(true) }, `Delete it and the ${n} payment${n === 1 ? '' : 's'}`) : null,
        h('button', { class: 'btn sm' + (n ? '' : ' danger'), onclick: () => done(false) }, n ? 'Delete the contract only' : 'Delete'),
        h('button', { class: 'btn sm ghost', onclick: () => { box.remove(); res(false); } }, 'Cancel')));
    body.prepend(box); box.scrollIntoView({ block: 'nearest' });
  });
}

/* the team cost is share × monthly salaries × months since the contract started: say which one is missing */
function teamWhyZero(p, x, m) {
  if (!salOf(p) || x.team == null || x.team > 0) return [];
  const c = m.contract || {}; const why = [];
  if (!m.share) why.push(h('span', { class: 'sm pjalert', text: 'The share of the team’s time is 0%. Edit it: how much of the team works on this project?' }));
  if (!c.start) why.push(h('span', { class: 'sm pjalert' }, 'No start date on the contract, so no months are counted yet. ', canEditProjMoney(p) ? h('button', { class: 'lnk sm', onclick: () => editContract(p) }, 'Add the start date') : null));
  else if (c.start > todayIso()) why.push(h('span', { class: 'sm mute', text: `The work starts ${fmtDate(c.start)}; the team cost counts from then.` }));
  return why;
}
