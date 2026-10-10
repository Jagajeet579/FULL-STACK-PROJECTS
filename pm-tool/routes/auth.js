const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

router.post('/register', (req, res) => {
  const { name, username, email, password } = req.body;

  if (!name || !username || !email || !password) {
    return res.status(400).json({ error: 'Name, username, email and password are all required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters: letters, numbers, underscores only.' });
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE email = ? OR username = ?')
    .get(email.toLowerCase(), username.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'That email or username is already taken.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (name, username, email, password_hash) VALUES (?, ?, ?, ?)')
    .run(name, username.toLowerCase(), email.toLowerCase(), passwordHash);

  req.session.userId = info.lastInsertRowid;
  req.session.userName = name;

  res.status(201).json({ id: info.lastInsertRowid, name, username: username.toLowerCase() });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  req.session.userId = user.id;
  req.session.userName = user.name;
  res.json({ id: user.id, name: user.name, username: user.username });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare('SELECT id, name, username, avatar FROM users WHERE id = ?').get(req.session.userId);
  res.json({ user });
});

// GET /api/auth/search-users?q=... — used for "add member" / "assign task" pickers
router.get('/search-users', (req, res) => {
  const q = `%${(req.query.q || '').toLowerCase()}%`;
  const users = db
    .prepare('SELECT id, name, username, avatar FROM users WHERE username LIKE ? OR name LIKE ? LIMIT 8')
    .all(q, q);
  res.json(users);
});

module.exports = router;
