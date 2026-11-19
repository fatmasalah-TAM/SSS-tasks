/* ═════════════ Motion: every page arrives, every touch answers ═════════════
   Only when you move somewhere (not on live updates), so the screen never twitches while you read. */
let motionKey = '';
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function motionIn(app) {
  const k = JSON.stringify(S.route); if (k === motionKey) return; const first = !motionKey; motionKey = k;
  if (calm()) return;
  const sc = $('.main .scroll', app); sc?.classList.add('enter');
  const items = $$('.main :is(.card,.row,.pjrow,.pjcard,.pjnum,.leavebar,.vcard,.colhead,.empty)', app).slice(0, 18);
  items.forEach((el, i) => { el.style.animationDelay = (first ? 150 : 0) + i * 22 + 'ms'; el.classList.add('itemin'); });
  app.classList.add('moved');
  setTimeout(() => { app.classList.remove('moved'); sc?.classList.remove('enter'); items.forEach(el => { el.classList.remove('itemin'); el.style.animationDelay = ''; }); }, 1000);
}
/* a soft ripple from exactly where you touched */
const RIPPLE = '.btn,.card,.row,.pjrow,.pjcard,.pjnum,.opt,.leavebar,.chipbtn,.kindopt,.navi,.gsearch,.more-i';
addEventListener('pointerdown', e => {
  if (calm() || e.button > 0) return; const t = e.target.closest?.(RIPPLE); if (!t || t.disabled) return;
  const r = t.getBoundingClientRect(); const d = Math.max(r.width, r.height) * 2.2;
  if (getComputedStyle(t).position === 'static') t.style.position = 'relative';
  const box = h('span', { class: 'ripple-box' }); const dot = h('span', { class: 'ripple', style: { width: d + 'px', height: d + 'px', left: e.clientX - r.left - d / 2 + 'px', top: e.clientY - r.top - d / 2 + 'px' } });
  box.append(dot); t.append(box); setTimeout(() => box.remove(), 600);
}, { passive: true });
addEventListener('touchstart', () => {}, { passive: true }); // lets :active work on iPhone

