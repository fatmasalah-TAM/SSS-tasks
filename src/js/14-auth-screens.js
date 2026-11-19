/* ═════════════ auth screens ═════════════ */
/* the logo in the middle, in motion: plays the first time the sign-in screen shows, then stays still */
let introPlayed = false;
function authArt() {
  const play = !introPlayed; introPlayed = true; const name = appNameSaved();
  const logo = name === CFG.brand ? h('div', { class: 'intro-wm', html: ICONS.wordmarkAnim })
    : h('div', { class: 'intro-custom' }, h('div', { class: 'intro-mark', html: ICONS.markAnim }), h('b', { class: 'intro-name', text: name }));
  return h('div', { class: 'art' + (play ? ' play' : '') }, logo, h('div', { class: 'intro-tag', text: 'Over to you.' }));
}
/* the opening screen (signed-in launches only) stays until its motion has played, then fades into the app */
function splashOut(now) {
  const sp = document.getElementById('splash'); if (!sp || sp.dataset.out) return; sp.dataset.out = '1';
  const wait = now ? 0 : Math.max(0, 1700 - (performance.now() - Number(sp.dataset.at || 0)));
  setTimeout(() => { sp.classList.add('out'); setTimeout(() => sp.remove(), 400); }, wait);
}
const bootLoader = () => `<div class="boot" role="status"><div class="boot-mark loop">${ICONS.markAnim}</div><div class="boot-cap">Loading your tasks…</div></div>`;
const appNameSaved = () => store.get('appName', CFG.brand);
var signupOpen = null; // can new teams create an account? (asked once, the sign-in screen updates when it knows)
function authScreen(mode = 'in', msg) {
  const params = new URLSearchParams(location.search); const invEmail = params.get('invite'); const invName = params.get('name');
  if (invEmail && mode === 'in' && !msg) mode = 'up';
  if (params.has('start')) { if (mode === 'in' && !msg) mode = 'up'; params.delete('start'); history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash); } // "Start free" on the website, once
  if (signupOpen === null) { signupOpen = false; sb.rpc('signup_is_open').then(r => { signupOpen = !!r.data; if (signupOpen && $('.auth form') && ![...$$('.auth form input')].some(i => i.value && i.defaultValue !== i.value)) authScreen(mode, msg); }).catch(() => {}); }
  const newTeam = mode === 'up' && !invEmail && signupOpen;
  const name = h('input', { type: 'text', id: 'name', autocomplete: 'name', required: true, placeholder: 'Your full name', value: invName || '' });
  const email = h('input', { type: 'email', id: 'email', autocomplete: 'email', required: true, placeholder: 'you@company.com', value: invEmail || '' });
  const pw = h('input', { type: 'password', id: 'password', minlength: '6', required: true, autocomplete: mode === 'up' ? 'new-password' : 'current-password', placeholder: mode === 'up' ? 'Choose a password (8+ characters)' : 'Password' });
  const err = h('div', { class: 'err', hidden: true }); const info = h('div', { class: 'info', hidden: !msg, text: msg || '' });
  const btn = h('button', { class: 'btn pri lg wide', type: 'submit' }, mode === 'in' ? 'Sign in' : mode === 'up' ? (invEmail ? 'Join the team' : 'Create my account') : 'Send reset link');
  const form = h('form', { novalidate: true },
    h('h1', { text: mode === 'in' ? 'Sign in' : mode === 'up' ? (invEmail ? 'Welcome to the team' : newTeam ? 'Start free' : 'Create your account') : 'Reset password' }),
    h('p', { class: 'sub', text: mode === 'in' ? 'Sign in to see whose turn it is.' : mode === 'up' ? (invEmail ? 'Your name and email are filled in. Just set a password.' : newTeam ? 'Free while Ovrto is in early access. You’ll name your team next.' : 'Use the email your admin invited.') : 'We’ll email you a link to set a new password.' }),
    mode === 'up' ? h('label', { class: 'field' }, 'Name', name) : null,
    h('label', { class: 'field' }, 'Email', email),
    mode !== 'reset' ? h('label', { class: 'field' }, 'Password', pwEye(pw)) : null,
    err, info, btn,
    h('div', { class: 'links' },
      mode !== 'in' ? h('button', { type: 'button', class: 'link', onclick: () => authScreen('in') }, 'I already have an account') : h('button', { type: 'button', class: 'link', onclick: () => authScreen('up') }, signupOpen ? 'New to Ovrto? Start free' : 'First time here? Create an account'),
      mode === 'in' ? h('button', { type: 'button', class: 'link', onclick: () => authScreen('reset') }, 'Forgot password') : null,
      h('button', { type: 'button', class: 'link notr', lang: isAr() ? 'en' : 'ar', onclick: () => setLang(isAr() ? 'en' : 'ar') }, isAr() ? 'English' : 'العربية')));
  form.addEventListener('submit', async e => {
    e.preventDefault(); err.hidden = true; info.hidden = true;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.value.trim())) { err.textContent = 'Enter a full email address.'; err.hidden = false; return email.focus(); }
    if (mode !== 'reset' && pw.value.length < (mode === 'up' ? 8 : 6)) { err.textContent = mode === 'up' ? 'Choose a password with at least 8 characters.' : 'Passwords need at least 6 characters.'; err.hidden = false; return pw.focus(); }
    if (mode === 'up' && !name.value.trim()) { err.textContent = 'Add your name so teammates know who you are.'; err.hidden = false; return name.focus(); }
    const done = busy(btn, 'One moment…');
    try {
      const redirect = location.origin + location.pathname;
      if (mode === 'in') { const { error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pw.value }); if (error) throw error; }
      else if (mode === 'up') {
        const { data, error } = await sb.auth.signUp({ email: email.value.trim(), password: pw.value, options: { data: { full_name: name.value.trim() }, emailRedirectTo: redirect } }); if (error) throw error;
        store.set('newcomer', true);
        if (!data.session) { history.replaceState(null, '', location.pathname); return authScreen('in', 'Account created. Check your email for a confirmation link, then sign in.'); }
      } else { const { error } = await sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: redirect }); if (error) throw error; info.textContent = 'If this email has an account, a reset link is on its way.'; info.hidden = false; }
    } catch (x) { err.textContent = errText(x); err.hidden = false; }
    done();
  });
  $('#app').replaceChildren(h('div', { class: 'auth' }, authArt(), h('div', { class: 'form' }, form))); splashOut(true);
  setTimeout(() => (mode === 'up' ? (invName ? pw : name) : email).focus(), 50);
  document.title = appNameSaved();
}
/* ── a new person with no team yet: name the team, pick how it works, go ── */
var TEAM_TEMPLATES = [
  { k: 'blank', n: 'Software team', d: 'Features, bugs and improvements, with review before done.' },
  { k: 'agency', n: 'Agency or creative team', d: 'Client requests, revisions and content, by client and channel.' },
  { k: 'general', n: 'Any team', d: 'Simple tasks and follow-ups. Add what you need later.' },
];
async function setupTeamScreen() {
  splashOut(true);
  let can = false; try { const r = await sb.rpc('signup_is_open'); can = !!r.data; } catch {}
  const wrap = f => $('#app').replaceChildren(h('div', { class: 'auth' }, authArt(), h('div', { class: 'form setup' }, f)));
  if (!can) {
    return wrap(h('form', { onsubmit: e => e.preventDefault() }, h('h1', { text: 'No workspace yet' }), h('p', { class: 'sub', text: 'Ask your admin to invite this email.' }),
      h('button', { class: 'btn lg wide', type: 'button', onclick: () => signOut() }, 'Sign out')));
  }
  let tpl = 'blank';
  const name = h('input', { type: 'text', id: 'teamName', maxlength: '60', placeholder: 'e.g. Bright Studio', autocomplete: 'organization' });
  const err = h('div', { class: 'err', hidden: true });
  const go_ = h('button', { class: 'btn pri lg wide', type: 'submit' }, 'Create my team');
  const cards = h('div', { class: 'tpl-list', role: 'radiogroup', 'aria-label': 'How does your team work?' });
  const drawCards = () => cards.replaceChildren(...TEAM_TEMPLATES.map(t => h('button', { type: 'button', class: 'tpl', role: 'radio', 'aria-checked': String(tpl === t.k), 'data-tpl': t.k, onclick: () => { tpl = t.k; drawCards(); } },
    h('b', { text: t.n }), h('span', { text: t.d }))));
  drawCards();
  const f = h('form', { novalidate: true },
    h('h1', { text: 'Set up your team' }), h('p', { class: 'sub', text: 'Two quick choices and you’re in.' }),
    h('label', { class: 'field' }, 'Team or company name', name),
    h('div', { class: 'field' }, 'How does your team work?', cards),
    err, go_,
    h('div', { class: 'links' }, h('button', { type: 'button', class: 'link', onclick: () => signOut() }, 'Sign out')));
  f.addEventListener('submit', async e => {
    e.preventDefault(); err.hidden = true;
    const n = name.value.trim(); if (!n) { err.textContent = 'Give your team a name.'; err.hidden = false; return name.focus(); }
    const prefix = (n.normalize('NFKD').replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase() || n.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'TSK').slice(0, 4).padEnd(2, 'X');
    const done = busy(go_, 'Creating…');
    const { data, error } = await sb.rpc('create_workspace', { ws_name: n, ws_prefix: prefix, preset: tpl });
    done(); if (error) { err.textContent = errText(error); err.hidden = false; return; }
    store.set('newcomer', false); store.set('teamJustMade', true);
    await loadWorkspaces(); S.prefs.last_workspace = data; await boot2(data);
  });
  wrap(f); setTimeout(() => name.focus(), 60);
  document.title = appNameSaved();
}
async function boot2(wsId) { booting = false; savePrefs({ last_workspace: wsId }); await boot(); }
function recoveryScreen() {
  const pw = h('input', { type: 'password', id: 'recoverPw', minlength: '8', required: true, autocomplete: 'new-password' }); const err = h('div', { class: 'err', hidden: true });
  const f = h('form', {}, h('h1', { text: 'Set a new password' }), h('label', { class: 'field' }, 'New password', pwEye(pw)), err, h('button', { class: 'btn pri lg wide' }, 'Save password'));
  f.addEventListener('submit', async e => { e.preventDefault(); if (pw.value.length < 8) { err.textContent = 'Choose a password with at least 8 characters.'; err.hidden = false; return pw.focus(); } const done = busy($('button', f), 'Saving…'); const { error } = await sb.auth.updateUser({ password: pw.value }); done(); if (error) { err.textContent = errText(error); err.hidden = false; } else { recovering = false; boot(); } });
  $('#app').replaceChildren(h('div', { class: 'auth' }, authArt(), h('div', { class: 'form' }, f))); splashOut(true);
}
function welcomeScreen() {
  const pick = th => { savePrefs({ theme: th }); };
  $('#app').replaceChildren(h('div', { class: 'auth' }, authArt(), h('div', { class: 'form' }, h('form', { onsubmit: e => { e.preventDefault(); store.del('newcomer'); history.replaceState(null, '', location.pathname); S.route = { v: 'myturn' }; render(); setupRealtime(); tours.onRoute(); } },
    h('h1', { text: `You’re in, ${first(me())}.` }), h('p', { class: 'sub', text: `You’re on the ${S.ws.name} team. Pick a look; you can change it later.` }),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Theme', style: { alignSelf: 'flex-start' } }, [['system', 'Match my phone'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String((S.prefs.theme || 'system') === v), onclick: e => { pick(v); $$('button', e.currentTarget.parentNode).forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } }, l))),
    h('button', { class: 'btn pri lg wide', type: 'submit' }, 'Show me my desk'))))); splashOut();
}
/** a password box with a show/hide button */
function pwEye(pw) {
  const eyeOpen = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1.8 10S5 4.5 10 4.5 18.2 10 18.2 10 15 15.5 10 15.5 1.8 10 1.8 10z"/><circle cx="10" cy="10" r="2.6"/></svg>';
  const eyeOff = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1.8 10S5 4.5 10 4.5 18.2 10 18.2 10 15 15.5 10 15.5 1.8 10 1.8 10z"/><circle cx="10" cy="10" r="2.6"/><path d="M3 17L17 3" stroke-linecap="round"/></svg>';
  const b = h('button', { type: 'button', class: 'pw-eye', 'aria-label': 'Show password', 'aria-pressed': 'false', html: eyeOpen });
  b.addEventListener('click', () => { const show = pw.type === 'password'; pw.type = show ? 'text' : 'password'; b.innerHTML = show ? eyeOff : eyeOpen; b.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); b.setAttribute('aria-pressed', String(show)); pw.focus(); });
  return h('span', { class: 'pw-wrap' }, pw, b);
}
async function signOut() { closeAllSheets(true); vaultLock(true); V.loaded = false; await Promise.race([disablePush(), new Promise(r => setTimeout(r, 2500))]);
  // changes saved while offline belong to this person: send them now if we can, never under the next account
  if (S.outbox.length && navigator.onLine) await Promise.race([flushOutbox(), new Promise(r => setTimeout(r, 3000))]);
  S.outbox = []; store.del('outbox'); stopRinging(); if (channel) { sb.removeChannel(channel); channel = null; } await sb.auth.signOut(); }

