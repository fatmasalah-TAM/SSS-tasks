/* ═════════════ settings ═════════════ */
let settingsCtx = null; // { group, focus, sh }
const SET_GROUPS = [
  { k: 'workspace', n: 'Workspace', admin: true }, { k: 'workflow', n: 'Workflow', admin: true }, { k: 'items', n: 'Work items', admin: true },
  { k: 'automation', n: 'Automation', admin: true }, { k: 'me', n: 'Me' }, { k: 'help', n: 'Help & tours' },
];
function openSettings(group = 'me', focus) {
  if (!isAdmin() && SET_GROUPS.find(g => g.k === group)?.admin) group = 'me';
  openSheet({ title: 'Settings', kind: 'right', full: true, key: 'settings', onClose: () => { settingsCtx = null; }, build: sh => {
    settingsCtx = { group, focus, sh }; drawSettings(true);
  } });
  if (group !== 'me' && group !== 'help') tours.request('settings');
}
function openHelp() { openSettings('help'); }
function drawSettings(full) {
  const c = settingsCtx; if (!c) return; const sh = c.sh;
  // keep whatever the person is typing: remember the focused field and restore it after redrawing
  const a = document.activeElement; let keepF = null;
  if (sh.contains(a) && isTyping()) {
    const sec = a.closest('[data-sec]')?.dataset.sec || ''; const lbl = a.id ? `#${CSS.escape(a.id)}` : a.getAttribute('aria-label') ? `[aria-label="${CSS.escape(a.getAttribute('aria-label'))}"]` : null;
    if (lbl) keepF = { sel: (sec ? `[data-sec="${sec}"] ` : '') + lbl, idx: $$((sec ? `[data-sec="${sec}"] ` : '') + lbl, sh).indexOf(a), value: a.value, s: a.selectionStart, e: a.selectionEnd };
  }
  let wrap = $('.setwrap', sh); const st = $('.setbody', sh)?.scrollTop || 0;
  wrap?.remove();
  const nav = h('nav', { class: 'setnav', 'aria-label': 'Settings sections' }, SET_GROUPS.filter(g => !g.admin || isAdmin()).map(g => h('button', { 'aria-current': String(c.group === g.k), 'data-set': g.k, onclick: () => { c.group = g.k; c.focus = null; drawSettings(true); if (g.admin) tours.request('settings'); } }, g.n)));
  const body = h('div', { class: 'setbody' });
  ({ workspace: setWorkspace, workflow: setWorkflow, items: setItems, automation: setAutomation, me: setMe, help: setHelp })[c.group](body);
  wrap = h('div', { class: 'setwrap' }, nav, body); sh.append(wrap);
  requestAnimationFrame(() => $('[aria-current="true"]', nav)?.scrollIntoView({ inline: 'center', block: 'nearest' })); // phone: the open tab is always visible
  body.scrollTop = full && !c.keepScroll ? 0 : st; c.keepScroll = false;
  if (c.focus) { const f = $(`[data-sec="${c.focus}"]`, body); if (f) setTimeout(() => f.scrollIntoView({ block: 'start' }), 30); c.focus = null; }
  if (keepF) { const el = $$(keepF.sel, sh)[Math.max(0, keepF.idx)]; if (el) { el.value = keepF.value; el.focus(); try { el.setSelectionRange(keepF.s, keepF.e); } catch {} } }
}
function panel(title, sec, ...kids) { return h('section', { class: 'panel', 'data-sec': sec || null }, h('header', {}, h('h3', { text: title }), ...kids.filter(k => k && k.__head)), ...kids.filter(k => !(k && k.__head))); }
function headBtn(el) { el.__head = true; return el; }
function usedBy(n) { return h('span', { class: 'used', text: `Used by ${n} task${n === 1 ? '' : 's'}` }); }
function txtInput(value, onSave, attrs = {}) {
  const i = h('input', Object.assign({ type: 'text', value: value ?? '' }, attrs));
  i.addEventListener('change', () => onSave(i.value.trim())); i.addEventListener('keydown', e => { if (e.key === 'Enter') i.blur(); });
  return i;
}
function colorBtn(color, onPick, label = 'Color') {
  return h('button', { class: 'swatch', style: { background: color, width: '24px', height: '24px' }, 'aria-label': label, title: label, onclick: e => {
    popover(e.currentTarget, pop => pop.append(h('div', { class: 'swatches', style: { padding: '10px' } }, OPT_COLORS.map(c => h('button', { style: { background: c }, 'aria-label': c, 'aria-pressed': String(c === color), onclick: () => { closePop(); onPick(c); } })))));
  } });
}
function previewCard() {
  const ty = S.types.find(t => t.is_bug) || S.types[0]; const st = firstStatus('review') || sortedStatuses()[0];
  const fake = { id: 'preview', number: 142, title: 'Deleted cars can still enter', type_id: ty?.id, status_id: st?.id, priority: 2, assignee_id: uid(), reviewer_id: S.ws.default_reviewer, fields: {}, flags: [], checklist: [], turn_owner: null, turn_since: new Date(Date.now() - 3 * 864e5).toISOString(), sendbacks: 1 };
  for (const f of S.fields.filter(f => f.show_on_card)) { if (f.kind === 'select') fake.fields[f.id] = f.options[0]?.id; if (f.kind === 'multi') fake.fields[f.id] = f.options.slice(0, 1).map(o => o.id); }
  fake.turn_owner = computeTurn(fake);
  const card = taskCard(fake, { draggable: false }); card.onclick = null; card.style.pointerEvents = 'none'; card.style.maxWidth = '300px';
  return h('div', { class: 'preview', 'data-tour': 'set-preview' }, h('div', { class: 'lbl', text: 'Live preview' }), card);
}
function moveIn(list, i, d) { const j = i + d; if (j < 0 || j >= list.length) return null; const a = list.slice(); [a[i], a[j]] = [a[j], a[i]]; return a; }

