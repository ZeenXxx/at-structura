const resourceSearch = document.getElementById('resourceSearch');
const typeFilter = document.getElementById('typeFilter');
const categoryFilters = document.getElementById('categoryFilters');
const resourceGrid = document.getElementById('resourceGrid');
const pagination = document.getElementById('pagination');
let resources = [];
let current = 'All';
let page = 1;
const perPage = 9;
const categories = ['All', 'SNI', 'Regulasi', 'Software', 'Template', 'Modul', 'Buku & Referensi', 'Video Tutorial', 'Website Rujukan'];
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
const normalizeResource = item => ({
  title: item.title || '',
  category: item.category || 'Website Rujukan',
  type: item.type || 'Link',
  author: item.author || 'AT STRUCTURA',
  description: item.description || '',
  status: item.status || 'Tersedia',
  link: item.link || item.mega_url || item.external_url || '#'
});
const card = item => `
  <article class="card resource-card">
    <span class="icon">${escapeText((item.category || 'RES').slice(0, 3).toUpperCase())}</span>
    <div class="meta">
      <span class="badge">${escapeText(item.category)}</span>
      <span class="badge">${escapeText(item.type)}</span>
      <span class="badge ${statusTone(item.status)}">${escapeText(item.status)}</span>
    </div>
    <h3>${escapeText(item.title)}</h3>
    <p>${escapeText(item.description)}</p>
    <small>Sumber/author: ${escapeText(item.author)}</small>
    <div class="actions"><a class="btn btn-primary" href="${escapeText(item.link || '#')}" target="_blank" rel="noopener">${item.link && item.link !== '#' ? 'Buka Resource' : 'Detail Coming Soon'}</a></div>
  </article>
`;
function filtered() {
  const q = (resourceSearch?.value || '').toLowerCase();
  const type = typeFilter?.value || 'All';
  return resources.filter(item =>
    (current === 'All' || item.category === current) &&
    (type === 'All' || item.type === type) &&
    [item.title, item.category, item.type, item.author, item.description, item.status].join(' ').toLowerCase().includes(q)
  );
}
function renderFilters() {
  categoryFilters.innerHTML = categories.map(cat => `<button class="filter ${cat === current ? 'active' : ''}" type="button" data-category="${escapeText(cat)}">${escapeText(cat)}</button>`).join('');
  categoryFilters.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    current = button.dataset.category;
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
  resourceGrid.innerHTML = data.slice(start, start + perPage).map(card).join('') || '<div class="card empty">Resource tidak ditemukan.</div>';
  pagination.innerHTML = Array.from({ length: pages }, (_, i) => `<button class="${i + 1 === page ? 'active' : ''}" type="button" data-page="${i + 1}">${i + 1}</button>`).join('');
  pagination.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { page = Number(button.dataset.page); render(); }));
}
async function loadSupabaseResources() {
  const table = supabaseConfig().resourcesTable || 'resources';
  const query = 'select=id,title,category,type,author,description,status,link,mega_url,external_url,published_at,created_at&status=in.(Tersedia,Link%20Eksternal,Coming%20Soon)&order=published_at.desc.nullslast,created_at.desc';
  const response = await fetch(supabaseUrl(`/rest/v1/${table}?${query}`), { headers: supabaseHeaders() });
  if (!response.ok) throw new Error(`Supabase resources gagal dimuat (${response.status}).`);
  return (await response.json()).map(normalizeResource);
}
async function loadJsonResources() {
  const response = await fetch('/data/resources.json');
  if (!response.ok) throw new Error('resources.json gagal dimuat.');
  return (await response.json()).map(normalizeResource);
}
async function init() {
  const params = new URLSearchParams(location.search);
  if (params.get('category')) current = params.get('category');
  renderFilters();
  try {
    resources = isSupabaseReady() ? await loadSupabaseResources() : await loadJsonResources();
  } catch (error) {
    try {
      resources = await loadJsonResources();
    } catch {
      resourceGrid.innerHTML = '<div class="card empty">Resources belum bisa dimuat. Periksa konfigurasi Supabase atau jalankan melalui Live Server.</div>';
      return;
    }
  }
  render();
}
resourceSearch?.addEventListener('input', () => { page = 1; render(); });
typeFilter?.addEventListener('change', () => { page = 1; render(); });
init();
