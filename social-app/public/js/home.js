let scope = 'all';

async function init() {
  const me = await api('/auth/me');
  currentUser = me.user;
  if (currentUser) {
    document.getElementById('composer').style.display = 'block';
  }
  loadFeed();
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    scope = tab.dataset.scope;
    loadFeed();
  });
});

async function loadFeed() {
  const container = document.getElementById('feedContent');
  container.innerHTML = '<p>Loading…</p>';

  const query = scope === 'following' ? '?scope=following' : '';
  const posts = await api(`/posts${query}`);

  if (posts.length === 0) {
    container.innerHTML =
      scope === 'following'
        ? `<div class="empty-state">Nobody you follow has posted yet. <a href="/index.html">See everyone's posts &rarr;</a></div>`
        : `<div class="empty-state">No posts yet. Be the first to share something!</div>`;
    return;
  }

  container.innerHTML = posts.map((p) => postCardHtml(p)).join('');
  attachLikeHandlers(container);
}

const textarea = document.getElementById('postContent');
const charCount = document.getElementById('charCount');
textarea.addEventListener('input', () => {
  charCount.textContent = `${textarea.value.length} / 1000`;
});

document.getElementById('postBtn').addEventListener('click', async () => {
  const content = textarea.value.trim();
  const msg = document.getElementById('composerMsg');
  if (!content) return;

  try {
    await api('/posts', { method: 'POST', body: JSON.stringify({ content }) });
    textarea.value = '';
    charCount.textContent = '0 / 1000';
    msg.innerHTML = '';
    loadFeed();
  } catch (e) {
    msg.innerHTML = `<p class="msg msg-error">${e.message}</p>`;
  }
});

init();
