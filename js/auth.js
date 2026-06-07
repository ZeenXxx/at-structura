const userSessionKey = 'at_structura_user_session';

const authCfg = () => window.AT_SUPABASE || {};
const authApiUrl = path => `${String(authCfg().url || '').replace(/\/$/, '')}${path}`;
const authReady = () => Boolean(authCfg().enabled && authCfg().url && authCfg().anonKey && !String(authCfg().url).includes('PROJECT_ID') && !String(authCfg().anonKey).includes('SUPABASE_ANON_KEY'));
const authHeaders = token => ({
  apikey: authCfg().anonKey,
  Authorization: `Bearer ${token || authCfg().anonKey}`,
  'Content-Type': 'application/json',
  Accept: 'application/json'
});
const getUserSession = () => {
  try { return JSON.parse(localStorage.getItem(userSessionKey) || 'null'); } catch { return null; }
};
const setUserSession = session => localStorage.setItem(userSessionKey, JSON.stringify(session));
const clearUserSession = () => localStorage.removeItem(userSessionKey);
const safeNextPath = fallback => {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next') || fallback || '/';
  return next.startsWith('/') && !next.startsWith('//') ? next : fallback || '/';
};
const userEmailFromSession = session => session?.user?.email || session?.email || '';
const captchaState = {};

async function refreshUserSession(session = getUserSession()) {
  if (!authReady() || !session?.refresh_token) return null;
  const response = await fetch(authApiUrl('/auth/v1/token?grant_type=refresh_token'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  setUserSession(payload);
  return payload;
}

async function ensureUserSession() {
  const session = getUserSession();
  if (!session?.access_token) return null;
  const expiresAt = Number(session.expires_at || 0);
  if (!expiresAt || expiresAt * 1000 > Date.now() + 60000) return session;
  const refreshed = await refreshUserSession(session);
  if (refreshed) return refreshed;
  clearUserSession();
  return null;
}

function buildCaptcha(target) {
  if (!target) return null;
  const a = Math.floor(Math.random() * 8) + 2;
  const b = Math.floor(Math.random() * 8) + 2;
  const id = target.id || `captcha-${Math.random().toString(36).slice(2)}`;
  target.id = id;
  captchaState[id] = a + b;
  target.innerHTML = `
    <div class="captcha-box">
      <div>
        <span class="eyebrow">Captcha</span>
        <strong>${a} + ${b} = ?</strong>
      </div>
      <button class="btn btn-secondary captcha-refresh" type="button" data-captcha-refresh="${id}">Acak</button>
    </div>
  `;
  return id;
}

function captchaValid(id, value) {
  return Number(value) === captchaState[id];
}

function authStatus(message, tone = '') {
  const box = document.querySelector('[data-auth-status]');
  if (!box) return;
  box.textContent = message;
  box.className = `page-note manager-status ${tone}`.trim();
}

async function signInUser(email, password) {
  const response = await fetch(authApiUrl('/auth/v1/token?grant_type=password'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, password })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error_description || payload.msg || payload.message || 'Login gagal. Periksa email dan password.');
  setUserSession(payload);
  return payload;
}

async function signUpUser({ name, email, password }) {
  const response = await fetch(authApiUrl('/auth/v1/signup'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      email,
      password,
      data: { full_name: name, source: 'AT STRUCTURA Web' }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error_description || payload.msg || payload.message || 'Daftar akun gagal.');
  if (payload.access_token) setUserSession(payload);
  return payload;
}

function setupLoginForm() {
  const form = document.querySelector('[data-login-form]');
  if (!form) return;
  const captchaId = buildCaptcha(document.getElementById('loginCaptcha'));
  ensureUserSession().then(session => {
    if (session?.access_token) window.location.replace(safeNextPath('/pages/account/'));
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!authReady()) return authStatus('Supabase belum dikonfigurasi.');
    const data = new FormData(form);
    if (!captchaValid(captchaId, data.get('captcha'))) return authStatus('Captcha belum benar. Coba hitung lagi.');
    authStatus('Memproses login...');
    try {
      await signInUser(String(data.get('email') || '').trim(), String(data.get('password') || ''));
      authStatus('Login berhasil. Mengarahkan...', 'status-online');
      window.location.href = safeNextPath('/pages/account/');
    } catch (error) {
      authStatus(error.message);
      buildCaptcha(document.getElementById('loginCaptcha'));
      form.elements.captcha.value = '';
    }
  });
}

function setupRegisterForm() {
  const form = document.querySelector('[data-register-form]');
  if (!form) return;
  const captchaId = buildCaptcha(document.getElementById('registerCaptcha'));
  ensureUserSession().then(session => {
    if (session?.access_token) window.location.replace(safeNextPath('/pages/account/'));
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!authReady()) return authStatus('Supabase belum dikonfigurasi.');
    const data = new FormData(form);
    const password = String(data.get('password') || '');
    const confirm = String(data.get('confirm_password') || '');
    if (password.length < 6) return authStatus('Password minimal 6 karakter.');
    if (password !== confirm) return authStatus('Konfirmasi password belum sama.');
    if (!captchaValid(captchaId, data.get('captcha'))) return authStatus('Captcha belum benar. Coba hitung lagi.');
    authStatus('Membuat akun...');
    try {
      const payload = await signUpUser({
        name: String(data.get('name') || '').trim(),
        email: String(data.get('email') || '').trim(),
        password
      });
      if (payload.access_token) {
        authStatus('Akun berhasil dibuat. Mengarahkan...', 'status-online');
        window.location.href = safeNextPath('/pages/account/');
        return;
      }
      authStatus('Akun berhasil dibuat. Jika Supabase meminta verifikasi, cek email sebelum login.', 'status-online');
      form.reset();
      buildCaptcha(document.getElementById('registerCaptcha'));
    } catch (error) {
      authStatus(error.message);
      buildCaptcha(document.getElementById('registerCaptcha'));
      form.elements.captcha.value = '';
    }
  });
}

