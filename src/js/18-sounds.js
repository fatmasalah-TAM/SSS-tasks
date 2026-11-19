/* ═════════════ sounds: huddle ringtones, message sounds, the incoming-huddle screen ═════════════ */
// Every tone is synthesised with Web Audio, so there are no sound files to upload.
var soundLog = [];
var actx = null;
function audio() {
  if (!actx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; actx = new A(); }
  if (actx.state === 'suspended') actx.resume().catch(() => {});
  return actx;
}
// phones only allow sound after a tap: wake the audio on the first touch of each visit
['pointerdown', 'keydown', 'touchend'].forEach(ev => addEventListener(ev, function unlock() { const a = audio(); if (a) { const b = a.createBuffer(1, 1, 22050); const s = a.createBufferSource(); s.buffer = b; s.connect(a.destination); s.start(0); } removeEventListener(ev, unlock, true); }, true));

function note(a, out, t, f, d, o = {}) {
  const osc = a.createOscillator(), g = a.createGain();
  osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + d);
  const v = o.gain ?? 0.22, at = o.attack ?? 0.008;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + at); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + d + 0.05);
}
const bell = (a, o, t, f, d, v = 0.2) => { note(a, o, t, f, d, { gain: v }); note(a, o, t, f * 2.76, d * 0.5, { gain: v * 0.35 }); note(a, o, t, f * 5.4, d * 0.25, { gain: v * 0.12 }); };
const mallet = (a, o, t, f, d, v = 0.25) => { note(a, o, t, f, d, { gain: v, attack: 0.004 }); note(a, o, t, f * 4, d * 0.18, { gain: v * 0.3, attack: 0.002 }); };
// each ringtone: what one ring sounds like, and how long before it rings again
var RINGTONES = {
  ovrto:   { name: 'Ovrto (passing it on)', every: 2.2, play: (a, o, t) => { [[784, 0], [1047, 0.13], [1319, 0.26], [1568, 0.42]].forEach(([f, s]) => mallet(a, o, t + s, f, 0.5)); } },
  marimba: { name: 'Marimba', every: 2.0, play: (a, o, t) => { [[659, 0], [784, 0.15], [988, 0.3], [784, 0.45], [1319, 0.62]].forEach(([f, s]) => mallet(a, o, t + s, f, 0.42, 0.28)); } },
  classic: { name: 'Classic phone', every: 3.0, play: (a, o, t) => { for (const s of [0, 0.6]) { note(a, o, t + s, 400, 0.42, { gain: 0.12, attack: 0.02 }); note(a, o, t + s, 450, 0.42, { gain: 0.12, attack: 0.02 }); } } },
  chime:   { name: 'Chime', every: 2.6, play: (a, o, t) => { bell(a, o, t, 1047, 1.6); bell(a, o, t + 0.45, 784, 1.8); } },
  pulse:   { name: 'Pulse', every: 1.6, play: (a, o, t) => { [0, 0.18, 0.36].forEach(s => note(a, o, t + s, 880, 0.14, { type: 'triangle', gain: 0.2 })); } },
  retro:   { name: 'Retro (8-bit)', every: 2.0, play: (a, o, t) => { [[523, 0], [659, 0.11], [784, 0.22], [1047, 0.33], [784, 0.5], [1047, 0.61]].forEach(([f, s]) => note(a, o, t + s, f, 0.1, { type: 'square', gain: 0.12 })); } },
  soft:    { name: 'Soft', every: 3.0, play: (a, o, t) => { note(a, o, t, 523, 1.1, { gain: 0.16, attack: 0.15 }); note(a, o, t + 0.5, 659, 1.3, { gain: 0.14, attack: 0.15 }); } },
  bright:  { name: 'Bright', every: 1.8, play: (a, o, t) => { [[1175, 0], [1568, 0.1], [1175, 0.2], [1568, 0.3]].forEach(([f, s]) => bell(a, o, t + s, f, 0.35, 0.14)); } },
};
var MSG_SOUNDS = {
  pop:  { name: 'Pop', play: (a, o, t) => note(a, o, t, 520, 0.12, { to: 980, gain: 0.25 }) },
  ding: { name: 'Ding', play: (a, o, t) => bell(a, o, t, 1319, 0.7, 0.16) },
  knock:{ name: 'Knock', play: (a, o, t) => { note(a, o, t, 180, 0.08, { gain: 0.35, attack: 0.002 }); note(a, o, t + 0.12, 160, 0.08, { gain: 0.3, attack: 0.002 }); } },
  drop: { name: 'Water drop', play: (a, o, t) => note(a, o, t, 1400, 0.16, { to: 500, gain: 0.22 }) },
  off:  { name: 'No sound', play: () => {} },
};
const soundPref = () => Object.assign({ ring: 'ovrto', msg: 'pop', channelRing: false, vibrate: true, volume: 0.8 }, store.get('sounds', {}));
function setSoundPref(p) { store.set('sounds', Object.assign(soundPref(), p)); }

