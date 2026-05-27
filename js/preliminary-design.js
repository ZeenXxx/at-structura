const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));

const format = (value, digits = 0) => new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits
}).format(value);
const formatFlex = value => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(value);
const getNumber = (id, fallback = 0) => {
  const value = Number($(id)?.value);
  return Number.isFinite(value) ? value : fallback;
};
const ceilTo = (value, step = 25) => Math.ceil(value / step) * step;
const safeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

$$('[data-prelim-tab]').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.prelimTab;
    $$('[data-prelim-tab]').forEach(item => item.classList.toggle('active', item === tab));
    $$('.prelim-panel').forEach(panel => panel.classList.toggle('active', panel.id === `panel-${target}`));
    history.replaceState(null, '', `#${target}`);
  });
});

const initialTab = location.hash.replace('#', '');
if (initialTab && $(`[data-prelim-tab="${initialTab}"]`)) $(`[data-prelim-tab="${initialTab}"]`).click();

const fyDeflectionModifier = fy => fy > 420 ? 0.4 + fy / 700 : 1;
const lightweightModifier = wc => wc >= 1440 && wc <= 1840 ? Math.max(1.65 - 0.0003 * wc, 1.09) : 1;
const modifierText = (fy, wc) => {
  const parts = [];
  if (fy > 420) parts.push(`faktor fy = 0,4 + fy/700 = ${formatFlex(fyDeflectionModifier(fy))}`);
  if (wc >= 1440 && wc <= 1840) parts.push(`faktor beton ringan = ${formatFlex(lightweightModifier(wc))}`);
  return parts.length ? parts.join('; ') : 'tidak ada faktor modifikasi';
};
const conditionLabels = {
  simple: 'Tumpuan sederhana',
  oneEnd: 'Menerus satu sisi',
  twoEnd: 'Menerus dua sisi',
  cantilever: 'Kantilever'
};

const renderMetrics = metrics => `
  <div class="metric-grid">
    ${metrics.map(item => `<div class="metric"><span>${item.label}</span><strong>${item.value}</strong></div>`).join('')}
  </div>
`;
const renderStatus = items => `<ul class="status-list">${items.map(item => `<li class="${item.type || 'ok'}">${item.text}</li>`).join('')}</ul>`;

const infoColumn = () => {
  $('#columnInfo').innerHTML = `
    <h3>Dasar SNI 2847:2019 - Kolom</h3>
    <div class="reference-grid">
      <div class="reference-item"><strong>Pasal 10.3.1</strong><span>Batas dimensi kolom umum tidak diberi minimum eksplisit; bila penampang kecil dipakai, desain dan pelaksanaan perlu lebih hati-hati.</span></div>
      <div class="reference-item"><strong>Pasal 18.7.2.1</strong><span>Untuk kolom sistem rangka pemikul momen khusus: dimensi terkecil minimal 300 mm dan rasio dimensi terkecil terhadap dimensi tegak lurus minimal 0,4.</span></div>
      <div class="reference-item"><strong>Pasal 18.7.4.1</strong><span>Luas tulangan longitudinal kolom khusus berada pada rentang 0,01Ag sampai 0,06Ag.</span></div>
      <div class="reference-item"><strong>Tabel 21.2.2 dan Tabel 22.4.2.1</strong><span>Faktor reduksi tekan terkontrol dan batas Pn,max untuk kolom nonprategang.</span></div>
    </div>
    <div class="formula-box">
      <code>Po = 0,85 f'c (Ag - Ast) + fy Ast</code>
      <code>Pn,max = 0,80 Po untuk sengkang persegi; 0,85 Po untuk spiral</code>
      <code>Ag awal = Pu / [&phi; x faktor Pn,max x (0,85 f'c (1 - &rho;) + fy &rho;)]</code>
    </div>
    <div class="sni-table-wrap">
      <table class="sni-table">
        <thead><tr><th>Item</th><th>Nilai ringkas</th><th>Rujukan</th></tr></thead>
        <tbody>
          <tr><td>&phi; tekan terkontrol</td><td>0,65 sengkang lainnya; 0,75 spiral</td><td>Tabel 21.2.2</td></tr>
          <tr><td>Pn,max nonprategang</td><td>0,80Po sengkang persegi; 0,85Po spiral</td><td>Tabel 22.4.2.1</td></tr>
          <tr><td>Kolom khusus</td><td>min 300 mm; rasio sisi min/maks &ge; 0,4</td><td>18.7.2.1</td></tr>
          <tr><td>Ast kolom khusus</td><td>0,01Ag &le; Ast &le; 0,06Ag</td><td>18.7.4.1</td></tr>
        </tbody>
      </table>
    </div>
  `;
};

