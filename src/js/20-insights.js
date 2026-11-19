/* ═════════════ Insights: the page is React now (src/react/pages/Insights.tsx). What stays here is shared with the Weekly report. ═════════════ */
var insightsState = { days: 30, acts: null, loadedFor: null, loading: false };
async function loadInsightActs() {
  const key = S.ws.id + ':' + S.tasks.length + ':' + S.tasks.reduce((m, t) => (t.updated_at > m ? t.updated_at : m), '');
  if (insightsState.loadedFor === key || insightsState.loading) return;
  insightsState.loading = true;
  const ids = S.tasks.map(t => t.id); const out = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await sb.from('activity').select('*').in('task_id', ids.slice(i, i + 150));
    if (error) { insightsState.loading = false; insightsState.error = errText(error); render(); return; }
    out.push(...(data || []));
  }
  insightsState.acts = out; insightsState.loadedFor = key; insightsState.loading = false; insightsState.error = null;
  if (S.route.v === 'insights') render();
}
function viewInsights() { return reactView('insights', 'Insights'); }