/** play a tone once (or ringing, until stopped); returns stop() */
function playTone(kind, id, { loop = false } = {}) {
  const set = kind === 'ring' ? RINGTONES : MSG_SOUNDS; const tone = set[id] || set[kind === 'ring' ? 'ovrto' : 'pop'];
  soundLog.push(kind + ':' + id);
  const a = audio(); if (!a || id === 'off') return () => {};
  const out = a.createGain(); out.gain.value = soundPref().volume; out.connect(a.destination);
  let timer = null, stopped = false;
  const ring = () => { if (stopped) return; tone.play(a, out, a.currentTime + 0.03); if (loop) timer = setTimeout(ring, (tone.every || 2) * 1000); };
  ring();
  return () => { stopped = true; clearTimeout(timer); try { out.gain.setTargetAtTime(0.0001, a.currentTime, 0.05); setTimeout(() => out.disconnect(), 300); } catch {} };
}

/* ── when a message or huddle arrives while the app is open ── */
var ringing = null;
function onChatArrive(m) {
  if (!m || m.author_id === uid() || Date.now() - new Date(m.created_at) > 90e3) return;
  const c = chOf(m.channel_id); if (!c) return;
  const pref = soundPref();
  if (m.kind === 'huddle') {
    if (c.kind === 'dm' || pref.channelRing) return incomingHuddle(m, c);
    playTone('msg', pref.msg === 'off' ? 'off' : 'ding');
    return toast(`${first(prof(m.author_id)) || 'Someone'} started a huddle in #${c.name}`, { label: 'Join', fn: () => joinHuddle(c.id) }, 12000);
  }
  const forMe = c.kind === 'dm' || (m.mentions || []).includes(uid()) || (m.parent_id && S.messages.some(x => (x.id === m.parent_id || x.parent_id === m.parent_id) && x.author_id === uid()));
  const looking = S.route.v === 'chat' && S.route.id === c.id && document.visibilityState === 'visible';
  if (forMe && !looking) playTone('msg', pref.msg);
}
function incomingHuddle(m, c) {
  stopRinging();
  const who = prof(m.author_id); const pref = soundPref();
  const stop = playTone('ring', pref.ring, { loop: true });
  if (pref.vibrate && navigator.vibrate) { try { navigator.vibrate([400, 200, 400, 200, 400]); } catch {} }
  const done = how => {
    if (!ringing) return; clearTimeout(ringing.timer); clearInterval(ringing.watch); ringing.stop(); ringing.el.remove(); ringing = null;
    try { navigator.vibrate?.(0); } catch {}
    if (how === 'join') joinHuddle(c.id);
    if (how === 'missed') toast(`Missed huddle from ${first(who) || 'a teammate'}`, liveHuddle(c.id) ? { label: 'Join', fn: () => joinHuddle(c.id) } : null, 10000);
  };
  const el = h('div', { class: 'ring-ov', role: 'alertdialog', 'aria-label': 'Incoming huddle' },
    h('div', { class: 'ring-card' },
      h('div', { class: 'ring-av' }, avatar(who, { size: 'xl' })),
      h('b', { class: 'ring-who', text: dname(who) || 'A teammate' }),
      h('span', { class: 'ring-what', text: c.kind === 'dm' ? 'is calling you · huddle' : `started a huddle in #${c.name}` }),
      h('div', { class: 'ring-btns' },
        h('button', { class: 'ring-no', 'aria-label': 'Decline', onclick: () => done('no') }, icon('x', 26)),
        h('button', { class: 'ring-yes', 'aria-label': 'Join', onclick: () => done('join') }, icon('headset', 26)))));
  document.body.append(el);
  ringing = { el, stop, timer: setTimeout(() => done('missed'), 30000), watch: setInterval(() => { if (!liveHuddle(c.id)) done('ended'); }, 1500), channel: c.id };
}
function stopRinging() { if (ringing) { clearTimeout(ringing.timer); clearInterval(ringing.watch); ringing.stop(); ringing.el.remove(); ringing = null; } }

