/* ═════════════ keyboard ═════════════ */
addEventListener('keydown', e => {
  if (!S.session || !S.ws) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); cmdk.isOpen ? cmdk.close() : cmdk.open(); return; }
  if (e.key === 'Escape') { if (cmdk.isOpen) return cmdk.close(); if (document.querySelector('.pop')) return closePop(); if (currentSheet() && !tours.running) { if (isTyping()) document.activeElement.blur(); else closeSheet(); } return; }
  if (isTyping() || e.metaKey || e.ctrlKey || e.altKey || cmdk.isOpen || tours.running) return;
  if (currentSheet()) return;
  if (e.key === 'c') { e.preventDefault(); openCreate(); }
  else if (e.key === '/') { e.preventDefault(); const q = $('#q'); if (q) q.focus(); else cmdk.open(); }
  else if (S.route.v === 'review' && !isPhone()) {
    const q = reviewQueue(); if (!q.length) return;
    if (e.key === 'j') { reviewIdx = Math.min(q.length - 1, reviewIdx + 1); render(); }
    else if (e.key === 'k') { reviewIdx = Math.max(0, reviewIdx - 1); render(); }
    else if (e.key === 'p') passTask(q[reviewIdx]);
    else if (e.key === 'b') sendBack(q[reviewIdx]);
    else if (e.key === 'Enter') openTask(q[reviewIdx].id);
  }
});

