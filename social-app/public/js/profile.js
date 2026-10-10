const username = new URLSearchParams(window.location.search).get('u');
const page = document.getElementById('profilePage');

async function loadProfile() {
  const me = await api('/auth/me');
  currentUser = me.user;

  let profile;
  try {
    profile = await api(`/users/${username}`);
  } catch (e) {
    page.innerHTML = `<div class="empty-state">User not found.</div>`;
    return;
  }

  page.innerHTML = `
    <div class="profile-header">
      <div class="avatar">${profile.avatar}</div>
      <div style="flex:1;">
        <h2 style="margin-bottom:2px;">${escapeHtml(profile.name)}</h2>
        <div style="color:var(--ink-soft);">@${profile.username}</div>
        ${profile.bio ? `<div class="profile-bio">${escapeHtml(profile.bio)}</div>` : ''}
        <div class="profile-stats">
          <span><strong>${profile.postCount}</strong> posts</span>
          <span><strong>${profile.followerCount}</strong> followers</span>
          <span><strong>${profile.followingCount}</strong> following</span>
        </div>
      </div>
      <div id="followArea"></div>
    </div>
    <h3>Posts</h3>
    <div id="profilePosts">
      ${
        profile.posts.length === 0
          ? `<div class="empty-state">No posts yet.</div>`
          : profile.posts.map((p) => postCardHtml(p)).join('')
      }
    </div>
  `;

  attachLikeHandlers(document.getElementById('profilePosts'));

  const followArea = document.getElementById('followArea');
  if (currentUser && !profile.isSelf) {
    renderFollowButton(followArea, profile.isFollowing);
  }
}

function renderFollowButton(container, isFollowing) {
  container.innerHTML = `
    <button class="btn ${isFollowing ? 'btn-outline-active' : 'btn-primary'}" id="followBtn">
      ${isFollowing ? 'Following' : 'Follow'}
    </button>
  `;
  document.getElementById('followBtn').addEventListener('click', async () => {
    try {
      const result = await api(`/users/${username}/follow`, { method: isFollowing ? 'DELETE' : 'POST' });
      renderFollowButton(container, result.isFollowing);
      loadProfile(); // refresh follower count
    } catch (e) {
      alert(e.message);
    }
  });
}

loadProfile();
