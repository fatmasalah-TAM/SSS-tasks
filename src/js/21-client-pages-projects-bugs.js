/* ═════════════ client status page: a private read-only link per client (no sign-in) ═════════════ */
var clientTok = (() => { try { const c = new URLSearchParams(location.search).get('c'); return c && /^[0-9a-f]{20,64}$/i.test(c) ? c : null; } catch { return null; } })();
const clientUrl = tok => location.origin + location.pathname + '?c=' + tok;
// a person at a client: their own private link (?p=), with the status page, problem reports and a chat with the team
var personTok = (() => { try { const c = new URLSearchParams(location.search).get('p'); return c && /^[0-9a-f]{40}$/i.test(c) ? c : null; } catch { return null; } })();
const personUrl = tok => location.origin + location.pathname + '?p=' + tok;
function clientInstallable() { // the home-screen app should open this person's own link, so use a manifest without a start page
  const l = document.querySelector('link[rel="manifest"]'); if (l && !/client-manifest/.test(l.getAttribute('href') || '')) l.setAttribute('href', 'client-manifest.json');
}
async function portalData() {
  if (!personTok) { const { data, error } = await sb.rpc('client_status', { tok: clientTok }); return { data, error }; }
  clientInstallable();
  const { data, error } = await sb.functions.invoke('client-portal', { body: { ptok: personTok } });
  if (error || !data || data.error) return { data: null, error: error || (data?.error === 'link' ? null : data) };
  const st = data.status || {};
  return { data: { client: data.client, workspace: data.workspace, at: st.at || nowIso(), items: st.items || [], me: data.me, messages: data.messages || [] } };
}

async function clientPage() {
  // a client whose phone or browser is in Arabic sees the page in Arabic the first time
  try { if (localStorage.getItem('baton.lang') == null && /^ar\b/i.test(navigator.language || '')) return setLang('ar'); } catch {}
  if (clientPage.form) return; // never redraw over a report the client is typing
  document.getElementById('splash')?.remove();
  if (!clientPage.drawn) $('#app').innerHTML = bootLoader().replace('Loading your tasks…', 'Loading…');
  const { data, error } = await portalData();
  if (error || !data) {
    $('#app').replaceChildren(h('div', { class: 'cp' }, h('div', { class: 'cp-in' }, h('div', { class: 'cp-brand', html: ICONS.wordmark }),
      h('h1', { text: error ? 'Couldn’t load this page' : 'This link isn’t active' }),
      h('p', { class: 'mute', text: error ? 'Check your connection and try again.' : 'Ask your contact for a new link.' }))));
    document.title = 'Ovrto'; return;
  }
  const items = data.items || [];
  const groups = [
    ['waiting', 'Waiting on you', 'We need something from you to continue.', items.filter(i => i.waiting && !['done'].includes(i.category))],
    ['doing', 'In progress', 'Being worked on or checked now.', items.filter(i => !i.waiting && ['started', 'review'].includes(i.category))],
    ['planned', 'Planned', 'Agreed and coming up.', items.filter(i => !i.waiting && ['unstarted', 'backlog'].includes(i.category))],
    ['done', 'Done', 'Finished in the last 30 days.', items.filter(i => i.category === 'done')],
  ];
  const row = i => h('li', { class: 'cp-item' }, h('span', { class: 'cp-dot ' + i.category }),
    h('div', { class: 'cp-t' }, h('b', { dir: 'auto', text: i.title }),
      h('span', { class: 'sm mute' }, `${i.key}${i.bug ? ' · fix' : ''} · ${i.category === 'done' ? 'done ' + fmtDate((i.done_at || '').slice(0, 10)) : i.status}${i.due && i.category !== 'done' ? ' · due ' + fmtDate(i.due) : ''}`)));
  const total = items.length, done = groups[3][3].length; clientPage.drawn = true; clientPage.ws = data.workspace;
  $('#app').replaceChildren(h('div', { class: 'cp' }, h('div', { class: 'cp-in' },
    h('header', { class: 'cp-head' }, h('div', { class: 'cp-brand', html: ICONS.wordmark }),
      h('div', { class: 'seg notr cp-lang', role: 'group', 'aria-label': 'Language' },
        h('button', { 'aria-pressed': String(!isAr()), lang: 'en', onclick: () => !isAr() || setLang('en') }, 'English'),
        h('button', { 'aria-pressed': String(isAr()), lang: 'ar', dir: 'rtl', onclick: () => isAr() || setLang('ar') }, 'العربية'))),
    h('h1', { dir: 'auto', text: data.client }),
    h('p', { class: 'mute', text: `From the ${data.workspace} team · updated ${new Date(data.at).toLocaleString(UI_LOC, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` }),
    personTok ? clientChatBox(data) : null,
    h('div', { class: 'cp-report' }, h('div', {}, h('b', { text: 'Found a problem?' }), h('span', { class: 'sm mute', text: 'Send it straight to the team. Add a screenshot if you can.' })),
      h('button', { class: 'btn pri', onclick: () => clientReportForm(data) }, icon('plus', 14), 'Report a problem')),
    total ? h('div', { class: 'cp-sum' }, ...groups.map(([k, l, , list]) => h('div', { class: 'cp-n ' + k }, h('b', { text: String(list.length) }), h('span', { text: l })))) : null,
    total ? h('div', { class: 'cp-prog', role: 'img', 'aria-label': `${done} of ${total} done` }, h('i', { style: { width: Math.round(done / total * 100) + '%' } })) : null,
    ...(total ? groups.filter(g => g[3].length).map(([k, l, sub, list]) => h('section', { class: 'cp-g ' + k }, h('h2', { text: l }), h('p', { class: 'sm mute', text: sub }), h('ul', {}, ...list.map(row))))
      : [h('p', { class: 'cp-empty', text: 'Nothing open right now.' })]),
    h('footer', { class: 'cp-foot sm mute', text: 'This page updates by itself. Only people with this link can see it.' }))));
  document.title = `${data.client} · status`;
  clearTimeout(clientPage.t); clientPage.t = setTimeout(function again() { if (document.visibilityState === 'visible' && !(CC.el && CC.el.contains(document.activeElement))) clientPage(); else clientPage.t = setTimeout(again, 30e3); }, 120e3);
}