/* ── Workspace ── */
function setWorkspace(body) {
  const w = S.ws;
  body.append(panel('Workspace', 'ws', h('div', { class: 'pbody' },
    h('div', { class: 'grid2' },
      h('label', { class: 'field' }, 'Workspace name', txtInput(w.name, v => v && saveWs({ name: v }, 'Workspace renamed'), { id: 'wsName' })),
      h('label', { class: 'field' }, 'App name', h('span', { class: 'h', text: 'Shown in the title bar and on the sign-in screen.' }), txtInput(w.app_name, v => v && saveWs({ app_name: v }, 'App name updated'), { id: 'appName' })),
      h('label', { class: 'field' }, 'ID prefix', h('span', { class: 'h', text: `Tasks read like ${w.prefix}-142.` }), txtInput(w.prefix, v => { v = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); v && saveWs({ prefix: v }, 'Prefix updated'); }, { id: 'wsPrefix', maxlength: '5' }))),
    h('div', { class: 'field' }, 'Accent color', h('div', { class: 'swatches' }, ACCENTS.map(a => h('button', { style: { background: a.l }, title: a.n, 'aria-label': a.n, 'aria-pressed': String((w.accent || 'teal') === a.k), onclick: () => saveWs({ accent: a.k }, `${a.n} applied`) })))))));

  body.append(panel('Promises to clients (SLA)', 'sla', slaPanel()));
  body.append(panel('Onboarding checklist', 'onboarding', onboardingPanel()));
  body.append(panel('Departments', 'depts', h('div', { class: 'pbody' }, h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' } },
    h('div', { style: { flex: '1', minWidth: '200px' } }, h('b', { 'data-dept-summary': '1', text: deptSummary() }), h('div', { class: 'note', text: 'Which departments your company has, their names, and whether everyone sees every page.' })),
    h('button', { class: 'btn', 'data-dept-setup': '1', onclick: () => openDeptSetup() }, 'Set up departments')))));
  // members
  const counts = id => S.tasks.filter(t => t.assignee_id === id && !isClosed(t)).length;
  body.append(panel(`Members · ${S.members.length}`, 'members', ...S.members.map(m => {
    const p = prof(m.user_id); const self = m.user_id === uid();
    return h('div', { class: 'prow' }, avatar(p, { size: 'lg' }), h('div', { class: 'nm' }, h('div', { text: dname(p) + (self ? ' (you)' : '') }), h('div', { class: 'sub', text: `${p?.email || ''} · ${counts(m.user_id)} open` }),
        h('button', { class: 'lnk sm', 'data-member-dept': m.user_id, onclick: () => openDeptPicker({ forUser: m.user_id }) }, deptLabel(m) || 'Set department')),
      self ? h('span', { class: 'sub', text: m.role === 'admin' ? 'Admin' : 'Member' }) :
        h('select', { 'aria-label': `Role for ${dname(p)}`, onchange: async e => { const { error } = await sb.from('workspace_members').update({ role: e.target.value }).eq('workspace_id', S.ws.id).eq('user_id', m.user_id).select(); if (error) { toast(errText(error)); e.target.value = m.role; } else { m.role = e.target.value; toast('Role updated'); render(); } } },
          h('option', { value: 'member', selected: m.role === 'member' }, 'Member'), h('option', { value: 'admin', selected: m.role === 'admin' }, 'Admin')),
      !self && m.role !== 'admin' ? h('label', { class: 'check sm', title: 'Let this person add new members (not admins)' }, h('input', { type: 'checkbox', checked: !!m.can_invite, 'aria-label': `${dname(p)} can add people`, onchange: async e => {
        const v = e.target.checked; const { error } = await sb.from('workspace_members').update({ can_invite: v }).eq('workspace_id', S.ws.id).eq('user_id', m.user_id).select();
        if (error) { e.target.checked = !v; return toast(errText(error)); } m.can_invite = v; toast(v ? `${first(p)} can now add people` : `${first(p)} can no longer add people`);
      } }), h('span', { text: 'Can add people' })) : null,
      self ? null : h('button', { class: 'btn sm ghost danger', onclick: e => confirmIn(e.currentTarget.closest('.panel'), { text: `Remove ${dname(p)} from ${S.ws.name}? Their tasks stay.`, yes: 'Remove', danger: true, onYes: async () => {
        const { error } = await sb.from('workspace_members').delete().eq('workspace_id', S.ws.id).eq('user_id', m.user_id);
        if (error) return toast(errText(error)); S.members = S.members.filter(x => x.user_id !== m.user_id); toast('Member removed'); drawSettings(); render();
      } }) }, 'Remove'));
  })));

  body.append(invitePanel(drawSettings));

  body.append(panel('Import tasks', 'import', h('div', { class: 'pbody' }, h('p', { class: 'note', text: 'Add many bugs or requests at once from a spreadsheet. Download the template, fill one row per task, upload it, review the fixes, then create.' }),
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, h('button', { class: 'btn', onclick: () => downloadTemplate() }, icon('export', 16), 'Download template'), h('button', { class: 'btn pri', onclick: () => openImport() }, icon('upload', 16), 'Import from a file')))));
  body.append(aiPanel());
  body.append(panel('Huddles', 'huddles', huddlePanel()));
  body.append(panel('Client pages', 'clientlinks', clientLinksPanel()));
  const signupBox = h('div', {}); body.append(signupBox);
  sb.rpc('is_owner_admin').then(r => { if (r.data) signupBox.replaceWith(panel('New teams', 'signup', signupPanel())); }).catch(() => {});
  body.append(panel('Backup', 'backup', h('div', { class: 'pbody' }, h('p', { class: 'note', text: 'Download everything in this workspace (settings, tasks, comments) as one JSON file.' }), h('div', {}, h('button', { class: 'btn', onclick: () => fullBackup() }, icon('export', 16), 'Download backup')))));
}
function inviteLink(i) { return `${location.origin}${location.pathname}?invite=${encodeURIComponent(i.email)}${i.full_name ? '&name=' + encodeURIComponent(i.full_name) : ''}`; }
function inviteMessage(i) {
  return `*${first(me())} added you to the ${S.ws.name} team on ${appName()}.*\nTap the link to join. Your name and email are already filled in — just choose a password:\n${inviteLink(i)}\n\nThe link works once and expires in 7 days.`;
}
/* adding people: admins, and members an admin has trusted with it */
function canInvite() { return isAdmin() || !!S.members.find(m => m.user_id === uid())?.can_invite; }
function invitePanel(redraw) {
  const nameI = h('input', { type: 'text', id: 'inviteName', placeholder: 'Full name', 'aria-label': 'Name' });
  const emailI = h('input', { type: 'email', id: 'inviteEmail', placeholder: 'name@company.com', 'aria-label': 'Email' });
  const roleI = h('select', { 'aria-label': 'Role', hidden: !isAdmin() }, h('option', { value: 'member' }, 'Member'), isAdmin() && h('option', { value: 'admin' }, 'Admin')); // people an admin trusted to add others invite members only
  const deptI = h('select', { id: 'inviteDept', 'aria-label': 'Department' }, h('option', { value: '' }, 'Department (they pick if empty)'), ...['Software', 'Hardware', 'Business'].map(g => h('optgroup', { label: g }, deptsOn().filter(d => d.g === g).map(d => h('option', { value: d.k }, d.l)))));
  const sendBtn = h('button', { class: 'btn pri', onclick: () => send() }, 'Create invite');
  const send = async () => {
    const email = emailI.value.trim().toLowerCase(); const full_name = nameI.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { emailI.focus(); return toast('Enter a full email address'); }
    if (Object.values(S.profiles).some(p => p.email === email) && S.members.some(m => prof(m.user_id)?.email === email)) return toast('Already a member');
    const row = { email, full_name: full_name || null, role: roleI.value, department: deptI.value || null, workspace_id: S.ws.id, invited_by: uid(), created_at: nowIso() };
    const done = busy(sendBtn, 'Creating…'); const r = await write({ t: 'invites', op: 'upsert', row }); done(); if (r.error) return toast(errText(r.error));
    S.invites = S.invites.filter(i => i.email !== email).concat(row); emailI.value = ''; nameI.value = ''; redraw(); shareInvite(row);
  };
  return panel('Invite people', 'invites',
    ...S.invites.map(i => h('div', { class: 'prow' }, avatar(null, { size: 'lg' }), h('div', { class: 'nm' }, h('div', { text: i.full_name || i.email }), h('div', { class: 'sub', text: `${i.email} · ${i.role}${i.department ? ' · ' + (deptOf(i.department)?.l || i.department) : ''} · ${(Date.now() - new Date(i.created_at)) > 7 * 864e5 ? 'expired' : 'expires ' + fmtDate(new Date(new Date(i.created_at).getTime() + 7 * 864e5).toISOString())}` })),
      h('button', { class: 'btn sm', onclick: () => (Date.now() - new Date(i.created_at)) > 7 * 864e5 ? (async () => { const row = Object.assign({}, i, { created_at: nowIso() }); await write({ t: 'invites', op: 'upsert', row }); Object.assign(i, row); redraw(); shareInvite(i); })() : shareInvite(i) }, icon('whatsapp', 14), 'Send'),
      h('button', { class: 'btn sm ghost danger', onclick: async () => { const { error } = await sb.from('invites').delete().eq('email', i.email).eq('workspace_id', S.ws.id); if (error) return toast(errText(error)); S.invites = S.invites.filter(x => x.email !== i.email); redraw(); toast('Invite cancelled'); } }, 'Cancel'))),
    h('div', { class: 'pbody' }, h('div', { class: 'grid2' }, nameI, emailI), h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, deptI, roleI, h('span', { class: 'sp' }), sendBtn),
      h('p', { class: 'note', text: 'Any email works. You’ll get a personal link to send on WhatsApp; it works once and expires in 7 days.' }),
      manyInvites(deptI, redraw)),
    joinLinkBox(), isAdmin() ? companyEmailBox() : null);
}
/* "Add many at once": paste a list, one person per line: "Name, email" or just the email */
function manyInvites(deptI, redraw) {
  const ta = h('textarea', { id: 'inviteMany', rows: '4', placeholder: 'Sara Ali, sara@company.com\nomar@company.com', 'aria-label': 'One person per line' });
  const go_ = h('button', { class: 'btn', 'data-invite-many': '1', onclick: async () => {
    const rows = []; const bad = [];
    for (const line of ta.value.split(/\n+/).map(l => l.trim()).filter(Boolean)) {
      const em = (line.match(/[^\s,;<>]+@[^\s,;<>]+\.[^\s,;<>]+/) || [])[0];
      if (!em) { bad.push(line); continue; }
      const nm = line.replace(em, '').replace(/[<>,;\t]+/g, ' ').trim();
      const email = em.toLowerCase();
      if (S.members.some(m => prof(m.user_id)?.email === email) || rows.some(r => r.email === email)) continue;
      rows.push({ email, full_name: nm || null, role: 'member', department: deptI.value || null, workspace_id: S.ws.id, invited_by: uid(), created_at: nowIso() });
    }
    if (!rows.length) return toast(bad.length ? 'No email found on those lines' : 'Paste one person per line');
    const done = busy(go_, 'Creating…'); const r = await write({ t: 'invites', op: 'upsert', row: rows }); done(); if (r.error) return toast(errText(r.error));
    S.invites = S.invites.filter(i => !rows.some(x => x.email === i.email)).concat(rows); ta.value = ''; redraw();
    toast(rows.length === 1 ? '1 invite created. Tap Send next to it.' : `${rows.length} invites created. Tap Send next to each.`);
  } }, 'Create invites');
  return h('details', { class: 'many' }, h('summary', { text: 'Add many at once' }),
    h('p', { class: 'note', text: 'Paste a list from Excel or WhatsApp, one person per line: a name and an email. The department above applies to everyone.' }), ta, h('div', {}, go_));
}
/* one link for the whole team: share it in the company WhatsApp group */
function joinLinkUrl(tok) { return `${location.origin}${location.pathname}?join=${tok}`; }
function joinLinkMessage(tok) { return `*Join ${S.ws.name} on ${appName()}*\nTap the link, create your account, and you’re in:\n${joinLinkUrl(tok)}`; }
function joinLinkBox() {
  const box = h('div', { class: 'pbody joinlink', 'data-joinlink': '1' }, h('p', { class: 'note', text: 'Loading…' }));
  const draw = link => {
    if (!link) return box.replaceChildren(h('b', { text: 'Invite link' }),
      h('p', { class: 'note', text: 'One link for everyone. Send it in your company’s WhatsApp group: whoever opens it creates an account and joins this team as a member.' }),
      h('div', {}, h('button', { class: 'btn', 'data-joinlink-make': '1', onclick: async e => { const done = busy(e.currentTarget, 'Creating…'); const r = await sb.from('join_links').insert({ workspace_id: S.ws.id, created_by: uid() }).select().single(); done(); if (r.error) return toast(errText(r.error)); draw(r.data); shareJoinLink(r.data.token); } }, icon('share', 16), 'Create invite link')));
    const off = async () => { const { error } = await sb.from('join_links').update({ revoked_at: nowIso() }).eq('token', link.token); if (error) return toast(errText(error)); draw(null); toast('Invite link turned off. It no longer works.'); };
    box.replaceChildren(h('b', { text: 'Invite link' }),
      h('div', { class: 'linkline' }, h('code', { 'data-joinlink-url': '1', class: 'notr', dir: 'ltr', text: joinLinkUrl(link.token) })),
      h('p', { class: 'note', text: `Works until ${fmtDate(link.expires_at)}. Anyone who has it can join as a member.` }),
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        h('button', { class: 'btn sm', onclick: () => shareJoinLink(link.token) }, icon('whatsapp', 14), 'Send'),
        h('button', { class: 'btn sm', onclick: () => copyText(joinLinkUrl(link.token), 'Link copied') }, 'Copy link'),
        h('span', { class: 'sp' }),
        h('button', { class: 'btn sm ghost danger', 'data-joinlink-off': '1', onclick: off }, 'Turn off link')));
  };
  sb.from('join_links').select('*').eq('workspace_id', S.ws.id).is('revoked_at', null).gt('expires_at', nowIso()).order('created_at', { ascending: false }).limit(1)
    .then(r => draw(r.error ? null : (r.data || [])[0] || null)).catch(() => draw(null));
  return box;
}
function shareJoinLink(tok) {
  const msg = joinLinkMessage(tok);
  openSheet({ title: 'Send the invite link', kind: 'center', stack: !!currentSheet(), build: sh => {
    sh.append(h('div', { class: 'sbody' }, h('p', { class: 'note', text: 'Send this to your team, for example in your company’s WhatsApp group:' }),
      h('div', { class: 'md', style: { whiteSpace: 'pre-wrap', background: 'var(--bg)', border: '1px solid var(--line)', padding: '12px', borderRadius: '2px', fontSize: '14px', overflowWrap: 'anywhere' }, text: msg.replace(/\*/g, '') })),
      h('div', { class: 'sfoot' },
        navigator.share ? h('button', { class: 'btn', onclick: () => navigator.share({ text: msg }).catch(() => {}) }, icon('share', 16), 'Share…') : null,
        h('button', { class: 'btn', onclick: () => copyText(msg, 'Copied') }, 'Copy'), h('span', { class: 'sp' }),
        h('a', { class: 'btn pri', href: 'https://wa.me/?text=' + encodeURIComponent(msg), target: '_blank', rel: 'noopener' }, icon('whatsapp', 16), 'WhatsApp')));
  } });
}
/* the company email: people who sign up with it join by themselves */
function companyEmailBox() {
  const dom = (S.session?.user?.email || '').split('@')[1]?.toLowerCase() || '';
  const personal = !dom || /^(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|mac|aol|proton|protonmail|pm|gmx|yandex|mail|zoho|hey|tutanota|fastmail|qq|163|126)\./.test(dom);
  const on = !!S.ws.join_domain;
  const box = h('div', { class: 'pbody', 'data-company-email': '1' }, h('b', { text: 'Company email' }));
  if (personal && !on) { box.append(h('p', { class: 'note', text: 'Sign in with your company email (not Gmail or Yahoo) to let your team join by themselves.' })); return box; }
  const shown = on ? S.ws.join_domain : dom;
  const cb = h('input', { type: 'checkbox', id: 'joinDomain', checked: on, onchange: async e => {
    const v = e.target.checked; const r = await sb.rpc('set_join_domain', { ws: S.ws.id, on_: v });
    if (r.error) { e.target.checked = !v; return toast(errText(r.error)); }
    S.ws.join_domain = r.data || null; const w = S.wsList.find(x => x.id === S.ws.id); if (w) w.join_domain = S.ws.join_domain;
    toast(v ? `Anyone with an @${r.data} email can now join by themselves` : 'Turned off. People need an invite to join.');
  } });
  box.append(h('label', { class: 'check' }, cb, h('span', {}, h('span', { text: 'People who sign up with this email join this team by themselves:' }), ' ', h('b', { class: 'notr', dir: 'ltr', text: '@' + shown }))),
    h('p', { class: 'note', text: 'They join as members after confirming their email, so only real company inboxes get in. Gmail and other personal emails still need an invite.' }));
  return box;
}
function openInviteSheet() {
  if (!canInvite()) return toast('Ask an admin to add people');
  if (isAdmin()) return openSettings('workspace', 'invites');
  openSheet({ title: 'Add people', kind: 'center', key: 'invite', build: sh => {
    const box = h('div', { class: 'sbody' });
    const draw = () => box.replaceChildren(invitePanel(draw), h('p', { class: 'note', text: 'You can add members. Only an admin can make someone an admin.' }));
    draw(); sh.append(box);
  } });
}
function shareInvite(i) {
  const msg = inviteMessage(i);
  openSheet({ title: 'Send the invite', kind: 'center', stack: !!currentSheet(), build: sh => {
    const pre = h('div', { class: 'md', style: { whiteSpace: 'pre-wrap', background: 'var(--bg)', border: '1px solid var(--line)', padding: '12px', borderRadius: '2px', fontSize: '14px' } });
    msg.split(/(\*[^*\n]+\*)/).forEach(p => pre.append(/^\*[^*]+\*$/.test(p) ? h('b', { text: p.slice(1, -1) }) : p));
    sh.append(h('div', { class: 'sbody' }, h('p', { class: 'note', text: `${i.full_name || i.email} is invited. Send them this message:` }), pre),
      h('div', { class: 'sfoot' },
        navigator.share ? h('button', { class: 'btn', onclick: () => navigator.share({ text: msg }).catch(() => {}) }, icon('share', 16), 'Share…') : null,
        h('button', { class: 'btn', onclick: () => copyText(msg, 'Invite copied') }, 'Copy'),
        h('span', { class: 'sp' }),
        h('a', { class: 'btn pri', href: 'https://wa.me/?text=' + encodeURIComponent(msg), target: '_blank', rel: 'noopener' }, icon('whatsapp', 16), 'WhatsApp')));
  } });
}

