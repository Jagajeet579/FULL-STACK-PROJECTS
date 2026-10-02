// app.js — small shared helpers used by every page.

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function money(n) {
  return '₹' + Number(n).toLocaleString('en-IN');
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// Renders the top navigation bar into #topbar, showing login state and
// cart item count. Call this on every page after DOMContentLoaded.
async function renderNav() {
  const bar = document.getElementById('topbar');
  if (!bar) return;

  let user = null;
  let cartCount = 0;
  try {
    const me = await api('/auth/me');
    user = me.user;
    if (user) {
      const cart = await api('/cart');
      cartCount = cart.items.reduce((s, i) => s + i.quantity, 0);
    }
  } catch (e) {
    /* not logged in / server not ready yet — ignore */
  }

  bar.innerHTML = `
    <a class="brand" href="/index.html">The Study Desk</a>
    <nav>
      <a href="/index.html">Shop</a>
      ${user ? `<a href="/orders.html">My Orders</a>` : ''}
      <a href="/cart.html">Cart${cartCount ? `<span class="cart-pill">${cartCount}</span>` : ''}</a>
      ${
        user
          ? `<a href="#" id="logoutLink">Log out (${user.name.split(' ')[0]})</a>`
          : `<a href="/login.html">Log in</a>`
      }
    </nav>
  `;

  const logoutLink = document.getElementById('logoutLink');
  if (logoutLink) {
    logoutLink.addEventListener('click', async (e) => {
      e.preventDefault();
      await api('/auth/logout', { method: 'POST' });
      window.location.href = '/index.html';
    });
  }
}

// Redirects to /login.html if nobody is logged in. Returns the user object
// if they are. Use on pages that require auth (cart, orders).
async function requireLogin() {
  const me = await api('/auth/me');
  if (!me.user) {
    window.location.href = '/login.html';
    return null;
  }
  return me.user;
}

document.addEventListener('DOMContentLoaded', renderNav);
