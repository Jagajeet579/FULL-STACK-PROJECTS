const taskId = new URLSearchParams(window.location.search).get('id');
const page = document.getElementById('taskPage');
let task = null;
let project = null;

async function init() {
  const user = await requireLogin();
  if (!user) return;
  await loadTask();

  const sock = connectSocket();
  sock.on('comment:created', (c) => {
    if (Number(c.task_id) === Number(taskId)) loadTask();
  });
  sock.on('task:updated', (t) => {
    if (Number(t.id) === Number(taskId)) loadTask();
  });
}

async function loadTask() {
  try {
    task = await api(`/tasks/${taskId}`);
    project = await api(`/projects/${task.project_id}`);
  } catch (e) {
    page.innerHTML = `<div class="empty-state">${e.message}</div>`;
    return;
  }
  // Join the project room so comments/updates from others arrive live.
  connectSocket().emit('join-project', task.project_id);
  render();
}

function render() {
  const assigneeOptions = ['<option value="">Unassigned</option>']
    .concat(project.members.map((m) => `<option value="${m.id}" ${task.assignee_id === m.id ? 'selected' : ''}>${escapeHtml(m.name)} (@${m.username})</option>`))
    .join('');
  const listOptions = project.lists.map((l) => `<option value="${l.id}" ${task.list_id === l.id ? 'selected' : ''}>${escapeHtml(l.name)}</option>`).join('');

  page.innerHTML = `
    <a href="/board.html?id=${task.project_id}" class="btn btn-secondary btn-small" style="margin-bottom:18px; display:inline-block;">&larr; Back to board</a>

    <h2>${escapeHtml(task.title)}</h2>
    ${task.description ? `<p style="color:var(--ink-soft);">${escapeHtml(task.description)}</p>` : ''}

    <div class="task-detail-meta">
      <div>
        <span class="label">Status / list</span>
        <select id="listSelect">${listOptions}</select>
      </div>
      <div>
        <span class="label">Assignee</span>
        <select id="assigneeSelect">${assigneeOptions}</select>
      </div>
      <div>
        <span class="label">Due date</span>
        <input type="date" id="dueInput" value="${task.due_date || ''}" />
      </div>
      <div>
        <span class="label">&nbsp;</span>
        <button class="btn btn-danger btn-small" id="deleteTaskBtn">Delete task</button>
      </div>
    </div>

    <h3>Comments</h3>
    <div id="commentsList">
      ${
        task.comments.length === 0
          ? `<p style="color:var(--ink-soft); font-size:0.88rem;">No comments yet.</p>`
          : task.comments
              .map(
                (c) => `
          <div class="comment">
            <div class="mini-avatar" style="width:30px;height:30px;font-size:1rem;">${c.author_avatar}</div>
            <div class="comment-body">
              <span class="cname">${escapeHtml(c.author_name)}</span>
              <span>${escapeHtml(c.content)}</span>
            </div>
          </div>
        `
              )
              .join('')
      }
    </div>

    <form class="comment-form" id="commentForm">
      <input type="text" id="commentInput" placeholder="Write a comment…" maxlength="500" required />
      <button class="btn btn-primary btn-small" type="submit">Reply</button>
    </form>
    <div id="commentMsg"></div>
  `;

  document.getElementById('listSelect').addEventListener('change', (e) => updateTask({ listId: Number(e.target.value) }));
  document.getElementById('assigneeSelect').addEventListener('change', (e) => updateTask({ assigneeId: e.target.value ? Number(e.target.value) : null }));
  document.getElementById('dueInput').addEventListener('change', (e) => updateTask({ dueDate: e.target.value || null }));

  document.getElementById('deleteTaskBtn').addEventListener('click', async () => {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    await api(`/tasks/${taskId}`, { method: 'DELETE' });
    window.location.href = `/board.html?id=${task.project_id}`;
  });

  document.getElementById('commentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('commentInput');
    const msg = document.getElementById('commentMsg');
    try {
      await api(`/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ content: input.value }) });
      input.value = '';
      msg.innerHTML = '';
      // UI updates via the comment:created socket event too, but update now for instant feedback.
      loadTask();
    } catch (err) {
      msg.innerHTML = `<p class="msg msg-error">${err.message}</p>`;
    }
  });
}

async function updateTask(patch) {
  try {
    await api(`/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(patch) });
  } catch (e) {
    alert(e.message);
  }
}

init();