const fitColumn = (area, aspect, special) => {
  const ratio = Math.max(aspect, 0.1);
  let b = ceilTo(Math.sqrt(area / ratio), 25);
  let h = ceilTo(b * ratio, 25);
  let guard = 0;
  while (guard < 300 && (b * h < area || (special && (Math.min(b, h) < 300 || Math.min(b, h) / Math.max(b, h) < 0.4)))) {
    if (b * h < area) {
      if (b <= h) b += 25;
      else h += 25;
    } else if (Math.min(b, h) < 300) {
      if (b <= h) b += 25;
      else h += 25;
    } else if (Math.min(b, h) / Math.max(b, h) < 0.4) {
      if (b <= h) b += 25;
      else h += 25;
    }
    guard += 1;
  }
  return { b, h };
};

const calculateColumn = () => {
  const pu = getNumber('#colPu', 0);
  const fc = getNumber('#colFc', 25);
  const fy = getNumber('#colFy', 420);
  const rho = getNumber('#colRho', 1.5) / 100;
  const aspect = getNumber('#colAspect', 1);
  const tie = $('#colTie').value;
  const special = $('#colSpecial').checked;
  if (pu <= 0 || fc <= 0 || fy <= 0 || rho <= 0 || aspect <= 0) return;

  const phi = tie === 'spiral' ? 0.75 : 0.65;
  const pMaxFactor = tie === 'spiral' ? 0.85 : 0.80;
  const stress = phi * pMaxFactor * (0.85 * fc * (1 - rho) + fy * rho);
  const requiredArea = (pu * 1000) / stress;
  const dim = fitColumn(requiredArea, aspect, special);
  const ag = dim.b * dim.h;
  const ast = rho * ag;
  const po = (0.85 * fc * (ag - ast)) + fy * ast;
  const designCapacity = phi * pMaxFactor * po / 1000;
  const minAst = 0.01 * ag;
  const maxAst = 0.06 * ag;
  const sideRatio = Math.min(dim.b, dim.h) / Math.max(dim.b, dim.h);
  const status = [
    { type: designCapacity >= pu ? 'ok' : 'warn', text: `Cek aksial awal: ${format(designCapacity)} kN ${designCapacity >= pu ? '&ge;' : '<'} Pu ${format(pu)} kN.` },
    { type: !special || Math.min(dim.b, dim.h) >= 300 ? 'ok' : 'warn', text: special ? `Dimensi terkecil ${format(Math.min(dim.b, dim.h))} mm terhadap batas 300 mm Pasal 18.7.2.1.` : 'Batas kolom khusus tidak diterapkan.' },
    { type: !special || sideRatio >= 0.4 ? 'ok' : 'warn', text: special ? `Rasio sisi min/maks = ${formatFlex(sideRatio)} terhadap batas 0,4 Pasal 18.7.2.1.` : 'Mode kolom umum: lihat Pasal 10.3.1 untuk catatan batas dimensi.' },
    { type: ast >= minAst && ast <= maxAst ? 'ok' : 'warn', text: `Ast asumsi = ${format(ast)} mm2; rentang kolom khusus 0,01Ag-0,06Ag = ${format(minAst)}-${format(maxAst)} mm2.` }
  ];

  $('#columnResult').innerHTML = `
    <span class="result-kicker">Rekomendasi awal</span>
    <h3 class="result-title">${format(dim.b)} x ${format(dim.h)} mm</h3>
    <p class="result-subtitle">Ag terpasang ${format(ag)} mm2 dari Ag perlu ${format(requiredArea)} mm2.</p>
    ${renderMetrics([
      { label: 'Kapasitas desain awal', value: `${format(designCapacity)} kN` },
      { label: 'Tulangan asumsi', value: `${format(ast)} mm2` },
      { label: 'phi dan Pn,max', value: `${formatFlex(phi)} x ${formatFlex(pMaxFactor)}Po` },
      { label: 'Rasio tulangan', value: `${formatFlex(rho * 100)}% Ag` }
    ])}
    ${renderStatus(status)}
  `;
};