/* ── admin: Settings → Client pages ── */
async function loadClientLinks() {
  const { data, error } = await sb.from('client_links').select('*').eq('workspace_id', S.ws.id);
  return error ? { error } : { links: (data || []).filter(l => !l.revoked) };
}
function clientLinksPanel() {
  const box = h('div', { class: 'pbody' }, loadingRow('Checking…'));
  const draw = async () => {
    const cf = clientField();
    if (!cf) { box.replaceChildren(h('p', { class: 'note', text: 'Add a “Client” choice field (Work items → Fields) to make client pages.' })); return; }
    const r = await loadClientLinks();
    if (r.error) { box.replaceChildren(h('p', { class: 'note', text: 'Client pages need a quick database update (run the latest upgrade SQL). ' + errText(r.error) })); return; }
    const opts = (cf.options || []).filter(o => o.id !== 'all');
    box.replaceChildren(h('p', { class: 'note', text: 'Give each client a private link to a simple page with the status of their items (titles and progress only — no comments, descriptions or names). Clients can also report a problem there: it becomes a bug for that client and goes to whoever Who gets what picks. Turn a link off any time.' }),
      S.ws.bug_owner ? null : h('p', { class: 'note warn', text: 'No bug owner yet: a client’s report that matches no rule reaches every admin and waits with nobody’s turn. Pick a bug owner in Who gets what.' }),
      ...opts.map(o => {
        const l = r.links.find(x => x.field_id === cf.id && x.option_id === o.id);
        const n = S.tasks.filter(t => !isClosed(t) && (Array.isArray(t.fields?.[cf.id]) ? t.fields[cf.id].includes(o.id) : t.fields?.[cf.id] === o.id)).length;
        return h('div', { class: 'prow cl-row' }, h('span', { class: 'swatch', style: { background: o.color || 'var(--mute)' } }),
          h('div', { class: 'nm' }, h('div', { text: o.label }), h('div', { class: 'sub', text: l ? `Link on · ${n} open item${n === 1 ? '' : 's'}` : `${n} open item${n === 1 ? '' : 's'}` })),
          h('div', { class: 'cl-acts' }, ...(l ? [
            h('button', { class: 'btn sm', onclick: () => { track('client_link_shared'); copyText(clientUrl(l.token), 'Link copied'); } }, 'Copy link'),
            h('button', { class: 'btn sm', 'aria-label': `Send ${o.label} an update on WhatsApp`, onclick: () => clientWhatsApp(cf, o, l) }, icon('whatsapp', 14), 'WhatsApp'),
            h('a', { class: 'btn sm ghost', href: clientUrl(l.token), target: '_blank', rel: 'noopener' }, 'Open'),
            h('button', { class: 'btn sm', onclick: () => { closeAllSheets?.(true); openClientChat(cf.id, o.id); } }, icon('chat', 14), 'Chat'),
            h('button', { class: 'btn sm ghost danger', onclick: async e => { const done = busy(e.currentTarget, 'Turning off…'); const { error } = await sb.from('client_links').update({ revoked: true }).eq('token', l.token); done(); if (error) return toast(errText(error)); toast(`${o.label}’s link is off`); draw(); } }, 'Turn off'),
          ] : [h('button', { class: 'btn sm', onclick: () => { closeAllSheets?.(true); openClientChat(cf.id, o.id); } }, icon('chat', 14), 'Chat'), h('button', { class: 'btn sm pri', onclick: async e => {
            const done = busy(e.currentTarget, 'Making…');
            const { data, error } = await sb.from('client_links').insert({ workspace_id: S.ws.id, field_id: cf.id, option_id: o.id, label: o.label, created_by: uid() }).select().single(); done();
            if (error) return toast(errText(error)); await copyText(clientUrl(data.token), `Link for ${o.label} made and copied`); draw();
          } }, 'Make link')])));
      }));
  };
  draw();
  return box;
}
/* ── the client's "Report a problem" form: becomes a bug for this client, routed by Who gets what ── */
var CR_ERR = { title: 'Write what’s wrong in a few words (at least 3 letters).', details: 'The details are too long. Keep them under 4,000 letters.', name: 'Write your name.',
  phone: 'Write your WhatsApp number with the country code, e.g. +20 100 123 4567.', email: 'That email doesn’t look right. Fix it or leave it empty.',
  busy: 'This link has sent a lot of reports in a short time. Try again in an hour, or contact the team directly.', link: 'This link isn’t active any more. Ask your contact for a new link.',
  files: 'Screenshots must be pictures (JPG, PNG or WebP), up to 3.' };
async function shrinkShot(file) { // phone screenshots are large: send at most 1600 px, as JPEG
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82)); URL.revokeObjectURL(img.src);
  const data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
  return { name: file.name, type: 'image/jpeg', data, url: URL.createObjectURL(blob) };
}
function clientReportForm(data) {
  const saved = Object.assign({}, data.me || {}, (() => { try { return JSON.parse(localStorage.getItem('baton.clientme') || '{}') || {}; } catch { return {}; } })());
  let sev = 'normal'; const shots = [];
  const err = h('p', { class: 'cp-err', role: 'alert', hidden: true });
  const fld = (label, hint, input) => h('label', { class: 'field' }, label, hint ? h('span', { class: 'h', text: hint }) : null, input);
  const title = h('input', { type: 'text', maxlength: '200', dir: 'auto', autocomplete: 'off', placeholder: 'e.g. The payment page shows an error' });
  const details = h('textarea', { rows: '4', maxlength: '4000', dir: 'auto', placeholder: 'What did you do, what did you expect, and what happened instead?' });
  const name = h('input', { type: 'text', maxlength: '80', dir: 'auto', autocomplete: 'name', value: saved.name || '', placeholder: 'e.g. Mona Adel' });
  const phone = h('input', { type: 'tel', maxlength: '24', dir: 'ltr', autocomplete: 'tel', inputmode: 'tel', value: saved.phone || '', placeholder: '+20 100 123 4567' });
  const email = h('input', { type: 'email', maxlength: '120', dir: 'ltr', autocomplete: 'email', value: saved.email || '', placeholder: 'name@company.com' });
  const SEV = [['stops', 'Stops our work'], ['big', 'Big problem'], ['normal', 'Normal'], ['small', 'Small']];
  const sevRow = h('div', { class: 'cp-sev', role: 'radiogroup', 'aria-label': 'How bad is it?' }, ...SEV.map(([k, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(k === sev), 'data-k': k,
    onclick: e => { sev = k; $$('button', sevRow).forEach(b => b.setAttribute('aria-checked', String(b === e.currentTarget))); } }, l)));
  const shotBox = h('div', { class: 'cp-shots' });
  const pick = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: async e => {
    const list = [...e.target.files]; e.target.value = '';
    for (const f of list) { if (shots.length >= 3) break; if (!/^image\//.test(f.type)) continue; try { shots.push(await shrinkShot(f)); } catch { /* not a readable picture */ } }
    drawShots();
  } });
  const addShot = h('button', { type: 'button', class: 'fchip', onclick: () => pick.click() }, icon('clip', 13), 'Add screenshot');
  function drawShots() {
    shotBox.replaceChildren(...shots.map((x, i) => h('div', { class: 'cp-shot' }, h('img', { src: x.url, alt: `Screenshot ${i + 1}` }),
      h('button', { type: 'button', class: 'x', 'aria-label': `Remove screenshot ${i + 1}`, onclick: () => { shots.splice(i, 1); drawShots(); } }, icon('x', 14)))));
    addShot.hidden = shots.length >= 3;
  }
  const send = h('button', { type: 'submit', class: 'btn pri' }, 'Send to the team');
  const close = () => { clientPage.form = null; sh.remove(); clientPage(); };
  const form = h('form', { class: 'cp-form', novalidate: true, onsubmit: async e => {
    e.preventDefault(); err.hidden = true;
    const bad = (m, el) => { err.textContent = m; err.hidden = false; el?.focus(); };
    if (title.value.trim().length < 3) return bad(CR_ERR.title, title);
    if (name.value.trim().length < 2) return bad(CR_ERR.name, name);
    if (!/^\+?[0-9]{8,15}$/.test(phone.value.replace(/[^0-9+]/g, ''))) return bad(CR_ERR.phone, phone);
    if (email.value.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) return bad(CR_ERR.email, email);
    const done = busy(send, 'Sending…');
    let res; try { res = await sb.functions.invoke('client-report', { body: { tok: clientTok || personTok, title: title.value, details: details.value, severity: sev, name: name.value, phone: phone.value, email: email.value, files: shots.map(x => ({ name: x.name, type: x.type, data: x.data })) } }); }
    catch (x) { res = { error: x }; }
    done();
    const out = res?.data;
    if (res?.error || !out) return bad('Couldn’t send it. Check your connection and try again.');
    if (out.error) return bad(CR_ERR[out.error] || 'Couldn’t send it. Try again.', { title, name, phone, email }[out.error]);
    try { localStorage.setItem('baton.clientme', JSON.stringify({ name: name.value.trim(), phone: phone.value.trim(), email: email.value.trim() })); } catch {}
    shots.forEach(x => URL.revokeObjectURL(x.url));
    body.replaceChildren(h('div', { class: 'cp-sent', role: 'status' }, h('span', { class: 'cp-ok', html: ICONS.check || '' }),
      h('h2', { text: 'Got it. The team has your report.' }),
      h('p', {}, 'Your reference is ', h('b', { class: 'notr', text: out.key }), '.'),
      h('p', { class: 'mute', text: 'We’ll tell you on WhatsApp when it’s fixed. You’ll also see it on this page, and it moves to Done when it’s fixed.' }),
      h('div', { class: 'cp-acts' }, h('button', { class: 'btn pri', onclick: close }, 'Back to the status page'),
        h('button', { class: 'btn', onclick: () => { clientPage.form = null; sh.remove(); clientReportForm(data); } }, 'Report another problem'))));
  } },
    fld('What’s wrong?', null, title), fld('Details', 'Optional. Steps, the page, the device, anything that helps.', details),
    h('div', { class: 'field' }, 'How bad is it?', sevRow),
    h('div', { class: 'field' }, 'Screenshots', h('span', { class: 'h', text: 'Optional. Up to 3 pictures.' }), shotBox, h('div', {}, addShot, pick)),
    h('div', { class: 'cp-two' }, fld('Your name', null, name), fld('WhatsApp number', 'We tell you here when it’s fixed.', phone)),
    fld('Email', 'Optional.', email), err,
    h('div', { class: 'cp-acts' }, send, h('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Cancel')));
  form.addEventListener('input', () => { err.hidden = true; });
  const body = h('div', { class: 'cp-body' }, h('div', { class: 'cp-title' }, h('h1', { text: 'Report a problem' })), h('p', { class: 'mute', text: `It goes straight to the ${data.workspace} team.` }), form);
  const box = h('div', { class: 'cp-in' }, h('header', { class: 'cp-head' }, h('div', { class: 'cp-brand', html: ICONS.wordmark }), h('span', { class: 'sm mute', dir: 'auto', text: data.client })), body);
  const sh = h('div', { class: 'cp cp-formpage' }, box);
  clientPage.form = sh; $('#app').replaceChildren(sh); window.scrollTo(0, 0); title.focus();
  document.title = 'Report a problem';
}

