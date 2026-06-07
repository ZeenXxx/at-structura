const sessionKey = 'at_structura_supabase_session';
const loginPath = '/pages/resource-login/';
const state = { resources: [], software: [], services: [], activePanel: 'resources' };
const visibleStatuses = ['Tersedia', 'Link Eksternal', 'Coming Soon'];
const serviceVisibleStatuses = ['Aktif'];

const els = {
  sessionStatus: document.getElementById('adminSessionStatus'),
  resourceCount: document.getElementById('resourceCount'),
  softwareCount: document.getElementById('softwareCount'),
  serviceCount: document.getElementById('serviceCount'),
  logout: document.getElementById('adminLogout'),
  resourceForm: document.getElementById('resourceAdminForm'),
  softwareForm: document.getElementById('softwareAdminForm'),
  serviceForm: document.getElementById('serviceAdminForm'),
  resourceList: document.getElementById('resourceAdminList'),
  softwareList: document.getElementById('softwareAdminList'),
  serviceList: document.getElementById('serviceAdminList'),
  resourceSearch: document.getElementById('resourceAdminSearch'),
  resourceStatus: document.getElementById('resourceAdminStatus'),
  softwareSearch: document.getElementById('softwareAdminSearch'),
  softwareStatus: document.getElementById('softwareAdminStatus'),
  serviceSearch: document.getElementById('serviceAdminSearch'),
  serviceStatus: document.getElementById('serviceAdminStatus')
};

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
const escapeText = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const slugify = value => String(value || 'item').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
const showToast = message => {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
};
const redirectToLogin = () => {
  window.location.replace(`${loginPath}?next=${encodeURIComponent('/pages/admin/')}`);
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

const tableName = kind => {
  if (kind === 'software') return cfg().softwareTable || 'software_items';
  if (kind === 'services') return cfg().servicesTable || 'technical_services';
  return cfg().resourcesTable || 'resources';
};
const listForKind = kind => {
  if (kind === 'software') return state.software;
  if (kind === 'services') return state.services;
  return state.resources;
};
const formForKind = kind => {
  if (kind === 'software') return els.softwareForm;
  if (kind === 'services') return els.serviceForm;
  return els.resourceForm;
};
const listElForKind = kind => {
  if (kind === 'software') return els.softwareList;
  if (kind === 'services') return els.serviceList;
  return els.resourceList;
};
const sourceFields = (kind, sourceType, link) => {
  if (kind === 'software') {
    return {
      official_url: sourceType === 'official_link' || sourceType === 'external_link' ? link : null,
      mega_url: sourceType === 'mega_link' ? link : null
    };
  }
  return {
    external_url: sourceType !== 'mega_link' ? link : null,
    mega_url: sourceType === 'mega_link' ? link : null
  };
};

function basePayload(form, kind) {
  const data = new FormData(form);
  const title = String(data.get('title') || '').trim();
  const link = String(data.get('link') || '#').trim() || '#';
  const sourceType = String(data.get('source_type') || (kind === 'software' ? 'official_link' : 'mega_link')).trim();
  return {
    id: String(data.get('id') || '').trim(),
    title,
    slug: slugify(title),
    category: String(data.get('category') || '').trim(),
    type: String(data.get('type') || '').trim(),
    author: String(data.get('author') || 'AT STRUCTURA').trim() || 'AT STRUCTURA',
    description: String(data.get('description') || '').trim(),
    status: String(data.get('status') || 'Draft').trim(),
    source_type: sourceType,
    link,
    file_name: String(data.get('file_name') || '').trim() || null,
    file_size: Number(data.get('file_size') || '') || null,
    mime_type: String(data.get('mime_type') || '').trim() || null,
    ...sourceFields(kind, sourceType, link)
  };
}

function softwarePayload(form) {
  const payload = basePayload(form, 'software');
  const data = new FormData(form);
  payload.platform = String(data.get('platform') || 'Windows').trim();
  payload.license = String(data.get('license') || 'Catatan/Referensi').trim();
  payload.version = String(data.get('version') || '').trim() || null;
  return payload;
}

function servicePayload(form) {
  const data = new FormData(form);
  const title = String(data.get('title') || '').trim();
  return {
    id: String(data.get('id') || '').trim(),
    title,
    slug: slugify(title),
    icon: String(data.get('icon') || 'JS').trim().toUpperCase() || 'JS',
    category: String(data.get('category') || 'Layanan Teknik Sipil').trim() || 'Layanan Teknik Sipil',
    description: String(data.get('description') || '').trim(),
    status: String(data.get('status') || 'Draft').trim(),
    is_active: String(data.get('is_active') || 'false') === 'true',
    sort_order: Number(data.get('sort_order') || 100) || 100
  };
}

function normalize(item, kind) {
  if (kind === 'services') {
    return {
      ...item,
      icon: item.icon || 'JS',
      category: item.category || 'Layanan Teknik Sipil',
      status: item.status || 'Draft',
      is_active: item.is_active !== false,
      sort_order: Number(item.sort_order || 100)
    };
  }
  return {
    ...item,
    link: item.link || item.official_url || item.mega_url || item.external_url || '#',
    platform: item.platform || 'Windows',
    license: item.license || 'Catatan/Referensi',
    source_type: item.source_type || (kind === 'software' ? 'official_link' : 'mega_link')
  };
}

function resetForm(kind) {
  const form = formForKind(kind);
  form.reset();
  form.elements.id.value = '';
  if (kind === 'services') {
    form.elements.icon.value = 'JS';
    form.elements.category.value = 'Layanan Teknik Sipil';
    form.elements.status.value = 'Aktif';
    form.elements.is_active.value = 'true';
    form.elements.sort_order.value = '100';
    document.getElementById('saveServiceAdmin').textContent = 'Simpan Layanan';
    return;
  }
  form.elements.author.value = 'AT STRUCTURA';
  form.elements.link.value = '#';
  form.elements.status.value = 'Tersedia';
  form.elements.source_type.value = kind === 'software' ? 'official_link' : 'mega_link';
  if (kind === 'software') {
    form.elements.platform.value = 'Windows';
    form.elements.license.value = 'Catatan/Referensi';
    form.elements.version.value = '';
    document.getElementById('saveSoftwareAdmin').textContent = 'Simpan Software';
  } else {
    document.getElementById('saveResourceAdmin').textContent = 'Simpan Resource';
  }
}

function fillForm(kind, item) {
  const form = formForKind(kind);
  form.elements.id.value = item.id || '';
  form.elements.title.value = item.title || '';
  form.elements.category.value = item.category || form.elements.category?.options?.[0]?.value || '';
  form.elements.status.value = item.status || (kind === 'services' ? 'Aktif' : 'Tersedia');
  form.elements.description.value = item.description || '';
  if (kind === 'services') {
    form.elements.icon.value = item.icon || 'JS';
    form.elements.is_active.value = String(item.is_active !== false);
    form.elements.sort_order.value = item.sort_order || 100;
    document.getElementById('saveServiceAdmin').textContent = 'Update Layanan';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  form.elements.type.value = item.type || form.elements.type.options[0].value;
  form.elements.author.value = item.author || 'AT STRUCTURA';
  form.elements.source_type.value = item.source_type || (kind === 'software' ? 'official_link' : 'mega_link');
  form.elements.link.value = item.link || item.official_url || item.mega_url || item.external_url || '#';
  form.elements.file_name.value = item.file_name || '';
  form.elements.file_size.value = item.file_size || '';
  form.elements.mime_type.value = item.mime_type || '';
  if (kind === 'software') {
    form.elements.platform.value = item.platform || 'Windows';
    form.elements.license.value = item.license || 'Catatan/Referensi';
    form.elements.version.value = item.version || '';
    document.getElementById('saveSoftwareAdmin').textContent = 'Update Software';
  } else {
    document.getElementById('saveResourceAdmin').textContent = 'Update Resource';
  }
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function filterItems(kind) {
  const items = listForKind(kind);
  const searchEl = kind === 'software' ? els.softwareSearch : kind === 'services' ? els.serviceSearch : els.resourceSearch;
  const statusEl = kind === 'software' ? els.softwareStatus : kind === 'services' ? els.serviceStatus : els.resourceStatus;
  const search = (searchEl?.value || '').toLowerCase();
  const status = statusEl?.value || 'All';
  return items.filter(item => {
    const haystack = [item.title, item.category, item.type, item.platform, item.license, item.author, item.description, item.status, item.link, item.icon].join(' ').toLowerCase();
    return (status === 'All' || item.status === status) && haystack.includes(search);
  });
}

function emptyTitle(kind) {
  if (kind === 'software') return 'Software belum ditemukan';
  if (kind === 'services') return 'Layanan belum ditemukan';
  return 'Resource belum ditemukan';
}
function newLabel(kind) {
  if (kind === 'software') return 'Software Baru';
  if (kind === 'services') return 'Layanan Baru';
  return 'Resource Baru';
}

function renderList(kind) {
  const list = listElForKind(kind);
  const data = filterItems(kind);
  list.innerHTML = data.map(item => {
    const statusClass = kind === 'services'
      ? (serviceVisibleStatuses.includes(item.status) && item.is_active !== false ? 'tag-red' : '')
      : (visibleStatuses.includes(item.status) ? 'tag-red' : '');
    const secondBadge = kind === 'software' ? item.platform : kind === 'services' ? item.icon : item.type;
    const smallText = kind === 'services'
      ? `Tampil: ${item.is_active !== false ? 'Ya' : 'Tidak'} | Urutan: ${item.sort_order || 100}`
      : (item.link || '#');
    return `
      <article class="admin-item" data-id="${escapeText(item.id)}">
        <div>
          <div class="meta">
            <span class="badge">${escapeText(item.category)}</span>
            <span class="badge">${escapeText(secondBadge)}</span>
            <span class="badge ${statusClass}">${escapeText(item.status)}</span>
          </div>
          <h3>${escapeText(item.title)}</h3>
          <p>${escapeText(item.description)}</p>
          <small>${escapeText(smallText)}</small>
        </div>
        <div class="manager-row-actions">
          <button class="btn btn-secondary" type="button" data-kind="${kind}" data-action="edit" data-id="${escapeText(item.id)}">Edit</button>
          <button class="btn btn-danger" type="button" data-kind="${kind}" data-action="delete" data-id="${escapeText(item.id)}">Hapus</button>
        </div>
      </article>
    `;
  }).join('') || `
    <div class="card empty-state admin-empty-state">
      <span class="icon">${kind === 'software' ? 'SW' : kind === 'services' ? 'JS' : 'RS'}</span>
      <h3>${emptyTitle(kind)}</h3>
      <p>Reset pencarian/filter, atau buat item baru dari form di samping.</p>
      <div class="actions">
        <button class="btn btn-secondary" type="button" data-admin-reset="${kind}">Reset Filter</button>
        <button class="btn btn-primary" type="button" data-admin-new="${kind}">${newLabel(kind)}</button>
      </div>
    </div>
  `;
  els.resourceCount.textContent = state.resources.length;
  els.softwareCount.textContent = state.software.length;
  els.serviceCount.textContent = state.services.filter(item => item.is_active !== false && item.status === 'Aktif').length;
}

function renderAll() {
  renderList('resources');
  renderList('software');
  renderList('services');
}

async function fetchItems(kind) {
  const session = await ensureSession();
  if (!session?.access_token) {
    redirectToLogin();
    return [];
  }
  const order = kind === 'services' ? 'sort_order.asc,created_at.desc' : 'created_at.desc';
  const resourceFilter = kind === 'resources' ? '&category=neq.Software' : '';
  const response = await fetch(apiUrl(`/rest/v1/${tableName(kind)}?select=*&order=${order}${resourceFilter}`), { headers: authHeaders(session.access_token) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.msg || `Load ${kind} gagal (${response.status}).`);
  return payload.map(item => normalize(item, kind));
}

async function loadAll() {
  els.sessionStatus.textContent = 'Memuat data admin...';
  state.resources = await fetchItems('resources');
  state.software = await fetchItems('software');
  state.services = await fetchItems('services');
  renderAll();
  els.sessionStatus.textContent = 'Sesi admin aktif. Semua data dibaca dari Supabase.';
}

async function saveItem(kind, payload) {
  const session = await ensureSession();
  if (!session?.access_token) {
    redirectToLogin();
    return;
  }
  const body = { ...payload };
  const id = body.id;
  delete body.id;
  const path = id ? `/rest/v1/${tableName(kind)}?id=eq.${encodeURIComponent(id)}` : `/rest/v1/${tableName(kind)}?on_conflict=slug`;
  const response = await fetch(apiUrl(path), {
    method: id ? 'PATCH' : 'POST',
    headers: { ...authHeaders(session.access_token), Prefer: id ? 'return=representation' : 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.msg || `Simpan ${kind} gagal (${response.status}).`);
}

async function deleteItem(kind, id) {
  const session = await ensureSession();
  if (!session?.access_token) {
    redirectToLogin();
    return;
  }
  const response = await fetch(apiUrl(`/rest/v1/${tableName(kind)}?id=eq.${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: { ...authHeaders(session.access_token), Prefer: 'return=minimal' }
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || result.msg || `Hapus ${kind} gagal (${response.status}).`);
  }
}

function switchPanel(panel) {
  state.activePanel = panel;
  document.querySelectorAll('.admin-nav [data-admin-panel]').forEach(button => button.classList.toggle('active', button.dataset.adminPanel === panel));
  document.getElementById('panelResources').classList.toggle('active', panel === 'resources');
  document.getElementById('panelSoftware').classList.toggle('active', panel === 'software');
  document.getElementById('panelServices').classList.toggle('active', panel === 'services');
}

document.querySelectorAll('.admin-nav [data-admin-panel]').forEach(button => button.addEventListener('click', () => switchPanel(button.dataset.adminPanel)));
els.resourceForm?.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await saveItem('resources', basePayload(els.resourceForm, 'resources'));
    await loadAll();
    resetForm('resources');
    showToast('Resource berhasil disimpan.');
  } catch (error) {
    showToast(error.message);
  }
});
els.softwareForm?.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await saveItem('software', softwarePayload(els.softwareForm));
    await loadAll();
    resetForm('software');
    showToast('Software berhasil disimpan.');
  } catch (error) {
    showToast(error.message);
  }
});
els.serviceForm?.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await saveItem('services', servicePayload(els.serviceForm));
    await loadAll();
    resetForm('services');
    showToast('Layanan berhasil disimpan.');
  } catch (error) {
    showToast(error.message);
  }
});

document.addEventListener('click', async event => {
  const resetButton = event.target.closest('button[data-admin-reset]');
  if (resetButton) {
    const kind = resetButton.dataset.adminReset;
    const searchEl = kind === 'software' ? els.softwareSearch : kind === 'services' ? els.serviceSearch : els.resourceSearch;
    const statusEl = kind === 'software' ? els.softwareStatus : kind === 'services' ? els.serviceStatus : els.resourceStatus;
    if (searchEl) searchEl.value = '';
    if (statusEl) statusEl.value = 'All';
    renderList(kind);
    return;
  }
  const newButton = event.target.closest('button[data-admin-new]');
  if (newButton) {
    resetForm(newButton.dataset.adminNew);
    return;
  }
  const button = event.target.closest('button[data-action][data-kind]');
  if (!button) return;
  const kind = button.dataset.kind;
  const item = listForKind(kind).find(entry => entry.id === button.dataset.id);
  if (!item) return showToast('Data tidak ditemukan.');
  if (button.dataset.action === 'edit') {
    switchPanel(kind);
    fillForm(kind, item);
    return;
  }
  const label = kind === 'software' ? 'Software' : kind === 'services' ? 'Layanan' : 'Resources';
  if (!confirm(`Hapus "${item.title}" dari ${label}?`)) return;
  try {
    await deleteItem(kind, item.id);
    await loadAll();
    showToast('Data berhasil dihapus.');
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById('newResource')?.addEventListener('click', () => resetForm('resources'));
document.getElementById('newSoftware')?.addEventListener('click', () => resetForm('software'));
document.getElementById('newService')?.addEventListener('click', () => resetForm('services'));
document.getElementById('resetResourceAdmin')?.addEventListener('click', () => resetForm('resources'));
document.getElementById('resetSoftwareAdmin')?.addEventListener('click', () => resetForm('software'));
document.getElementById('resetServiceAdmin')?.addEventListener('click', () => resetForm('services'));
els.resourceSearch?.addEventListener('input', () => renderList('resources'));
els.resourceStatus?.addEventListener('change', () => renderList('resources'));
els.softwareSearch?.addEventListener('input', () => renderList('software'));
els.softwareStatus?.addEventListener('change', () => renderList('software'));
els.serviceSearch?.addEventListener('input', () => renderList('services'));
els.serviceStatus?.addEventListener('change', () => renderList('services'));
els.logout?.addEventListener('click', () => {
  clearSession();
  window.location.href = loginPath;
});

(async function initAdmin() {
  if (!isSupabaseReady()) {
    els.sessionStatus.textContent = 'Supabase belum dikonfigurasi.';
    return;
  }
  const session = await ensureSession();
  if (!session?.access_token) {
    redirectToLogin();
    return;
  }
  resetForm('resources');
  resetForm('software');
  resetForm('services');
  try {
    await loadAll();
  } catch (error) {
    showToast(error.message);
  }
}());