const infoBeam = () => {
  $('#beamInfo').innerHTML = `
    <h3>Dasar SNI 2847:2019 - Balok</h3>
    <div class="reference-grid">
      <div class="reference-item"><strong>Pasal 9.3.1.1</strong><span>Tinggi minimum balok nonprategang boleh mengikuti Tabel 9.3.1.1 bila tidak menumpu partisi/konstruksi yang rentan rusak akibat lendutan besar.</span></div>
      <div class="reference-item"><strong>Pasal 9.3.1.1.1-9.3.1.1.3</strong><span>Modifikasi untuk fy lebih dari 420 MPa dan beton ringan.</span></div>
    </div>
    <div class="formula-box">
      <code>hmin = l / faktor kondisi tumpuan</code>
      <code>Jika fy &gt; 420 MPa: hmin dikali (0,4 + fy / 700)</code>
      <code>Jika beton ringan 1440-1840 kg/m3: hmin dikali max(1,65 - 0,0003wc; 1,09)</code>
    </div>
    <div class="sni-table-wrap">
      <table class="sni-table">
        <thead><tr><th>Kondisi balok</th><th>Minimum h</th><th>Rujukan</th></tr></thead>
        <tbody>
          <tr><td>Sederhana</td><td>l/16</td><td>Tabel 9.3.1.1</td></tr>
          <tr><td>Menerus satu sisi</td><td>l/18,5</td><td>Tabel 9.3.1.1</td></tr>
          <tr><td>Menerus dua sisi</td><td>l/21</td><td>Tabel 9.3.1.1</td></tr>
          <tr><td>Kantilever</td><td>l/8</td><td>Tabel 9.3.1.1</td></tr>
        </tbody>
      </table>
    </div>
    <p class="note-small">Lebar balok yang ditampilkan adalah saran awal praktis untuk pemodelan awal, bukan batas eksplisit dari tabel SNI.</p>
  `;
};

const beamRatios = { simple: 16, oneEnd: 18.5, twoEnd: 21, cantilever: 8 };
const calculateBeam = () => {
  const span = getNumber('#beamSpan', 0) * 1000;
  const fy = getNumber('#beamFy', 420);
  const wc = getNumber('#beamWc', 2400);
  const condition = $('#beamCondition').value;
  if (span <= 0 || fy <= 0 || wc <= 0) return;
  const raw = span / beamRatios[condition];
  const mod = fyDeflectionModifier(fy) * lightweightModifier(wc);
  const hMin = raw * mod;
  const hRec = ceilTo(hMin, 25);
  const bRec = ceilTo(Math.max(200, hRec * 0.45), 25);
  $('#beamResult').innerHTML = `
    <span class="result-kicker">Rekomendasi awal</span>
    <h3 class="result-title">b ${format(bRec)} x h ${format(hRec)} mm</h3>
    <p class="result-subtitle">${conditionLabels[condition]} memakai hmin = l/${beamRatios[condition]}.</p>
    ${renderMetrics([
      { label: 'h minimum hitungan', value: `${format(hMin)} mm` },
      { label: 'Bentang bersih', value: `${format(span)} mm` },
      { label: 'Modifikasi', value: modifierText(fy, wc) },
      { label: 'Rasio awal b/h', value: `${formatFlex(bRec / hRec)}` }
    ])}
    ${renderStatus([{ text: 'Lanjutkan desain final untuk lentur, geser, torsi, tulangan minimum, detailing, dan lendutan bila kondisi tabel tidak terpenuhi.' }])}
  `;
};

