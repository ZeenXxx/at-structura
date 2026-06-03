const tabs = document.querySelectorAll('[data-tool-tab]');
const panels = document.querySelectorAll('.tool-panel');
const toast = document.getElementById('toast');

const showToast = message => {
  if (!toast) return alert(message);
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3200);
};

const slug = value => String(value || 'at-structura-file').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'at-structura-file';
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
const setActiveTool = id => {
  tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.toolTab === id));
  panels.forEach(panel => panel.classList.toggle('active', panel.id === 'tool-' + id));
};
tabs.forEach(tab => tab.addEventListener('click', () => { const id = tab.dataset.toolTab; setActiveTool(id); history.replaceState(null, '', '#' + id); }));
const initial = location.hash.replace('#', '');
if (initial && document.getElementById('tool-' + initial)) setActiveTool(initial);

const sup2 = String.fromCharCode(178);
const sup3 = String.fromCharCode(179);
const unit = factor => ({ toBase: value => value * factor, fromBase: value => value / factor });
const tempUnit = (toKelvin, fromKelvin) => ({ toBase: toKelvin, fromBase: fromKelvin });
const conversions = {
  length: { label: 'Panjang / Distance', base: 'm', units: { nm: unit(1e-9), micron: unit(1e-6), mm: unit(0.001), cm: unit(0.01), m: unit(1), km: unit(1000), inch: unit(0.0254), ft: unit(0.3048), yd: unit(0.9144), mile: unit(1609.344), nautical_mile: unit(1852) } },
  area: { label: 'Luas / Area', base: 'm' + sup2, units: { ['mm' + sup2]: unit(1e-6), ['cm' + sup2]: unit(0.0001), ['m' + sup2]: unit(1), are: unit(100), ha: unit(10000), ['km' + sup2]: unit(1000000), ['in' + sup2]: unit(0.00064516), ['ft' + sup2]: unit(0.09290304), ['yd' + sup2]: unit(0.83612736), acre: unit(4046.8564224) } },
  volume: { label: 'Volume', base: 'm' + sup3, units: { mL: unit(0.000001), liter: unit(0.001), ['cm' + sup3]: unit(0.000001), ['m' + sup3]: unit(1), ['in' + sup3]: unit(0.000016387064), ['ft' + sup3]: unit(0.028316846592), ['yd' + sup3]: unit(0.764554857984), gal_US: unit(0.003785411784), gal_UK: unit(0.00454609), barrel_oil: unit(0.158987294928) } },
  mass: { label: 'Massa / Weight', base: 'kg', units: { mg: unit(0.000001), g: unit(0.001), kg: unit(1), ton_metric: unit(1000), oz: unit(0.028349523125), lb: unit(0.45359237), kip_mass: unit(453.59237), ton_US: unit(907.18474), ton_UK: unit(1016.0469088) } },
  force: { label: 'Gaya / Force', base: 'N', units: { N: unit(1), kN: unit(1000), MN: unit(1000000), gf: unit(0.00980665), kgf: unit(9.80665), tonf: unit(9806.65), lbf: unit(4.4482216152605), kip: unit(4448.2216152605) } },
  moment: { label: 'Momen / Torsi', base: 'N.m', units: { 'N.m': unit(1), 'kN.m': unit(1000), 'kgf.m': unit(9.80665), 'tonf.m': unit(9806.65), 'lbf.ft': unit(1.3558179483314), 'kip.ft': unit(1355.8179483314), 'lbf.in': unit(0.11298482902762), 'kip.in': unit(112.98482902762) } },
  pressure: { label: 'Tekanan / Tegangan', base: 'Pa', units: { Pa: unit(1), kPa: unit(1000), MPa: unit(1000000), GPa: unit(1000000000), ['N/mm' + sup2]: unit(1000000), bar: unit(100000), mbar: unit(100), atm: unit(101325), psi: unit(6894.757293168), ksi: unit(6894757.293168), psf: unit(47.8802589803), ['kg/cm' + sup2]: unit(98066.5), ['tf/m' + sup2]: unit(9806.65) } },
  density: { label: 'Massa jenis / Density', base: 'kg/m' + sup3, units: { ['kg/m' + sup3]: unit(1), ['g/cm' + sup3]: unit(1000), ['ton/m' + sup3]: unit(1000), ['lb/ft' + sup3]: unit(16.01846337396), pcf: unit(16.01846337396) } },
  unitWeight: { label: 'Berat isi / Unit weight', base: 'kN/m' + sup3, units: { ['N/m' + sup3]: unit(0.001), ['kN/m' + sup3]: unit(1), ['kgf/m' + sup3]: unit(0.00980665), ['tf/m' + sup3]: unit(9.80665), pcf: unit(0.157087464), ['lb/ft' + sup3]: unit(0.157087464) } },
  velocity: { label: 'Kecepatan', base: 'm/s', units: { 'mm/s': unit(0.001), 'cm/s': unit(0.01), 'm/s': unit(1), 'm/min': unit(1 / 60), 'km/h': unit(0.27777777777778), 'ft/s': unit(0.3048), 'ft/min': unit(0.00508), mph: unit(0.44704), knot: unit(0.51444444444444) } },
  flow: { label: 'Debit / Flow rate', base: 'm' + sup3 + '/s', units: { 'L/s': unit(0.001), 'L/min': unit(0.001 / 60), ['m' + sup3 + '/s']: unit(1), ['m' + sup3 + '/min']: unit(1 / 60), ['m' + sup3 + '/h']: unit(1 / 3600), cfs: unit(0.028316846592), gpm_US: unit(0.0000630901964), MGD_US: unit(0.0438126364) } },
  acceleration: { label: 'Percepatan', base: 'm/s' + sup2, units: { ['m/s' + sup2]: unit(1), ['cm/s' + sup2]: unit(0.01), gal: unit(0.01), g: unit(9.80665), ['ft/s' + sup2]: unit(0.3048) } },
  energy: { label: 'Energi / Kerja', base: 'J', units: { J: unit(1), kJ: unit(1000), MJ: unit(1000000), Wh: unit(3600), kWh: unit(3600000), cal: unit(4.184), kcal: unit(4184), BTU: unit(1055.05585262), 'ft.lbf': unit(1.3558179483314) } },
  power: { label: 'Daya / Power', base: 'W', units: { W: unit(1), kW: unit(1000), MW: unit(1000000), hp_metric: unit(735.49875), hp_mechanical: unit(745.69987158227), 'BTU/h': unit(0.29307107017222), 'ft.lbf/s': unit(1.3558179483314) } },
  temperature: { label: 'Temperatur', base: 'K', units: { C: tempUnit(value => value + 273.15, value => value - 273.15), K: tempUnit(value => value, value => value), F: tempUnit(value => (value - 32) * 5 / 9 + 273.15, value => (value - 273.15) * 9 / 5 + 32), R: tempUnit(value => value * 5 / 9, value => value * 9 / 5) } },
  slope: { label: 'Kemiringan / Slope', base: 'ratio', units: { ratio: unit(1), percent: unit(0.01), permille: unit(0.001), 'degree_tan': { toBase: value => Math.tan(value * Math.PI / 180), fromBase: value => Math.atan(value) * 180 / Math.PI } } },
  rebar: { label: 'Berat besi tulangan', base: 'kg/m', units: { 'D8 kg/m': unit(0.395), 'D10 kg/m': unit(0.617), 'D12 kg/m': unit(0.888), 'D13 kg/m': unit(1.042), 'D16 kg/m': unit(1.58), 'D19 kg/m': unit(2.23), 'D22 kg/m': unit(2.98), 'D25 kg/m': unit(3.85), 'D29 kg/m': unit(5.04), 'D32 kg/m': unit(6.31) } }
};
const conversionType = document.getElementById('conversionType');
const fromUnit = document.getElementById('fromUnit');
const toUnit = document.getElementById('toUnit');
const conversionValue = document.getElementById('conversionValue');
const conversionResult = document.getElementById('conversionResult');
const populateOptions = select => { select.innerHTML = Object.entries(conversions).map(([key, item]) => '<option value="' + key + '">' + item.label + '</option>').join(''); };
const populateUnits = () => { const selected = conversions[conversionType.value]; const options = Object.keys(selected.units).map(unit => '<option>' + unit + '</option>').join(''); fromUnit.innerHTML = options; toUnit.innerHTML = options; if (toUnit.options[1]) toUnit.value = toUnit.options[1].value; };
const formatNumber = number => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 6 }).format(number);
const formatInputNumber = number => String(Number(number.toFixed(6))).replace(',', '.');
const convert = () => {
  const selected = conversions[conversionType.value];
  const value = Number(conversionValue.value);
  if (!Number.isFinite(value)) return showToast('Masukkan nilai angka yang valid.');
  const baseValue = selected.units[fromUnit.value].toBase(value);
  const result = selected.units[toUnit.value].fromBase(baseValue);
  conversionResult.innerHTML = '<span>Hasil</span><strong>' + formatNumber(result) + ' ' + toUnit.value + '</strong><p>' + formatNumber(value) + ' ' + fromUnit.value + ' = ' + formatNumber(result) + ' ' + toUnit.value + '</p>';
};
populateOptions(conversionType); populateUnits(); convert();
conversionType.addEventListener('change', () => { populateUnits(); convert(); });
document.getElementById('convertBtn').addEventListener('click', convert);
[fromUnit, toUnit, conversionValue].forEach(input => input.addEventListener('input', convert));