/* ── inside Ovrto: who reported it, and telling them on WhatsApp ── */
function waNumber(p) { // the client typed it: keep digits; an Egyptian 01xxxxxxxxx becomes 201xxxxxxxxx
  let d = String(p || '').replace(/[^0-9+]/g, ''); if (d.startsWith('+')) return d.slice(1); if (d.startsWith('00')) return d.slice(2);
  if (/^01[0-9]{9}$/.test(d)) return '2' + d; return d;
}
async function clientFixedWhatsApp(t) {
  const c = t.client_report; if (!c?.phone) return;
  let link = '';
  if (c.link) { const { data } = await sb.from('client_links').select('token,revoked').like('token', c.link + '%').limit(1); const l = data?.[0]; if (l && !l.revoked) link = clientUrl(l.token); }
  const fixed = catOf(t) === 'done'; const key = taskKey(t); const nm = String(c.name || '').split(' ')[0];
  const txt = isAr()
    ? (fixed ? `أهلًا ${nm}، المشكلة اللي بعتها (${key}: ${t.title}) اتحلت.` : `أهلًا ${nm}، وصلتنا المشكلة اللي بعتها (${key}: ${t.title}) وبنشتغل عليها.`) + (link ? `\nتقدر تتابع من هنا: ${link}` : '')
    : (fixed ? `Hi ${nm}, the problem you reported (${key}: ${t.title}) is fixed.` : `Hi ${nm}, we got the problem you reported (${key}: ${t.title}) and we’re working on it.`) + (link ? `\nYou can check it here: ${link}` : '');
  track('client_report_whatsapp');
  window.open(`https://wa.me/${waNumber(c.phone)}?text=` + encodeURIComponent(txt), '_blank', 'noopener');
}
function clientReportBlock(t) {
  const c = t.client_report; if (!c) return null;
  const fixed = catOf(t) === 'done';
  return h('div', { class: 'block cr-block' }, h('h4', {}, 'Reported by the client'),
    h('div', { class: 'cr-who' }, h('b', { dir: 'auto', text: c.name || 'Client' }), h('span', { class: 'sm mute', dir: 'auto', text: [c.client, c.at ? fmtDate(String(c.at).slice(0, 10)) : ''].filter(Boolean).join(' · ') })),
    h('div', { class: 'cr-contact sm' }, h('span', { dir: 'ltr', class: 'notr', text: c.phone || '' }), c.email ? h('a', { href: 'mailto:' + c.email, dir: 'ltr', class: 'notr', text: c.email }) : null),
    h('button', { class: 'btn sm' + (fixed ? ' pri' : ''), onclick: () => clientFixedWhatsApp(taskOf(t.id) || t) }, icon('whatsapp', 14), fixed ? `Tell ${String(c.name || 'the client').split(' ')[0]} it’s fixed` : `Message ${String(c.name || 'the client').split(' ')[0]} on WhatsApp`));
}
function clientWhatsApp(cf, o, l) {
  const tasks = S.tasks.filter(t => Array.isArray(t.fields?.[cf.id]) ? t.fields[cf.id].includes(o.id) : t.fields?.[cf.id] === o.id);
  const txt = `${clientSummary(tasks)}\n\nLive status any time: ${clientUrl(l.token)}`;
  track('client_link_shared');
  window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener');
}

/* ── Projects: one page per client or internal project, holding its work, bugs, notes and docs ──
   A project is 'client' (work we do for a customer) or 'internal' (something we build for ourselves).
   Everything here is derived from tasks that already exist, so nobody has to keep a second record up to date. */
const P_TABS0 = [['overview', 'Overview'], ['work', 'Work'], ['bugs', 'Bugs'], ['docs', 'Docs']];
const pTabs = () => canSeeProjMoney(S.projects.find(p => p.id === S.route.id)) ? [...P_TABS0, ['money', 'Money']] : P_TABS0;
const pTab = () => (S.route.v === 'project' && pTabs().some(t => t[0] === S.route.tab) ? S.route.tab : 'overview');
const pTasks = id => S.tasks.filter(t => t.project_id === id);
const pKind = p => (p?.kind === 'client' ? 'client' : 'internal');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function projectTabs() {
  const p = pjOf(S.route.id); const cur = pTab(); if (!p) return null;
  const nb = pTasks(p.id).filter(t => isBug(t) && !isClosed(t)).length; const nd = (p.docs || []).length;
  return h('nav', { class: 'ptabs', 'aria-label': 'Project sections' }, pTabs().map(([k, n]) =>
    h('button', { class: 'ptab', 'aria-current': cur === k ? 'page' : null, 'data-ptab': k, onclick: () => go({ v: 'project', id: p.id, tab: k }) }, n,
      k === 'bugs' && nb ? h('span', { class: 'ct', text: String(nb) }) : k === 'docs' && nd ? h('span', { class: 'ct', text: String(nd) }) : null)));
}

