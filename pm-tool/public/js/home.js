async function init() {
  const user = await requireLogin();
  if (!user) return;
  loadProjects();
}

async function loadProjects() {
  const grid = document.getElementById('projectGrid');
  const projects = await api('/projects');

  if (projects.length === 0) {
    grid.innerHTML = `<div class="empty-state">No projects yet. Create your first board above.</div>`;
    return;
  }

  grid.innerHTML = `<div class="project-grid">${projects
    .map(
      (p) => `
    <a class="project-card" href="/board.html?id=${p.id}">
      <h3>${escapeHtml(p.name)}</h3>
      ${p.description ? `<div class="desc">${escapeHtml(p.description)}</div>` : ''}
      <div class="meta">${p.member_count} member${p.member_count === 1 ? '' : 's'} &middot; ${p.task_count} task${p.task_count === 1 ? '' : 's'}</div>
    </a>
  `
    )
    .join('')}</div>`;
}

const modal = document.getElementById('newProjectModal');
document.getElementById('newProjectBtn').addEventListener('click', () => modal.classList.add('open'));
document.getElementById('closeNewProject').addEventListener('click', () => modal.classList.remove('open'));

document.getElementById('newProjectForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('pName').value;
  const description = document.getElementById('pDesc').value;
  const msg = document.getElementById('newProjectMsg');

  try {
    const project = await api('/projects', { method: 'POST', body: JSON.stringify({ name, description }) });
    window.location.href = `/board.html?id=${project.id}`;
  } catch (err) {
    msg.innerHTML = `<p class="msg msg-error">${err.message}</p>`;
  }
});

init();