const kmlFileInput = document.getElementById('kmlKmzFile');
const kmlPreview = document.getElementById('kmlCsvPreview');
const kmlUseTerrainAltInput = document.getElementById('kmlUseTerrainAlt');
const kmlIncludeIndexInput = document.getElementById('kmlIncludeIndex');
const kmlOutputFormatInput = document.getElementById('kmlOutputFormat');
let latestKmlResult = null;
const numberText = value => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return String(Number(number.toFixed(9))).replace(/\.0+$/, '');
};
const metricText = value => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return String(Number(number.toFixed(3)));
};
const latLonToUtm = (lat, lon) => {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;
  const eSq = f * (2 - f);
  const ePrimeSq = eSq / (1 - eSq);
  const zone = Math.floor((lon + 180) / 6) + 1;
  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;
  const lonOriginRad = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const tanLat = Math.tan(latRad);
  const n = a / Math.sqrt(1 - eSq * sinLat * sinLat);
  const t = tanLat * tanLat;
  const c = ePrimeSq * cosLat * cosLat;
  const aa = cosLat * (lonRad - lonOriginRad);
  const m = a * (
    (1 - eSq / 4 - 3 * eSq * eSq / 64 - 5 * eSq * eSq * eSq / 256) * latRad
    - (3 * eSq / 8 + 3 * eSq * eSq / 32 + 45 * eSq * eSq * eSq / 1024) * Math.sin(2 * latRad)
    + (15 * eSq * eSq / 256 + 45 * eSq * eSq * eSq / 1024) * Math.sin(4 * latRad)
    - (35 * eSq * eSq * eSq / 3072) * Math.sin(6 * latRad)
  );
  const easting = k0 * n * (aa + (1 - t + c) * Math.pow(aa, 3) / 6 + (5 - 18 * t + t * t + 72 * c - 58 * ePrimeSq) * Math.pow(aa, 5) / 120) + 500000;
  let northing = k0 * (m + n * tanLat * (aa * aa / 2 + (5 - t + 9 * c + 4 * c * c) * Math.pow(aa, 4) / 24 + (61 - 58 * t + t * t + 600 * c - 330 * ePrimeSq) * Math.pow(aa, 6) / 720));
  if (lat < 0) northing += 10000000;
  return { easting, northing, zone };
};
const kmlSettingsKey = file => JSON.stringify({
  name: file?.name || '',
  size: file?.size || 0,
  lastModified: file?.lastModified || 0,
  defaultAlt: document.getElementById('kmlAltDefault')?.value || '0',
  terrain: Boolean(kmlUseTerrainAltInput?.checked),
  includeIndex: Boolean(kmlIncludeIndexInput?.checked),
  format: kmlOutputFormatInput?.value || 'plla'
});
const kmlCsvLine = (row, index) => {
  const format = kmlOutputFormatInput?.value || 'plla';
  const point = String(index + 1);
  if (format === 'penz' || format === 'pnez') {
    const utm = latLonToUtm(Number(row[0]), Number(row[1]));
    const values = format === 'penz'
      ? [metricText(utm.easting), metricText(utm.northing), metricText(row[2])]
      : [metricText(utm.northing), metricText(utm.easting), metricText(row[2])];
    return (kmlIncludeIndexInput?.checked ? [point, ...values] : values).join(',');
  }
  const values = row.map(numberText);
  return (kmlIncludeIndexInput?.checked ? [String(index + 1), ...values] : values).join(',');
};
const readKmlText = async file => {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'kml') return file.text();
  if (ext !== 'kmz') throw new Error('INVALID_KML_TYPE');
  if (!window.JSZip) throw new Error('ZIP_NOT_READY');
  const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).filter(item => !item.dir && /\.kml$/i.test(item.name));
  if (!entries.length) throw new Error('KML_NOT_FOUND');
  const preferred = entries.find(item => /(^|\/)doc\.kml$/i.test(item.name)) || entries[0];
  return preferred.async('text');
};
const parseKmlCoordinates = (text, defaultAlt = 0) => {
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('INVALID_KML');
  const coordinateRows = [];
  const trackRows = [];
  const pushRow = (target, lon, lat, alt) => {
    const safeAlt = Number.isFinite(alt) ? alt : Number(defaultAlt);
    if (Number.isFinite(lat) && Number.isFinite(lon)) target.push([lat, lon, Number.isFinite(safeAlt) ? safeAlt : 0]);
  };
  xml.querySelectorAll('coordinates').forEach(node => {
    String(node.textContent || '').trim().split(/\s+/).forEach(chunk => {
      const parts = chunk.split(',').map(part => part.trim());
      if (parts.length < 2) return;
      const lon = Number(parts[0]);
      const lat = Number(parts[1]);
      const alt = parts[2] === undefined || parts[2] === '' ? Number(defaultAlt) : Number(parts[2]);
      pushRow(coordinateRows, lon, lat, alt);
    });
  });
  const trackNodes = [
    ...xml.querySelectorAll('gx\\:coord, coord'),
    ...Array.from(xml.getElementsByTagNameNS('*', 'coord')),
    ...Array.from(xml.getElementsByTagName('gx:coord'))
  ];
  [...new Set(trackNodes)].forEach(node => {
    const parts = String(node.textContent || '').trim().split(/\s+/).map(Number);
    if (parts.length < 2) return;
    const [lon, lat, alt = defaultAlt] = parts;
    pushRow(trackRows, lon, lat, alt);
  });
  const hasRealAltitude = rows => rows.some(row => Math.abs(Number(row[2])) > 1e-9);
  if (hasRealAltitude(trackRows)) return trackRows;
  if (hasRealAltitude(coordinateRows)) return coordinateRows;
  return coordinateRows.length ? coordinateRows : trackRows;
};
const fetchTerrainElevations = async rows => {
  const targets = rows
    .map((row, index) => ({ row, index }))
    .filter(item => Math.abs(Number(item.row[2])) <= 1e-9);
  if (!targets.length) return { rows, filled: 0 };
  const updatedRows = rows.map(row => [...row]);
  let filled = 0;

  const applyElevations = elevations => {
    (elevations || []).forEach((alt, offset) => {
      const target = targets[offset];
      const elevation = Number(alt);
      if (target && Number.isFinite(elevation)) {
        updatedRows[target.index][2] = elevation;
        filled += 1;
      }
    });
  };

  const fetchFromProxy = async () => {
    const response = await fetch('#elevation-disabled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: targets.map(item => [item.row[0], item.row[1]]) })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || 'ELEVATION_FAILED');
    applyElevations(payload.elevations);
  };

  const fetchDirect = async () => {
    for (let start = 0; start < targets.length; start += 80) {
      const batch = targets.slice(start, start + 80);
      const latitudes = batch.map(item => numberText(item.row[0])).join(',');
      const longitudes = batch.map(item => numberText(item.row[1])).join(',');
      const url = 'https://api.open-meteo.com/v1/elevation?latitude=' + encodeURIComponent(latitudes) + '&longitude=' + encodeURIComponent(longitudes);
      const response = await fetch(url);
      if (!response.ok) throw new Error('ELEVATION_FAILED');
      const payload = await response.json();
      applyElevations(Array.isArray(payload.elevation) ? payload.elevation : []);
    }
  };

  try {
    await fetchDirect();
  } catch (error) {
    console.warn('Elevation proxy failed, trying direct API:', error);
    await fetchDirect();
  }
  return { rows: updatedRows, filled };
};
const getCivil3dRows = async () => {
  const file = kmlFileInput?.files?.[0];
  if (!file) throw new Error('NO_KML_FILE');
  const settingsKey = kmlSettingsKey(file);
  if (latestKmlResult?.settingsKey === settingsKey) return latestKmlResult;
  const defaultAlt = Number(document.getElementById('kmlAltDefault')?.value || 0);
  let rows = parseKmlCoordinates(await readKmlText(file), Number.isFinite(defaultAlt) ? defaultAlt : 0);
  if (!rows.length) throw new Error('NO_COORDINATES');
  let filled = 0;
  if (kmlUseTerrainAltInput?.checked) {
    const result = await fetchTerrainElevations(rows);
    rows = result.rows;
    filled = result.filled;
  }
  latestKmlResult = { file, rows, filled, settingsKey };
  return latestKmlResult;
};
const renderKmlPreview = (rows, filled = 0) => {
  const previewRows = rows.slice(0, 8).map((row, index) => kmlCsvLine(row, index)).join('\n');
  const filledText = filled ? ' ' + filled + ' ALT 0/kosong diisi dari DEM elevasi.' : '';
  const format = kmlOutputFormatInput?.value || 'plla';
  const formatText = {
    plla: kmlIncludeIndexInput?.checked ? 'Point, Latitude, Longitude, Altitude' : 'Latitude, Longitude, Altitude',
    penz: kmlIncludeIndexInput?.checked ? 'Point, Easting, Northing, Z' : 'Easting, Northing, Z',
    pnez: kmlIncludeIndexInput?.checked ? 'Point, Northing, Easting, Z' : 'Northing, Easting, Z'
  }[format];
  const utmText = format === 'plla' ? '' : ' Koordinat Easting/Northing memakai UTM WGS84 otomatis dari longitude/latitude.';
  kmlPreview.innerHTML = '<h3>Preview CSV Civil 3D</h3><p>' + rows.length + ' titik ditemukan. Output: ' + formatText + ' tanpa header.' + utmText + filledText + '</p><pre>' + previewRows + (rows.length > 8 ? '\n...' : '') + '</pre>';
};
document.getElementById('kmlPreviewBtn')?.addEventListener('click', async () => {
  try {
    const { rows, filled } = await getCivil3dRows();
    renderKmlPreview(rows, filled);
    showToast(rows.length + ' titik berhasil dibaca' + (filled ? ', ' + filled + ' ALT diisi otomatis.' : '.') );
  } catch (error) {
    console.error(error);
    if (error.message === 'NO_KML_FILE') return showToast('Pilih file KML atau KMZ terlebih dahulu.');
    if (error.message === 'ZIP_NOT_READY') return showToast('Library KMZ belum siap. Coba ulang beberapa detik lagi.');
    if (error.message === 'KML_NOT_FOUND') return showToast('KMZ tidak berisi file KML.');
    if (error.message === 'NO_COORDINATES') return showToast('Tidak ada koordinat LAT LONG ALT yang bisa dibaca.');
    if (error.message === 'ELEVATION_FAILED') return showToast('Gagal mengambil elevasi terrain. Coba ulang atau matikan opsi elevasi otomatis.');
    showToast('Gagal membaca file KML/KMZ.');
  }
});
document.getElementById('kmlCsvBtn')?.addEventListener('click', async () => {
  try {
    const { file, rows, filled } = await getCivil3dRows();
    const csv = rows.map((row, index) => kmlCsvLine(row, index)).join('\r\n');
    const format = kmlOutputFormatInput?.value || 'plla';
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), slug(file.name.replace(/\.(kml|kmz)$/i, '')) + '-' + format + '-civil3d.csv');
    renderKmlPreview(rows, filled);
    showToast('CSV Civil 3D berhasil dibuat' + (filled ? ' dengan ALT terrain.' : '.') );
  } catch (error) {
    console.error(error);
    if (error.message === 'NO_KML_FILE') return showToast('Pilih file KML atau KMZ terlebih dahulu.');
    if (error.message === 'ZIP_NOT_READY') return showToast('Library KMZ belum siap. Coba ulang beberapa detik lagi.');
    if (error.message === 'KML_NOT_FOUND') return showToast('KMZ tidak berisi file KML.');
    if (error.message === 'NO_COORDINATES') return showToast('Tidak ada koordinat LAT LONG ALT yang bisa dibaca.');
    if (error.message === 'ELEVATION_FAILED') return showToast('Gagal mengambil elevasi terrain. Coba ulang atau matikan opsi elevasi otomatis.');
    showToast('Gagal membuat CSV Civil 3D.');
  }
});

