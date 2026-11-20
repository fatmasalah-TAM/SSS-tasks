/* ═════════════ A home page for each job ═════════════
   Testing (QA), My code (developers) and My product (Product / PM). Same tasks and the same buttons as everywhere
   else in Ovrto, picked and ordered for the job, with the job's most used "new" buttons on top. My turn stays. */
const HOME_OF = { qa: 'testing', backend: 'code', frontend: 'code', mobile: 'code', devops: 'code', embedded: 'code', data: 'code', product: 'product', pm: 'product', presales: 'presales' };
const HOME_NAME = { testing: 'Testing', code: 'My code', product: 'My product', presales: 'Requests' };
const HOME_ICON = { testing: 'review', code: 'work', product: 'chart', presales: 'deal' };
const homeKind = () => HOME_OF[myMember()?.department] || null;
const typeByKey = k => S.types.find(x => x.key === k) || (k === 'bug' ? bugType() : null);
function viewDeptHome() {
  const kind = homeKind();
  if (!kind) return [h('div', { class: 'scroll' }, pageHead('Home'), emptyState('NO DEPARTMENT', 'Pick your department to get a page made for your job.', { label: 'Pick my department', fn: () => openDeptPicker() }))];
  const m = me(); const hr = new Date().getHours(); const d = myDept();
  const hello = `${hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'}, ${first(m)}`;
  const P = kind === 'testing' ? testingParts() : kind === 'code' ? codeParts(d) : kind === 'presales' ? presalesParts() : productParts();
  const stat = (n, label, sel, cls) => h('button', { class: 'tstat' + (cls ? ' ' + cls : ''), onclick: () => $(sel)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, h('b', { text: String(n) }), h('span', { text: label }));
  const hero = h('header', { class: 'thero' }, h('div', { class: 'hrow' },
    h('div', { style: { minWidth: '0', flex: '1' } }, h('h1', { class: 'ptitle', text: hello }), h('div', { class: 'thsub', text: P.sub })),
    isPhone() ? h('button', { class: 'x', 'data-gsearch': '1', 'aria-label': 'Search', title: 'Search', onclick: () => cmdk.open() }, icon('search', 22)) : null,
    isPhone() ? bellButton() : null));
  const stats = h('div', { class: 'tstats' }, P.stats.map(s => stat(...s)));
  const quick = h('div', { class: 'tsec quickacts', 'data-quick': kind }, P.quick.filter(Boolean).map((q, i) => h('button', { class: 'btn' + (i === 0 ? ' pri' : ''), onclick: q.fn }, q.ic ? icon(q.ic, 15) : null, q.label)));
  const sec = ([title, cls, list, card, empty]) => h('section', { class: 'tsec ' + cls },
    h('h3', {}, title, list.length ? h('span', { class: 'ct', text: String(list.length) }) : null),
    list.length ? h('div', { class: 'tlist' }, list.slice(0, 30).map(card)) : h('div', { class: 'colempty', text: empty }));
  return [h('div', { class: 'scroll turnpage deptpage', 'data-home': kind }, hero, stats, quick, tellBar(), agentCard(), waitingSection(), ...P.sections.map(sec))];
}
const ageOf = t => t.turn_since || t.updated_at || t.created_at;
const withBtn = (card, label, fn) => { const b = h('button', { class: 'btn sm pri', onclick: e => { e.stopPropagation(); fn(); } }, label); card.append(b); return card; };
const newOf = (key, label, extra = {}) => typeByKey(key) ? { label, ic: 'plus', fn: () => openCreate(Object.assign({ typeKey: key, type: key === 'bug' ? 'bug' : undefined, showDetails: true }, extra)) } : null;

/* QA: what is ready to test, the bugs you reported that are still open, and what got fixed this week */
function testingParts() {
  const me_ = uid(); const week = Date.now() - 7 * 864e5;
  const ready = S.tasks.filter(t => catOf(t) === 'review' && canReview(t) && (t.reviewer_id === me_ || !t.reviewer_id || t.turn_owner === me_)).sort(SORTS.turnage);
  const mineBugs = S.tasks.filter(t => isBug(t) && t.created_by === me_);
  const open = mineBugs.filter(t => !isClosed(t) && catOf(t) !== 'review').sort(SORTS.turnage);
  const fixed = mineBugs.filter(t => catOf(t) === 'done' && t.completed_at && new Date(t.completed_at) > week);
  const who = t => { const o = t.turn_owner && t.turn_owner !== 'admins' ? prof(t.turn_owner) : t.assignee_id ? prof(t.assignee_id) : null; return o ? `With ${first(o)}` : 'Not assigned yet'; };
  return { sub: 'Your testing today',
    stats: [[ready.length, 'ready to test', '.h-ready'], [open.length, open.length === 1 ? 'bug still open' : 'bugs still open', '.h-open'], [fixed.length, 'fixed this week', '.h-fixed']],
    quick: [newOf('bug', 'Report a bug'), newOf('testrun', 'Test run'), newOf('testcase', 'Test cases')],
    sections: [
      ['Ready to test', 'h-ready', ready, t => withBtn(turnCard(t), 'Test', () => openTask(t.id)), 'Nothing is waiting for a test. New work shows here when a developer sends it to review.'],
      ['Your bugs still open', 'h-open', open, t => turnCard(t, { sub: `${who(t)} · ${ago(ageOf(t))}` }), 'None of your bugs are open.'],
      ['Fixed this week', 'h-fixed', fixed, t => turnCard(t, { sub: t.root_cause ? `Cause: ${String(t.root_cause).slice(0, 80)}` : 'Fixed' }), 'Nothing you reported was closed this week.']] };
}
/* developers: what came back from testing, what you're on (and where you stopped), new bugs in your area */
function codeParts(d) {
  const me_ = uid(); const a = deptAreas(d); const areaNames = (a.field?.options || []).filter(o => a.ids.includes(o.id)).map(o => o.label);
  const mine = S.tasks.filter(t => !isClosed(t) && (turnIsMine(t) || t.assignee_id === me_));
  const back = mine.filter(t => (t.sendbacks || 0) > 0 && ['started', 'unstarted'].includes(catOf(t)) && turnIsMine(t)).sort(SORTS.turnage);
  const doing = mine.filter(t => catOf(t) === 'started' && !back.includes(t)).sort(SORTS.turnage);
  const inArea = t => { if (!a.ids.length) return true; const v = (t.fields || {})[a.field.id]; const vals = Array.isArray(v) ? v : v ? [v] : []; return vals.some(x => a.ids.includes(x)); };
  const fresh = S.tasks.filter(t => isBug(t) && !isClosed(t) && ['backlog', 'unstarted'].includes(catOf(t)) && !t.assignee_id && inArea(t)).sort(SORTS.turnage);
  const label = areaNames.length ? areaNames.join(', ') : 'the team';
  return { sub: areaNames.length ? `${areaNames.join(', ')} · ${plural(mine.length, 'task')} with you` : `${plural(mine.length, 'task')} with you`,
    stats: [[doing.length, 'in progress', '.h-doing'], [back.length, 'sent back', '.h-back', back.length ? 'late' : ''], [fresh.length, 'new bugs', '.h-fresh']],
    quick: [newOf('bug', 'Bug'), newOf('feature', 'Task', { showDetails: false }) || { label: 'Task', ic: 'plus', fn: () => openCreate() }],
    sections: [
      ['Sent back to you', 'h-back', back, t => withBtn(turnCard(t, { sub: `Sent back ${t.sendbacks}× · open it for the reason` }), 'Fix', () => openTask(t.id)), 'Nothing came back from testing.'],
      ['In progress', 'h-doing', doing, t => turnCard(t, { sub: t.stopped?.text ? `Stopped: ${String(t.stopped.text).slice(0, 90)}` : undefined }), 'Nothing in progress. Start something from Your tasks.'],
      [`New bugs in ${label}`, 'h-fresh', fresh, t => withBtn(turnCard(t, { sub: `Reported by ${first(prof(t.created_by)) || (t.client_report ? `${t.client_report.name || 'the client'} (client)` : 'someone')} · not assigned` }), 'Take it', () => patchTask(t.id, { assignee_id: uid() }, { toast: 'It’s yours now' })), `No new bugs in ${label}.`]] };
}
/* Product / PM: decisions only you can make, client requests not planned yet, projects at risk */
function productParts() {
  const today = todayIso(); const cf = fdKey('client') || S.fields.find(x => /^client$/i.test(x.name || ''));
  const decide = S.tasks.filter(t => !isClosed(t) && (t.flags || []).includes('decision')).sort(SORTS.turnage);
  const asks = S.tasks.filter(t => !isClosed(t) && ['backlog', 'unstarted'].includes(catOf(t)) && !isBug(t) && !t.assignee_id && (!cf || (t.fields || {})[cf.id])).sort(SORTS.turnage);
  const risk = S.projects.map(p => { const ts = pTasks(p.id).filter(t => !isClosed(t)); return { p, late: ts.filter(t => t.due_date && t.due_date < today).length, back: ts.filter(t => (t.sendbacks || 0) > 1).length }; })
    .filter(x => x.late || x.back).sort((x, y) => (y.late + y.back) - (x.late + x.back));
  const lateAll = S.tasks.filter(t => !isClosed(t) && t.due_date && t.due_date < today).length;
  const projCard = x => h('button', { class: 'row tc', onclick: () => go({ v: 'project', id: x.p.id }) }, h('span', { class: 'tile st-review', 'aria-hidden': 'true' }, icon('folder', 18)),
    h('span', { class: 'tt' }, h('b', { class: 'notr', text: x.p.name }), h('span', { text: [x.late ? `${x.late} late` : '', x.back ? `${x.back} sent back more than once` : ''].filter(Boolean).join(' · ') })));
  return { sub: `${S.ws.name} · this week`,
    stats: [[decide.length, decide.length === 1 ? 'needs a decision' : 'need a decision', '.h-decide'], [asks.length, 'not planned yet', '.h-asks'], [lateAll, 'late', '.h-risk', lateAll ? 'late' : '']],
    quick: [newOf('brd', 'BRD'), newOf('feature', 'Feature request'), canSeeMoney() ? { label: 'Weekly brief', ic: 'chart', fn: () => go({ v: 'company' }) } : isAdmin() ? { label: 'Weekly report', ic: 'chart', fn: () => openWeeklyReport() } : null],
    sections: [
      ['Needs your decision', 'h-decide', decide, t => withBtn(turnCard(t, { sub: `Asked ${ago(ageOf(t))} ago` }), 'Decide', () => openTask(t.id)), 'No decisions waiting on you.'],
      ['Requests not planned yet', 'h-asks', asks, t => withBtn(turnCard(t), 'Plan', () => openTask(t.id)), 'Every request has an owner.'],
      ['Projects at risk', 'h-risk', risk, projCard, 'No project has late or bouncing work.']] };
}