/* ── settings → Sounds ── */
function soundsPanel() {
  const box = h('div', { class: 'pbody' });
  let preview = null;
  const draw = () => {
    const p = soundPref();
    const row = (kind, id, t) => {
      const on = (kind === 'ring' ? p.ring : p.msg) === id;
      return h('div', { class: 'snd-row' + (on ? ' on' : '') },
        h('label', { class: 'check' }, h('input', { type: 'radio', name: 'snd-' + kind, checked: on, 'aria-label': t.name, onchange: () => { setSoundPref(kind === 'ring' ? { ring: id } : { msg: id }); preview?.(); preview = playTone(kind, id); setTimeout(() => preview?.(), 2600); draw(); } }), h('span', { text: t.name })),
        id === 'off' ? null : h('button', { class: 'btn sm ghost', 'aria-label': 'Play ' + t.name, onclick: () => { preview?.(); preview = playTone(kind, id); setTimeout(() => preview?.(), 2600); } }, '▶ Play'));
    };
    box.replaceChildren(
      h('h4', { class: 'snd-h', text: 'Huddle ringtone' }),
      h('p', { class: 'note', text: 'Rings when someone starts a huddle with you, while Ovrto is open. When the app is closed, your phone shows the alert with its normal sound.' }),
      h('div', { class: 'snd-list' }, ...Object.entries(RINGTONES).map(([id, t]) => row('ring', id, t))),
      h('label', { class: 'check', style: { marginTop: '6px' } }, h('input', { type: 'checkbox', checked: p.channelRing, onchange: e => setSoundPref({ channelRing: e.target.checked }) }), h('span', { text: 'Also ring for huddles in channels (not just direct messages)' })),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: p.vibrate, onchange: e => setSoundPref({ vibrate: e.target.checked }) }), h('span', { text: 'Vibrate too (where the phone allows it)' })),
      h('h4', { class: 'snd-h', text: 'Message sound' }),
      h('p', { class: 'note', text: 'Plays for direct messages, @mentions and replies in your threads.' }),
      h('div', { class: 'snd-list' }, ...Object.entries(MSG_SOUNDS).map(([id, t]) => row('msg', id, t))),
      h('label', { class: 'field', style: { maxWidth: '320px' } }, 'Volume', h('input', { type: 'range', min: '0.1', max: '1', step: '0.1', value: String(p.volume), 'aria-label': 'Volume', onchange: e => { setSoundPref({ volume: Number(e.target.value) }); playTone('msg', soundPref().msg === 'off' ? 'pop' : soundPref().msg); } })),
      h('p', { class: 'note sm', text: 'Saved on this device, so your phone and laptop can sound different.' }));
  };
  draw();
  return box;
}

