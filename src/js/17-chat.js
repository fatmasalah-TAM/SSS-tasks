/* ═════════════ chat: channels, direct messages, threads, reactions, files, huddles ═════════════ */
var QUICK = ['👍', '❤️', '😂', '🎉', '👀', '✅', '🙏', '🔥'];
var CHAT_DAYS = 90, FILE_MAX = 50 * 1024 * 1024; // recent chat loads at start; older messages load on request (nothing is ever cut off)
function isChatN(n) { return n.kind === 'chat' || n.kind === 'dm'; }
var chatUi = { thread: null, pending: {}, editing: null, scrollTo: null };
var huddleCfg = null;

async function loadOlder(chId, btn) {
  const mine = S.messages.filter(m => m.channel_id === chId).map(m => m.created_at).sort();
  const before = mine[0] || new Date(Date.now() - CHAT_DAYS * 864e5).toISOString();
  const done = btn ? busy(btn, 'Loading…') : () => {};
  const { data, error } = await sb.from('messages').select('*').eq('channel_id', chId).lt('created_at', before).order('created_at', { ascending: false }).limit(200);
  done(); if (error) return toast(errText(error));
  const have = new Set(S.messages.map(m => m.id));
  S.messages.push(...(data || []).filter(m => !have.has(m.id)));
  chatUi.allLoaded = chatUi.allLoaded || {}; if ((data || []).length < 200) chatUi.allLoaded[chId] = true;
  const sc = $('.cv-scroll'); const h0 = sc?.scrollHeight || 0, t0 = sc?.scrollTop || 0;
  refreshChat();
  requestAnimationFrame(() => { const sc2 = $('.cv-scroll'); if (sc2) sc2.scrollTop = sc2.scrollHeight - h0 + t0; }); // stay where you were
  if (!(data || []).length) toast('That’s the very first message');
}
async function loadChat() {
  if (!S.ws) return;
  const ws = S.ws.id; const since = new Date(Date.now() - CHAT_DAYS * 864e5).toISOString();
  const [c, m, r, rd, hu] = await Promise.all([
    sb.from('channels').select('*').eq('workspace_id', ws).order('created_at', { ascending: true }),
    sb.from('messages').select('*').eq('workspace_id', ws).gte('created_at', since).order('created_at', { ascending: true }).limit(5000),
    sb.from('reactions').select('*').eq('workspace_id', ws),
    sb.from('chat_reads').select('*').eq('user_id', uid()),
    sb.from('huddles').select('*').eq('workspace_id', ws),
  ]);
  if (S.ws?.id !== ws) return;
  if (!c.error && c.data) S.channels = c.data;
  if (!m.error && m.data) { const ids = new Set(m.data.map(x => x.id)); S.messages = S.messages.filter(x => x.workspace_id === ws && x.created_at < since && !ids.has(x.id)).concat(m.data); } // keep older messages you already opened
  if (!r.error && r.data) S.reactions = r.data;
  if (!rd.error && rd.data) { S.reads = {}; for (const x of rd.data) S.reads[x.channel_id] = x.last_read_at; }
  if (!hu.error && hu.data) S.huddles = hu.data;
}
function chOf(id) { return S.channels.find(c => c.id === id); }
function msgOf(id) { return S.messages.find(m => m.id === id); }
function dmOther(c) { return c?.kind === 'dm' ? prof(c.dm_users.find(u => u !== uid()) || uid()) : null; }
function chName(c) { return !c ? '' : c.kind === 'dm' ? dname(dmOther(c)) : '#' + c.name; }
function myJoin() { return S.members.find(m => m.user_id === uid())?.joined_at || '1970-01-01'; }
function lastRead(chId) { const c = chOf(chId); const r = S.reads[chId]; return r || [myJoin(), c?.created_at || ''].sort().pop(); }
function unreadIn(chId) { const lr = lastRead(chId); return S.messages.filter(m => m.channel_id === chId && !m.parent_id && m.author_id !== uid() && m.created_at > lr).length; }
function chatAlerts(chId) { return S.notifs.filter(n => isChatN(n) && !n.read_at && (!chId || n.channel_id === chId)); }
function chatBadge() { return chatAlerts().length; }
function liveHuddle(chId) { const x = S.huddles.find(h => h.channel_id === chId); return x && !x.ended_at && Date.now() - new Date(x.started_at) < 4 * 3600e3 ? x : null; }
function dmWith(userId) { const pair = [uid(), userId].sort(); return S.channels.find(c => c.kind === 'dm' && c.dm_users.slice().sort().join() === pair.join()); }

/* opening a conversation */
function openChat(id) { chatUi.thread = null; go({ v: 'chat', id }); }
async function openDm(userId) {
  let c = dmWith(userId);
  if (!c) {
    const row = { id: uuid(), workspace_id: S.ws.id, kind: 'dm', dm_users: [uid(), userId].sort(), created_by: uid(), created_at: nowIso() };
    const r = await write({ t: 'channels', op: 'insert', row });
    if (r.error) return toast(errText(r.error));
    await loadChat(); c = dmWith(userId) || row; if (!chOf(c.id)) S.channels.push(c);
  }
  openChat(c.id);
}
async function newChannel() {
  const name = await promptText('New channel', '', 'Create');
  if (!name) return;
  const clean = name.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9؀-ۿ_-]/g, '').slice(0, 40);
  if (!clean) return toast('Use letters or numbers for the name');
  if (S.channels.some(c => c.kind === 'channel' && c.name.toLowerCase() === clean)) return toast(`#${clean} already exists`);
  const row = { id: uuid(), workspace_id: S.ws.id, kind: 'channel', name: clean, topic: null, dm_users: [], created_by: uid(), created_at: nowIso() };
  const r = await write({ t: 'channels', op: 'insert', row });
  if (r.error) return toast(errText(r.error));
  S.channels.push(row); openChat(row.id); toast(`#${clean} created`);
}
function pickDmPerson() {
  const others = S.members.filter(m => m.user_id !== uid());
  if (!others.length) return toast('Invite teammates first, then you can message them');
  openSheet({ title: 'New message', kind: 'center', key: 'newdm', build: sh => {
    sh.append(h('div', { class: 'sbody', style: { gap: '4px' } }, ...others.map(m => h('button', { class: 'navi', onclick: () => { closeSheet(true); openDm(m.user_id); } },
      avatar(prof(m.user_id), { size: 'lg' }), h('span', { class: 't notr', text: dname(prof(m.user_id)) })))));
  } });
}

