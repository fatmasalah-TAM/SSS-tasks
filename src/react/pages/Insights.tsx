import { useEffect } from 'react';
import { ovrto } from '../bridge';
import { Avatar, EmptyState, Icon, LoadingRow, PageHead } from '../components/ui';
import { LegacyNode } from '../components/Legacy';
import { dur, insightsData, whoName } from '../lib/insights';

const PERIODS: [number, string][] = [[14, '2 weeks'], [30, '30 days'], [90, '90 days']];

function Kpi({ n, l, sub }: { n: string; l: string; sub?: string }) {
  return <div className="kpi"><b>{n}</b><span>{l}</span>{sub ? <span className="sm mute">{sub}</span> : null}</div>;
}

/** Where tasks waited, and for how long (built from each task's history). Admins only. */
export function Insights() {
  const o = ovrto(); const st = o.insightsState; const days = st.days; const phone = o.isPhone();
  const admin = o.isAdmin();
  // the history is loaded by the app (the Weekly report uses it too); it asks for a redraw when it arrives
  useEffect(() => { if (admin) { o.loadInsightActs(); o.track('insights'); } });

  if (!admin) {
    return <><PageHead title="Insights" /><div className="scroll"><EmptyState label="ADMINS" text="Insights are for workspace admins." /></div></>;
  }
  const seg = (
    <div className="seg" role="group" aria-label="Period">
      {PERIODS.map(([d, l]) => <button key={d} aria-pressed={String(days === d)} onClick={() => { st.days = d; o.render(); }}>{l}</button>)}
    </div>
  );
  const head = (
    <PageHead title="Insights" sub={<span>Where tasks waited, and for how long</span>} extra={seg}
      tools={<button className={'btn sm' + (phone ? ' icon' : '')} aria-label="Weekly report" title="Weekly report" onClick={() => o.openWeeklyReport()}><Icon k="export" size={14} />{phone ? null : 'Weekly report'}</button>} />
  );
  if (!st.acts) {
    return <>{head}<div className="scroll">{st.error ? <p className="note" style={{ padding: '20px' }}>{st.error}</p> : <LoadingRow label="Reading the history of every task…" />}</div></>;
  }
  const d = insightsData(days, st.acts);
  if (!d.people.length && !d.done) {
    return <>{head}<div className="scroll"><EmptyState label="INSIGHTS" text="Not enough history yet. Insights fill in as tasks move between people." /></div></>;
  }
  const max = Math.max(...d.people.map(p => p.ms), 1);
  return (
    <>
      {head}
      <div className="scroll">
        <div className="ins">
          <div className="kpis">
            <Kpi n={String(d.done)} l="tasks finished" sub={`in the last ${days} days`} />
            <Kpi n={dur(d.cycle)} l="typical time to finish" sub="from created to done (median)" />
            <Kpi n={String(d.handoffs)} l="handoffs" sub="“over to you” moments" />
            <Kpi n={String(d.stuck.length)} l="stuck now" sub="same person for 3+ days" />
          </div>
          <section className="card ins-card">
            <h3>Where tasks waited</h3>
            <p className="note">Total time tasks sat with each person (their turn), in this period.</p>
            {d.people.map(p => (
              <div className="bar-row" data-who={p.who} key={p.who}>
                {p.who === 'client' || p.who === 'admins'
                  ? <span className="av lg none"><span className="b">{p.who === 'client' ? '⏳' : '⚖'}</span></span>
                  : <Avatar p={o.prof(p.who)} size="lg" />}
                <div className="bar-main">
                  <div className="bar-top"><b>{whoName(p.who)}</b><span className="mono sm">{dur(p.ms)}</span></div>
                  <div className="bar"><i style={{ width: Math.max(2, Math.round((p.ms / max) * 100)) + '%', background: p.who === 'client' ? 'var(--amber)' : 'var(--accent)' }} /></div>
                  <div className="sm mute">{`${p.turns} handoff${p.turns === 1 ? '' : 's'} · longest ${dur(p.longest)}${p.turns ? ' · about ' + dur(p.ms / Math.max(1, p.turns)) + ' each' : ''}`}</div>
                </div>
              </div>
            ))}
          </section>
          <section className="card ins-card">
            <h3>Stuck now</h3>
            <p className="note">Open tasks that have been with the same person for more than 3 days.</p>
            {d.stuck.length
              ? <div className="list">{d.stuck.slice(0, 15).map(t => (
                  <div className="stuck-row" key={t.id}>
                    <LegacyNode make={() => o.legacy.taskRow(t)} />
                    <span className="meta red">{`${whoName(t.turn_owner!)} · ${dur(Date.now() - new Date(t.turn_since).getTime())}`}</span>
                  </div>
                ))}</div>
              : <p className="mute">Nothing is stuck. 🎉</p>}
          </section>
          <section className="card ins-card">
            <h3>Sent back after review</h3>
            <p className="note">How often each developer’s work came back from review in this period.</p>
            {d.sendbacks.length
              ? <div>{d.sendbacks.map(([u, n]) => (
                  <div className="sb-row" key={u}><Avatar p={o.prof(u)} size="lg" /><b>{o.dname(o.prof(u))}</b><span className="sp" /><span className="mono">{`${n}×`}</span></div>
                ))}</div>
              : <p className="mute">Nothing was sent back. 👌</p>}
          </section>
        </div>
      </div>
    </>
  );
}
