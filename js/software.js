const softwareSearch = document.getElementById('softwareSearch');
const platformFilter = document.getElementById('platformFilter');
const softwareCategoryFilters = document.getElementById('softwareCategoryFilters');
const softwareGrid = document.getElementById('softwareGrid');
const softwarePagination = document.getElementById('softwarePagination');
let softwareItems = [];
let accessMap = new Set();
let currentCategory = 'All';
let page = 1;
const perPage = 9;
const defaultCategories = ['All', 'Analisis Struktur', 'CAD & Drafting', 'BIM', 'Geoteknik', 'Hidrologi', 'Transportasi & Survey', 'Estimasi Biaya', 'Utility'];
const escapeText = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const statusTone = status => String(status || '').toLowerCase().includes('tersedia') ? 'tag-red' : '';
const supabaseConfig = () => window.AT_SUPABASE || {};
const isSupabaseReady = () => {
  const cfg = supabaseConfig();
  return Boolean(cfg.enabled && cfg.url && cfg.anonKey && !String(cfg.url).includes('PROJECT_ID') && !String(cfg.anonKey).includes('SUPABASE_ANON_KEY'));
};
const supabaseUrl = path => `${String(supabaseConfig().url || '').replace(/\/$/, '')}${path}`;
const supabaseHeaders = token => ({
  apikey: supabaseConfig().anonKey,
  Authorization: `Bearer ${token || window.ATAuth?.getUserSession?.()?.access_token || supabaseConfig().anonKey}`,
  Accept: 'application/json'
});
const normalizeSoftware = item => ({
  id: item.id || '',
  item_id: item.id || '',
  item_kind: 'software',
  title: item.title || '',
  category: item.category || 'Software Teknik Sipil',
  type: item.type || 'Software',
  platform: item.platform || 'Windows',
  license: item.license || 'Catatan/Referensi',
  author: item.author || 'AT STRUCTURA',
  description: item.description || '',
  status: item.status || 'Tersedia',
  link: item.link || item.official_url || item.mega_url || '#',
  access_type: item.access_type || 'free',
  price: Number(item.price || 0),
  currency: item.currency || 'IDR',
  storage_bucket: item.storage_bucket || '',
  storage_path: item.storage_path || '',
  download_label: item.download_label || 'Download'
});
const canOpen = item => item.access_type !== 'premium' || accessMap.has(`${item.item_kind}:${item.item_id}`);
const accessBadge = item => item.access_type === 'premium' && item.price > 0 ? window.ATShop?.money?.(item.price) || `Rp ${item.price}` : 'Gratis';
const actionButtons = item => {
  if (item.status === 'Coming Soon') return '<button class="btn btn-secondary" type="button" disabled>Coming Soon</button>';
  if (canOpen(item)) return `<button class="btn btn-primary" type="button" data-shop-open="${escapeText(item.item_kind)}:${escapeText(item.item_id)}">${escapeText(item.download_label || 'Buka Link')}</button>`;
  return `
    <button class="btn btn-primary" type="button" data-shop-cart="${escapeText(item.item_kind)}:${escapeText(item.item_id)}">Tambah Keranjang</button>
    <a class="btn btn-secondary" href="/pages/cart/">Lihat Keranjang</a>
  `;
};
const card = item => `
  <article class="card resource-card" data-shop-card="${escapeText(item.item_kind)}:${escapeText(item.item_id)}">
    <span class="icon">SW</span>
    <div class="meta">
      <span class="badge">${escapeText(item.category)}</span>
      <span class="badge">${escapeText(item.platform)}</span>
      <span class="badge ${statusTone(item.status)}">${escapeText(item.status)}</span>
      <span class="badge ${item.access_type === 'premium' ? 'tag-red' : ''}">${escapeText(accessBadge(item))}</span>
    </div>
    <h3>${escapeText(item.title)}</h3>
    <p>${escapeText(item.description)}</p>
    <small>${escapeText(item.license)} - ${escapeText(item.author)}</small>
    <div class="actions">
      ${actionButtons(item)}
      <button class="btn btn-secondary" type="button" data-shop-save="${escapeText(item.item_kind)}:${escapeText(item.item_id)}">Simpan</button>
    </div>
  </article>
`;
const emptyState = ({ title, message, actionHref = '/pages/contact/', actionText = 'Hubungi Saya' }) => `
  <div class="card empty-state">
    <span class="icon">SW</span>
    <h3>${escapeText(title)}</h3>
    <p>${escapeText(message)}</p>
    <div class="actions">
      <button class="btn btn-secondary" type="button" id="resetSoftwareFilters">Reset Filter</button>
      <a class="btn btn-primary" href="${escapeText(actionHref)}">${escapeText(actionText)}</a>
    </div>
  </div>
`;
function categories() {
  const unique = [...new Set(softwareItems.map(item => item.category).filter(Boolean))];
  return ['All', ...defaultCategories.filter(category => category !== 'All' && unique.includes(category)), ...unique.filter(category => !defaultCategories.includes(category))];
}
function filtered() {
  const q = (softwareSearch?.value || '').toLowerCase();
  const platform = platformFilter?.value || 'All';
  return softwareItems.filter(item =>
    (currentCategory === 'All' || item.category === currentCategory) &&
    (platform === 'All' || item.platform === platform) &&
    [item.title, item.category, item.platform, item.license, item.author, item.description, item.status].join(' ').toLowerCase().includes(q)
  );
}
function renderFilters() {
  softwareCategoryFilters.innerHTML = categories().map(category => `<button class="filter ${category === currentCategory ? 'active' : ''}" type="button" data-category="${escapeText(category)}">${escapeText(category)}</button>`).join('');
  softwareCategoryFilters.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    currentCategory = button.dataset.category;
    page = 1;
    renderFilters();
    render();
  }));
}
function render() {
  const data = filtered();
  const pages = Math.max(1, Math.ceil(data.length / perPage));
  page = Math.min(page, pages);
  const start = (page - 1) * perPage;
  softwareGrid.innerHTML = data.slice(start, start + perPage).map(card).join('') || emptyState({
    title: 'Software belum ditemukan',
    message: 'Coba reset filter atau gunakan kata kunci yang lebih umum. Jika ingin request catatan workflow software tertentu, kirimkan lewat halaman kontak.',
    actionHref: '/pages/contact/',
    actionText: 'Request Software'
  });
  softwarePagination.innerHTML = Array.from({ length: pages }, (_, i) => `<button class="${i + 1 === page ? 'active' : ''}" type="button" data-page="${i + 1}">${i + 1}</button>`).join('');
  softwarePagination.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { page = Number(button.dataset.page); render(); }));
  document.getElementById('resetSoftwareFilters')?.addEventListener('click', () => {
    currentCategory = 'All';
    page = 1;
    if (softwareSearch) softwareSearch.value = '';
    if (platformFilter) platformFilter.value = 'All';
    renderFilters();
    render();
  });
}
async function loadSupabaseSoftware() {
  const table = supabaseConfig().softwareTable || 'software_items';
  const query = 'select=id,title,category,type,platform,license,author,description,status,link,official_url,mega_url,published_at,created_at,access_type,price,currency,storage_bucket,storage_path,download_label&status=in.(Tersedia,Link%20Eksternal,Coming%20Soon)&order=published_at.desc.nullslast,created_at.desc';
  const response = await fetch(supabaseUrl(`/rest/v1/${table}?${query}`), { headers: supabaseHeaders() });
  if (!response.ok) throw new Error(`Supabase software gagal dimuat (${response.status}).`);
  return (await response.json()).map(normalizeSoftware);
}
async function loadJsonSoftware() {
  const response = await fetch('/data/software.json');
  if (!response.ok) throw new Error('software.json gagal dimuat.');
  return (await response.json()).map(normalizeSoftware);
}
async function init() {
  if (document.body?.dataset.requireAuth) {
    const session = await window.ATAuth?.ensureUserSession?.();
    if (!session?.access_token) return;
  }
  const params = new URLSearchParams(location.search);
  if (params.get('category')) currentCategory = params.get('category');
  try {
    softwareItems = isSupabaseReady() ? await loadSupabaseSoftware() : await loadJsonSoftware();
    accessMap = await window.ATShop?.loadAccessMap?.() || new Set();
  } catch (error) {
    try {
      softwareItems = await loadJsonSoftware();
    } catch {
      softwareGrid.innerHTML = emptyState({
        title: 'Software belum bisa dimuat',
        message: 'Periksa koneksi internet, konfigurasi Supabase, atau jalankan website melalui Live Server.',
        actionHref: '/',
        actionText: 'Kembali Home'
      });
      return;
    }
  }
  renderFilters();
  render();
}
softwareSearch?.addEventListener('input', () => { page = 1; render(); });
platformFilter?.addEventListener('change', () => { page = 1; render(); });
document.addEventListener('click', async event => {
  const cartButton = event.target.closest('[data-shop-cart]');
  const openButton = event.target.closest('[data-shop-open]');
  const saveButton = event.target.closest('[data-shop-save]');
  const key = cartButton?.dataset.shopCart || openButton?.dataset.shopOpen || saveButton?.dataset.shopSave;
  if (!key) return;
  const item = softwareItems.find(entry => `${entry.item_kind}:${entry.item_id}` === key);
  if (!item) return;
  try {
    if (cartButton) window.ATShop?.addToCart?.(item);
    if (openButton) await window.ATShop?.openItem?.(item);
    if (saveButton) await window.ATShop?.saveItem?.(item);
  } catch (error) {
    window.ATShop?.showToast?.(error.message);
  }
});
init();
