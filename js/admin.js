const sessionKey = 'at_structura_supabase_session';
const loginPath = '/pages/resource-login/';
const state = { resources: [], software: [], services: [], members: [], orders: [], audit: [], activePanel: 'resources' };
const visibleStatuses = ['Tersedia', 'Link Eksternal', 'Coming Soon'];
const serviceVisibleStatuses = ['Aktif'];
const orderStatuses = [
  ['pending_payment', 'Menunggu Pembayaran'],
  ['payment_review', 'Review Pembayaran'],
  ['paid', 'Lunas'],
  ['rejected', 'Ditolak'],
  ['cancelled', 'Dibatalkan']
];

const els = {
  sessionStatus: document.getElementById('adminSessionStatus'),
  resourceCount: document.getElementById('resourceCount'),
  softwareCount: document.getElementById('softwareCount'),
  serviceCount: document.getElementById('serviceCount'),
  memberCount: document.getElementById('memberCount'),
  orderCount: document.getElementById('orderCount'),
  auditCount: document.getElementById('auditCount'),
  logout: document.getElementById('adminLogout'),
  resourceForm: document.getElementById('resourceAdminForm'),
  softwareForm: document.getElementById('softwareAdminForm'),
  serviceForm: document.getElementById('serviceAdminForm'),
  resourceList: document.getElementById('resourceAdminList'),
  softwareList: document.getElementById('softwareAdminList'),
  serviceList: document.getElementById('serviceAdminList'),
  memberList: document.getElementById('memberAdminList'),
  orderList: document.getElementById('orderAdminList'),
  auditList: document.getElementById('auditAdminList'),
  resourceSearch: document.getElementById('resourceAdminSearch'),
  resourceStatus: document.getElementById('resourceAdminStatus'),
  softwareSearch: document.getElementById('softwareAdminSearch'),
  softwareStatus: document.getElementById('softwareAdminStatus'),
  serviceSearch: document.getElementById('serviceAdminSearch'),
  serviceStatus: document.getElementById('serviceAdminStatus'),
  memberSearch: document.getElementById('memberAdminSearch'),
  memberStatus: document.getElementById('memberAdminStatus'),
  orderSearch: document.getElementById('orderAdminSearch'),
  orderStatus: document.getElementById('orderAdminStatus'),
  auditSearch: document.getElementById('auditAdminSearch'),
  auditAction: document.getElementById('auditAdminAction'),
  resourceFormStatus: document.querySelector('[data-admin-form-status="resources"]'),
  softwareFormStatus: document.querySelector('[data-admin-form-status="software"]'),
  serviceFormStatus: document.querySelector('[data-admin-form-status="services"]')
};

const cfg = () => window.AT_SUPABASE || {};
const isSupabaseReady = () => Boolean(cfg().enabled && cfg().url && cfg().anonKey && !String(cfg().url).includes('PROJECT_ID') && !String(cfg().anonKey).includes('SUPABASE_ANON_KEY'));
const apiUrl = path => `${String(cfg().url || '').replace(/\/$/, '')}${path}`;
const functionUrl = path => `${String(cfg().url || '').replace(/\/$/, '')}/functions/v1${path}`;
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
const adminTable = () => cfg().adminsTable || 'resource_admins';
const storageBucket = () => cfg().storageBucket || 'at-structura-storage';
const adminCheck = { token: '', valid: false, denied: false };
const escapeText = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const slugify = value => String(value || 'item').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
const fileSlug = value => String(value || 'file').toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '') || 'file';
const money = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
const orderStatusLabel = value => orderStatuses.find(([status]) => status === value)?.[1] || value || '-';
const orderStatusOptions = selected => orderStatuses
  .map(([value, label]) => `<option value="${escapeText(value)}" ${value === selected ? 'selected' : ''}>${escapeText(label)}</option>`)
  .join('');
