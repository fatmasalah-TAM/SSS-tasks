/* ═════════════ Agents: each department gets the jobs it repeats, drafted by AI ═════════════
   An agent only drafts. It reads what this person can already see (never prices for sales, money only for the
   people picked for money), and the person checks the draft and decides: copy it, open it as a task, add it as a
   checklist or make sub-tasks. Nothing is saved until they press the app's own button. */
const AGENT_JOBS = {
  standup: { label: 'My stand-up', hint: 'Yesterday, today and what blocks you, from your tasks', facts: () => ({ me: first(me()), tasks: myRecent() }), out: 'copy' },
  split: { label: 'Split a task', hint: 'Into sub-tasks of a day or less', pick: 'task', facts: x => ({ task: taskFacts(x) }), out: 'subtasks' },
  sentback: { label: 'Why it came back', hint: 'The reviewer’s reasons and what to check before sending it again', pick: 'back', facts: async x => ({ task: taskFacts(x), comments: await taskComments(x) }), out: 'copy' },
  apiplan: { label: 'API plan', hint: 'Endpoints, database changes, permissions and edge cases', pick: 'task', facts: x => ({ task: taskFacts(x) }), out: 'copy' },
  screens: { label: 'Screens and states', hint: 'Every screen with its empty, loading, error, phone and Arabic states', pick: 'task', facts: x => ({ task: taskFacts(x) }), out: 'checklist' },
  deploynotes: { label: 'Deploy notes', hint: 'From what was finished this week', pick: 'project', facts: x => ({ project: x.name, finished: doneThisWeek(x.id) }), out: 'copy' },
  deploycheck: { label: 'Deploy checklist', hint: 'Backups, migrations, smoke tests, rollback', pick: 'project', facts: x => ({ project: x.name, going_out: readyToShip(x.id) }), out: 'copy' },
  incident: { label: 'Report an outage', hint: 'What’s down and who is affected, written up as a task', input: 'e.g. Gate QR at Mivida not opening since 9am, server shows timeouts', type: 'bug', facts: () => ({}), out: 'task' },
  testcases: { label: 'Test cases for a feature', hint: 'From the feature’s requirements and acceptance criteria', pick: 'task', type: 'testcase', facts: x => ({ task: taskFacts(x) }), out: 'task' },
  signoff: { label: 'Release sign-off', hint: 'What was tested, what passed, what is still open', pick: 'project', facts: x => ({ project: x.name, finished: doneThisWeek(x.id), open_bugs: pTasks(x.id).filter(t => isBug(t) && !isClosed(t)).map(taskFacts) }), out: 'copy' },
  uxcopy: { label: 'Interface text', hint: 'English and Arabic, two options each', input: 'e.g. Button and message when a guest QR has expired', facts: () => ({}), out: 'copy' },
  experiment: { label: 'Experiment summary', hint: 'What was tried, the numbers and the next step', input: 'Paste your results or notes', facts: () => ({}), out: 'copy' },
  brd: { label: 'BRD from a request', hint: 'Goal, requirements, acceptance criteria, scope', input: 'Paste the client’s request or your notes', type: 'brd', facts: () => ({}), out: 'task' },
  weekplan: { label: 'Weekly plan for the CEO', hint: 'Done, planned per person, risks', facts: () => weekFacts(), out: 'copy' },
  releasenotes: { label: 'Release notes for clients', hint: 'English and Arabic: new, improved, fixed', pick: 'project', facts: x => ({ project: x.name, finished: doneThisWeek(x.id, 30) }), out: 'copy' },
  ceobrief: { label: 'What needs me', hint: 'Contracts waiting for your signature and what is late', show: () => canSeeMoney(), facts: () => moneyFacts(), out: 'copy' },
  hwbrief: { label: 'Hardware this week', hint: 'Money in, late payments, contracts to add, late work', show: () => canSeeSomeMoney(), facts: () => moneyFacts('hardware'), out: 'copy' },
  pnl: { label: 'Monthly money note', hint: 'What came in, what is late, margins, risks', show: () => canSeeSomeMoney(), facts: () => moneyFacts(), out: 'copy' },
  collections: { label: 'Payment reminders', hint: 'A polite message for each late payment', show: () => canSeeSomeMoney(), facts: () => ({ money: { late: lateMoney() } }), out: 'messages' },
  changelog: { label: 'Firmware changelog', hint: 'What changed, what was fixed, which devices', input: 'Paste your commit list or notes', facts: () => ({}), out: 'copy' },
  fieldbug: { label: 'Fault from a device log', hint: 'Steps, expected, actual, site and firmware', input: 'Paste the log or describe what the device did', type: 'bug', facts: () => ({}), out: 'task' },
  servicereport: { label: 'Service report', hint: 'For the client to sign: what was done, tests, materials', input: 'e.g. Mivida gate 2: replaced QR reader SN 4471, tested 20 scans OK, used 10 m cable', facts: () => ({}), out: 'copy' },
  surveynotes: { label: 'Site survey from notes', hint: 'Gates, power and network, devices', input: 'Type or paste what you saw on site', type: 'survey', facts: () => ({}), out: 'task' },
  complaint: { label: 'Bug from a complaint', hint: 'A clear bug the developers can follow', input: 'Paste the client’s message', type: 'bug', facts: () => ({}), out: 'task' },
  reply: { label: 'Reply to a client', hint: 'English and Arabic', input: 'Paste the client’s message and what you know', facts: () => ({}), out: 'copy' },
  followups: { label: 'Today’s follow-ups', hint: 'A WhatsApp message for each deal that needs one', show: () => (S.deals || []).some(dealLate), facts: () => ({ deals: (S.deals || []).filter(dealLate).map(dealFacts) }), out: 'messages' },
  callnote: { label: 'After a call', hint: 'Next step, when, and a follow-up message', pick: 'deal', input: 'What happened in the call or meeting?', facts: x => ({ deal: dealFacts(x) }), out: 'copy' },
  proposal: { label: 'Technical proposal', hint: 'From the deal, the site survey and the demo', pick: 'deal', type: 'proposal', facts: x => ({ deal: dealFacts(x) }), out: 'task' },
  demoplan: { label: 'Demo plan', hint: 'What to show and who should attend', pick: 'deal', type: 'demo', facts: x => ({ deal: dealFacts(x) }), out: 'task' },
  renewal: { label: 'Message to a client', hint: 'Renewal, update or check-in', input: 'Who and what about?', facts: () => ({}), out: 'copy' },
  social: { label: 'Social posts', hint: 'Three posts, English and Arabic', input: 'What is it about? e.g. new guest QR feature', facts: () => ({}), out: 'copy' },
  casestudy: { label: 'Case study', hint: 'From a finished project', pick: 'project', facts: x => ({ project: x.name, kind: pDept(x), about: x.about || '', finished: doneThisWeek(x.id, 365).slice(0, 40) }), out: 'copy' },
  purchase: { label: 'Purchase request', hint: 'Items, quantities, project, when and why', input: 'e.g. 8 QR readers and 200 m cable for Mivida by Dec 1', facts: () => ({ projects: S.projects.map(p => p.name) }), out: 'copy' },
  jobpost: { label: 'Job post', hint: 'About the job, what you’ll do, what we need', input: 'Which role? Anything special?', facts: () => ({ company: S.ws.name }), out: 'copy' },
  onboarding: { label: 'Onboarding checklist', hint: 'First two weeks for a new person', input: 'Which role or department?', facts: () => ({}), out: 'copy' },
};
const AGENTS = {
  backend: ['apiplan', 'sentback', 'standup', 'split', 'deploynotes'], frontend: ['screens', 'sentback', 'standup', 'split'],
  mobile: ['screens', 'sentback', 'standup', 'split', 'releasenotes'], devops: ['deploycheck', 'incident', 'deploynotes', 'standup'],
  data: ['experiment', 'standup', 'split'], design: ['uxcopy', 'screens', 'split'], qa: ['testcases', 'signoff', 'complaint'],
  product: ['brd', 'weekplan', 'releasenotes', 'ceobrief'], pm: ['weekplan', 'brd', 'releasenotes'], management: ['ceobrief', 'pnl', 'weekplan'],
  hwlead: ['hwbrief', 'changelog', 'fieldbug'], hardware: ['fieldbug', 'changelog', 'split'], embedded: ['changelog', 'fieldbug', 'split'],
  field: ['servicereport', 'surveynotes', 'fieldbug'], support: ['complaint', 'reply', 'fieldbug'],
  sales: ['followups', 'callnote'], presales: ['proposal', 'demoplan', 'surveynotes'], success: ['renewal', 'reply', 'complaint'],
  marketing: ['social', 'casestudy'], finance: ['collections', 'pnl', 'purchase'], operations: ['purchase'], hr: ['jobpost', 'onboarding'],
};
/* ── what an agent may read: only what this person can already see ── */
const taskFacts = t => ({ key: taskKey(t), title: t.title, type: tyOf(t.type_id)?.name || '', status: stOf(t.status_id)?.name || '', description: String(t.description || '').slice(0, 3000),
  checklist: (t.checklist || []).map(c => c.text), due: t.due_date || null, developer: t.assignee_id ? first(prof(t.assignee_id)) : null, project: pjOf(t.project_id)?.name || null });
