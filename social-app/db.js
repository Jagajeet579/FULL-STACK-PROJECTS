// db.js — SQLite schema + a couple of seed users/posts so the feed isn't empty.
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, 'social.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    bio TEXT DEFAULT '',
    avatar TEXT DEFAULT '🙂',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Junction table: many-to-many between users and posts.
  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(post_id, user_id)
  );

  -- Self-referencing junction table: a user can follow another user.
  CREATE TABLE IF NOT EXISTS follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(follower_id, following_id)
  );
`);

const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  const insertUser = db.prepare(`
    INSERT INTO users (name, username, email, password_hash, bio, avatar)
    VALUES (@name, @username, @email, @password_hash, @bio, @avatar)
  `);
  const demoHash = bcrypt.hashSync('password123', 10);
  const seedUsers = [
    { name: 'Asha Rao', username: 'asha', email: 'asha@example.com', password_hash: demoHash, bio: 'Final-year CS student. Into competitive programming.', avatar: '👩‍💻' },
    { name: 'Rahul Mehta', username: 'rahul', email: 'rahul@example.com', password_hash: demoHash, bio: 'Building side projects, one bug at a time.', avatar: '🧑‍💻' },
  ];
  const ids = seedUsers.map((u) => insertUser.run(u).lastInsertRowid);

  const insertPost = db.prepare('INSERT INTO posts (user_id, content) VALUES (?, ?)');
  const p1 = insertPost.run(ids[0], 'Just solved my first hard-rated DP problem on LeetCode. Small win, big motivation boost!').lastInsertRowid;
  const p2 = insertPost.run(ids[1], 'Started learning Express.js this week — REST APIs finally clicking.').lastInsertRowid;

  db.prepare('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)').run(p1, ids[1], 'Nice! Which problem was it?');
  db.prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)').run(p2, ids[0]);
  db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(ids[0], ids[1]);

  console.log(`Seeded ${seedUsers.length} demo users (login: asha@example.com / rahul@example.com, password: password123)`);
}

module.exports = db;