/* marking read: when a conversation is on screen */
const markChatRead = debounce(async chId => {
  if (!chId || document.visibilityState !== 'visible' || S.route.v !== 'chat') return;
  const last = S.messages.filter(m => m.channel_id === chId).map(m => m.created_at).sort().pop();
  const at = [nowIso(), last || ''].sort().pop();
  if (S.reads[chId] && S.reads[chId] >= (last || '') && !chatAlerts(chId).length) return;
  S.reads[chId] = at;
  for (const n of chatAlerts(chId)) n.read_at = at;
  syncBadge(); renderNavOnly(); applyTheme();
  await write({ t: 'chat_reads', op: 'upsert', row: { channel_id: chId, user_id: uid(), workspace_id: S.ws.id, last_read_at: at } });
}, 400);

/* ── message text: links, @mentions, task keys (SSS-12), **bold**, `code` ── */
/* chat files are private: each one is opened with a short-lived signed link, fetched in batches */
var fileLinks = {}; var fileWant = new Set(); var fileTimer = null;
function filePath(f) { if (f?.path) return f.path; const m = String(f?.url || '').split('/storage/v1/object/public/chat/')[1]; return m ? decodeURIComponent(m.split('?')[0]) : null; }
function fileUrl(f) {
  const p = filePath(f); if (!p) return null;
  const hit = fileLinks[p]; if (hit && hit.until > Date.now()) return hit.url;
  fileWant.add(p); clearTimeout(fileTimer); fileTimer = setTimeout(signFiles, 30);
  return hit?.url || null;
}
async function signFiles() {
  const paths = [...fileWant]; fileWant.clear(); if (!paths.length) return;
  try {
    const { data, error } = await sb.storage.from('chat').createSignedUrls(paths, 6 * 3600);
    if (error || !data) return;
    for (const d of data) if (d.signedUrl && !d.error) fileLinks[d.path] = { url: d.signedUrl, until: Date.now() + 5 * 3600e3 };
    refreshChat();
  } catch {}
}
function chatHtml(body) {
  const keyRe = new RegExp(`\\b(${(S.ws?.prefix || 'TSK').replace(/[^A-Z0-9]/gi, '')})-(\\d+)\\b`, 'gi');
  const names = S.members.map(m => prof(m.user_id)).filter(Boolean).map(p => first(p)).filter(Boolean).sort((a, b) => b.length - a.length);
  const mentionRe = new RegExp(`(^|[^\\p{L}\\p{N}_])@(${[...names.map(reEsc), 'channel', 'here'].join('|')})(?![\\p{L}\\p{N}_])`, 'giu');
  const keep = []; const hold = html => `\u0000${keep.push(html) - 1}\u0000`;
  const fmt = raw => {
    let t = raw.replace(/`([^`]+)`/g, (m0, c) => hold(`<code>${esc(c)}</code>`))
      .replace(keyRe, m0 => { const n = m0.split('-')[1]; const tk = S.tasks.find(x => String(x.number) === n); return tk ? hold(`<button class="chip-task" data-task="${tk.id}" title="${esc(tk.title)}">${esc(m0.toUpperCase())}</button>`) : m0; })
      .replace(mentionRe, (m0, pre, n) => {
        const mine = n.toLowerCase() === (first(me()) || '').toLowerCase() || /^(channel|here)$/i.test(n);
        return pre + hold(`<span class="mention${mine ? ' me' : ''}">@${esc(n)}</span>`);
      });
    t = esc(t).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    return t;
  };
  // links are kept whole: nothing inside a link is turned into a mention or a task chip
  const parts = String(body || '').replace(/\u0000/g, '').split(/(https?:\/\/[^\s<>"]+)/g);
  return parts.map((x, i) => i % 2 ? `<a href="${esc(x)}" target="_blank" rel="noopener" dir="ltr">${esc(x)}</a>` : fmt(x)).join('')
    .replace(/\u0000(\d+)\u0000/g, (m0, k) => keep[+k]).replace(/\n/g, '<br>');
}
function reEsc(x) { return String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
/** was this person @mentioned? works for Arabic names too */
function mentioned(body, p) {
  const f = first(p), full = dname(p); if (!f) return false;
  return (full && body.includes('@' + full)) || new RegExp(`(?<![\\p{L}\\p{N}_])@${reEsc(f)}(?![\\p{L}\\p{N}_])`, 'iu').test(body);
}
function mentionsIn(body, c) {
  const ids = new Set();
  for (const m of S.members) { const p = prof(m.user_id); if (mentioned(body, p)) ids.add(m.user_id); }
  if (c?.kind === 'channel' && /@(channel|here)(?![\p{L}\p{N}_])/iu.test(body)) for (const m of S.members) ids.add(m.user_id);
  ids.delete(uid()); return [...ids];
}
function dayLabel(iso) {
  const d = new Date(iso); const t = new Date(); const y = new Date(Date.now() - 864e5);
  return d.toDateString() === t.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString(UI_LOC, { weekday: 'long', day: 'numeric', month: 'short' });
}
function clock(iso) { return new Date(iso).toLocaleTimeString(UI_LOC || [], { hour: 'numeric', minute: '2-digit' }); }

/* ── the Chat page ── */
function viewChat() {
  const id = S.route.id && chOf(S.route.id) ? S.route.id : null;
  if (isPhone()) {
    if (!id) return [pageHead('Chat', null, h('button', { class: 'btn sm', onclick: () => pickDmPerson() }, icon('plus', 14), 'Message')), h('div', { class: 'scroll' }, chatList(null))];
    return conversation(id);
  }
  const cur = id || store.get('chat.last', null) && chOf(store.get('chat.last', null))?.id || S.channels.find(c => c.kind === 'channel' && c.name === 'general')?.id || S.channels[0]?.id;
  if (cur && !id) S.route = { v: 'chat', id: cur };
  return [h('div', { class: 'chatwrap' }, h('div', { class: 'chatside' }, h('div', { class: 'chatside-h' }, h('h1', { class: 'ptitle' }, h('span', { class: 't', text: 'Chat' }))), chatList(cur)),
    h('div', { class: 'chatmain' }, ...(cur ? conversation(cur) : [emptyState('CHAT', 'No conversations yet.', { label: 'New channel', fn: newChannel })])))];
}
function chatList(cur) {
  const chs = S.channels.filter(c => c.kind === 'channel').sort((a, b) => (a.name === 'general' ? -1 : b.name === 'general' ? 1 : a.name.localeCompare(b.name)));
  const people = S.members.filter(m => m.user_id !== uid()).map(m => ({ m, c: dmWith(m.user_id) }))
    .sort((a, b) => (lastMsgAt(b.c) || '').localeCompare(lastMsgAt(a.c) || '') || dname(prof(a.m.user_id)).localeCompare(dname(prof(b.m.user_id))));
  const item = (c, label, lead, onclick) => {
    const n = c ? unreadIn(c.id) : 0; const al = c ? chatAlerts(c.id).length : 0; const hu = c && liveHuddle(c.id);
    return h('button', { class: 'navi chi' + (n ? ' unread' : ''), 'aria-current': c && c.id === cur ? 'page' : null, 'data-chat': c?.id || '', onclick },
      lead, h('span', { class: 't', text: label }), hu ? h('span', { class: 'hu-dot', title: 'Huddle live', 'aria-label': 'Huddle live' }, icon('headset', 14)) : null,
      al ? h('span', { class: 'badge', text: al > 99 ? '99+' : String(al) }) : n ? h('span', { class: 'n', text: String(n) }) : null);
  };
  return h('nav', { class: 'chatlist', 'data-tour': 'chat-list', 'aria-label': 'Conversations' },
    h('h4', {}, 'Channels', h('button', { 'aria-label': 'New channel', title: 'New channel', onclick: () => newChannel() }, icon('plus', 14))),
    ...chs.map(c => item(c, c.name, h('span', { class: 'ico hash', text: '#' }), () => openChat(c.id))),
    h('h4', {}, 'Direct messages', h('button', { 'aria-label': 'New message', title: 'New message', onclick: () => pickDmPerson() }, icon('plus', 14))),
    people.length ? people.map(({ m, c }) => item(c, dname(prof(m.user_id)), avatar(prof(m.user_id), { size: 'xs' }), () => c ? openChat(c.id) : openDm(m.user_id)))
      : h('div', { class: 'note', style: { padding: '0 8px' }, text: 'Teammates show up here once they join.' }));
}
function lastMsgAt(c) { return c ? S.messages.filter(m => m.channel_id === c.id).map(m => m.created_at).sort().pop() : null; }

function conversation(chId) {
  const c = chOf(chId); store.set('chat.last', chId);
  const other = dmOther(c); const hu = liveHuddle(chId);
  const canManage = c.kind === 'channel' && (c.created_by === uid() || isAdmin());
  const title = h('div', { class: 'cv-title' },
    isPhone() ? h('button', { class: 'x', 'aria-label': 'Back to chats', onclick: () => go({ v: 'chat' }) }, icon('back', 20)) : null,
    c.kind === 'dm' ? avatar(other, { size: 'lg' }) : h('span', { class: 'hash big', text: '#' }),
    h('div', { class: 'cv-name' }, h('b', { text: c.kind === 'dm' ? dname(other) : c.name }),
      h('span', { class: 'sm mute', text: c.kind === 'dm' ? 'Direct message' : (c.topic || `${S.members.length} people`) })),
    h('span', { class: 'sp' }),
    hu ? null : h('button', { class: 'btn sm', 'data-tour': 'huddle-btn', onclick: () => joinHuddle(chId) }, icon('headset', 16), 'Huddle'),
    canManage ? h('button', { class: 'x', 'aria-label': 'Channel options', onclick: e => menu(e.currentTarget, [
      { label: 'Edit topic', icon: 'gear', fn: () => editChannel(c, 'topic') },
      { label: 'Rename', icon: 'gear', fn: () => editChannel(c, 'name') },
      ...(c.name !== 'general' ? ['-', { label: 'Delete channel', danger: true, fn: () => deleteChannel(c) }] : [])]) }, icon('more', 18)) : null);
  const banner = hu ? h('div', { class: 'hu-banner', role: 'status' }, icon('headset', 16),
    h('span', {}, h('span', { text: hu.started_by === uid() ? 'You started a huddle' : `${first(prof(hu.started_by)) || 'Someone'} started a huddle` }),
      hu.people.length ? h('span', { class: 'sm mute', text: ' · ' + (hu.people.length === 1 && hu.people[0] === uid() ? 'waiting for others' : `${hu.people.length} in the call`) }) : null),
    h('span', { class: 'sp' }),
    h('button', { class: 'btn sm pri', 'data-tour': 'huddle-btn', onclick: () => joinHuddle(chId) }, icon('headset', 14), hu.people.includes(uid()) ? 'Back to the call' : 'Join'),
    hu.started_by === uid() || isAdmin() ? h('button', { class: 'btn sm ghost', onclick: () => endHuddle(chId) }, 'End') : null) : null;
  const list = h('div', { class: 'scroll cv-scroll', 'data-chat-scroll': chId }, messageList(chId, null));
  const out = [h('header', { class: 'head cv-head' }, title), banner, list, composer2(c, null)].filter(Boolean);
  requestAnimationFrame(() => { const sc = $('.cv-scroll'); if (sc) { const tgt = chatUi.scrollTo && $(`[data-msg="${chatUi.scrollTo}"]`, sc); if (tgt) { tgt.scrollIntoView({ block: 'center' }); tgt.classList.add('flash'); chatUi.scrollTo = null; } else sc.scrollTop = sc.scrollHeight; } });
  markChatRead(chId);
  if (!huddleCfg || huddleCfg.ws !== S.ws.id) huddleSettings().catch(() => {});
  return out;
}
async function editChannel(c, field) {
  const v = await promptText(field === 'topic' ? 'Channel topic' : 'Channel name', c[field] || '', 'Save');
  if (v == null) return;
  const val = field === 'name' ? v.replace(/^#/, '').toLowerCase().replace(/\s+/g, '-').slice(0, 40) : v.slice(0, 200);
  const r = await write({ t: 'channels', op: 'update', id: c.id, patch: { [field]: val } });
  if (r.error) return toast(errText(r.error)); c[field] = val; const cur = chOf(c.id); if (cur) cur[field] = val; render(); // the list may have reloaded meanwhile
}
function deleteChannel(c) {
  confirmIn($('.cv-scroll') || $('#app'), { text: `Delete #${c.name} and all its messages?`, yes: 'Delete', danger: true, onYes: async () => {
    const r = await write({ t: 'channels', op: 'delete', id: c.id }); if (r.error) return toast(errText(r.error));
    S.channels = S.channels.filter(x => x.id !== c.id); S.messages = S.messages.filter(m => m.channel_id !== c.id); go({ v: 'chat' }); toast(`#${c.name} deleted`);
  } });
}