/* the list of all projects, clients first */
function viewProjects() {
  const tools = h('div', { class: 'tools' }, h('button', { class: 'btn pri' + (isPhone() ? ' icon' : ''), 'data-new-project': '1', 'aria-label': 'New project', title: 'New project', onclick: () => openNewProject() }, icon('plus', 16), isPhone() ? null : 'New project'));
  const head = pageHead('Projects', null, tools);
  const card = p => {
    const ts = pTasks(p.id); const left = ts.filter(t => !isClosed(t)).length; const bugs = ts.filter(t => isBug(t) && !isClosed(t)).length;
    return h('button', { class: 'pjcard', 'data-project': p.id, onclick: () => go({ v: 'project', id: p.id }) },
      h('span', { class: 'swatch', style: { background: p.color } }),
      h('span', { class: 'grow' }, h('b', { text: p.name }), h('span', { class: 'sm mute', text: [pDept(p) === 'hardware' ? 'Hardware' : null, plural(left, 'task') + ' left', bugs ? plural(bugs, 'open bug') : null].filter(Boolean).join(' · ') })),
      h('span', { class: 'go' }, icon('back', 16)));
  };
  const group = (title, hint, list) => h('section', { class: 'pjgroup' }, h('h2', { text: title }),
    list.length ? h('div', { class: 'pjlist' }, list.map(card)) : h('p', { class: 'note', text: hint }));
  const cl = S.projects.filter(p => pKind(p) === 'client'); const own = S.projects.filter(p => pKind(p) === 'internal');
  const loose = S.tasks.filter(t => !t.project_id && !isClosed(t)).length;
  const body = !S.projects.length
    ? emptyState('0 PROJECTS', 'Group your work by client or by project. Each one gets its own page.', { label: 'New project', fn: () => openNewProject() })
    : h('div', { class: 'pjpage' }, canSeeSomeMoney() && M.loaded !== S.ws.id ? (loadMoney().then(() => refresh()), null) : moneyTotals(), group('Clients', 'No clients yet.', cl), group('Our own projects', 'No internal projects yet.', own),
      loose ? h('p', { class: 'note' }, `${plural(loose, 'open task')} not in any project. `, h('button', { class: 'lnk', onclick: () => go({ v: 'all' }) }, 'See all tasks')) : null);
  return [head, h('div', { class: 'scroll' }, body)];
}
function openNewProject() {
  openSheet({ title: 'New project', kind: 'center', build: sh => {
    let kind = null; let dept = ['hardware', 'embedded', 'field', 'support', 'hwlead'].includes(myMember()?.department) ? 'hardware' : 'software';
    const name = h('input', { type: 'text', id: 'npName', placeholder: 'Name', 'aria-label': 'Project name', style: { width: '100%' } });
    const go_ = h('button', { class: 'btn pri', disabled: true }, 'Create');
    const opt = (k, t, s) => h('button', { class: 'kindopt', 'aria-pressed': 'false', 'data-kind': k, onclick: e => { kind = k; $$('.kindopt', sh).forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); name.placeholder = k === 'client' ? 'Client name, e.g. Palm Hills' : 'Project name, e.g. ERP Finance'; sync(); name.focus(); } }, h('b', { text: t }), h('span', { class: 'sm mute', text: s }));
    const sync = () => { go_.disabled = !kind || !name.value.trim(); };
    name.addEventListener('input', sync);
    name.addEventListener('keydown', e => { if (e.key === 'Enter' && !go_.disabled) go_.click(); });
    go_.addEventListener('click', async () => {
      const n = name.value.trim(); if (!n || !kind) return;
      const row = { id: uuid(), workspace_id: S.ws.id, name: n, color: kind === 'client' ? '#2A44B0' : '#0B6B70', kind, department: dept, about: '', docs: [], created_at: nowIso() };
      closeSheet(true);
      if (await cfgUpsert('projects', row, `${n} created`)) { track('project_new'); go({ v: 'project', id: row.id }); }
    });
    sh.append(h('div', { class: 'sbody' }, h('div', { class: 'field' }, 'Is this for a client, or our own?',
        h('div', { class: 'kindrow' }, opt('client', 'For a client', 'Work we do for a customer'), opt('internal', 'Our own', 'Something we build for us'))),
      h('div', { class: 'field' }, 'Software or hardware?', h('div', { class: 'seg', role: 'group', 'data-np-dept': '1' }, [['software', 'Software'], ['hardware', 'Hardware']].map(([v, l]) => h('button', { 'aria-pressed': String(dept === v), 'data-dept-v': v, onclick: e => { dept = v; $$('[data-dept-v]', sh).forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } }, l)))),
      h('label', { class: 'field' }, 'Name', name)),
      h('div', { class: 'sfoot' }, h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), go_));
  } });
}