/* ── Workflow ── */
function setWorkflow(body) {
  const sts = sortedStatuses();
  const rows = sts.map((s, i) => {
    const n = S.tasks.filter(t => t.status_id === s.id).length;
    return h('div', { class: 'prow', 'data-status': s.id },
      h('span', { style: { display: 'flex', flexDirection: 'column' } },
        h('button', { class: 'x', style: { width: '24px', height: '18px' }, 'aria-label': `Move ${s.name} up`, disabled: i === 0, onclick: () => reorder(i, -1) }, '▲'),
        h('button', { class: 'x', style: { width: '24px', height: '18px' }, 'aria-label': `Move ${s.name} down`, disabled: i === sts.length - 1, onclick: () => reorder(i, 1) }, '▼')),
      colorBtn(s.color, c => cfgUpsert('statuses', Object.assign({}, s, { color: c }))),
      stIcon(s),
      txtInput(s.name, v => v && v !== s.name && cfgUpsert('statuses', Object.assign({}, s, { name: v }), 'Status renamed'), { 'aria-label': 'Status name', style: { flex: '1 1 140px', fontWeight: '600' } }),
      h('select', { 'aria-label': 'Group', onchange: e => cfgUpsert('statuses', Object.assign({}, s, { category: e.target.value }), 'Status group updated') }, CATS.map(c => h('option', { value: c, selected: s.category === c }, CAT_NAME[c]))),
      h('label', { class: 'check sm', title: 'New tasks start here' }, h('input', { type: 'radio', name: 'defst', checked: s.is_default, onchange: async () => { for (const x of S.statuses) if (x.is_default && x.id !== s.id) await cfgUpsert('statuses', Object.assign({}, x, { is_default: false })); cfgUpsert('statuses', Object.assign({}, s, { is_default: true }), `${s.name} is the default`); } }), 'Default'),
      usedBy(n),
      h('button', { class: 'btn sm ghost danger', disabled: sts.length <= 1, onclick: e => deleteWithReplacement(e.currentTarget, 'status', s, n) }, 'Delete'));
  });
  const reorder = async (i, d) => { const a = moveIn(sts, i, d); if (!a) return; for (let k = 0; k < a.length; k++) if (a[k].position !== k) await cfgUpsert('statuses', Object.assign({}, a[k], { position: k })); };
  const addName = h('input', { type: 'text', id: 'newStatus', placeholder: 'New status name', 'aria-label': 'New status name' });
  const addCat = h('select', { 'aria-label': 'Group' }, CATS.map(c => h('option', { value: c, selected: c === 'started' }, CAT_NAME[c])));
  body.append(h('div', { class: 'grid2', style: { alignItems: 'start' } }, h('p', { class: 'note', text: 'Statuses are the columns of your board. Each belongs to a group, which decides whose turn it is: Review goes to the reviewer, Backlog to Started go to the developer.' }), previewCard()));
  body.append(panel('Statuses', 'statuses', ...rows, h('div', { class: 'pbody' }, h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, addName, addCat,
    h('button', { class: 'btn', onclick: () => { const n = addName.value.trim(); if (!n) return addName.focus(); cfgUpsert('statuses', { id: uuid(), workspace_id: S.ws.id, name: n, color: `#${{ backlog: '5F686E', unstarted: '4A5560', started: '9A5B00', review: '6A3FB5', done: '1E6B3A', canceled: '6B615C' }[addCat.value]}`, category: addCat.value, position: sts.length, is_default: false }, 'Status added'); addName.value = ''; } }, icon('plus', 14), 'Add status')))));

  // gates per tier
  const tf = S.ws.tier_field ? fdOf(S.ws.tier_field) : null;
  const gatePanel = panel('Review gates', 'gates',
    h('div', { class: 'pbody' },
      h('p', { class: 'note', text: 'Pick a field that sets how deep review goes (for SSS: Tier). Each option gets a checklist the reviewer ticks before a task can pass. Options with “critical” in the name can’t be passed without every check.' }),
      h('label', { class: 'field' }, 'Gate field', h('select', { id: 'gateField', onchange: e => saveWs({ tier_field: e.target.value || null }, 'Gate field updated') }, h('option', { value: '' }, 'No review gates'), S.fields.filter(f => f.kind === 'select').map(f => h('option', { value: f.id, selected: f.id === S.ws.tier_field }, f.name)))),
      tf ? tf.options.map(o => {
        const items = (S.ws.gates || {})[o.id] || [];
        const ta = h('textarea', { rows: String(Math.max(2, items.length)), 'aria-label': `${o.label} checks`, value: items.join('\n'), style: { width: '100%' } });
        ta.addEventListener('change', () => { const g = Object.assign({}, S.ws.gates || {}); g[o.id] = ta.value.split('\n').map(x => x.trim()).filter(Boolean); saveWs({ gates: g }, `${o.label} checks saved`); });
        return h('label', { class: 'field' }, h('span', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, tag(o.label, o.color), h('span', { class: 'h', text: 'one check per line' })), ta);
      }) : null));
  body.append(gatePanel);
}
function deleteWithReplacement(anchor, kind, item, n) {
  const doDelete = async (replacement) => {
    if (kind === 'status') {
      if (n && replacement) for (const t of S.tasks.filter(t => t.status_id === item.id)) await patchTask(t.id, { status_id: replacement }, { noUndo: true });
      await cfgDelete('statuses', item.id, 'Status deleted');
    } else if (kind === 'type') {
      if (n && replacement) for (const t of S.tasks.filter(t => t.type_id === item.id)) await patchTask(t.id, { type_id: replacement }, { noUndo: true });
      await cfgDelete('task_types', item.id, 'Type deleted');
    }
  };
  if (!n) return confirmIn(anchor.closest('.panel'), { text: `Delete “${item.name}”?`, yes: 'Delete', danger: true, onYes: () => doDelete(null) });
  const list = kind === 'status' ? sortedStatuses() : S.types;
  picker(anchor, { options: [{ header: `Move ${n} task${n > 1 ? 's' : ''} to…` }, ...list.filter(x => x.id !== item.id).map(x => ({ v: x.id, label: x.name }))], search: false, onPick: v => doDelete(v) });
}

