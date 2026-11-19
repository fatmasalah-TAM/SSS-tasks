import { ovrto } from '../bridge';
import type { Activity, Task } from '../types';

export interface Segment { who: string; from: string; to: string; task: string }
export interface Person { who: string; ms: number; turns: number; longest: number }

const DAY = 864e5;

/** "3 h", "2.5 days"… in the app's language. */
export function dur(ms: number | null | undefined): string {
  if (ms == null) return '—';
  const ar = ovrto().isAr();
  if (ms < 3600e3) return Math.max(1, Math.round(ms / 60e3)) + (ar ? ' دقيقة' : ' min');
  if (ms < 2 * DAY) return Math.round(ms / 3600e3) + (ar ? ' ساعة' : ' h');
  return (ms / DAY).toFixed(ms < 10 * DAY ? 1 : 0) + (ar ? ' يوم' : ' days');
}

export function whoName(who: string): string {
  const o = ovrto();
  if (who === 'client') return 'Waiting on the client';
  if (who === 'admins') return 'Needs a decision (admins)';
  return o.dname(o.prof(who)) || 'Former member';
}

type Snap = { status_id: string; assignee_id: string | null; reviewer_id: string | null; flags: string[] };

/** Who held the turn, when: replay the task's history backwards from today, then forwards. */
export function turnSegments(t: Task, acts: Activity[]): Segment[] {
  const o = ovrto();
  const hist = acts.filter(a => a.task_id === t.id && ['status', 'developer', 'reviewer', 'flags'].includes(a.field)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const key: Record<string, keyof Snap> = { status: 'status_id', developer: 'assignee_id', reviewer: 'reviewer_id', flags: 'flags' };
  const val = (f: string, v: string | null) => (f === 'flags' ? (v ? String(v).split(',').filter(Boolean) : []) : v || null);
  // undo every change (newest first) to get the state the task was created with
  let init: Snap = { status_id: t.status_id, assignee_id: t.assignee_id, reviewer_id: t.reviewer_id, flags: t.flags || [] };
  for (const a of hist.slice().reverse()) init = Object.assign({}, init, { [key[a.field]]: val(a.field, a.old_value) });
  const owner = (s: Snap): string | null => {
    const f = s.flags || [];
    if (f.includes('waiting')) return 'client';
    if (f.includes('decision')) return 'admins';
    const c = o.stOf(s.status_id)?.category;
    if (c === 'done' || c === 'canceled') return null;
    if (c === 'review') return s.reviewer_id || o.S.ws?.default_reviewer || null;
    return s.assignee_id || null;
  };
  const segs: Segment[] = [];
  const end = t.completed_at && o.isClosed(t) ? t.completed_at : new Date().toISOString();
  const push = (who: string | null, from: string, to: string) => {
    if (!who || !from || !to || to <= from) return;
    const last = segs[segs.length - 1];
    if (last && last.who === who && last.to === from) last.to = to; else segs.push({ who, from, to, task: t.id });
  };
  let cur = init, from = t.created_at;
  for (const a of hist) {
    if (a.created_at < from) continue;
    push(owner(cur), from, a.created_at);
    cur = Object.assign({}, cur, { [key[a.field]]: val(a.field, a.new_value) });
    from = a.created_at;
  }
  push(owner(cur), from, end);
  return segs;
}

export function insightsData(days: number, acts: Activity[]) {
  const o = ovrto(); const tasks = o.S.tasks;
  const since = new Date(Date.now() - days * DAY).toISOString();
  const per = new Map<string, Person>(); let handoffs = 0;
  for (const t of tasks) {
    for (const g of turnSegments(t, acts)) {
      const from = g.from < since ? since : g.from;
      if (g.to <= from) continue;
      const ms = new Date(g.to).getTime() - new Date(from).getTime();
      const p = per.get(g.who) || { who: g.who, ms: 0, turns: 0, longest: 0 };
      p.ms += ms; p.longest = Math.max(p.longest, ms);
      if (g.from >= since) { p.turns++; handoffs++; }
      per.set(g.who, p);
    }
  }
  const people = [...per.values()].sort((a, b) => b.ms - a.ms);
  const done = tasks.filter(t => t.completed_at && t.completed_at >= since && o.isClosed(t));
  const cycles = done.map(t => new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime()).sort((a, b) => a - b);
  const median = (a: number[]) => (a.length ? a[Math.floor(a.length / 2)] : null);
  const stuck = tasks
    .filter(t => !o.isClosed(t) && t.turn_owner && o.catOf(t) !== 'backlog' && Date.now() - new Date(t.turn_since).getTime() > 3 * DAY)
    .sort((a, b) => a.turn_since.localeCompare(b.turn_since));
  const sendbacks = new Map<string, number>();
  for (const a of acts) {
    if (a.field !== 'status' || a.created_at < since) continue;
    const from = o.stOf(a.old_value!)?.category, to = o.stOf(a.new_value!)?.category;
    if (from === 'review' && (to === 'started' || to === 'unstarted')) {
      const t = o.taskOf(a.task_id);
      if (t?.assignee_id) sendbacks.set(t.assignee_id, (sendbacks.get(t.assignee_id) || 0) + 1);
    }
  }
  return { people, handoffs, done: done.length, cycle: median(cycles), stuck, sendbacks: [...sendbacks.entries()].sort((a, b) => b[1] - a[1]) };
}
