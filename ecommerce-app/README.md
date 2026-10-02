# The Study Desk — Simple E-commerce Store

A basic full-stack e-commerce site built with Express.js, SQLite, and vanilla HTML/CSS/JS.

## Features
- Product listing with category filter + search
- Product detail page
- User registration & login (bcrypt-hashed passwords, sessions)
- Shopping cart (add / update quantity / remove)
- Order processing (checkout reduces stock, clears cart, saves order history)
- "My Orders" page showing past orders

## Tech stack
- Backend: Node.js + Express.js
- Database: SQLite (via better-sqlite3) — a single `store.db` file, created automatically
- Auth: express-session + bcryptjs
- Frontend: plain HTML, CSS, JavaScript (fetch API, no framework)

## Setup

```bash
npm install
npm start
```

Then open http://localhost:3000 in your browser.

The database file (`store.db`) is created automatically on first run and
seeded with 8 sample products. Delete `store.db` (and the `-wal`/`-shm`
files next to it) to reset everything.

## Project structure

```
server.js          - app entry point, wires up middleware + routes
db.js               - SQLite schema + seed data
routes/
  auth.js           - register, login, logout, /me
  products.js        - list, categories, detail
  cart.js           - view/add/update/remove cart items (requires login)
  orders.js         - checkout + order history (requires login)
public/
  index.html, product.html, cart.html, login.html, register.html, orders.html
  css/style.css     - shared styling
  js/app.js         - shared nav + fetch helper
  js/*.js           - one script per page
```

## How to extend this
- Swap SQLite for MongoDB + Mongoose to match a MERN-stack curriculum
  (schemas map almost directly: products, users, orders collections).
- Replace session auth with JWTs if you want a stateless API.
- Add product images (real URLs) instead of emoji placeholders.
- Add pagination to the product grid once you have more products.
- Add an admin page to create/edit products.