/* ── Work items: types, fields, projects ── */
function setItems(body) {
  body.append(h('div', { class: 'grid2', style: { alignItems: 'start' } }, h('p', { class: 'note', text: 'Types bring their own description sections (templates). Fields marked “on card” show on the board, up to three.' }), previewCard()));
  // types
  body.append(panel('Types', 'types', ...S.types.map((ty, i) => {
    const n = S.tasks.filter(t => t.type_id === ty.id).length;
    const tmpl = h('input', { type: 'text', value: (ty.template || []).join(', '), 'aria-label': `${ty.name} template sections`, placeholder: 'Template sections, comma separated', style: { flex: '2 1 220px' } });
    tmpl.addEventListener('change', () => cfgUpsert('task_types', Object.assign({}, ty, { template: tmpl.value.split(',').map(x => x.trim()).filter(Boolean) }), 'Template saved'));
    return h('div', { class: 'prow', style: { alignItems: 'flex-start' } },
      colorBtn(ty.color, c => cfgUpsert('task_types', Object.assign({}, ty, { color: c }))),
      h('div', { style: { flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '0' } },
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } },
          txtInput(ty.name, v => v && cfgUpsert('task_types', Object.assign({}, ty, { name: v }), 'Type renamed'), { 'aria-label': 'Type name', style: { flex: '1 1 120px', fontWeight: '600' } }),
          h('select', { 'aria-label': 'Starts in', onchange: e => cfgUpsert('task_types', Object.assign({}, ty, { default_status: e.target.value || null }), 'Default status updated') }, h('option', { value: '' }, 'Workspace default'), sortedStatuses().map(s => h('option', { value: s.id, selected: s.id === ty.default_status }, 'Starts in ' + s.name)))),
        h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, tmpl),
        h('div', { style: { display: 'flex', gap: '16px', flexWrap: 'wrap' } },
          h('label', { class: 'check sm' }, h('input', { type: 'checkbox', checked: ty.is_bug, onchange: e => cfgUpsert('task_types', Object.assign({}, ty, { is_bug: e.target.checked }), e.target.checked ? 'Counts as a bug' : 'Counts as work') }), 'Counts as a bug'),
          h('label', { class: 'check sm' }, h('input', { type: 'checkbox', checked: ty.auto_route, onchange: e => cfgUpsert('task_types', Object.assign({}, ty, { auto_route: e.target.checked }), e.target.checked ? 'Auto-routing on' : 'Auto-routing off') }), 'Route to a developer automatically'))),
      usedBy(n), h('button', { class: 'btn sm ghost danger', disabled: S.types.length <= 1, onclick: e => deleteWithReplacement(e.currentTarget, 'type', ty, n) }, 'Delete'));
  }), h('div', { class: 'pbody' }, h('div', {}, h('button', { class: 'btn', onclick: async () => { const n = await promptText('New type name', '', 'Add type'); if (n) cfgUpsert('task_types', { id: uuid(), workspace_id: S.ws.id, name: n, color: OPT_COLORS[S.types.length % OPT_COLORS.length], icon: 'square', template: [], default_status: null, auto_route: false, is_bug: false, position: S.types.length }, 'Type added'); } }, icon('plus', 14), 'Add type')))));

  // fields
  body.append(panel('Fields', 'fields', ...S.fields.map(f => fieldRow(f)), h('div', { class: 'pbody' }, h('div', {}, h('button', { class: 'btn', onclick: e => picker(e.currentTarget, { options: Object.entries(KIND_NAME).map(([v, label]) => ({ v, label })), search: false, onPick: async kind => {
    const n = await promptText(`New ${KIND_NAME[kind].toLowerCase()} field`, '', 'Add field'); if (!n) return;
    const f = { id: uuid(), workspace_id: S.ws.id, name: n, kind, options: [], type_ids: [], project_ids: [], show_on_card: false, hide_empty: true, help: '', position: S.fields.length };
    if (await cfgUpsert('fields', f, 'Field added')) { settingsCtx.open = f.id; drawSettings(); }
  } }) }, icon('plus', 14), 'Add field')))));

  // projects
  const pn = h('input', { type: 'text', id: 'newProject', placeholder: 'e.g. Clubhouse & membership', 'aria-label': 'New project name', style: { flex: '1 1 200px' } });
  const addP = () => { const n = pn.value.trim(); if (!n) return pn.focus(); cfgUpsert('projects', { id: uuid(), workspace_id: S.ws.id, name: n, color: OPT_COLORS[S.projects.length % OPT_COLORS.length], created_at: nowIso() }, 'Project added'); pn.value = ''; };
  pn.addEventListener('keydown', e => { if (e.key === 'Enter') addP(); });
  body.append(panel('Projects', 'projects', ...S.projects.map(p => {
    const n = S.tasks.filter(t => t.project_id === p.id).length;
    return h('div', { class: 'prow' }, colorBtn(p.color, c => cfgUpsert('projects', Object.assign({}, p, { color: c }))),
      txtInput(p.name, v => v && cfgUpsert('projects', Object.assign({}, p, { name: v }), 'Project renamed'), { 'aria-label': 'Project name', style: { flex: '1 1 160px', fontWeight: '600' } }), usedBy(n),
      h('button', { class: 'btn sm ghost danger', onclick: e => confirmIn(e.currentTarget.closest('.panel'), { text: `Delete “${p.name}”? ${n} task${n === 1 ? '' : 's'} will have no project.`, yes: 'Delete', danger: true, onYes: () => cfgDelete('projects', p.id, 'Project deleted') }) }, 'Delete'));
  }), h('div', { class: 'pbody' }, h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, pn, h('button', { class: 'btn', onclick: addP }, icon('plus', 14), 'Add project')))));
}
function fieldRow(f) {
  const open = settingsCtx.open === f.id; const used = S.tasks.filter(t => hasVal(fieldVal(t, f))).length;
  const head = h('div', { class: 'prow' },
    h('button', { class: 'nm', style: { textAlign: 'start' }, 'aria-expanded': String(open), onclick: () => { settingsCtx.open = open ? null : f.id; drawSettings(); } }, h('div', { text: f.name }), h('div', { class: 'sub', text: `${KIND_NAME[f.kind]}${f.options?.length ? ` · ${f.options.length} options` : ''}${f.show_on_card ? ' · on card' : ''}${f.type_ids?.length ? ' · ' + f.type_ids.map(id => tyOf(id)?.name).filter(Boolean).join(', ') + ' only' : ''}` })),
    usedBy(used), h('button', { class: 'btn sm ghost', onclick: () => { settingsCtx.open = open ? null : f.id; drawSettings(); } }, open ? 'Close' : 'Edit'));
  if (!open) return head;
  const save = (patch, msg) => cfgUpsert('fields', Object.assign({}, fdOf(f.id) || f, patch), msg);
  const O = () => clone(fdOf(f.id)?.options || []);
  const ed = h('div', { class: 'pbody', style: { borderBottom: '1px solid var(--line)', background: 'var(--bg)' } },
    h('div', { class: 'grid2' },
      h('label', { class: 'field' }, 'Name', txtInput(f.name, v => v && save({ name: v }, 'Field renamed'))),
      h('label', { class: 'field' }, 'Help text', txtInput(f.help, v => save({ help: v }, 'Help text saved'), { placeholder: 'Shown when people hover the field' }))),
    h('div', { style: { display: 'flex', gap: '18px', flexWrap: 'wrap' } },
      h('label', { class: 'check sm' }, h('input', { type: 'checkbox', checked: f.show_on_card, onchange: e => { if (e.target.checked && S.fields.filter(x => x.show_on_card && x.id !== f.id).length >= 3) { e.target.checked = false; return toast('Cards show up to three fields'); } save({ show_on_card: e.target.checked }); } }), 'Show on cards and in the sentence'),
      h('label', { class: 'check sm' }, h('input', { type: 'checkbox', checked: f.hide_empty, onchange: e => save({ hide_empty: e.target.checked }) }), 'Fold away when empty')),
    h('div', { class: 'grid2' },
      h('div', { class: 'field' }, 'Applies to types', h('button', { class: 'btn', style: { justifyContent: 'flex-start' }, onclick: e => picker(e.currentTarget, { options: S.types.map(t => ({ v: t.id, label: t.name })), value: f.type_ids || [], multi: true, search: false, onPick: v => save({ type_ids: v }) }) }, f.type_ids?.length ? f.type_ids.map(id => tyOf(id)?.name).filter(Boolean).join(', ') : 'All types')),
      h('div', { class: 'field' }, 'Applies to projects', h('button', { class: 'btn', style: { justifyContent: 'flex-start' }, onclick: e => picker(e.currentTarget, { options: S.projects.map(p => ({ v: p.id, label: p.name })), value: f.project_ids || [], multi: true, onPick: v => save({ project_ids: v }) }) }, f.project_ids?.length ? f.project_ids.map(id => pjOf(id)?.name).filter(Boolean).join(', ') : 'All projects'))));
  if (f.kind === 'select' || f.kind === 'multi') {
    const opts = f.options || [];
    const optRows = opts.map((o, i) => {
      const n = S.tasks.filter(t => { const v = fieldVal(t, f); return v === o.id || (Array.isArray(v) && v.includes(o.id)); }).length;
      return h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
        h('span', { style: { display: 'flex' } }, h('button', { class: 'x', style: { width: '24px', height: '24px' }, 'aria-label': 'Move up', disabled: i === 0, onclick: () => save({ options: moveIn(O(), i, -1) }) }, '▲'), h('button', { class: 'x', style: { width: '24px', height: '24px' }, 'aria-label': 'Move down', disabled: i === opts.length - 1, onclick: () => save({ options: moveIn(O(), i, 1) }) }, '▼')),
        colorBtn(o.color, c => { const a = O(); a[i].color = c; save({ options: a }); }),
        txtInput(o.label, v => { if (!v) return; const a = O(); a[i].label = v; save({ options: a }, 'Option renamed'); }, { 'aria-label': 'Option', style: { flex: '1 1 140px' } }),
        usedBy(n),
        h('button', { class: 'btn sm ghost danger', onclick: e => {
          const remove = async repl => {
            for (const t of S.tasks) { const v = fieldVal(t, f); let nv = v; if (v === o.id) nv = repl; else if (Array.isArray(v) && v.includes(o.id)) nv = [...new Set(v.map(x => (x === o.id ? repl : x)).filter(Boolean))]; else continue; await setField(t, f, nv); }
            save({ options: O().filter(x => x.id !== o.id) }, 'Option removed');
          };
          if (!n) return remove(null);
          picker(e.currentTarget, { options: [{ header: `${n} task${n > 1 ? 's use' : ' uses'} it. Replace with…` }, ...opts.filter(x => x.id !== o.id).map(x => ({ v: x.id, label: x.label })), { v: null, label: 'Leave empty' }], search: false, onPick: v => remove(v) });
        } }, 'Remove'));
    });
    const ni = h('input', { type: 'text', placeholder: 'New option', 'aria-label': 'New option' });
    const addO = async () => { const v = ni.value.trim(); if (!v) return; const cur = O(); ni.value = ''; await save({ options: [...cur, { id: norm(v).slice(0, 24) + '-' + uuid().slice(0, 4), label: v, color: OPT_COLORS[cur.length % OPT_COLORS.length] }] }, 'Option added'); settingsCtx.keepScroll = true; drawSettings(true); $('input[aria-label="New option"]', settingsCtx.sh)?.focus(); };
    ni.addEventListener('keydown', e => { if (e.key === 'Enter') addO(); });
    ed.append(h('div', { class: 'field' }, 'Options', ...optRows, h('div', { style: { display: 'flex', gap: '8px' } }, ni, h('button', { class: 'btn', onclick: addO }, 'Add'))));
  }
  ed.append(h('div', { style: { display: 'flex', gap: '8px' } }, h('span', { class: 'sp' }), h('button', { class: 'btn sm ghost danger', onclick: e => confirmIn(ed, { text: `Delete the ${f.name} field? Values on ${used} task${used === 1 ? '' : 's'} are removed.`, yes: 'Delete field', danger: true, onYes: async () => { if (S.ws.tier_field === f.id) await saveWs({ tier_field: null }); await cfgDelete('fields', f.id, 'Field deleted'); } }) }, 'Delete field')));
  return h('div', {}, head, ed);
}

