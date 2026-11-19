var LANG = (() => { try { return JSON.parse(localStorage.getItem('baton.lang') || '"en"') === 'ar' ? 'ar' : 'en'; } catch { return 'en'; } })();
const isAr = () => LANG === 'ar';
var I18N_SKIP = '.row .t,.tc:not(.waitrow) .tt>b,.card>.t,.inrow .t,.stuck-row .t,.rv-item .t,.md,.mdbox,.mbody,.ev .txt,.ttl,textarea,input,select,[contenteditable],code,pre,kbd,.notr,.wordmark,.wm-anim,.mark-anim,.plate,.cp-t b,.cp-in>h1,.mhead b,.cv-name b,.chip-task,.mention,.toast .notr,.cl-row .nm>div:first-child,.prow .nm>div:first-child';
var I18N = (() => {
  const exact = new Map(Object.entries(AR.exact || {}));
  const pats = (AR.patterns || []).map(([re, to]) => { try { return [new RegExp(re, 'u'), to]; } catch { return null; } }).filter(Boolean);
  const cache = new Map(); const made = new Set(exact.values());
  const hasLatin = /[A-Za-z]/;
  function tr(s) {
    if (!s) return s;
    if (cache.has(s)) return cache.get(s);
    let out = exact.get(s);
    if (out == null && !hasLatin.test(s)) { cache.set(s, s); return s; } // punctuation like ", " still gets its Arabic form
    if (out == null) {
      const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/); const core = m[2];
      let t = exact.get(core);
      if (t == null) for (const [re, to] of pats) { if (re.test(core)) { t = core.replace(re, to); break; } }
      out = t == null ? s : m[1] + t + m[3];
    }
    if (cache.size > 6000) cache.clear();
    cache.set(s, out); if (out !== s) made.add(out);
    return out;
  }
  const ATTRS = ['placeholder', 'aria-label', 'title', 'data-ph'];
  const skip = el => !el || el.closest?.(I18N_SKIP);
  function doText(n) {
    const p = n.parentElement; if (!p || skip(p)) return;
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
    if (skip(root) && !root.matches?.('input,textarea,select')) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: n => n.nodeType === 1 && n.matches('script,style,svg') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let n; while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  let obs = null;
  function start() {
    if (obs || !isAr()) return;
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
