/* ═════════════ Setting up a company, and understanding what people type in "Other" ═════════════
   A new company answers four taps (what it does, its weekly work, its teams, its size). Each answer picks the next one's
   likely answers, and the teams decide everyone's pages. "Other" takes free text in English, Arabic or Franco:
   Ovrto matches it to what already exists, and only if nothing fits does it become something new. */

/* words people use for each kind of work, in English, Arabic and Franco */
const KW = {
  sales: ['sell', 'sales', 'deal', 'client call', 'clients', 'customer', 'lead', 'bay3', 'مبيعات', 'سيلز', 'بيع', 'عملاء', 'عميل'],
  success: ['customer service', 'customer care', 'complain', 'request', 'call center', 'reception', 'خدمة العملاء', 'شكاوى', 'شكوى', 'كول سنتر', 'استقبال', 'customer success', 'account manag'],
  marketing: ['marketing', 'social', 'instagram', 'facebook', 'tiktok', 'post', 'content', 'campaign', ' ads', 'brand', ' seo ', 'تسويق', 'سوشيال', 'انستجرام', 'فيسبوك', 'تيك توك', 'بوست', 'اعلان', 'إعلان', 'محتوى', 'ماركتنج'],
  finance: ['financ', 'account', 'invoice', 'payment', 'pay supplier', 'collect', 'budget', ' tax', ' vat ', 'حسابات', 'محاسب', 'فواتير', 'فاتورة', 'مالية', 'تحصيل', 'فلوس', 'ضرايب', 'ضرائب'],
  hr: [' hr ', 'human resource', 'hiring', 'recruit', 'onboard', 'payroll', 'people team', 'موارد بشرية', 'توظيف', 'تعيين', 'شئون العاملين', 'شؤون الموظفين', 'مرتبات'],
  operations: ['operation', 'logistic', 'deliver', 'driver', 'dispatch', 'admin office', 'office manag', 'عمليات', 'توصيل', 'شحن', 'سواق', 'لوجستيات', 'تشغيل'],
  warehouse: ['stock', 'inventory', 'warehouse', 'store keeper', 'storekeeper', 'مخزن', 'مخزون', 'مخازن', 'جرد'],
  purchasing: ['purchas', 'procure', 'buy', 'supplier', 'vendor', 'مشتريات', 'موردين', 'مورد', 'شراء'],
  production: ['factory', 'production', 'manufactur', 'assembly', 'workshop', 'kitchen', 'chef', 'مصنع', 'انتاج', 'إنتاج', 'تصنيع', 'ورشة', 'مطبخ', 'شيف'],
  management: ['manag', 'ceo', 'director', 'owner', 'founder', ' gm ', 'مدير', 'ادارة', 'إدارة', 'صاحب', 'رئيس'],
  pm: ['project', 'coordinat', 'planning', 'planner', 'scrum', 'مشروع', 'مشاريع', 'تنسيق', 'تخطيط'],
  backend: ['software', 'develop', 'program', 'code', 'coding', 'backend', 'frontend', 'web', ' app', 'برمجة', 'مبرمج', 'مطور', 'تطوير', 'سوفتوير', 'ابلكيشن', 'موقع'],
  qa: ['test', ' qa ', 'quality', 'اختبار', 'تيست', 'جودة'],
  design: ['design', 'graphic', ' ui ', ' ux ', 'تصميم', 'جرافيك', 'ديزاين'],
  media: ['photo', 'video', 'film', 'drone', 'montage', 'camera', 'تصوير', 'فيديو', 'مونتاج', 'فوتوغرافي'],
  devops: [' it ', 'network', 'server', 'system admin', 'helpdesk', 'help desk', 'شبكات', 'سيرفر', 'آي تي', 'اي تي'],
  field: ['field', 'site', 'install', 'technician', 'maintenance', 'repair', 'فني', 'فنيين', 'تركيب', 'صيانة', 'موقع العميل', 'تصليح'],
  support: ['support', 'ticket', 'helpline', 'troubleshoot', 'دعم', 'سابورت', 'تذاكر'],
  legal: ['legal', 'lawyer', 'contract', 'قانون', 'محامي', 'عقود', 'شئون قانونية'],
};
/* the teams a company can tick; generic names, each working like one of Ovrto's built-in departments */
const TEAMS = [
  { k: 'management', l: 'Management', base: 'management' }, { k: 'sales', l: 'Sales', base: 'sales' }, { k: 'success', l: 'Customer service', base: 'success' },
  { k: 'operations', l: 'Operations', base: 'operations' }, { k: 'finance', l: 'Finance', base: 'finance' }, { k: 'hr', l: 'HR', base: 'hr' },
  { k: 'marketing', l: 'Marketing', base: 'marketing' }, { k: 'pm', l: 'Projects', base: 'pm' }, { k: 'backend', l: 'Software', base: 'backend' },
  { k: 'qa', l: 'Testing', base: 'qa' }, { k: 'design', l: 'Design', base: 'design' }, { k: 'devops', l: 'IT', base: 'devops' },
  { k: 'field', l: 'Field team', base: 'field' }, { k: 'support', l: 'Technical support', base: 'support' },
  { k: 'warehouse', l: 'Warehouse', base: 'operations', custom: true }, { k: 'purchasing', l: 'Purchasing', base: 'operations', custom: true },
  { k: 'production', l: 'Manufacturing', base: 'operations', custom: true }, { k: 'legal', l: 'Legal', base: 'management', custom: true },
];
const WEEKLY = [
  { g: 'With clients', items: [['sell', 'Find and sell to clients', 'sales'], ['requests', 'Answer client requests', 'success'], ['sites', 'Visit client sites', 'field']] },
  { g: 'Doing the work', items: [['projects', 'Run projects', 'pm'], ['software', 'Build software', 'backend'], ['test', 'Test before delivery', 'qa'], ['make', 'Make products', 'production'], ['deliver', 'Deliver orders', 'operations']] },
  { g: 'Things and suppliers', items: [['stock', 'Keep stock', 'warehouse'], ['equipment', 'Look after equipment', 'support'], ['suppliers', 'Buy from suppliers', 'purchasing']] },
  { g: 'Office', items: [['invoices', 'Send invoices and collect payments', 'finance'], ['approve', 'Approve requests', 'management'], ['hire', 'Hire and onboard people', 'hr'], ['campaigns', 'Run marketing', 'marketing']] },
];
const BIZ = [
  { k: 'software', l: 'Software and IT', preset: 'blank', work: ['sell', 'requests', 'projects', 'software', 'test', 'invoices'], words: ['software', ' it ', ' app', 'web', 'saas', 'tech', 'برمجة', 'سوفتوير', 'تطبيقات', 'مواقع'] },
  { k: 'devices', l: 'Devices and electronics', preset: 'general', work: ['sell', 'requests', 'sites', 'equipment', 'stock', 'projects', 'invoices'], words: ['device', 'electronic', 'hardware', 'camera', 'security system', 'smart', 'أجهزة', 'اجهزة', 'الكترونيات', 'كاميرات'] },
  { k: 'field', l: 'Maintenance and field service', preset: 'general', work: ['requests', 'sites', 'equipment', 'stock', 'invoices'], words: ['maintenance', 'repair', 'service', ' ac ', 'air condition', 'clean', 'install', 'صيانة', 'تكييف', 'تصليح', 'نظافة', 'تركيب'] },
  { k: 'build', l: 'Construction and real estate', preset: 'general', work: ['sell', 'projects', 'sites', 'suppliers', 'invoices', 'approve'], words: ['construct', 'real estate', 'property', 'building', 'contract', 'interior', 'مقاولات', 'عقارات', 'بناء', 'تشطيب', 'ديكور'] },
  { k: 'factory', l: 'Factory and production', preset: 'general', work: ['sell', 'make', 'stock', 'suppliers', 'approve', 'invoices'], words: ['factory', 'manufactur', 'production', 'plant', 'مصنع', 'تصنيع', 'انتاج', 'إنتاج'] },
  { k: 'shops', l: 'Shops and restaurants', preset: 'general', work: ['requests', 'stock', 'suppliers', 'deliver', 'hire'], words: ['shop', 'store', 'retail', 'restaurant', 'cafe', 'café', 'bakery', 'branch', 'محل', 'محلات', 'مطعم', 'كافيه', 'فروع', 'سوبر ماركت'] },
  { k: 'online', l: 'Online store', preset: 'general', work: ['requests', 'stock', 'deliver', 'campaigns', 'suppliers'], words: ['online store', 'e-commerce', 'ecommerce', 'online shop', 'متجر', 'اونلاين', 'أونلاين'] },
  { k: 'clinic', l: 'Clinic and healthcare', preset: 'general', work: ['requests', 'stock', 'invoices', 'hire'], words: ['clinic', 'hospital', 'doctor', 'dental', 'pharmacy', 'medical', 'health', 'عيادة', 'مستشفى', 'دكتور', 'اسنان', 'صيدلية', 'طبي'] },
  { k: 'school', l: 'School and training', preset: 'general', work: ['requests', 'projects', 'invoices', 'campaigns'], words: ['school', 'training', 'course', 'academy', 'education', 'nursery', 'مدرسة', 'تدريب', 'كورسات', 'اكاديمية', 'تعليم', 'حضانة'] },
  { k: 'agency', l: 'Agency and marketing', preset: 'agency', work: ['sell', 'projects', 'campaigns', 'invoices'], words: ['agency', 'marketing', 'advertis', 'creative', 'media', 'production house', 'event', 'wedding', 'وكالة', 'تسويق', 'اعلانات', 'دعاية', 'ايفنت', 'أفراح', 'افراح', 'مناسبات'] },
  { k: 'services', l: 'Services', preset: 'general', work: ['sell', 'requests', 'projects', 'invoices'], words: ['consult', 'service', 'law firm', 'accounting firm', 'travel', 'استشارات', 'خدمات', 'سفر', 'سياحة'] },
];
const SIZES = ['1', '2–10', '11–50', '51–200', '201–1,000', '1,000+'];

