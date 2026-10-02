// db.js — sets up a file-based SQLite database (store.db), creates tables
// if they don't already exist, and seeds a few sample products.
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'store.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL,
    image TEXT NOT NULL,
    category TEXT NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    UNIQUE(user_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'placed',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price_at_purchase REAL NOT NULL
  );
`);

// Seed products only if the table is empty, so re-starting the server
// doesn't duplicate rows.
const productCount = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
if (productCount === 0) {
  const insert = db.prepare(`
    INSERT INTO products (name, description, price, image, category, stock)
    VALUES (@name, @description, @price, @image, @category, @stock)
  `);
  const seed = [
    { name: 'Wireless Mechanical Keyboard', description: 'Hot-swappable switches, 75% layout, USB-C and Bluetooth.', price: 3499, image: '⌨️', category: 'Electronics', stock: 25 },
    { name: 'Noise-Cancelling Headphones', description: 'Over-ear, 30-hour battery, active noise cancellation.', price: 5999, image: '🎧', category: 'Electronics', stock: 15 },
    { name: '27" 2K Monitor', description: 'IPS panel, 144Hz refresh rate, ideal for coding and gaming.', price: 15999, image: '🖥️', category: 'Electronics', stock: 10 },
    { name: 'Ergonomic Office Chair', description: 'Adjustable lumbar support and armrests, mesh back.', price: 8999, image: '🪑', category: 'Furniture', stock: 8 },
    { name: 'Standing Desk', description: 'Electric height adjustment, 120x60cm top.', price: 12999, image: '🛠️', category: 'Furniture', stock: 6 },
    { name: 'Programming Notebook Set', description: 'Dotted-grid notebooks, pack of 3, great for DSA practice.', price: 349, image: '📓', category: 'Stationery', stock: 100 },
    { name: 'USB-C Hub (7-in-1)', description: 'HDMI, 2x USB-A, SD/microSD, Ethernet, PD passthrough.', price: 1799, image: '🔌', category: 'Electronics', stock: 40 },
    { name: 'Insulated Water Bottle', description: '1L stainless steel, keeps drinks cold for 24 hours.', price: 599, image: '🍶', category: 'Lifestyle', stock: 60 },
  ];
  const insertMany = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
  insertMany(seed);
  console.log(`Seeded ${seed.length} products.`);
}

module.exports = db;