/* one project */
function viewProject() {
  const p = pjOf(S.route.id);
  if (!p) return [pageHead('Project'), h('div', { class: 'scroll' }, emptyState('NOT FOUND', 'This project was deleted.', { label: 'All projects', fn: () => go({ v: 'projects' }) }))];
  const tab = pTab();
  if (tab === 'work') return [pageHead(p.name, null, h('div', { class: 'tools' }, h('button', { class: 'btn pri', onclick: () => openCreate({ preset: { project_id: p.id } }) }, icon('plus', 16), isPhone() ? 'Task' : 'New task')), projectTabs()), h('div', { class: 'scroll' }, h('div', { class: 'pjpage' }, projectWork(p)))];
  const tools = tab === 'money' ? null : h('div', { class: 'tools' },
    tab === 'bugs' ? h('button', { class: 'btn pri', onclick: () => openCreate({ type: 'bug', preset: { project_id: p.id } }) }, icon('plus', 16), 'Report bug')
      : tab === 'docs' ? h('button', { class: 'btn pri', 'data-new-doc': '1', onclick: () => openDoc(p) }, icon('plus', 16), 'New doc')
      : h('button', { class: 'btn icon ghost', 'aria-label': 'Project settings', title: 'Project settings', onclick: e => projectMenu(e.currentTarget, p) }, icon('more')));
  const head = pageHead(p.name, h('span', {}, pKind(p) === 'client' ? 'Client' : 'Our own project', pDept(p) === 'hardware' ? ' · Hardware' : ' · Software', p.about ? ' · ' + p.about : ''), tools, projectTabs());
  const body = tab === 'bugs' ? projectBugs(p) : tab === 'docs' ? projectDocs(p) : tab === 'money' ? projectMoney(p) : projectOverview(p);
  return [head, h('div', { class: 'scroll' }, h('div', { class: 'pjpage' }, body))];
}
/* "MG: Fix login" reads "Fix login" inside the MG project */
const shortTitle = (title, name) => { const pre = name.toLowerCase() + ':'; return title.toLowerCase().startsWith(pre) && title.length > pre.length + 1 ? title.slice(pre.length).trim() : title; };
/* the project's tasks as one simple list, grouped by where they are. Empty groups are hidden. */
function projectWork(p) {
  const ts = pTasks(p.id); const week2 = Date.now() - 14 * 864e5;
  const groups = [
    ['started', 'Being worked on'], ['review', 'Waiting for review'], ['unstarted', 'Next up'], ['backlog', 'Later'],
  ].map(([c, n]) => [n, ts.filter(t => catOf(t) === c).sort(SORTS.priority)]);
  const done = ts.filter(t => catOf(t) === 'done' && (!t.completed_at || new Date(t.completed_at) > week2)).sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
  if (!ts.filter(t => !isClosed(t)).length && !done.length) return emptyState('0 TASKS', 'No tasks in this project yet.', { label: 'New task', fn: () => openCreate({ preset: { project_id: p.id } }) });
  const today = new Date().toISOString().slice(0, 10);
  const row = t => { const who = prof(t.assignee_id); const late = t.due_date && t.due_date < today && !isClosed(t);
    return h('button', { class: 'pjrow pjtask', 'data-task': t.id, onclick: () => openTask(t.id) }, stIcon(stOf(t.status_id)),
      h('span', { class: 'grow' }, h('b', { text: shortTitle(t.title, p.name) }),
        h('span', { class: 'sm mute' }, [taskKey(t), isBug(t) ? 'Bug' : tyOf(t.type_id)?.name, t.due_date ? (late ? null : 'due ' + fmtDate(t.due_date)) : null].filter(Boolean).join(' · '), late ? h('span', { class: 'pjalert', text: ' · Late' }) : null),
        t.stopped?.text && !isClosed(t) ? h('span', { class: 'sm stopline', text: '↳ ' + t.stopped.text }) : null),
      who ? h('span', { class: 'pjwho' }, avatar(who, { size: 'xs' }), h('span', { class: 'sm', text: first(who) })) : h('span', { class: 'sm mute pjwho', text: 'Nobody' })); };
  const out = groups.filter(g => g[1].length).map(([n, l]) => h('section', {}, h('h2', {}, n, h('span', { class: 'ct', text: String(l.length) })), h('div', { class: 'pjlist' }, l.map(row))));
  if (done.length) { const box = h('div', { class: 'pjlist', hidden: true }, done.map(row));
    out.push(h('section', {}, h('h2', {}, h('button', { class: 'lnk', 'aria-expanded': 'false', onclick: e => { box.hidden = !box.hidden; e.currentTarget.setAttribute('aria-expanded', String(!box.hidden)); e.currentTarget.firstChild.textContent = box.hidden ? 'Show done' : 'Hide done'; } }, 'Show done', h('span', { class: 'ct', text: ' ' + done.length })), h('span', { class: 'sm mute', text: 'last 2 weeks' })), box)); }
  return out;
}
function projectMenu(a, p) {
  menu(a, [
    { label: pKind(p) === 'client' ? 'Change to our own project' : 'Change to a client', fn: () => cfgUpsert('projects', Object.assign({}, p, { kind: pKind(p) === 'client' ? 'internal' : 'client' }), 'Project type changed') },
    isAdmin() || canSeeMoney() ? { label: pDept(p) === 'hardware' ? 'Move to Software' : 'Move to Hardware', fn: () => cfgUpsert('projects', Object.assign({}, p, { department: pDept(p) === 'hardware' ? 'software' : 'hardware' }), pDept(p) === 'hardware' ? 'Moved to Software' : 'Moved to Hardware') } : null,
    { label: 'Rename or delete', icon: 'gear', fn: () => openSettings('items', 'projects') },
  ].filter(Boolean));
}
function projectOverview(p) {
  const ts = pTasks(p.id); const open = ts.filter(t => !isClosed(t)); const bugs = open.filter(isBug);
  const week = Date.now() - 7 * 864e5; const done = ts.filter(t => t.completed_at && new Date(t.completed_at) > week).length;
  const num = (n, l, tab) => h('button', { class: 'pjnum', onclick: () => go({ v: 'project', id: p.id, tab }) }, h('b', { text: String(n) }), h('span', { text: l }));
  // what needs someone now: bugs that came back, late work, things waiting for review, work nobody has
  const today = new Date().toISOString().slice(0, 10); const attn = [];
  for (const t of open) {
    if ((t.flags || []).includes('regression')) attn.push({ t, lvl: 'now', why: 'Came back after it was fixed' });
    else if (t.due_date && t.due_date < today) attn.push({ t, lvl: 'now', why: `Late · was due ${fmtDate(t.due_date)}` });
    else if (catOf(t) === 'review') attn.push({ t, lvl: 'soon', why: `Waiting for ${first(prof(reviewerOf(t))) || 'review'}` });
    else if (!t.assignee_id && catOf(t) !== 'backlog') attn.push({ t, lvl: 'soon', why: 'Nobody has it yet' });
    else { const w = waitsOf(t).find(w => Date.now() - new Date(w.at) > 2 * 864e5); if (w) attn.push({ t, lvl: 'soon', why: `Waiting on ${first(prof(w.user)) || 'someone'} for ${ago(w.at)}` }); }
  }
  attn.sort((a, b) => (a.lvl === 'now' ? 0 : 1) - (b.lvl === 'now' ? 0 : 1));
  const stops = open.filter(t => t.stopped?.text).sort((a, b) => (b.stopped.at || '').localeCompare(a.stopped.at || '')).slice(0, 6);
  const people = [...new Set(open.map(t => t.assignee_id).filter(Boolean))].map(prof).filter(Boolean);
  return [
    h('div', { class: 'pjnums' }, num(open.length, open.length === 1 ? 'task left' : 'tasks left', 'work'), num(bugs.length, bugs.length === 1 ? 'open bug' : 'open bugs', 'bugs'), num(done, 'done this week', 'work'), num((p.docs || []).length, (p.docs || []).length === 1 ? 'doc' : 'docs', 'docs')),
    h('section', {}, h('h2', { text: 'Needs attention' }),
      attn.length ? h('div', { class: 'pjlist' }, attn.slice(0, 8).map(a => h('button', { class: 'pjrow', onclick: () => openTask(a.t.id) },
        h('span', { class: 'lvl ' + a.lvl, text: a.lvl === 'now' ? 'Now' : 'Soon' }), h('span', { class: 'grow' }, h('b', { text: a.t.title }), h('span', { class: 'sm mute', text: `${taskKey(a.t)} · ${a.why}` })))))
        : h('p', { class: 'note', text: 'Nothing needs attention right now.' })),
    h('section', {}, h('h2', { text: 'Where people stopped' }),
      stops.length ? h('div', { class: 'pjlist' }, stops.map(t => h('button', { class: 'pjrow', onclick: () => openTask(t.id) }, avatar(prof(t.stopped.by), { size: 'xs' }),
        h('span', { class: 'grow' }, h('b', { text: t.title }), h('span', { class: 'sm', text: t.stopped.text }), h('span', { class: 'sm mute', text: `${first(prof(t.stopped.by)) || 'Someone'} · ${ago(t.stopped.at)} ago` })))))
        : h('p', { class: 'note', text: 'When someone writes where they stopped on a task, it shows here, so anyone can continue their work.' })),
    deploysBlock(p),
    people.length ? h('section', {}, h('h2', { text: 'Working on it' }), h('div', { class: 'pjpeople' }, people.map(m => h('span', { class: 'pjperson' }, avatar(m, { size: 'xs' }), h('span', { text: first(m) }), h('span', { class: 'sm mute', text: String(open.filter(t => t.assignee_id === m.id).length) }))))) : null,
  ];
}
function projectBugs(p) {
  const bugs = pTasks(p.id).filter(isBug); const open = bugs.filter(t => !isClosed(t)).sort(SORTS.priority); const fixed = bugs.filter(t => catOf(t) === 'done').sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
  const row = t => { const sim = isClosed(t) ? null : similarFixed(t)[0];
    return h('button', { class: 'pjrow', onclick: () => openTask(t.id) }, stIcon(stOf(t.status_id)),
      h('span', { class: 'grow' }, h('b', { text: t.title }), h('span', { class: 'sm mute', text: [taskKey(t), t.assignee_id ? first(prof(t.assignee_id)) : 'Nobody yet', stOf(t.status_id)?.name].join(' · ') }),
        (t.flags || []).includes('regression') ? h('span', { class: 'pjalert', text: 'Came back after it was fixed' }) : sim ? h('span', { class: 'pjalert', text: `Looks like ${taskKey(sim)}, fixed before` }) : null,
        catOf(t) === 'done' && t.root_cause ? h('span', { class: 'sm', text: 'Cause: ' + t.root_cause }) : null)); };
  // which causes keep producing bugs
  const causes = {}; for (const t of fixed) { const k = causeKind(t.root_cause); if (k) causes[k] = (causes[k] || 0) + 1; }
  const top = Object.entries(causes).sort((a, b) => b[1] - a[1]);
  if (!bugs.length) return emptyState('0 BUGS', 'No bugs reported on this project.', { label: 'Report bug', fn: () => openCreate({ type: 'bug', preset: { project_id: p.id } }) });
  return [
    h('section', {}, h('h2', {}, 'Open', h('span', { class: 'ct', text: String(open.length) })), open.length ? h('div', { class: 'pjlist' }, open.map(row)) : h('p', { class: 'note', text: 'No open bugs.' })),
    top.length ? h('section', {}, h('h2', { text: 'Where bugs come from' }), h('div', { class: 'pjcauses' }, top.map(([k, n]) => h('div', { class: 'pjcause' }, h('span', { text: k }), h('span', { class: 'bar' }, h('i', { style: { width: Math.round(100 * n / top[0][1]) + '%' } })), h('b', { text: String(n) }))))) : null,
    fixed.length ? h('section', {}, h('h2', {}, 'Fixed', h('span', { class: 'ct', text: String(fixed.length) })), h('div', { class: 'pjlist' }, fixed.slice(0, 30).map(row))) : null,
  ];
}

