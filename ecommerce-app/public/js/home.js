let activeCategory = '';
let activeSearch = '';

async function loadCategories() {
  const cats = await api('/products/categories');
  const row = document.getElementById('filterRow');
  cats.forEach((c) => {
    const chip = el(`<button class="chip" data-category="${c}">${c}</button>`);
    chip.addEventListener('click', () => selectCategory(c, chip));
    row.appendChild(chip);
  });
  row.querySelector('[data-category=""]').addEventListener('click', (e) => selectCategory('', e.target));
}

function selectCategory(category, chipEl) {
  activeCategory = category;
  document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  chipEl.classList.add('active');
  loadProducts();
}

async function loadProducts() {
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '<p>Loading…</p>';

  const params = new URLSearchParams();
  if (activeCategory) params.set('category', activeCategory);
  if (activeSearch) params.set('search', activeSearch);

  const products = await api(`/products?${params.toString()}`);

  if (products.length === 0) {
    grid.innerHTML = `<div class="empty-state">No products match that search.</div>`;
    return;
  }

  grid.innerHTML = '';
  products.forEach((p) => {
    const card = el(`
      <a class="card" href="/product.html?id=${p.id}">
        <div class="emoji">${p.image}</div>
        <span class="cat">${p.category}</span>
        <h3>${p.name}</h3>
        <span class="price">${money(p.price)}</span>
        ${p.stock === 0 ? '<span class="stock-low">Out of stock</span>' : p.stock <= 5 ? `<span class="stock-low">Only ${p.stock} left</span>` : ''}
      </a>
    `);
    grid.appendChild(card);
  });
}

document.getElementById('searchInput').addEventListener('input', (e) => {
  activeSearch = e.target.value;
  clearTimeout(window._searchDebounce);
  window._searchDebounce = setTimeout(loadProducts, 250);
});

loadCategories();
loadProducts();
