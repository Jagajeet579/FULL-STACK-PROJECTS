const content = document.getElementById('cartContent');

async function loadCart() {
  const user = await requireLogin();
  if (!user) return;

  const { items, total } = await api('/cart');

  if (items.length === 0) {
    content.innerHTML = `<div class="empty-state">Your cart is empty. <a href="/index.html">Browse products &rarr;</a></div>`;
    return;
  }

  const rows = items
    .map(
      (i) => `
    <div class="cart-row" data-cart-item-id="${i.cart_item_id}">
      <div class="emoji">${i.image}</div>
      <div>
        <div><a href="/product.html?id=${i.id}">${i.name}</a></div>
        <div style="color:var(--ink-soft); font-size:0.85rem;">${money(i.price)} each</div>
      </div>
      <input type="number" class="qty-input" value="${i.quantity}" min="0" max="${i.stock}" style="width:56px;padding:6px;border:1px solid var(--line);border-radius:3px;" />
      <button class="btn btn-danger remove-btn">Remove</button>
    </div>
  `
    )
    .join('');

  content.innerHTML = `
    <div class="cart-layout">
      <div>${rows}</div>
      <div class="summary-box">
        <h3>Order summary</h3>
        <div class="total-line"><span>Total</span><span id="cartTotal">${money(total)}</span></div>
        <button class="btn btn-primary btn-block" id="checkoutBtn">Place order</button>
        <div id="checkoutFeedback" style="margin-top:12px;"></div>
      </div>
    </div>
  `;

  content.querySelectorAll('.qty-input').forEach((input) => {
    input.addEventListener('change', async (e) => {
      const row = e.target.closest('.cart-row');
      const cartItemId = row.dataset.cartItemId;
      await api(`/cart/${cartItemId}`, { method: 'PUT', body: JSON.stringify({ quantity: parseInt(e.target.value, 10) }) });
      loadCart();
      renderNav();
    });
  });

  content.querySelectorAll('.remove-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const row = e.target.closest('.cart-row');
      await api(`/cart/${row.dataset.cartItemId}`, { method: 'DELETE' });
      loadCart();
      renderNav();
    });
  });

  document.getElementById('checkoutBtn').addEventListener('click', async () => {
    const feedback = document.getElementById('checkoutFeedback');
    try {
      const result = await api('/orders', { method: 'POST' });
      feedback.innerHTML = `<p class="msg msg-success">Order #${result.orderId} placed!</p>`;
      renderNav();
      setTimeout(() => (window.location.href = '/orders.html'), 1200);
    } catch (e) {
      feedback.innerHTML = `<p class="msg msg-error">${e.message}</p>`;
    }
  });
}

loadCart();