/* score free text against lists of words; returns the best key, or null */
function matchWords(text, table) {
  const t = ' ' + String(text || '').toLowerCase().replace(/[.,;:!?()]/g, ' ').replace(/\s+/g, ' ') + ' ';
  let best = null, score = 0;
  for (const [k, words] of Object.entries(table)) {
    const s = words.reduce((n, w) => n + (t.includes(w.toLowerCase()) ? w.length : 0), 0);
    if (s > score) { score = s; best = k; }
  }
  return best;
}
const guessBiz = text => matchWords(text, Object.fromEntries(BIZ.map(b => [b.k, b.words])));
/* which built-in department a job sounds like (the pages it gets); never one with money pages */
function guessBase(text) { const k = matchWords(text, KW); const b = { warehouse: 'operations', purchasing: 'operations', production: 'operations', legal: 'operations', media: 'design' }[k] || k; return b && !['management', 'finance', 'hwlead'].includes(b) ? b : 'operations'; }
/* which of the company's own teams a job sounds like: its name first, then its words */
function matchTeam(text, teams = deptsOn()) {
  const t = String(text || '').trim().toLowerCase(); if (!t) return null;
  const byName = teams.find(d => d.l.toLowerCase() === t || (t.length > 3 && (t.includes(d.l.toLowerCase()) || d.l.toLowerCase().includes(t))));
  if (byName) return byName;
  const k = matchWords(t, KW); if (!k) return null;
  const custom = teams.find(d => d.l.toLowerCase() === (TEAMS.find(x => x.k === k)?.l || k).toLowerCase());
  if (custom) return custom;
  if (k === 'media') return null; // filming isn't UI design: a company without a media team gets asked to add one
  const base = { warehouse: 'operations', purchasing: 'operations', production: 'operations', legal: 'management' }[k] || k;
  return teams.find(d => d.k === base) || teams.find(d => d.base === base) || null;
}