/* ── Automation ── */
function setAutomation(body) {
  const people = sel => [h('option', { value: '' }, 'Nobody'), ...S.members.map(m => h('option', { value: m.user_id, selected: m.user_id === sel }, dname(prof(m.user_id))))];
  body.append(panel('Who gets what', 'owners', h('div', { class: 'pbody' }, h('div', { class: 'grid2' },
    h('label', { class: 'field' }, 'Bug owner', h('span', { class: 'h', text: 'New bugs that match no rule go here.' }), h('select', { id: 'bugOwner', onchange: e => saveWs({ bug_owner: e.target.value || null }, 'Bug owner updated') }, people(S.ws.bug_owner))),
    h('label', { class: 'field' }, 'Default reviewer', h('span', { class: 'h', text: 'Tasks in review are this person’s turn unless the task names a reviewer.' }), h('select', { id: 'defReviewer', onchange: e => saveWs({ default_reviewer: e.target.value || null }, 'Default reviewer updated') }, people(S.ws.default_reviewer)))))));

  const rules = S.rules.slice().sort((a, b) => a.position - b.position);
  const selFields = S.fields.filter(f => f.kind === 'select' || f.kind === 'multi');
  const rr = rules.map((r, i) => {
    const f = fdOf(r.field_id);
    return h('div', { class: 'prow' },
      h('span', { class: 'mono sm mute', text: String(i + 1).padStart(2, '0') }),
      h('span', { class: 'nm' }, `${r.type_id ? tyOf(r.type_id)?.name || 'Any type' : 'Any type'}${f ? ` with ${f.name} = ${optOf(f, r.option_id)?.label || r.option_id}` : ''}`, ' → ', h('b', { text: dname(prof(r.user_id)) })),
      h('button', { class: 'x', 'aria-label': 'Move up', disabled: i === 0, onclick: async () => { const a = moveIn(rules, i, -1); for (let k = 0; k < a.length; k++) await cfgUpsert('routing_rules', Object.assign({}, a[k], { position: k })); } }, '▲'),
      h('button', { class: 'btn sm ghost danger', onclick: () => cfgDelete('routing_rules', r.id, 'Rule removed') }, 'Remove'));
  });
  const rt = h('select', { 'aria-label': 'Type' }, h('option', { value: '' }, 'Any type'), S.types.map(t => h('option', { value: t.id, selected: t.is_bug }, t.name)));
  const rf = h('select', { 'aria-label': 'Field' }, selFields.map(f => h('option', { value: f.id }, f.name)));
  const ro = h('select', { 'aria-label': 'Option' });
  const fillO = () => ro.replaceChildren(...(fdOf(rf.value)?.options || []).map(o => h('option', { value: o.id }, o.label)));
  rf.addEventListener('change', fillO); fillO();
  const ru = h('select', { 'aria-label': 'Developer' }, S.members.map(m => h('option', { value: m.user_id }, dname(prof(m.user_id)))));
  body.append(panel('Routing rules', 'rules', h('div', { class: 'pbody', style: { paddingBottom: '0' } }, h('p', { class: 'note', text: 'When a task of a type with auto-routing is created without a developer, the first matching rule picks one. You can always change it.' })), ...rr,
    h('div', { class: 'pbody' }, h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, rt, h('span', { class: 'sm', text: 'with' }), rf, h('span', { class: 'sm', text: '=' }), ro, h('span', { class: 'sm', text: '→' }), ru,
      h('button', { class: 'btn', disabled: !selFields.length || !S.members.length, onclick: () => cfgUpsert('routing_rules', { id: uuid(), workspace_id: S.ws.id, type_id: rt.value || null, field_id: rf.value || null, option_id: ro.value || null, user_id: ru.value, position: rules.length }, 'Rule added') }, icon('plus', 14), 'Add rule')))));

  body.append(panel('Sprints', 'sprints', h('div', { class: 'pbody' }, h('div', { class: 'grid2' },
    h('label', { class: 'field' }, 'Sprint 1 started on', h('input', { type: 'date', id: 'sprintStart', value: S.ws.sprint_start, onchange: e => e.target.value && saveWs({ sprint_start: e.target.value }, 'Sprint dates updated') })),
    h('label', { class: 'field' }, 'Sprint length (days)', h('input', { type: 'number', id: 'sprintLen', min: '1', max: '60', value: S.ws.sprint_len, onchange: e => { const v = Math.max(1, Math.min(60, +e.target.value || 14)); saveWs({ sprint_len: v }, 'Sprint length updated'); } }))),
    h('p', { class: 'note', text: `Today is in Sprint ${sprintOf()} (${fmtDate(sprintRange(sprintOf())[0].toISOString())} – ${fmtDate(sprintRange(sprintOf())[1].toISOString())}). New tasks join the current sprint.` }))));

  body.append(panel('Flags', 'flags', ...FLAGS.map(f => h('div', { class: 'prow' }, tag(f.n, f.c), h('span', { class: 'nm sub', style: { fontWeight: '500' }, text: f.help })))));
}

