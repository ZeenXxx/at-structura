const $ = selector => document.querySelector(selector);
const format = (value, digits = 0) => new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits
}).format(value);
const formatFlex = value => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(value);
const getNumber = (id, fallback = 0) => {
  const value = Number($(id)?.value);
  return Number.isFinite(value) ? value : fallback;
};
const areaBar = dia => Math.PI * dia * dia / 4;
const ceilTo = (value, step = 25) => Math.ceil(value / step) * step;
const renderMetrics = metrics => `
  <div class="metric-grid">
    ${metrics.map(item => `<div class="metric"><span>${item.label}</span><strong>${item.value}</strong></div>`).join('')}
  </div>
`;
const renderStatus = items => `<ul class="status-list">${items.map(item => `<li class="${item.type || 'ok'}">${item.text}</li>`).join('')}</ul>`;

const solveAsRequired = ({ mu, phi, fy, fc, b, d }) => {
  const mnReq = mu * 1e6 / phi;
  const a = fy * fy / (2 * 0.85 * fc * b);
  const discriminant = d * d - 4 * a * (mnReq / fy);
  if (discriminant < 0) return null;
  return (d - Math.sqrt(discriminant)) / (2 * a);
};

const calculate = () => {
  const b = getNumber('#beamB', 300);
  const h = getNumber('#beamH', 500);
  const cover = getNumber('#beamCover', 60);
  const d = h - cover;
  const fc = getNumber('#beamFc', 25);
  const fy = getNumber('#beamFy', 420);
  const fyt = getNumber('#beamFyt', 420);
  const mu = getNumber('#beamMu', 0);
  const vu = getNumber('#beamVu', 0);
  const lambda = getNumber('#beamLambda', 1);
  const barDia = getNumber('#beamBarDia', 16);
  const stirrupDia = getNumber('#beamStirrupDia', 8);
  const stirrupLegs = getNumber('#beamStirrupLegs', 2);
  const phiFlexure = 0.9;
  const phiShear = 0.75;

  if (b <= 0 || h <= 0 || d <= 0 || fc <= 0 || fy <= 0 || fyt <= 0 || mu < 0 || vu < 0 || lambda <= 0) return;

  const asStrength = solveAsRequired({ mu, phi: phiFlexure, fy, fc, b, d });
  const asMinA = 0.25 * Math.sqrt(fc) * b * d / fy;
  const asMinB = 1.4 * b * d / fy;
  const asMin = Math.max(asMinA, asMinB);
  const asReq = asStrength === null ? Infinity : Math.max(asStrength, asMin);
  const singleBarArea = areaBar(barDia);
  const barCount = Number.isFinite(asReq) ? Math.max(2, Math.ceil(asReq / singleBarArea)) : 0;
  const asProvided = barCount * singleBarArea;
  const aBlock = asProvided * fy / (0.85 * fc * b);
  const mn = asProvided * fy * (d - aBlock / 2) / 1e6;
  const phiMn = phiFlexure * mn;

  const vc = 0.17 * lambda * Math.sqrt(fc) * b * d / 1000;
  const vsReq = Math.max(0, vu / phiShear - vc);
  const av = stirrupLegs * areaBar(stirrupDia);
  const avMinPerS = Math.max(0.062 * Math.sqrt(fc) * b / fyt, 0.35 * b / fyt);
  const avPerSReq = vsReq > 0 ? vsReq * 1000 / (fyt * d) : 0;
  const avPerSUse = Math.max(avPerSReq, vu > 0.5 * phiShear * vc ? avMinPerS : 0);
  const spacingCalc = avPerSUse > 0 ? av / avPerSUse : 300;
  const spacingRecommended = Math.min(300, ceilTo(spacingCalc, 25) > spacingCalc ? ceilTo(spacingCalc, 25) - 25 : ceilTo(spacingCalc, 25));
  const safeSpacing = Math.max(75, spacingRecommended);
  const vsProvided = av * fyt * d / safeSpacing / 1000;
  const phiVn = phiShear * (vc + vsProvided);
  const sizeLimit = phiShear * (vc + 0.66 * Math.sqrt(fc) * b * d / 1000);

  const status = [
    {
      type: asStrength === null ? 'warn' : 'ok',
      text: asStrength === null ? 'Mu terlalu besar untuk penampang bertulangan tunggal ini. Perbesar dimensi atau gunakan tulangan tekan.' : `Cek lentur: phi Mn = ${format(phiMn)} kNm ${phiMn >= mu ? '&ge;' : '<'} Mu = ${format(mu)} kNm.`
    },
    {
      type: asProvided >= asMin ? 'ok' : 'warn',
      text: `As pakai = ${format(asProvided)} mm2; As,min = max(${format(asMinA)}, ${format(asMinB)}) = ${format(asMin)} mm2.`
    },
    {
      type: phiVn >= vu ? 'ok' : 'warn',
      text: `Cek geser: phi Vn = ${format(phiVn)} kN ${phiVn >= vu ? '&ge;' : '<'} Vu = ${format(vu)} kN.`
    },
    {
      type: vu <= sizeLimit ? 'ok' : 'warn',
      text: `Batas dimensi 22.5.1.2: Vu ${format(vu)} kN terhadap batas sekitar ${format(sizeLimit)} kN.`
    }
  ];

  $('#beamRebarResult').innerHTML = `
    <span class="result-kicker">Rekomendasi tulangan</span>
    <h3 class="result-title">${barCount ? `${barCount}D${barDia}` : 'Perbesar penampang'}</h3>
    <p class="result-subtitle">Sengkang awal: ${stirrupLegs} kaki D${stirrupDia} - ${format(safeSpacing)} mm.</p>
    ${renderMetrics([
      { label: 'd efektif', value: `${format(d)} mm` },
      { label: 'As perlu', value: Number.isFinite(asReq) ? `${format(asReq)} mm2` : 'Tidak cukup' },
      { label: 'As pakai', value: `${format(asProvided)} mm2` },
      { label: 'Vc beton', value: `${format(vc)} kN` },
      { label: 'Vs perlu', value: `${format(vsReq)} kN` },
      { label: 'Av/s pakai', value: `${formatFlex(av / safeSpacing)} mm2/mm` }
    ])}
    ${renderStatus(status)}
  `;
};