/* ── the admin sets up a new company: name, then four questions ── */
function companySetupForm(onDone, err) {
  const st = { biz: new Set(), other: '', work: new Set(), teams: new Set(['management']), size: '', otherTeam: '', words: null };
  const name = h('input', { type: 'text', id: 'teamName', maxlength: '60', placeholder: 'e.g. Bright Studio', autocomplete: 'organization' });
  const box = h('div', { class: 'csq' });
  const chip = (on, label, attrs, fn) => h('button', Object.assign({ type: 'button', class: 'chipbtn', 'aria-pressed': String(on), onclick: fn }, attrs), on ? h('span', { 'aria-hidden': 'true', text: '✓ ' }) : null, h('span', { text: label }));
  const applyBiz = () => { const work = new Set(); for (const k of st.biz) (BIZ.find(b => b.k === k)?.work || []).forEach(w => work.add(w)); st.work = work; applyWork(); };
  const applyWork = () => { const t = new Set(['management']); for (const g of WEEKLY) for (const [k, , team] of g.items) if (st.work.has(k)) t.add(team); st.teams = t; };
  const otherI = h('input', { type: 'text', id: 'bizOther', maxlength: '120', placeholder: 'In a few words, e.g. we plan weddings and company events', value: st.other });
  const otherNote = h('div', { class: 'ai-note', hidden: true, 'aria-live': 'polite' });
  otherI.addEventListener('input', () => { st.other = otherI.value; clearTimeout(otherI._t); otherI._t = setTimeout(() => { const k = guessBiz(st.other); if (k && !st.biz.has(k)) { st.biz = new Set([k]); applyBiz(); draw(); } showOther(); }, 450); });
  const showOther = () => { const k = guessBiz(st.other); otherNote.hidden = !st.other.trim(); otherNote.textContent = k ? `Got it: ${BIZ.find(b => b.k === k).l}. We picked the answers below for you.` : 'Thanks. Pick what the company does every week below.'; };
  let showOtherBox = false;
  const teamOtherI = h('input', { type: 'text', id: 'teamOther', maxlength: '40', placeholder: 'Team name, e.g. Media' });
  const draw = () => {
    box.replaceChildren(
      h('div', { class: 'csq-q', 'data-q': 'biz' }, h('b', { text: 'What kind of business is the company?' }), h('span', { class: 'note', text: 'Pick one or two.' }),
        h('div', { class: 'chips' }, ...BIZ.map(b => chip(st.biz.has(b.k), b.l, { 'data-biz': b.k }, () => { st.biz.has(b.k) ? st.biz.delete(b.k) : (st.biz.size >= 2 ? null : st.biz.add(b.k)); applyBiz(); draw(); })),
          chip(showOtherBox, 'Other…', { 'data-biz': 'other', class: 'chipbtn other' }, () => { showOtherBox = !showOtherBox; draw(); if (showOtherBox) setTimeout(() => otherI.focus(), 30); })),
        showOtherBox ? otherI : null, showOtherBox ? otherNote : null),
      h('div', { class: 'csq-q', 'data-q': 'work' }, h('b', { text: 'What does the company do every week?' }), h('span', { class: 'note', text: st.biz.size ? 'Picked for you. Each one opens its pages; tap to change.' : 'Pick all that apply. Each one opens its pages.' }),
        ...WEEKLY.map(g => h('div', { class: 'csq-g' }, h('span', { class: 'csq-gl', text: g.g }), h('div', { class: 'chips' }, ...g.items.map(([k, l]) => chip(st.work.has(k), l, { 'data-work': k }, () => { st.work.has(k) ? st.work.delete(k) : st.work.add(k); applyWork(); draw(); })))))),
      h('div', { class: 'csq-q', 'data-q': 'teams' }, h('b', { text: 'Which teams does the company have?' }), h('span', { class: 'note', text: 'Each person’s menu starts from their team. You can rename any team later.' }),
        h('div', { class: 'chips' }, ...TEAMS.map(t => chip(st.teams.has(t.k), t.l, { 'data-team': t.k }, () => { st.teams.has(t.k) ? st.teams.delete(t.k) : st.teams.add(t.k); draw(); })),
          ...[...st.teams].filter(k => k.startsWith('own:')).map(k => chip(true, k.slice(4), { 'data-team': k }, () => { st.teams.delete(k); draw(); }))),
        h('div', { class: 'csq-add' }, teamOtherI, h('button', { type: 'button', class: 'btn sm', 'data-team-add': '1', onclick: () => {
          const v = teamOtherI.value.trim(); if (!v) return teamOtherI.focus();
          const known = TEAMS.find(t => t.l.toLowerCase() === v.toLowerCase()); st.teams.add(known ? known.k : 'own:' + v); teamOtherI.value = ''; draw();
        } }, icon('plus', 14), 'Add'))),
      h('div', { class: 'csq-q', 'data-q': 'size' }, h('b', { text: 'How many people work at the company?' }),
        h('div', { class: 'chips' }, ...SIZES.map(s => chip(st.size === s, s, { 'data-size': s }, () => { st.size = s; draw(); })))),
      wordsLine());
  };
  let wordsOpen = false, wordsEd = null, wordsTouched = false;
  const wordsLine = () => {
    const sug = wordsTouched ? st.words : suggestWords(st.biz, st.other); if (!wordsTouched) st.words = sug;
    const said = WORD_KINDS.map(([k], i) => wordOf(st.words, k, 0)).join(', ');
    if (wordsOpen) { wordsEd = wordsEditor(st.words); wordsEd.el.addEventListener('input', () => { wordsTouched = true; st.words = wordsEd.value(); }); }
    return h('div', { class: 'csq-q', 'data-q': 'words' }, h('b', { text: 'Your words' }),
      h('div', { class: 'note' }, h('span', { text: 'Ovrto will say: ' }), h('b', { class: 'notr', text: said })),
      wordsOpen ? wordsEd.el : h('div', {}, h('button', { type: 'button', class: 'btn sm', 'data-words-change': '1', onclick: () => { wordsOpen = true; draw(); } }, 'Change words')));
  };
  draw();
  const cfg = () => {
    const chosen = [...st.teams]; const on = [], names = {}, custom = [];
    for (const k of chosen) {
      if (k.startsWith('own:')) { const l = k.slice(4); custom.push({ k: 'c_' + Math.random().toString(36).slice(2, 8), l, base: guessBase(l) }); continue; }
      const t = TEAMS.find(x => x.k === k); if (!t) continue;
      if (t.custom) custom.push({ k: 'c_' + t.k, l: t.l, base: t.base });
      else { on.push(t.base); if (t.l !== deptOfBase(t.base)?.l) names[t.base] = t.l; }
    }
    return { small: ['1', '2–10'].includes(st.size), on, names, custom, biz: [...st.biz], biz_other: st.other.trim() || undefined, size: st.size || undefined, work: [...st.work], words: st.words || undefined };
  };
  const preset = () => { const b = [...st.biz].map(k => BIZ.find(x => x.k === k)); return b.find(x => x?.preset === 'blank') ? 'blank' : b.find(x => x?.preset === 'agency') ? 'agency' : 'general'; };
  return { name, box, cfg, preset, valid: () => { if (!name.value.trim()) return 'Give your company a name.'; if (!st.size) return 'Pick how many people work at the company.'; return ''; } };
}