const formatDate = value => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};
const showToast = message => {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
};
const formStatusEl = kind => {
  if (kind === 'software') return els.softwareFormStatus;
  if (kind === 'services') return els.serviceFormStatus;
  return els.resourceFormStatus;
};
const setFormStatus = (kind, message, tone = '') => {
  const node = formStatusEl(kind);
  if (!node) return;
  node.textContent = message;
  node.className = `page-note manager-status ${tone}`.trim();
};
const setFormBusy = (kind, busy, message) => {
  const form = formForKind(kind);
  const button = kind === 'software' ? document.getElementById('saveSoftwareAdmin') : kind === 'services' ? document.getElementById('saveServiceAdmin') : document.getElementById('saveResourceAdmin');
  if (button) {
    button.disabled = busy;
    button.textContent = busy ? 'Memproses...' : kind === 'software' ? (form?.elements.id.value ? 'Update Software' : 'Simpan Software') : kind === 'services' ? (form?.elements.id.value ? 'Update Layanan' : 'Simpan Layanan') : (form?.elements.id.value ? 'Update Resource' : 'Simpan Resource');
  }
  if (message) setFormStatus(kind, message);
};
const redirectToLogin = () => {
  window.location.replace(`${loginPath}?next=${encodeURIComponent('/pages/admin/')}`);
};
const redirectDenied = () => {
  window.location.replace(`${loginPath}?denied=1&next=${encodeURIComponent('/pages/admin/')}`);
};

async function userFromSession(session) {
  if (session?.user?.id) return session.user;
  if (!session?.access_token) return null;
  const response = await fetch(apiUrl('/auth/v1/user'), {
    method: 'GET',
    headers: authHeaders(session.access_token)
  });
  const payload = await response.json().catch(() => ({}));
  return response.ok ? payload : null;
}

async function isAdminSession(session) {
  if (!session?.access_token) return false;
  if (adminCheck.token === session.access_token) return adminCheck.valid;
  const user = await userFromSession(session);
  if (!user?.id) {
    adminCheck.token = session.access_token;
    adminCheck.valid = false;
    adminCheck.denied = true;
    return false;
  }
  const response = await fetch(apiUrl(`/rest/v1/${adminTable()}?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`), {
    method: 'GET',
    headers: authHeaders(session.access_token)
  });
  const rows = await response.json().catch(() => []);
  adminCheck.token = session.access_token;
  adminCheck.valid = response.ok && Array.isArray(rows) && rows.length > 0;
  adminCheck.denied = !adminCheck.valid;
  return adminCheck.valid;
}

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
  if (!shouldRefresh) {
    if (await isAdminSession(session)) return session;
    clearSession();
    return null;
  }
  const refreshed = await refreshSession(session);
  if (refreshed && await isAdminSession(refreshed)) return refreshed;
  clearSession();
  return null;
}

const tableName = kind => {
  if (kind === 'software') return cfg().softwareTable || 'software_items';
  if (kind === 'services') return cfg().servicesTable || 'technical_services';
  if (kind === 'members') return cfg().membersTable || 'member_profiles';
  if (kind === 'orders') return 'orders';
  if (kind === 'audit') return cfg().auditLogsTable || 'admin_audit_logs';
  return cfg().resourcesTable || 'resources';
};
const listForKind = kind => {
  if (kind === 'software') return state.software;
  if (kind === 'services') return state.services;
  if (kind === 'members') return state.members;
  if (kind === 'orders') return state.orders;
  if (kind === 'audit') return state.audit;
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
  if (kind === 'members') return els.memberList;
  if (kind === 'orders') return els.orderList;
  if (kind === 'audit') return els.auditList;
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
    access_type: String(data.get('access_type') || 'free').trim(),
    price: Number(data.get('price') || 0) || 0,
    currency: 'IDR',
    storage_bucket: String(data.get('storage_bucket') || '').trim() || null,
    storage_path: String(data.get('storage_path') || '').trim() || null,
    download_label: String(data.get('download_label') || '').trim() || null,
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
  if (kind === 'members') {
    return {
      ...item,
      full_name: item.full_name || 'Tanpa nama',
      email: item.email || '-',
      phone: item.phone || '-',
      institution: item.institution || '-',
      source: item.source || '-'
    };
  }
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
    source_type: item.source_type || (item.storage_path ? 'supabase_storage' : kind === 'software' ? 'official_link' : 'mega_link'),
    access_type: item.access_type || 'free',
    price: Number(item.price || 0)
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
  form.elements.access_type.value = 'free';
  form.elements.price.value = '0';
  form.elements.storage_bucket.value = '';
  form.elements.storage_path.value = '';
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
  form.elements.access_type.value = item.access_type || 'free';
  form.elements.price.value = item.price || 0;
  form.elements.storage_bucket.value = item.storage_bucket || '';
  form.elements.storage_path.value = item.storage_path || '';
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
  const searchEl = kind === 'software' ? els.softwareSearch : kind === 'services' ? els.serviceSearch : kind === 'members' ? els.memberSearch : kind === 'orders' ? els.orderSearch : kind === 'audit' ? els.auditSearch : els.resourceSearch;
  const statusEl = kind === 'software' ? els.softwareStatus : kind === 'services' ? els.serviceStatus : kind === 'members' ? els.memberStatus : kind === 'orders' ? els.orderStatus : kind === 'audit' ? els.auditAction : els.resourceStatus;
  const search = (searchEl?.value || '').toLowerCase();
  const status = statusEl?.value || 'All';
  return items.filter(item => {
    if (kind === 'members') {
      const verified = Boolean(item.email_confirmed_at);
      const suspended = Boolean(item.suspended_at);
      const haystack = [item.full_name, item.email, item.phone, item.institution, item.source, item.user_id].join(' ').toLowerCase();
      return (status === 'All' || (status === 'Verified' && verified && !suspended) || (status === 'Unverified' && !verified && !suspended) || (status === 'Suspended' && suspended)) && haystack.includes(search);
    }
    if (kind === 'orders') {
      const haystack = [item.order_number, item.status, item.total_amount, item.proof_file_name, ...(item.order_items || []).map(orderItem => orderItem.title_snapshot)].join(' ').toLowerCase();
      return (status === 'All' || item.status === status) && haystack.includes(search);
    }
    if (kind === 'audit') {
      const actionFilter = els.auditAction?.value || 'All';
      const haystack = [item.action, item.admin_email, item.target_table, item.target_id, item.target_title, JSON.stringify(item.metadata || {})].join(' ').toLowerCase();
      return (actionFilter === 'All' || String(item.action || '').startsWith(actionFilter)) && haystack.includes(search);
    }
    const haystack = [item.title, item.category, item.type, item.platform, item.license, item.author, item.description, item.status, item.link, item.icon].join(' ').toLowerCase();
    return (status === 'All' || item.status === status) && haystack.includes(search);
  });
}

