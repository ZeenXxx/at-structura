const escapeText = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
async function renderPortfolio() {
  const grid = document.getElementById('portfolioGrid');
  if (!grid) return;
  try {
    const response = await fetch('../data/portfolio.json');
    const items = await response.json();
    grid.innerHTML = items.map(item => `<article class="card quick"><span class="badge">${escapeText(item.category)}</span><h3>${escapeText(item.title)}</h3><p>${escapeText(item.description)}</p><div class="meta"><span class="badge">${escapeText(item.status)}</span></div></article>`).join('');
  } catch (error) {
    grid.innerHTML = '<div class="card empty">Portfolio belum bisa dimuat. Jalankan melalui Live Server agar data JSON terbaca.</div>';
  }
}
renderPortfolio();