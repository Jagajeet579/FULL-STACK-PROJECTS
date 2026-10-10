const express = require('express');
const db = require('../db');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Please log in first.' });
  next();
}

function withMeta(posts, viewerId) {
  const likedStmt = db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?');
  return posts.map((p) => ({
    ...p,
    likedByMe: viewerId ? !!likedStmt.get(p.id, viewerId) : false,
  }));
}

// GET /api/posts — feed, newest first. ?scope=following restricts to people you follow.
router.get('/', (req, res) => {
  let sql = `
    SELECT p.*, u.name AS author_name, u.username AS author_username, u.avatar AS author_avatar,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
    FROM posts p JOIN users u ON u.id = p.user_id
  `;
  const params = [];

  if (req.query.scope === 'following' && req.session.userId) {
    sql += ` WHERE p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?) OR p.user_id = ?`;
    params.push(req.session.userId, req.session.userId);
  }
  sql += ' ORDER BY p.id DESC';

  const posts = db.prepare(sql).all(...params);
  res.json(withMeta(posts, req.session.userId));
});

// POST /api/posts  { content }
router.post('/', requireAuth, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Post content cannot be empty.' });
  if (content.length > 1000) return res.status(400).json({ error: 'Post is too long (max 1000 characters).' });

  const info = db.prepare('INSERT INTO posts (user_id, content) VALUES (?, ?)').run(req.session.userId, content.trim());
  const post = db
    .prepare(
      `SELECT p.*, u.name AS author_name, u.username AS author_username, u.avatar AS author_avatar
       FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?`
    )
    .get(info.lastInsertRowid);
  res.status(201).json({ ...post, like_count: 0, comment_count: 0, likedByMe: false });
});

// GET /api/posts/:id — single post + its comments
router.get('/:id', (req, res) => {
  const post = db
    .prepare(
      `SELECT p.*, u.name AS author_name, u.username AS author_username, u.avatar AS author_avatar,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count
       FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?`
    )
    .get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });

  const comments = db
    .prepare(
      `SELECT c.*, u.name AS author_name, u.username AS author_username, u.avatar AS author_avatar
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ? ORDER BY c.id ASC`
    )
    .all(req.params.id);

  const [withMetaPost] = withMeta([post], req.session.userId);
  res.json({ ...withMetaPost, comments });
});

// POST /api/posts/:id/like
router.post('/:id/like', requireAuth, (req, res) => {
  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });

  try {
    db.prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)').run(req.params.id, req.session.userId);
  } catch (e) {
    // already liked — idempotent
  }
  const likeCount = db.prepare('SELECT COUNT(*) AS c FROM likes WHERE post_id = ?').get(req.params.id).c;
  res.json({ likedByMe: true, like_count: likeCount });
});

// DELETE /api/posts/:id/like
router.delete('/:id/like', requireAuth, (req, res) => {
  db.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').run(req.params.id, req.session.userId);
  const likeCount = db.prepare('SELECT COUNT(*) AS c FROM likes WHERE post_id = ?').get(req.params.id).c;
  res.json({ likedByMe: false, like_count: likeCount });
});

// POST /api/posts/:id/comments  { content }
router.post('/:id/comments', requireAuth, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Comment cannot be empty.' });

  const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found.' });

  const info = db
    .prepare('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)')
    .run(req.params.id, req.session.userId, content.trim());

  const comment = db
    .prepare(
      `SELECT c.*, u.name AS author_name, u.username AS author_username, u.avatar AS author_avatar
       FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`
    )
    .get(info.lastInsertRowid);

  res.status(201).json(comment);
});

module.exports = router;
