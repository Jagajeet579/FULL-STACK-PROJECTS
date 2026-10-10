const express = require('express');
const db = require('../db');
const { isMember, notify } = require('./projects');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Please log in first.' });
  next();
}
router.use(requireAuth);

function fullTask(taskId) {
  return db
    .prepare(
      `SELECT t.*, u.name AS assignee_name, u.username AS assignee_username, u.avatar AS assignee_avatar,
         (SELECT COUNT(*) FROM task_comments c WHERE c.task_id = t.id) AS comment_count
       FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
       WHERE t.id = ?`
    )
    .get(taskId);
}

// POST /api/tasks  { projectId, listId, title, description, assigneeId, dueDate }
router.post('/', (req, res) => {
  const { projectId, listId, title, description = '', assigneeId = null, dueDate = null } = req.body;
  if (!isMember(projectId, req.session.userId)) {
    return res.status(403).json({ error: "You're not a member of this project." });
  }
  if (!title || !title.trim()) return res.status(400).json({ error: 'Task title is required.' });

  const list = db.prepare('SELECT * FROM lists WHERE id = ? AND project_id = ?').get(listId, projectId);
  if (!list) return res.status(404).json({ error: 'List not found in this project.' });

  if (assigneeId && !isMember(projectId, assigneeId)) {
    return res.status(400).json({ error: 'Assignee must be a project member.' });
  }

  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM tasks WHERE list_id = ?').get(listId).m;
  const info = db
    .prepare(
      `INSERT INTO tasks (list_id, project_id, title, description, assignee_id, due_date, created_by, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(listId, projectId, title.trim(), description, assigneeId, dueDate, req.session.userId, maxPos + 1);

  const task = fullTask(info.lastInsertRowid);
  const io = req.app.get('io');
  if (io) io.to(`project:${projectId}`).emit('task:created', task);

  if (assigneeId && Number(assigneeId) !== req.session.userId) {
    const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(req.session.userId);
    notify(io, assigneeId, 'assigned', `${actor.name} assigned you to "${task.title}".`, projectId, task.id);
  }

  res.status(201).json(task);
});

// PUT /api/tasks/:id  { listId?, title?, description?, assigneeId?, dueDate? }
router.put('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  if (!isMember(task.project_id, req.session.userId)) {
    return res.status(403).json({ error: "You're not a member of this project." });
  }

  const { listId, title, description, assigneeId, dueDate } = req.body;
  const newListId = listId ?? task.list_id;

  if (listId && listId !== task.list_id) {
    const list = db.prepare('SELECT * FROM lists WHERE id = ? AND project_id = ?').get(listId, task.project_id);
    if (!list) return res.status(404).json({ error: 'List not found in this project.' });
  }
  if (assigneeId !== undefined && assigneeId !== null && !isMember(task.project_id, assigneeId)) {
    return res.status(400).json({ error: 'Assignee must be a project member.' });
  }

  db.prepare(
    `UPDATE tasks SET list_id = ?, title = ?, description = ?, assignee_id = ?, due_date = ? WHERE id = ?`
  ).run(
    newListId,
    title ?? task.title,
    description ?? task.description,
    assigneeId !== undefined ? assigneeId : task.assignee_id,
    dueDate !== undefined ? dueDate : task.due_date,
    task.id
  );

  const updated = fullTask(task.id);
  const io = req.app.get('io');
  if (io) io.to(`project:${task.project_id}`).emit('task:updated', updated);

  const newlyAssigned = assigneeId !== undefined && assigneeId !== null && Number(assigneeId) !== task.assignee_id && Number(assigneeId) !== req.session.userId;
  if (newlyAssigned) {
    const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(req.session.userId);
    notify(io, assigneeId, 'assigned', `${actor.name} assigned you to "${updated.title}".`, task.project_id, task.id);
  }

  res.json(updated);
});

// DELETE /api/tasks/:id
router.delete('/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  if (!isMember(task.project_id, req.session.userId)) {
    return res.status(403).json({ error: "You're not a member of this project." });
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
  const io = req.app.get('io');
  if (io) io.to(`project:${task.project_id}`).emit('task:deleted', { id: task.id, list_id: task.list_id });

  res.json({ ok: true });
});

// GET /api/tasks/:id — task detail with comments
router.get('/:id', (req, res) => {
  const task = fullTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  if (!isMember(task.project_id, req.session.userId)) {
    return res.status(403).json({ error: "You're not a member of this project." });
  }

  const comments = db
    .prepare(
      `SELECT c.*, u.name AS author_name, u.username AS author_username, u.avatar AS author_avatar
       FROM task_comments c JOIN users u ON u.id = c.user_id
       WHERE c.task_id = ? ORDER BY c.id ASC`
    )
    .all(task.id);

  res.json({ ...task, comments });
});

// POST /api/tasks/:id/comments  { content }
router.post('/:id/comments', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  if (!isMember(task.project_id, req.session.userId)) {
    return res.status(403).json({ error: "You're not a member of this project." });
  }
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Comment cannot be empty.' });

  const info = db
    .prepare('INSERT INTO task_comments (task_id, user_id, content) VALUES (?, ?, ?)')
    .run(task.id, req.session.userId, content.trim());

  const comment = db
    .prepare(
      `SELECT c.*, u.name AS author_name, u.username AS author_username, u.avatar AS author_avatar
       FROM task_comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`
    )
    .get(info.lastInsertRowid);

  const io = req.app.get('io');
  if (io) io.to(`project:${task.project_id}`).emit('comment:created', comment);

  if (task.assignee_id && task.assignee_id !== req.session.userId) {
    const actor = db.prepare('SELECT name FROM users WHERE id = ?').get(req.session.userId);
    notify(io, task.assignee_id, 'comment', `${actor.name} commented on "${task.title}".`, task.project_id, task.id);
  }

  res.status(201).json(comment);
});

module.exports = router;
