/* ═════════════ create ═════════════ */
const PRIO_TOK = { urgent: 1, u: 1, high: 2, h: 2, medium: 3, med: 3, m: 3, low: 4, l: 4 };
function openCreate(opts = {}) {
  const draft = store.get('draft.' + (S.ws?.id || ''), null);
  const bugTy = S.types.find(t => t.is_bug); const defTy = deptTypeKeys().map(k => S.types.find(x => x.key === k && !x.is_bug)).find(Boolean) || S.types.find(t => !t.is_bug) || S.types[0];
  const st = {
    type_id: opts.type === 'bug' ? bugTy?.id : opts.typeKey && S.types.find(x => x.key === opts.typeKey) ? S.types.find(x => x.key === opts.typeKey).id : (opts.preset?.type_id || draft?.type_id || (S.route.v === 'bugs' ? bugTy?.id : defTy?.id)),
    title: opts.prefill?.title || draft?.title || '', description: draft?.description || '', assignee_id: opts.preset?.assignee_id ?? null, assigneeManual: false, priority: opts.preset?.priority ?? 0,
    project_id: opts.preset?.project_id ?? (S.route.v === 'project' ? S.route.id : null), sprint: usesSprints() ? sprintOf() : null, due_date: null, fields: Object.assign({}, opts.preset?.fields || {}),
    status_id: opts.preset?.status_id || null, parent_id: opts.parent || null, showDetails: !!opts.showDetails, tierHint: null, secs: Object.assign({}, opts.prefill?.secs || {}),
  };
  let ctxRef;
  openSheet({ title: opts.parent ? `New sub-task of ${taskKey(taskOf(opts.parent))}` : 'New task', kind: 'center', key: 'create', build: (sh, ctx) => {
    ctxRef = ctx;
    const body = h('div', { class: 'sbody', style: { gap: '12px' } });
    const types = h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' }, role: 'radiogroup', 'aria-label': 'Type', 'data-tour': 'create-types' });
    const title = autoGrow(h('textarea', { id: 'newTitle', class: 'ttl', rows: '1', placeholder: titleHint(tyOf(st.type_id)), 'aria-label': 'Title', value: st.title }));
    const sentenceBox = h('div', { class: 'sentence', 'data-tour': 'create-sentence', style: { fontSize: '14.5px', lineHeight: '28px' } });
    const hints = h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' } });
    const details = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
    const createBtn = h('button', { class: 'btn pri' }, 'Create');
    // AI: speak it, or type it any way (English, Arabic, Franco) and let AI write it up
    const aiNote = h('div', { class: 'ai-note', hidden: true });
    const showAiNote = () => { aiNote.hidden = !st.aiNote; aiNote.textContent = st.aiNote ? '✦ ' + st.aiNote : ''; };
    const runDraft = async (input, btn) => {
      const done = busy(btn, input.audio ? 'Listening…' : 'Writing…'); const r = await aiDraft(input); done();
      if (r.error) return toast(r.error);
      applyDraft(st, r.draft, title); drawAll(); showAiNote(); title.dispatchEvent(new Event('input'));
    };
    const micBtn = h('button', { class: 'btn sm', type: 'button', 'data-tour': 'create-voice', title: 'Say the task out loud — AI writes it up' }, icon('mic', 16), 'Speak');
    const aiBtn = h('button', { class: 'btn sm', type: 'button', 'data-tour': 'create-ai', title: 'Rewrites what you typed (English, Arabic or Franco) as a clear task' }, '✦ Write it up with AI');
    micBtn.addEventListener('click', async () => { const v = await recordVoice('Speak the task'); if (v) runDraft({ audio: v.blob }, micBtn); });
    aiBtn.addEventListener('click', () => { const text = [title.value, ...Object.values(st.secs)].filter(x => String(x || '').trim()).join('\n'); if (!text.trim()) { title.focus(); return toast('Type a few words first (any language), or tap Speak'); } runDraft({ text }, aiBtn); });
    const aiRow = h('div', { class: 'ai-row' }, micBtn, aiBtn, aiNote);
    const typeChip = ty => h('button', { class: 'fchip' + (st.type_id === ty.id ? ' on' : ''), role: 'radio', 'aria-checked': String(st.type_id === ty.id), style: st.type_id === ty.id ? { borderColor: ty.color, background: `color-mix(in srgb,${ty.color} 14%,var(--surface))` } : null, onclick: () => { st.type_id = ty.id; drawAll(); title.focus(); } }, h('span', { class: 'swatch', style: { width: '10px', height: '10px', background: ty.color, border: '0' } }), ty.name);
    let moreTypes = false; /* the department's own types first; the rest one tap away */
    const drawTypes = () => {
      const keys = deptTypeKeys().filter(k => S.types.some(x => x.key === k)); const rank = x => keys.indexOf(x.key);
      const mine = keys.length ? S.types.filter(x => keys.includes(x.key) || x.id === st.type_id).sort((a, b) => (rank(a) < 0 ? 99 : rank(a)) - (rank(b) < 0 ? 99 : rank(b))) : S.types;
      const rest = S.types.filter(x => !mine.includes(x));
      types.replaceChildren(...mine.map(typeChip), ...(!rest.length || officeOnly() ? [] : moreTypes ? rest.map(typeChip)
        : [h('button', { class: 'fchip moretypes', type: 'button', onclick: () => { moreTypes = true; drawTypes(); } }, `More types (${rest.length})`)]));
    };
    const parse = () => {
      let raw = title.value; const found = {};
      raw = raw.replace(/(^|\s)@([\w.\-]+)/g, (m, sp, n) => { const mm = S.members.find(x => norm(first(prof(x.user_id))) === norm(n) || norm(dname(prof(x.user_id))).startsWith(norm(n))); if (mm) { found.assignee = mm.user_id; return sp; } return m; });
      raw = raw.replace(/(^|\s)!(\w+)/g, (m, sp, n) => { const p = PRIO_TOK[n.toLowerCase()]; if (p) { found.priority = p; return sp; } return m; });
      raw = raw.replace(/(^|\s)#([\w\-]+)/g, (m, sp, n) => { for (const f of S.fields.filter(f => ['select', 'multi'].includes(f.kind))) { const o = f.options.find(o => norm(o.label) === norm(n) || norm(o.label).startsWith(norm(n)) && norm(n).length >= 2); if (o) { (found.opts ||= []).push([f, o]); return sp; } } return m; });
      return { clean: raw.replace(/\s{2,}/g, ' ').trim(), found };
    };
    const temp = () => {
      const { clean, found } = parse(); const fields = Object.assign({}, st.fields);
      for (const [f, o] of found.opts || []) { if (f.kind === 'multi') fields[f.id] = [...new Set([...(fields[f.id] || []), o.id])]; else fields[f.id] = o.id; }
      // guess client from the title
      const cf = clientField(); if (cf && !hasVal(fields[cf.id])) { const o = cf.options.find(o => o.id !== 'all' && new RegExp(`\\b${o.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(clean)); if (o) fields[cf.id] = o.id; }
      const t = { type_id: st.type_id, title: clean, fields, priority: found.priority ?? st.priority, assignee_id: found.assignee ?? st.assignee_id, project_id: st.project_id, sprint: st.sprint, due_date: st.due_date, flags: [] };
      return t;
    };
    const drawSentence = () => {
      const t = temp(); const ty = tyOf(t.type_id); const route = !t.assignee_id ? routeFor(t) : null;
      const w = (label, fn, empty) => h('button', { class: 'w' + (empty ? ' blank' : ''), onclick: fn }, label);
      const parts = [w(ty?.name || 'Type', e => picker(e.currentTarget, { options: S.types.map(x => ({ v: x.id, label: x.name })), value: st.type_id, search: false, onPick: v => { st.type_id = v; drawAll(); } }))];
      let usedFor = false, usedIn = false;
      for (const f of sentenceFields(t)) {
        const txt = fieldText(t, f); const word = f.kind === 'select' && !usedFor ? (usedFor = true, 'for') : f.kind === 'multi' && !usedIn ? (usedIn = true, 'in') : f.name.toLowerCase();
        parts.push(' ' + word + ' ', w(txt || f.name.toLowerCase() + '?', e => {
          const cur = t.fields[f.id];
          if (f.kind === 'multi') picker(e.currentTarget, { options: f.options.map(o => ({ v: o.id, label: o.label })), value: cur || [], multi: true, onPick: v => { st.fields[f.id] = v; drawSentence(); } });
          else if (f.kind === 'select') picker(e.currentTarget, { options: [...f.options.map(o => ({ v: o.id, label: o.label })), { v: null, label: 'Empty' }], value: cur, onPick: v => { st.fields[f.id] = v; drawSentence(); } });
          else if (f.kind === 'person') pickPerson(e.currentTarget, cur, v => { st.fields[f.id] = v; drawSentence(); });
        }, !txt));
      }
      parts.push(devWord(), w(t.assignee_id ? first(prof(t.assignee_id)) : route ? `${first(prof(route.user))} (${route.why})` : 'nobody yet', e => pickPerson(e.currentTarget, st.assignee_id, v => { st.assignee_id = v; st.assigneeManual = true; drawSentence(); }, route ? `Automatic: ${first(prof(route.user))} (${route.why})` : 'Nobody yet'), !t.assignee_id && !route));
      parts.push(', ', w(t.priority ? prioName(t.priority) + ' priority' : 'no priority', e => picker(e.currentTarget, { options: PRIOS.map(p => ({ v: p.k, label: p.n, icon: prioGlyph(p.k) })), value: t.priority, search: false, onPick: v => { st.priority = v; drawSentence(); } }), !t.priority));
      if (usesSprints()) parts.push(', ', w(t.sprint ? `Sprint ${t.sprint}` : 'no sprint', e => { const c = sprintOf(); picker(e.currentTarget, { options: [c, c + 1, c + 2].map(n => ({ v: n, label: `Sprint ${n}`, sub: n === c ? 'current' : '' })).concat([{ v: null, label: 'No sprint' }]), value: st.sprint, search: false, onPick: v => { st.sprint = v; drawSentence(); } }); }, !t.sprint));
      parts.push(', ', w(t.due_date ? 'due ' + fmtDate(t.due_date) : 'no due date', e => pickDate(e.currentTarget, st.due_date, v => { st.due_date = v; drawSentence(); }), !t.due_date));
      if (S.projects.length) parts.push(', ', w(pjOf(t.project_id)?.name || 'no project', e => picker(e.currentTarget, { options: [...S.projects.map(p => ({ v: p.id, label: p.name })), { v: null, label: 'No project' }], value: st.project_id, onPick: v => { st.project_id = v; drawSentence(); } }), !t.project_id));
      sentenceBox.replaceChildren(...parts, '.');
      // hints: routing, tier suggestion, similar tasks
      hints.replaceChildren();
      if (route && !t.assignee_id) hints.append(h('span', { class: 'sm', 'data-tour': 'create-route' }, '→ ', h('b', { text: first(prof(route.user)) }), ` (${route.why})`));
      const tf = S.ws.tier_field ? fdOf(S.ws.tier_field) : null;
      if (tf && !hasVal(t.fields[tf.id])) {
        const areaF = fdKey('area'); const areas = areaF ? (t.fields[areaF.id] || []) : [];
        const crit = areas.some(a => ['gates', 'security'].includes(a)) || /payment|login|refund|paymob|password|role|migration|deploy|gate/i.test(t.title);
        const sug = crit ? tf.options.find(o => /critical/i.test(o.label)) : null;
        if (sug) hints.append(h('button', { class: 'tag ghost', title: 'Suggested from the area and title. Tap to apply.', onclick: () => { st.fields[tf.id] = sug.id; drawSentence(); } }, `Suggest: ${sug.label} tier`));
      }
      const words = new Set(norm(t.title).length ? t.title.toLowerCase().split(/\W+/).filter(x => x.length > 3) : []);
      if (words.size >= 2) {
        const sim = S.tasks.find(x => !isClosed(x) && x.title && x.title.toLowerCase().split(/\W+/).filter(w => words.has(w)).length >= 2);
        if (sim) hints.append(h('button', { class: 'meta', title: sim.title, onclick: () => { closeSheet(true); openTask(sim.id); } }, `Similar: ${taskKey(sim)}`));
      }
    };
    const drawDetails = () => {
      details.replaceChildren();
      const ty = tyOf(st.type_id); const tmpl = ty?.template || [];
      if (!st.showDetails) { details.append(h('button', { class: 'link', style: { alignSelf: 'flex-start' }, onclick: () => { st.showDetails = true; drawDetails(); $('textarea', details)?.focus(); } }, tmpl.length ? `+ Add ${tmpl.slice(0, 3).join(', ').toLowerCase()}` : '+ Add details')); return; }
      const secs = tmpl.length ? tmpl : [''];
      for (const s of secs) {
        const hint = secHint(s);
        const ta = autoGrow(h('textarea', { rows: hint && hint[0].includes('\n') ? '3' : '2', placeholder: hint ? hint[0] : s ? s + '…' : 'Details, links, acceptance criteria…', 'aria-label': s || 'Description', value: st.secs[s] || '', style: { width: '100%' } }));
        ta.addEventListener('input', () => { st.secs[s] = ta.value; saveDraft(); });
        details.append(s ? h('label', { class: 'field' }, h('span', { class: 'h', text: s }), ta, hint ? h('small', { class: 'fhint', text: hint[1] }) : null) : ta);
      }
    };
    const saveDraft = debounce(() => store.set('draft.' + S.ws.id, { title: title.value, type_id: st.type_id, description: '' }), 300);
    const drawAll = () => { title.placeholder = titleHint(tyOf(st.type_id)); drawTypes(); drawSentence(); drawDetails(); };
    title.addEventListener('input', () => { drawSentence(); saveDraft(); createBtn.disabled = !parse().clean; });
    title.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
    let submitting = false;
    const submit = async () => {
      if (submitting) return; // a double tap or double Enter makes one task, not two
      const t = temp(); if (!t.title) { title.focus(); toast('Give it a title first'); return; }
      const ty = tyOf(t.type_id); const tmpl = ty?.template || [];
      let description = tmpl.length ? joinSections(tmpl.map(s => ({ h: s, body: (st.secs[s] || '').trim() })).filter(s => s.body)) : (st.secs[''] || '').trim();
      if (st.extraDesc && !description.includes(st.extraDesc)) description = [description, st.extraDesc].filter(Boolean).join('\n\n');
      if (opts.prefill?.description && !description.includes(opts.prefill.description)) description = [description, opts.prefill.description].filter(Boolean).join('\n\n');
      submitting = true; const done0 = busy(createBtn, 'Creating…'); const done = () => { submitting = false; done0(); };
      const row = Object.assign(t, { description, parent_id: st.parent_id, status_id: st.status_id || undefined });
      if (!row.status_id) delete row.status_id;
      if (opts.extra) Object.assign(row, opts.extra);
      const created = await createTask(row, { cleanFranco: true });
      done();
      if (!created) return;
      store.del('draft.' + S.ws.id); closeSheet(true); opts.onCreated?.(created);
      const dev = created.assignee_id; const routed = !t.assignee_id && dev;
      toast(ty?.is_bug && routed ? `Bug sent to ${first(prof(dev))}` : `${taskKey(created)} created`, { label: 'Open', fn: () => openTask(created.id) });
    };
    createBtn.addEventListener('click', submit);
    createBtn.disabled = !st.title;
    body.append(types, title, aiRow, sentenceBox, hints, details);
    sh.append(body, h('div', { class: 'sfoot' }, h('span', { class: 'sm mute', text: isPhone() ? 'Only the title is required' : 'Tip: @name  !high  #client · Enter to create' }), h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), createBtn));
    drawAll(); setTimeout(() => title.focus(), 60);
    if (opts.draft) { applyDraft(st, opts.draft, title); drawAll(); showAiNote(); createBtn.disabled = !parse().clean; }
  } });
  tours.request('create');
}

