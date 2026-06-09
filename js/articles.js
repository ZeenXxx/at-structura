const articleGrid = document.getElementById('articleGrid');
const articleSearch = document.getElementById('articleSearch');
const articleCategory = document.getElementById('articleCategory');
let articleItems = [];

const articleEscape = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function renderArticleCategories() {
  if (!articleCategory) return;
  const categories = ['All', ...new Set(articleItems.map(item => item.category).filter(Boolean))];
  articleCategory.innerHTML = categories.map(category => `<option value="${articleEscape(category)}">${category === 'All' ? 'Semua kategori' : articleEscape(category)}</option>`).join('');
}

function filteredArticles() {
  const q = String(articleSearch?.value || '').toLowerCase();
  const category = articleCategory?.value || 'All';
  return articleItems.filter(item => {
    const haystack = [item.title, item.category, item.description, item.status, ...(item.keywords || [])].join(' ').toLowerCase();
    return (category === 'All' || item.category === category) && haystack.includes(q);
  });
}

function renderArticles() {
  if (!articleGrid) return;
  const items = filteredArticles();
  articleGrid.innerHTML = items.map(item => `
    <article class="card article-card">
      <div class="meta">
        <span class="badge tag-red">${articleEscape(item.category)}</span>
        <span class="badge">${articleEscape(item.status)}</span>
      </div>
      <h3>${articleEscape(item.title)}</h3>
      <p>${articleEscape(item.description)}</p>
      <small>Target pencarian: ${articleEscape((item.keywords || []).join(', '))}</small>
      <div class="actions">
        <a class="btn btn-secondary" href="/pages/contact/?topic=${encodeURIComponent(item.title)}">Diskusikan Topik</a>
      </div>
    </article>
  `).join('') || `
    <div class="card empty-state">
      <span class="icon">AR</span>
      <h3>Artikel belum ditemukan</h3>
      <p>Coba ubah kata kunci atau reset kategori.</p>
    </div>
  `;
}

async function loadArticles() {
  try {
    const response = await fetch('/data/articles.json');
    articleItems = await response.json();
  } catch {
    articleItems = [];
  }
  renderArticleCategories();
  renderArticles();
}

articleSearch?.addEventListener('input', renderArticles);
articleCategory?.addEventListener('change', renderArticles);
loadArticles();
