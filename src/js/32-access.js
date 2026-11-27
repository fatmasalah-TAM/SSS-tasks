/* ═════════════ Passwords (the vault): shared logins, locked on each person's device ═════════════
   How it stays safe: each person makes a key pair the first time. The private half is locked with a passphrase only they
   know, in the browser, and the server only stores it locked. Every login gets its own random key; a copy of that key is
   locked for each person who may open it. So the database, Ovrto and anyone reading it see only scrambled text.
   Keepers (picked by admins) always get a copy, so a forgotten passphrase never loses a login. */
const V = { keys: {}, items: [], grants: [], loaded: false, priv: null, lockAt: 0, open: {} };
const VAULT_KINDS = ['Server', 'Database', 'Staging', 'Production', 'App Store', 'Google Play', 'Email', 'Domain & DNS', 'Dashboard', 'API key', 'Other'];
const VAULT_IDLE = 15 * 60000;
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = buf => { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const RSA = { name: 'RSA-OAEP', hash: 'SHA-256' };
async function passKey(pass, salt, iter) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function aesSeal(rawKey, obj) {
  const k = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']); const iv = crypto.getRandomValues(new Uint8Array(12));
  return { v: 1, iv: b64(iv), ct: b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(JSON.stringify(obj)))) };
}
async function aesOpen(rawKey, box) {
  const k = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
  return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, k, unb64(box.ct))));
}
async function wrapFor(rawKey, jwk) { const pub = await crypto.subtle.importKey('jwk', jwk, RSA, false, ['encrypt']); return b64(await crypto.subtle.encrypt(RSA, pub, rawKey)); }
const myKey = () => V.keys[uid()];
const vaultUnlocked = () => !!V.priv && Date.now() < V.lockAt;
function vaultTouch() { V.lockAt = Date.now() + VAULT_IDLE; }
function vaultLock(quiet) { V.priv = null; V.open = {}; V.lockAt = 0; if (!quiet) toast('Passwords locked'); if (S.route.v === 'vault') render(); }
setInterval(() => { if (V.priv && Date.now() >= V.lockAt) vaultLock(true); }, 30000);

