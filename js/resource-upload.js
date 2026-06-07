const storageKey = 'at_structura_resource_draft';
const sessionKey = 'at_structura_supabase_session';
const loginPath = '/pages/resource-login/';
const form = document.getElementById('resourceManagerForm');
const output = document.getElementById('resourceJsonOutput');
const preview = document.getElementById('resourceManagerPreview');
const sessionStatus = document.getElementById('managerSessionStatus');
const loadSupabaseBtn = document.getElementById('loadSupabaseResources');
const logoutBtn = document.getElementById('resourceLogout');
const managerSearch = document.getElementById('managerSearch');
const managerStatusFilter = document.getElementById('managerStatusFilter');
const visibleStatuses = ['Tersedia', 'Link Eksternal', 'Coming Soon'];
let resources = [];

const showToast = message => {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
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
const redirectToLogin = () => {
  const next = encodeURIComponent('/pages/resource-upload/');
  window.location.replace(`${loginPath}?next=${next}`);
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
async function ensureSession() {
  const session = getSession();
  if (!session?.access_token) return null;
  const expiresAt = Number(session.expires_at || 0);
  const shouldRefresh = expiresAt && expiresAt * 1000 < Date.now() + 60000;
  if (!shouldRefresh) return session;
  const refreshed = await refreshSession(session);
  if (refreshed) return refreshed;
  clearSession();
  return null;
}
function normalizeResource(item) {
  return {
    ...item,
    link: item.link || item.mega_url || item.external_url || '#',
    status: item.status || 'Draft',
    source_type: item.source_type || 'mega_link'
  };
}
function filteredResources() {
  const q = (managerSearch?.value || '').toLowerCase();
  const status = managerStatusFilter?.value || 'All';
  return resources.filter(item => {
    const haystack = [item.title, item.category, item.type, item.author, item.description, item.status, item.link].join(' ').toLowerCase();
    return (status === 'All' || item.status === status) && haystack.includes(q);
  });
}
function setSessionStatus(message) {
  if (sessionStatus) sessionStatus.textContent = message;
}
function resetResourceForm() {
  form.reset();
  form.elements.id.value = '';
  form.elements.author.value = 'AT STRUCTURA';
  form.elements.link.value = '#';
  form.elements.status.value = 'Tersedia';
  form.elements.source_type.value = 'mega_link';
  document.getElementById('saveResourceSupabase').textContent = 'Simpan Resource';
}
function render() {
  const data = filteredResources();
  output.value = JSON.stringify(resources, null, 2);
  preview.innerHTML = data.map(item => `
    <article class="card manager-resource-card" data-id="${escapeText(item.id || '')}">
      <div class="manager-resource-main">
        <div>
          <div class="meta">
            <span class="badge">${escapeText(item.category)}</span>
            <span class="badge">${escapeText(item.type)}</span>
            <span class="badge ${visibleStatuses.includes(item.status) ? 'tag-red' : ''}">${escapeText(item.status)}</span>
          </div>
          <h3>${escapeText(item.title)}</h3>
          <p>${escapeText(item.description)}</p>
          <small>${escapeText(item.author)} · ${escapeText(item.source_type)} · ${escapeText(item.link || '#')}</small>
        </div>
        <div class="manager-row-actions">
          <button class="btn btn-secondary" type="button" data-action="edit" data-id="${escapeText(item.id || '')}">Edit</button>
          <button class="btn btn-danger" type="button" data-action="delete" data-id="${escapeText(item.id || '')}">Hapus</button>
        </div>
      </div>
    </article>
  `).join('') || '<div class="card empty">Resource tidak ditemukan.</div>';
  setSessionStatus(`${resources.length} resource terbaca dari Supabase. ${data.length} item sesuai filter.`);
}
function collectResource() {
  const data = new FormData(form);
  const id = String(data.get('id') || '').trim();
  const title = String(data.get('title') || '').trim();
  const link = String(data.get('link') || '#').trim() || '#';
  const sourceType = String(data.get('source_type') || 'mega_link').trim();
  return {
    id,
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
function fillForm(item) {
  form.elements.id.value = item.id || '';
  form.elements.title.value = item.title || '';
  form.elements.category.value = item.category || 'SNI';
  form.elements.type.value = item.type || 'PDF';
  form.elements.author.value = item.author || 'AT STRUCTURA';
  form.elements.status.value = item.status || 'Tersedia';
  form.elements.source_type.value = item.source_type || 'mega_link';
  form.elements.link.value = item.link || item.mega_url || item.external_url || '#';
  form.elements.file_name.value = item.file_name || '';
  form.elements.file_size.value = item.file_size || '';
  form.elements.mime_type.value = item.mime_type || '';
  form.elements.description.value = item.description || '';
  document.getElementById('saveResourceSupabase').textContent = 'Update Resource';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function loadSupabaseResources() {
  if (!isSupabaseReady()) throw new Error('Supabase belum dikonfigurasi.');
  const session = await ensureSession();
  if (!session?.access_token) {
    redirectToLogin();
    return;
  }
  const table = cfg().resourcesTable || 'resources';
  const response = await fetch(apiUrl(`/rest/v1/${table}?select=*&order=created_at.desc`), { headers: authHeaders(session.access_token) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.msg || `Load Supabase gagal (${response.status}).`);
  resources = payload.map(normalizeResource);
  localStorage.setItem(storageKey, JSON.stringify(resources));
  render();
}
async function saveToSupabase(item) {
  const session = await ensureSession();
  if (!session?.access_token) {
    redirectToLogin();
    return null;
  }
  const table = cfg().resourcesTable || 'resources';
  const body = { ...item };
  const id = body.id;
  delete body.id;
  const path = id ? `/rest/v1/${table}?id=eq.${encodeURIComponent(id)}` : `/rest/v1/${table}?on_conflict=slug`;
  const response = await fetch(apiUrl(path), {
    method: id ? 'PATCH' : 'POST',
    headers: { ...authHeaders(session.access_token), Prefer: id ? 'return=representation' : 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.msg || `Simpan Supabase gagal (${response.status}).`);
  return Array.isArray(payload) ? payload[0] : payload;
}
async function deleteFromSupabase(id) {
  const session = await ensureSession();
  if (!session?.access_token) {
    redirectToLogin();
    return;
  }
  const table = cfg().resourcesTable || 'resources';
  const response = await fetch(apiUrl(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: { ...authHeaders(session.access_token), Prefer: 'return=minimal' }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || payload.msg || `Hapus Supabase gagal (${response.status}).`);
  }
}
form?.addEventListener('submit', async event => {
  event.preventDefault();
  const item = collectResource();
  try {
    await saveToSupabase(item);
    await loadSupabaseResources();
    showToast(visibleStatuses.includes(item.status) ? 'Resource tersimpan dan tampil di halaman Resources.' : 'Resource tersimpan, tetapi belum tampil publik karena statusnya tidak publik.');
    resetResourceForm();
  } catch (error) {
    showToast(error.message);
  }
});
preview?.addEventListener('click', async event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const item = resources.find(resource => resource.id === button.dataset.id);
  if (!item) return showToast('Resource tidak ditemukan di data manager.');
  if (button.dataset.action === 'edit') {
    fillForm(item);
    return;
  }
  if (!confirm(`Hapus resource "${item.title}" dari Supabase?`)) return;
  try {
    await deleteFromSupabase(item.id);
    await loadSupabaseResources();
    if (form.elements.id.value === item.id) resetResourceForm();
    showToast('Resource berhasil dihapus dari Supabase.');
  } catch (error) {
    showToast(error.message);
  }
});
logoutBtn?.addEventListener('click', () => {
  clearSession();
  window.location.href = loginPath;
});
document.getElementById('resetManagerForm')?.addEventListener('click', resetResourceForm);
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
loadSupabaseBtn?.addEventListener('click', async () => {
  try {
    await loadSupabaseResources();
    showToast('Data Supabase dimuat ulang.');
  } catch (error) {
    showToast(error.message);
  }
});
managerSearch?.addEventListener('input', render);
managerStatusFilter?.addEventListener('change', render);

(async function initManager() {
  if (!isSupabaseReady()) {
    setSessionStatus('Supabase belum dikonfigurasi.');
    return;
  }
  const session = await ensureSession();
  if (!session?.access_token) {
    redirectToLogin();
    return;
  }
  resetResourceForm();
  try {
    await loadSupabaseResources();
  } catch (error) {
    showToast(error.message);
  }
}());
