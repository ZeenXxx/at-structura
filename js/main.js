const escapeText = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const showToast = message => {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
};
const visibleContentStatuses = ['Tersedia', 'Link Eksternal', 'Coming Soon'];
const cfg = () => window.AT_SUPABASE || {};
const isSupabaseReady = () => Boolean(cfg().enabled && cfg().url && cfg().anonKey && !String(cfg().url).includes('PROJECT_ID') && !String(cfg().anonKey).includes('SUPABASE_ANON_KEY'));
const apiUrl = path => `${String(cfg().url || '').replace(/\/$/, '')}${path}`;
const publicHeaders = () => {
  const token = window.ATAuth?.getUserSession?.()?.access_token || cfg().anonKey;
  return { apikey: cfg().anonKey, Authorization: `Bearer ${token}`, Accept: 'application/json' };
};

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Gagal memuat ${path}`);
  return response.json();
}

async function fetchPublicRows(path) {
  if (!isSupabaseReady()) throw new Error('Supabase belum siap');
  const response = await fetch(apiUrl(path), { headers: publicHeaders() });
  const payload = await response.json().catch(() => []);
  if (!response.ok) throw new Error(payload.message || payload.msg || 'Data Supabase gagal dimuat');
  return Array.isArray(payload) ? payload : [];
}

const activeToolCount = items => items.filter(item => item.status === 'Tersedia').length;
const activeContentCount = items => items.filter(item => visibleContentStatuses.includes(item.status)).length;
const activeServiceCount = items => items.filter(item => item.is_active !== false && item.status === 'Aktif').length;

async function getLiveCounts() {
  const fallback = { tools: 0, resources: 0, software: 0, services: 0 };
  const localTasks = [
    fetchJson('/data/tools.json').then(activeToolCount).catch(() => 0),
    fetchJson('/data/resources.json').then(activeContentCount).catch(() => 0),
    fetchJson('/data/software.json').then(activeContentCount).catch(() => 0),
    fetchJson('/data/services.json').then(activeServiceCount).catch(() => 0)
  ];
  [fallback.tools, fallback.resources, fallback.software, fallback.services] = await Promise.all(localTasks);

  if (!isSupabaseReady()) return fallback;
  const countersTable = cfg().countersTable || 'site_counters';
  const counterRows = await fetchPublicRows(`/rest/v1/${countersTable}?select=key,value&key=in.(resources,software,services)`).catch(() => []);
  if (counterRows.length) {
    const counters = counterRows.reduce((acc, row) => ({ ...acc, [row.key]: Number(row.value || 0) }), {});
    return {
      tools: fallback.tools,
      resources: counters.resources ?? fallback.resources,
      software: counters.software ?? fallback.software,
      services: counters.services ?? fallback.services
    };
  }
  const resourcesTable = cfg().resourcesTable || 'resources';
  const softwareTable = cfg().softwareTable || 'software_items';
  const servicesTable = cfg().servicesTable || 'technical_services';
  const liveTasks = [
    Promise.resolve(fallback.tools),
    fetchPublicRows(`/rest/v1/${resourcesTable}?select=id&category=neq.Software&status=in.(Tersedia,Link%20Eksternal,Coming%20Soon)`).then(rows => rows.length).catch(() => fallback.resources),
    fetchPublicRows(`/rest/v1/${softwareTable}?select=id&status=in.(Tersedia,Link%20Eksternal,Coming%20Soon)`).then(rows => rows.length).catch(() => fallback.software),
    fetchPublicRows(`/rest/v1/${servicesTable}?select=id&is_active=eq.true&status=eq.Aktif`).then(rows => rows.length).catch(() => fallback.services)
  ];
  const [tools, resources, software, services] = await Promise.all(liveTasks);
  return { tools, resources, software, services };
}

async function updateLiveCounts() {
  const targets = document.querySelectorAll('[data-live-count]');
  if (!targets.length) return;
  const counts = await getLiveCounts();
  targets.forEach(target => {
    const key = target.dataset.liveCount;
    if (Object.prototype.hasOwnProperty.call(counts, key)) {
      target.textContent = counts[key];
    }
  });
}

async function getActiveServices() {
  const fallback = await fetchJson('/data/services.json').catch(() => []);
  if (!isSupabaseReady()) return fallback.filter(item => item.is_active !== false && item.status === 'Aktif');
  const table = cfg().servicesTable || 'technical_services';
  const rows = await fetchPublicRows(`/rest/v1/${table}?select=*&is_active=eq.true&status=eq.Aktif&order=sort_order.asc,created_at.asc`).catch(() => fallback);
  return rows
    .filter(item => item.is_active !== false && item.status === 'Aktif')
    .sort((a, b) => Number(a.sort_order || 100) - Number(b.sort_order || 100));
}

async function renderServices() {
  const grid = document.getElementById('serviceGrid');
  if (!grid) return;
  if (document.body?.dataset.requireAuth) {
    const session = await window.ATAuth?.ensureUserSession?.();
    if (!session?.access_token) return;
  }
  try {
    const services = await getActiveServices();
    grid.innerHTML = services.map(service => `
      <article class="card quick">
        <span class="icon">${escapeText(service.icon || 'JS')}</span>
        <h3>${escapeText(service.title)}</h3>
        <p>${escapeText(service.description)}</p>
      </article>
    `).join('') || `
      <div class="card empty-state">
        <span class="icon">JS</span>
        <h3>Layanan sedang dikurasi</h3>
        <p>Layanan aktif belum tersedia. Aktifkan layanan dari halaman admin.</p>
      </div>
    `;
  } catch (error) {
    grid.innerHTML = '<div class="card empty-state"><span class="icon">JS</span><h3>Layanan belum bisa dimuat</h3><p>Coba buka melalui Live Server atau cek koneksi Supabase.</p></div>';
  }
}

async function renderPortfolio() {
  const grid = document.getElementById('portfolioGrid');
  if (!grid) return;
  try {
    const response = await fetch('/data/portfolio.json');
    const items = await response.json();
    grid.innerHTML = items.map(item => `
      <article class="card portfolio-card">
        <span class="badge">${escapeText(item.category)}</span>
        <h3>${escapeText(item.title)}</h3>
        <p>${escapeText(item.description)}</p>
        <div class="meta"><span class="badge">${escapeText(item.status)}</span><span class="badge">${escapeText(item.tools)}</span></div>
        <small>Peran: ${escapeText(item.role)}</small>
      </article>
    `).join('');
  } catch (error) {
    grid.innerHTML = '<div class="card empty">Portfolio belum bisa dimuat. Jalankan melalui Live Server agar data JSON terbaca.</div>';
  }
}

function setupContactForm() {
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;
  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const name = data.get('name') || '';
    const email = data.get('email') || '';
    const topic = data.get('topic') || '';
    const message = data.get('message') || '';
    const subject = encodeURIComponent('Diskusi AT STRUCTURA - ' + topic);
    const body = encodeURIComponent(`Nama: ${name}\nEmail: ${email}\nKebutuhan: ${topic}\n\nPesan:\n${message}`);
    window.location.href = `mailto:atstructura@gmail.com?subject=${subject}&body=${body}`;
    showToast('Draft email dibuat di aplikasi email perangkat Anda.');
  });
}

renderPortfolio();
setupContactForm();
updateLiveCounts();
renderServices();

