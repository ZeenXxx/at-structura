const storageKey = 'at_structura_resource_draft';
const sessionKey = 'at_structura_supabase_session';
const form = document.getElementById('resourceManagerForm');
const output = document.getElementById('resourceJsonOutput');
const preview = document.getElementById('resourceManagerPreview');
const authForm = document.getElementById('resourceAuthForm');
const authEmail = document.getElementById('resourceAdminEmail');
const authPassword = document.getElementById('resourceAdminPassword');
const authStatus = document.getElementById('resourceAuthStatus');
const saveSupabaseBtn = document.getElementById('saveResourceSupabase');
const loadSupabaseBtn = document.getElementById('loadSupabaseResources');
const logoutBtn = document.getElementById('resourceLogout');
const showToast = message => {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
};
const escapeText = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const slugify = value => String(value || 'resource').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'resource';
const cfg = () => window.AT_SUPABASE || {};
const isSupabaseReady = () => Boolean(cfg().enabled && cfg().url && cfg().anonKey && !String(cfg().url).includes('PROJECT_ID') && !String(cfg().anonKey).includes('SUPABASE_ANON_KEY'));
const apiUrl = path => `${String(cfg().url || '').replace(/\/$/, '')}${path}`;
const getSession = () => {
  try { return JSON.parse(localStorage.getItem(sessionKey) || 'null'); } catch { return null; }
};
const setSession = session => localStorage.setItem(sessionKey, JSON.stringify(session));
const clearSession = () => localStorage.removeItem(sessionKey);
const authHeaders = token => ({
  apikey: cfg().anonKey,
  Authorization: `Bearer ${token || cfg().anonKey}`,
  'Content-Type': 'application/json',
  Accept: 'application/json'
});
const visibleStatuses = ['Tersedia', 'Link Eksternal', 'Coming Soon'];
let resources = [];
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
async function ensureSession() {
  const session = getSession();
  if (!session?.access_token) return null;
  const expiresAt = Number(session.expires_at || 0);
  const shouldRefresh = expiresAt && expiresAt * 1000 < Date.now() + 60000;
  if (!shouldRefresh) return session;
  const refreshed = await refreshSession(session);
  if (refreshed) return refreshed;
  clearSession();
  renderStatus();
  return null;
}
function loadLocal() {
  try { resources = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { resources = []; }
}
function saveLocal() { localStorage.setItem(storageKey, JSON.stringify(resources)); }
function resetResourceForm() {
  form.reset();
  form.elements.author.value = 'AT STRUCTURA';
  form.elements.link.value = '#';
  form.elements.status.value = 'Tersedia';
  form.elements.source_type.value = 'mega_link';
}
function renderStatus() {
  if (!authStatus) return;
  if (!isSupabaseReady()) {
    authStatus.textContent = 'Supabase belum dikonfigurasi. Mode aktif: draft lokal + export JSON.';
    authStatus.className = 'page-note manager-status';
    saveSupabaseBtn?.setAttribute('disabled', 'disabled');
    loadSupabaseBtn?.setAttribute('disabled', 'disabled');
    return;
  }
  const session = getSession();
  if (session?.access_token) {
    authStatus.textContent = 'Login aktif. Metadata resource bisa disimpan ke Supabase, file besar tetap berupa link MEGA.';
    authStatus.className = 'page-note manager-status status-online';
    saveSupabaseBtn?.removeAttribute('disabled');
    loadSupabaseBtn?.removeAttribute('disabled');
    logoutBtn?.removeAttribute('disabled');
  } else {
    authStatus.textContent = 'Supabase siap. Login dengan akun admin Supabase untuk menyimpan metadata resource.';
    authStatus.className = 'page-note manager-status';
    saveSupabaseBtn?.setAttribute('disabled', 'disabled');
    loadSupabaseBtn?.removeAttribute('disabled');
    logoutBtn?.setAttribute('disabled', 'disabled');
  }
}
function render() {
  output.value = JSON.stringify(resources, null, 2);
  preview.innerHTML = resources.slice(-5).reverse().map(item => `
    <article class="card resource-card">
      <span class="icon">${escapeText((item.category || 'RES').slice(0, 3).toUpperCase())}</span>
      <div class="meta"><span class="badge">${escapeText(item.category)}</span><span class="badge">${escapeText(item.type)}</span><span class="badge">${escapeText(item.status)}</span></div>
      <h3>${escapeText(item.title)}</h3>
      <p>${escapeText(item.description)}</p>
      <small>Sumber/author: ${escapeText(item.author)}</small>
      <div class="actions"><a class="btn btn-secondary" href="${escapeText(item.link || '#')}" target="_blank" rel="noopener">${item.link && item.link !== '#' ? 'Cek Link' : 'Belum Ada Link'}</a></div>
    </article>
  `).join('') || '<div class="card empty">Belum ada draft resource lokal.</div>';
  renderStatus();
}
function collectResource() {
  const data = new FormData(form);
  const title = String(data.get('title') || '').trim();
  const link = String(data.get('link') || '#').trim() || '#';
  const sourceType = String(data.get('source_type') || 'mega_link').trim();
  return {
    title,
    slug: slugify(title),
    category: String(data.get('category') || '').trim(),
    type: String(data.get('type') || '').trim(),
    author: String(data.get('author') || 'AT STRUCTURA').trim() || 'AT STRUCTURA',
    description: String(data.get('description') || '').trim(),
    status: String(data.get('status') || 'Draft').trim(),
    source_type: sourceType,
    link,
    mega_url: sourceType === 'mega_link' ? link : null,
    external_url: sourceType !== 'mega_link' ? link : null,
    file_name: String(data.get('file_name') || '').trim() || null,
    file_size: Number(data.get('file_size') || '') || null,
    mime_type: String(data.get('mime_type') || '').trim() || null
  };
}
async function supabaseLogin(email, password) {
  const response = await fetch(apiUrl('/auth/v1/token?grant_type=password'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, password })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error_description || payload.msg || 'Login Supabase gagal.');
  setSession(payload);
  renderStatus();
  showToast('Login Supabase berhasil.');
}
async function saveToSupabase(item) {
  if (!isSupabaseReady()) throw new Error('Supabase belum dikonfigurasi.');
  const session = await ensureSession();
  if (!session?.access_token) throw new Error('Login admin Supabase dulu.');
  const table = cfg().resourcesTable || 'resources';
  const response = await fetch(apiUrl(`/rest/v1/${table}?on_conflict=slug`), {
    method: 'POST',
    headers: { ...authHeaders(session.access_token), Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(item)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.msg || `Simpan Supabase gagal (${response.status}).`);
  return Array.isArray(payload) ? payload[0] : payload;
}
async function loadSupabaseResources() {
  if (!isSupabaseReady()) throw new Error('Supabase belum dikonfigurasi.');
  const session = await ensureSession();
  const token = session?.access_token || cfg().anonKey;
  const table = cfg().resourcesTable || 'resources';
  const response = await fetch(apiUrl(`/rest/v1/${table}?select=*&order=created_at.desc`), { headers: authHeaders(token) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.msg || `Load Supabase gagal (${response.status}).`);
  resources = payload.map(item => ({ ...item, link: item.link || item.mega_url || item.external_url || '#' }));
  saveLocal();
  render();
  showToast('Data Supabase dimuat ke preview.');
}
form?.addEventListener('submit', async event => {
  event.preventDefault();
  const item = collectResource();
  const action = event.submitter?.id;
  if (action === 'saveResourceSupabase') {
    try {
      await saveToSupabase(item);
      await loadSupabaseResources();
      showToast(visibleStatuses.includes(item.status) ? 'Resource sudah tampil di halaman Resources.' : 'Resource tersimpan sebagai Draft dan belum tampil publik.');
      resetResourceForm();
      return;
    } catch (error) {
      showToast(error.message);
      return;
    }
  }
  resources.push(item);
  saveLocal();
  render();
  resetResourceForm();
});
authForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!isSupabaseReady()) return showToast('Isi konfigurasi Supabase dulu di js/supabase-config.js.');
  try {
    await supabaseLogin(authEmail.value.trim(), authPassword.value);
    authPassword.value = '';
  } catch (error) {
    showToast(error.message);
  }
});
logoutBtn?.addEventListener('click', () => {
  clearSession();
  renderStatus();
  showToast('Logout Supabase berhasil.');
});
document.getElementById('resetManagerForm')?.addEventListener('click', () => {
  resetResourceForm();
});
document.getElementById('copyResourceJson')?.addEventListener('click', async () => {
  await navigator.clipboard.writeText(output.value);
  showToast('JSON disalin.');
});
document.getElementById('downloadResourceJson')?.addEventListener('click', () => {
  const blob = new Blob([output.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'resources.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});
document.getElementById('importCurrentResources')?.addEventListener('click', async () => {
  const response = await fetch('/data/resources.json');
  resources = await response.json();
  saveLocal();
  render();
  showToast('Data resources saat ini dimuat ke draft lokal.');
});
loadSupabaseBtn?.addEventListener('click', async () => {
  try { await loadSupabaseResources(); } catch (error) { showToast(error.message); }
});
document.getElementById('clearLocalResources')?.addEventListener('click', () => {
  if (!confirm('Hapus semua draft lokal resources?')) return;
  resources = [];
  saveLocal();
  render();
});
output?.addEventListener('input', () => {
  try {
    const parsed = JSON.parse(output.value);
    if (!Array.isArray(parsed)) throw new Error('JSON harus array.');
    resources = parsed;
    saveLocal();
    render();
  } catch {
    // Let user keep editing until JSON is valid.
  }
});
loadLocal();
render();