function messageList(chId, parentId) {
  const box = h('div', { class: 'msgs' });
  const msgs = S.messages.filter(m => m.channel_id === chId && (parentId ? m.parent_id === parentId : !m.parent_id)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (parentId) { const p = msgOf(parentId); if (p) box.append(messageEl(p, { inThread: true, head: true }), h('div', { class: 'thread-sep', text: `${msgs.length} repl${msgs.length === 1 ? 'y' : 'ies'}` })); }
  // the whole history is there: older messages load when you ask
  if (!parentId && !chatUi.allLoaded?.[chId]) box.append(h('div', { class: 'older-wrap' }, h('button', { class: 'btn sm ghost older', onclick: e => loadOlder(chId, e.currentTarget) }, 'Show older messages')));
  if (!msgs.length && !parentId) {
    const c = chOf(chId);
    box.append(h('div', { class: 'cv-empty' }, c.kind === 'dm' ? avatar(dmOther(c), { size: 'xl' }) : h('span', { class: 'hash huge', text: '#' }),
      h('b', { text: c.kind === 'dm' ? `This is the start of your messages with ${dname(dmOther(c))}.` : `This is the start of #${c.name}.` }),
      h('span', { class: 'mute', text: 'Type a message below. Use @ to mention someone, and the task key (like ' + (S.ws?.prefix || 'TSK') + '-12) to link a task.' })));
    return box;
  }
  const lr = parentId ? null : lastRead(chId); let day = '', prev = null, newShown = false;
  for (const m of msgs) {
    const d = dayLabel(m.created_at);
    if (d !== day) { box.append(h('div', { class: 'day', text: d })); day = d; prev = null; }
    if (lr && !newShown && m.created_at > lr && m.author_id !== uid()) { box.append(h('div', { class: 'newline', text: 'New' })); newShown = true; prev = null; }
    const grouped = prev && prev.author_id === m.author_id && prev.kind === 'text' && m.kind === 'text' && new Date(m.created_at) - new Date(prev.created_at) < 5 * 60e3;
    box.append(messageEl(m, { head: !grouped, inThread: !!parentId }));
    prev = m;
  }
  return box;
}
function messageEl(m, { head, inThread }) {
  const p = prof(m.author_id); const mine = m.author_id === uid();
  if (m.kind === 'huddle') {
    const live = liveHuddle(m.channel_id) && S.huddles.find(x => x.channel_id === m.channel_id && new Date(x.started_at) - new Date(m.created_at) < 60e3 && new Date(m.created_at) - new Date(x.started_at) < 60e3);
    return h('div', { class: 'msg sys', 'data-msg': m.id }, h('span', { class: 'hu-ico' }, icon('headset', 16)),
      h('span', { text: `${first(p) || 'Someone'} started a huddle · ${clock(m.created_at)}` }),
      live ? h('button', { class: 'btn sm pri', onclick: () => joinHuddle(m.channel_id) }, live.people?.includes(uid()) ? 'Back to the call' : 'Join') : h('span', { class: 'sm mute', text: 'ended' }));
  }
  const reacts = S.reactions.filter(r => r.message_id === m.id); const by = new Map();
  for (const r of reacts) { if (!by.has(r.emoji)) by.set(r.emoji, []); by.get(r.emoji).push(r.user_id); }
  const replies = inThread ? [] : S.messages.filter(x => x.parent_id === m.id);
  const editing = chatUi.editing === m.id;
  const body = editing ? editBox(m) : h('div', { class: 'mbody', html: chatHtml(m.body) });
  body.addEventListener?.('click', e => { const b = e.target.closest('.chip-task'); if (b) { e.preventDefault(); openTask(b.dataset.task); } });
  // only files from our own storage; each opens through its signed link (a placeholder shows until it's ready)
  const safeFiles = (m.files || []).filter(f => f && (f.path || (typeof f.url === 'string' && f.url.startsWith(CFG.url + '/storage/')))).map(f => Object.assign({}, f, { url: fileUrl(f) }));
  const files = safeFiles.length ? h('div', { class: 'mfiles' }, ...safeFiles.map(f => /^audio\//.test(f.type || '')
    ? h('div', { class: 'mvoice' }, h('span', { class: 'mv-ico' }, icon('mic', 16)), h('audio', { controls: true, preload: 'none', src: f.url, 'aria-label': 'Voice note' }), f.seconds ? h('span', { class: 'sm mute', text: mmss(f.seconds) }) : null)
    : /^image\//.test(f.type || '')
    ? h('a', { class: 'mimg', href: f.url, target: '_blank', rel: 'noopener' }, h('img', { src: f.url, alt: f.name, loading: 'lazy' }))
    : h('a', { class: 'mfile', href: f.url, target: '_blank', rel: 'noopener', download: f.name }, icon('export', 16), h('span', { text: f.name }), h('span', { class: 'sm mute', text: fmtSize(f.size) })))) : null;
  const reactRow = by.size || false ? h('div', { class: 'reacts' }, ...[...by.entries()].map(([e, us]) => h('button', { class: 'react' + (us.includes(uid()) ? ' on' : ''), title: us.map(u => first(prof(u))).join(', '), 'aria-label': `${e} ${us.length}`, onclick: () => toggleReact(m, e) }, h('span', { text: e }), h('b', { text: String(us.length) }))),
    h('button', { class: 'react add', 'aria-label': 'Add reaction', onclick: ev => reactPicker(ev.currentTarget, m) }, '+')) : null;
  const thread = replies.length ? h('button', { class: 'thread-link', onclick: () => openThread(m.id) },
    ...[...new Set(replies.map(r => r.author_id))].slice(0, 3).map(u => avatar(prof(u), { size: 'xs' })),
    h('b', { text: `${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}` }), h('span', { class: 'mute', text: 'Last ' + ago(replies[replies.length - 1].created_at) })) : null;
  const acts = h('div', { class: 'mact' },
    ...QUICK.slice(0, 3).map(e => h('button', { class: 'x ma-react', 'aria-label': 'React ' + e, onclick: () => toggleReact(m, e) }, e)),
    !inThread ? h('button', { class: 'x ma-reply', 'aria-label': 'Reply in thread', title: 'Reply in thread', onclick: () => openThread(m.id) }, icon('reply', 16)) : null,
    h('button', { class: 'x ma-more', 'aria-label': 'More actions', onclick: e => msgMenu(e.currentTarget, m, inThread) }, icon('more', 16)));
  const el = h('div', { class: 'msg' + (head ? ' first' : '') + (m.mentions?.includes(uid()) ? ' me' : ''), 'data-msg': m.id },
    head ? avatar(p, { size: 'lg' }) : h('span', { class: 'mtime', text: clock(m.created_at) }),
    h('div', { class: 'mcol' },
      head ? h('div', { class: 'mhead' }, h('b', { text: dname(p) || 'Former member' }), h('span', { class: 'mute sm', text: clock(m.created_at) })) : null,
      body, m.edited_at && !editing ? h('span', { class: 'sm mute', text: '(edited)' }) : null, files, reactRow, thread),
    editing ? null : acts);
  // touch screens: press and hold a message to react, reply or edit
  if (!editing && matchMedia('(hover: none)').matches) longPress(el, () => { $$('.msg.acts-open').forEach(x => x !== el && x.classList.remove('acts-open')); el.classList.add('acts-open'); });
  return el;
}
document.addEventListener('pointerdown', e => { if (!e.target.closest?.('.msg.acts-open, .menu, .pop')) $$('.msg.acts-open').forEach(x => x.classList.remove('acts-open')); }, true);
function fmtSize(n) { return !n ? '' : n < 1024 * 1024 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1024 / 1024).toFixed(1) + ' MB'; }
function msgMenu(anchor, m, inThread) {
  const mine = m.author_id === uid();
  menu(anchor, [
    { header: 'React' }, ...QUICK.map(e => ({ label: e, fn: () => toggleReact(m, e) })), '-',
    !inThread ? { label: 'Reply in thread', icon: 'reply', fn: () => openThread(m.id) } : null,
    { label: 'Make a task from this', sub: '✦ AI', icon: 'plus', fn: () => taskFromMessage(m) },
    { label: 'Copy text', icon: 'share', fn: () => copyText(m.body, 'Copied') },
    mine ? { label: 'Edit', icon: 'gear', fn: () => { chatUi.editing = m.id; refreshChat(); } } : null,
    mine || isAdmin() ? { label: 'Delete message', danger: true, fn: () => deleteMessage(m) } : null,
  ].filter(Boolean));
}
function reactPicker(anchor, m) { menu(anchor, QUICK.map(e => ({ label: e, fn: () => toggleReact(m, e) }))); }
async function toggleReact(m, emoji) {
  const mine = S.reactions.find(r => r.message_id === m.id && r.user_id === uid() && r.emoji === emoji);
  if (mine) {
    S.reactions = S.reactions.filter(r => r !== mine); refreshChat();
    const { error } = await sb.from('reactions').delete().eq('message_id', m.id).eq('user_id', uid()).eq('emoji', emoji);
    if (error) { S.reactions.push(mine); refreshChat(); toast(errText(error)); }
  } else {
    const row = { message_id: m.id, user_id: uid(), emoji, workspace_id: S.ws.id, created_at: nowIso() };
    S.reactions.push(row); refreshChat();
    const { error } = await sb.from('reactions').insert(row);
    if (error && !/duplicate/i.test(error.message)) { S.reactions = S.reactions.filter(r => r !== row); refreshChat(); toast(errText(error)); }
  }
}
function editBox(m) {
  const ta = autoGrow(h('textarea', { class: 'medit', rows: '1', value: m.body, 'aria-label': 'Edit message' }));
  const save = async () => {
    const v = ta.value.trim(); if (!v && !(m.files || []).length) return;
    const old = m.body; m.body = v; m.edited_at = nowIso(); chatUi.editing = null; refreshChat();
    const r = await write({ t: 'messages', op: 'update', id: m.id, patch: { body: v, mentions: mentionsIn(v, chOf(m.channel_id)) } });
    if (r.error) { m.body = old; refreshChat(); toast(errText(r.error)); }
  };
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !isPhone()) { e.preventDefault(); save(); } if (e.key === 'Escape') { e.stopPropagation(); chatUi.editing = null; refreshChat(); } });
  setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 30);
  return h('div', { class: 'medit-box' }, ta, h('div', { class: 'row2' }, h('button', { class: 'btn sm ghost', onclick: () => { chatUi.editing = null; refreshChat(); } }, 'Cancel'), h('button', { class: 'btn sm pri', onclick: save }, 'Save')));
}
function deleteMessage(m) {
  const box = $(`[data-msg="${m.id}"]`)?.parentNode || $('#app');
  confirmIn(box, { text: 'Delete this message?', yes: 'Delete', danger: true, onYes: async () => {
    const gone = S.messages.filter(x => x.id === m.id || x.parent_id === m.id); S.messages = S.messages.filter(x => !gone.includes(x)); refreshChat();
    const r = await write({ t: 'messages', op: 'delete', id: m.id });
    if (r.error) { S.messages.push(...gone); refreshChat(); toast(errText(r.error)); }
  } });
}
async function taskFromMessage(m) {
  track('task_from_message');
  const c = chOf(m.channel_id); const from = `From ${chName(c)} · ${dname(prof(m.author_id))}`;
  const after = async t => { await sendMessage(c, m.parent_id || m.id, `Made a task: ${taskKey(t)}`, []); };
  const voice = (m.files || []).find(f => /^audio\//.test(f.type || ''));
  if (await aiReady()) {
    const hold = toast(voice ? 'AI is listening to the voice note…' : 'AI is writing it up…', null, 20000);
    let input = { text: m.body };
    if (voice) { try { const { data: dl, error: de } = await sb.storage.from('chat').download(filePath(voice)); if (de || !dl) throw de; input = { text: m.body, audio: dl }; } catch { hold.remove(); return toast('Couldn’t open the voice note'); } }
    const r = await aiDraft(input); hold.remove();
    if (!r.error) return openCreate({ draft: r.draft, prefill: { description: (m.body ? m.body + '\n\n' : '') + from }, onCreated: after });
    toast(r.error);
  }
  const firstLine = (m.body || '').split('\n')[0].replace(/@\S+\s?/g, '').trim().slice(0, 120) || 'From chat';
  openCreate({ prefill: { title: firstLine, description: `${m.body}\n\n${from}` }, onCreated: after });
}

/* ── composer (also used in threads) ── */
function composer2(c, parentId) {
  const key = c.id + (parentId ? ':' + parentId : '');
  const ta = autoGrow(h('textarea', { class: 'cmp-in', rows: '1', 'aria-label': 'Message', placeholder: parentId ? 'Reply…' : `Message ${chName(c)}`, value: store.get('chatdraft.' + key, '') }));
  const files = chatUi.pending[key] || (chatUi.pending[key] = []);
  const fileIn = h('input', { type: 'file', multiple: true, hidden: true, onchange: e => { for (const f of e.target.files) { if (f.size > FILE_MAX) { toast(`${f.name} is over 50 MB`); continue; } files.push(f); } e.target.value = ''; drawFiles(); } });
  const chips = h('div', { class: 'cmp-files' });
  const drawFiles = () => chips.replaceChildren(...files.map((f, i) => h('span', { class: 'fchip on' }, h('span', { text: f.name }), h('button', { class: 'x', 'aria-label': 'Remove ' + f.name, onclick: () => { files.splice(i, 1); drawFiles(); } }, icon('x', 12)))));
  drawFiles();
  const send = h('button', { class: 'btn pri cmp-send', 'aria-label': 'Send' }, icon('send', 18));
  const go_ = async () => {
    const body = ta.value.trim(); if (!body && !files.length) return ta.focus();
    const sending = files.splice(0); drawFiles(); ta.value = ''; ta.dispatchEvent(new Event('input')); store.del('chatdraft.' + key);
    const done = sending.length ? busy(send, '') : null;
    const ok = await sendMessage(c, parentId, body, sending);
    done?.();
    if (!ok) { ta.value = body; files.push(...sending); drawFiles(); }
    if (!isPhone()) ta.focus();
  };
  send.addEventListener('click', go_);
  ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !isPhone() && !$('.pop')) { e.preventDefault(); go_(); } });
  ta.addEventListener('input', () => {
    store.set('chatdraft.' + key, ta.value);
    const m = ta.value.slice(0, ta.selectionStart).match(/@([\p{L}\p{N}_]*)$/u);
    if (m) picker(ta, { options: [...S.members.filter(x => x.user_id !== uid()).map(x => ({ v: x.user_id, label: dname(prof(x.user_id)), icon: avatar(prof(x.user_id), { size: 'xs' }) })), ...(c.kind === 'channel' ? [{ v: '@channel', label: '@channel · everyone here' }] : [])], search: false, onPick: id => {
      const name = id === '@channel' ? 'channel' : first(prof(id));
      const before = ta.value.slice(0, ta.selectionStart).replace(/@([\p{L}\p{N}_]*)$/u, '@' + name + ' '); ta.value = before + ta.value.slice(ta.selectionStart); ta.focus(); ta.setSelectionRange(before.length, before.length); store.set('chatdraft.' + key, ta.value);
    } });
    else closePop();
  });
  const mic = h('button', { class: 'x', 'aria-label': 'Record a voice note', title: 'Record a voice note', onclick: async () => {
    const v = await recordVoice('Voice note'); if (!v) return;
    const ty = v.blob.type || 'audio/wav'; const f = new File([v.blob], 'Voice note.' + (ty.includes('wav') ? 'wav' : ty.includes('webm') ? 'webm' : 'm4a'), { type: ty }); f.seconds = v.seconds; track('voice_note');
    const done = busy(send, ''); await sendMessage(c, parentId, ta.value.trim(), [f]); done(); ta.value = ''; store.del('chatdraft.' + key);
  } }, icon('mic', 18));
  return h('div', { class: 'composer2', 'data-tour': parentId ? null : 'chat-composer' }, chips,
    h('div', { class: 'cmp-row' }, h('button', { class: 'x', 'aria-label': 'Attach a file', title: 'Attach a file or photo', onclick: () => fileIn.click() }, icon('clip', 18)), mic, fileIn, ta, send));
}
async function sendMessage(c, parentId, body, files) {
  const uploaded = [];
  for (const f of files) {
    const path = `${S.ws.id}/${uid()}/${uuid()}-${f.name.replace(/[^\w.\-]+/g, '_').slice(-80)}`;
    const { error } = await sb.storage.from('chat').upload(path, f, { contentType: f.type || 'application/octet-stream' });
    if (error) { toast(`Couldn’t upload ${f.name}: ${errText(error)}`); return false; }
    uploaded.push(Object.assign({ name: f.name, path, type: f.type || '', size: f.size }, f.seconds ? { seconds: f.seconds } : {}));
  }
  const row = { id: uuid(), workspace_id: S.ws.id, channel_id: c.id, parent_id: parentId || null, author_id: uid(), kind: 'text', body, files: uploaded, mentions: mentionsIn(body, c), task_id: null, edited_at: null, created_at: nowIso() };
  S.messages.push(row); S.reads[c.id] = row.created_at; refreshChat();
  const r = await write({ t: 'messages', op: 'insert', row });
  if (r.error) { S.messages = S.messages.filter(m => m !== row); refreshChat(); toast(errText(r.error)); return false; }
  if (r.data?.created_at) Object.assign(row, r.data);
  write({ t: 'chat_reads', op: 'upsert', row: { channel_id: c.id, user_id: uid(), workspace_id: S.ws.id, last_read_at: row.created_at } });
  return true;
}