/* ── Me ── */
function setMe(body) {
  const m = me(); const p = S.prefs;
  const file = h('input', { type: 'file', accept: 'image/*', hidden: true, id: 'photoIn', onchange: () => { const f = file.files[0]; if (f) uploadPhoto(f); file.value = ''; } });
  body.append(panel('Profile', 'profile', h('div', { class: 'pbody' },
    h('div', { style: { display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' } }, avatar(m, { size: 'xl' }),
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, h('button', { class: 'btn pri', onclick: () => file.click() }, m?.avatar_url ? 'Change photo' : 'Upload photo'), m?.avatar_url ? h('button', { class: 'btn ghost danger', onclick: () => saveProfile({ avatar_url: null }, 'Photo removed') }, 'Remove') : null, file)),
    h('div', { class: 'grid2' },
      h('label', { class: 'field' }, 'Name', txtInput(m?.full_name, v => v && saveProfile({ full_name: v }, 'Name updated'), { id: 'myName' })),
      h('label', { class: 'field' }, 'Time zone', h('span', { class: 'h', text: 'Teammates see your local time on handoffs.' }), h('select', { id: 'myTz', onchange: e => saveProfile({ tz: e.target.value }, 'Time zone saved') }, tzOptions(m?.tz || myTz())))),
    h('div', { class: 'field', 'data-my-dept': '1' }, 'Department', h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } },
      h('b', { text: myDepts().map(d => d.l).join(' · ') || 'Not set yet' }),
      h('button', { class: 'btn sm', 'data-my-dept-btn': '1', onclick: () => openDeptPicker() }, !myDept() ? 'Set it' : isAdmin() ? 'Change' : 'Other jobs'))),
    h('p', { class: 'note', text: `${m?.email || ''} · ${isAdmin() ? 'Admin' : 'Member'} of ${S.ws.name}` }))));

  const seg = (k, val, opts, onPick) => h('div', { class: 'seg', role: 'group', 'aria-label': k }, opts.map(([v, l]) => h('button', { 'aria-pressed': String(val === v), onclick: () => onPick(v) }, l)));
  const views = [['myturn', 'My turn'], ['work', 'Work'], ['review', 'Review'], ['bugs', 'Bugs'], ['sprint', 'Sprint'], ['all', 'All tasks'], ...(canSeeMoney() ? [['company', 'Company']] : [])];
  body.append(panel('Appearance', 'look', h('div', { class: 'pbody' },
    h('div', { class: 'field' }, 'Theme', seg('Theme', p.theme, [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], v => { savePrefs({ theme: v }); drawSettings(); })),
    h('div', { class: 'field' }, 'Density', seg('Density', p.density, [['comfortable', 'Comfortable'], ['compact', 'Compact']], v => { savePrefs({ density: v }); drawSettings(); render(); })),
    h('label', { class: 'field' }, 'Open the app on', h('select', { id: 'defView', onchange: e => savePrefs({ default_view: e.target.value }).then(() => toast('Saved')) }, views.map(([v, l]) => h('option', { value: v, selected: p.default_view === v }, l)))))));

  const pushState = !('Notification' in window) ? 'Not supported on this browser. On iPhone, add the app to your home screen first.' : Notification.permission === 'denied' ? 'Blocked in your browser settings.' : Notification.permission === 'granted' ? 'On for this device.' : 'Not turned on for this device yet.';
  body.append(panel('Notifications', 'notify', h('div', { class: 'pbody' },
    h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } }, sw(p.push !== false && 'Notification' in window && Notification.permission === 'granted', v => { savePrefs({ push: v }); if (v) enablePush(true); else disablePush(); drawSettings(); }, 'Push alerts'), h('div', {}, h('b', { text: 'Push alerts' }), h('div', { class: 'note', text: `When it’s your turn or someone mentions you. ${pushState}` }))),
    h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } }, sw(m?.email_updates !== false, v => saveProfile({ email_updates: v }, v ? 'Email updates on' : 'Email updates off'), 'Email updates'), h('div', {}, h('b', { text: 'Email updates' }), h('div', { class: 'note', text: 'Same events by email, if your workspace has email sending set up.' }))),
    h('div', { style: { display: 'flex', gap: '12px', alignItems: 'flex-start' }, 'data-quiet': '1' }, sw(!!p.quiet_on, v => { savePrefs({ quiet_on: v, quiet_from: p.quiet_from ?? 22, quiet_to: p.quiet_to ?? 8 }); toast(v ? 'Quiet hours on' : 'Quiet hours off'); drawSettings(); }, 'Quiet hours'),
      h('div', {}, h('b', { text: 'Quiet hours' }), h('div', { class: 'note', text: 'No phone alerts or emails in these hours. When they end, one summary tells you what waited.' }),
        p.quiet_on ? h('div', { class: 'quietrow' }, h('label', {}, 'From ', hourSel(p.quiet_from ?? 22, v => savePrefs({ quiet_from: v }), 'quietFrom')), h('label', {}, 'To ', hourSel(p.quiet_to ?? 8, v => savePrefs({ quiet_to: v }), 'quietTo'))) : null)),
    h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } }, sw(!!p.data_saver, v => { savePrefs({ data_saver: v }); toast(v ? 'Data saver on' : 'Data saver off'); setupRealtime(); render(); drawSettings(); }, 'Data saver'), h('div', {}, h('b', { text: 'Data saver' }), h('div', { class: 'note', text: 'No photos, no live updates. The app refreshes when you come back to it.' }))))));

  body.append(panel('Sounds', 'sounds', soundsPanel()));
  body.append(panel('Language', 'lang', langPanel()));
  const np = h('input', { type: 'password', id: 'newPw', minlength: '6', placeholder: 'New password', autocomplete: 'new-password', 'aria-label': 'New password' });
  body.append(panel('Account', 'account', h('div', { class: 'pbody' },
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, pwEye(np), h('button', { class: 'btn', onclick: async e => { if (np.value.length < 6) return toast('Use at least 6 characters'); const done = busy(e.currentTarget, 'Saving…'); const { error } = await sb.auth.updateUser({ password: np.value }); done(); if (error) toast(errText(error)); else { np.value = ''; toast('Password changed'); } } }, 'Change password')),
    h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, isAdmin() ? h('button', { class: 'btn', onclick: () => openCreateWs() }, icon('plus', 14), 'Create a workspace') : null, h('button', { class: 'btn danger', onclick: () => signOut() }, 'Sign out')))));
}
function tzOptions(cur) { let zones = []; try { zones = Intl.supportedValuesOf('timeZone'); } catch { zones = [cur, 'Africa/Cairo', 'Europe/London', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Kolkata', 'America/New_York', 'UTC']; } if (!zones.includes(cur)) zones.unshift(cur); return zones.map(z => h('option', { value: z, selected: z === cur }, z.replace(/_/g, ' '))); }
const hourSel = (val, on, id) => h('select', { id, 'aria-label': id === 'quietFrom' ? 'Quiet from' : 'Quiet until', onchange: e => { on(Number(e.target.value)); toast('Quiet hours saved'); } },
  Array.from({ length: 24 }, (_, i) => h('option', { value: String(i), selected: i === Number(val), text: String(i).padStart(2, '0') + ':00' })));
async function saveProfile(patch, msg) {
  const p = me(); const prev = {}; for (const k in patch) prev[k] = p[k]; Object.assign(p, patch); render(); drawSettings();
  const r = await write({ t: 'profiles', op: 'update', id: uid(), patch }); if (r.error) { Object.assign(p, prev); render(); drawSettings(); return toast(errText(r.error)); }
  if (msg) toast(msg);
}
async function uploadPhoto(file) {
  toast('Uploading photo…');
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const s = Math.min(img.width, img.height);
    g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, N, N);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.88));
    const path = `${uid()}/avatar-${Date.now()}.jpg`;
    const { error } = await sb.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true }); if (error) throw error;
    await saveProfile({ avatar_url: sb.storage.from('avatars').getPublicUrl(path).data.publicUrl }, 'Photo updated');
  } catch (e) { toast(errText(e)); }
}