async function guardProtectedPage() {
  if (!document.body?.dataset.requireAuth) return;
  const session = await ensureUserSession();
  if (session?.access_token) {
    document.body.classList.remove('auth-checking');
    return;
  }
  const next = encodeURIComponent(`${location.pathname}${location.search}`);
  window.location.replace(`/pages/login/?next=${next}`);
}

async function renderAccountPage() {
  const box = document.querySelector('[data-account-panel]');
  if (!box) return;
  const session = await ensureUserSession();
  if (!session?.access_token) {
    window.location.replace('/pages/login/?next=/pages/account/');
    return;
  }
  const email = userEmailFromSession(session);
  const name = session.user?.user_metadata?.full_name || 'Pengguna AT STRUCTURA';
  box.innerHTML = `
    <div class="card account-card">
      <span class="icon">AT</span>
      <h2>${name}</h2>
      <p>${email}</p>
      <div class="actions">
        <a class="btn btn-primary" href="/pages/software/">Buka Software</a>
        <a class="btn btn-secondary" href="/pages/jasa/">Buka Jasa</a>
        <button class="btn btn-danger" type="button" data-user-logout>Logout</button>
      </div>
    </div>
  `;
}

document.addEventListener('click', event => {
  const refresh = event.target.closest('[data-captcha-refresh]');
  if (refresh) {
    buildCaptcha(document.getElementById(refresh.dataset.captchaRefresh));
    return;
  }
  if (event.target.closest('[data-user-logout]')) {
    clearUserSession();
    window.location.href = '/';
  }
});

window.ATAuth = {
  getUserSession,
  ensureUserSession,
  clearUserSession,
  userSessionKey
};

setupLoginForm();
setupRegisterForm();
renderAccountPage();
guardProtectedPage();
