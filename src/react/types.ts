/** The data the app keeps in `window.__ovrto.S` (loaded from Supabase). Only the fields React pages read are listed. */
export interface Profile { id: string; full_name?: string; email?: string; avatar_url?: string | null; tz?: string }
export interface Status { id: string; name: string; category: 'backlog' | 'unstarted' | 'started' | 'review' | 'done' | 'canceled'; position: number }
export interface Task {
  id: string; number?: number; title: string; status_id: string; type_id: string;
  assignee_id: string | null; reviewer_id: string | null; turn_owner: string | null; turn_since: string;
  created_at: string; completed_at: string | null; updated_at: string; flags?: string[];
}
export interface Activity { id: string; task_id: string; field: string; old_value: string | null; new_value: string | null; created_at: string }
export interface AppState {
  ws: { id: string; default_reviewer?: string | null } | null;
  tasks: Task[]; route: { v: string; id?: string };
  prefs?: { data_saver?: boolean };
}
export interface InsightsState { days: number; acts: Activity[] | null; loadedFor: string | null; loading: boolean; error?: string | null }

/** What the old code gives React. Defined in src/js/37-react-bridge.js */
export interface Ovrto {
  S: AppState; ICONS: Record<string, string>; insightsState: InsightsState;
  uid(): string; isAdmin(): boolean; isPhone(): boolean; isAr(): boolean;
  prof(id: string | null | undefined): Profile | null; dname(p: Profile | null): string; initials(p: Profile): string; hashColor(id: string): string;
  stOf(id: string): Status | undefined; catOf(t: Task): string; isClosed(t: Task): boolean; taskOf(id: string): Task | undefined;
  illFor(label: string): string | null;
  render(): void; go(route: { v: string; id?: string }): void; toast(msg: string, action?: unknown, ms?: number): void; track(feature: string): void;
  openWeeklyReport(): void; openSearch(): void; viewSwitcher(): void; loadInsightActs(): void;
  legacy: { taskRow(t: Task): Node; bellButton(): Node };
}