/* ── threads ── */
function openThread(mid) {
  const m = msgOf(mid); if (!m) return;
  chatUi.thread = mid;
  openSheet({ title: 'Thread', kind: 'right', full: isPhone(), key: 'thread', onClose: () => { chatUi.thread = null; }, build: sh => drawThread2(sh) });
  markChatRead(m.channel_id);
}
function drawThread2(sh) {
  const m = msgOf(chatUi.thread); if (!m) return;
  const c = chOf(m.channel_id);
  $$('.sbody, .composer2', sh).forEach(x => x.remove());
  const body = h('div', { class: 'sbody thread-body' }, h('div', { class: 'sm mute', text: chName(c) }), messageList(m.channel_id, m.id));
  sh.append(body, composer2(c, m.id));
  requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
}

/* ── redraw chat parts without losing what's being typed ── */
function refreshChat() {
  if (S.route.v === 'chat') {
    const sc = $('.cv-scroll'); const atBottom = sc ? sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80 : true;
    const chId = S.route.id;
    if (sc && chOf(chId) && !(isPhone() && !chId)) {
      const y = sc.scrollTop; sc.replaceChildren(messageList(chId, null)); sc.scrollTop = atBottom ? sc.scrollHeight : y;
      const list = $('.chatlist'); if (list && !isPhone()) list.replaceWith(chatList(chId));
      const head = $('.cv-head'); const hu = liveHuddle(chId); const banner = $('.hu-banner');
      if (!!hu !== !!banner || (hu && banner && !banner.textContent.includes(hu.people.map(u => first(prof(u))).filter(Boolean).join(', ')))) render();
      else if (head) { const b = $('[data-tour="huddle-btn"]', head); if (b) b.lastChild.textContent = hu ? `Join huddle${hu.people.length ? ' · ' + hu.people.length : ''}` : 'Huddle'; }
      if (atBottom) markChatRead(chId);
    } else if (!isTyping()) render();
  }
  const th = currentSheet(); if (th?.dataset.key === 'thread' && chatUi.thread) {
    const b = $('.thread-body', th); if (b) { const at = b.scrollHeight - b.scrollTop - b.clientHeight < 80; const list = $('.msgs', b); if (list) list.replaceWith(messageList(msgOf(chatUi.thread)?.channel_id, chatUi.thread)); if (at) b.scrollTop = b.scrollHeight; }
  }
  renderNavOnly(); syncBadge();
}
/* live updates for chat */
function chatRealtime(ch, ws) {
  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `workspace_id=eq.${ws}` }, p => {
    if (p.eventType === 'DELETE') { const id = p.old?.id; S.messages = S.messages.filter(m => m.id !== id && m.parent_id !== id); }
    else if (p.new) { const i = S.messages.findIndex(m => m.id === p.new.id); if (i >= 0) S.messages[i] = Object.assign(S.messages[i], p.new); else { S.messages.push(p.new); onChatArrive(p.new); } }
    refreshChat();
  });
  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'reactions', filter: `workspace_id=eq.${ws}` }, p => {
    const r = p.new || p.old; if (!r) return;
    S.reactions = S.reactions.filter(x => !(x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji));
    if (p.eventType !== 'DELETE') S.reactions.push(p.new);
    refreshChat();
  });
  const reloadSmall = debounce(async () => {
    const [c, hu] = await Promise.all([sb.from('channels').select('*').eq('workspace_id', ws), sb.from('huddles').select('*').eq('workspace_id', ws)]);
    if (c.data) S.channels = c.data; if (hu.data) S.huddles = hu.data; refreshChat();
  }, 200);
  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'channels', filter: `workspace_id=eq.${ws}` }, reloadSmall);
  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'huddles', filter: `workspace_id=eq.${ws}` }, reloadSmall);
}

