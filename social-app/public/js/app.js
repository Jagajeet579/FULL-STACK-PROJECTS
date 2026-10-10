// app.js — shared helpers used by every page.

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
  div.textContent = str;
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
    <a class="brand" href="/index.html">Loopline</a>
    <nav>
      <a href="/index.html">Feed</a>
      ${
        currentUser
          ? `<a href="/profile.html?u=${currentUser.username}">My Profile</a>
             <a href="#" id="logoutLink">Log out</a>`
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

async function requireLogin() {
  const me = await api('/auth/me');
  currentUser = me.user;
  if (!me.user) {
    window.location.href = '/login.html';
    return null;
  }
  return me.user;
}

// Renders a single post card. Pass a post object (with like_count, comment_count,
// likedByMe, author_* fields) and whether to link the content to the detail page.
function postCardHtml(p, { linkToDetail = true } = {}) {
  const bodyContent = linkToDetail
    ? `<a href="/post.html?id=${p.id}" style="color:inherit;"><div class="post-content">${escapeHtml(p.content)}</div></a>`
    : `<div class="post-content">${escapeHtml(p.content)}</div>`;

  return `
    <div class="post" data-post-id="${p.id}">
      <div class="post-head">
        <a href="/profile.html?u=${p.author_username}" class="avatar">${p.author_avatar}</a>
        <div>
          <div><a href="/profile.html?u=${p.author_username}" class="author-name">${escapeHtml(p.author_name)}</a></div>
          <div class="author-meta">@${p.author_username} &middot; ${timeAgo(p.created_at)}</div>
        </div>
      </div>
      ${bodyContent}
      <div class="post-actions">
        <button class="action-btn like-btn ${p.likedByMe ? 'liked' : ''}" data-post-id="${p.id}">
          ${p.likedByMe ? '❤️' : '🤍'} <span class="like-count">${p.like_count}</span>
        </button>
        <a href="/post.html?id=${p.id}" class="action-btn">💬 <span>${p.comment_count ?? ''}</span></a>
      </div>
    </div>
  `;
}

function attachLikeHandlers(container) {
  container.querySelectorAll('.like-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!currentUser) {
        window.location.href = '/login.html';
        return;
      }
      const postId = btn.dataset.postId;
      const liked = btn.classList.contains('liked');
      try {
        const result = await api(`/posts/${postId}/like`, { method: liked ? 'DELETE' : 'POST' });
        btn.classList.toggle('liked', result.likedByMe);
        btn.querySelector('.like-count').textContent = result.like_count;
        btn.innerHTML = `${result.likedByMe ? '❤️' : '🤍'} <span class="like-count">${result.like_count}</span>`;
      } catch (e) {
        alert(e.message);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', renderNav);
