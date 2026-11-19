/* ═════════════ React bridge: pages already moved to React read the app's state and call its actions through window.__ovrto ═════════════
   React pages live in src/react/ and are drawn inside this page: `reactView('name')` returns the nodes a view function returns.
   Only what a React page needs is listed here. When a page moves, what it used from this file is the next thing to move. */
window.__ovrto = {
  S, ICONS, sb, insightsState,
  uid: () => uid(), isAdmin: () => isAdmin(), isPhone: () => isPhone(), isAr: () => isAr(),
  prof: id => prof(id), dname: p => dname(p), initials: p => initials(p), hashColor: id => hashColor(id),
  stOf: id => stOf(id), catOf: t => catOf(t), isClosed: t => isClosed(t), taskOf: id => taskOf(id),
  illFor: label => ILLS[ILL_FOR(label || '')] || null,
  render: () => render(), go: r => go(r), toast: (m, a, ms) => toast(m, a, ms), track: f => track(f),
  openFinished: days => { S.vc = Object.assign(BUILTIN.all.config(), { filters: [{ f: 'finished', op: 'any', v: [String(days)] }], layout: 'list' }); go({ v: 'all' }, true); },
  openWeeklyReport: () => openWeeklyReport(), openSearch: () => cmdk.open(), viewSwitcher: () => viewSwitcher(),
  loadInsightActs: () => loadInsightActs(),
  // not moved yet: React draws these through the old code (see LegacyNode)
  legacy: { taskRow: t => taskRow(t), bellButton: () => bellButton() },
};
function reactView(name, fallbackTitle) {
  if (window.OvrtoReact?.has(name)) return window.OvrtoReact.view(name);
  return [pageHead(fallbackTitle || name), h('div', { class: 'scroll' }, emptyState('ERROR', 'This page could not load. Reload the app, and if it keeps happening tell the team.', null))];
}
