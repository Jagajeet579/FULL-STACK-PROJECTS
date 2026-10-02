document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const msg = document.getElementById('formMsg');

  try {
    await api('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    window.location.href = '/index.html';
  } catch (err) {
    msg.innerHTML = `<p class="msg msg-error">${err.message}</p>`;
  }
});