async function taskComments(t) { try { const { data } = await sb.from('comments').select('body,author_id,created_at').eq('task_id', t.id).order('created_at', { ascending: false }).limit(8); return (data || []).map(c => ({ by: first(prof(c.author_id)), text: String(c.body || '').slice(0, 600) })); } catch (e) { return []; } }
const myRecent = () => { const day = Date.now() - 36 * 3600e3; return S.tasks.filter(t => t.assignee_id === uid() && (!isClosed(t) || (t.completed_at && new Date(t.completed_at) > day))).slice(0, 40)
  .map(t => Object.assign(taskFacts(t), { description: undefined, whose_turn: t.turn_owner === uid() ? 'mine' : t.turn_owner ? first(prof(t.turn_owner)) : null, stopped: t.stopped?.text || null, done_recently: !!t.completed_at })); };
const doneThisWeek = (pid, days = 7) => { const since = Date.now() - days * 864e5; return S.tasks.filter(t => (!pid || t.project_id === pid) && t.completed_at && new Date(t.completed_at) > since).map(t => ({ key: taskKey(t), title: t.title, type: tyOf(t.type_id)?.name || '' })); };
const readyToShip = pid => S.tasks.filter(t => t.project_id === pid && ['review', 'done'].includes(catOf(t)) && (!t.completed_at || new Date(t.completed_at) > Date.now() - 7 * 864e5)).map(t => ({ key: taskKey(t), title: t.title }));
const dealFacts = d => ({ name: d.name, wants: kindName(d.kind), stage: stageName(d.stage), contact: [d.contact?.name, d.contact?.role].filter(Boolean).join(', '), next_step: d.next_step || null, next_date: d.next_date || null, notes: d.notes || null,
  presales: dealTasks(d.id).map(t => ({ type: tyOf(t.type_id)?.name || '', title: t.title, status: stOf(t.status_id)?.name || '', notes: String(t.description || '').slice(0, 2500) })) });