$('#beamRebarInfo').innerHTML = `
  <h3>Dasar SNI 2847:2019 - Tulangan balok</h3>
  <div class="reference-grid">
    <div class="reference-item"><strong>Pasal 22.3.1.1</strong><span>Kekuatan lentur nominal Mn dihitung dengan asumsi desain Pasal 22.2.</span></div>
    <div class="reference-item"><strong>Pasal 9.6.1.2</strong><span>As,min balok nonprategang diambil dari nilai terbesar dua persamaan minimum.</span></div>
    <div class="reference-item"><strong>Pasal 22.5.5.1</strong><span>Vc balok nonprategang tanpa gaya aksial dapat dihitung dengan 0,17 lambda sqrt(f'c) bw d.</span></div>
    <div class="reference-item"><strong>Pasal 22.5.10.5.3</strong><span>Vs sengkang tegak lurus dihitung dari Av fyt d / s.</span></div>
  </div>
  <div class="formula-box">
    <code>Mn = As fy (d - a/2)</code>
    <code>a = As fy / (0,85 f'c bw)</code>
    <code>As,min = max(0,25 sqrt(f'c) bw d / fy ; 1,4 bw d / fy)</code>
    <code>Vc = 0,17 lambda sqrt(f'c) bw d</code>
    <code>Vs = Av fyt d / s</code>
    <code>Av,min/s = max(0,062 sqrt(f'c) bw / fyt ; 0,35 bw / fyt)</code>
  </div>
  <div class="sni-table-wrap">
    <table class="sni-table">
      <thead><tr><th>Cek</th><th>Ketentuan ringkas</th><th>Rujukan</th></tr></thead>
      <tbody>
        <tr><td>Lentur</td><td>phi Mn harus minimal Mu</td><td>22.3 dan 21.2.2</td></tr>
        <tr><td>As minimum</td><td>Nilai terbesar dari dua rumus As,min</td><td>9.6.1.2</td></tr>
        <tr><td>Av minimum</td><td>Diperlukan saat Vu > 0,5 phi Vc, kecuali kasus tertentu</td><td>9.6.3.1</td></tr>
        <tr><td>Geser</td><td>Vn = Vc + Vs</td><td>22.5.1.1</td></tr>
      </tbody>
    </table>
  </div>
  <p class="note-small">Tool ini belum menggantikan desain lengkap. Gunakan hasilnya sebagai draft cepat sebelum cek detailing, jarak bersih tulangan, panjang penyaluran, torsi, dan ketentuan gempa.</p>
`;

$('#beamRebarForm').addEventListener('submit', event => {
  event.preventDefault();
  calculate();
});
$('#beamRebarForm').querySelectorAll('input, select').forEach(input => {
  input.addEventListener('input', calculate);
  input.addEventListener('change', calculate);
});
calculate();
