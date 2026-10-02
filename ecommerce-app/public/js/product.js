const productId = new URLSearchParams(window.location.search).get('id');
const page = document.getElementById('productPage');

async function loadProduct() {
  let product;
  try {
    product = await api(`/products/${productId}`);
  } catch (e) {
    page.innerHTML = `<div class="empty-state">Product not found. <a href="/index.html">Back to shop</a></div>`;
    return;
  }

  page.innerHTML = `
    <a href="/index.html" class="btn-secondary btn" style="margin-bottom:24px;">&larr; Back to shop</a>
    <div class="detail">
      <div class="emoji-large">${product.image}</div>
      <div>
        <span class="cat">${product.category}</span>
        <h1>${product.name}</h1>
        <p>${product.description}</p>
        <div class="price-large">${money(product.price)}</div>
        ${
          product.stock === 0
            ? '<p class="stock-low">Currently out of stock.</p>'
            : `<p class="stock-low" style="color:var(--ink-soft)">${product.stock} in stock</p>`
        }
        <div class="qty-row">
          <label for="qty">Qty</label>
          <input type="number" id="qty" value="1" min="1" max="${product.stock}" />
          <button class="btn btn-primary" id="addBtn" ${product.stock === 0 ? 'disabled' : ''}>Add to cart</button>
        </div>
        <div id="feedback"></div>
      </div>
    </div>
  `;

  document.getElementById('addBtn').addEventListener('click', async () => {
    const qty = parseInt(document.getElementById('qty').value, 10) || 1;
    const feedback = document.getElementById('feedback');
    try {
      await api('/cart', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id, quantity: qty }),
      });
      feedback.innerHTML = `<p class="msg msg-success">Added to cart. <a href="/cart.html">View cart &rarr;</a></p>`;
      renderNav();
    } catch (e) {
      if (e.message.includes('log in')) {
        window.location.href = '/login.html';
        return;
      }
      feedback.innerHTML = `<p class="msg msg-error">${e.message}</p>`;
    }
  });
}

loadProduct();