async function loadVault() {
  if (!S.ws) return; const ws = S.ws.id;
  const [k, i, g] = await Promise.all([sb.from('vault_keys').select('*'), sb.from('vault_items').select('*').eq('workspace_id', ws), sb.from('vault_grants').select('*').eq('workspace_id', ws)]);
  if (S.ws?.id !== ws) return;
  V.unavailable = !!(k.error && /does not exist|schema cache|not find/i.test(k.error.message || ''));
  V.keys = {}; for (const r of k.data || []) V.keys[r.user_id] = r;
  V.items = (i.data || []).sort((a, b) => a.name.localeCompare(b.name)); V.grants = g.data || []; V.loaded = true;
  cleanExpiredGrants();
}
/* access given only until a date (leave cover) is taken away once the date has passed, by whichever side opens Ovrto first */
async function cleanExpiredGrants() {
  const today = todayIso();
  const old = V.grants.filter(g => g.until && g.until < today && (g.user_id === uid() || g.granted_by === uid()));
  for (const g of old) { const { error } = await sb.from('vault_grants').delete().eq('item_id', g.item_id).eq('user_id', g.user_id); if (!error) V.grants = V.grants.filter(x => x !== g); }
  if (old.length) { V.items = V.items.filter(i => V.grants.some(g => g.item_id === i.id && g.user_id === uid()) || i.created_by === uid()); refresh(); }
}
async function vaultSetup(pass, waiting = []) {
  const kp = await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
  const pub = await crypto.subtle.exportKey('jwk', kp.publicKey); const pk8 = await crypto.subtle.exportKey('pkcs8', kp.privateKey);
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12)); const iter = 310000;
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await passKey(pass, salt, iter), pk8);
  const row = { user_id: uid(), public_key: pub, enc_private: { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct), iter }, waiting, created_at: nowIso() };
  const { error } = await sb.from('vault_keys').upsert(row); if (error) throw error;
  V.keys[uid()] = row; V.priv = await crypto.subtle.importKey('pkcs8', pk8, RSA, false, ['decrypt']); vaultTouch(); track('vault_setup');
}
async function vaultUnlock(pass) {
  const k = myKey()?.enc_private; if (!k) return false;
  try {
    const pk8 = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(k.iv) }, await passKey(pass, unb64(k.salt), k.iter), unb64(k.ct));
    V.priv = await crypto.subtle.importKey('pkcs8', pk8, RSA, false, ['decrypt']); vaultTouch(); fillKeepers().then(returnWaiting).then(deliverPending).then(shareCoverPending).then(() => refresh()); return true;
  } catch { return false; }
}
async function itemRawKey(item) {
  const g = V.grants.find(x => x.item_id === item.id && x.user_id === uid()); if (!g || !V.priv) return null;
  vaultTouch(); return crypto.subtle.decrypt(RSA, V.priv, unb64(g.wrapped_key));
}
async function openItem(item) { if (V.open[item.id]) return V.open[item.id]; const raw = await itemRawKey(item); if (!raw) return null; return (V.open[item.id] = await aesOpen(raw, item.secret)); }
const keepers = () => (S.ws?.vault_keepers || []).filter(id => S.members.some(m => m.user_id === id));
const holders = item => V.grants.filter(g => g.item_id === item.id);
const canOpenItem = item => V.grants.some(g => g.item_id === item.id && g.user_id === uid());
/* give people a copy of an item's key. `until` makes it temporary. Returns the people who couldn't get it (no vault yet). */
async function shareItem(item, people, until) {
  const raw = await itemRawKey(item); if (!raw) return people;
  const missing = []; const rows = [];
  for (const p of people) {
    if (holders(item).some(g => g.user_id === p)) continue;
    const k = V.keys[p]; if (!k) { missing.push(p); continue; }
    rows.push({ item_id: item.id, user_id: p, workspace_id: S.ws.id, wrapped_key: await wrapFor(raw, k.public_key), granted_by: uid(), until: until || null });
  }
  if (rows.length) { const { error } = await sb.from('vault_grants').insert(rows); if (error) { toast(errText(error)); return people; } V.grants.push(...rows); }
  // people without access yet: remember them on the login, so it reaches them by itself once they set up
  const pend = Object.assign({}, item.pending || {}); let changed = false;
  for (const p of missing) if (!(p in pend)) { pend[p] = until || null; changed = true; }
  for (const r of rows) if (r.user_id in pend) { delete pend[r.user_id]; changed = true; }
  if (changed) { const { error } = await sb.from('vault_items').update({ pending: pend }).eq('id', item.id); if (!error) item.pending = pend; }
  return missing;
}
/* keepers who set up their vault after a login was saved get their copy the next time someone who holds it unlocks */
async function fillKeepers() {
  const ks = keepers().filter(k => V.keys[k]); if (!ks.length) return;
  for (const it of V.items) if (canOpenItem(it)) { const need = ks.filter(k => !holders(it).some(g => g.user_id === k)); if (need.length) await shareItem(it, need); }
}
async function unshare(item, person) {
  const { error } = await sb.from('vault_grants').delete().eq('item_id', item.id).eq('user_id', person);
  if (error) return toast(errText(error));
  V.grants = V.grants.filter(g => !(g.item_id === item.id && g.user_id === person)); if (person === uid()) V.items = V.items.filter(i => i.id !== item.id);
  toast('Login removed'); refresh();
}
function genPassword() { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_'; const r = crypto.getRandomValues(new Uint32Array(20)); return [...r].map(x => c[x % c.length]).join(''); }
const vaultKinds = () => [...new Set([...VAULT_KINDS, ...V.items.map(i => i.kind)])];
const hostOf = u => { try { return new URL(/^\w+:\/\//.test(u) ? u : 'https://' + u).host; } catch { return u; } };

/* ── the page ── */
let vaultQ = '', vaultKind = null;
function viewVault() {
  if (!V.loaded) { loadVault().then(() => render()); return [pageHead('Passwords'), h('div', { class: 'scroll' }, h('p', { class: 'note', style: { padding: '24px' }, text: 'Loading…' }))]; }
  if (V.unavailable) return [pageHead('Passwords'), h('div', { class: 'scroll' }, h('div', { class: 'pjpage' }, h('section', { class: 'vcard' }, icon('key', 28), h('h2', { text: 'Passwords are almost ready' }), h('p', { text: 'Its database part is waiting to be switched on. Check back soon.' }))))];
  const me_ = myKey(); const unlocked = vaultUnlocked();
  const extra = [unlocked ? { label: 'Lock now', icon: 'lock', fn: () => vaultLock() } : null, isAdmin() ? { label: 'Keepers…', icon: 'gear', fn: () => openKeepers() } : null].filter(Boolean);
  const tools = h('div', { class: 'tools' },
    isPhone() ? (extra.length ? h('button', { class: 'btn icon ghost', title: 'More', 'aria-label': 'More', onclick: e => menu(e.currentTarget, extra) }, icon('more')) : null) : [
      unlocked ? h('button', { class: 'btn icon ghost', title: 'Lock', 'aria-label': 'Lock', onclick: () => vaultLock() }, icon('lock')) : null,
      isAdmin() ? h('button', { class: 'btn icon ghost', title: 'Keepers', 'aria-label': 'Keepers', onclick: () => openKeepers() }, icon('gear')) : null],
    unlocked ? h('button', { class: 'btn pri' + (isPhone() ? ' icon' : ''), 'data-new-login': '1', 'aria-label': 'Add login', title: 'Add login', onclick: () => openLogin() }, icon('plus', 16), isPhone() ? null : 'Add login') : null);
  const head = pageHead('Passwords', h('span', { text: 'Logins for servers, stores and dashboards. Locked on your device.' }), tools);
  let body;
  if (!me_) body = vaultSetupCard();
  else if (!unlocked) body = vaultUnlockCard();
  else body = vaultList();
  return [head, h('div', { class: 'scroll' }, h('div', { class: 'pjpage' }, body))];
}
function passField(id, ph, auto) { return h('input', { type: 'password', id, placeholder: ph, autocomplete: auto, 'aria-label': ph, style: { width: '100%' } }); }
function vaultSetupCard() {
  const a = passField('vpass1', 'Make a passphrase', 'new-password'); const b = passField('vpass2', 'Type it again', 'new-password');
  const go_ = h('button', { class: 'btn pri' }, 'Set up');
  const ks = keepers().filter(k => k !== uid()).map(k => first(prof(k))).join(', ');
  go_.addEventListener('click', async () => {
    if (a.value.length < 8) return toast('Use at least 8 characters');
    if (a.value !== b.value) return toast('The two don’t match');
    go_.disabled = true; go_.textContent = 'Setting up…';
    try { await vaultSetup(a.value); toast('Passwords is set up'); render(); } catch (e) { toast(errText(e)); go_.disabled = false; go_.textContent = 'Set up'; }
  });
  return h('section', { class: 'vcard' }, icon('key', 28), h('h2', { text: 'Set up Passwords' }),
    h('p', { text: 'Pick a passphrase only you know. It unlocks the logins shared with you on this device. Ovrto never sees it.' }),
    h('p', { class: 'sm mute', text: ks ? `If you forget it, ${ks} can share your logins with you again.` : 'Write it down somewhere safe. If you forget it, someone who has the logins must share them with you again.' }),
    pwEye(a), pwEye(b), go_);
}
function vaultUnlockCard() {
  const a = passField('vpass', 'Your passphrase', 'current-password'); const go_ = h('button', { class: 'btn pri' }, 'Unlock');
  const run = async () => { go_.disabled = true; const ok = await vaultUnlock(a.value); go_.disabled = false; if (!ok) { a.value = ''; a.focus(); return toast('Wrong passphrase'); } render(); };
  go_.addEventListener('click', run); a.addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
  setTimeout(() => a.focus(), 60);
  return h('section', { class: 'vcard' }, icon('lock', 28), h('h2', { text: 'Unlock Passwords' }), h('p', { text: `${plural(V.items.length, 'login')} shared with you. It locks again after 15 minutes.` }),
    waitingPeople().length ? h('p', { class: 'sm pjalert', text: `${waitingPeople().map(p => first(prof(p))).join(', ')} made a new passphrase. Unlock to give their logins back.` }) : null,
    coverWaitText() ? h('p', { class: 'sm pjalert', text: coverWaitText() }) : null,
    !coverWaitText() && pendingWaitText() ? h('p', { class: 'sm pjalert', text: pendingWaitText() }) : null, pwEye(a), go_,
    h('button', { class: 'lnk sm', 'data-forgot': '1', onclick: () => openVaultForgot() }, 'Forgot your passphrase?'));
}
/* Nobody can email a passphrase back: Ovrto never had it. So "forgot" makes a new one, and the logins come back
   on their own: the person's key row lists what they lost, and the next keeper (or anyone holding those logins)
   who unlocks shares them again with the new key. An email tells them it happened. */
/* step 1: prove it's you. Ovrto emails a sign-in link; only the person who opens their own inbox can continue. */
function openVaultForgot() {
  const email = me()?.email || S.session?.user?.email || '';
  openSheet({ title: 'Forgot your passphrase', kind: 'center', build: sh => {
    const go_ = h('button', { class: 'btn pri', 'data-send-confirm': '1' }, 'Email me a link');
    const info = h('p', { class: 'sm mute', text: '' });
    go_.addEventListener('click', async () => {
      go_.disabled = true;
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname + '?vaultreset=1' } });
      if (error) { go_.disabled = false; return toast(errText(error)); }
      go_.textContent = 'Sent'; info.textContent = `Open the email we sent to ${email} and tap the link. It works for 20 minutes.`; track('vault_forgot');
    });
    sh.append(h('div', { class: 'sbody' },
      h('p', { text: 'First, let’s make sure it’s really you.' }),
      h('p', { class: 'sm mute', text: `We’ll email a link to ${email}. Open it on the device where you want to use Ovrto.` }), info),
      h('div', { class: 'sfoot' }, h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), go_));
  } });
}
/* the link brings them back signed in by email a moment ago: only then can they make a new passphrase */
function emailConfirmedRecently() {
  try { const p = JSON.parse(atob(S.session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return (p.amr || []).some(a => ['otp', 'magiclink', 'email/otp'].includes(a.method) && Date.now() / 1000 - a.timestamp < 20 * 60);
  } catch { return false; }
}
/* read when the page opens: the app tidies the address bar during start-up, before this check runs */
let vaultResetAsked = new URLSearchParams(location.search).has('vaultreset');
function checkVaultReset() {
  const u = new URL(location.href); if (!u.searchParams.has('vaultreset') && !vaultResetAsked) return;
  vaultResetAsked = false; u.searchParams.delete('vaultreset'); history.replaceState(history.state, '', u.pathname + (u.search || '') + u.hash);
  if (!emailConfirmedRecently()) return toast('That link has expired. Ask for a new one');
  go({ v: 'vault' }); loadVault().then(() => openVaultNewPass());
}
/* step 2 */
function openVaultNewPass() {
  const ks = keepers().filter(k => k !== uid()).map(k => first(prof(k)));
  openSheet({ title: 'Forgot your passphrase', kind: 'center', build: sh => {
    const a = passField('vfp1', 'New passphrase', 'new-password'), b = passField('vfp2', 'Type it again', 'new-password');
    const go_ = h('button', { class: 'btn pri' }, 'Make a new one');
    go_.addEventListener('click', async () => {
      if (a.value.length < 8) return toast('Use at least 8 characters'); if (a.value !== b.value) return toast('The two don’t match');
      go_.disabled = true; go_.textContent = 'Working…';
      try {
        const lost = V.grants.filter(g => g.user_id === uid()).map(g => g.item_id);
        if (lost.length) { const { error } = await sb.from('vault_grants').delete().eq('user_id', uid()).eq('workspace_id', S.ws.id); if (error) throw error; }
        V.grants = V.grants.filter(g => g.user_id !== uid()); V.items = V.items.filter(i => i.created_by === uid() && false);
        await vaultSetup(a.value, lost);
        closeSheet(true); toast(lost.length ? `New passphrase set. ${plural(lost.length, 'login')} will come back when someone who has them opens Passwords` : 'New passphrase set'); render();
      } catch (e) { go_.disabled = false; go_.textContent = 'Make a new one'; toast(errText(e)); }
    });
    sh.append(h('div', { class: 'sbody' },
      h('p', { text: 'Ovrto never knew your passphrase, so it can’t send it to you. Make a new one instead.' }),
      h('p', { class: 'sm mute', text: ks.length ? `Your logins will come back automatically the next time ${ks.join(' or ')} opens Passwords.` : 'Your logins will come back the next time someone who has them opens Passwords.' }),
      h('label', { class: 'field' }, 'New passphrase', pwEye(a)), h('label', { class: 'field' }, 'Type it again', pwEye(b))),
      h('div', { class: 'sfoot' }, h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), go_));
    setTimeout(() => a.focus(), 80);
  } });
}
/* give logins back to people who made a new passphrase; and clear my own waiting list once they're back */
async function returnWaiting() {
  for (const [id, k] of Object.entries(V.keys)) {
    const want = (k.waiting || []); if (!want.length) continue;
    if (id === uid()) { const left = want.filter(it => !V.grants.some(g => g.item_id === it && g.user_id === uid())); if (left.length !== want.length) { await sb.from('vault_keys').update({ waiting: left }).eq('user_id', uid()); k.waiting = left; } continue; }
    for (const it of want) { const item = V.items.find(i => i.id === it); if (item && canOpenItem(item) && !holders(item).some(g => g.user_id === id)) await shareItem(item, [id]); }
  }
}
/* logins promised to someone covering a leave who set up access later: shared by the next person holding them who unlocks */
const coverPending = () => (S.leaves || []).filter(l => leaveState(l) !== 'over' && l.cover_id && V.keys[l.cover_id] && (l.user_id === uid() || keepers().includes(uid())))
  .flatMap(l => (l.handover?.items || []).map(id => ({ l, item: V.items.find(i => i.id === id) })).filter(x => x.item && canOpenItem(x.item) && !holders(x.item).some(g => g.user_id === x.l.cover_id)));
/* before unlock we can't open items, but we can see the promise in the leave and whether the cover is ready */
function pendingWaitText() {
  const who = [...new Set(V.items.flatMap(i => Object.keys(i.pending || {}).filter(p => V.keys[p])))];
  return who.length ? `${who.map(p => first(prof(p))).join(', ')} set up Passwords and ${who.length === 1 ? 'is' : 'are'} waiting for logins. Unlock to send them.` : '';
}
function coverWaitText() {
  const ls = (S.leaves || []).filter(l => leaveState(l) !== 'over' && l.cover_id && V.keys[l.cover_id] && (l.user_id === uid() || keepers().includes(uid())) && (l.handover?.items || []).some(id => !V.grants.some(g => g.item_id === id && g.user_id === l.cover_id)));
  return ls.length ? `${ls.map(l => first(prof(l.cover_id))).join(', ')} is covering and waiting for logins. Unlock to share them.` : '';
}
/* hand logins to everyone who was promised one and has since set up access */
async function deliverPending() {
  for (const item of V.items) { const pend = item.pending || {}; const ready = Object.keys(pend).filter(p => V.keys[p] && canOpenItem(item) && !(pend[p] && pend[p] < todayIso()));
    for (const p of ready) await shareItem(item, [p], pend[p]); }
}
async function shareCoverPending() { for (const { l, item } of coverPending()) await shareItem(item, [l.cover_id], l.end_date); }
const waitingPeople = () => Object.entries(V.keys).filter(([id, k]) => id !== uid() && (k.waiting || []).some(it => V.grants.some(g => g.item_id === it && g.user_id === uid()) && !V.grants.some(g => g.item_id === it && g.user_id === id))).map(([id]) => id);
function vaultList() {
  const q = norm(vaultQ); const list = V.items.filter(i => canOpenItem(i) && (!vaultKind || i.kind === vaultKind) && (!q || norm(`${i.name} ${i.url} ${i.kind} ${pjOf(i.project_id)?.name || ''}`).includes(q)));
  const kinds = [...new Set(V.items.map(i => i.kind))];
  const search = h('input', { type: 'search', placeholder: 'Search logins…', value: vaultQ, 'aria-label': 'Search logins', style: { width: '100%' }, oninput: e => { vaultQ = e.target.value; const c = $('.vlist-wrap'); c?.replaceWith(vaultGroups(V.items.filter(i => canOpenItem(i) && (!vaultKind || i.kind === vaultKind) && (!norm(vaultQ) || norm(`${i.name} ${i.url} ${i.kind} ${pjOf(i.project_id)?.name || ''}`).includes(norm(vaultQ)))))); } });
  const chips = kinds.length > 1 ? h('div', { class: 'chips' }, [null, ...kinds].map(k => h('button', { class: 'chipbtn', 'aria-pressed': String(vaultKind === k), onclick: () => { vaultKind = k; render(); } }, k || 'All'))) : null;
  if (!V.items.length) return [emptyState('0 LOGINS', 'Save a login once, share it with the people who need it. No more passwords in WhatsApp.', { label: 'Add login', fn: () => openLogin() })];
  return [h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, search, chips), vaultGroups(list)];
}
function vaultGroups(list) {
  const by = new Map(); for (const i of list) { const k = i.project_id && pjOf(i.project_id) ? i.project_id : ''; if (!by.has(k)) by.set(k, []); by.get(k).push(i); }
  const keys = [...by.keys()].sort((a, b) => (a ? pjOf(a).name : '~').localeCompare(b ? pjOf(b).name : '~'));
  if (!list.length) return h('div', { class: 'vlist-wrap' }, h('p', { class: 'note', text: 'Nothing matches.' }));
  return h('div', { class: 'vlist-wrap' }, keys.map(k => h('section', {}, h('h2', {}, k ? pjOf(k).name : 'Not in a project', h('span', { class: 'ct', text: String(by.get(k).length) })),
    h('div', { class: 'pjlist' }, by.get(k).map(i => { const hs = holders(i); const tmp = hs.find(g => g.user_id === uid() && g.until);
      return h('button', { class: 'pjrow', 'data-login': i.id, onclick: () => openLoginView(i) }, h('span', { class: 'vkind', text: i.kind }),
        h('span', { class: 'grow' }, h('b', { text: i.name }), h('span', { class: 'sm mute', text: [i.url ? hostOf(i.url) : null, plural(hs.length, 'person', ) .replace('persons', 'people')].filter(Boolean).join(' · ') }),
          tmp ? h('span', { class: 'sm pjalert soft', text: `Yours until ${fmtDate(tmp.until)}` }) : null)); })))));
}
function openLoginView(item) {
  openSheet({ title: item.name, kind: 'right', full: isPhone(), key: 'login', build: async sh => {
    const body = h('div', { class: 'sbody' }, h('p', { class: 'note', text: 'Opening…' })); sh.append(body);
    let sec; try { sec = await openItem(item); } catch { sec = null; }
    if (!sec) { body.replaceChildren(h('p', { class: 'note', text: 'Couldn’t open this login. Ask someone who has it to share it with you again.' })); return; }
    const line = (label, val, secret) => { if (!val) return null; const v = h('span', { class: 'vval' + (secret ? ' hide' : ''), text: secret ? '••••••••••' : val });
      return h('div', { class: 'vline' }, h('span', { class: 'sm mute', text: label }), v, h('span', { class: 'vbtns' },
        secret ? h('button', { class: 'btn icon ghost sm', 'aria-label': 'Show', title: 'Show', onclick: e => { const on = v.classList.toggle('hide'); v.textContent = on ? '••••••••••' : val; vaultTouch(); } }, icon('eye', 16)) : null,
        h('button', { class: 'btn icon ghost sm', 'aria-label': 'Copy ' + label, title: 'Copy', onclick: () => { copyText(val, label + ' copied'); vaultTouch(); } }, icon('share', 16)))); };
    const hs = holders(item); const mineCreator = item.created_by === uid() || isAdmin();
    const waiting = Object.keys(item.pending || {}).filter(p => !hs.some(g => g.user_id === p));
    const people = h('div', { class: 'pjlist' }, ...waiting.map(p => h('div', { class: 'pjrow' }, avatar(prof(p), { size: 'xs' }), h('span', { class: 'grow' }, h('b', { text: dname(prof(p)) }), h('span', { class: 'sm mute', text: V.keys[p] ? 'Gets it next time someone who has it unlocks' : 'Gets it once they set up access' })),
      h('button', { class: 'btn sm ghost', onclick: async () => { const pend = Object.assign({}, item.pending); delete pend[p]; const { error } = await sb.from('vault_items').update({ pending: pend }).eq('id', item.id); if (error) return toast(errText(error)); item.pending = pend; closeSheet(true); openLoginView(item); } }, 'Cancel'))), hs.map(g => h('div', { class: 'pjrow' }, avatar(prof(g.user_id), { size: 'xs' }),
      h('span', { class: 'grow' }, h('b', { text: dname(prof(g.user_id)) || 'Someone' }), h('span', { class: 'sm mute', text: [keepers().includes(g.user_id) ? 'Keeper' : null, g.until ? 'until ' + fmtDate(g.until) : null, g.granted_by && g.granted_by !== g.user_id ? 'shared by ' + first(prof(g.granted_by)) : null].filter(Boolean).join(' · ') })),
      (g.user_id !== uid() && (mineCreator || g.granted_by === uid())) || g.user_id === uid() ? h('button', { class: 'btn sm ghost', onclick: () => { closeSheet(true); unshare(item, g.user_id); } }, g.user_id === uid() ? 'Leave' : 'Remove') : null)));
    body.replaceChildren(...[
      h('div', { class: 'vhead' }, h('span', { class: 'vkind', text: item.kind }), item.project_id ? h('span', { class: 'sm mute', text: pjOf(item.project_id)?.name || '' }) : null),
      item.url ? h('div', { class: 'vline' }, h('span', { class: 'sm mute', text: 'Link' }), h('a', { class: 'vval', href: /^\w+:\/\//.test(item.url) ? item.url : 'https://' + item.url, target: '_blank', rel: 'noopener', text: item.url })) : null,
      line('Username', sec.username), line('Password', sec.password, true), sec.notes ? h('div', { class: 'vline col' }, h('span', { class: 'sm mute', text: 'Notes' }), h('p', { class: 'sm', style: { margin: 0, whiteSpace: 'pre-wrap' }, text: sec.notes })) : null,
      h('h4', { class: 'vsub', text: 'Who can open it' }), people,
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' } },
        h('button', { class: 'btn', onclick: e => pickShare(e.currentTarget, item) }, icon('invite', 16), 'Share with…'),
        h('button', { class: 'btn ghost', onclick: () => { closeSheet(true); openLogin(item, sec); } }, 'Edit'),
        mineCreator ? h('button', { class: 'btn ghost danger', onclick: e => confirmIn(sh, { text: `Delete “${item.name}” for everyone?`, yes: 'Delete', danger: true, onYes: async () => { closeSheet(true); const { error } = await sb.from('vault_items').delete().eq('id', item.id); if (error) return toast(errText(error)); V.items = V.items.filter(i => i.id !== item.id); V.grants = V.grants.filter(g => g.item_id !== item.id); toast('Login deleted'); refresh(); } }) }, 'Delete') : null)].filter(Boolean));
  } });
}
function memberOptions(exclude = []) {
  return S.members.filter(m => !exclude.includes(m.user_id)).map(m => { const p = prof(m.user_id); return { v: m.user_id, label: dname(p) || p?.email || 'Someone', sub: V.keys[m.user_id] ? '' : 'hasn’t set up Passwords yet' }; }).sort((a, b) => a.label.localeCompare(b.label));
}
function pickShare(anchor, item) {
  picker(anchor, { options: memberOptions(holders(item).map(g => g.user_id)), multi: true, value: [], placeholder: 'Share with…',
    onPick: async v => { const list = [...(v || [])]; if (!list.length) return; closePop(); const miss = await shareItem(item, list);
      const ok = list.length - miss.length; if (ok) toast(`Shared with ${plural(ok, 'person').replace('persons', 'people')}`);
      if (miss.length) toast(`${miss.map(p => first(prof(p))).join(', ')} will get it as soon as they set up Passwords`);
      closeSheet(true); openLoginView(item); refresh(); } });
}
function openLogin(item, sec) {
  const isNew = !item; sec = sec || {};
  openSheet({ title: isNew ? 'Add login' : 'Edit login', kind: 'center', full: true, build: sh => {
    let kind = item?.kind || 'Server', project = item?.project_id || (S.route.v === 'project' ? S.route.id : null), share = new Set();
    const kinds = h('div', { class: 'chips' }); const drawKinds = () => kinds.replaceChildren(...vaultKinds().map(k => h('button', { class: 'chipbtn', 'aria-pressed': String(k === kind), onclick: () => { kind = k; drawKinds(); } }, k)),
      h('button', { class: 'chipbtn', onclick: e => { const inp = h('input', { type: 'text', placeholder: 'New kind', style: { width: '140px' }, onkeydown: ev => { if (ev.key === 'Enter' && inp.value.trim()) { kind = inp.value.trim(); VAULT_KINDS.includes(kind) || VAULT_KINDS.push(kind); drawKinds(); } }, onblur: () => { if (inp.value.trim()) { kind = inp.value.trim(); VAULT_KINDS.includes(kind) || VAULT_KINDS.push(kind); } drawKinds(); } }); e.currentTarget.replaceWith(inp); inp.focus(); } }, '+ New kind'));
    drawKinds();
    const f = (id, ph, val, type = 'text') => h('input', { type, id, placeholder: ph, value: val || '', autocomplete: 'off', 'aria-label': ph, style: { width: '100%' } });
    const name = f('lgName', 'e.g. MG production server', item?.name); const url = f('lgUrl', 'Link or IP', item?.url); const user = f('lgUser', 'Username or email', sec.username);
    const pass = f('lgPass', 'Password', sec.password, 'password'); const notes = autoGrow(h('textarea', { id: 'lgNotes', rows: '2', placeholder: 'Port, 2FA phone, anything else', style: { width: '100%' } })); notes.value = sec.notes || '';
    const pjBtn = h('button', { class: 'btn', type: 'button' }); const drawPj = () => { pjBtn.textContent = pjOf(project)?.name || 'No project'; };
    pjBtn.addEventListener('click', e => picker(e.currentTarget, { options: [...S.projects.map(p => ({ v: p.id, label: p.name })), { v: null, label: 'No project' }], value: project, onPick: v => { project = v; drawPj(); } })); drawPj();
    const shBtn = h('button', { class: 'btn', type: 'button' }); const drawSh = () => { shBtn.textContent = share.size ? [...share].map(p => first(prof(p))).join(', ') : 'Just me' + (keepers().filter(k => k !== uid()).length ? ' and keepers' : ''); };
    shBtn.addEventListener('click', e => picker(e.currentTarget, { options: memberOptions([uid()]), multi: true, value: [...share], onPick: v => { share = new Set(v || []); drawSh(); } })); drawSh();
    const save = h('button', { class: 'btn pri' }, isNew ? 'Save' : 'Save changes');
    save.addEventListener('click', async () => {
      if (!name.value.trim()) { name.focus(); return toast('Give it a name'); }
      save.disabled = true;
      const secret = { username: user.value.trim(), password: pass.value, notes: notes.value.trim() };
      try {
        if (isNew) {
          const raw = crypto.getRandomValues(new Uint8Array(32));
          const row = { id: uuid(), workspace_id: S.ws.id, project_id: project, kind, name: name.value.trim(), url: url.value.trim(), secret: await aesSeal(raw, secret), created_by: uid(), created_at: nowIso(), updated_at: nowIso() };
          const r1 = await sb.from('vault_items').insert(row); if (r1.error) throw r1.error;
          const mine = { item_id: row.id, user_id: uid(), workspace_id: S.ws.id, wrapped_key: await wrapFor(raw, myKey().public_key), granted_by: uid() };
          const r2 = await sb.from('vault_grants').insert(mine); if (r2.error) throw r2.error;
          V.items.push(row); V.grants.push(mine); V.open[row.id] = secret;
          const miss = await shareItem(row, [...new Set([...keepers(), ...share])].filter(p => p !== uid()));
          const missAsked = miss.filter(p => share.has(p));
          toast(missAsked.length ? `Saved. ${missAsked.map(p => first(prof(p))).join(', ')} will get it as soon as they set up Passwords` : 'Login saved'); track('vault_add');
        } else {
          const raw = await itemRawKey(item);
          const patch = { project_id: project, kind, name: name.value.trim(), url: url.value.trim(), secret: await aesSeal(raw, secret), updated_by: uid(), updated_at: nowIso() };
          const r = await sb.from('vault_items').update(patch).eq('id', item.id); if (r.error) throw r.error;
          Object.assign(item, patch); V.open[item.id] = secret;
          if (share.size) await shareItem(item, [...share]);
          toast('Login saved');
        }
        closeSheet(true); refresh();
      } catch (e) { save.disabled = false; toast(errText(e)); }
    });
    sh.append(h('div', { class: 'sbody' },
      h('div', { class: 'field' }, 'Kind', kinds), h('label', { class: 'field' }, 'Name', name), h('label', { class: 'field' }, 'Link', url),
      h('label', { class: 'field' }, 'Username', user),
      h('div', { class: 'field' }, 'Password', h('div', { style: { display: 'flex', gap: '6px' } }, pass,
        h('button', { class: 'btn icon', type: 'button', title: 'Show', 'aria-label': 'Show password', onclick: () => { pass.type = pass.type === 'password' ? 'text' : 'password'; } }, icon('eye', 16)),
        h('button', { class: 'btn', type: 'button', onclick: () => { pass.value = genPassword(); pass.type = 'text'; } }, 'Make one'))),
      h('label', { class: 'field' }, 'Notes', notes),
      h('div', { class: 'field' }, 'Project', h('div', {}, pjBtn)),
      h('div', { class: 'field' }, isNew ? 'Share with' : 'Also share with', h('div', {}, shBtn))),
      h('div', { class: 'sfoot' }, h('span', { class: 'sm mute', text: 'Locked on this device before it is sent' }), h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), save));
    setTimeout(() => name.focus(), 80);
  } });
}
function openKeepers() {
  picker(document.querySelector('.head .tools') || document.body, { options: memberOptions(), multi: true, value: keepers(), placeholder: 'Keepers…',
    onPick: async v => { const list = [...(v || [])]; const { error } = await sb.from('workspaces').update({ vault_keepers: list }).eq('id', S.ws.id); if (error) return toast(errText(error)); S.ws.vault_keepers = list; toast('Keepers saved'); if (vaultUnlocked()) fillKeepers(); refresh(); } });
}