/* docs: short pages that live with the project (how to deploy, decisions, requirements). Each has an owner and shows its age, so stale pages are visible. */
const DOC_KINDS = ['Guide', 'Decision', 'Requirements', 'Notes'];
function projectDocs(p) {
  const docs = (p.docs || []).slice().sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
  if (!docs.length) return emptyState('0 DOCS', 'Write down what the next person will need: how to run it, decisions and why, requirements.', { label: 'New doc', fn: () => openDoc(p) });
  const old = d => Date.now() - new Date(d.updated_at || d.at) > 90 * 864e5;
  return h('div', { class: 'pjlist' }, docs.map(d => h('button', { class: 'pjrow', 'data-doc': d.id, onclick: () => openDoc(p, d) }, icon('folder', 16),
    h('span', { class: 'grow' }, h('b', { text: d.title }), h('span', { class: 'sm mute', text: [d.kind, first(prof(d.by)) || 'Someone', `updated ${ago(d.updated_at || d.at)} ago`].filter(Boolean).join(' · ') }),
      old(d) ? h('span', { class: 'pjalert soft', text: 'Not updated for 3 months. Check it is still true.' }) : null))));
}
function openDoc(p, d) {
  const isNew = !d; const can = isNew || d.by === uid() || isAdmin();
  openSheet({ title: isNew ? 'New doc' : d.title, kind: 'center', full: true, build: sh => {
    let kind = d?.kind || 'Guide'; let files = clone(d?.files || []);
    const title = h('input', { type: 'text', id: 'docTitle', value: d?.title || '', placeholder: 'Title, e.g. How to deploy', 'aria-label': 'Title', style: { width: '100%' }, disabled: !can });
    const body = autoGrow(h('textarea', { id: 'docBody', rows: '10', placeholder: 'Write it for someone who has never seen this project.', 'aria-label': 'Text', style: { width: '100%' }, disabled: !can }));
    body.value = d?.body || '';
    const kinds = h('div', { class: 'chips', role: 'group', 'aria-label': 'Kind' }, DOC_KINDS.map(k => h('button', { class: 'chipbtn', 'aria-pressed': String(k === kind), disabled: !can, onclick: e => { kind = k; $$('.chipbtn', kinds).forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } }, k)));
    const flist = h('div', { class: 'docfiles' });
    const drawFiles = () => { flist.replaceChildren(...files.map(f => { const a = h('a', { class: 'fchip', target: '_blank', rel: 'noopener' }, icon('clip', 13), f.name); signedFile(f.path).then(u => { if (u) a.href = u; });
      return h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '2px' } }, a, can ? h('button', { class: 'x', 'aria-label': 'Remove ' + f.name, onclick: () => { files = files.filter(x => x.path !== f.path); drawFiles(); } }, icon('x', 12)) : null); })); };
    const finp = h('input', { type: 'file', multiple: true, hidden: true, onchange: async e => { const l = [...e.target.files]; e.target.value = ''; const added = await uploadFiles(l, 'project-' + p.id); files.push(...added); drawFiles(); } });
    drawFiles();
    const save = h('button', { class: 'btn pri' }, isNew ? 'Save' : 'Save changes');
    save.addEventListener('click', async () => {
      const tt = title.value.trim(); if (!tt) { title.focus(); return toast('Give the doc a title'); }
      const cur = pjOf(p.id); const list = clone(cur.docs || []);
      const row = { id: d?.id || uuid(), title: tt, body: body.value.trim(), kind, files, by: d?.by || uid(), at: d?.at || nowIso(), updated_at: nowIso(), updated_by: uid() };
      const i = list.findIndex(x => x.id === row.id); if (i >= 0) list[i] = row; else list.push(row);
      closeSheet(true);
      if (await cfgUpsert('projects', Object.assign({}, cur, { docs: list }), 'Doc saved')) track('doc_save');
    });
    const del = !isNew && can ? h('button', { class: 'btn ghost danger', onclick: e => confirmIn(e.currentTarget.closest('.sheet') || sh, { text: `Delete “${d.title}”?`, yes: 'Delete', danger: true, onYes: async () => { const cur = pjOf(p.id); closeSheet(true); await cfgUpsert('projects', Object.assign({}, cur, { docs: (cur.docs || []).filter(x => x.id !== d.id) }), 'Doc deleted'); } }) }, 'Delete') : null;
    sh.append(h('div', { class: 'sbody' },
        !isNew ? h('p', { class: 'note', text: `By ${dname(prof(d.by)) || 'someone'} · updated ${ago(d.updated_at || d.at)} ago${d.updated_by && d.updated_by !== d.by ? ' by ' + first(prof(d.updated_by)) : ''}${can ? '' : ' · only the author or an admin can edit'}` }) : null,
        h('label', { class: 'field' }, 'Title', title), h('div', { class: 'field' }, 'Kind', kinds), h('label', { class: 'field' }, 'Text', body),
        h('div', { class: 'field' }, 'Files', flist, can ? h('div', {}, h('button', { class: 'fchip', onclick: () => finp.click() }, icon('clip', 13), 'Attach'), finp) : null)),
      h('div', { class: 'sfoot' }, del, h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, can ? 'Cancel' : 'Close'), can ? save : null));
    if (isNew) setTimeout(() => title.focus(), 80);
  } });
}
async function uploadFiles(list, folder) {
  const ok = [...list].filter(f => { if (f.size > TASK_FILE_MAX) { toast(`${f.name} is over 50 MB`); return false; } return true; });
  if (!ok.length) return [];
  toast(ok.length === 1 ? `Uploading ${ok[0].name}…` : `Uploading ${ok.length} files…`);
  const added = [];
  for (const f of ok) {
    const path = `${S.ws.id}/${uid()}/${folder}/${uuid()}-${f.name.replace(/[^\w.\-]+/g, '_').slice(-80)}`;
    const { error } = await sb.storage.from('chat').upload(path, f, { contentType: f.type || 'application/octet-stream' });
    if (error) { toast(`Couldn’t upload ${f.name}: ${errText(error)}`); continue; }
    added.push({ name: f.name, path, type: f.type || '', size: f.size, by: uid(), at: nowIso() });
  }
  return added;
}

