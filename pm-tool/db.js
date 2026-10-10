// db.js — SQLite schema + seed data for the project management tool.
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'pm.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    avatar TEXT DEFAULT '🙂',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Junction table: who belongs to which project.
  CREATE TABLE IF NOT EXISTS project_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'member'
    UNIQUE(project_id, user_id)
  );

  -- Board columns, e.g. "To Do", "In Progress", "Done".
  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
  );

  -- Task cards.
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    due_date TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS task_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'assigned' | 'comment' | 'added_to_project'
    message TEXT NOT NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  const insertUser = db.prepare(`
    INSERT INTO users (name, username, email, password_hash, avatar) VALUES (@name, @username, @email, @password_hash, @avatar)
  `);
  const demoHash = bcrypt.hashSync('password123', 10);
  const seedUsers = [
    { name: 'Asha Rao', username: 'asha', email: 'asha@example.com', password_hash: demoHash, avatar: '👩‍💻' },
    { name: 'Rahul Mehta', username: 'rahul', email: 'rahul@example.com', password_hash: demoHash, avatar: '🧑‍💻' },
  ];
  const ids = seedUsers.map((u) => insertUser.run(u).lastInsertRowid);

  const projInfo = db
    .prepare('INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)')
    .run('Placement Prep Tracker', 'Shared board to track DSA practice and project work before placements.', ids[0]);
  const projectId = projInfo.lastInsertRowid;

  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(projectId, ids[0], 'owner');
  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(projectId, ids[1], 'member');

  const listNames = ['To Do', 'In Progress', 'Done'];
  const listIds = listNames.map((name, i) => db.prepare('INSERT INTO lists (project_id, name, position) VALUES (?, ?, ?)').run(projectId, name, i).lastInsertRowid);

  const insertTask = db.prepare(`
    INSERT INTO tasks (list_id, project_id, title, description, assignee_id, created_by, position)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const t1 = insertTask.run(listIds[0], projectId, 'Finish Striver A2Z DSA sheet - Arrays section', 'Complete all array problems and note patterns.', ids[1], ids[0], 0).lastInsertRowid;
  insertTask.run(listIds[1], projectId, 'Build Task 1: E-commerce store', 'Express + SQLite version, with cart and orders.', ids[0], ids[0], 0);
  insertTask.run(listIds[2], projectId, 'Set up LinkedIn profile', 'Add certificates and project links.', ids[0], ids[0], 0);

  db.prepare('INSERT INTO task_comments (task_id, user_id, content) VALUES (?, ?, ?)').run(t1, ids[0], 'Let me know if you get stuck on sliding window problems.');

  console.log('Seeded demo users, project, lists, tasks (login: asha@example.com / rahul@example.com, password: password123)');
}

module.exports = db;