/* ── huddles ── */
async function huddleSettings() {
  if (huddleCfg && huddleCfg.ws === S.ws.id) return huddleCfg;
  const { data } = await sb.rpc('huddle_status', { ws: S.ws.id });
  return (huddleCfg = Object.assign({ ws: S.ws.id }, data || {}));
}
async function joinHuddle(chId) {
  const cfgNow = huddleCfg && huddleCfg.ws === S.ws.id ? huddleCfg : null;
  // phones only allow a new tab straight after the tap, so open it now and fill it in once the room is ready
  let w = null; if (!cfgNow?.jaas) { try { w = window.open('', '_blank'); } catch {} }
  const { data: room, error } = await sb.rpc('start_huddle', { ch: chId });
  if (error || !room) { try { w?.close(); } catch {} return toast(errText(error || { message: 'Couldn’t start the huddle' })); }
  const cfg = await huddleSettings();
  const name = dname(me());
  if (cfg.jaas) {
    const { data, error: e2 } = await sb.functions.invoke('notify', { body: { op: 'huddle', channel: chId } });
    if (!e2 && data?.jwt) { try { w?.close(); } catch {} return openHuddleInApp(chId, data, name); }
    toast(data?.error ? 'In-app huddle unavailable: ' + data.error + ' Opening Jitsi instead.' : 'Opening Jitsi instead.');
  }
  const url = `https://meet.jit.si/${encodeURIComponent(room)}#userInfo.displayName=${encodeURIComponent(JSON.stringify(name))}&config.prejoinConfig.enabled=false`;
  if (w && !w.closed) { try { w.opener = null; w.location.href = url; } catch { w = null; } }
  // never leave Ovrto: if the phone blocked the new tab, offer a link to tap
  if (!w) toast('Your huddle is ready', { label: 'Open huddle', fn: () => window.open(url, '_blank', 'noopener') }, 15000);
  await loadChat(); refreshChat();
}
function loadScript(src) { return new Promise((res, rej) => { if ([...document.scripts].some(s => s.src === src)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); }); }
async function openHuddleInApp(chId, t, name) {
  const c = chOf(chId); let api = null; let left = false;
  const leave = async finish => { if (left) return; left = true; try { api?.dispose(); } catch {} await sb.rpc('leave_huddle', { ch: chId, finish: !!finish }); await loadChat(); refreshChat(); };
  openSheet({ title: `Huddle · ${chName(c)}`, kind: 'right', full: true, key: 'huddle', onClose: () => leave(false), build: async sh => {
    const host = h('div', { class: 'huddle-host' }, loadingRow('Joining the huddle…'));
    sh.append(host, h('div', { class: 'sfoot' }, h('span', { class: 'sm mute', text: 'Keep this open while you talk.' }), h('span', { class: 'sp' }),
      h('button', { class: 'btn danger', onclick: () => { leave(false); closeSheet(true); } }, 'Leave')));
    try {
      await loadScript(`https://8x8.vc/${t.app}/external_api.js`);
      host.replaceChildren();
      // eslint-disable-next-line no-undef
      api = new JitsiMeetExternalAPI(t.domain, { roomName: t.room, jwt: t.jwt, parentNode: host, width: '100%', height: '100%', userInfo: { displayName: name },
        configOverwrite: { prejoinConfig: { enabled: false }, disableDeepLinking: true }, interfaceConfigOverwrite: { MOBILE_APP_PROMO: false } });
      api.addListener('readyToClose', () => { leave(false); closeSheet(true); });
    } catch (e) { host.replaceChildren(h('p', { class: 'note', text: 'The in-app huddle couldn’t load. Try again, or ask an admin to check Settings → Huddles.' })); }
  } });
}
async function endHuddle(chId) {
  const { error } = await sb.rpc('leave_huddle', { ch: chId, finish: true });
  if (error) return toast(errText(error));
  await loadChat(); refreshChat(); toast('Huddle ended');
}