const infoSlab = () => {
  $('#slabInfo').innerHTML = `
    <h3>Dasar SNI 2847:2019 - Pelat</h3>
    <div class="reference-grid">
      <div class="reference-item"><strong>Pasal 7.3.1.1</strong><span>Tebal minimum pelat solid satu arah nonprategang mengikuti Tabel 7.3.1.1, dengan modifikasi fy dan beton ringan.</span></div>
      <div class="reference-item"><strong>Pasal 8.3.1.1</strong><span>Tabel pelat dua arah tanpa balok interior berlaku untuk rasio bentang panjang terhadap bentang pendek maksimum 2.</span></div>
      <div class="reference-item"><strong>R8.3.1.2</strong><span>Panel dengan rasio bentang lebih besar dari 2 diarahkan memakai aturan konstruksi satu arah Pasal 7.3.1.</span></div>
      <div class="reference-item"><strong>Tabel 8.3.1.1</strong><span>Tebal minimum pelat dua arah ditentukan dari fy, lokasi panel, balok tepi, dan drop panel.</span></div>
    </div>
    <div class="formula-box">
      <code>Rasio panel = bentang panjang / bentang pendek</code>
      <code>Jika rasio &gt; 2,0: pelat satu arah; jika rasio &le; 2,0: pelat dua arah</code>
      <code>Pelat satu arah: hmin = l / faktor Tabel 7.3.1.1</code>
      <code>Pelat dua arah: hmin = max(ln / faktor Tabel 8.3.1.1, batas absolut 125 mm atau 100 mm)</code>
    </div>
    <div class="sni-table-wrap">
      <table class="sni-table">
        <thead><tr><th>Jenis</th><th>Kondisi</th><th>Nilai ringkas</th></tr></thead>
        <tbody>
          <tr><td>Satu arah</td><td>Sederhana / satu ujung / dua ujung / kantilever</td><td>l/20, l/24, l/28, l/10</td></tr>
          <tr><td>Dua arah tanpa drop</td><td>fy 420 MPa: eksterior tanpa balok tepi / dengan balok tepi / interior</td><td>ln/30, ln/33, ln/33</td></tr>
          <tr><td>Dua arah dengan drop</td><td>fy 420 MPa: eksterior tanpa balok tepi / dengan balok tepi / interior</td><td>ln/33, ln/36, ln/36</td></tr>
          <tr><td>Batas absolut dua arah</td><td>Tanpa drop / dengan drop</td><td>125 mm / 100 mm</td></tr>
        </tbody>
      </table>
    </div>
  `;
};

const slabOneWayRatios = { simple: 20, oneEnd: 24, twoEnd: 28, cantilever: 10 };
const twoWayRows = {
  edgeNoBeamNoDrop: { label: 'Eksterior tanpa balok tepi, tanpa drop', values: { 280: 33, 420: 30, 520: 28 }, drop: false },
  edgeBeamNoDrop: { label: 'Eksterior dengan balok tepi, tanpa drop', values: { 280: 36, 420: 33, 520: 31 }, drop: false },
  interiorNoDrop: { label: 'Interior tanpa drop', values: { 280: 36, 420: 33, 520: 31 }, drop: false },
  edgeNoBeamDrop: { label: 'Eksterior tanpa balok tepi, dengan drop', values: { 280: 36, 420: 33, 520: 31 }, drop: true },
  edgeBeamDrop: { label: 'Eksterior dengan balok tepi, dengan drop', values: { 280: 40, 420: 36, 520: 34 }, drop: true },
  interiorDrop: { label: 'Interior dengan drop', values: { 280: 40, 420: 36, 520: 34 }, drop: true }
};
const interpolateDivisor = (fy, row) => {
  const points = [280, 420, 520];
  if (fy <= 280) return row.values[280];
  if (fy >= 520) return row.values[520];
  const low = fy <= 420 ? 280 : 420;
  const high = fy <= 420 ? 420 : 520;
  const t = (fy - low) / (high - low);
  return row.values[low] + (row.values[high] - row.values[low]) * t;
};
const calculateSlab = () => {
  const shortSpan = getNumber('#slabShort', 0) * 1000;
  const longSpan = getNumber('#slabLong', 0) * 1000;
  const fy = getNumber('#slabFy', 420);
  const wc = getNumber('#slabWc', 2400);
  if (shortSpan <= 0 || longSpan <= 0 || fy <= 0 || wc <= 0) return;
  const minSpan = Math.min(shortSpan, longSpan);
  const maxSpan = Math.max(shortSpan, longSpan);
  const ratio = maxSpan / minSpan;
  const isOneWay = ratio > 2;
  let title = '';
  let subtitle = '';
  let metrics = [];
  let statuses = [];

  if (isOneWay) {
    const condition = $('#slabOneWayCondition').value;
    const raw = minSpan / slabOneWayRatios[condition];
    const mod = fyDeflectionModifier(fy) * lightweightModifier(wc);
    const hMin = raw * mod;
    const hRec = ceilTo(hMin, 5);
    title = `Pelat satu arah, h ${format(hRec)} mm`;
    subtitle = `Rasio panel ${formatFlex(ratio)} > 2,0 sehingga dipakai aksi satu arah pada bentang pendek.`;
    metrics = [
      { label: 'h minimum hitungan', value: `${format(hMin)} mm` },
      { label: 'Rumus tabel', value: `l/${slabOneWayRatios[condition]}` },
      { label: 'Kondisi', value: conditionLabels[condition] },
      { label: 'Modifikasi', value: modifierText(fy, wc) }
    ];
    statuses = [{ text: 'Klasifikasi mengikuti Pasal 8.3.1.1 dan catatan R8.3.1.2 untuk rasio bentang lebih dari 2.' }];
  } else {
    const row = twoWayRows[$('#slabPanel').value];
    const divisor = interpolateDivisor(fy, row);
    const hTable = maxSpan / divisor;
    const absMin = row.drop ? 100 : 125;
    const hMin = Math.max(hTable, absMin);
    const hRec = ceilTo(hMin, 5);
    title = `Pelat dua arah, h ${format(hRec)} mm`;
    subtitle = `Rasio panel ${formatFlex(ratio)} <= 2,0 sehingga memenuhi batas awal tabel pelat dua arah.`;
    metrics = [
      { label: 'h dari tabel', value: `${format(hTable)} mm` },
      { label: 'Pembagi interpolasi', value: `ln/${formatFlex(divisor)}` },
      { label: 'Batas absolut', value: `${absMin} mm` },
      { label: 'Panel', value: row.label }
    ];
    statuses = [{ text: `Tebal akhir memakai nilai terbesar dari ln/${formatFlex(divisor)} dan batas absolut ${absMin} mm.` }];
  }

  $('#slabResult').innerHTML = `
    <span class="result-kicker">Rekomendasi awal</span>
    <h3 class="result-title">${title}</h3>
    <p class="result-subtitle">${subtitle}</p>
    ${renderMetrics(metrics)}
    ${renderStatus(statuses)}
  `;
};