/* ── "Where I stopped": one short note on a task in progress, so anyone can continue it ── */
function stoppedBlock(t) {
  const c = catOf(t); const s = t.stopped; const mine = t.assignee_id === uid() || t.turn_owner === uid() || isAdmin() || !t.assignee_id;
  if (c !== 'started' && c !== 'review' && !s?.text) return null;
  const ta = autoGrow(h('textarea', { id: 'stoppedNote', rows: '2', placeholder: 'What is done, what is next, and where the code is (branch or link).', 'aria-label': 'Where I stopped', style: { width: '100%' } }));
  ta.value = s?.text || '';
  const save = h('button', { class: 'btn sm', disabled: true }, 'Save');
  ta.addEventListener('input', () => { save.disabled = ta.value.trim() === (s?.text || ''); });
  save.addEventListener('click', async () => {
    const text = ta.value.trim();
    const ok = await patchTask(t.id, { stopped: text ? { text, by: uid(), at: nowIso() } : null }, { noUndo: true });
    if (ok) { track('stopped_note'); toast(text ? 'Saved. Anyone can now continue from here' : 'Note cleared'); }
  });
  return h('div', { class: 'block' }, h('h4', {}, 'Where I stopped', s?.text ? h('span', { class: 'prog', text: `${first(prof(s.by)) || 'Someone'} · ${ago(s.at)} ago` }) : null),
    mine && !reviewLocked(t) ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' } }, ta, save)
      : h('p', { class: 'sm', style: { margin: '0', whiteSpace: 'pre-wrap' }, text: s?.text || 'Nothing written yet.' }));
}

/* ── Bugs: say what caused it when it is fixed, and warn when a new one looks like an old one ── */
const CAUSES = ['Code mistake', 'Unclear requirement', 'Environment or config', 'Missing test', 'Data', 'Other'];
const causeKind = rc => (rc ? (CAUSES.find(c => rc.startsWith(c)) || 'Other') : null);
const STOP_WORDS = new Set('the a an of on in at to for and or is are was does do not no with from by when after before it this that page button shows show error doesn doesnt cant can t s'.split(' '));
const bugWords = s => [...new Set(String(s || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').split(' ').filter(w => w.length > 2 && !STOP_WORDS.has(w)))];
/* fixed bugs that look like this one: same project (or both without one) and enough shared words in the title */
function similarFixed(t) {
  const a = bugWords(t.title); if (a.length < 2) return [];
  return S.tasks.filter(o => o.id !== t.id && isBug(o) && catOf(o) === 'done' && (o.project_id || null) === (t.project_id || null)).map(o => {
    const b = bugWords(o.title); const shared = a.filter(w => b.includes(w)).length; return { o, shared, score: shared / Math.max(1, Math.min(a.length, b.length)) };
  }).filter(x => x.shared >= 2 && x.score >= 0.6).sort((x, y) => y.score - x.score).slice(0, 3).map(x => x.o);
}
function causeBlock(t) {
  if (!isBug(t)) return null;
  const sim = isClosed(t) ? [] : similarFixed(t); const out = [];
  if (sim.length) out.push(h('div', { class: 'simbug', role: 'note' }, h('b', { text: sim.length === 1 ? 'This looks like a bug we fixed before' : 'This looks like bugs we fixed before' }),
    sim.map(o => h('button', { class: 'simrow', onclick: () => openTask(o.id) }, h('span', { class: 'grow' }, h('span', { text: `${taskKey(o)} · ${o.title}` }),
      h('span', { class: 'sm mute', text: [o.completed_at ? 'fixed ' + fmtDate(o.completed_at.slice(0, 10)) : null, o.root_cause ? 'Cause: ' + o.root_cause : 'No cause was written'].filter(Boolean).join(' · ') })))),
    !(t.flags || []).includes('regression') && !reviewLocked(t) ? h('button', { class: 'btn sm', onclick: () => patchTask(t.id, { flags: [...(t.flags || []), 'regression'] }, { toast: 'Marked as a bug that came back' }) }, 'Yes, it came back') : null));
  if (t.root_cause || catOf(t) === 'done') out.push(h('div', { class: 'block' }, h('h4', {}, 'Cause'),
    h('p', { class: 'sm', style: { margin: '0 0 8px', whiteSpace: 'pre-wrap' }, text: t.root_cause || 'Not written.' }),
    canMoveStatus(t) && !reviewLocked(t) ? h('button', { class: 'btn sm', onclick: () => askCause(t) }, t.root_cause ? 'Edit' : 'Add the cause') : null));
  return out.length ? h('div', {}, out) : null;
}
/* asked once, when a bug is closed: what caused it and how we stop it coming back. `then` runs after it is saved. */
function askCause(t, then) {
  openSheet({ title: `What caused ${taskKey(t)}?`, kind: 'center', stack: !!currentSheet(), build: sh => {
    let kind = causeKind(t.root_cause); const rest = t.root_cause && kind && t.root_cause.startsWith(kind) ? t.root_cause.slice(kind.length).replace(/^[:\s]+/, '') : (t.root_cause || '');
    const ta = autoGrow(h('textarea', { id: 'causeNote', rows: '3', placeholder: 'What was wrong, and what stops it coming back?', style: { width: '100%' } })); ta.value = rest;
    const go_ = h('button', { class: 'btn pri', disabled: !kind }, then ? 'Save and close the bug' : 'Save');
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Cause' }, CAUSES.map(c => h('button', { class: 'chipbtn', 'aria-pressed': String(c === kind), onclick: e => { kind = c; $$('.chipbtn', chips).forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); go_.disabled = false; } }, c)));
    go_.addEventListener('click', async () => {
      const text = kind + (ta.value.trim() ? ': ' + ta.value.trim() : ''); closeSheet(true);
      const ok = await patchTask(t.id, { root_cause: text }, { noUndo: true });
      if (ok) { track('bug_cause'); if (then) then(); else toast('Cause saved'); }
    });
    sh.append(h('div', { class: 'sbody' }, h('p', { class: 'note', text: 'One line is enough. It shows up if this bug ever comes back.' }), h('div', { class: 'field' }, 'Cause', chips), h('label', { class: 'field' }, 'Details (optional)', ta)),
      h('div', { class: 'sfoot' }, then ? h('button', { class: 'btn ghost', onclick: () => { closeSheet(true); then(); } }, 'Skip') : null, h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), go_));
  } });
}
/* true when it opened the cause sheet instead of closing the bug right away */
function causeFirst(t, then) { if (!isBug(t) || t.root_cause) return false; askCause(t, then); return true; }


/* ── the client's side of the chat (person links only): one conversation with the team, kept in Ovrto's Chat ── */
var CC = { el: null, list: null, msgs: [], timer: null, sending: false };
const CC_ERR = { busy: 'You sent a lot of messages in a short time. Wait a few minutes, then try again.', files: 'Send pictures (JPG, PNG or WebP) or voice notes, up to 3 at a time.', link: 'This link isn’t active any more. Ask your contact for a new link.', empty: 'Write a message first.' };
function clientChatBox(data) {
  if (!CC.el) {
    CC.msgs = data.messages || [];
    CC.list = h('div', { class: 'cc-list', role: 'log', 'aria-live': 'polite', 'aria-label': 'Messages' });
    const ta = h('textarea', { class: 'cc-in', rows: '1', dir: 'auto', maxlength: '4000', 'aria-label': 'Message', placeholder: 'Write a message…' });
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; err.hidden = true; });
    const err = h('p', { class: 'cp-err', role: 'alert', hidden: true });
    const pending = []; const chips = h('div', { class: 'cp-shots' });
    const drawPending = () => chips.replaceChildren(...pending.map((x, i) => h('div', { class: 'cp-shot' + (x.audio ? ' voice' : '') }, x.audio ? h('span', { class: 'cc-vchip' }, icon('mic', 16), h('span', { text: mmss(x.seconds || 0) })) : h('img', { src: x.url, alt: `Photo ${i + 1}` }),
      h('button', { type: 'button', class: 'x', 'aria-label': `Remove attachment ${i + 1}`, onclick: () => { pending.splice(i, 1); drawPending(); } }, icon('x', 14)))));
    const pick = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: async e => {
      const l = [...e.target.files]; e.target.value = '';
      for (const f of l) { if (pending.length >= 3) break; if (!/^image\//.test(f.type)) continue; try { pending.push(await shrinkShot(f)); } catch {} }
      drawPending();
    } });
    const send = h('button', { type: 'button', class: 'btn pri cc-send', 'aria-label': 'Send' }, icon('send', 18));
    const doSend = async extra => {
      if (CC.sending) return;
      const body = ta.value.trim(); const files = extra || pending.slice();
      if (!body && !files.length) { ta.focus(); return; }
      CC.sending = true; const done = busy(send, '');
      let res; try { res = await sb.functions.invoke('client-portal', { body: { ptok: personTok, op: 'send', body: extra ? '' : body, files: files.map(x => ({ type: x.type, data: x.data, seconds: x.seconds || null })) } }); } catch (x) { res = { error: x }; }
      done(); CC.sending = false;
      const out = res?.data;
      if (res?.error || !out || out.error) { err.textContent = CC_ERR[out?.error] || 'Couldn’t send it. Check your connection and try again.'; err.hidden = false; return; }
      if (!extra) { ta.value = ''; ta.style.height = 'auto'; pending.splice(0); drawPending(); }
      clientChatPoll();
    };
    send.addEventListener('click', () => doSend());
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(hover: none)').matches) { e.preventDefault(); doSend(); } });
    const mic = h('button', { type: 'button', class: 'x', 'aria-label': 'Record a voice note', title: 'Record a voice note', onclick: async () => {
      const v = await recordVoice('Voice note'); if (!v) return;
      const type = (v.blob.type || 'audio/wav').split(';')[0];
      const data64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(v.blob); });
      doSend([{ type, data: data64, seconds: v.seconds, audio: true }]);
    } }, icon('mic', 18));
    const clip = h('button', { type: 'button', class: 'x', 'aria-label': 'Add a photo', title: 'Add a photo', onclick: () => pick.click() }, icon('clip', 18));
    CC.el = h('section', { class: 'cp-g cc' }, h('h2', { text: 'Chat with the team' }),
      h('p', { class: 'sm mute', text: `Messages go to the ${data.workspace} team. They answer here.` }),
      clientAlertsRow(), CC.list, err, chips, h('div', { class: 'cc-row' }, clip, mic, pick, ta, send));
    drawClientChat(true);
    clearInterval(CC.timer); CC.timer = setInterval(() => { if (document.visibilityState === 'visible') clientChatPoll(); }, 6000);
  }
  return CC.el;
}
function drawClientChat(scroll) {
  if (!CC.list) return;
  const near = CC.list.scrollHeight - CC.list.scrollTop - CC.list.clientHeight < 80;
  let lastDay = '';
  CC.list.replaceChildren(...(CC.msgs.length ? [] : [h('p', { class: 'cc-empty mute', text: 'No messages yet. Say hello, ask a question, or send a photo.' })]),
    ...CC.msgs.flatMap(m => {
      const d = (m.at || '').slice(0, 10); const sep = d !== lastDay ? (lastDay = d, h('div', { class: 'cc-day', text: fmtDate(d) })) : null;
      const files = (m.files || []).map(f => /^audio\//.test(f.type) ? h('audio', { controls: true, preload: 'none', src: f.url, 'aria-label': 'Voice note' })
        : /^image\//.test(f.type) ? h('a', { class: 'cc-img', href: f.url, target: '_blank', rel: 'noopener' }, h('img', { src: f.url, alt: f.name, loading: 'lazy' }))
        : h('a', { href: f.url, target: '_blank', rel: 'noopener', text: f.name }));
      return [sep, h('div', { class: 'cc-msg ' + m.who }, m.who === 'me' ? null : h('b', { class: 'cc-who', dir: 'auto', text: m.who === 'team' ? `${m.name} · ${clientPage.ws || 'team'}` : m.name }),
        m.body ? h('div', { class: 'cc-body', dir: 'auto', text: m.body }) : null, ...files, h('span', { class: 'cc-time', text: clock(m.at) }))].filter(Boolean);
    }));
  if (scroll || near) CC.list.scrollTop = CC.list.scrollHeight;
}
async function clientChatPoll() {
  if (!personTok || !CC.list) return;
  const since = CC.msgs.length ? CC.msgs[CC.msgs.length - 1].at : null;
  let res; try { res = await sb.functions.invoke('client-portal', { body: { ptok: personTok, since } }); } catch { return; }
  const add = (res?.data?.messages || []).filter(m => !CC.msgs.some(x => x.id === m.id));
  if (add.length) { CC.msgs.push(...add); drawClientChat(false); }
}

