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
const isEmailNotVerifiedError = message => /confirm|verified|verifikasi|not confirmed/i.test(String(message || ''));

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

async function signUpUser({ name, email, phone, institution, password }) {
  const response = await fetch(authApiUrl('/auth/v1/signup'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      email,
      password,
      data: {
        full_name: name,
        phone,
        institution,
        source: 'AT STRUCTURA Web'
      }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error_description || payload.msg || payload.message || 'Daftar akun gagal.');
  return payload;
}

async function verifyEmailCode(email, token) {
  const response = await fetch(authApiUrl('/auth/v1/verify'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, token, type: 'email' })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error_description || payload.msg || payload.message || 'Kode verifikasi tidak valid atau sudah kedaluwarsa.');
  if (payload.access_token) setUserSession(payload);
  return payload;
}

async function resendVerificationEmail(email) {
  const response = await fetch(authApiUrl('/auth/v1/resend'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ type: 'signup', email })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error_description || payload.msg || payload.message || 'Gagal mengirim ulang kode verifikasi.');
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
      if (isEmailNotVerifiedError(error.message)) {
        const email = encodeURIComponent(String(data.get('email') || '').trim());
        authStatus('Email belum diverifikasi. Mengarahkan ke halaman aktivasi...');
        window.location.href = `/pages/verify-email/?email=${email}`;
        return;
      }
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
        phone: String(data.get('phone') || '').trim(),
        institution: String(data.get('institution') || '').trim(),
        password
      });
      const email = encodeURIComponent(String(data.get('email') || '').trim());
      authStatus('Akun dibuat. Cek email lalu masukkan kode aktivasi.', 'status-online');
      window.location.href = `/pages/verify-email/?email=${email}`;
    } catch (error) {
      authStatus(error.message);
      buildCaptcha(document.getElementById('registerCaptcha'));
      form.elements.captcha.value = '';
    }
  });
}

function setupVerifyEmailForm() {
  const form = document.querySelector('[data-verify-email-form]');
  if (!form) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('email')) form.elements.email.value = params.get('email');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!authReady()) return authStatus('Supabase belum dikonfigurasi.');
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const token = String(data.get('token') || '').trim();
    if (!email || !token) return authStatus('Email dan kode wajib diisi.');
    authStatus('Memverifikasi email...');
    try {
      await verifyEmailCode(email, token);
      authStatus('Email berhasil diverifikasi. Mengarahkan ke akun...', 'status-online');
      window.location.href = safeNextPath('/pages/account/');
    } catch (error) {
      authStatus(error.message);
    }
  });
}

function setupResendVerification() {
  const button = document.querySelector('[data-resend-verification]');
  if (!button) return;
  button.addEventListener('click', async () => {
    if (!authReady()) return authStatus('Supabase belum dikonfigurasi.');
    const email = String(document.querySelector('[data-verify-email-form] [name="email"]')?.value || '').trim();
    if (!email) return authStatus('Isi email dulu untuk kirim ulang kode.');
    authStatus('Mengirim ulang kode verifikasi...');
    try {
      await resendVerificationEmail(email);
      authStatus('Kode verifikasi baru sudah dikirim ke email.', 'status-online');
    } catch (error) {
      authStatus(error.message);
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
  const phone = session.user?.user_metadata?.phone || '-';
  const institution = session.user?.user_metadata?.institution || '-';
  box.innerHTML = `
    <div class="card account-card">
      <span class="icon">AT</span>
      <h2>${name}</h2>
      <p>${email}</p>
      <p>Telepon: ${phone}<br>Instansi: ${institution}</p>
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
setupVerifyEmailForm();
setupResendVerification();
renderAccountPage();
guardProtectedPage();
