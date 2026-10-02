const content = document.getElementById('ordersContent');

async function loadOrders() {
  const user = await requireLogin();
  if (!user) return;

  const orders = await api('/orders');

  if (orders.length === 0) {
    content.innerHTML = `<div class="empty-state">No orders yet. <a href="/index.html">Start shopping &rarr;</a></div>`;
    return;
  }

  content.innerHTML = orders
    .map(
      (o) => `
    <div class="order-card">
      <div class="order-head">
        <span>Order #${o.id} &middot; ${new Date(o.created_at).toLocaleString('en-IN')}</span>
        <span>${o.status}</span>
      </div>
      ${o.items
        .map(
          (i) => `<div class="order-item-line"><span>${i.product_name} &times; ${i.quantity}</span><span>${money(i.price_at_purchase * i.quantity)}</span></div>`
        )
        .join('')}
      <div class="order-item-line" style="font-weight:600; border-top:1px solid var(--line); margin-top:8px; padding-top:8px;">
        <span>Total</span><span>${money(o.total)}</span>
      </div>
    </div>
  `
    )
    .join('');
}

loadOrders();
