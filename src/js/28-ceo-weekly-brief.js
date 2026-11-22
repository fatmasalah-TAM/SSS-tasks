/* ═════════════ The CEO's weekly brief (Company page) ═════════════ */
function briefFacts() {
  let r = null; try { r = reportData('this'); } catch (e) { r = null; }
  const d = companyData(); const cur = M.settings?.currency || localCurrency();
  const facts = { company: S.ws.name, week: r ? `${r.b.label}: ${rangeText(r.b)}` : '',
    delivered: r ? r.done.length : 0, bugsFixed: r?.bugsFixed || 0, started: r?.started || 0, waitingForReview: r ? r.review.length : 0,
    pastDue: r ? r.overdue.slice(0, 5).map(t => `${taskKey(t)} ${t.title}`) : [],
    stuck: S.tasks.filter(t => waitsOf(t).some(w => Date.now() - new Date(w.at) > 2 * 864e5)).slice(0, 5).map(t => `${taskKey(t)} ${t.title}`),
    projects: d.projects.slice(0, 12).map(x => ({ name: x.p.name, tasksLeft: x.open, openBugs: x.bugs, doneThisWeek: x.done, lateTasks: x.lateTasks })),
    team: r ? { canTakeWork: r.people.filter(p => p.cap[0] === 'free').map(p => first(prof(p.id)) || p.name), full: r.people.filter(p => p.cap[0] === 'full').map(p => first(prof(p.id)) || p.name) } : {} };
  if (canSeeMoney() && (d.value || d.late.length || d.coming.length)) facts.money = { receivedThisMonth: fmtMoney(d.monthIn), stillToCome: fmtMoney(d.value - d.received),
    latePayments: d.late.slice(0, 5).map(z => `${z.p.name}: ${fmtMoney(Number(z.y.amount))} (${z.y.label || 'payment'}), due ${z.y.due}`),
    dueIn30Days: d.coming.slice(0, 5).map(z => `${z.p.name}: ${fmtMoney(Number(z.y.amount))}, due ${z.y.due}`), profit: fmtMoney(d.profit), currency: cur };
  return { facts, key: 'brief.' + S.ws.id + '.' + (r ? isoDay(r.b.from) : todayIso()) };
}
function briefCard() {
  const ai = aiKnown(); const { key } = briefFacts(); const saved = store.get(key, null);
  const box = h('div', { class: 'cocard static briefcard', 'data-brief': saved ? 'ready' : 'empty' });
  const draw = b => {
    box.dataset.brief = b ? 'ready' : 'empty';
    const text = b ? [b.summary, b.decisions.length ? 'Needs a decision:\n' + b.decisions.map(x => '• ' + x).join('\n') : '', b.good.length ? 'Good news:\n' + b.good.map(x => '• ' + x).join('\n') : ''].filter(Boolean).join('\n\n') : '';
    const write = h('button', { class: 'btn sm' + (b ? '' : ' pri') }, b ? 'Write again' : '✦ Write this week’s brief');
    write.addEventListener('click', async () => {
      const done = busy(write, 'Writing…'); track('ceo_brief');
      const res = await withTimeout(sb.functions.invoke('agents', { body: { op: 'brief', ws: S.ws.id, facts: briefFacts().facts } }), 60000).catch(() => ({ timedOut: true })); done();
      if (res.timedOut) return toast('The AI took too long. Try again.');
      const nb = res.data?.brief; if (res.error || !nb) return toast(res.data?.error || 'AI didn’t answer. Try again.');
      store.set(key, nb); draw(nb);
    });
    box.replaceChildren(...[
      b ? h('p', { class: 'brieftext', dir: 'auto', text: b.summary }) : h('p', { class: 'note', text: ai ? 'A few plain sentences for the CEO: what was delivered, how the money stands, and what needs a decision. Written from Ovrto’s numbers.' : reportSafeSummary() }),
      b && b.decisions.length ? h('div', { class: 'briefsec' }, h('b', { text: 'Needs a decision' }), h('ul', {}, b.decisions.map(x => h('li', { class: 'notr', dir: 'auto', text: x })))) : null,
      b && b.good.length ? h('div', { class: 'briefsec' }, h('b', { text: 'Good news' }), h('ul', {}, b.good.map(x => h('li', { class: 'notr', dir: 'auto', text: x })))) : null,
      h('div', { class: 'briefacts' }, ai ? write : (isAdmin() ? h('button', { class: 'btn sm', onclick: () => openSettings('workspace', 'ai') }, 'Turn on AI for a written brief') : null),
        b ? h('button', { class: 'btn sm', onclick: () => copyText(`${S.ws.name} · this week\n\n${text}`, 'Copied. Paste it in an email or WhatsApp') }, icon('copy', 14), 'Copy') : null,
        isAdmin() ? h('button', { class: 'btn sm ghost', onclick: () => openWeeklyReport() }, 'Full weekly report') : null)].filter(Boolean));
  };
  draw(saved);
  return box;
}
function reportSafeSummary() { try { return reportSummary(reportData('this')); } catch (e) { return 'Turn on AI in Settings → AI to get a written brief.'; } }

