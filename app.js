const tabs = document.querySelectorAll('.nav-btn');
const panes = document.querySelectorAll('.tab-pane');
const pageTitle = document.getElementById('page-title');
const lastUpdated = document.getElementById('last-updated');
const refreshBtn = document.getElementById('refresh-btn');

tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panes.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const id = btn.getAttribute('data-tab');
    document.getElementById(`tab-${id}`).classList.add('active');
    pageTitle.textContent = btn.textContent;
  });
});

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function badge(status) {
  const s = String(status || 'Unknown').toLowerCase();
  let cls = 'status-na';
  if (s === 'working' || s === 'active') cls = 'status-working';
  else if (s === 'idle' || s === 'pending') cls = 'status-idle';
  else if (s === 'offline' || s === 'done' || s === 'completed') cls = 'status-offline';
  return `<span class="status-badge ${cls}">${esc(status || 'Not Available')}</span>`;
}

function row(cells) {
  return `<tr>${cells.map(c => {
    if (c === undefined || c === null || c === '') return '<td><span class="status-badge status-na">Not Available</span></td>';
    if (typeof c === 'string' && c.startsWith('<span class="status-badge')) return `<td>${c}</td>`;
    return `<td>${esc(c)}</td>`;
  }).join('')}</tr>`;
}

async function loadData() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('API request failed');
    const data = await res.json();
    render(data);
    lastUpdated.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    lastUpdated.textContent = 'Connection Error';
    console.error(err);
  }
}

