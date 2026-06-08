const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav-links');
const publicUserSessionKey = 'at_structura_user_session';

function readPublicUserSession() {
  try { return JSON.parse(localStorage.getItem(publicUserSessionKey) || 'null'); } catch { return null; }
}

function appendAuthLinks() {
  if (!nav || nav.dataset.authReady === 'true') return;
  nav.dataset.authReady = 'true';
  const cartCount = (() => {
    try { return JSON.parse(localStorage.getItem('at_structura_cart') || '[]').length; } catch { return 0; }
  })();
  nav.insertAdjacentHTML('beforeend', `
    <a class="cart-link" href="/pages/cart/" data-page="cart" aria-label="Keranjang">
      <span class="cart-icon" aria-hidden="true"></span>
      <span class="cart-label">Keranjang</span>
      <span class="cart-badge ${cartCount > 0 ? 'show' : ''}" data-cart-count>${cartCount > 0 ? cartCount : ''}</span>
    </a>
  `);
  const session = readPublicUserSession();
  if (session?.access_token) {
    nav.insertAdjacentHTML('beforeend', `
      <a href="/pages/account/" data-page="account">Akun</a>
      <button class="nav-auth-button" type="button" data-user-logout>Logout</button>
    `);
    return;
  }
  nav.insertAdjacentHTML('beforeend', `
    <a href="/pages/daftar/" data-page="daftar">Daftar</a>
    <a href="/pages/login/" data-page="login">Login</a>
  `);
}

appendAuthLinks();

if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', event => {
    if (event.target.closest('a') || event.target.closest('button')) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

document.addEventListener('click', event => {
  if (!event.target.closest('[data-user-logout]')) return;
  localStorage.removeItem(publicUserSessionKey);
  window.location.href = '/';
});

const active = nav?.dataset.active;
if (active) {
  nav.querySelectorAll('[data-page]').forEach(link => link.classList.toggle('active', link.dataset.page === active));
}
