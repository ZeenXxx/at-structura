const softwareSearch = document.getElementById('softwareSearch');
const platformFilter = document.getElementById('platformFilter');
const softwareCategoryFilters = document.getElementById('softwareCategoryFilters');
const softwareGrid = document.getElementById('softwareGrid');
const softwarePagination = document.getElementById('softwarePagination');
let softwareItems = [];
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
  Authorization: `Bearer ${token || supabaseConfig().anonKey}`,
  Accept: 'application/json'
});
const normalizeSoftware = item => ({
  title: item.title || '',
  category: item.category || 'Software Teknik Sipil',
  type: item.type || 'Software',
  platform: item.platform || 'Windows',
  license: item.license || 'Catatan/Referensi',
  author: item.author || 'AT STRUCTURA',
  description: item.description || '',
  status: item.status || 'Tersedia',
  link: item.link || item.official_url || item.mega_url || '#'
});
const card = item => `
  <article class="card resource-card">
    <span class="icon">SW</span>
    <div class="meta">
      <span class="badge">${escapeText(item.category)}</span>
      <span class="badge">${escapeText(item.platform)}</span>
      <span class="badge ${statusTone(item.status)}">${escapeText(item.status)}</span>
    </div>
    <h3>${escapeText(item.title)}</h3>
    <p>${escapeText(item.description)}</p>
    <small>${escapeText(item.license)} - ${escapeText(item.author)}</small>
    <div class="actions"><a class="btn btn-primary" href="${escapeText(item.link || '#')}" target="_blank" rel="noopener">${item.link && item.link !== '#' ? 'Buka Link' : 'Detail Coming Soon'}</a></div>
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
  const query = 'select=id,title,category,type,platform,license,author,description,status,link,official_url,mega_url,published_at,created_at&status=in.(Tersedia,Link%20Eksternal,Coming%20Soon)&order=published_at.desc.nullslast,created_at.desc';
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
  const params = new URLSearchParams(location.search);
  if (params.get('category')) currentCategory = params.get('category');
  try {
    softwareItems = isSupabaseReady() ? await loadSupabaseSoftware() : await loadJsonSoftware();
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
init();
