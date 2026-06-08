const shopCartKey = 'at_structura_cart';
const shopBucket = () => window.AT_SUPABASE?.storageBucket || 'at-structura-storage';
const shopCfg = () => window.AT_SUPABASE || {};
const shopApiUrl = path => `${String(shopCfg().url || '').replace(/\/$/, '')}${path}`;
const shopReady = () => Boolean(shopCfg().enabled && shopCfg().url && shopCfg().anonKey);
const shopSession = () => window.ATAuth?.getUserSession?.() || null;
const shopToken = () => shopSession()?.access_token || shopCfg().anonKey;
const shopHeaders = (token = shopToken(), json = false) => ({
  apikey: shopCfg().anonKey,
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
  ...(json ? { 'Content-Type': 'application/json' } : {})
});
const shopEscape = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const shopMoney = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
const shopPath = path => String(path || '').split('/').map(encodeURIComponent).join('/');
const shopFileSlug = value => String(value || 'file').toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '') || 'file';
const shopBaseUrl = () => String(shopCfg().url || '').replace(/\/$/, '');

function normalizeStoragePath(bucket, path) {
  const bucketName = String(bucket || shopBucket()).replace(/^\/+|\/+$/g, '');
  let cleanPath = String(path || '').trim();
  cleanPath = cleanPath.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/(?:sign|public|authenticated)\//, '');
  cleanPath = cleanPath.replace(/^\/?storage\/v1\/object\/(?:sign|public|authenticated)\//, '');
  cleanPath = cleanPath.replace(/^\/?object\/(?:sign|public|authenticated)\//, '');
  cleanPath = cleanPath.replace(/^\/+/, '');
  if (cleanPath.startsWith(`${bucketName}/`)) cleanPath = cleanPath.slice(bucketName.length + 1);
  cleanPath = cleanPath.split('?')[0];
  return cleanPath;
}

function storageApiUrl(path) {
  const cleanPath = String(path || '').startsWith('/') ? path : `/${path || ''}`;
  return `${shopBaseUrl()}/storage/v1${cleanPath}`;
}

function resolveSignedUrl(url) {
  const value = String(url || '');
  if (!value) return '';
  if (value.startsWith('http')) return value;
  if (value.startsWith('/storage/v1/')) return `${shopBaseUrl()}${value}`;
  if (value.startsWith('/object/')) return storageApiUrl(value);
  return storageApiUrl(`/${value.replace(/^\/+/, '')}`);
}

function readCart() {
  try { return JSON.parse(localStorage.getItem(shopCartKey) || '[]'); } catch { return []; }
}

function writeCart(items) {
  const unique = [];
  items.forEach(item => {
    if (!unique.some(entry => entry.item_kind === item.item_kind && entry.item_id === item.item_id)) unique.push(item);
  });
  localStorage.setItem(shopCartKey, JSON.stringify(unique));
  updateCartBadge();
  return unique;
}

function updateCartBadge() {
  const count = readCart().length;
  document.querySelectorAll('[data-cart-count]').forEach(node => {
    node.textContent = count > 0 ? String(count) : '';
    node.classList.toggle('show', count > 0);
  });
}

function addToCart(item) {
  const cart = readCart();
  writeCart([...cart, item]);
  showShopToast('Item masuk keranjang.');
}

function removeFromCart(kind, id) {
  writeCart(readCart().filter(item => !(item.item_kind === kind && item.item_id === id)));
}

function clearCart() {
  writeCart([]);
}

function showShopToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return alert(message);
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

async function uploadStorageFile(file, path, token = shopToken()) {
  if (!file) throw new Error('File belum dipilih.');
  if (file.size > 50 * 1024 * 1024) throw new Error('Ukuran file maksimal 50 MB.');
  const response = await fetch(shopApiUrl(`/storage/v1/object/${shopBucket()}/${shopPath(path)}`), {
    method: 'POST',
    headers: {
      apikey: shopCfg().anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'true'
    },
    body: file
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `Upload gagal (${response.status}).`);
  return { bucket: shopBucket(), path, fileName: file.name, fileSize: file.size, mimeType: file.type || 'application/octet-stream' };
}

async function signedUrl(bucket, path, token = shopToken()) {
  const bucketName = String(bucket || shopBucket()).replace(/^\/+|\/+$/g, '');
  const cleanPath = normalizeStoragePath(bucketName, path);
  if (!bucketName || !cleanPath) throw new Error('Path file storage tidak valid.');
  const response = await fetch(storageApiUrl(`/object/sign/${bucketName}/${shopPath(cleanPath)}`), {
    method: 'POST',
    headers: shopHeaders(token, true),
    body: JSON.stringify({ expiresIn: 300 })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `Link download gagal dibuat (${response.status}).`);
  const url = payload.signedURL || payload.signedUrl || payload.signed_url;
  if (!url) throw new Error('Signed URL tidak tersedia.');
  return resolveSignedUrl(url);
}

async function logDownload(item) {
  const session = shopSession();
  if (!session?.access_token) return;
  await fetch(shopApiUrl('/rest/v1/download_logs'), {
    method: 'POST',
    headers: { ...shopHeaders(session.access_token, true), Prefer: 'return=minimal' },
    body: JSON.stringify({ item_kind: item.item_kind, item_id: item.item_id, item_title: item.title })
  }).catch(() => {});
}

async function openItem(item) {
  if (item.storage_bucket && item.storage_path) {
    const url = await signedUrl(item.storage_bucket, item.storage_path);
    await logDownload(item);
    window.open(url, '_blank', 'noopener');
    return;
  }
  const url = item.link || item.official_url || item.mega_url || item.external_url || '#';
  if (url && url !== '#') {
    await logDownload(item);
    window.open(url, '_blank', 'noopener');
  } else {
    showShopToast('File atau link belum tersedia.');
  }
}

async function loadAccessMap() {
  const session = await window.ATAuth?.ensureUserSession?.();
  if (!session?.access_token) return new Set();
  const response = await fetch(shopApiUrl('/rest/v1/member_access?select=item_kind,item_id'), { headers: shopHeaders(session.access_token) });
  if (!response.ok) return new Set();
  return new Set((await response.json()).map(item => `${item.item_kind}:${item.item_id}`));
}

async function saveItem(item) {
  const session = await window.ATAuth?.ensureUserSession?.();
  if (!session?.access_token) return location.href = `/pages/login/?next=${encodeURIComponent(location.pathname + location.search)}`;
  const response = await fetch(shopApiUrl('/rest/v1/saved_items'), {
    method: 'POST',
    headers: { ...shopHeaders(session.access_token, true), Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ item_kind: item.item_kind, item_id: item.item_id })
  });
  if (!response.ok && response.status !== 409) throw new Error('Gagal menyimpan item.');
  showShopToast('Item disimpan ke akun.');
}

async function createOrderFromCart() {
  const session = await window.ATAuth?.ensureUserSession?.();
  if (!session?.access_token) return location.href = `/pages/login/?next=${encodeURIComponent('/pages/checkout/')}`;
  const cart = readCart();
  const response = await fetch(shopApiUrl('/rest/v1/rpc/create_manual_order'), {
    method: 'POST',
    headers: shopHeaders(session.access_token, true),
    body: JSON.stringify({ p_items: cart.map(item => ({ item_kind: item.item_kind, item_id: item.item_id })) })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.msg || 'Checkout gagal.');
  return payload;
}

async function submitPaymentProof(orderId, file) {
  const session = await window.ATAuth?.ensureUserSession?.();
  if (!session?.access_token) return location.href = `/pages/login/?next=${encodeURIComponent('/pages/checkout/')}`;
  const userId = session.user?.id;
  const path = `proofs/${userId}/${orderId}/${Date.now()}-${shopFileSlug(file.name)}`;
  const uploaded = await uploadStorageFile(file, path, session.access_token);
  const response = await fetch(shopApiUrl('/rest/v1/rpc/submit_payment_proof'), {
    method: 'POST',
    headers: shopHeaders(session.access_token, true),
    body: JSON.stringify({ p_order_id: orderId, p_bucket: uploaded.bucket, p_path: uploaded.path, p_file_name: uploaded.fileName })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.msg || 'Bukti pembayaran gagal disimpan.');
  return payload;
}

async function loadAccountData() {
  const session = await window.ATAuth?.ensureUserSession?.();
  if (!session?.access_token) return { access: [], orders: [], saved: [], downloads: [] };
  const headers = shopHeaders(session.access_token);
  const [accessRes, ordersRes, savedRes, logsRes] = await Promise.all([
    fetch(shopApiUrl('/rest/v1/member_access?select=*&order=created_at.desc'), { headers }),
    fetch(shopApiUrl('/rest/v1/orders?select=*,order_items(*)&order=created_at.desc'), { headers }),
    fetch(shopApiUrl('/rest/v1/saved_items?select=*&order=created_at.desc'), { headers }),
    fetch(shopApiUrl('/rest/v1/download_logs?select=*&order=created_at.desc&limit=20'), { headers })
  ]);
  const access = accessRes.ok ? await accessRes.json() : [];
  const saved = savedRes.ok ? await savedRes.json() : [];
  const itemRefs = [...access, ...saved];
  const resourceIds = itemRefs.filter(item => item.item_kind === 'resource').map(item => item.item_id);
  const softwareIds = itemRefs.filter(item => item.item_kind === 'software').map(item => item.item_id);
  const resourceSelect = 'select=id,title,category,type,author,description,status,link,mega_url,external_url,storage_bucket,storage_path,access_type,price,download_label';
  const softwareSelect = 'select=id,title,category,type,author,description,status,link,mega_url,official_url,storage_bucket,storage_path,access_type,price,download_label,platform,license';
  const [resourceRes, softwareRes] = await Promise.all([
    resourceIds.length ? fetch(shopApiUrl(`/rest/v1/resources?${resourceSelect}&id=in.(${resourceIds.join(',')})`), { headers }) : Promise.resolve({ ok: true, json: async () => [] }),
    softwareIds.length ? fetch(shopApiUrl(`/rest/v1/software_items?${softwareSelect}&id=in.(${softwareIds.join(',')})`), { headers }) : Promise.resolve({ ok: true, json: async () => [] })
  ]);
  const resources = resourceRes.ok ? (await resourceRes.json()).map(item => ({ ...item, item_kind: 'resource', item_id: item.id })) : [];
  const software = softwareRes.ok ? (await softwareRes.json()).map(item => ({ ...item, item_kind: 'software', item_id: item.id })) : [];
  const items = [...resources, ...software];
  return {
    access,
    orders: ordersRes.ok ? await ordersRes.json() : [],
    saved,
    downloads: logsRes.ok ? await logsRes.json() : [],
    items
  };
}

window.ATShop = {
  readCart,
  writeCart,
  addToCart,
  removeFromCart,
  clearCart,
  updateCartBadge,
  money: shopMoney,
  escape: shopEscape,
  openItem,
  loadAccessMap,
  saveItem,
  createOrderFromCart,
  submitPaymentProof,
  uploadStorageFile,
  signedUrl,
  loadAccountData,
  showToast: showShopToast
};

updateCartBadge();