const infoWall = () => {
  $('#wallInfo').innerHTML = `
    <h3>Dasar SNI 2847:2019 - Dinding geser</h3>
    <div class="reference-grid">
      <div class="reference-item"><strong>Pasal 11.3.1.1</strong><span>Tebal minimum dinding mengikuti Tabel 11.3.1.1; dinding lebih tipis hanya boleh jika analisis menunjukkan kekuatan dan stabilitas cukup.</span></div>
      <div class="reference-item"><strong>Pasal 18.10.2.1</strong><span>Dinding struktural khusus memakai rasio tulangan badan terdistribusi minimal 0,0025 pada arah longitudinal dan transversal, dengan spasi tiap arah maksimal 450 mm.</span></div>
      <div class="reference-item"><strong>Pasal 18.10.2.2</strong><span>Dua lapis tulangan diperlukan bila geser desain melewati batas tertentu atau hw/lw minimal 2,0.</span></div>
      <div class="reference-item"><strong>Pasal 18.10.4.1</strong><span>Kekuatan geser nominal dinding struktural dihitung dari Acv, alpha c, lambda, f'c, rho t, dan fy.</span></div>
    </div>
    <div class="formula-box">
      <code>Dinding tumpu: hmin = max(100 mm, min(l tidak tertumpu, hw) / 25)</code>
      <code>Dinding bukan tumpu: hmin = max(100 mm, min(l tidak tertumpu, hw) / 30)</code>
      <code>Vn = Acv (&alpha;c &lambda; sqrt(f'c) + &rho;t fy)</code>
      <code>&alpha;c = 0,25 untuk hw/lw &le; 1,5; 0,17 untuk hw/lw &ge; 2,0; interpolasi linier di antaranya</code>
    </div>
    <div class="sni-table-wrap">
      <table class="sni-table">
        <thead><tr><th>Item</th><th>Nilai ringkas</th><th>Rujukan</th></tr></thead>
        <tbody>
          <tr><td>Dinding tumpu</td><td>max 100 mm dan 1/25 nilai terkecil panjang/tinggi tidak tertumpu</td><td>Tabel 11.3.1.1</td></tr>
          <tr><td>Dinding bukan tumpu</td><td>max 100 mm dan 1/30 nilai terkecil panjang/tinggi tidak tertumpu</td><td>Tabel 11.3.1.1</td></tr>
          <tr><td>Basemen/fondasi eksterior</td><td>190 mm</td><td>Tabel 11.3.1.1</td></tr>
          <tr><td>Tulangan dinding khusus</td><td>&rho;l dan &rho;t minimal 0,0025; spasi maksimal 450 mm</td><td>18.10.2.1</td></tr>
        </tbody>
      </table>
    </div>
  `;
};

