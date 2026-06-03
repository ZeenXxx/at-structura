const storageKey = 'at_structura_resource_draft';
const form = document.getElementById('resourceManagerForm');
const output = document.getElementById('resourceJsonOutput');
const preview = document.getElementById('resourceManagerPreview');
const showToast = message => {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
};
const escapeText = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let resources = [];

function loadLocal() {
  try {
    resources = JSON.parse(localStorage.getItem(storageKey) || '[]');
  } catch {
    resources = [];
  }
}

function saveLocal() {
  localStorage.setItem(storageKey, JSON.stringify(resources));
}

function render() {
  output.value = JSON.stringify(resources, null, 2);
  preview.innerHTML = resources.slice(-5).reverse().map(item => `
    <article class="card resource-card">
      <span class="icon">${escapeText((item.category || 'RES').slice(0, 3).toUpperCase())}</span>
      <div class="meta"><span class="badge">${escapeText(item.category)}</span><span class="badge">${escapeText(item.type)}</span><span class="badge">${escapeText(item.status)}</span></div>
      <h3>${escapeText(item.title)}</h3>
      <p>${escapeText(item.description)}</p>
      <small>Sumber/author: ${escapeText(item.author)}</small>
    </article>
  `).join('') || '<div class="card empty">Belum ada draft resource lokal.</div>';
}

form?.addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(form);
  resources.push({
    title: String(data.get('title') || '').trim(),
    category: String(data.get('category') || '').trim(),
    type: String(data.get('type') || '').trim(),
    author: String(data.get('author') || '').trim(),
    description: String(data.get('description') || '').trim(),
    status: String(data.get('status') || '').trim(),
    link: String(data.get('link') || '#').trim() || '#'
  });
  saveLocal();
  render();
  form.reset();
  form.elements.author.value = 'AT STRUCTURA';
  form.elements.link.value = '#';
  showToast('Resource ditambahkan ke draft lokal.');
});

document.getElementById('resetManagerForm')?.addEventListener('click', () => {
  form.reset();
  form.elements.author.value = 'AT STRUCTURA';
  form.elements.link.value = '#';
});

document.getElementById('copyResourceJson')?.addEventListener('click', async () => {
  await navigator.clipboard.writeText(output.value);
  showToast('JSON disalin.');
});

document.getElementById('downloadResourceJson')?.addEventListener('click', () => {
  const blob = new Blob([output.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'resources.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

document.getElementById('importCurrentResources')?.addEventListener('click', async () => {
  const response = await fetch('../data/resources.json');
  resources = await response.json();
  saveLocal();
  render();
  showToast('Data resources saat ini dimuat ke draft lokal.');
});

document.getElementById('clearLocalResources')?.addEventListener('click', () => {
  if (!confirm('Hapus semua draft lokal resources?')) return;
  resources = [];
  saveLocal();
  render();
});

output?.addEventListener('input', () => {
  try {
    const parsed = JSON.parse(output.value);
    if (!Array.isArray(parsed)) throw new Error('JSON harus array.');
    resources = parsed;
    saveLocal();
    render();
  } catch {
    // Let user keep editing until JSON is valid.
  }
});

loadLocal();
render();