const cartList = document.getElementById('cartList');
const cartTotal = document.getElementById('cartTotal');
const clearCartButton = document.getElementById('clearCartButton');
const checkoutPanel = document.getElementById('checkoutPanel');

function cartItemHtml(item) {
  return `
    <article class="admin-item shop-line">
      <div>
        <div class="meta">
          <span class="badge">${window.ATShop.escape(item.item_kind === 'software' ? 'Software' : 'Resource')}</span>
          <span class="badge tag-red">${window.ATShop.money(item.price)}</span>
        </div>
        <h3>${window.ATShop.escape(item.title)}</h3>
        <p>${window.ATShop.escape(item.description || item.category || '')}</p>
      </div>
      <button class="btn btn-danger" type="button" data-cart-remove="${window.ATShop.escape(item.item_kind)}:${window.ATShop.escape(item.item_id)}">Hapus</button>
    </article>
  `;
}

function renderCart() {
  if (!cartList) return;
  const items = window.ATShop.readCart();
  const total = items.reduce((sum, item) => sum + Number(item.price || 0), 0);
  cartTotal.textContent = window.ATShop.money(total);
  cartList.innerHTML = items.map(cartItemHtml).join('') || `
    <div class="empty-state">
      <span class="icon">KR</span>
      <h3>Keranjang masih kosong</h3>
      <p>Tambahkan template atau resource premium dari halaman Resources atau Software.</p>
      <div class="actions"><a class="btn btn-primary" href="/pages/resources/">Cari Resource</a><a class="btn btn-secondary" href="/pages/software/">Cari Software</a></div>
    </div>
  `;
}

async function fetchOrder(orderId) {
  const session = await window.ATAuth.ensureUserSession();
  const response = await fetch(`${window.AT_SUPABASE.url}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=*,order_items(*)&limit=1`, {
    headers: {
      apikey: window.AT_SUPABASE.anonKey,
      Authorization: `Bearer ${session.access_token}`,
      Accept: 'application/json'
    }
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok || !rows.length) throw new Error('Order tidak ditemukan.');
  return rows[0];
}

function orderHtml(order) {
  const items = order.order_items || [];
  return `
    <span class="eyebrow">Invoice</span>
    <h2>${window.ATShop.escape(order.order_number)}</h2>
    <p>Status: <strong>${window.ATShop.escape(order.status)}</strong></p>
    <div class="shop-order-items">
      ${items.map(item => `<div><span>${window.ATShop.escape(item.title_snapshot)}</span><strong>${window.ATShop.money(item.price_snapshot)}</strong></div>`).join('')}
    </div>
    <h3>Total: ${window.ATShop.money(order.total_amount)}</h3>
    <form class="manager-auth-form" id="proofForm">
      <label>Upload bukti pembayaran<input class="control" type="file" name="proof" accept="image/*,.pdf" required></label>
      <div class="manager-actions">
        <button class="btn btn-primary" type="submit">Upload Bukti</button>
        <a class="btn btn-secondary" href="/pages/account/">Lihat Akun</a>
      </div>
      <div class="page-note manager-status" data-proof-status>${order.proof_file_name ? `Bukti terakhir: ${window.ATShop.escape(order.proof_file_name)}` : 'Belum ada bukti pembayaran.'}</div>
    </form>
  `;
}

async function renderCheckout() {
  if (!checkoutPanel) return;
  const params = new URLSearchParams(location.search);
  const orderId = params.get('order');
  if (orderId) {
    try {
      const order = await fetchOrder(orderId);
      checkoutPanel.innerHTML = orderHtml(order);
    } catch (error) {
      checkoutPanel.innerHTML = `<div class="empty-state"><span class="icon">IN</span><h3>Order gagal dimuat</h3><p>${window.ATShop.escape(error.message)}</p></div>`;
    }
    return;
  }
  const items = window.ATShop.readCart();
  const total = items.reduce((sum, item) => sum + Number(item.price || 0), 0);
  checkoutPanel.innerHTML = `
    <span class="eyebrow">Konfirmasi</span>
    <h2>${window.ATShop.money(total)}</h2>
    <div class="shop-order-items">${items.map(item => `<div><span>${window.ATShop.escape(item.title)}</span><strong>${window.ATShop.money(item.price)}</strong></div>`).join('')}</div>
    <div class="manager-actions">
      <button class="btn btn-primary" type="button" id="createOrderButton" ${items.length ? '' : 'disabled'}>Buat Order</button>
      <a class="btn btn-secondary" href="/pages/cart/">Kembali</a>
    </div>
  `;
}

document.addEventListener('click', async event => {
  const remove = event.target.closest('[data-cart-remove]');
  if (remove) {
    const [kind, id] = remove.dataset.cartRemove.split(':');
    window.ATShop.removeFromCart(kind, id);
    renderCart();
    return;
  }
  if (event.target.closest('#createOrderButton')) {
    try {
      const order = await window.ATShop.createOrderFromCart();
      window.ATShop.clearCart();
      location.href = `/pages/checkout/?order=${encodeURIComponent(order.order_id)}`;
    } catch (error) {
      window.ATShop.showToast(error.message);
    }
  }
});

document.addEventListener('submit', async event => {
  if (!event.target.closest('#proofForm')) return;
  event.preventDefault();
  const params = new URLSearchParams(location.search);
  const status = document.querySelector('[data-proof-status]');
  const file = event.target.elements.proof.files[0];
  status.textContent = 'Mengupload bukti pembayaran...';
  try {
    await window.ATShop.submitPaymentProof(params.get('order'), file);
    status.textContent = 'Bukti pembayaran terkirim. Menunggu review admin.';
    window.ATShop.showToast('Bukti pembayaran terkirim.');
  } catch (error) {
    status.textContent = error.message;
  }
});

clearCartButton?.addEventListener('click', () => { window.ATShop.clearCart(); renderCart(); });
renderCart();
renderCheckout();