function weekFacts() {
  const open = S.tasks.filter(t => !isClosed(t)); const today = todayIso();
  return { done_last_week: doneThisWeek(null), planned: S.members.map(m => ({ person: first(prof(m.user_id)), tasks: open.filter(t => t.assignee_id === m.user_id && ['started', 'unstarted'].includes(catOf(t))).slice(0, 8).map(t => t.title) })).filter(x => x.tasks.length),
    late: open.filter(t => t.due_date && t.due_date < today).map(t => ({ key: taskKey(t), title: t.title, developer: first(prof(t.assignee_id)) || null })), projects: S.projects.map(p => p.name) };
}
const lateMoney = () => S.projects.filter(canSeeProjMoney).flatMap(p => (moneyOf(p.id).payments || []).filter(y => !y.paid_at && y.due && y.due < todayIso()).map(y => ({ project: p.name, amount: fmtMoney(Number(y.amount)), what: y.label || 'Payment', due: y.due })));
function moneyFacts(side) {
  const ps = S.projects.filter(p => canSeeProjMoney(p) && (!side || pDept(p) === side));
  return { money: { projects: ps.map(p => { const x = moneyMath(p.id); return { name: p.name, side: pDept(p), contract: x.value ? fmtMoney(x.value) : 'not added yet', received: fmtMoney(x.received), still_to_come: fmtMoney(x.outstanding), late_payments: x.late.length, signed: !!signedOf(p) }; }),
    late: lateMoney() }, late_work: ps.map(p => ({ project: p.name, late_tasks: pTasks(p.id).filter(t => !isClosed(t) && t.due_date && t.due_date < todayIso()).length })) };
}
/* ── the card on the person's home page ── */
const deptShort = d => d.k === 'design' && !wsDeptCfg()?.names?.design ? 'Design' : d.l.split(' /')[0];
let agentDeptPick = null; /* which of the person's departments the agent card shows (the main one by default) */
const agentDept = () => { const ds = myDepts().filter(d => (AGENTS[d.base || d.k] || []).length); return ds.find(d => d.k === agentDeptPick) || ds[0] || null; };
const agentJobs = () => (AGENTS[agentDept()?.base || agentDept()?.k] || []).map(k => [k, AGENT_JOBS[k]]).filter(([, j]) => j && (!j.show || j.show()));
const agentHome = () => { const d = myDept(); const hm = d && deptHome(d); return ['home', 'deals', 'company'].includes(hm) ? hm : 'myturn'; };
function agentCard() {
  const d = myDept(); if (!d || S.route.v !== agentHome()) return null;
  const jobs = agentJobs(); if (!jobs.length) return null;
  const on = aiKnown();
  if (!on && !isAdmin()) return null; /* a member can't turn AI on, so the card waits until an admin does */
  const ad = agentDept() || d; const others = myDepts().filter(x => (AGENTS[x.base || x.k] || []).length);
  return h('section', { class: 'tsec agentsec', 'data-agent': ad.k },
    h('h3', {}, h('span', { class: 'tellspark', 'aria-hidden': 'true', text: '✦' }), ` Your ${deptShort(ad)} agent`),
    others.length > 1 ? h('div', { class: 'chips agentdepts', role: 'tablist' }, others.map(x => h('button', { class: 'chipbtn', role: 'tab', 'data-agent-dept': x.k, 'aria-pressed': String(x.k === ad.k), onclick: () => { agentDeptPick = x.k; render(); } }, deptShort(x)))) : null,
    h('div', { class: 'agentjobs' }, jobs.map(([k, j]) => h('button', { class: 'agentjob', 'data-job': k, onclick: () => on ? runAgent(k) : toast(isAdmin() ? 'Turn on AI in Settings → AI first' : 'Ask an admin to turn on AI in Settings → AI') },
      h('b', { text: j.label }), h('span', { text: j.hint })))),
    on ? h('p', { class: 'note', text: 'It writes a draft from what you can already see. Nothing is saved until you check it and press the button.' })
      : h('p', { class: 'note' }, 'The agent needs AI. ', isAdmin() ? h('button', { class: 'lnk', onclick: () => openSettings('workspace', 'ai') }, 'Turn on AI') : 'Ask an admin to turn it on in Settings → AI.'));
}
/* pick → notes → draft → the person decides */
function agentPickList(kind) {
  if (kind === 'deal') return (S.deals || []).filter(x => OPEN_STAGES.includes(x.stage) || x.stage === 'won').map(x => [x, x.name, `${stageName(x.stage)} · ${kindName(x.kind)}`]);
  if (kind === 'project') return S.projects.map(p => [p, p.name, pDept(p) === 'hardware' ? 'Hardware' : 'Software']);
  const mine = t => t.assignee_id === uid() || turnIsMine(t);
  const list = kind === 'back' ? S.tasks.filter(t => !isClosed(t) && (t.sendbacks || 0) > 0 && mine(t)) : S.tasks.filter(t => !isClosed(t)).sort((a, b) => mine(b) - mine(a));
  return list.slice(0, 60).map(t => [t, `${taskKey(t)} · ${t.title}`, stOf(t.status_id)?.name || '']);
}
function runAgent(k) {
  const j = AGENT_JOBS[k]; let picked = null;
  openSheet({ title: j.label, kind: 'center', key: 'agent', build: sh => {
    const body = h('div', { class: 'sbody agentsheet', 'data-agent-job': k });
    const foot = h('div', { class: 'sfoot' });
    const notes = j.input ? autoGrow(h('textarea', { id: 'agentNotes', rows: '3', dir: 'auto', placeholder: j.input, style: { width: '100%' } })) : null;
    const list = j.pick ? agentPickList(j.pick) : [];
    const pickBox = j.pick ? h('div', { class: 'agentpick' }, list.length ? list.map(([x, l, sub]) => h('button', { class: 'agentopt notr', 'data-opt': x.id, 'aria-pressed': 'false', onclick: e => { picked = x; $$('.agentopt', sh).forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } }, h('b', { text: l }), h('span', { text: sub })))
      : h('div', { class: 'colempty', text: j.pick === 'back' ? 'Nothing of yours was sent back.' : j.pick === 'deal' ? 'No deals yet.' : j.pick === 'project' ? 'No projects yet.' : 'No open tasks.' })) : null;
    const write = h('button', { class: 'btn pri', 'data-agent-go': '1' }, '✦ Write it');
    write.addEventListener('click', async () => {
      if (j.pick && !picked) return toast(j.pick === 'deal' ? 'Pick a deal' : j.pick === 'project' ? 'Pick a project' : 'Pick a task');
      const text = notes ? notes.value.trim() : ''; if (j.input && !j.pick && !text) { notes.focus(); return toast('Write a few words first (any language)'); }
      const done = busy(write, 'Writing…'); track('agent_' + k);
      const ty = j.type ? typeByKey(j.type) : null;
      const facts = await j.facts(picked);
      const res = await withTimeout(sb.functions.invoke('agents', { body: { ws: S.ws.id, skill: k, facts, text, sections: ty?.template || [] } }), 70000).catch(() => ({ timedOut: true })); done();
      if (res.timedOut) return toast('The AI took too long. Try again.');
      const dr = res.data?.draft; if (res.error || !dr) return toast(res.data?.error || 'AI didn’t answer. Try again.');
      showDraft(k, dr, picked, body, foot);
    });
    body.append(h('p', { class: 'note', text: j.hint }), pickBox, notes);
    foot.append(h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), write);
    sh.append(body, foot);
  } });
}
function showDraft(k, dr, picked, body, foot) {
  const j = AGENT_JOBS[k]; const ty = j.type ? typeByKey(j.type) : null;
  const again = h('button', { class: 'btn ghost', onclick: () => { closeSheet(true); runAgent(k); } }, 'Start over');
  const close = () => closeSheet(true);
  let main; const acts = [];
  if (dr.kind === 'text') {
    const ta = autoGrow(h('textarea', { class: 'agentdraft', dir: 'auto', rows: '8', value: dr.text, style: { width: '100%' } }));
    main = ta; acts.push(h('button', { class: 'btn pri', 'data-agent-copy': '1', onclick: () => { copyText(ta.value, 'Copied. Paste it where you need it'); } }, icon('copy', 15), 'Copy'));
  } else if (dr.kind === 'messages') {
    main = h('div', { class: 'agentmsgs' }, dr.messages.map(m => { const ta = autoGrow(h('textarea', { class: 'agentdraft', dir: 'auto', rows: '4', value: m.text, style: { width: '100%' } }));
      return h('div', { class: 'agentmsg' }, h('b', { class: 'notr', text: m.to || 'Message' }), ta, h('div', { class: 'briefacts' },
        h('button', { class: 'btn sm', 'data-agent-copy': '1', onclick: () => copyText(ta.value, 'Copied') }, icon('copy', 14), 'Copy'),
        h('a', { class: 'btn sm', href: 'https://wa.me/?text=' + encodeURIComponent(m.text), target: '_blank', rel: 'noopener', onclick: e => { e.currentTarget.href = 'https://wa.me/?text=' + encodeURIComponent(ta.value); } }, icon('whatsapp', 14), 'WhatsApp'))); }));
    if (!dr.messages.length) main = h('div', { class: 'colempty', text: 'Nothing needs a message right now.' });
  } else if (dr.kind === 'items') {
    const boxes = dr.items.map(x => { const c = h('input', { type: 'checkbox', checked: true }); return [c, x, h('label', { class: 'agentitem' }, c, h('span', { dir: 'auto', text: x }))]; });
    main = h('div', { class: 'agentitems' }, boxes.map(b => b[2]));
    const chosen = () => boxes.filter(b => b[0].checked).map(b => b[1]);
    if (j.out === 'checklist' && picked) acts.push(h('button', { class: 'btn pri', 'data-agent-apply': '1', onclick: async () => { const add = chosen(); if (!add.length) return toast('Tick at least one');
      await patchTask(picked.id, { checklist: [...(picked.checklist || []), ...add.map(text => ({ id: uuid(), text, done: false }))] }, { toast: `Added ${plural(add.length, 'item')} to ${taskKey(picked)}` }); close(); } }, `Add to ${taskKey(picked)}’s checklist`));
    if (j.out === 'subtasks' && picked) acts.push(h('button', { class: 'btn pri', 'data-agent-apply': '1', onclick: async e => { const add = chosen(); if (!add.length) return toast('Tick at least one'); const d0 = busy(e.currentTarget, 'Making…');
      for (const title of add) await createTask({ title, parent_id: picked.id, project_id: picked.project_id || null, type_id: picked.type_id, assignee_id: picked.assignee_id || null }); d0(); toast(`${plural(add.length, 'sub-task')} made under ${taskKey(picked)}`); close(); } }, 'Make the sub-tasks'));
    acts.push(h('button', { class: 'btn' + (acts.length ? '' : ' pri'), 'data-agent-copy': '1', onclick: () => copyText(chosen().map(x => '• ' + x).join('\n'), 'Copied') }, icon('copy', 15), 'Copy'));
  } else {
    const secs = Object.entries(dr.sections || {}).filter(([, v]) => String(v).trim());
    main = h('div', { class: 'agenttask' }, h('b', { dir: 'auto', class: 'notr', text: dr.title || j.label }), secs.map(([n, v]) => h('div', { class: 'briefsec' }, h('b', { text: n }), h('p', { class: 'brieftext notr', dir: 'auto', text: v }))));
    acts.push(h('button', { class: 'btn pri', 'data-agent-apply': '1', onclick: () => { close();
      const tmpl = ty?.template || []; const known = Object.fromEntries(secs.filter(([n]) => tmpl.includes(n))); const extra = secs.filter(([n]) => !tmpl.includes(n)).map(([n, v]) => `## ${n}\n${v}`).join('\n\n');
      openCreate({ typeKey: ty ? ty.key : undefined, type: ty?.is_bug ? 'bug' : undefined, showDetails: true, prefill: { title: dr.title || j.label, secs: known, description: extra || undefined },
        extra: j.pick === 'deal' && picked ? { deal_id: picked.id } : undefined, preset: { project_id: j.pick === 'project' && picked ? picked.id : (picked?.project_id || null) } }); } }, 'Open as a task'));
  }
  body.replaceChildren(h('p', { class: 'note', text: 'Check it and change anything. Nothing is saved until you press the button.' }), main);
  foot.replaceChildren(again, h('span', { class: 'sp' }), ...acts);
}

