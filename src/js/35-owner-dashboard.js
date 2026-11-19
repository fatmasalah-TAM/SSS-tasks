/* ═════════════ Owner dashboard: which teams signed up, who is active, which features they use (counts only) ═════════════ */
var ownerAdmin = null; // only admins of the first workspace see this
var ownerState = { days: 30, data: null, loading: false, error: null, mine: false, sort: 'last', open: null };
var trackedAt = {};
function track(feature) { try { if (!S.ws?.id || Date.now() - (trackedAt[feature] || 0) < 60e3) return; trackedAt[feature] = Date.now(); Promise.resolve(sb.rpc('track', { ws: S.ws.id, feature })).catch(() => {}); } catch {} }
async function checkOwner() {
  try { const { data } = await sb.rpc('is_owner_admin'); const was = ownerAdmin; ownerAdmin = !!data; if (was !== ownerAdmin) render(); } catch { ownerAdmin = false; }
}
async function loadOwner() {
  if (ownerState.loading) return;
  ownerState.loading = true; ownerState.error = null; const days = ownerState.days;
  const { data, error } = await sb.rpc('owner_stats', { days });
  ownerState.loading = false;
  if (days !== ownerState.days) return loadOwner(); // the period changed while loading
  if (error) ownerState.error = /function|does not exist|schema cache/i.test(error.message || '') ? 'The owner dashboard needs the latest database update (run the setup SQL).' : errText(error);
  else ownerState.data = data;
  if (S.route.v === 'owner') render();
}
var FEATURES = [
  ['tasks_made', 'Tasks created', 'Core'], ['comments', 'Comments', 'Core'], ['approvals', 'Approved in review', 'Core'], ['sendbacks', 'Sent back from review', 'Core'], ['reassigned', 'Handed to someone else', 'Core'],
  ['messages', 'Chat messages', 'Chat'], ['replies', 'Thread replies', 'Chat'], ['files', 'Files and photos in chat', 'Chat'], ['huddles', 'Huddles started', 'Chat'],
  ['client_pages', 'Client pages (live)', 'Clients'], ['ev:client_page_view', 'Client page visits', 'Clients'], ['ev:client_link_shared', 'Client links shared', 'Clients'],
  ['ev:ai_write', 'AI write-up (Franco/Arabic)', 'AI'], ['ev:ai_voice', 'Voice → task', 'AI'], ['ev:task_from_message', 'Task from a chat message', 'AI'], ['ev:voice_note', 'Voice notes in chat', 'Chat'],
  ['ev:insights', 'Insights opened', 'Managers'], ['ev:weekly_report', 'Weekly report made', 'Managers'], ['ev:review_list', 'Review list opened', 'Managers'], ['ev:export', 'Exports', 'Data'], ['ev:import', 'Imports', 'Data'], ['ev:search', 'Search', 'Core'], ['ev:arabic', 'Arabic interface', 'Core'],
];
const featVal = (t, k) => k.startsWith('ev:') ? Number(t.events?.[k.slice(3)] || 0) : Number(t[k] || 0);
const TEMPLATE_NAME = { blank: 'Software', agency: 'Agency', general: 'Any team', sss: 'SSS' };
function teamHealth(t) {
  const age = Date.now() - new Date(t.created_at); const last = t.last_active ? Date.now() - new Date(t.last_active) : Infinity;
  if (t.active_7d > 0 && age < 3 * 864e5) return ['new', 'New'];
  if (t.active_7d > 0) return ['ok', 'Active'];
  if (last < 14 * 864e5) return ['quiet', 'Quiet'];
  return ['gone', age < 3 * 864e5 ? 'Not started' : 'Stopped'];
}
function viewOwner() {
  const head = pageHead('Ovrto owner', h('span', { text: 'How teams use Ovrto · counts only, never what they write' }),
    !ownerAdmin ? null : h('div', { class: 'seg', role: 'group', 'aria-label': 'Period' }, ...[[7, '7 days'], [30, '30 days'], [90, '90 days']].map(([d, l]) => h('button', { 'aria-pressed': String(ownerState.days === d), onclick: () => { ownerState.days = d; ownerState.data = null; loadOwner(); render(); } }, l))));
  if (!ownerAdmin) return [head, h('div', { class: 'scroll' }, emptyState('OWNERS', 'This page is for the owners of Ovrto.', null))];
  if (!ownerState.data && !ownerState.loading && !ownerState.error) loadOwner();
  if (ownerState.error) return [head, h('div', { class: 'scroll' }, h('p', { class: 'note', style: { padding: '20px' }, text: ownerState.error }))];
  if (!ownerState.data) return [head, h('div', { class: 'scroll' }, loadingRow('Counting…'))];
  const d = ownerState.data; const all = d.teams || [];
  const teams = all.filter(t => ownerState.mine || !t.is_owner);
  const sum = k => teams.reduce((n, t) => n + featVal(t, k), 0);
  const since = Date.now() - d.days * 864e5;
  const newTeams = teams.filter(t => new Date(t.created_at) >= since && !t.is_owner).length;
  const active = teams.filter(t => t.active_7d > 0).length;
  const kpi = (n, l, sub) => h('div', { class: 'kpi' }, h('b', { text: String(n) }), h('span', { text: l }), sub ? h('span', { class: 'sm mute', text: sub }) : null);
  // funnel: from account to a team that keeps coming back
  const others = all.filter(t => !t.is_owner);
  const funnel = [
    ['Accounts', d.accounts - (all.find(t => t.is_owner)?.members || 0)],
    ['Made a team', others.length],
    ['Invited someone', others.filter(t => t.members > 1 || t.invites > 0).length],
    ['2+ people in the team', others.filter(t => t.members > 1).length],
    ['5+ tasks', others.filter(t => t.tasks >= 5).length],
    ['Active this week', others.filter(t => t.active_7d > 0).length],
  ];
  const fmax = Math.max(1, ...funnel.map(f => f[1]));
  const bars = (rows, max, color) => rows.map(([label, n, sub]) => h('div', { class: 'bar-row ow-row' },
    h('div', { class: 'bar-main' }, h('div', { class: 'bar-top' }, h('b', { text: label }), h('span', { class: 'mono sm', text: String(n) + (sub ? ' · ' + sub : '') })),
      h('div', { class: 'bar' }, h('i', { style: { width: Math.max(n ? 3 : 0, Math.round(n / max * 100)) + '%', background: color || 'var(--accent)' } })))));
  // features: how many teams use each, and how much
  const feats = FEATURES.map(([k, label, group]) => ({ k, label, group, teams: teams.filter(t => featVal(t, k) > 0).length, uses: sum(k) })).sort((a, b) => b.teams - a.teams || b.uses - a.uses);
  const tmax = Math.max(1, teams.length);
  // charts: sign-ups per week, activity per day
  const wk = d.signups_by_week || []; const wmax = Math.max(1, ...wk.map(w => w.teams));
  const days = d.activity_by_day || []; const dmax = Math.max(1, ...days.map(x => x.tasks + x.messages));
  const col = (n, max, label, title) => h('div', { class: 'ow-col', title }, h('i', { style: { height: Math.max(n ? 4 : 0, Math.round(n / max * 100)) + '%' } }), label ? h('span', { text: label }) : null);
  // the list of teams
  const sorters = { last: (a, b) => String(b.last_active || '').localeCompare(String(a.last_active || '')), new: (a, b) => String(b.created_at).localeCompare(String(a.created_at)), big: (a, b) => b.members - a.members || b.tasks - a.tasks };
  const list = teams.slice().sort(sorters[ownerState.sort]);
  const quietEmails = others.filter(t => t.active_7d === 0 && t.owner_email).map(t => t.owner_email);
  const teamRow = t => {
    const [hc, hl] = teamHealth(t); const open = ownerState.open === t.id;
    const used = FEATURES.filter(([k]) => featVal(t, k) > 0);
    return h('div', { class: 'ow-team' + (open ? ' open' : '') },
      h('button', { class: 'ow-team-h', 'aria-expanded': String(open), onclick: () => { ownerState.open = open ? null : t.id; render(); } },
        h('span', { class: 'ow-health ' + hc, text: hl }),
        h('span', { class: 'ow-name' }, h('b', { class: 'notr', text: t.name + (t.is_owner ? ' (you)' : '') }), h('span', { class: 'sm mute' }, h('span', { text: TEMPLATE_NAME[t.template] || 'Team' }), ' · ', h('span', { text: 'started ' + fmtDate(t.created_at) }))),
        h('span', { class: 'ow-nums sm' }, h('span', { text: t.members === 1 ? '1 person' : `${t.members} people` }), h('span', { text: `${t.active_7d} active` }), h('span', { text: t.tasks_made === 1 ? '1 task' : `${t.tasks_made} tasks` })),
        h('span', { class: 'sm mute ow-last', text: t.last_active ? ago(t.last_active) : '—' })),
      open ? h('div', { class: 'ow-team-b' },
        h('div', { class: 'ow-contact' }, h('span', { class: 'notr', text: `${t.owner_name || ''} · ${t.owner_email || ''}` }),
          t.owner_email ? h('button', { class: 'btn sm', onclick: () => copyText(t.owner_email, 'Email copied') }, 'Copy email') : null),
        h('div', { class: 'ow-grid' }, ...[['People', t.members], ['Pending invites', t.invites], ['Active this week', t.active_7d], ['Active this month', t.active_30d], ['Tasks in total', t.tasks], ['Finished', t.tasks_done]].map(([l, n]) => h('div', {}, h('b', { text: String(n) }), h('span', { class: 'sm mute', text: l })))),
        used.length ? h('div', { class: 'ow-chips' }, ...used.map(([k, label]) => h('span', { class: 'tag' }, `${label} · ${featVal(t, k)}`))) : h('p', { class: 'note', text: 'No feature use in this period.' })) : null);
  };
  const body = h('div', { class: 'ins owner' },
    h('label', { class: 'check sm', style: { alignSelf: 'flex-start' } }, h('input', { type: 'checkbox', checked: ownerState.mine, onchange: e => { ownerState.mine = e.target.checked; render(); } }), h('span', { text: 'Include my own team' })),
    h('div', { class: 'kpis' },
      kpi(others.length, 'teams signed up', `${newTeams} new in the last ${d.days} days`),
      kpi(active, 'active this week', teams.length ? `${Math.round(active / teams.length * 100)}% of teams` : ''),
      kpi(teams.reduce((n, t) => n + t.active_7d, 0), 'people active this week', `${teams.reduce((n, t) => n + t.members, 0)} people in these teams`),
      kpi(d.accounts_no_team, 'accounts with no team', 'signed up, never made a team'),
      kpi(sum('tasks_made'), 'tasks created', `in the last ${d.days} days`),
      kpi(sum('messages'), 'chat messages', `in the last ${d.days} days`)),
    h('section', { class: 'card ins-card' }, h('h3', { text: 'From sign-up to a team that sticks' }), h('p', { class: 'note', text: 'Each step shows how many teams got that far. The biggest drop is where to help.' }), ...bars(funnel, fmax)),
    h('section', { class: 'card ins-card' }, h('h3', { text: 'Features teams use most' }), h('p', { class: 'note', text: `How many teams used each feature in the last ${d.days} days, and how many times.` }),
      ...bars(feats.map(f => [f.label, f.teams, `${f.uses}×`]), tmax, 'var(--teal, #0B6B70)')),
    h('section', { class: 'card ins-card' }, h('h3', { text: 'New teams per week' }), h('p', { class: 'note', text: 'Last 12 weeks.' }),
      wk.length ? h('div', { class: 'ow-cols' }, ...wk.map(w => col(w.teams, wmax, fmtDate(w.week), `${w.teams} teams · week of ${fmtDate(w.week)}`))) : h('p', { class: 'mute', text: 'No new teams yet. Share the sign-up link to get the first ones.' })),
    h('section', { class: 'card ins-card' }, h('h3', { text: 'Daily activity' }), h('p', { class: 'note', text: 'Tasks plus chat messages per day, last 30 days (other teams only). The period above doesn’t change this chart.' }),
      h('div', { class: 'ow-cols days' }, ...days.map((x, i) => col(x.tasks + x.messages, dmax, (days.length - 1 - i) % 7 === 3 ? fmtDate(x.day) : '', `${fmtDate(x.day)}: ${x.tasks} tasks, ${x.messages} messages`)))),
    h('section', { class: 'card ins-card' },
      h('div', { class: 'ow-listhead' }, h('h3', { text: `Teams (${list.length})` }), h('span', { class: 'sp' }),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Sort' }, ...[['last', 'Last active'], ['new', 'Newest'], ['big', 'Biggest']].map(([k, l]) => h('button', { 'aria-pressed': String(ownerState.sort === k), onclick: () => { ownerState.sort = k; render(); } }, l)))),
      quietEmails.length ? h('button', { class: 'btn sm', style: { alignSelf: 'flex-start' }, onclick: () => copyText(quietEmails.join(', '), `${quietEmails.length} emails copied`) }, `Copy emails of ${quietEmails.length} quiet team${quietEmails.length === 1 ? '' : 's'}`) : null,
      list.length ? h('div', { class: 'ow-teams' }, ...list.map(teamRow)) : h('p', { class: 'mute', text: 'No teams yet.' })),
    h('p', { class: 'note sm', text: `Updated ${fmtDT(d.at)}. Counts only: Ovrto never shows you other teams’ tasks, messages or files.` }));
  return [head, h('div', { class: 'scroll' }, body)];
}

