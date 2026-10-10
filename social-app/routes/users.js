const express = require('express');
const db = require('../db');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Please log in first.' });
  next();
}

// GET /api/users/:username — profile + counts + that user's posts
router.get('/:username', (req, res) => {
  const user = db
    .prepare('SELECT id, name, username, bio, avatar, created_at FROM users WHERE username = ?')
    .get(req.params.username.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const followerCount = db.prepare('SELECT COUNT(*) AS c FROM follows WHERE following_id = ?').get(user.id).c;
  const followingCount = db.prepare('SELECT COUNT(*) AS c FROM follows WHERE follower_id = ?').get(user.id).c;
  const postCount = db.prepare('SELECT COUNT(*) AS c FROM posts WHERE user_id = ?').get(user.id).c;

  let isFollowing = false;
  if (req.session.userId) {
    isFollowing = !!db
      .prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?')
      .get(req.session.userId, user.id);
  }

  const posts = db
    .prepare(
      `SELECT p.*, u.name AS author_name, u.username AS author_username, u.avatar AS author_avatar,
         (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
         (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
       FROM posts p JOIN users u ON u.id = p.user_id
       WHERE p.user_id = ? ORDER BY p.id DESC`
    )
    .all(user.id);

  res.json({
    ...user,
    followerCount,
    followingCount,
    postCount,
    isFollowing,
    isSelf: req.session.userId === user.id,
    posts,
  });
});

// POST /api/users/:username/follow
router.post('/:username/follow', requireAuth, (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username.toLowerCase());
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.id === req.session.userId) {
    return res.status(400).json({ error: "You can't follow yourself." });
  }

  try {
    db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').run(req.session.userId, target.id);
  } catch (e) {
    // UNIQUE constraint — already following; treat as success (idempotent).
  }
  res.json({ ok: true, isFollowing: true });
});

// DELETE /api/users/:username/follow
router.delete('/:username/follow', requireAuth, (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE username = ?').get(req.params.username.toLowerCase());
  if (!target) return res.status(404).json({ error: 'User not found.' });

  db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(req.session.userId, target.id);
  res.json({ ok: true, isFollowing: false });
});

module.exports = router;