/* ── Help & tours ── */
function setHelp(body) {
  const rows = Object.entries(TOURS).filter(([k, t]) => !t.admin || isAdmin()).map(([k, t]) => h('div', { class: 'prow' },
    h('div', { class: 'nm' }, h('div', { text: t.name }), h('div', { class: 'sub', text: `${t.steps.length} steps` })),
    h('span', { class: 'used', text: tours.state(k) === 'done' ? '✓ Seen' : tours.state(k) === 'skipped' ? 'Skipped' : 'Not seen' }),
    h('button', { class: 'btn sm', onclick: () => { closeAllSheets(true); tours.replay(k); } }, 'Replay')));
  body.append(panel('Tours', 'tours', h('div', { class: 'pbody' }, h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } }, sw(!S.prefs.tours_off, v => { savePrefs({ tours_off: !v }); drawSettings(); }, 'Show tours'), h('div', {}, h('b', { text: 'Show tours' }), h('div', { class: 'note', text: 'A short tour the first time you open each feature.' })))), ...rows,
    h('div', { class: 'pbody' }, h('div', {}, h('button', { class: 'btn', onclick: () => { savePrefs({ tours: {}, tours_off: false }); toast('Tours reset'); drawSettings(); } }, 'Reset all tours')))));
  body.append(panel('Shortcuts', 'keys', h('div', { class: 'pbody' }, h('div', { class: 'kv' },
    ...[['⌘/Ctrl K', 'Search, jump or create'], ['C', 'New task'], ['/', 'Search this view'], ['J / K', 'Next / previous in Review'], ['P / B', 'Approve / Send back'], ['Esc', 'Close']].flatMap(([k, v]) => [h('label', {}, h('kbd', { text: k })), h('div', { class: 'val', text: v })])))));
  body.append(panel(`How ${appName()} works`, 'about', h('div', { class: 'pbody' },
    h('p', { style: { margin: '0' }, text: 'Every open task is someone’s turn: the developer while it’s being built, the reviewer while it’s in review, the client while you wait on them. “My turn” shows only what’s yours. When your part is done, pass it on with the button on each task (over to you) and add a note so the next person has the context.' }))));
}

