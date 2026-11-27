var LANG = (() => { try { return JSON.parse(localStorage.getItem('baton.lang') || '"en"') === 'ar' ? 'ar' : 'en'; } catch { return 'en'; } })();
const isAr = () => LANG === 'ar';
var I18N_SKIP = '.row .t,.tc:not(.waitrow) .tt>b,.card>.t,.inrow .t,.stuck-row .t,.rv-item .t,.md,.mdbox,.mbody,.ev .txt,.ttl,textarea,input,select,[contenteditable],code,pre,kbd,.notr,.wordmark,.wm-anim,.mark-anim,.plate,.cp-t b,.cp-in>h1,.mhead b,.cv-name b,.chip-task,.mention,.toast .notr,.cl-row .nm>div:first-child,.prow .nm>div:first-child';
/* the company's own words: a clinic says Patient instead of Client, a workshop says Job instead of Task.
   Swapped in the interface text only (never in what people write), in English and, if given, in Arabic. */
var WORDS = (() => {
  let w = null; try { w = JSON.parse(localStorage.getItem('baton.words') || 'null'); } catch {}
  const rules = [];
  const cap = x => x.charAt(0).toUpperCase() + x.slice(1);
  const AR_BASE = { client: ['عميل', 'عملاء'], task: ['مهمة', 'مهام'], project: ['مشروع', 'مشاريع'] };
  const EN_BASE = { client: ['client', 'clients'], task: ['task', 'tasks'], project: ['project', 'projects'] };
  for (const k of ['client', 'task', 'project']) {
    const c = w && w[k]; if (!c) continue;
    const one = String(c.one || '').trim(), many = String(c.many || '').trim() || (one ? one + 's' : '');
    if (one && one.toLowerCase() !== EN_BASE[k][0]) {
      const [o, m] = EN_BASE[k];
      rules.push(['en', new RegExp(`\\b${cap(m)}\\b`, 'g'), cap(many)], ['en', new RegExp(`\\b${m}\\b`, "g"), many.toLowerCase()],
        ['en', new RegExp(`\\b${cap(o)}\\b`, 'g'), cap(one)], ['en', new RegExp(`\\b${o}\\b`, 'g'), one.toLowerCase()]);
    }
    const a1 = String(c.ar1 || '').trim(), am = String(c.arm || '').trim() || a1;
    if (a1) { const [o, m] = AR_BASE[k];
      rules.push(['ar', new RegExp(`(?<!\\p{L})([وبفل]?(?:ال|لل)?)${m}(?!\\p{L})`, 'gu'), `$1${am}`], ['ar', new RegExp(`(?<!\\p{L})([وبفل]?(?:ال|لل)?)${o}(?!\\p{L})`, 'gu'), `$1${a1}`]); }
  }
  const on = rules.length > 0;
  const apply = t => { if (!on || !t) return t; const ar = isAr(); for (const [l, re, to] of rules) if ((l === 'ar') === ar) t = t.replace(re, to); return t; };
  /* called once the workspace is known: if its words differ from the ones on this phone, keep them and redraw */
  function sync(ws) {
    const next = (ws && ws.departments && ws.departments.words) || null;
    if (JSON.stringify(next) === JSON.stringify(w)) return false;
    try { if (next) localStorage.setItem('baton.words', JSON.stringify(next)); else localStorage.removeItem('baton.words'); } catch { return false; }
    setTimeout(() => location.reload(), 120); return true;
  }
  return { on, apply, sync, get: () => w };
})();
var I18N = (() => {
  const exact = new Map(Object.entries(AR.exact || {}));
  const pats = (AR.patterns || []).map(([re, to]) => { try { const r = new RegExp(re, 'u'); return [r, to, new RegExp(r.source + '|', 'u').exec('').length - 1]; } catch { return null; } }).filter(Boolean);
  /* a piece the pattern keeps (a department, a page name) is translated too when it is itself interface text */
  const fill = (to, g) => to.replace(/\$(\d)/g, (_, i) => { const v = g[i - 1]; return v == null ? '' : (exact.get(v) ?? v); });
  const cache = new Map(); const made = new Set(exact.values());
  const hasLatin = /[A-Za-z]/;
  function tr(s) {
    if (!s) return s;
    if (cache.has(s)) return cache.get(s);
    let out = exact.get(s);
    if (out == null && !hasLatin.test(s) && !WORDS.on) { cache.set(s, s); return s; } // punctuation like ", " still gets its Arabic form
    if (out == null) {
      const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/); const core = m[2];
      let t = exact.get(core);
      if (t == null) for (const [re, to, n] of pats) { const g = core.match(re); if (g) { t = core.replace(re, fill(to, g.slice(1, n + 1))); break; } }
      out = t == null ? s : m[1] + t + m[3];
    }
    if (!isAr()) out = s; // English: only the company's words change
    out = WORDS.apply(out);
    if (cache.size > 6000) cache.clear();
    cache.set(s, out); if (out !== s) made.add(out);
    return out;
  }
  const ATTRS = ['placeholder', 'aria-label', 'title', 'data-ph'];
  const skip = el => !el || el.closest?.(I18N_SKIP);
  function doText(n) {
    const p = n.parentElement; if (!p) return;
    if (p.tagName === 'OPTION') { if (isAr()) { const t = exact.get(n.data.trim()); if (t && t !== n.data) n.data = t; } return; } // menu choices: exact interface words only, never names people typed
    if (skip(p)) return;
    const v = n.data; if (made.has(v)) return;
    const t = tr(v); if (t !== v) n.data = t;
  }
  function doAttrs(el) {
    if (el.closest?.('.wordmark,.wm-anim,.mark-anim,.notr,.chip-task') || (el.closest?.(I18N_SKIP) && !el.matches?.('input,textarea,select'))) return;
    for (const a of ATTRS) { const v = el.getAttribute?.(a); if (v && !made.has(v)) { const t = tr(v); if (t !== v) el.setAttribute(a, t); } }
  }
  function walk(root) {
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1) return;
    if (root.matches?.('script,style,svg')) return;
    doAttrs(root);
    if (root.matches?.('select')) { root.querySelectorAll('option').forEach(o => o.firstChild && doText(o.firstChild)); return; }
    if (skip(root) && !root.matches?.('input,textarea,select')) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: n => n.nodeType === 1 && n.matches('script,style,svg') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let n; while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else { doAttrs(n); if (n.tagName === 'SELECT') n.querySelectorAll('option').forEach(o => o.firstChild && doText(o.firstChild)); } }
  }
  let obs = null;
  function start() {
    if (obs || !(isAr() || WORDS.on)) return;
    walk(document.body);
    obs = new MutationObserver(list => {
      for (const m of list) {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') doAttrs(m.target);
        else m.addedNodes.forEach(walk);
      }
      if (document.title && !made.has(document.title)) { const t = tr(document.title); if (t !== document.title) document.title = t; }
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  return { tr, start, walk };
})();
function applyLang() {
  const r = document.documentElement;
  r.lang = isAr() ? 'ar' : 'en'; r.dir = isAr() ? 'rtl' : 'ltr';
  if (isAr() && !document.getElementById('ar-font')) document.head.append(h('link', { id: 'ar-font', rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap' }));
  if (document.body) I18N.start();
}
function setLang(l) {
  try { localStorage.setItem('baton.lang', JSON.stringify(l === 'ar' ? 'ar' : 'en')); } catch {}
  location.reload(); // simplest way to redraw everything in the new language
}
/** Settings → Me → Language */
function langPanel() {
  return h('div', { class: 'pbody' },
    h('div', { class: 'seg notr', role: 'group', 'aria-label': 'Language' },
      h('button', { 'aria-pressed': String(!isAr()), lang: 'en', onclick: () => !isAr() || setLang('en') }, 'English'),
      h('button', { 'aria-pressed': String(isAr()), lang: 'ar', dir: 'rtl', onclick: () => isAr() || setLang('ar') }, 'العربية')),
    h('p', { class: 'note', text: 'Changes the app’s buttons and menus on this device. What your team writes stays as written.' }));
}
applyLang();

})();
