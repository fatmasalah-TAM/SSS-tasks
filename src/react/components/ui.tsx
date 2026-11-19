import type { CSSProperties, ReactNode } from 'react';
import { ovrto } from '../bridge';
import type { Profile } from '../types';
import { LegacyNode } from './Legacy';

/** The app's drawn icons (same set as the rest of the app). */
export function Icon({ k, size = 18 }: { k: string; size?: number }) {
  const svg = (ovrto().ICONS[k] || '').replace('<svg ', `<svg width="${size}" height="${size}" stroke-linecap="round" stroke-linejoin="round" `);
  return <span className={'ico ico-' + k} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** A person's round photo or initials. No person = an empty grey circle. */
export function Avatar({ p, size, turn, label, text }: { p: Profile | null; size?: string; turn?: boolean; label?: string; text?: string }) {
  const o = ovrto();
  const cls = 'av' + (size ? ' ' + size : '') + (turn ? ' turn' : '') + (!p ? ' none' : '');
  const ring = p && !turn ? o.hashColor(p.id) : null;
  const style = ring ? ({ '--ring': ring } as CSSProperties) : undefined;
  const showImg = p?.avatar_url && !o.S.prefs?.data_saver;
  return (
    <span className={cls} title={p ? o.dname(p) : label || 'Unassigned'} style={style}>
      <span className="b">{showImg ? <img src={p!.avatar_url!} alt="" loading="lazy" /> : p ? o.initials(p) : text || ''}</span>
    </span>
  );
}

/** "Nothing here" with the small drawing. */
export function EmptyState({ label, text }: { label: string; text: string }) {
  const ill = ovrto().illFor(label);
  return (
    <div className="empty">
      {ill ? <div className="ill-wrap" dangerouslySetInnerHTML={{ __html: ill }} /> : null}
      <div className="frame">{label}</div>
      <p>{text}</p>
    </div>
  );
}

/** The animated mark with a short line, while something loads. */
export function LoadingRow({ label }: { label?: string }) {
  return (
    <div className="ld-row" role="status">
      <span className="ld">
        <span className="ld-mark loop" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ovrto().ICONS.markAnim }} />
        {label ? <span className="ld-t">{label}</span> : null}
      </span>
    </div>
  );
}

/** The top of every page: title, a line under it, tools on the right, and the search / bell on phones. */
export function PageHead({ title, sub, tools, extra }: { title: string; sub?: ReactNode; tools?: ReactNode; extra?: ReactNode }) {
  const o = ovrto(); const phone = o.isPhone(); const route = o.S.route.v;
  const plainTitle = ['myturn', 'review', 'inbox', 'chat', 'insights', 'owner'].includes(route);
  let heading: ReactNode;
  if (route === 'project') {
    heading = (
      <div className="ptitle-w">
        <button className="btn icon ghost hback" aria-label="All projects" title="All projects" onClick={() => o.go({ v: 'projects' })}><Icon k="back" size={20} /></button>
        <h1 className="ptitle" data-tour="view-title"><span className="t">{title}</span></h1>
      </div>
    );
  } else if (phone && !plainTitle) {
    heading = <button className="ptitle" data-tour="view-title" onClick={() => o.viewSwitcher()}><span className="t">{title}</span><span className="chev"><Icon k="chev" size={20} /></span></button>;
  } else {
    heading = <h1 className="ptitle" data-tour="view-title"><span className="t">{title}</span></h1>;
  }
  return (
    <header className="head">
      <div className="hrow">
        {heading}
        <span className="sp" />
        {tools || null}
        {phone ? <button className="x gsearch-m" data-gsearch="1" aria-label="Search" title="Search" onClick={() => o.openSearch()}><Icon k="search" size={20} /></button> : null}
        {phone && route !== 'inbox' ? <LegacyNode make={() => o.legacy.bellButton()} /> : null}
      </div>
      {sub ? <div className="hsub">{sub}</div> : null}
      {extra || null}
    </header>
  );
}
