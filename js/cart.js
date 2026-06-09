const cartList = document.getElementById('cartList');
const cartTotal = document.getElementById('cartTotal');
const clearCartButton = document.getElementById('clearCartButton');
const checkoutPanel = document.getElementById('checkoutPanel');
const paymentDestinations = [
  ['BCA', '1394026657'],
  ['SeaBank', '901303469040'],
  ['GoPay', '081220032582'],
  ['ShopeePay', '081220032582'],
  ['Blu BCA', '008572518618'],
  ['OVO', '081220032582'],
  ['LinkAja', '081220032582']
];
const paymentDestinationOptions = () => paymentDestinations
  .map(([name, number]) => `<option value="${window.ATShop.escape(`${name} - ${number}`)}">${window.ATShop.escape(`${name} - ${number}`)}</option>`)
  .join('');

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
  const destination = order.payment_destination || 'BCA - 1394026657';
  return `
    <div class="checkout-invoice-head">
      <div>
        <span class="eyebrow">Invoice</span>
        <h2>${window.ATShop.escape(order.order_number)}</h2>
        <p>Status: <strong>${window.ATShop.escape(order.status)}</strong></p>
      </div>
      <span class="badge tag-red">${window.ATShop.money(order.total_amount)}</span>
    </div>
    <div class="shop-order-items">
      ${items.map(item => `<div><span>${window.ATShop.escape(item.title_snapshot)}</span><strong>${window.ATShop.money(item.price_snapshot)}</strong></div>`).join('')}
    </div>
    <div class="payment-destination-box">
      <h3>Rekening / E-wallet Tujuan</h3>
      <div class="payment-destination-grid">
        ${paymentDestinations.map(([name, number]) => `<div><strong>${window.ATShop.escape(name)}</strong><span>${window.ATShop.escape(number)}</span></div>`).join('')}
      </div>
    </div>
    <form class="manager-auth-form" id="proofForm">
      <div class="form-grid-2">
        <label>Jenis Pembayaran<select class="control" name="sourceType" required>
          <option value="Bank">Bank</option>
          <option value="E-wallet">E-wallet</option>
        </select></label>
        <label>Nama Bank / E-wallet Pengirim<input class="control" name="sourceName" placeholder="Contoh: BCA, Mandiri, DANA, GoPay" required></label>
        <label>Nomor Rekening / Nomor E-wallet Pengirim<input class="control" name="accountNumber" inputmode="numeric" placeholder="Nomor pengirim" required></label>
        <label>Nama Pemilik Rekening / E-wallet<input class="control" name="accountName" placeholder="Nama pengirim" required></label>
      </div>
      <label>Bank / E-wallet Tujuan<select class="control" name="destination" required>
        ${paymentDestinationOptions()}
      </select></label>
      <label>Catatan Pembayaran<textarea class="control textarea" name="note" placeholder="Opsional: nominal transfer, waktu transfer, atau catatan lain"></textarea></label>
      <label>Upload bukti pembayaran<input class="control" type="file" name="proof" accept="image/*,.pdf" required></label>
      <div class="manager-actions">
        <button class="btn btn-primary" type="submit">Upload Bukti</button>
        <a class="btn btn-secondary" href="/pages/account/">Lihat Akun</a>
      </div>
      <div class="page-note manager-status" data-proof-status>${order.proof_file_name ? `Bukti terakhir: ${window.ATShop.escape(order.proof_file_name)} | Tujuan: ${window.ATShop.escape(destination)}` : 'Belum ada bukti pembayaran.'}</div>
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
  const payment = {
    sourceType: event.target.elements.sourceType.value,
    sourceName: event.target.elements.sourceName.value.trim(),
    accountNumber: event.target.elements.accountNumber.value.trim(),
    accountName: event.target.elements.accountName.value.trim(),
    destination: event.target.elements.destination.value,
    note: event.target.elements.note.value.trim()
  };
  status.textContent = 'Mengupload bukti pembayaran...';
  try {
    await window.ATShop.submitPaymentProof(params.get('order'), file, payment);
    status.textContent = 'Bukti pembayaran terkirim. Menunggu review admin.';
    window.ATShop.showToast('Bukti pembayaran terkirim.');
  } catch (error) {
    status.textContent = error.message;
  }
});

clearCartButton?.addEventListener('click', () => { window.ATShop.clearCart(); renderCart(); });
renderCart();
renderCheckout();
