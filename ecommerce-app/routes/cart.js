const express = require('express');
const db = require('../db');

const router = express.Router();

// Require login for every route in this file.
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Please log in first.' });
  next();
}
router.use(requireAuth);

function getCart(userId) {
  return db
    .prepare(
      `SELECT ci.id AS cart_item_id, ci.quantity, p.*
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = ?
       ORDER BY ci.id`
    )
    .all(userId);
}

// GET /api/cart — current user's cart, with a computed total
router.get('/', (req, res) => {
  const items = getCart(req.session.userId);
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  res.json({ items, total });
});

// POST /api/cart  { productId, quantity }
router.post('/', (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  const existing = db
    .prepare('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?')
    .get(req.session.userId, productId);

  if (existing) {
    db.prepare('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?').run(quantity, existing.id);
  } else {
    db.prepare('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)').run(
      req.session.userId,
      productId,
      quantity
    );
  }
  const items = getCart(req.session.userId);
  res.status(201).json({ items });
});

// PUT /api/cart/:cartItemId  { quantity }
router.put('/:cartItemId', (req, res) => {
  const { quantity } = req.body;
  if (quantity <= 0) {
    db.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?').run(req.params.cartItemId, req.session.userId);
  } else {
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?').run(
      quantity,
      req.params.cartItemId,
      req.session.userId
    );
  }
  res.json({ items: getCart(req.session.userId) });
});

// DELETE /api/cart/:cartItemId
router.delete('/:cartItemId', (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?').run(req.params.cartItemId, req.session.userId);
  res.json({ items: getCart(req.session.userId) });
});

module.exports = router;