/* ── a member's "Other": match it to a team the company has, or add a new team ── */
function otherTeamBox(onPick) {
  const inp = h('input', { type: 'text', id: 'deptOther', maxlength: '60', placeholder: 'Your job in a few words, e.g. I post on our Instagram' });
  const out = h('div', { class: 'ai-note', 'aria-live': 'polite', hidden: true });
  let seq = 0;
  const check = async () => {
    const v = inp.value.trim(); out.hidden = !v; if (!v) return out.replaceChildren();
    const my = ++seq; let d = matchTeam(v), ai = null;
    if (!d && navigator.onLine && await aiReady().catch(() => false)) { // the company's AI reads it when the word list can't
      if (my !== seq) return;
      out.replaceChildren(h('span', { class: 'note', text: 'Reading what you wrote…' }));
      try { const r = await sb.functions.invoke('team-match', { body: { ws: S.ws.id, text: v, teams: deptsOn().map(x => ({ k: x.k, l: x.l })) } }); ai = r.data && !r.data.error && !r.data.off ? r.data : null; } catch {}
      if (my !== seq) return;
      if (ai?.team) d = deptsOn().find(x => x.k === ai.team) || null;
    }
    if (d) return out.replaceChildren(h('span', {}, h('span', { text: 'Sounds like ' }), h('b', { text: d.l }), h('span', { text: '.' })), h('button', { type: 'button', class: 'btn sm pri', 'data-other-use': d.k, onclick: () => onPick(d.k) }, `Use ${d.l}`));
    const can = isAdmin() || wsDeptCfg()?.members_add !== false;
    const nm = ai?.new_name || (v.length <= 30 ? v.replace(/^i (also )?(do|work in|work on|handle|post on|post|make|run|am in)\s+/i, '').replace(/^\w/, c => c.toUpperCase()) : '');
    const like = ai?.works_like && !['management', 'finance', 'hwlead'].includes(ai.works_like) ? ai.works_like : guessBase(v);
    if (!can) return out.replaceChildren(h('span', { text: 'There’s no team like this yet. Ask your admin to add it.' }));
    const nameI = h('input', { type: 'text', id: 'newTeamName', maxlength: '40', value: nm, placeholder: 'Name the team, e.g. Media', 'aria-label': 'Team name' });
    out.replaceChildren(h('span', { text: 'There’s no team like this yet. Add it? Others who do the same job can join it.' }), nameI,
      h('button', { type: 'button', class: 'btn sm pri', 'data-other-add': '1', onclick: async e => {
        const l = nameI.value.trim(); if (l.length < 2) return nameI.focus();
        const done = busy(e.currentTarget, 'Adding…'); const r = await sb.rpc('add_my_team', { ws: S.ws.id, team: l, works_like: like }); done();
        if (r.error) return toast(errText(r.error));
        const c = Object.assign({}, wsDeptCfg() || {}); const k = r.data;
        if (!(c.custom || []).some(x => x.k === k)) c.custom = [...(c.custom || []), { k, l, base: like, by: uid() }];
        S.ws.departments = c; const w = S.wsList.find(x => x.id === S.ws.id); if (w) w.departments = c;
        toast(`${l} team added`); onPick(k);
      } }, icon('plus', 14), 'Add team'));
  };
  inp.addEventListener('input', () => { clearTimeout(inp._t); inp._t = setTimeout(check, 500); });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(inp._t); check(); } });
  return h('div', { class: 'otherteam' }, inp, out);
}

