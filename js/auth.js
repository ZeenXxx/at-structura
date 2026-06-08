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
const normalizeAuthError = message => {
  const text = String(message || 'Terjadi kesalahan autentikasi.');
  if (/sending confirmation email|error sending|email address not authorized|smtp|mailer/i.test(text)) {
    return 'Email verifikasi gagal dikirim. Supabase SMTP belum siap untuk email publik. Gunakan email yang terdaftar sebagai anggota team Supabase untuk tes, atau aktifkan Custom SMTP di Supabase Authentication > SMTP.';
  }
  if (/rate limit|too many/i.test(text)) {
    return 'Pengiriman email terlalu sering. Tunggu beberapa menit atau naikkan rate limit setelah Custom SMTP aktif.';
  }
  return text;
};

async function checkMemberAccountStatus(session) {
  if (!session?.access_token) return null;
  const response = await fetch(authApiUrl('/rest/v1/member_profiles?select=user_id,suspended_at,suspend_reason&limit=1'), {
    headers: authHeaders(session.access_token)
  });
  const rows = await response.json().catch(() => []);
  if (!response.ok) return null;
  const profile = Array.isArray(rows) ? rows[0] : null;
  if (!profile) {
    clearUserSession();
    throw new Error('Profil akun tidak aktif atau sudah dihapus.');
  }
  if (profile?.suspended_at) {
    clearUserSession();
    throw new Error(`Akun sedang disuspend. ${profile.suspend_reason || 'Hubungi admin AT STRUCTURA untuk membuka akses.'}`);
  }
  return profile;
}

async function signInUser(email, password) {
  const response = await fetch(authApiUrl('/auth/v1/token?grant_type=password'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, password })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(normalizeAuthError(payload.error_description || payload.msg || payload.message || 'Login gagal. Periksa email dan password.'));
  await checkMemberAccountStatus(payload);
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
  if (!response.ok) throw new Error(normalizeAuthError(payload.error_description || payload.msg || payload.message || 'Daftar akun gagal.'));
  return payload;
}

async function verifyEmailCode(email, token) {
  const response = await fetch(authApiUrl('/auth/v1/verify'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, token, type: 'email' })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(normalizeAuthError(payload.error_description || payload.msg || payload.message || 'Kode verifikasi tidak valid atau sudah kedaluwarsa.'));
  if (payload.access_token) {
    await checkMemberAccountStatus(payload);
    setUserSession(payload);
  }
  return payload;
}

