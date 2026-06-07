const sessionKey = 'at_structura_supabase_session';
const managerPath = '/pages/resource-upload/';
const form = document.getElementById('resourceLoginForm');
const email = document.getElementById('resourceAdminEmail');
const password = document.getElementById('resourceAdminPassword');
const statusBox = document.getElementById('resourceLoginStatus');
const cfg = () => window.AT_SUPABASE || {};
const isSupabaseReady = () => Boolean(cfg().enabled && cfg().url && cfg().anonKey && !String(cfg().url).includes('PROJECT_ID') && !String(cfg().anonKey).includes('SUPABASE_ANON_KEY'));
const apiUrl = path => `${String(cfg().url || '').replace(/\/$/, '')}${path}`;
const authHeaders = token => ({
  apikey: cfg().anonKey,
  Authorization: `Bearer ${token || cfg().anonKey}`,
  'Content-Type': 'application/json',
  Accept: 'application/json'
});
const getSession = () => {
  try { return JSON.parse(localStorage.getItem(sessionKey) || 'null'); } catch { return null; }
};
const setSession = session => localStorage.setItem(sessionKey, JSON.stringify(session));
const setStatus = (message, tone = '') => {
  if (!statusBox) return;
  statusBox.textContent = message;
  statusBox.className = `page-note manager-status ${tone}`.trim();
};
const nextPath = () => {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next') || managerPath;
  return next.startsWith('/') ? next : managerPath;
};
async function refreshSession(session) {
  if (!session?.refresh_token) return null;
  const response = await fetch(apiUrl('/auth/v1/token?grant_type=refresh_token'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  setSession(payload);
  return payload;
}
async function validateExistingSession() {
  if (!isSupabaseReady()) {
    setStatus('Supabase belum dikonfigurasi.');
    return;
  }
  const session = getSession();
  if (!session?.access_token) {
    setStatus('Login dulu untuk masuk ke Resource Manager.');
    return;
  }
  const expiresAt = Number(session.expires_at || 0);
  if (expiresAt && expiresAt * 1000 < Date.now() + 60000) {
    const refreshed = await refreshSession(session);
    if (!refreshed) {
      localStorage.removeItem(sessionKey);
      setStatus('Sesi lama sudah habis. Silakan login ulang.');
      return;
    }
  }
  setStatus('Sesi admin masih aktif. Mengarahkan ke Resource Manager...', 'status-online');
  window.location.replace(nextPath());
}
async function loginAdmin() {
  const response = await fetch(apiUrl('/auth/v1/token?grant_type=password'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email: email.value.trim(), password: password.value })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error_description || payload.msg || 'Login Supabase gagal.');
  setSession(payload);
}
form?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!isSupabaseReady()) return setStatus('Supabase belum dikonfigurasi.');
  setStatus('Memproses login...');
  try {
    await loginAdmin();
    password.value = '';
    setStatus('Login berhasil. Mengarahkan ke Resource Manager...', 'status-online');
    window.location.href = nextPath();
  } catch (error) {
    setStatus(error.message);
  }
});
validateExistingSession();
