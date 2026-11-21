/* ═════════════ Company: the CEO's page ═════════════
   One look at the business: money in and still to come, payments that are late, every project's money and progress,
   and who in the team has room. Only the workspace owner and the people they pick for money see it.
   Salaries appear only as the team's monthly total, never per person. */
const HW_DEPTS = ['hardware', 'embedded', 'field', 'support', 'hwlead'];
/* All / Software / Hardware: the hardware head always sees Hardware */
const coSplit = () => canSeeMoney() ? store.get('coSplit.' + S.ws.id, 'all') : 'hardware';
function companyData(split = coSplit()) {
  const today = todayIso(); const month = today.slice(0, 7); const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const week = Date.now() - 7 * 864e5;
  const d = { value: 0, received: 0, monthIn: 0, profit: 0, teamSet: true, late: [], lateAmt: 0, coming: [], projects: [] };
  for (const p of S.projects.filter(p => canSeeProjMoney(p) && (split === 'all' || pDept(p) === split))) {
    const x = moneyMath(p.id); const m = moneyOf(p.id);
    d.value += x.value; d.received += x.received;
    if (x.value) { d.profit += x.net != null ? x.net : x.before; if (x.net == null) d.teamSet = false; }
    for (const y of m.payments || []) {
      const amt = Number(y.amount) || 0;
      if (y.paid_at && y.paid_at.slice(0, 7) === month) d.monthIn += amt;
      if (!y.paid_at && y.due) { if (y.due < today) { d.late.push({ p, y }); d.lateAmt += amt; } else if (y.due <= in30) d.coming.push({ p, y }); }
    }
    const ts = pTasks(p.id); const open = ts.filter(t => !isClosed(t));
    d.projects.push({ p, x, open: open.length, bugs: open.filter(isBug).length, done: ts.filter(t => t.completed_at && new Date(t.completed_at) > week).length,
      lateTasks: open.filter(t => t.due_date && t.due_date < today).length });
  }
  d.late.sort((a, b) => a.y.due.localeCompare(b.y.due)); d.coming.sort((a, b) => a.y.due.localeCompare(b.y.due));
  d.projects.sort((a, b) => (b.x.value - a.x.value) || (b.open - a.open) || a.p.name.localeCompare(b.p.name));
  let people = []; try { people = reportData('this').people; } catch (e) { people = []; }
  if (split === 'hardware') { const hw = new Set(S.members.filter(m => HW_DEPTS.includes(baseKey(m.department))).map(m => m.user_id)); people = people.filter(x => hw.has(x.id)); }
  d.people = people;
  return d;
}
function viewCompany() {
  if (!canSeeSomeMoney()) return [h('div', { class: 'scroll' }, pageHead('Company'), emptyState('OWNER ONLY', 'This page shows the business’s money. Only the workspace owner and the people they pick see it.', { label: 'Back to My turn', fn: () => go({ v: 'myturn' }) }))];
  if (M.loaded !== S.ws.id) { loadMoney().then(() => refresh()); return [h('div', { class: 'scroll' }, pageHead('Company'), h('p', { class: 'note', style: { padding: '20px var(--gr) 0 var(--gl)' }, text: 'Loading…' }))]; }
  const d = companyData();
  const viewers = [S.ws.owner_id, ...(S.ws.money_viewers || [])].filter(Boolean).length;
  const stat = (n, label, cls, sel) => h('button', { class: 'tstat' + (cls ? ' ' + cls : ''), onclick: sel ? () => $(sel)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : null }, h('b', { text: n }), h('span', { text: label }));
  const monthName = new Date().toLocaleDateString(UI_LOC, { month: 'long' });
  const hero = h('header', { class: 'thero' }, h('div', { class: 'hrow' },
    h('div', { style: { minWidth: '0', flex: '1' } }, h('h1', { class: 'ptitle', text: canSeeMoney() ? S.ws.name : 'Hardware' }),
      h('div', { class: 'thsub', text: !canSeeMoney() ? 'Hardware projects · money and work' : viewers > 1 ? `The business at a glance · ${viewers} people see this` : 'The business at a glance · only you see this' }),
      canSeeMoney() && S.projects.some(p => pDept(p) === 'hardware') ? h('div', { class: 'seg cosplit', role: 'group', 'data-cosplit': coSplit() }, [['all', 'All'], ['software', 'Software'], ['hardware', 'Hardware']].map(([v, l]) => h('button', { 'aria-pressed': String(coSplit() === v), onclick: () => { store.set('coSplit.' + S.ws.id, v); render(); } }, l))) : null),
    isPhone() ? h('button', { class: 'x', 'data-gsearch': '1', 'aria-label': 'Search', title: 'Search', onclick: () => cmdk.open() }, icon('search', 22)) : null,
    isPhone() ? bellButton() : null));
  const stats = h('div', { class: 'tstats co4' },
    stat(fmtMoney(d.monthIn), `received in ${monthName}`, '', '.co-money'),
    stat(fmtMoney(d.value - d.received), 'still to come', '', '.co-coming'),
    stat(d.late.length ? fmtMoney(d.lateAmt) : '0', d.late.length === 1 ? '1 late payment' : `${d.late.length} late payments`, d.late.length ? 'late' : '', '.co-late'),
    stat(fmtMoney(d.profit), d.teamSet ? 'profit after the team' : 'profit before the team', d.profit < 0 ? 'late' : '', '.co-projects'));
  const sec = (title, cls, body, count) => h('section', { class: 'tsec ' + cls }, h('h3', {}, title, count ? h('span', { class: 'ct', text: String(count) }) : null), body);
  const payRow = ({ p, y }, late) => h('div', { class: 'row tc' + (late ? ' lateish' : '') },
    h('span', { class: 'tile' + (late ? ' bad' : ' st-started'), 'aria-hidden': 'true', html: ST_TILE.clock }),
    h('button', { class: 'tt lvopen', onclick: () => go({ v: 'project', id: p.id, tab: 'money' }) },
      h('b', {}, h('span', { text: fmtMoney(Number(y.amount)) }), ' · ', h('span', { class: 'notr', text: y.label || 'Payment' })),
      h('span', {}, h('span', { class: 'notr', text: p.name }), ' · ', h('span', { class: late ? 'over' : '', text: (late ? 'was due ' : 'due ') + fmtDate(y.due) }))),
    !canEditProjMoney(p) ? null : h('button', { class: 'btn sm' + (late ? ' pri' : ''), 'data-mark-paid': '1', onclick: () => { const m = moneyOf(p.id); saveMoney(p.id, { payments: m.payments.map(z => z.id === y.id ? Object.assign({}, z, { paid_at: nowIso() }) : z) }, 'Marked as paid'); } }, 'Paid'));
  /* contracts: the won deals' projects still without numbers (for whoever writes them), and the ones waiting to be signed */
  const inSplit = p => coSplit() === 'all' || pDept(p) === coSplit();
  const wonIds = new Set((S.deals || []).filter(x => x.stage === 'won').flatMap(x => x.project_ids || []));
  const toFill = S.projects.filter(p => wonIds.has(p.id) && inSplit(p) && canEditProjMoney(p) && !moneyMath(p.id).value && contractWriters(pDept(p)).includes(uid()));
  const toSign = S.projects.filter(p => canSeeProjMoney(p) && inSplit(p) && moneyMath(p.id).value && !signedOf(p));
  const iSign = canSign() && (!(S.ws.money_viewers || []).length || (S.ws.money_viewers || []).includes(uid()));
  const conRow = (p, btn) => h('div', { class: 'row tc', 'data-con': p.id }, h('span', { class: 'tile st-review', 'aria-hidden': 'true' }, icon('folder', 18)),
    h('button', { class: 'tt lvopen', onclick: () => go({ v: 'project', id: p.id, tab: 'money' }) }, h('b', { class: 'notr', text: p.name }),
      h('span', { text: btn === 'fill' ? `Won ${(() => { const dl = (S.deals || []).find(x => (x.project_ids || []).includes(p.id)); return dl?.won_at ? fmtDate(dl.won_at.slice(0, 10)) : ''; })()} · ${pDept(p) === 'hardware' ? 'Hardware' : 'Software'} · add the contract` : btn === 'sign' ? `${fmtMoney(moneyMath(p.id).value)} · ${pDept(p) === 'hardware' ? 'Hardware' : 'Software'}` : `${fmtMoney(moneyMath(p.id).value)} · ${signLine(p)}` })),
    btn === 'fill' ? h('button', { class: 'btn sm pri', 'data-fill': '1', onclick: () => editContract(p) }, 'Add') : btn === 'sign' ? h('button', { class: 'btn sm pri', 'data-sign': '1', onclick: () => signContract(p) }, icon('check', 14), 'Signed') : null);
  const nothing = !d.value && !d.projects.some(r => (moneyOf(r.p.id).payments || []).length);
  const projCard = r => { const { p, x } = r; const pct = x.value ? Math.min(100, Math.round(100 * x.received / x.value)) : 0; const pr = x.value ? (x.net != null ? x.net : x.before) : null;
    return h('button', { class: 'cocard', 'data-id': p.id, onclick: () => go({ v: 'project', id: p.id, tab: x.value ? 'money' : 'overview' }) },
      h('div', { class: 'cohead' }, h('span', { class: 'tile', style: { background: `color-mix(in srgb, ${p.color || 'var(--accent)'} 18%, var(--surface))`, color: `color-mix(in srgb, ${p.color || 'var(--accent)'} 75%, var(--fg))` }, 'aria-hidden': 'true' }, icon('folder', 18)),
        h('span', { class: 'cot' }, h('b', { class: 'notr', text: p.name }), h('span', { text: pKind(p) === 'client' ? 'Client project' : 'Our own project' })),
        pr != null ? h('span', { class: 'coprofit' + (pr < 0 ? ' bad' : ''), title: x.net != null ? 'Profit after the team' : 'Profit before the team' }, h('b', { text: fmtMoney(pr) }), h('span', { text: x.net != null ? 'profit' : 'before team' })) : h('span', { class: 'coprofit none', text: 'No contract yet' })),
      x.value ? h('div', { class: 'cobar', role: 'img', 'aria-label': `${pct}% received` }, h('i', { style: { width: pct + '%' } })) : null,
      x.value ? h('div', { class: 'coline' }, h('span', { text: `${fmtMoney(x.received)} of ${fmtMoney(x.value)} received` }), x.late.length ? h('span', { class: 'over', text: x.late.length === 1 ? '1 late payment' : `${x.late.length} late payments` }) : null) : null,
      h('div', { class: 'coline mute' }, h('span', { text: [plural(r.open, 'task') + ' left', plural(r.bugs, 'open bug'), `${r.done} done this week`].join(' · ') }), r.lateTasks ? h('span', { class: 'over', text: `${r.lateTasks} late` }) : null)); };
  const capGroups = [['free', 'Can take new tasks'], ['some', 'Room for 1–2 small tasks'], ['full', 'Full this week']];
  const team = h('div', { class: 'cocard static' },
    canSeeSalaries() && coSplit() !== 'hardware' ? h('div', { class: 'coline' }, h('span', { text: 'Software salaries together' }), h('b', { text: M.salary ? fmtMoney(Number(M.salary)) + ' a month' : 'Not set yet' })) : null,
    canSeeSalaries() && coSplit() !== 'software' ? h('div', { class: 'coline' }, h('span', { text: 'Hardware salaries together' }), h('b', { text: M.hwSalary ? fmtMoney(Number(M.hwSalary)) + ' a month' : 'Not set yet' })) : null,
    ...capGroups.map(([k, l]) => { const ps = d.people.filter(x => x.cap[0] === k); return !ps.length ? null : h('div', { class: 'cocap' }, h('span', { class: 'rp-cap ' + k, text: `${l} (${ps.length})` }), h('span', { class: 'notr names', text: ps.length ? ps.map(x => first(prof(x.id)) || x.name).join(', ') : '—' })); }),
    h('p', { class: 'note', text: canSeeSalaries() ? 'Salaries are never shown per person. Room is based on each person’s open and late tasks.' : 'Room is based on each person’s open and late tasks.' }));
  return [h('div', { class: 'scroll turnpage cosite' }, hero, stats,
    agentCard(),
    toSign.length && iSign ? sec('Waiting for your signature', 'co-sign', h('div', { class: 'tlist' }, toSign.map(p => conRow(p, 'sign'))), toSign.length) : null,
    toFill.length ? sec('Contracts to add', 'co-fill', h('div', { class: 'tlist' }, toFill.map(p => conRow(p, 'fill'))), toFill.length) : null,
    !iSign && toSign.some(canEditProjMoney) ? sec('Waiting for the signature', 'co-sign', h('div', { class: 'tlist' }, toSign.filter(canEditProjMoney).map(p => conRow(p, null))), toSign.filter(canEditProjMoney).length) : null,
    canSeeMoney() ? sec('This week', 'co-brief', briefCard()) : null,
    nothing ? h('div', { class: 'tsec' }, h('div', { class: 'info', role: 'note', style: { marginTop: '16px' } }, h('span', { text: 'No money yet. Open a project, go to its Money tab and add the contract and payments. They show up here.' }))) : null,
    d.late.length ? sec('Late payments', 'co-late', h('div', { class: 'tlist' }, d.late.map(z => payRow(z, true))), d.late.length) : null,
    sec('Coming in the next 30 days', 'co-coming', d.coming.length ? h('div', { class: 'tlist' }, d.coming.map(z => payRow(z, false))) : h('div', { class: 'colempty', text: 'No payments due in the next 30 days.' }), d.coming.length),
    sec('Projects', 'co-projects co-money', d.projects.length ? h('div', { class: 'tlist' }, d.projects.map(projCard)) : h('div', { class: 'colempty', text: 'No projects yet.' }), d.projects.length),
    sec('The team', 'co-team', team))];
}