function emptyTitle(kind) {
  if (kind === 'members') return 'Akun belum ditemukan';
  if (kind === 'orders') return 'Pesanan belum ditemukan';
  if (kind === 'audit') return 'Audit log belum tersedia';
  if (kind === 'software') return 'Software belum ditemukan';
  if (kind === 'services') return 'Layanan belum ditemukan';
  return 'Resource belum ditemukan';
}
function newLabel(kind) {
  if (kind === 'software') return 'Software Baru';
  if (kind === 'services') return 'Layanan Baru';
  return 'Resource Baru';
}

async function uploadAdminFile(kind, form, session) {
  const file = form.elements.storage_file?.files?.[0];
  const sourceType = String(new FormData(form).get('source_type') || '').trim();
  const existingPath = String(form.elements.storage_path?.value || '').trim();
  if (!file) {
    if (sourceType === 'supabase_storage' && !existingPath) throw new Error('Pilih file dulu untuk sumber Supabase Storage.');
    return null;
  }
  if (!session?.access_token) throw new Error('Sesi admin tidak valid. Silakan login ulang.');
  if (file.size > 50 * 1024 * 1024) throw new Error('Ukuran file maksimal 50 MB.');
  const title = String(new FormData(form).get('title') || 'file');
  const path = `products/${kind}/${Date.now()}-${slugify(title)}-${fileSlug(file.name)}`;
  const response = await fetch(apiUrl(`/storage/v1/object/${storageBucket()}/${path.split('/').map(encodeURIComponent).join('/')}`), {
    method: 'POST',
    headers: {
      apikey: cfg().anonKey,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true'
    },
    body: file
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `Upload file gagal (${response.status}). Periksa akses admin dan policy Supabase Storage.`);
  form.elements.storage_bucket.value = storageBucket();
  form.elements.storage_path.value = path;
  form.elements.source_type.value = 'supabase_storage';
  form.elements.file_name.value = file.name;
  form.elements.file_size.value = file.size;
  form.elements.mime_type.value = file.type || 'application/octet-stream';
  form.elements.link.value = '#';
  return path;
}

function renderList(kind) {
  const list = listElForKind(kind);
  const data = filterItems(kind);
  if (kind === 'audit') {
    list.innerHTML = data.map(item => `
      <article class="admin-item audit-item" data-id="${escapeText(item.id)}">
        <div>
          <div class="meta">
            <span class="badge tag-red">${escapeText(item.action || '-')}</span>
            <span class="badge">${escapeText(item.target_table || '-')}</span>
            <span class="badge">${escapeText(formatDate(item.created_at))}</span>
          </div>
          <h3>${escapeText(item.target_title || item.target_id || 'Aktivitas admin')}</h3>
          <p>${escapeText(item.admin_email || item.admin_user_id || '-')}</p>
          <small>${escapeText(JSON.stringify(item.metadata || {}))}</small>
        </div>
      </article>
    `).join('') || `
      <div class="card empty-state admin-empty-state">
        <span class="icon">LOG</span>
        <h3>${emptyTitle(kind)}</h3>
        <p>Jalankan file SQL audit log di Supabase bila panel ini masih kosong setelah ada aktivitas admin.</p>
        <div class="actions"><button class="btn btn-secondary" type="button" data-admin-reset="${kind}">Reset Filter</button></div>
      </div>
    `;
    if (els.auditCount) els.auditCount.textContent = state.audit.length;
    return;
  }
  if (kind === 'orders') {
    list.innerHTML = data.map(order => {
      const items = order.order_items || [];
      const proofButton = order.proof_path
        ? `<button class="btn btn-secondary" type="button" data-order-proof="${escapeText(order.id)}">Lihat Bukti</button>`
        : '<button class="btn btn-secondary" type="button" disabled>Belum ada bukti</button>';
      const reviewActions = order.status === 'payment_review'
        ? `<button class="btn btn-primary" type="button" data-order-action="paid" data-id="${escapeText(order.id)}">Setujui</button><button class="btn btn-danger" type="button" data-order-action="rejected" data-id="${escapeText(order.id)}">Tolak</button>`
        : '';
      const statusEditor = `
        <label class="sr-only" for="order-status-${escapeText(order.id)}">Status pembayaran</label>
        <select class="control order-status-control" id="order-status-${escapeText(order.id)}" data-order-status="${escapeText(order.id)}">
          ${orderStatusOptions(order.status)}
        </select>
        <button class="btn btn-secondary" type="button" data-order-save-status="${escapeText(order.id)}">Simpan Status</button>
      `;
      return `
        <article class="admin-item order-item" data-id="${escapeText(order.id)}">
          <div>
            <div class="meta">
              <span class="badge ${order.status === 'paid' ? 'tag-red' : ''}">${escapeText(orderStatusLabel(order.status))}</span>
              <span class="badge">${escapeText(money(order.total_amount))}</span>
            </div>
            <h3>${escapeText(order.order_number)}</h3>
            <p>${items.map(item => escapeText(item.title_snapshot)).join(', ') || 'Order premium'}</p>
            <small>Bukti: ${escapeText(order.proof_file_name || '-')} | Dibuat: ${escapeText(formatDate(order.created_at))}</small>
          </div>
          <div class="manager-row-actions">${proofButton}${statusEditor}${reviewActions}<button class="btn btn-danger" type="button" data-order-delete="${escapeText(order.id)}">Hapus Testing</button></div>
        </article>
      `;
    }).join('') || `
      <div class="card empty-state admin-empty-state">
        <span class="icon">PS</span>
        <h3>${emptyTitle(kind)}</h3>
        <p>Belum ada order sesuai filter saat ini.</p>
        <div class="actions"><button class="btn btn-secondary" type="button" data-admin-reset="${kind}">Reset Filter</button></div>
      </div>
    `;
    els.orderCount.textContent = state.orders.length;
    if (els.auditCount) els.auditCount.textContent = state.audit.length;
    return;
  }
  if (kind === 'members') {
    list.innerHTML = data.map(item => {
      const verified = Boolean(item.email_confirmed_at);
      const suspended = Boolean(item.suspended_at);
      const statusBadge = suspended ? 'Suspended' : verified ? 'Terverifikasi' : 'Belum verifikasi';
      const statusClass = suspended || verified ? 'tag-red' : '';
      const suspendButton = suspended
        ? `<button class="btn btn-secondary" type="button" data-member-action="unsuspend" data-user-id="${escapeText(item.user_id)}">Buka Suspend</button>`
        : `<button class="btn btn-secondary" type="button" data-member-action="suspend" data-user-id="${escapeText(item.user_id)}">Suspend</button>`;
      return `
        <article class="admin-item member-item" data-id="${escapeText(item.user_id)}">
          <div>
            <div class="meta">
              <span class="badge ${statusClass}">${statusBadge}</span>
              <span class="badge">${escapeText(item.source)}</span>
            </div>
            <h3>${escapeText(item.full_name)}</h3>
            <p>${escapeText(item.email)}</p>
            <div class="member-detail-grid">
              <span><strong>Telepon</strong>${escapeText(item.phone)}</span>
              <span><strong>Instansi</strong>${escapeText(item.institution)}</span>
              <span><strong>Daftar</strong>${escapeText(formatDate(item.created_at))}</span>
              <span><strong>Verifikasi</strong>${escapeText(formatDate(item.email_confirmed_at))}</span>
              <span><strong>Login terakhir</strong>${escapeText(formatDate(item.last_sign_in_at))}</span>
              <span><strong>Suspend</strong>${escapeText(formatDate(item.suspended_at))}</span>
            </div>
            ${suspended ? `<small>Alasan suspend: ${escapeText(item.suspend_reason || '-')}</small>` : ''}
            <small>User ID: ${escapeText(item.user_id)}</small>
          </div>
          <div class="manager-row-actions">
            ${suspendButton}
            <button class="btn btn-danger" type="button" data-member-action="delete" data-user-id="${escapeText(item.user_id)}">Hapus Akun</button>
          </div>
        </article>
      `;
    }).join('') || `
      <div class="card empty-state admin-empty-state">
        <span class="icon">AK</span>
        <h3>${emptyTitle(kind)}</h3>
        <p>Reset pencarian/filter untuk melihat semua akun yang sudah terdaftar.</p>
        <div class="actions">
          <button class="btn btn-secondary" type="button" data-admin-reset="${kind}">Reset Filter</button>
        </div>
      </div>
    `;
    els.memberCount.textContent = state.members.length;
    els.orderCount.textContent = state.orders.length;
    if (els.auditCount) els.auditCount.textContent = state.audit.length;
    return;
  }
  list.innerHTML = data.map(item => {
    const statusClass = kind === 'services'
      ? (serviceVisibleStatuses.includes(item.status) && item.is_active !== false ? 'tag-red' : '')
      : (visibleStatuses.includes(item.status) ? 'tag-red' : '');
    const secondBadge = kind === 'software' ? item.platform : kind === 'services' ? item.icon : item.type;
    const accessBadgeHtml = kind === 'services' ? '' : `<span class="badge ${item.access_type === 'premium' ? 'tag-red' : ''}">${escapeText(item.access_type === 'premium' ? money(item.price) : 'Gratis')}</span>`;
    const smallText = kind === 'services'
      ? `Tampil: ${item.is_active !== false ? 'Ya' : 'Tidak'} | Urutan: ${item.sort_order || 100}`
      : (item.storage_path ? `Storage: ${item.storage_path}` : item.link || '#');
    return `
      <article class="admin-item" data-id="${escapeText(item.id)}">
        <div>
          <div class="meta">
            <span class="badge">${escapeText(item.category)}</span>
            <span class="badge">${escapeText(secondBadge)}</span>
            <span class="badge ${statusClass}">${escapeText(item.status)}</span>
            ${accessBadgeHtml}
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
  els.memberCount.textContent = state.members.length;
  els.orderCount.textContent = state.orders.length;
  if (els.auditCount) els.auditCount.textContent = state.audit.length;
}

function renderAll() {
  renderList('resources');
  renderList('software');
  renderList('services');
  renderList('members');
  renderList('orders');
  renderList('audit');
}

async function fetchItems(kind) {
  const session = await ensureSession();
  if (!session?.access_token) {
    if (adminCheck.denied) {
      redirectDenied();
      return [];
    }
    redirectToLogin();
    return [];
  }
  const order = kind === 'services' ? 'sort_order.asc,created_at.desc' : 'created_at.desc';
  if (kind === 'orders') {
    const response = await fetch(apiUrl('/rest/v1/orders?select=*,order_items(*)&order=created_at.desc'), { headers: authHeaders(session.access_token) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.msg || `Load orders gagal (${response.status}).`);
    return payload;
  }
  if (kind === 'audit') {
    const response = await fetch(apiUrl(`/rest/v1/${tableName(kind)}?select=*&order=created_at.desc&limit=100`), { headers: authHeaders(session.access_token) });
    const payload = await response.json().catch(() => []);
    if (!response.ok) throw new Error(payload.message || payload.msg || `Load audit log gagal (${response.status}).`);
    return payload;
  }
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
  state.members = await fetchItems('members');
  state.orders = await fetchItems('orders');
  state.audit = await fetchItems('audit').catch(error => {
    showToast(error.message);
    return [];
  });
  renderAll();
  els.sessionStatus.textContent = 'Sesi admin aktif. Semua data dibaca dari Supabase.';
}

async function logAdminAction(action, targetTable, targetId, targetTitle, metadata = {}) {
  const session = await ensureSession();
  if (!session?.access_token) return;
  const user = await userFromSession(session).catch(() => null);
  const body = {
    admin_user_id: user?.id || null,
    admin_email: user?.email || null,
    action,
    target_table: targetTable,
    target_id: targetId ? String(targetId) : null,
    target_title: targetTitle || null,
    metadata
  };
  await fetch(apiUrl(`/rest/v1/${tableName('audit')}`), {
    method: 'POST',
    headers: { ...authHeaders(session.access_token), Prefer: 'return=minimal' },
    body: JSON.stringify(body)
  }).catch(() => {});
}

async function saveItem(kind, payload) {
  const session = await ensureSession();
  if (!session?.access_token) {
    if (adminCheck.denied) return redirectDenied();
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
  const savedId = Array.isArray(result) && result[0]?.id ? result[0].id : id || body.slug;
  await logAdminAction(id ? 'update' : 'create', tableName(kind), savedId, body.title, { kind, status: body.status, access_type: body.access_type, source_type: body.source_type });
}

async function deleteItem(kind, item) {
  const session = await ensureSession();
  if (!session?.access_token) {
    if (adminCheck.denied) return redirectDenied();
    redirectToLogin();
    return;
  }
  const id = typeof item === 'object' ? item.id : item;
  if ((kind === 'resources' || kind === 'software') && item?.storage_bucket && item?.storage_path && window.ATShop?.removeStorageFiles) {
    await window.ATShop.removeStorageFiles(item.storage_bucket, item.storage_path, session.access_token);
  }
  const response = await fetch(apiUrl(`/rest/v1/${tableName(kind)}?id=eq.${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: { ...authHeaders(session.access_token), Prefer: 'return=minimal' }
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || result.msg || `Hapus ${kind} gagal (${response.status}).`);
  }
  await logAdminAction('delete', tableName(kind), id, item?.title || id, { kind, removed_storage_path: item?.storage_path || null });
}

async function updateOrderStatus(id, status) {
  const session = await ensureSession();
  if (!session?.access_token) return redirectToLogin();
  const body = { status };
  if (status === 'rejected') body.admin_note = 'Pembayaran ditolak. Silakan upload bukti yang benar.';
  if (status === 'paid') body.admin_note = null;
  const response = await fetch(apiUrl(`/rest/v1/orders?id=eq.${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { ...authHeaders(session.access_token), Prefer: 'return=minimal' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || result.msg || `Update order gagal (${response.status}).`);
  }
  if (status !== 'paid') {
    await deleteRows('member_access', `order_id=eq.${encodeURIComponent(id)}`, session);
  }
  const order = state.orders.find(item => item.id === id);
  await logAdminAction('payment_status_update', 'orders', id, order?.order_number || id, { status });
}

async function deleteRows(table, filter, session) {
  const response = await fetch(apiUrl(`/rest/v1/${table}?${filter}`), {
    method: 'DELETE',
    headers: { ...authHeaders(session.access_token), Prefer: 'return=minimal' }
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || result.msg || `Hapus data ${table} gagal (${response.status}).`);
  }
}

async function deleteOrderForTesting(id) {
  const session = await ensureSession();
  if (!session?.access_token) return redirectToLogin();
  const order = state.orders.find(item => item.id === id);
  if (!order) throw new Error('Order tidak ditemukan.');
  if (order.proof_bucket && order.proof_path && window.ATShop?.removeStorageFiles) {
    await window.ATShop.removeStorageFiles(order.proof_bucket, order.proof_path, session.access_token);
  }
  await deleteRows('member_access', `order_id=eq.${encodeURIComponent(id)}`, session).catch(error => {
    if (!String(error.message || '').includes('column')) throw error;
  });
  await deleteRows('order_items', `order_id=eq.${encodeURIComponent(id)}`, session);
  await deleteRows('orders', `id=eq.${encodeURIComponent(id)}`, session);
  await logAdminAction('delete_testing_order', 'orders', id, order.order_number || id, { proof_path: order.proof_path || null });
}

async function runMemberAction(userId, action, reason = '') {
  const session = await ensureSession();
  if (!session?.access_token) return redirectToLogin();
  const response = await fetch(functionUrl('/admin-account-action'), {
    method: 'POST',
    headers: {
      ...authHeaders(session.access_token),
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ user_id: userId, action, reason })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || payload.message || `Aksi akun gagal (${response.status}).`);
  await logAdminAction(`member_${action}`, 'member_profiles', userId, userId, { reason });
  return payload;
}

async function openOrderProof(id) {
  const order = state.orders.find(item => item.id === id);
  if (!order?.proof_bucket || !order?.proof_path) return showToast('Bukti pembayaran belum ada.');
  const session = await ensureSession();
  const url = await window.ATShop.signedUrl(order.proof_bucket, order.proof_path, session.access_token);
  window.open(url, '_blank', 'noopener');
}

function switchPanel(panel) {
  state.activePanel = panel;
  document.querySelectorAll('.admin-nav [data-admin-panel]').forEach(button => button.classList.toggle('active', button.dataset.adminPanel === panel));
  document.getElementById('panelResources').classList.toggle('active', panel === 'resources');
  document.getElementById('panelSoftware').classList.toggle('active', panel === 'software');
  document.getElementById('panelServices').classList.toggle('active', panel === 'services');
  document.getElementById('panelMembers').classList.toggle('active', panel === 'members');
  document.getElementById('panelOrders').classList.toggle('active', panel === 'orders');
  document.getElementById('panelAudit').classList.toggle('active', panel === 'audit');
}

document.querySelectorAll('.admin-nav [data-admin-panel]').forEach(button => button.addEventListener('click', () => switchPanel(button.dataset.adminPanel)));
els.resourceForm?.addEventListener('submit', async event => {
  event.preventDefault();
  setFormBusy('resources', true, 'Menyiapkan resource...');
  try {
    const session = await ensureSession();
    if (els.resourceForm.elements.storage_file?.files?.[0]) setFormStatus('resources', 'Mengupload file ke Supabase Storage...');
    await uploadAdminFile('resources', els.resourceForm, session);
    setFormStatus('resources', 'Menyimpan metadata resource...');
    await saveItem('resources', basePayload(els.resourceForm, 'resources'));
    await loadAll();
    resetForm('resources');
    setFormStatus('resources', 'Resource berhasil disimpan.', 'status-online');
    showToast('Resource berhasil disimpan.');
  } catch (error) {
    setFormStatus('resources', error.message);
    showToast(error.message);
  } finally {
    setFormBusy('resources', false);
  }
});
els.softwareForm?.addEventListener('submit', async event => {
  event.preventDefault();
  setFormBusy('software', true, 'Menyiapkan software...');
  try {
    const session = await ensureSession();
    if (els.softwareForm.elements.storage_file?.files?.[0]) setFormStatus('software', 'Mengupload file ke Supabase Storage...');
    await uploadAdminFile('software', els.softwareForm, session);
    setFormStatus('software', 'Menyimpan metadata software...');
    await saveItem('software', softwarePayload(els.softwareForm));
    await loadAll();
    resetForm('software');
    setFormStatus('software', 'Software berhasil disimpan.', 'status-online');
    showToast('Software berhasil disimpan.');
  } catch (error) {
    setFormStatus('software', error.message);
    showToast(error.message);
  } finally {
    setFormBusy('software', false);
  }
});
els.serviceForm?.addEventListener('submit', async event => {
  event.preventDefault();
  setFormBusy('services', true, 'Menyimpan layanan...');
  try {
    await saveItem('services', servicePayload(els.serviceForm));
    await loadAll();
    resetForm('services');
    setFormStatus('services', 'Layanan berhasil disimpan.', 'status-online');
    showToast('Layanan berhasil disimpan.');
  } catch (error) {
    setFormStatus('services', error.message);
    showToast(error.message);
  } finally {
    setFormBusy('services', false);
  }
});

document.addEventListener('click', async event => {
  const resetButton = event.target.closest('button[data-admin-reset]');
  if (resetButton) {
    const kind = resetButton.dataset.adminReset;
    const searchEl = kind === 'software' ? els.softwareSearch : kind === 'services' ? els.serviceSearch : kind === 'members' ? els.memberSearch : kind === 'orders' ? els.orderSearch : kind === 'audit' ? els.auditSearch : els.resourceSearch;
    const statusEl = kind === 'software' ? els.softwareStatus : kind === 'services' ? els.serviceStatus : kind === 'members' ? els.memberStatus : kind === 'orders' ? els.orderStatus : kind === 'audit' ? els.auditAction : els.resourceStatus;
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
  const proofButton = event.target.closest('[data-order-proof]');
  if (proofButton) {
    try { await openOrderProof(proofButton.dataset.orderProof); } catch (error) { showToast(error.message); }
    return;
  }
  const memberButton = event.target.closest('[data-member-action]');
  if (memberButton) {
    const action = memberButton.dataset.memberAction;
    const userId = memberButton.dataset.userId;
    const member = state.members.find(item => item.user_id === userId);
    if (!member) return showToast('Akun tidak ditemukan.');
    const label = member.email || userId;
    let reason = '';
    if (action === 'suspend') {
      reason = prompt(`Alasan suspend untuk ${label}:`, 'Akun disuspend oleh admin AT STRUCTURA.') || '';
      if (!reason.trim()) return showToast('Suspend dibatalkan karena alasan kosong.');
    }
    if (action === 'unsuspend' && !confirm(`Buka suspend akun ${label}?`)) return;
    if (action === 'delete' && !confirm(`Hapus akun ${label} secara permanen? Data profil, order, akses, dan akun Auth akan ikut dihapus.`)) return;
    try {
      await runMemberAction(userId, action, reason);
      await loadAll();
      showToast(action === 'delete' ? 'Akun berhasil dihapus.' : 'Status akun berhasil diperbarui.');
    } catch (error) {
      showToast(error.message);
    }
    return;
  }
  const statusButton = event.target.closest('[data-order-save-status]');
  if (statusButton) {
    const id = statusButton.dataset.orderSaveStatus;
    const select = document.querySelector(`[data-order-status="${CSS.escape(id)}"]`);
    const nextStatus = select?.value;
    if (!nextStatus) return showToast('Pilih status pembayaran dulu.');
    try {
      await updateOrderStatus(id, nextStatus);
      await loadAll();
      showToast('Status pembayaran berhasil diubah.');
    } catch (error) {
      showToast(error.message);
    }
    return;
  }
  const deleteOrderButton = event.target.closest('[data-order-delete]');
  if (deleteOrderButton) {
    const order = state.orders.find(item => item.id === deleteOrderButton.dataset.orderDelete);
    const label = order?.order_number || 'order ini';
    if (!confirm(`Hapus ${label} dari data testing? Bukti pembayaran di Storage juga akan dihapus permanen.`)) return;
    try {
      await deleteOrderForTesting(deleteOrderButton.dataset.orderDelete);
      await loadAll();
      showToast('Order testing dan bukti pembayaran berhasil dihapus.');
    } catch (error) {
      showToast(error.message);
    }
    return;
  }
  const orderButton = event.target.closest('[data-order-action]');
  if (orderButton) {
    const label = orderButton.dataset.orderAction === 'paid' ? 'setujui pembayaran' : 'tolak pembayaran';
    if (!confirm(`Yakin ${label} order ini?`)) return;
    try {
      await updateOrderStatus(orderButton.dataset.id, orderButton.dataset.orderAction);
      await loadAll();
      showToast('Status order diperbarui.');
    } catch (error) {
      showToast(error.message);
    }
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
  const storageNote = item.storage_bucket && item.storage_path ? ' File di Supabase Storage juga akan dihapus permanen.' : '';
  if (!confirm(`Hapus "${item.title}" dari ${label}?${storageNote}`)) return;
  try {
    await deleteItem(kind, item);
    await loadAll();
    showToast(item.storage_path ? 'Data dan file Storage berhasil dihapus.' : 'Data berhasil dihapus.');
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
els.memberSearch?.addEventListener('input', () => renderList('members'));
els.memberStatus?.addEventListener('change', () => renderList('members'));
els.orderSearch?.addEventListener('input', () => renderList('orders'));
els.orderStatus?.addEventListener('change', () => renderList('orders'));
els.auditSearch?.addEventListener('input', () => renderList('audit'));
els.auditAction?.addEventListener('change', () => renderList('audit'));
['resources', 'software'].forEach(kind => {
  const form = formForKind(kind);
  form?.elements.storage_file?.addEventListener('change', () => {
    const file = form.elements.storage_file.files?.[0];
    if (!file) return;
    form.elements.source_type.value = 'supabase_storage';
    form.elements.file_name.value = file.name;
    form.elements.file_size.value = file.size;
    form.elements.mime_type.value = file.type || 'application/octet-stream';
    form.elements.link.value = '#';
    setFormStatus(kind, `File siap diupload: ${file.name}`, 'status-online');
  });
});
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
    if (adminCheck.denied) {
      redirectDenied();
      return;
    }
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
