const projectId = new URLSearchParams(window.location.search).get('id');
const page = document.getElementById('boardPage');
let project = null;
let activeListIdForNewTask = null;

async function init() {
  const user = await requireLogin();
  if (!user) return;

  await loadBoard();

  // Join this project's real-time room once we know we're a member.
  const sock = connectSocket();
  sock.emit('join-project', projectId);
  sock.on('task:created', () => loadBoard());
  sock.on('task:updated', () => loadBoard());
  sock.on('task:deleted', () => loadBoard());
  sock.on('list:created', () => loadBoard());
}

async function loadBoard() {
  try {
    project = await api(`/projects/${projectId}`);
  } catch (e) {
    page.innerHTML = `<div class="empty-state">${e.message}</div>`;
    return;
  }
  renderBoard();
}

function renderBoard() {
  const membersHtml = project.members
    .map((m) => `<span class="mini-avatar" title="${escapeHtml(m.name)} (@${m.username})">${m.avatar}</span>`)
    .join('');

  page.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${escapeHtml(project.name)}</h1>
        ${project.description ? `<p>${escapeHtml(project.description)}</p>` : ''}
        <span class="live-pulse"><span class="live-dot"></span> live updates on</span>
      </div>
      <div style="display:flex; gap:10px; align-items:center;">
        <div class="member-row">${membersHtml}</div>
        <button class="btn btn-secondary btn-small" id="addMemberBtn">+ Add teammate</button>
      </div>
    </div>
    <div class="board" id="boardLists"></div>
  `;

  const boardLists = document.getElementById('boardLists');
  project.lists.forEach((list) => {
    const col = el(`
      <div class="list-column" data-list-id="${list.id}">
        <h3>${escapeHtml(list.name)} <span class="list-count">${list.tasks.length}</span></h3>
        <div class="task-container" data-list-id="${list.id}"></div>
        <button class="add-task-btn" data-list-id="${list.id}">+ Add task</button>
      </div>
    `);
    const container = col.querySelector('.task-container');
    list.tasks.forEach((t) => container.appendChild(buildTaskCard(t)));

    // Drag & drop target.
    container.addEventListener('dragover', (e) => e.preventDefault());
    container.addEventListener('drop', async (e) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('text/task-id');
      if (!taskId) return;
      try {
        await api(`/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify({ listId: Number(list.id) }) });
        // UI updates via the task:updated socket event.
      } catch (err) {
        alert(err.message);
      }
    });

    col.querySelector('.add-task-btn').addEventListener('click', () => openTaskModal(list.id));
    boardLists.appendChild(col);
  });

  // "Add list" column.
  const addListCol = el(`
    <div class="list-column new-list-column">
      <button class="add-list-btn" id="addListBtn">+ Add another list</button>
    </div>
  `);
  boardLists.appendChild(addListCol);
  document.getElementById('addListBtn').addEventListener('click', addList);

  document.getElementById('addMemberBtn').addEventListener('click', () => {
    document.getElementById('memberModal').classList.add('open');
  });
}

function buildTaskCard(t) {
  const card = el(`
    <div class="task-card" draggable="true" data-task-id="${t.id}">
      <div class="task-title">${escapeHtml(t.title)}</div>
      <div class="task-meta">
        <span>${t.due_date ? '📅 ' + t.due_date : ''}${t.comment_count > 0 ? ` 💬 ${t.comment_count}` : ''}</span>
        ${t.assignee_name ? `<span class="task-assignee"><span class="mini-avatar">${t.assignee_avatar}</span></span>` : ''}
      </div>
    </div>
  `);
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/task-id', t.id);
  });
  card.addEventListener('click', () => {
    window.location.href = `/task.html?id=${t.id}`;
  });
  return card;
}

async function addList() {
  const name = prompt('New list name (e.g. "Backlog", "In Review"):');
  if (!name || !name.trim()) return;
  try {
    await api(`/projects/${projectId}/lists`, { method: 'POST', body: JSON.stringify({ name }) });
  } catch (e) {
    alert(e.message);
  }
}

// ---------- Add task modal ----------
const taskModal = document.getElementById('taskModal');
function openTaskModal(listId) {
  activeListIdForNewTask = listId;
  const select = document.getElementById('tAssignee');
  select.innerHTML = '<option value="">Unassigned</option>' + project.members.map((m) => `<option value="${m.id}">${escapeHtml(m.name)} (@${m.username})</option>`).join('');
  document.getElementById('newTaskForm').reset();
  document.getElementById('taskModalMsg').innerHTML = '';
  taskModal.classList.add('open');
}
document.getElementById('closeTaskModal').addEventListener('click', () => taskModal.classList.remove('open'));

document.getElementById('newTaskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('tTitle').value;
  const description = document.getElementById('tDesc').value;
  const assigneeId = document.getElementById('tAssignee').value || null;
  const dueDate = document.getElementById('tDue').value || null;
  const msg = document.getElementById('taskModalMsg');

  try {
    await api('/tasks', {
      method: 'POST',
      body: JSON.stringify({ projectId: Number(projectId), listId: Number(activeListIdForNewTask), title, description, assigneeId, dueDate }),
    });
    taskModal.classList.remove('open');
    // UI updates via the task:created socket event.
  } catch (err) {
    msg.innerHTML = `<p class="msg msg-error">${err.message}</p>`;
  }
});

// ---------- Add member modal ----------
const memberModal = document.getElementById('memberModal');
document.getElementById('closeMemberModal').addEventListener('click', () => memberModal.classList.remove('open'));

document.getElementById('addMemberForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('mUsername').value;
  const msg = document.getElementById('memberModalMsg');

  try {
    await api(`/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify({ username }) });
    memberModal.classList.remove('open');
    document.getElementById('addMemberForm').reset();
    loadBoard();
  } catch (err) {
    msg.innerHTML = `<p class="msg msg-error">${err.message}</p>`;
  }
});

init();
