/* ═════════════ Deploys: what went out, where, and who should retest ═════════════ */
const DEPLOY_ENVS = ['Staging', 'Production', 'Testing'];
const deploysOf = pid => (S.deploys || []).filter(d => d.project_id === pid).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
function deploysBlock(p) {
  const ds = deploysOf(p.id).slice(0, 5);
  return h('section', {}, h('h2', {}, 'Deploys', h('button', { class: 'lnk sm', 'data-new-deploy': '1', style: { marginInlineStart: 'auto' }, onclick: () => openDeploy(p) }, '+ Log a deploy')),
    ds.length ? h('div', { class: 'pjlist' }, ds.map(d => h('button', { class: 'pjrow', onclick: () => openDeployView(d) }, h('span', { class: 'vkind env-' + norm(d.env).replace(/\s+/g, ''), text: d.env }),
      h('span', { class: 'grow' }, h('b', { text: d.note || plural((d.task_ids || []).length, 'task') }), h('span', { class: 'sm mute', text: `${first(prof(d.by)) || 'Someone'} · ${ago(d.at)} ago · ${plural((d.task_ids || []).length, 'task')} to retest` })))))
      : h('p', { class: 'note', text: 'When something goes out, log it here. Testers are told which tasks to check again.' }));
}
function openDeploy(p) {
  openSheet({ title: 'Log a deploy', kind: 'center', full: true, build: sh => {
    let env = 'Staging';
    const envs = [...new Set([...DEPLOY_ENVS, ...(S.deploys || []).map(d => d.env)])];
    const chips = h('div', { class: 'chips' }); const draw = () => chips.replaceChildren(...envs.map(k => h('button', { class: 'chipbtn', 'aria-pressed': String(k === env), onclick: () => { env = k; draw(); } }, k)),
      h('button', { class: 'chipbtn', onclick: e => { const inp = h('input', { type: 'text', placeholder: 'Where?', style: { width: '120px' }, onblur: () => { if (inp.value.trim()) { env = inp.value.trim(); envs.includes(env) || envs.push(env); } draw(); }, onkeydown: ev => { if (ev.key === 'Enter') inp.blur(); } }); e.currentTarget.replaceWith(inp); inp.focus(); } }, '+ Other'));
    draw();
    const since = Date.now() - 21 * 864e5;
    const cand = pTasks(p.id).filter(t => ['review', 'started'].includes(catOf(t)) || (catOf(t) === 'done' && new Date(t.completed_at || 0) > since)).sort((a, b) => (catOf(a) === 'review' ? 0 : 1) - (catOf(b) === 'review' ? 0 : 1));
    const sel = new Set(cand.filter(t => catOf(t) === 'review').map(t => t.id));
    const list = h('div', { class: 'pjlist lvlist' }, cand.length ? cand.map(t => h('label', { class: 'pjrow' }, h('input', { type: 'checkbox', checked: sel.has(t.id), onchange: e => e.target.checked ? sel.add(t.id) : sel.delete(t.id) }),
      h('span', { class: 'grow' }, h('b', { text: shortTitle(t.title, p.name) }), h('span', { class: 'sm mute', text: `${taskKey(t)} · ${stOf(t.status_id)?.name || ''} · retest by ${first(prof(t.reviewer_id || S.ws.default_reviewer)) || 'nobody'}` }))))
      : [h('p', { class: 'note', style: { padding: '12px' }, text: 'No tasks in review or recently done.' })]);
    const note = autoGrow(h('textarea', { id: 'depNote', rows: '2', placeholder: 'What went out, in one line', style: { width: '100%' } }));
    const go_ = h('button', { class: 'btn pri' }, 'Log it');
    go_.addEventListener('click', async () => {
      const row = { id: uuid(), workspace_id: S.ws.id, project_id: p.id, env, note: note.value.trim(), task_ids: [...sel], by: uid(), at: nowIso() };
      go_.disabled = true; const { error } = await write({ t: 'deploys', op: 'insert', row, plain: true }); if (error) { go_.disabled = false; return toast(errText(error)); }
      (S.deploys ||= []).push(row); closeSheet(true); track('deploy');
      const testers = [...new Set(row.task_ids.map(id => first(prof(taskOf(id)?.reviewer_id || S.ws.default_reviewer))).filter(Boolean))];
      toast(testers.length ? `Logged. ${testers.join(', ')} will be asked to retest` : 'Deploy logged'); refresh();
    });
    sh.append(h('div', { class: 'sbody' }, h('div', { class: 'field' }, 'Where did it go?', chips), h('label', { class: 'field' }, 'What went out', note), h('div', { class: 'field' }, 'Tasks to retest', list)),
      h('div', { class: 'sfoot' }, h('span', { class: 'sp' }), h('button', { class: 'btn ghost', onclick: () => closeSheet() }, 'Cancel'), go_));
  } });
}
function openDeployView(d) {
  openSheet({ title: `${d.env} deploy`, kind: 'right', full: isPhone(), build: sh => {
    const ts = (d.task_ids || []).map(taskOf).filter(Boolean);
    sh.append(h('div', { class: 'sbody' }, h('p', { class: 'note', text: `${dname(prof(d.by)) || 'Someone'} · ${fmtDT(d.at)}` }), d.note ? h('p', { style: { whiteSpace: 'pre-wrap' }, text: d.note }) : null,
      h('h4', { class: 'vsub', text: `Tasks to retest · ${ts.length}` }),
      ts.length ? h('div', { class: 'pjlist' }, ts.map(t => h('button', { class: 'pjrow', onclick: () => openTask(t.id) }, stIcon(stOf(t.status_id)), h('span', { class: 'grow' }, h('b', { text: t.title }), h('span', { class: 'sm mute', text: `${taskKey(t)} · ${stOf(t.status_id)?.name || ''} · ${first(prof(t.reviewer_id || S.ws.default_reviewer)) || 'nobody'} retests` })))))
        : h('p', { class: 'note', text: 'No tasks were picked.' })));
  } });
}

