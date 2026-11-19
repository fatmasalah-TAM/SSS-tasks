/* ═════════════ AI that understands Franco / Arabic / English, and voice notes ═════════════ */
var aiOn = null; // { ws, enabled }
async function aiReady() {
  if (aiOn && aiOn.ws === S.ws?.id) return aiOn.enabled;
  const a = await aiStatus().catch(() => ({ enabled: false }));
  aiOn = a.enabled ? { ws: S.ws?.id, enabled: true } : null; return !!a.enabled; // only remember "on", so turning it on works at once
}
function aiCtx() {
  return { types: S.types.map(t => ({ name: t.name, sections: t.template || [], bug: !!t.is_bug })),
    fields: S.fields.filter(f => ['select', 'multi'].includes(f.kind)).map(f => ({ name: f.name, multi: f.kind === 'multi', options: (f.options || []).map(o => o.label) })),
    people: S.members.map(m => dname(prof(m.user_id))).filter(Boolean) };
}
/** text and/or a recorded voice note → { draft } or { error } */
async function aiDraft({ text, audio } = {}) {
  if (!(await aiReady())) return { error: isAdmin() ? 'AI is off. Turn it on in Settings → AI (free Gemini key).' : 'AI is off. Ask your admin to turn it on in Settings → AI.' };
  track(audio ? 'ai_voice' : 'ai_write');
  const body = { op: 'draft', ws: S.ws.id, text: text || '', ctx: aiCtx(), lang: 'en' };
  if (audio) body.audio = { mime: audio.type || 'audio/wav', data: await blobB64(audio) };
  const res = await withTimeout(sb.functions.invoke('notify', { body }), 100000).catch(() => ({ timedOut: true }));
  if (res.timedOut) return { error: 'The AI took too long. Try again (shorter voice notes are faster).' };
  const { data, error } = res;
  if (error || !data?.draft) return { error: data?.error || (error && /Function not found|404/.test(error.message || '') ? 'The notify function isn’t deployed yet.' : 'AI didn’t answer. Check your connection and try again.') };
  return { draft: data.draft };
}
function withTimeout(p, ms) { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout')), ms); })]).finally(() => clearTimeout(t)); }

/* tasks stay readable for everyone (and the CEO): Franco typed into a new task becomes clear English. Chat keeps Franco. */
const FRANCO = new Set('ana enta enti ehna e7na howa heya hia homma mesh msh mish el fel fl 3al 3ala keda kda kedda 3shan 3ashan ashan alashan lazem lazm 3ayez 3ayz 3ayza 3ayzen 3ayzeen 3awz 3awza a3ml a3mel e3ml e3mel n3ml ne3mel y3ml ye3mel 2ol 2oli oly olt olna fe feh fih feeh fiha leeh leh lih ezay izay ezzay emta imta dlw2ty dlwa2ty delwa2ty delwa2ti tyb tayeb kman kaman lessa lsa lesa m3a ma3a m3 yb2a yeb2a b2a ba2a bt3 bta3 bta3t mafesh mafish mfesh elly eli illi 7aga 7agat haga hagat sha8al sha8ala shaghal mestnyen mstnyen mestanyeen 3ayzeen enohm enhom enaha eno enaha dah dh deh dool kol kolo ma3lsh m3lsh 5alas 5las tamam bardo bardu brdo lel lal le ly wala walla aw momken mumkin el7 ya3ni y3ny 3lshan mn men2 3and 3nd 3ndna 3ando'.split(' '));
function looksFranco(text) {
  const words = String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  if (words.length < 2) return false;
  let hits = 0;
  for (const w of words) if (FRANCO.has(w) || (/[a-z]/.test(w) && /[235789][a-z]/.test(w) && !/^\d+[a-z]{1,2}$/.test(w))) hits++;
  return hits >= 2 && hits / words.length >= 0.25;
}
async function cleanFranco(local) {
  if (!(await aiReady())) return;
  const orig = { title: local.title, description: local.description || '' };
  const res = await withTimeout(sb.functions.invoke('notify', { body: { op: 'clean', ws: S.ws.id, title: orig.title, description: orig.description } }), 70000).catch(() => null);
  const d = res?.data; if (!d || d.error || !d.title) return;
  const t = taskOf(local.id); if (!t || t.title !== orig.title || (t.description || '') !== orig.description) return; // someone changed it meanwhile: leave it
  const next = { title: String(d.title).slice(0, 200), description: typeof d.description === 'string' ? d.description : orig.description };
  if (next.title === orig.title && next.description === orig.description) return;
  if (await patchTask(local.id, next)) toast('Rewrote the Franco in clear English', { label: 'Undo', fn: () => patchTask(local.id, orig) }, 8000);
}
function blobB64(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(blob); }); }
const PRIO_WORD = { urgent: 1, high: 2, medium: 3, low: 4 };
/** put an AI draft into the New task form state */
function applyDraft(st, d, titleEl) {
  if (d.title) titleEl.value = d.title;
  const ty = d.type && matchType(d.type); if (ty) st.type_id = ty.id;
  const tmpl = tyOf(st.type_id)?.template || []; const extra = [];
  st.secs = {};
  for (const [k, v] of Object.entries(d.sections || {})) { const s = tmpl.find(x => norm(x) === norm(k)); if (s) st.secs[s] = v; else extra.push(`${k}: ${v}`); }
  if (d.description) extra.unshift(d.description);
  if (tmpl.length) st.extraDesc = extra.join('\n\n'); else st.secs[''] = extra.join('\n\n');
  if (Object.values(st.secs).some(v => String(v || '').trim()) || st.extraDesc) st.showDetails = true;
  if (PRIO_WORD[d.priority]) st.priority = PRIO_WORD[d.priority];
  if (d.developer) { const pid = matchPerson(d.developer); if (pid) { st.assignee_id = pid; st.assigneeManual = true; } }
  for (const [fname, v] of Object.entries(d.fields || {})) {
    const f = S.fields.find(x => norm(x.name) === norm(fname)); if (!f || !['select', 'multi'].includes(f.kind)) continue;
    const vals = (Array.isArray(v) ? v : [v]).map(x => matchLabel(String(x), f.options || [], o => o.label)?.o?.id).filter(Boolean);
    if (vals.length) st.fields[f.id] = f.kind === 'multi' ? vals : vals[0];
  }
  st.aiNote = [d.transcript ? `You said: “${d.transcript}”` : '', d.note || ''].filter(Boolean).join(' · ');
}