const alphaWall = ratio => {
  if (ratio <= 1.5) return 0.25;
  if (ratio >= 2) return 0.17;
  return 0.25 - ((ratio - 1.5) / 0.5) * 0.08;
};
const calculateWall = () => {
  const type = $('#wallType').value;
  const hw = getNumber('#wallHeight', 0) * 1000;
  const lw = getNumber('#wallLength', 0) * 1000;
  const fc = getNumber('#wallFc', 25);
  const fy = getNumber('#wallFy', 420);
  const vu = getNumber('#wallVu', 0);
  const rho = getNumber('#wallRho', 0.25) / 100;
  const lambda = getNumber('#wallLambda', 1);
  if (hw <= 0 || lw <= 0 || fc <= 0 || fy <= 0 || lambda <= 0) return;
  const clearMin = Math.min(hw, lw);
  let hMin = 190;
  let formula = '190 mm';
  if (type === 'bearing') {
    hMin = Math.max(100, clearMin / 25);
    formula = 'max(100 mm, min(lw, hw)/25)';
  } else if (type === 'nonbearing') {
    hMin = Math.max(100, clearMin / 30);
    formula = 'max(100 mm, min(lw, hw)/30)';
  }
  const hRec = ceilTo(hMin, 25);
  const ratio = hw / lw;
  const alpha = alphaWall(ratio);
  const acv = hRec * lw;
  const vn = acv * (alpha * lambda * Math.sqrt(fc) + rho * fy) / 1000;
  const reduceLimit = 0.083 * lambda * Math.sqrt(fc) * acv / 1000;
  const twoLayerLimit = 0.17 * lambda * Math.sqrt(fc) * acv / 1000;
  const needTwoLayers = vu > twoLayerLimit || ratio >= 2;
  $('#wallResult').innerHTML = `
    <span class="result-kicker">Rekomendasi awal</span>
    <h3 class="result-title">t ${format(hRec)} mm</h3>
    <p class="result-subtitle">Tebal minimum dari ${formula}; rasio hw/lw = ${formatFlex(ratio)}.</p>
    ${renderMetrics([
      { label: 'h minimum tabel', value: `${format(hMin)} mm` },
      { label: 'Acv awal', value: `${format(acv)} mm2` },
      { label: 'alpha c', value: formatFlex(alpha) },
      { label: 'Vn nominal awal', value: `${format(vn)} kN` }
    ])}
    ${renderStatus([
      { type: rho >= 0.0025 ? 'ok' : 'warn', text: `rho t asumsi ${formatFlex(rho * 100)}% ${rho >= 0.0025 ? '&ge;' : '<'} 0,25% minimum Pasal 18.10.2.1.` },
      { type: vu <= vn ? 'ok' : 'warn', text: `Cek nominal awal: Vu ${format(vu)} kN ${vu <= vn ? '&le;' : '>'} Vn ${format(vn)} kN. Desain final tetap perlu faktor reduksi kekuatan.` },
      { type: needTwoLayers ? 'warn' : 'ok', text: needTwoLayers ? `Dua lapis tulangan disarankan/diperlukan karena Vu melewati ${format(twoLayerLimit)} kN atau hw/lw &ge; 2,0.` : `Satu lapis masih lolos cek awal Pasal 18.10.2.2; tetap verifikasi detailing final.` },
      { type: vu <= reduceLimit ? 'ok' : 'warn', text: `Batas reduksi rho menurut 18.10.2.1: ${format(reduceLimit)} kN. ${vu <= reduceLimit ? 'Vu berada di bawah batas ini.' : 'Gunakan rho minimum dinding khusus untuk preliminary.'}` }
    ])}
  `;
};

const bindLiveForm = (formSelector, calculate) => {
  const form = $(formSelector);
  form?.addEventListener('submit', event => {
    event.preventDefault();
    calculate();
  });
  form?.querySelectorAll('input, select').forEach(control => {
    control.addEventListener('input', calculate);
    control.addEventListener('change', calculate);
  });
};

infoColumn();
infoBeam();
infoSlab();
infoWall();
bindLiveForm('#columnForm', calculateColumn);
bindLiveForm('#beamForm', calculateBeam);
bindLiveForm('#slabForm', calculateSlab);
bindLiveForm('#wallForm', calculateWall);
calculateColumn();
calculateBeam();
calculateSlab();
calculateWall();