/* What to write in each box. Every task type's sections get an example (in grey, inside the box) and one line
   under it, so nobody has to guess. Matched by the section's name, so a workspace's own sections get them too. */
const SECTION_HINTS = {
  'steps to reproduce': ['1. Open the owner app as a resident\n2. Tap Visitors → Create QR\n3. Scan it at gate 2', 'Numbered. Someone else must get the same bug by following them.'],
  'expected': ['The gate opens', 'What should happen.'],
  'actual': ['The scanner says “Permission expired”', 'What happened instead. Add a screenshot or a video below.'],
  'environment': ['Staging · build 2.4.1 · iPhone 13, iOS 18', 'Where you saw it: server, build, phone or browser.'],
  'build / environment': ['Staging · build 2.4.1 · Android 14', 'Which build and server you tested on.'],
  'what was tested': ['Guest invitations: create, share, scan, expire', 'The screens or flows you covered.'],
  'bugs found': ['SSS-201, SSS-202 (or “none”)', 'Report each bug on its own and list them here.'],
  'feature / screen': ['Owner app → Visitors', 'The feature or screen these cases cover.'],
  'test cases': ['1. Create a guest QR → it appears in My visitors\n2. Scan an expired QR → “Expired” shows', 'One line each: what you do → what should happen.'],
  'goal': ['Residents can invite guests without calling security', 'The problem this solves, in one or two sentences.'],
  'requirements': ['1. Owner creates a QR for a guest\n2. QR works once, for one day\n3. Security sees who invited the guest', 'Numbered. What it must do, not how to build it.'],
  'acceptance criteria': ['Done when a guest QR opens the gate once and then expires', 'How the tester will know it is finished.'],
  'link or source': ['MG feedback doc, point 14 · meeting on Nov 12', 'Where this came from: client, document, meeting or chat.'],
  'why': ['MG asked for it; 3 residents complained this month', 'The reason. Who asked and what happens if we don’t.'],
  'scope': ['Owner app only. Not the dashboard yet.', 'What is in, and what is out.'],
  'what to show': ['Owner app: visitors, payments, facilities booking', 'The screens the client must see. Ask sales what they care about.'],
  'who attends': ['Adel (facility manager), 2 from their IT', 'Their names and jobs, so the demo fits them.'],
  'where and when': ['Their office, Thursday 11:00 · or online', 'Place and time. Say if you need a screen or internet there.'],
  'gates and entrances': ['8 gates: 3 main (cars), 5 pedestrian', 'Count each one and say its type.'],
  'power and network': ['Main gate: power yes, fiber 20 m away\nGate 4: no power, needs a cable', 'Per gate. Say what is missing.'],
  'devices we recommend': ['8 QR readers, 4 LPR cameras, 2 barriers', 'The proposal and the price come from this.'],
  'photos': ['Attach a photo of each gate below', 'At least one per gate.'],
  'what the client needs': ['Residents enter by QR; visitors get a one-day pass', 'In the client’s words, from the meeting and the survey.'],
  'our solution': ['SSS gates + community app; visitors through the owner app', 'What we offer, in plain words.'],
  'devices and quantities': ['8 QR readers · 4 LPR cameras · 2 barriers', 'From the site survey. Pre-sales checks each one.'],
  'software': ['Community app, admin dashboard, gates module', 'Which apps and modules they get.'],
  'change': ['Show the unit number next to the owner’s name', 'What changes, in plain words.'],
};
const secHint = name => SECTION_HINTS[String(name || '').trim().toLowerCase()] || null;
const TITLE_HINTS = { bug: 'e.g. QR shows “Permission expired” at gate 2', feature: 'e.g. Guests get a QR from the owner app', improvement: 'e.g. Show the unit number on the owner card',
  testrun: 'e.g. Test run: guest invitations on staging', testcase: 'e.g. Test cases: owner app visitors', brd: 'e.g. BRD: guest invitations', demo: 'e.g. Demo · Palm Hills', survey: 'e.g. Site survey · Mivida', proposal: 'e.g. Technical proposal · Royal City', chore: 'e.g. Renew the SSL certificate' };
const titleHint = ty => (ty && (TITLE_HINTS[ty.key] || (ty.is_bug ? TITLE_HINTS.bug : null))) || 'What needs doing?';