/* ── settings: in-app huddles (admins) ── */
function huddlePanel() {
  const box = h('div', { class: 'pbody' }, loadingRow('Checking…'));
  const draw = async () => {
    huddleCfg = null; const st = await huddleSettings();
    const app = h('input', { type: 'text', placeholder: 'App ID (vpaas-magic-cookie-…)', value: st.app || '', 'aria-label': 'JaaS App ID', autocomplete: 'off' });
    const kid = h('input', { type: 'text', placeholder: 'API key ID', 'aria-label': 'JaaS API key ID', autocomplete: 'off' });
    const pem = h('textarea', { rows: '3', placeholder: st.jaas ? 'A private key is saved. Paste a new one to replace it' : 'Paste the private key (-----BEGIN PRIVATE KEY----- …)', 'aria-label': 'JaaS private key' });
    const save = h('button', { class: 'btn pri', onclick: async () => {
      if (!app.value.trim() || !kid.value.trim() || (!st.jaas && !pem.value.trim())) return toast('Fill in the App ID, the key ID and the private key');
      const done = busy(save, 'Saving…');
      const { error } = await sb.rpc('set_huddle_keys', { ws: S.ws.id, app: app.value.trim(), kid: kid.value.trim(), pem: pem.value.trim() || null }); done();
      if (error) return toast(errText(error)); toast('In-app huddles are on'); draw();
    } }, st.jaas ? 'Save' : 'Turn on');
    const off = st.jaas ? h('button', { class: 'btn ghost danger', onclick: async () => { const { error } = await sb.rpc('set_huddle_keys', { ws: S.ws.id, app: '', kid: '', pem: '' }); if (error) return toast(errText(error)); toast('Huddles open in Jitsi again'); draw(); } }, 'Turn off') : null;
    box.replaceChildren(
      h('p', { class: 'note', text: st.jaas ? 'On: huddles open inside Ovrto for everyone in this workspace.' : 'Now: the Huddle button opens a free Jitsi room (on the iPhone the first time it asks for the free Jitsi Meet app). To have huddles open inside Ovrto instead, make a free JaaS account (8x8, free up to 25 people a month) and paste its keys here.' }),
      h('a', { href: 'https://jaas.8x8.vc/', target: '_blank', rel: 'noopener', class: 'link', text: 'Open JaaS (jaas.8x8.vc) → API keys' }),
      h('label', { class: 'field' }, 'App ID', app), h('label', { class: 'field' }, 'API key ID', kid), h('label', { class: 'field' }, 'Private key', pem),
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, save, off),
      h('p', { class: 'note sm', text: 'The private key is stored in a locked place nobody can read, not even admins. Only the alert function uses it to let people into a huddle.' }));
  };
  draw();
  return box;
}

