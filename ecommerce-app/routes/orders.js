const express = require('express');
const db = require('../db');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Please log in first.' });
  next();
}
router.use(requireAuth);

// POST /api/orders — checkout: turns the current cart into an order
router.post('/', (req, res) => {
  const userId = req.session.userId;

  const cartItems = db
    .prepare(
      `SELECT ci.quantity, p.id AS product_id, p.name, p.price, p.stock
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = ?`
    )
    .all(userId);

  if (cartItems.length === 0) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }

  const outOfStock = cartItems.find((i) => i.quantity > i.stock);
  if (outOfStock) {
    return res.status(409).json({ error: `Not enough stock for "${outOfStock.name}".` });
  }

  const total = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const placeOrder = db.transaction(() => {
    const orderInfo = db
      .prepare('INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)')
      .run(userId, total, 'placed');
    const orderId = orderInfo.lastInsertRowid;

    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, product_name, quantity, price_at_purchase)
       VALUES (?, ?, ?, ?, ?)`
    );
    const decrementStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

    for (const item of cartItems) {
      insertItem.run(orderId, item.product_id, item.name, item.quantity, item.price);
      decrementStock.run(item.quantity, item.product_id);
    }

    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
    return orderId;
  });

  const orderId = placeOrder();
  res.status(201).json({ orderId, total });
});

// GET /api/orders — order history for the current user
router.get('/', (req, res) => {
  const orders = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC')
    .all(req.session.userId);

  const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  const withItems = orders.map((o) => ({ ...o, items: itemsStmt.all(o.id) }));

  res.json(withItems);
});

module.exports = router;