/* ── recording: microphone → 16 kHz mono WAV (works on iPhone Safari too) ── */
/* Recording that works on iPhone too: the audio context is made inside the tap (Safari keeps it asleep otherwise),
   the timer runs from the clock, and two recorders run together: raw sound → WAV, and the phone's own recorder
   (mp4 on iPhone, webm elsewhere) as a backup if the raw sound never arrives. */
function audioCtxNow() { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; try { const a = new A(); a.resume?.().catch(() => {}); return a; } catch (e) { return null; } }
function recMime() { if (!window.MediaRecorder?.isTypeSupported) return window.MediaRecorder ? '' : null; return ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/aac'].find(m => MediaRecorder.isTypeSupported(m)) ?? ''; }
async function startRecording({ onLevel, max = 120, onMax, ctx } = {}) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser can’t record. Open Ovrto from the Home Screen or in Safari/Chrome.');
  const a = ctx || audioCtxNow();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } }); }
  catch (e) { a?.close?.().catch(() => {}); throw e; }
  if (a && a.state === 'suspended') await a.resume().catch(() => {});
  const t0 = Date.now(); let done = false; let level = 0.05;
  // the level meter (only for show; the recording doesn't depend on it)
  let analyser = null, src = null;
  if (a) { try { src = a.createMediaStreamSource(stream); analyser = a.createAnalyser(); analyser.fftSize = 1024; src.connect(analyser); } catch (e) { analyser = null; } }
  const buf = analyser ? new Float32Array(analyser.fftSize) : null;
  const tick = setInterval(() => {
    if (done) return;
    if (analyser) { analyser.getFloatTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i += 4) s += buf[i] * buf[i]; level = Math.min(1, Math.sqrt(s / (buf.length / 4)) * 6); }
    onLevel?.(level, (Date.now() - t0) / 1000);
  }, 150);
  const limit = setTimeout(() => onMax?.(), max * 1000);
  // two recorders at once: raw sound → WAV (what the AI reads best) and the phone's own recorder as a backup
  const mime = recMime(); let mr = null; const parts = [];
  if (mime !== null) { try { mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); mr.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); }; mr.start(500); } catch (e) { mr = null; } }
  let pcm = null;
  if (a) { try { const proc = a.createScriptProcessor(4096, 1, 1); pcm = { proc, chunks: [], len: 0 };
    proc.onaudioprocess = e => { if (done) return; const d = new Float32Array(e.inputBuffer.getChannelData(0)); pcm.chunks.push(d); pcm.len += d.length; };
    (src || a.createMediaStreamSource(stream)).connect(proc); proc.connect(a.destination); } catch (e) { pcm = null; } }
  if (!mr && !pcm) { clearInterval(tick); clearTimeout(limit); stream.getTracks().forEach(t => t.stop()); a?.close?.().catch(() => {}); throw new Error('This browser can’t record. Open Ovrto in Safari or Chrome.'); }
  const close = () => { done = true; clearTimeout(limit); clearInterval(tick); try { pcm?.proc.disconnect(); src?.disconnect(); } catch {} stream.getTracks().forEach(t => t.stop()); a?.close?.().catch(() => {}); };
  return {
    async stop() {
      const seconds = Math.round((Date.now() - t0) / 1000);
      const mrBlob = mr ? await new Promise(res => { const make = () => res(new Blob(parts, { type: (mr.mimeType || mime || 'audio/mp4').split(';')[0] })); mr.onstop = make; try { mr.state !== 'inactive' ? mr.stop() : make(); } catch (e) { make(); } }) : null;
      const rate = a?.sampleRate || 48000; const got = pcm ? pcm.len / rate : 0;
      close();
      if (pcm && got >= 0.5) { const out = new Float32Array(pcm.len); let o = 0; for (const c of pcm.chunks) { out.set(c, o); o += c.length; } return { blob: wavBlob(downsample(out, rate, 16000), 16000), seconds: Math.max(Math.round(got), 1) }; }
      if (mrBlob && mrBlob.size > 1000) return { blob: mrBlob, seconds };
      return { blob: null, seconds: 0, silent: seconds >= 2 };
    },
    cancel() { try { mr && mr.state !== 'inactive' && mr.stop(); } catch {} close(); },
  };
}
function downsample(pcm, from, to) {
  if (from === to) return pcm;
  const r = from / to, n = Math.floor(pcm.length / r), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const s = Math.floor(i * r), e = Math.min(pcm.length, Math.floor((i + 1) * r)); let sum = 0; for (let j = s; j < e; j++) sum += pcm[j]; out[i] = sum / Math.max(1, e - s); }
  return out;
}
function wavBlob(pcm, rate) {
  const b = new ArrayBuffer(44 + pcm.length * 2), v = new DataView(b); const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) { const s = Math.max(-1, Math.min(1, pcm[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
  return new Blob([b], { type: 'audio/wav' });
}
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
/** the recording sheet: big timer, live level bars, Done / Cancel. Resolves { blob, seconds } or null */
function recordVoice(title = 'Voice note') {
  const ctx = audioCtxNow(); // inside the tap, so Safari lets it run
  return new Promise(res => {
    let rec = null, finished = false;
    const finish = v => { if (finished) return; finished = true; res(v); };
    openSheet({ title, kind: 'center', key: 'record', stack: !!currentSheet(), onClose: () => { if (rec && !finished) { rec.cancel(); finish(null); } else { if (!rec) ctx?.close?.().catch(() => {}); finish(null); } }, build: async sh => {
      const bars = h('div', { class: 'rec-bars', 'aria-hidden': 'true' }, ...Array.from({ length: 24 }, () => h('i')));
      const time = h('div', { class: 'rec-time', text: '0:00' });
      const status = h('p', { class: 'note', text: 'Allow the microphone if your phone asks. Speak in English, Arabic or Franco — up to 2 minutes.' });
      const stopBtn = h('button', { class: 'btn pri lg', 'aria-label': 'Done recording', disabled: true }, icon('check', 18), 'Done');
      const body = h('div', { class: 'sbody rec' }, h('div', { class: 'rec-dot' }), time, bars, status);
      sh.append(body, h('div', { class: 'sfoot' }, h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), h('span', { class: 'sp' }), stopBtn));
      const levels = new Array(24).fill(0.05);
      const done = async () => { if (!rec || finished) return; const r0 = rec; rec = null; stopBtn.disabled = true; const out = await r0.stop(); if (out.seconds < 1 || !out.blob) { finish(null); closeSheet(true); return toast(out.silent ? 'No sound reached Ovrto. Close any app using the microphone (like screen recording with sound), then try again.' : 'That was too short — hold on a little longer.'); } finish(out); closeSheet(true); };
      stopBtn.addEventListener('click', done);
      try {
        rec = await startRecording({ ctx, onMax: () => { toast('2 minutes reached — saved.'); done(); }, onLevel: (lv, t) => {
          levels.shift(); levels.push(Math.max(0.05, lv)); time.textContent = mmss(t);
          bars.childNodes.forEach((b, i) => { b.style.transform = `scaleY(${levels[i]})`; });
        } });
        body.classList.add('on'); stopBtn.disabled = false; status.textContent = 'Recording… tap Done when you finish.';
      } catch (e) {
        status.textContent = /denied|NotAllowed|Permission/i.test(e?.name + e?.message) ? 'The microphone is blocked. Allow it for Ovrto in your phone’s Settings → Safari → Microphone, then try again.' : (e?.message || 'Couldn’t start the microphone.');
        status.classList.add('err');
      }
    } });
  });
}