/* ── workspaces ── */
/* ── owners only: let other teams sign up for Ovrto (each team gets its own private workspace) ── */
function signupPanel() {
  const box = h('div', { class: 'pbody' }, loadingRow('Checking…'));
  const draw = async () => {
    const { data: open } = await sb.rpc('signup_is_open');
    box.replaceChildren(
      h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
        sw(!!open, async v => { const { error } = await sb.rpc('set_signup_open', { v }); if (error) { toast(errText(error)); return draw(); } signupOpen = v; toast(v ? 'Anyone can now start a free team' : 'Sign-up is closed to new teams'); draw(); }, 'Let new teams sign up'),
        h('div', {}, h('b', { text: 'Let new teams sign up' }), h('div', { class: 'note', text: open ? 'On. Anyone can create an account and start their own private team. Your workspace stays private.' : 'Off. Only people you invite can create an account.' }))),
      open ? h('div', { class: 'cl-acts', style: { marginTop: '10px' } },
        h('button', { class: 'btn sm', onclick: () => copyText(location.origin + location.pathname + '?start=1', 'Sign-up link copied') }, 'Copy sign-up link')) : null);
  };
  draw();
  return box;
}
function openCreateWs() {
  openSheet({ title: 'Create a workspace', kind: 'center', stack: !!currentSheet(), build: sh => {
    const n = h('input', { type: 'text', id: 'wsNewName', placeholder: 'Team or company name' }); const p = h('input', { type: 'text', id: 'wsNewPrefix', placeholder: 'ID prefix, e.g. ACME', maxlength: '5' });
    const preset = h('select', { id: 'wsPreset' }, h('option', { value: 'blank' }, 'Software team (Feature, Bug, Improvement, Chore)'), h('option', { value: 'agency' }, 'Agency or creative team (Request, Revision, Content)'), h('option', { value: 'general' }, 'Any team (Task, Follow-up, Problem)'), ownerAdmin && h('option', { value: 'sss' }, 'SSS setup (plus Area, Client, Tier, Phase)'));
    const go_ = h('button', { class: 'btn pri' }, 'Create workspace');
    go_.addEventListener('click', async () => {
      if (!n.value.trim()) return n.focus(); const done = busy(go_, 'Creating…');
      const { data, error } = await sb.rpc('create_workspace', { ws_name: n.value.trim(), ws_prefix: (p.value || n.value).trim().slice(0, 5) || 'TSK', preset: preset.value });
      done(); if (error) return toast(errText(error));
      closeAllSheets(true); await loadWorkspaces(); await switchWs(data); toast('Workspace created'); setTimeout(() => openDeptSetup({ first: true }), 600);
    });
    sh.append(h('div', { class: 'sbody' }, h('label', { class: 'field' }, 'Name', n), h('label', { class: 'field' }, 'ID prefix', p), h('label', { class: 'field' }, 'Start from', preset), h('p', { class: 'note', text: 'You’ll be the admin. Invite people from Settings → Workspace.' })),
      h('div', { class: 'sfoot' }, h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), go_));
    setTimeout(() => n.focus(), 50);
  } });
}

/* ── AI tidy: the admin pastes a Gemini key; it is stored in the private secrets table, never in the app ── */
function aiPanel() {
  const box = h('div', { class: 'pbody' }, loadingRow('Checking…'));
  const draw = async () => {
    const a = await aiStatus();
    const key = h('input', { type: 'password', placeholder: a.enabled ? 'A key is saved. Paste a new one to replace it' : 'Paste your Gemini API key', 'aria-label': 'Gemini API key', autocomplete: 'off' });
    const model = h('input', { type: 'text', value: a.model || 'gemini-3.5-flash', 'aria-label': 'AI model', style: { maxWidth: '220px' } });
    const save = h('button', { class: 'btn pri', onclick: async () => {
      const k = key.value.trim(); if (!k && !a.enabled) { key.focus(); return toast('Paste the key first'); }
      const done = busy(save, 'Saving…'); const { error } = await sb.rpc('set_ai_key', { ws: S.ws.id, k: k || null, m: model.value.trim() || 'gemini-3.5-flash' }); done();
      if (error) return toast(errText(error)); aiOn = null; toast(k ? 'AI key saved' : 'AI model saved'); draw();
    } }, a.enabled ? 'Save' : 'Turn on AI');
    const test = h('button', { class: 'btn', onclick: async () => {
      const done = busy(test, 'Testing…');
      const { data, error } = await sb.functions.invoke('notify', { body: { op: 'tidy', ws: S.ws.id, rows: [{ i: 0, type: '', title: 'login btn dont work on iphone', description: 'when i tap login nothing happend' }], ctx: { types: S.types.map(t => ({ name: t.name, sections: t.template || [], bug: !!t.is_bug })), fields: [] } } });
      done();
      if (error || !data?.rows?.[0]) return toast('AI test failed: ' + (data?.error || error?.message || 'no answer. Check that the notify function is deployed.'));
      toast('AI works: “' + data.rows[0].title + '”');
    } }, 'Test');
    const off = a.enabled ? h('button', { class: 'btn ghost danger', onclick: async () => { const { error } = await sb.rpc('set_ai_key', { ws: S.ws.id, k: '', m: null }); if (error) return toast(errText(error)); toast('AI turned off'); draw(); } }, 'Turn off') : null;
    box.replaceChildren(
      h('p', { class: 'note' }, a.enabled ? h('b', { text: 'AI is on. ' }) : null, 'It powers each department’s agent, Tell Ovrto, the CEO’s weekly brief, writing tasks up from a note or a voice message, and “Improve with AI” on imports. It only drafts: nothing is saved until a person presses the button.'),
      h('p', { class: 'note' }, 'Get a free key at ', h('a', { href: 'https://aistudio.google.com/apikey', target: '_blank', rel: 'noopener', text: 'aistudio.google.com/apikey' }), ' (sign in with Google, then “Create API key”). The key is stored in your private database, not in the app. Free keys may let Google use what you send to improve its models, so avoid secrets in imported rows.'),
      isAdmin() ? h('div', { class: 'ai-key' }, key, model, save, a.enabled ? test : null, off) : h('p', { class: 'note', text: a.enabled ? 'An admin has turned AI on.' : 'Ask an admin to turn this on.' }),
      h('p', { class: 'note', text: 'Needs the notify and agents functions deployed in Supabase.' }));
  };
  draw();
  return panel('AI', 'ai', box);
}

