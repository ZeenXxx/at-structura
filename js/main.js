const escapeText = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const showToast = message => {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
};

async function renderPortfolio() {
  const grid = document.getElementById('portfolioGrid');
  if (!grid) return;
  try {
    const response = await fetch('../data/portfolio.json');
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
    window.location.href = `mailto:arieftediansyah0@gmail.com?subject=${subject}&body=${body}`;
    showToast('Draft email dibuat di aplikasi email perangkat Anda.');
  });
}

renderPortfolio();
setupContactForm();