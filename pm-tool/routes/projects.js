const express = require('express');
const db = require('../db');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Please log in first.' });
  next();
}
router.use(requireAuth);

function isMember(projectId, userId) {
  return !!db.prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId);
}

function notify(io, userId, type, message, projectId, taskId) {
  const info = db
    .prepare('INSERT INTO notifications (user_id, type, message, project_id, task_id) VALUES (?, ?, ?, ?, ?)')
    .run(userId, type, message, projectId || null, taskId || null);
  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(info.lastInsertRowid);
  if (io) io.to(`user:${userId}`).emit('notification', notification);
  return notification;
}
// GET /api/projects — projects the current user belongs to
router.get('/', (req, res) => {
  const projects = db
    .prepare(
      `SELECT p.*, (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) AS member_count,
         (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count
       FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       WHERE pm.user_id = ?
       ORDER BY p.id DESC`
    )
    .all(req.session.userId);
  res.json(projects);
});

// POST /api/projects  { name, description }
router.post('/', (req, res) => {
  const { name, description = '' } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Project name is required.' });

  const info = db.prepare('INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)').run(name.trim(), description, req.session.userId);
  const projectId = info.lastInsertRowid;

  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(projectId, req.session.userId, 'owner');

  // Default board columns.
  ['To Do', 'In Progress', 'Done'].forEach((listName, i) => {
    db.prepare('INSERT INTO lists (project_id, name, position) VALUES (?, ?, ?)').run(projectId, listName, i);
  });

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  res.status(201).json(project);
});

// GET /api/projects/:id — full board: members, lists, tasks
router.get('/:id', (req, res) => {
  const projectId = req.params.id;
  if (!isMember(projectId, req.session.userId)) {
    return res.status(403).json({ error: "You're not a member of this project." });
  }

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found.' });

  const members = db
    .prepare(
      `SELECT u.id, u.name, u.username, u.avatar, pm.role
       FROM project_members pm JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = ?`
    )
    .all(projectId);

  const lists = db.prepare('SELECT * FROM lists WHERE project_id = ? ORDER BY position').all(projectId);

  const tasks = db
    .prepare(
      `SELECT t.*, u.name AS assignee_name, u.username AS assignee_username, u.avatar AS assignee_avatar,
         (SELECT COUNT(*) FROM task_comments c WHERE c.task_id = t.id) AS comment_count
       FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.project_id = ? ORDER BY t.position, t.id`
    )
    .all(projectId);

  res.json({
    ...project,
    members,
    lists: lists.map((l) => ({ ...l, tasks: tasks.filter((t) => t.list_id === l.id) })),
  });
});

// POST /api/projects/:id/members  { username }
router.post('/:id/members', (req, res) => {
  const projectId = req.params.id;
  if (!isMember(projectId, req.session.userId)) {
    return res.status(403).json({ error: "You're not a member of this project." });
  }
  const { username } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get((username || '').toLowerCase());
  if (!user) return res.status(404).json({ error: 'No user with that username.' });

  if (isMember(projectId, user.id)) {
    return res.status(409).json({ error: 'That user is already a member.' });
  }

  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(projectId, user.id, 'member');

  const project = db.prepare('SELECT name FROM projects WHERE id = ?').get(projectId);
  const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(req.session.userId);
  notify(req.app.get('io'), user.id, 'added_to_project', `${actor.name} added you to "${project.name}".`, projectId, null);

  res.status(201).json({ ok: true });
});

// POST /api/projects/:id/lists  { name }
router.post('/:id/lists', (req, res) => {
  const projectId = req.params.id;
  if (!isMember(projectId, req.session.userId)) {
    return res.status(403).json({ error: "You're not a member of this project." });
  }
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'List name is required.' });

  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM lists WHERE project_id = ?').get(projectId).m;
  const info = db.prepare('INSERT INTO lists (project_id, name, position) VALUES (?, ?, ?)').run(projectId, name.trim(), maxPos + 1);
  const list = db.prepare('SELECT * FROM lists WHERE id = ?').get(info.lastInsertRowid);

  const io = req.app.get('io');
  if (io) io.to(`project:${projectId}`).emit('list:created', list);

  res.status(201).json(list);
});

// Attach these to the router itself (not a plain object) so requiring this
// file both gives the Express router AND exposes these helper functions
// for other route files (tasks.js) to reuse.
router.isMember = isMember;
router.notify = notify;

module.exports = router;