/* ── the company's own words (Client → Patient, Task → Job, Project → Event) ── */
const WORD_KINDS = [['client', 'The people you serve', 'Client', 'Clients'], ['task', 'One piece of work', 'Task', 'Tasks'], ['project', 'A bigger piece of work', 'Project', 'Projects']];
const WORD_IDEAS = {
  clinic: { client: { one: 'Patient', many: 'Patients', ar1: 'مريض', arm: 'مرضى' } },
  school: { client: { one: 'Student', many: 'Students', ar1: 'طالب', arm: 'طلاب' }, project: { one: 'Course', many: 'Courses', ar1: 'كورس', arm: 'كورسات' } },
  shops: { client: { one: 'Customer', many: 'Customers', ar1: 'زبون', arm: 'زباين' }, project: { one: 'Branch', many: 'Branches', ar1: 'فرع', arm: 'فروع' } },
  online: { client: { one: 'Customer', many: 'Customers', ar1: 'زبون', arm: 'زباين' } },
  field: { client: { one: 'Customer', many: 'Customers', ar1: 'زبون', arm: 'زباين' }, task: { one: 'Job', many: 'Jobs', ar1: 'شغلانة', arm: 'شغلانات' } },
  build: { project: { one: 'Site', many: 'Sites', ar1: 'موقع', arm: 'مواقع' } },
  events: { project: { one: 'Event', many: 'Events', ar1: 'مناسبة', arm: 'مناسبات' } },
};
function suggestWords(biz, otherText) {
  const out = {}; const keys = [...biz]; if (/event|wedding|party|conference|ايفنت|أفراح|افراح|مناسبات|حفلات/i.test(otherText || '')) keys.push('events');
  for (const k of keys) Object.assign(out, WORD_IDEAS[k] || {});
  return Object.keys(out).length ? out : null;
}
const wordOf = (w, k, i) => (w && w[k] && (i ? w[k].many || w[k].one : w[k].one)) || WORD_KINDS.find(x => x[0] === k)[i ? 3 : 2];
/* rows of inputs to edit the words; returns { el, value() } */
function wordsEditor(start) {
  const rows = WORD_KINDS.map(([k, label, one, many]) => {
    const v = (start && start[k]) || {};
    const mk = (key, ph, lang) => h('input', { type: 'text', maxlength: '24', 'data-word': `${k}.${key}`, placeholder: ph, value: v[key] || '', lang, dir: lang === 'ar' ? 'rtl' : 'ltr', 'aria-label': `${label}: ${ph}` });
    const i = { one: mk('one', one, 'en'), many: mk('many', many, 'en'), ar1: mk('ar1', 'بالعربي', 'ar'), arm: mk('arm', 'الجمع', 'ar') };
    return { k, i, el: h('div', { class: 'wrow' }, h('b', { text: label }), h('div', { class: 'wgrid' }, i.one, i.many, i.ar1, i.arm)) };
  });
  return { el: h('div', { class: 'words' }, h('p', { class: 'note', text: 'Leave a box empty to keep Ovrto’s word. Arabic is optional.' }), ...rows.map(r => r.el)),
    value() { const o = {}; for (const r of rows) { const x = {}; for (const [kk, inp] of Object.entries(r.i)) { const t = inp.value.trim(); if (t) x[kk] = t; } if (x.one || x.ar1) o[r.k] = x; } return Object.keys(o).length ? o : null; } };
}
function wordsPanel() {
  const w = wsDeptCfg()?.words || null; const ed = wordsEditor(w);
  const save = h('button', { class: 'btn pri', 'data-words-save': '1', onclick: async e => {
    const words = ed.value(); const cfg = Object.assign({}, wsDeptCfg() || {}, { words });
    const done = busy(e.currentTarget, 'Saving…'); const r = await sb.from('workspaces').update({ departments: cfg }).eq('id', S.ws.id).select(); done();
    if (r.error) return toast(errText(r.error));
    S.ws.departments = cfg; const x = S.wsList.find(y => y.id === S.ws.id); if (x) x.departments = cfg;
    toast('Saved. Ovrto is switching to your words…'); WORDS.sync(S.ws);
  } }, 'Save words');
  return h('div', { class: 'pbody' }, h('p', { class: 'note', text: 'Use the words your company uses. A clinic can say Patient instead of Client, a workshop Job instead of Task. Everyone in the team sees them.' }), ed.el, h('div', {}, save));
}