const spectrumInputIds = ['spectrumLocation', 'spectrumSs', 'spectrumS1', 'spectrumFa', 'spectrumFv', 'spectrumTL', 'spectrumStep', 'spectrumTmax'];
const spectrumSiteClassInput = document.getElementById('spectrumSiteClass');
const spectrumTxtBtn = document.getElementById('spectrumTxtBtn');
const spectrumChartBtn = document.getElementById('spectrumChartBtn');
let latestSpectrumResult = null;
const setSpectrumDownloadsEnabled = enabled => {
  if (spectrumTxtBtn) spectrumTxtBtn.disabled = !enabled;
  if (spectrumChartBtn) spectrumChartBtn.disabled = !enabled;
};
const spectrumSiteTables = {
  fa: {
    x: [0.25, 0.5, 0.75, 1, 1.25, 1.5],
    SA: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
    SB: [0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
    SC: [1.3, 1.3, 1.2, 1.2, 1.2, 1.2],
    SD: [1.6, 1.4, 1.2, 1.1, 1, 1],
    SE: [2.4, 1.7, 1.3, 1.1, 0.9, 0.8]
  },
  fv: {
    x: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
    SA: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
    SB: [0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
    SC: [1.5, 1.5, 1.5, 1.5, 1.5, 1.4],
    SD: [2.4, 2.2, 2, 1.9, 1.8, 1.7],
    SE: [4.2, 3.3, 2.8, 2.4, 2.2, 2]
  }
};
const interpolateSpectrumFactor = (value, points, values) => {
  if (value <= points[0]) return values[0];
  if (value >= points[points.length - 1]) return values[values.length - 1];
  for (let i = 0; i < points.length - 1; i += 1) {
    const x1 = points[i];
    const x2 = points[i + 1];
    if (value >= x1 && value <= x2) {
      const ratio = (value - x1) / (x2 - x1);
      return values[i] + ratio * (values[i + 1] - values[i]);
    }
  }
  return values[values.length - 1];
};
const siteClassFactors = (siteClass, ss, s1) => {
  if (!siteClass || siteClass === 'manual') return null;
  if (siteClass === 'SF') throw new Error('SITE_SPECIFIC_REQUIRED');
  const faValues = spectrumSiteTables.fa[siteClass];
  const fvValues = spectrumSiteTables.fv[siteClass];
  if (!faValues || !fvValues) return null;
  return {
    fa: interpolateSpectrumFactor(ss, spectrumSiteTables.fa.x, faValues),
    fv: interpolateSpectrumFactor(s1, spectrumSiteTables.fv.x, fvValues)
  };
};
const syncSpectrumFactorInputs = (fa, fv, readonly = true) => {
  const faInput = document.getElementById('spectrumFa');
  const fvInput = document.getElementById('spectrumFv');
  if (faInput) {
    faInput.value = Number.isFinite(fa) ? formatInputNumber(fa) : faInput.value;
    faInput.readOnly = readonly;
  }
  if (fvInput) {
    fvInput.value = Number.isFinite(fv) ? formatInputNumber(fv) : fvInput.value;
    fvInput.readOnly = readonly;
  }
};
const updateSpectrumFactorMode = () => {
  const siteClass = spectrumSiteClassInput?.value || 'SE';
  const manual = siteClass === 'manual';
  const faInput = document.getElementById('spectrumFa');
  const fvInput = document.getElementById('spectrumFv');
  if (faInput) faInput.readOnly = !manual;
  if (fvInput) fvInput.readOnly = !manual;
};
const getNumericInput = (id, fallback = null) => {
  const raw = document.getElementById(id)?.value;
  if (raw === '' || raw === undefined || raw === null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};
const setInputValue = (id, value) => {
  const input = document.getElementById(id);
  if (!input || value === null || value === undefined || value === '') return false;
  input.value = String(value).replace(',', '.');
  return true;
};
const findParameter = (text, labels) => {
  for (const label of labels) {
    const pattern = new RegExp('(?:^|[^a-z0-9])' + label + '\\s*(?:=|:)?\\s*(-?\\d+(?:[,.]\\d+)?)', 'i');
    const match = text.match(pattern);
    if (match) return match[1].replace(',', '.');
  }
  return null;
};
const parseSpectrumText = () => {
  const raw = document.getElementById('spectrumPaste')?.value || '';
  if (!raw.trim()) return showToast('Tempel teks RSA/Web RSA terlebih dahulu.');
  const normalized = raw.replace(/\u00a0/g, ' ');
  let count = 0;
  if (setInputValue('spectrumSs', findParameter(normalized, ['Ss', 'S_s']))) count += 1;
  if (setInputValue('spectrumS1', findParameter(normalized, ['S1', 'S_1']))) count += 1;
  const hasManualFa = setInputValue('spectrumFa', findParameter(normalized, ['Fa', 'F_a']));
  const hasManualFv = setInputValue('spectrumFv', findParameter(normalized, ['Fv', 'F_v']));
  if (hasManualFa) count += 1;
  if (hasManualFv) count += 1;
  if (setInputValue('spectrumTL', findParameter(normalized, ['TL', 'T_L']))) count += 1;
  const siteClassMatch = normalized.match(/(?:kelas\s*situs|site\s*class|kelas)\s*(?:=|:)?\s*(SA|SB|SC|SD|SE|SF)\b/i);
  if (siteClassMatch && spectrumSiteClassInput) {
    spectrumSiteClassInput.value = siteClassMatch[1].toUpperCase();
    count += 1;
  } else if ((hasManualFa || hasManualFv) && spectrumSiteClassInput) {
    spectrumSiteClassInput.value = 'manual';
  }
  const locationMatch = normalized.match(/(?:lokasi|location|kota|kabupaten)\s*(?:=|:)?\s*([^\n\r,;]+)/i);
  if (locationMatch && setInputValue('spectrumLocation', locationMatch[1].trim())) count += 1;
  latestSpectrumResult = null;
  setSpectrumDownloadsEnabled(false);
  renderSpectrumPreview();
  showToast(count ? count + ' parameter berhasil diambil dari teks.' : 'Belum ada parameter yang terbaca dari teks.');
};
const calculateSpectrum = () => {
  const ss = getNumericInput('spectrumSs');
  const s1 = getNumericInput('spectrumS1');
  const siteClass = spectrumSiteClassInput?.value || 'SE';
  const autoFactors = siteClassFactors(siteClass, ss, s1);
  const fa = autoFactors ? autoFactors.fa : getNumericInput('spectrumFa');
  const fv = autoFactors ? autoFactors.fv : getNumericInput('spectrumFv');
  const tl = getNumericInput('spectrumTL', 6);
  const step = getNumericInput('spectrumStep', 0.05);
  const tMax = getNumericInput('spectrumTmax', 10);
  if (![ss, s1, fa, fv, tl, step, tMax].every(Number.isFinite) || ss <= 0 || s1 <= 0 || fa <= 0 || fv <= 0 || tl <= 0 || step <= 0 || tMax <= 0) throw new Error('INVALID_SPECTRUM_INPUT');
  if (autoFactors) syncSpectrumFactorInputs(fa, fv, true);
  else updateSpectrumFactorMode();
  const sms = fa * ss;
  const sm1 = fv * s1;
  const sds = (2 / 3) * sms;
  const sd1 = (2 / 3) * sm1;
  const t0 = 0.2 * sd1 / sds;
  const ts = sd1 / sds;
  const saAt = t => {
    if (t <= t0) return sds * (0.4 + 0.6 * (t / t0));
    if (t <= ts) return sds;
    if (t <= tl) return sd1 / t;
    return sd1 * tl / (t * t);
  };
  const rows = [];
  for (let t = 0; t <= tMax + 1e-9; t += step) {
    const period = Number(t.toFixed(6));
    rows.push([Number(period.toFixed(4)), Number(saAt(period).toFixed(6))]);
  }
  const finalPeriod = Number(tMax.toFixed(6));
  if (!rows.length || rows[rows.length - 1][0] !== Number(finalPeriod.toFixed(4))) rows.push([Number(finalPeriod.toFixed(4)), Number(saAt(finalPeriod).toFixed(6))]);
  return { ss, s1, siteClass, fa, fv, tl, step, tMax, sms, sm1, sds, sd1, t0, ts, rows };
};
const spectrumTxtNumber = (value, digits) => Number(value).toFixed(digits);
const spectrumTxtContent = result => result.rows
  .map(row => spectrumTxtNumber(row[0], 3) + '\t' + spectrumTxtNumber(row[1], 5))
  .join('\r\n');
const spectrumTableHtml = rows => rows.map(row => (
  '<tr><td>' + spectrumTxtNumber(row[0], 3) + '</td><td>' + spectrumTxtNumber(row[1], 5) + '</td></tr>'
)).join('');
const drawSpectrumChart = (canvas, result) => {
  if (!canvas || !result?.rows?.length) return;
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(720, canvas.clientWidth || 900);
  const height = 420;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const padding = { left: 68, right: 24, top: 38, bottom: 58 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxT = Math.max(...result.rows.map(row => row[0]), result.tMax);
  const maxSaRaw = Math.max(...result.rows.map(row => row[1]), result.sds);
  const maxSa = Math.max(0.1, Math.ceil(maxSaRaw * 10) / 10);
  const x = t => padding.left + (t / maxT) * plotWidth;
  const y = sa => padding.top + plotHeight - (sa / maxSa) * plotHeight;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#d9e5e0';
  ctx.lineWidth = 1;
  ctx.font = '12px Inter, Arial, sans-serif';
  ctx.fillStyle = '#667085';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 5; i += 1) {
    const sa = (maxSa / 5) * i;
    const py = y(sa);
    ctx.beginPath();
    ctx.moveTo(padding.left, py);
    ctx.lineTo(width - padding.right, py);
    ctx.stroke();
    ctx.fillText(spectrumTxtNumber(sa, 2), padding.left - 10, py);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const xTicks = Math.min(6, Math.max(2, Math.round(maxT)));
  for (let i = 0; i <= xTicks; i += 1) {
    const t = (maxT / xTicks) * i;
    const px = x(t);
    ctx.beginPath();
    ctx.moveTo(px, padding.top);
    ctx.lineTo(px, padding.top + plotHeight);
    ctx.stroke();
    ctx.fillText(spectrumTxtNumber(t, 1), px, padding.top + plotHeight + 12);
  }

  ctx.strokeStyle = '#0B2A5B';
  ctx.lineWidth = 3;
  ctx.beginPath();
  result.rows.forEach((row, index) => {
    const px = x(row[0]);
    const py = y(row[1]);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  ctx.fillStyle = '#0B2A5B';
  ctx.font = '700 16px Inter, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Grafik Respons Spektrum', padding.left, 12);
  ctx.font = '12px Inter, Arial, sans-serif';
  ctx.fillStyle = '#667085';
  ctx.fillText('Sa (g)', 16, padding.top - 8);
  ctx.textAlign = 'center';
  ctx.fillText('T (detik)', padding.left + plotWidth / 2, height - 26);
};
const renderSpectrumResult = result => {
  const target = document.getElementById('spectrumPreview');
  if (!target) return;
  const siteText = result.siteClass === 'manual' ? 'Manual Fa/Fv' : 'Kelas situs ' + result.siteClass;
  target.innerHTML =
    '<h3>Hasil respons spektrum</h3>' +
    '<p>' + siteText + ' memakai Fa = ' + formatNumber(result.fa) + ' dan Fv = ' + formatNumber(result.fv) + '. TXT memakai dua kolom tanpa header: T dan Sa(g), dipisahkan tab agar siap import SAP/ETABS.</p>' +
    '<div class="spectrum-summary-grid"><span>SDS: ' + formatNumber(result.sds) + ' g</span><span>SD1: ' + formatNumber(result.sd1) + ' g</span><span>T0: ' + formatNumber(result.t0) + ' s</span><span>Ts: ' + formatNumber(result.ts) + ' s</span></div>' +
    '<div class="spectrum-output">' +
      '<div class="spectrum-chart-wrap"><canvas id="spectrumChart" width="900" height="420" aria-label="Grafik respons spektrum"></canvas></div>' +
      '<div class="spectrum-table-wrap"><table class="spectrum-table"><thead><tr><th>T (detik)</th><th>Sa (g)</th></tr></thead><tbody>' + spectrumTableHtml(result.rows) + '</tbody></table></div>' +
    '</div>';
  requestAnimationFrame(() => drawSpectrumChart(document.getElementById('spectrumChart'), result));
};
const renderSpectrumPreview = () => {
  const target = document.getElementById('spectrumPreview');
  if (!target) return;
  try {
    const result = calculateSpectrum();
    const siteText = result.siteClass === 'manual' ? 'Manual Fa/Fv' : 'Kelas situs ' + result.siteClass;
    target.innerHTML = '<h3>Ringkasan spektrum</h3><p>' + siteText + ' memakai Fa = ' + formatNumber(result.fa) + ' dan Fv = ' + formatNumber(result.fv) + '. Klik Hitung Spektrum untuk menampilkan tabel data dan grafik.</p><div class="spectrum-summary-grid"><span>SDS: ' + formatNumber(result.sds) + ' g</span><span>SD1: ' + formatNumber(result.sd1) + ' g</span><span>T0: ' + formatNumber(result.t0) + ' s</span><span>Ts: ' + formatNumber(result.ts) + ' s</span></div>';
  } catch (error) {
    const note = error.message === 'SITE_SPECIFIC_REQUIRED'
      ? 'Kelas situs SF membutuhkan analisis respons spesifik situs. Pilih Manual Fa/Fv jika sudah memiliki nilai faktor dari hasil analisis.'
      : 'Isi Ss, S1, TL, interval T, T maksimum, dan kelas situs. Jika memilih Manual Fa/Fv, isi Fa dan Fv sendiri.';
    target.innerHTML = '<h3>Ringkasan spektrum</h3><p>' + note + '</p><div class="spectrum-summary-grid"><span>SDS: -</span><span>SD1: -</span><span>T0: -</span><span>Ts: -</span></div>';
  }
};
const invalidateSpectrumResult = () => {
  latestSpectrumResult = null;
  setSpectrumDownloadsEnabled(false);
  renderSpectrumPreview();
};
spectrumInputIds.forEach(id => document.getElementById(id)?.addEventListener('input', invalidateSpectrumResult));
spectrumSiteClassInput?.addEventListener('change', () => {
  updateSpectrumFactorMode();
  invalidateSpectrumResult();
});
updateSpectrumFactorMode();
document.getElementById('spectrumParseBtn')?.addEventListener('click', parseSpectrumText);
renderSpectrumPreview();
document.getElementById('spectrumBtn')?.addEventListener('click', () => {
  try {
    const result = calculateSpectrum();
    latestSpectrumResult = result;
    renderSpectrumResult(result);
    setSpectrumDownloadsEnabled(true);
    showToast('Tabel dan grafik respons spektrum berhasil dihitung.');
  } catch (error) {
    console.error(error);
    if (error.message === 'SITE_SPECIFIC_REQUIRED') return showToast('Kelas situs SF perlu analisis spesifik situs. Pilih Manual Fa/Fv jika sudah ada nilainya.');
    showToast('Isi Ss, S1, TL, interval T, dan T maksimum dengan angka valid.');
  }
});
spectrumTxtBtn?.addEventListener('click', () => {
  if (!latestSpectrumResult) return showToast('Klik Hitung Spektrum terlebih dahulu.');
  const locationName = document.getElementById('spectrumLocation')?.value.trim() || 'response-spectrum';
  const blob = new Blob([spectrumTxtContent(latestSpectrumResult)], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, slug(locationName) + '-response-spectrum.txt');
  showToast('TXT respons spektrum berhasil dibuat.');
});
spectrumChartBtn?.addEventListener('click', () => {
  if (!latestSpectrumResult) return showToast('Klik Hitung Spektrum terlebih dahulu.');
  const canvas = document.getElementById('spectrumChart');
  if (!canvas) return showToast('Grafik belum tersedia. Klik Hitung Spektrum terlebih dahulu.');
  const locationName = document.getElementById('spectrumLocation')?.value.trim() || 'response-spectrum';
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = slug(locationName) + '-response-spectrum.png';
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast('Grafik respons spektrum berhasil didownload.');
});

document.getElementById('exportForm').addEventListener('submit', event => {
  event.preventDefault();
  if (!window.jspdf?.jsPDF) return showToast('Library PDF belum siap. Coba ulang beberapa detik lagi.');
  const title = document.getElementById('pdfTitle').value.trim();
  const author = document.getElementById('pdfAuthor').value.trim();
  const content = document.getElementById('pdfContent').value.trim();
  if (!title || !content) return showToast('Judul dan isi dokumen wajib diisi.');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 18;
  const maxWidth = 174;
  let y = 22;
  doc.setTextColor(15, 77, 58); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(title, margin, y); y += 10;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(99, 115, 109); doc.text('AT STRUCTURA' + (author ? ' - ' + author : '') + ' - ' + new Date().toLocaleDateString('id-ID'), margin, y); y += 14;
  doc.setTextColor(23, 35, 31); doc.setFontSize(11);
  doc.splitTextToSize(content, maxWidth).forEach(line => { if (y > 276) { doc.addPage(); y = 22; } doc.text(line, margin, y); y += 7; });
  doc.setFontSize(9); doc.setTextColor(99, 115, 109); doc.text('Generated by AT STRUCTURA Tools', margin, 288);
  doc.save(slug(title) + '.pdf');
  showToast('PDF berhasil dibuat.');
});

const mergeFiles = document.getElementById('mergeFiles');
const mergeList = document.getElementById('mergeList');
const mergeBtn = document.getElementById('mergeBtn');
const clearMergeBtn = document.getElementById('clearMergeBtn');
let selectedMergeFiles = [];
const renderMergeList = () => {
  mergeList.innerHTML = selectedMergeFiles.length ? selectedMergeFiles.map((file, index) => `
    <div class="file-item merge-file-item">
      <span>${index + 1}. ${file.name}</span>
      <small>${(file.size / 1024 / 1024).toFixed(2)} MB</small>
      <div class="file-order-controls" aria-label="Atur urutan ${file.name}">
        <button type="button" data-merge-move="up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>Naik</button>
        <button type="button" data-merge-move="down" data-index="${index}" ${index === selectedMergeFiles.length - 1 ? 'disabled' : ''}>Turun</button>
      </div>
    </div>
  `).join('') : '<p>Belum ada PDF dipilih.</p>';
};
mergeList.addEventListener('click', event => {
  const button = event.target.closest('[data-merge-move]');
  if (!button) return;
  const index = Number(button.dataset.index);
  const direction = button.dataset.mergeMove;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= selectedMergeFiles.length) return;
  [selectedMergeFiles[index], selectedMergeFiles[targetIndex]] = [selectedMergeFiles[targetIndex], selectedMergeFiles[index]];
  renderMergeList();
});
mergeFiles.addEventListener('change', () => {
  const pickedFiles = Array.from(mergeFiles.files || []);
  selectedMergeFiles = selectedMergeFiles.concat(pickedFiles);
  mergeFiles.value = '';
  renderMergeList();
});
clearMergeBtn?.addEventListener('click', () => {
  selectedMergeFiles = [];
  mergeFiles.value = '';
  renderMergeList();
  showToast('Urutan PDF direset. Pilih ulang file sesuai urutan yang diinginkan.');
});
mergeBtn.addEventListener('click', async () => {
  const files = selectedMergeFiles;
  if (files.length < 2) return showToast('Pilih minimal dua file PDF untuk digabung.');
  if (!window.PDFLib?.PDFDocument) return showToast('Library PDF merger belum siap. Coba ulang beberapa detik lagi.');
  try {
    const mergedPdf = await window.PDFLib.PDFDocument.create();
    for (const file of files) {
      const pdf = await window.PDFLib.PDFDocument.load(await file.arrayBuffer());
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach(page => mergedPdf.addPage(page));
    }
    downloadBlob(new Blob([await mergedPdf.save()], { type: 'application/pdf' }), 'at-structura-merged.pdf');
    showToast('PDF berhasil digabung sesuai urutan daftar.');
  } catch (error) { console.error(error); showToast('Gagal menggabungkan PDF. Pastikan file tidak rusak atau terkunci.'); }
});

const imagePreview = document.getElementById('imagePreview');
const imageMode = document.getElementById('imageMode');
const imagePageStart = document.getElementById('imagePageStart');
const imagePageEnd = document.getElementById('imagePageEnd');
if (window.pdfjsLib) window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

const updateImagePageInputs = () => {
  const mode = imageMode.value;
  imagePageStart.disabled = mode === 'all';
  imagePageEnd.disabled = mode !== 'range';
  imagePageStart.closest('div').style.display = mode === 'all' ? 'none' : '';
  imagePageEnd.closest('div').style.display = mode === 'range' ? '' : 'none';
};

const getImagePages = totalPages => {
  const mode = imageMode.value;
  if (mode === 'all') return Array.from({ length: totalPages }, (_, index) => index + 1);
  const start = Number(imagePageStart.value || 1);
  const end = mode === 'range' ? Number(imagePageEnd.value || start) : start;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < 1) throw new Error('INVALID_RANGE');
  if (start > end) throw new Error('REVERSED_RANGE');
  if (end > totalPages) throw new Error('OUT_OF_RANGE');
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
};

imageMode.addEventListener('change', updateImagePageInputs);
updateImagePageInputs();

document.getElementById('imageBtn').addEventListener('click', async () => {
  const file = document.getElementById('imagePdfFile').files?.[0];
  const scale = Number(document.getElementById('imageScale').value || 1.75);
  if (!file) return showToast('Pilih file PDF terlebih dahulu.');
  if (!window.pdfjsLib) return showToast('Library PDF to image belum siap. Coba ulang beberapa detik lagi.');
  try {
    imagePreview.innerHTML = '<p>Memuat PDF...</p>';
    const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = getImagePages(pdf.numPages);
    imagePreview.innerHTML = '<p>Memproses ' + pages.length + ' halaman PDF...</p>';
    const rendered = [];
    for (const pageNumber of pages) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const url = canvas.toDataURL('image/png');
      rendered.push('<article class="pdf-image-item"><img src="' + url + '" alt="Preview halaman PDF ' + pageNumber + '"><div><strong>Halaman ' + pageNumber + '</strong><a class="download-link" href="' + url + '" download="' + slug(file.name) + '-page-' + pageNumber + '.png">Download PNG</a></div></article>');
    }
    imagePreview.innerHTML = '<div class="pdf-image-results">' + rendered.join('') + '</div>';
    showToast(pages.length + ' halaman PDF berhasil dikonversi.');
  } catch (error) {
    console.error(error);
    imagePreview.innerHTML = '<p>Preview gambar akan muncul di sini.</p>';
    if (error.message === 'OUT_OF_RANGE') return showToast('Halaman akhir melebihi jumlah halaman PDF.');
    if (error.message === 'REVERSED_RANGE') return showToast('Halaman awal tidak boleh lebih besar dari halaman akhir.');
    if (error.message === 'INVALID_RANGE') return showToast('Masukkan nomor halaman yang valid.');
    showToast('Gagal mengubah PDF ke gambar.');
  }
});

const jpgPdfFiles = document.getElementById('jpgPdfFiles');
const jpgPdfList = document.getElementById('jpgPdfList');
const renderJpgPdfList = () => {
  const files = Array.from(jpgPdfFiles?.files || []);
  jpgPdfList.innerHTML = files.length ? files.map((file, index) => '<div class="file-item"><span>' + (index + 1) + '. ' + file.name + '</span><small>' + (file.size / 1024 / 1024).toFixed(2) + ' MB</small></div>').join('') : '<p>Belum ada gambar dipilih.</p>';
};

const readImageData = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => resolve({ dataUrl: reader.result, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = reject;
    image.src = reader.result;
  };
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

jpgPdfFiles?.addEventListener('change', renderJpgPdfList);

document.getElementById('jpgPdfBtn')?.addEventListener('click', async () => {
  const files = Array.from(jpgPdfFiles?.files || []);
  if (!files.length) return showToast('Pilih minimal satu gambar JPG/JPEG.');
  if (!window.jspdf?.jsPDF) return showToast('Library PDF belum siap. Coba ulang beberapa detik lagi.');
  const invalid = files.find(file => !/^image\/jpe?g$/i.test(file.type) && !/\.jpe?g$/i.test(file.name));
  if (invalid) return showToast('Gunakan file JPG atau JPEG saja.');

  try {
    const { jsPDF } = window.jspdf;
    const orientationSetting = document.getElementById('jpgPdfOrientation').value;
    let doc = null;
    for (const [index, file] of files.entries()) {
      const image = await readImageData(file);
      const orientation = orientationSetting === 'auto' ? (image.width >= image.height ? 'landscape' : 'portrait') : orientationSetting;
      if (!doc) doc = new jsPDF({ unit: 'mm', format: 'a4', orientation });
      else doc.addPage('a4', orientation);
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;
      const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
      const width = image.width * ratio;
      const height = image.height * ratio;
      const x = (pageWidth - width) / 2;
      const y = (pageHeight - height) / 2;
      doc.addImage(image.dataUrl, 'JPEG', x, y, width, height, undefined, 'FAST');
      if (index === 0) doc.setProperties({ title: slug(file.name), subject: 'JPG to PDF AT STRUCTURA' });
    }
    doc.save(slug(files[0].name) + (files.length > 1 ? '-and-' + (files.length - 1) + '-more' : '') + '.pdf');
    showToast(files.length + ' gambar berhasil diexport ke PDF.');
  } catch (error) {
    console.error(error);
    showToast('Gagal membuat PDF dari gambar. Pastikan file JPG tidak rusak.');
  }
});

