const postId = new URLSearchParams(window.location.search).get('id');
const page = document.getElementById('postPage');

async function loadPost() {
  const me = await api('/auth/me');
  currentUser = me.user;

  let post;
  try {
    post = await api(`/posts/${postId}`);
  } catch (e) {
    page.innerHTML = `<div class="empty-state">Post not found. <a href="/index.html">Back to feed</a></div>`;
    return;
  }

  page.innerHTML = `
    <a href="/index.html" class="btn btn-secondary btn-small" style="margin-bottom:20px; display:inline-block;">&larr; Back to feed</a>
    <div id="postContainer">${postCardHtml(post, { linkToDetail: false })}</div>

    <h3>Comments (${post.comments.length})</h3>
    <div id="commentsList">
      ${
        post.comments.length === 0
          ? `<p style="color:var(--ink-soft); font-size:0.9rem;">No comments yet. Be the first to reply.</p>`
          : post.comments
              .map(
                (c) => `
          <div class="comment">
            <div class="avatar">${c.author_avatar}</div>
            <div class="comment-body">
              <a href="/profile.html?u=${c.author_username}" class="cname">${escapeHtml(c.author_name)}</a>
              <span>${escapeHtml(c.content)}</span>
            </div>
          </div>
        `
              )
              .join('')
      }
    </div>

    ${
      currentUser
        ? `<form class="comment-form" id="commentForm">
             <input type="text" id="commentInput" placeholder="Write a comment…" maxlength="500" required />
             <button class="btn btn-primary btn-small" type="submit">Reply</button>
           </form>
           <div id="commentMsg"></div>`
        : `<p style="margin-top:16px;"><a href="/login.html">Log in</a> to leave a comment.</p>`
    }
  `;

  attachLikeHandlers(document.getElementById('postContainer'));

  const form = document.getElementById('commentForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('commentInput');
      const msg = document.getElementById('commentMsg');
      try {
        await api(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ content: input.value }) });
        input.value = '';
        loadPost();
      } catch (e) {
        msg.innerHTML = `<p class="msg msg-error">${e.message}</p>`;
      }
    });
  }
}

loadPost();