/* ── alerts on the client's phone when the team answers ── */
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function clientAlertsRow() {
  const box = h('div', { class: 'cc-alerts' });
  const draw = async () => {
    const can = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && CFG.vapid && !String(CFG.vapid).startsWith('{{');
    if (isIOS() && !isStandalone()) {
      box.replaceChildren(icon('bell', 16), h('span', { class: 'sm', text: 'To get alerts when the team answers: tap Share, then Add to Home Screen. Open it from your Home Screen and turn on alerts.' })); return;
    }
    if (!can) { box.replaceChildren(); box.hidden = true; return; }
    let on = false; try { const reg = await navigator.serviceWorker.ready; on = Notification.permission === 'granted' && !!(await reg.pushManager.getSubscription()); } catch {}
    if (on) { box.replaceChildren(icon('bell', 16), h('span', { class: 'sm', text: 'Alerts are on. You’ll get a message here when the team answers.' })); return; }
    if (Notification.permission === 'denied') { box.replaceChildren(icon('bell', 16), h('span', { class: 'sm', text: 'Alerts are blocked in this browser’s settings. Allow notifications for this page to get them.' })); return; }
    const btn = h('button', { class: 'btn sm pri', onclick: async () => {
      const done = busy(btn, 'Turning on…');
      try {
        if ((await Notification.requestPermission()) !== 'granted') { done(); return draw(); }
        const reg = await navigator.serviceWorker.ready;
        const key = Uint8Array.from(atob(CFG.vapid.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - CFG.vapid.length % 4) % 4)), c => c.charCodeAt(0));
        const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
        const j = sub.toJSON();
        const { data, error } = await sb.functions.invoke('client-portal', { body: { ptok: personTok, op: 'push', sub: { endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth } } });
        done(); if (error || data?.error) throw new Error('save');
        draw();
      } catch (e) { done(); box.append(h('span', { class: 'sm cp-err', text: ' Couldn’t turn on alerts. Try again.' })); }
    } }, icon('bell', 14), 'Turn on alerts');
    box.replaceChildren(h('span', { class: 'sm', text: 'Get an alert on this phone when the team answers.' }), btn);
  };
  draw();
  return box;
}