function render(data) {
  // Dashboard
  const d = data.dashboard || {};
  document.getElementById('metric-tasks').textContent = d.total_tasks ?? '0';
  document.getElementById('metric-agents').textContent = d.agent_count ?? '0';
  document.getElementById('metric-sessions').textContent = d.session_count ?? '0';
  document.getElementById('metric-workers').textContent = d.worker_count ?? '0';

  const healthList = document.getElementById('source-health');
  healthList.innerHTML = Object.entries(d.source_health || {}).map(([k, v]) => `
    <li class="health-item">
      <span>${k.toUpperCase()}</span>
      <span class="status-badge ${v ? 'status-working' : 'status-na'}">${v ? 'ONLINE' : 'NOT FOUND'}</span>
    </li>
  `).join('');

  // Agents
  const agents = (data.agents && data.agents.items) || [];
  document.getElementById('agents-count').textContent = agents.length;
  const agentsBody = document.querySelector('#agents-table tbody');
  agentsBody.innerHTML = agents.length ? agents.map(a => row([a.name, a.role, a.state, a.pid, a.model])).join('') : '<tr><td colspan="5" class="empty-state">No agents currently running</td></tr>';

  // Tasks
  const tasks = (data.tasks && data.tasks.items) || [];
  document.getElementById('tasks-count').textContent = tasks.length;
  const tasksBody = document.querySelector('#tasks-table tbody');
  tasksBody.innerHTML = tasks.length ? tasks.map(t => row([t.id, t.title || t.name, badge(t.status), t.created_at || t.timestamp])).join('') : '<tr><td colspan="4" class="empty-state">No tasks in kanban.db</td></tr>';

  // Calendar
  const cal = (data.calendar && data.calendar.items) || [];
  document.getElementById('calendar-count').textContent = cal.length;
  const calBody = document.querySelector('#calendar-table tbody');
  calBody.innerHTML = cal.length ? cal.map(c => row([c.name, c.schedule, c.next_run])).join('') : '<tr><td colspan="3" class="empty-state">No scheduled cron jobs configured</td></tr>';

  // Activity
  const act = (data.activity && data.activity.items) || [];
  document.getElementById('activity-count').textContent = act.length;
  const actBody = document.querySelector('#activity-table tbody');
  actBody.innerHTML = act.length ? act.map(x => row([x.id || x.session_id, x.type || x.status || x.name, JSON.stringify(x).slice(0, 80)])).join('') : '<tr><td colspan="3" class="empty-state">No recent activity found</td></tr>';

  // Memory
  const mem = (data.memory && data.memory.items) || [];
  document.getElementById('memory-count').textContent = mem.length;
  const memList = document.getElementById('memory-list');
  memList.innerHTML = mem.length ? mem.map(m => `
    <div class="memory-item">
      <h4>${esc(m.name)}</h4>
      <pre>${esc(m.content || 'Empty')}</pre>
    </div>
  `).join('') : '<div class="empty-state">No persistent memory files found in memories/</div>';

  // 2D Office Render
  const crew = data.crew_summary || { working: 0, idle: 0, offline: 0, unknown: 0 };
  document.getElementById('office-working').textContent = crew.working;
  document.getElementById('office-idle').textContent = crew.idle;
  document.getElementById('office-offline').textContent = crew.offline;
  document.getElementById('office-channels').textContent = (data.channels && data.channels.items ? data.channels.items.length : 0);

  const wsZone = document.getElementById('workspace-agents');
  const lgZone = document.getElementById('lounge-agents');
  wsZone.innerHTML = '';
  lgZone.innerHTML = '';

  const avatarIcons = { commander: '👾', engineer: '🛠️', tech_worker: '🤖' };

  agents.forEach(agent => {
    const icon = avatarIcons[agent.avatar] || '👤';
    const stateStr = String(agent.state || 'unknown').toLowerCase();
    const sprite = document.createElement('div');
    sprite.className = `agent-sprite ${stateStr}`;
    sprite.innerHTML = `
      <div class="sprite-icon">${icon}</div>
      <div class="sprite-name" title="${esc(agent.name)}">${esc(agent.name)}</div>
      ${badge(agent.state)}
    `;
    sprite.addEventListener('click', () => {
      document.getElementById('agent-detail').innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="font-size:24px;text-align:center;">${icon}</div>
          <h4 style="color:var(--accent);">${esc(agent.name)}</h4>
          <p><strong>Role:</strong> ${esc(agent.role)}</p>
          <p><strong>Status:</strong> ${badge(agent.state)}</p>
          <p><strong>Room:</strong> ${esc(agent.room)}</p>
          <p><strong>Model:</strong> ${esc(agent.model || 'Unknown')}</p>
          <p><strong>Task:</strong> ${esc(agent.current_task || 'None')}</p>
          <p><strong>Activity:</strong> <small>${esc(agent.recent_activity || 'None')}</small></p>
        </div>
      `;
    });

    if (agent.room === 'Workspace') wsZone.appendChild(sprite);
    else lgZone.appendChild(sprite);
  });

  if (!wsZone.children.length) wsZone.innerHTML = '<span class="detail-empty">No active agents in Workspace.</span>';
  if (!lgZone.children.length) lgZone.innerHTML = '<span class="detail-empty">No idle agents in Lounge.</span>';

  // Office Activity Feed
  const actList = document.getElementById('office-activity');
  actList.innerHTML = act.slice(0, 5).map(x => `
    <div class="act-item">
      <strong>${esc(x.title || x.type || 'Session Turn')}</strong>
      <small>${esc(x.id ? x.id.slice(0, 16) + '...' : '')} ${x.ended_at ? 'Completed' : 'Active'}</small>
    </div>
  `).join('') || '<span class="detail-empty">No recent activity</span>';

  // Connected Channels
  const chanList = document.getElementById('office-channels-list');
  const chans = (data.channels && data.channels.items) || [];
  chanList.innerHTML = chans.map(c => `
    <div class="act-item" style="border-left-color:${c.status === 'Connected' ? 'var(--green)' : 'var(--muted)'};">
      <strong>${esc(c.name).toUpperCase()}</strong>
      <small>Status: ${esc(c.status)} (${esc(c.session_count)} session)</small>
    </div>
  `).join('') || '<span class="detail-empty">No connected channels</span>';
}

refreshBtn.addEventListener('click', loadData);
loadData();
setInterval(loadData, 5000);
