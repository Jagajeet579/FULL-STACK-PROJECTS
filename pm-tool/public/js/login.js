document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const msg = document.getElementById('formMsg');

  try {
    await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    window.location.href = '/index.html';
  } catch (err) {
    msg.innerHTML = `<p class="msg msg-error">${err.message}</p>`;
  }
});
