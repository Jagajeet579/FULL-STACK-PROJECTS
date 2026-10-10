// app.js — shared helpers: fetch wrapper, nav rendering, Socket.IO setup,
// and the notification bell (used on every page).

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
  return div.innerHTML;
}

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr + 'Z')) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

let currentUser = null;
let socket = null;

function connectSocket() {
  if (socket) return socket;
  socket = io(); // connects using the browser's existing session cookie
  socket.on('notification', (n) => {
    refreshNotifications();
  });
  return socket;
}

async function refreshNotifications() {
  const bellCount = document.getElementById('bellCount');
  const panel = document.getElementById('notifPanel');
  if (!bellCount) return;

  const { notifications, unreadCount } = await api('/notifications');

  bellCount.textContent = unreadCount > 9 ? '9+' : unreadCount;
  bellCount.style.display = unreadCount > 0 ? 'flex' : 'none';

  if (panel) {
    panel.innerHTML =
      notifications.length === 0
        ? `<div class="notif-empty">No notifications yet.</div>`
        : notifications
            .map(
              (n) => `
        <div class="notif-item ${n.is_read ? '' : 'unread'}">
          <div>${escapeHtml(n.message)}</div>
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>
      `
            )
            .join('');
  }
}

async function renderNav() {
  const bar = document.getElementById('topbar');
  if (!bar) return;

  try {
    const me = await api('/auth/me');
    currentUser = me.user;
  } catch (e) {
    currentUser = null;
  }

  bar.innerHTML = `
    <a class="brand" href="/index.html">BoardFlow</a>
    <nav>
      ${
        currentUser
          ? `<a href="/index.html">My Projects</a>
             <div class="bell-wrap">
               <button class="bell-btn" id="bellBtn">🔔<span class="bell-dot" id="bellCount" style="display:none;"></span></button>
               <div class="notif-panel" id="notifPanel"></div>
             </div>
             <a href="#" id="logoutLink">Log out</a>`
          : `<a href="/login.html">Log in</a>`
      }
    </nav>
  `;

  if (currentUser) {
    connectSocket();
    refreshNotifications();

    const bellBtn = document.getElementById('bellBtn');
    const panel = document.getElementById('notifPanel');
    bellBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) {
        await api('/notifications/read-all', { method: 'POST' });
        refreshNotifications();
      }
    });
    document.addEventListener('click', () => panel.classList.remove('open'));

    document.getElementById('logoutLink').addEventListener('click', async (e) => {
      e.preventDefault();
      await api('/auth/logout', { method: 'POST' });
      window.location.href = '/index.html';
    });
  }
}

async function requireLogin() {
  const me = await api('/auth/me');
  currentUser = me.user;
  if (!me.user) {
    window.location.href = '/login.html';
    return null;
  }
  return me.user;
}

document.addEventListener('DOMContentLoaded', renderNav);