async function sendPasswordRecoveryOtp(email) {
  const response = await fetch(authApiUrl('/auth/v1/recover'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(normalizeAuthError(payload.error_description || payload.msg || payload.message || 'Gagal mengirim OTP recovery password.'));
  return payload;
}

async function verifyRecoveryCode(email, token) {
  const response = await fetch(authApiUrl('/auth/v1/verify'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, token, type: 'recovery' })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(normalizeAuthError(payload.error_description || payload.msg || payload.message || 'Kode recovery tidak valid atau sudah kedaluwarsa.'));
  if (payload.access_token) {
    await checkMemberAccountStatus(payload);
    setUserSession(payload);
  }
  return payload;
}

async function updateUserPassword(password) {
  const session = await ensureUserSession();
  if (!session?.access_token) throw new Error('Sesi recovery tidak ditemukan. Kirim OTP dan verifikasi kode dulu.');
  const response = await fetch(authApiUrl('/auth/v1/user'), {
    method: 'PUT',
    headers: authHeaders(session.access_token),
    body: JSON.stringify({ password })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(normalizeAuthError(payload.error_description || payload.msg || payload.message || 'Password gagal diperbarui.'));
  return payload;
}

function setupChangePasswordForm() {
  const form = document.querySelector('[data-change-password-form]');
  if (!form) return;
  const params = new URLSearchParams(window.location.search);
  const session = getUserSession();
  const initialEmail = params.get('email') || userEmailFromSession(session);
  if (initialEmail) form.elements.email.value = initialEmail;

  document.querySelector('[data-send-password-otp]')?.addEventListener('click', async () => {
    if (!authReady()) return authStatus('Supabase belum dikonfigurasi.');
    const email = String(form.elements.email.value || '').trim();
    if (!email) return authStatus('Isi email akun dulu.');
    authStatus('Mengirim OTP recovery ke email...');
    try {
      await sendPasswordRecoveryOtp(email);
      authStatus('OTP recovery sudah dikirim. Cek inbox/spam email.', 'status-online');
    } catch (error) {
      authStatus(error.message);
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!authReady()) return authStatus('Supabase belum dikonfigurasi.');
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    const token = String(data.get('token') || '').trim();
    const password = String(data.get('password') || '');
    const confirm = String(data.get('confirm_password') || '');
    if (!email || !token) return authStatus('Email dan OTP wajib diisi.');
    if (password.length < 6) return authStatus('Password baru minimal 6 karakter.');
    if (password !== confirm) return authStatus('Konfirmasi password belum sama.');
    authStatus('Memverifikasi OTP dan memperbarui password...');
    try {
      await verifyRecoveryCode(email, token);
      await updateUserPassword(password);
      authStatus('Password berhasil diperbarui. Silakan login ulang jika diminta.', 'status-online');
    } catch (error) {
      authStatus(error.message);
    }
  });
}


async function resendVerificationEmail(email) {
  const response = await fetch(authApiUrl('/auth/v1/resend'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ type: 'signup', email })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(normalizeAuthError(payload.error_description || payload.msg || payload.message || 'Gagal mengirim ulang kode verifikasi.'));
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
  try {
    const session = await ensureUserSession();
    if (session?.access_token) {
      await checkMemberAccountStatus(session);
      document.body.classList.remove('auth-checking');
      return;
    }
  } catch (error) {
    clearUserSession();
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    window.location.replace(`/pages/login/?next=${next}&message=suspended`);
    return;
  }
  const next = encodeURIComponent(`${location.pathname}${location.search}`);
  window.location.replace(`/pages/login/?next=${next}`);
}

async function renderAccountPage() {
  const box = document.querySelector('[data-account-panel]');
  if (!box) return;
  try {
    const session = await ensureUserSession();
    if (!session?.access_token) {
      window.location.replace('/pages/login/?next=/pages/account/');
      return;
    }
    await checkMemberAccountStatus(session);
    document.body.classList.remove('auth-checking');
    renderAccountPanel(box, session);
  } catch (error) {
    clearUserSession();
    window.location.replace('/pages/login/?next=/pages/account/&message=suspended');
    return;
  }
}

function renderAccountPanel(box, session) {
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
        <a class="btn btn-secondary" href="/pages/change-password/">Ganti Password</a>
        <button class="btn btn-danger" type="button" data-user-logout>Logout</button>
      </div>
    </div>
    <div class="account-commerce" data-account-commerce>
      <div class="card empty-state"><span class="icon">DL</span><h3>Memuat akses...</h3><p>Sedang mengambil data order dan download.</p></div>
    </div>
  `;
  renderAccountCommerce();
}

async function renderAccountCommerce() {
  const box = document.querySelector('[data-account-commerce]');
  if (!box || !window.ATShop) return;
  const data = await window.ATShop.loadAccountData();
  const itemByKey = new Map((data.items || []).map(item => [`${item.item_kind}:${item.item_id}`, item]));
  const accessHtml = (data.access || []).map(access => {
    const item = itemByKey.get(`${access.item_kind}:${access.item_id}`);
    return `
      <article class="admin-item">
        <div>
          <div class="meta"><span class="badge tag-red">Akses Aktif</span><span class="badge">${window.ATShop.escape(access.item_kind)}</span></div>
          <h3>${window.ATShop.escape(item?.title || access.item_id)}</h3>
          <p>${window.ATShop.escape(item?.description || 'Akses premium sudah aktif.')}</p>
          ${item ? `
            <div class="download-progress" data-account-download-status="${window.ATShop.escape(access.item_kind)}:${window.ATShop.escape(access.item_id)}">
              <div class="download-progress-bar"><span style="width: 0%"></span></div>
              <small>Siap diunduh.</small>
            </div>
          ` : ''}
        </div>
        ${item ? `<button class="btn btn-primary" type="button" data-account-download="${window.ATShop.escape(access.item_kind)}:${window.ATShop.escape(access.item_id)}">Download</button>` : ''}
      </article>
    `;
  }).join('') || '<div class="empty-state"><span class="icon">AK</span><h3>Belum ada akses premium</h3><p>Item premium akan muncul setelah pembayaran disetujui admin.</p></div>';
  const ordersHtml = (data.orders || []).map(order => `
    <article class="admin-item">
      <div>
        <div class="meta"><span class="badge">${window.ATShop.escape(order.status)}</span><span class="badge">${window.ATShop.money(order.total_amount)}</span></div>
        <h3>${window.ATShop.escape(order.order_number)}</h3>
        <p>${(order.order_items || []).map(item => window.ATShop.escape(item.title_snapshot)).join(', ') || 'Order premium'}</p>
      </div>
      <a class="btn btn-secondary" href="/pages/checkout/?order=${encodeURIComponent(order.id)}">Detail</a>
    </article>
  `).join('') || '<p class="lead">Belum ada order.</p>';
  const savedHtml = (data.saved || []).map(saved => {
    const item = itemByKey.get(`${saved.item_kind}:${saved.item_id}`);
    return `<article class="admin-item"><div><h3>${window.ATShop.escape(item?.title || saved.item_id)}</h3><p>${window.ATShop.escape(saved.item_kind)}</p></div></article>`;
  }).join('') || '<p class="lead">Belum ada item tersimpan.</p>';
  const logsHtml = (data.downloads || []).map(log => `<li>${window.ATShop.escape(log.item_title || log.item_id)} <span>${new Date(log.created_at).toLocaleString('id-ID')}</span></li>`).join('') || '<li>Belum ada riwayat download.</li>';
  box.innerHTML = `
    <section class="account-grid">
      <div class="card account-section"><h2>Akses Saya</h2><div class="admin-list">${accessHtml}</div></div>
      <div class="card account-section"><h2>Order Saya</h2><div class="admin-list">${ordersHtml}</div></div>
      <div class="card account-section"><h2>Disimpan</h2><div class="admin-list">${savedHtml}</div></div>
      <div class="card account-section"><h2>Riwayat Download</h2><ul class="download-list">${logsHtml}</ul></div>
    </section>
  `;
  box.querySelectorAll('[data-account-download]').forEach(button => {
    button.addEventListener('click', async () => {
      const item = itemByKey.get(button.dataset.accountDownload);
      if (!item) return;
      const status = box.querySelector(`[data-account-download-status="${CSS.escape(button.dataset.accountDownload)}"]`);
      const bar = status?.querySelector('.download-progress-bar span');
      const text = status?.querySelector('small');
      const originalText = button.textContent;
      const setProgress = detail => {
        const percent = Number(detail.percent || 0);
        if (bar) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
        if (text) text.textContent = detail.message || 'Memproses download...';
        button.textContent = detail.phase === 'done' ? 'Download' : 'Memproses...';
      };
      try {
        button.disabled = true;
        setProgress({ percent: 0, message: 'Menyiapkan download...' });
        await window.ATShop.openItem(item, { onProgress: setProgress });
      } catch (error) {
        if (text) text.textContent = error.message;
        if (bar) bar.style.width = '0%';
        window.ATShop.showToast(error.message);
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  });
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
setupChangePasswordForm();
renderAccountPage();
guardProtectedPage();
