const state = {
  nodes: [],
  elements: [],
  loads: [],
  nextNodeId: 1,
  nextElementId: 1,
  nextLoadId: 1,
  forceChart: null
};

const $ = selector => document.querySelector(selector);
const svg = $('#beamCanvas');
const message = $('#modelMessage');
const fmt = value => Number(value).toLocaleString('id-ID', { maximumFractionDigits: 3 });
const eps = 1e-9;

const controls = {
  nodeX: $('#nodeX'),
  elementStart: $('#elementStart'),
  elementEnd: $('#elementEnd'),
  supportNode: $('#supportNode'),
  supportType: $('#supportType'),
  pointLoadTarget: $('#pointLoadTarget'),
  pointLoadValue: $('#pointLoadValue'),
  pointLoadAngle: $('#pointLoadAngle'),
  pointLoadNode: $('#pointLoadNode'),
  pointLoadElement: $('#pointLoadElement'),
  pointLoadOffset: $('#pointLoadOffset'),
  udlStartNode: $('#udlStartNode'),
  udlEndNode: $('#udlEndNode'),
  udlValue: $('#udlValue'),
  presetModel: $('#presetModel'),
  diagramOutput: $('#diagramOutput')
};

const showMessage = (text, ok = false) => {
  message.textContent = text;
  message.classList.toggle('ok', ok);
};

const createNode = (id, x, support = 'free') => ({ id, x, support });
const createPointLoad = (id, x, p, angle = 90) => {
  const radians = (angle * Math.PI) / 180;
  return {
    id,
    type: 'point',
    direction: 'inclined',
    x,
    p,
    angle,
    fx: Math.abs(p * Math.cos(radians)) < 1e-7 ? 0 : p * Math.cos(radians),
    fy: Math.abs(p * Math.sin(radians)) < 1e-7 ? 0 : p * Math.sin(radians),
    label: `P${id}`
  };
};

const getNode = id => state.nodes.find(node => node.id === Number(id));
const getElement = id => state.elements.find(element => element.id === Number(id));
const pointFx = load => Number.isFinite(load.fx) ? load.fx : (load.direction === 'horizontal' ? load.p : 0);
const pointFy = load => Number.isFinite(load.fy) ? load.fy : (load.direction === 'horizontal' ? 0 : load.p);
const sortedNodes = () => [...state.nodes].sort((a, b) => a.x - b.x || a.id - b.id);
const nodeLabel = nodeOrId => {
  const id = typeof nodeOrId === 'object' ? nodeOrId.id : Number(nodeOrId);
  const index = sortedNodes().findIndex(node => node.id === id);
  const safeIndex = index >= 0 ? index : id - 1;
  let value = safeIndex;
  let label = '';
  do {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return label;
};

const elementEnds = element => {
  const a = getNode(element.startNode);
  const b = getNode(element.endNode);
  return a.x <= b.x ? { left: a, right: b, length: b.x - a.x } : { left: b, right: a, length: a.x - b.x };
};

const presets = {
  'overhang-two-side': {
    message: 'Preset overhang dua sisi dimuat: support di dalam bentang dan ujung kiri-kanan bebas.',
    nodes: [
      createNode(1, 0),
      createNode(2, 4, 'pin'),
      createNode(3, 14),
      createNode(4, 24, 'roller'),
      createNode(5, 26)
    ],
    elements: [{ id: 1, startNode: 1, endNode: 5 }],
    loads: [
      createPointLoad(1, 0, 150),
      createPointLoad(2, 14, 100),
      createPointLoad(3, 26, 400)
    ]
  },
  'cantilever-fixed-right': {
    message: 'Preset kantilever kiri dimuat: ujung kiri bebas dan fixed di kanan.',
    nodes: [
      createNode(1, 0),
      createNode(2, 3),
      createNode(3, 6, 'fixed')
    ],
    elements: [{ id: 1, startNode: 1, endNode: 3 }],
    loads: [
      createPointLoad(1, 0, 30),
      { id: 2, type: 'udl', startNode: 1, endNode: 2, w: 8, label: 'w2' }
    ]
  },
  'cantilever-fixed-left': {
    message: 'Preset kantilever kanan dimuat: fixed di kiri dan ujung kanan bebas.',
    nodes: [
      createNode(1, 0, 'fixed'),
      createNode(2, 4),
      createNode(3, 7)
    ],
    elements: [{ id: 1, startNode: 1, endNode: 3 }],
    loads: [
      createPointLoad(1, 7, 25),
      { id: 2, type: 'udl', startNode: 1, endNode: 3, w: 6, label: 'w2' }
    ]
  },
  'simple-span-udl': {
    message: 'Preset balok sederhana dimuat: pin-roller dengan beban merata.',
    nodes: [
      createNode(1, 0, 'pin'),
      createNode(2, 3),
      createNode(3, 6, 'roller')
    ],
    elements: [{ id: 1, startNode: 1, endNode: 3 }],
    loads: [
      { id: 1, type: 'udl', startNode: 1, endNode: 3, w: 10, label: 'w1' }
    ]
  }
};

function analysisElements() {
  const segments = new Map();
  state.elements.forEach(element => {
    const ends = elementEnds(element);
    const nodesOnElement = sortedNodes()
      .filter(node => node.x >= ends.left.x - eps && node.x <= ends.right.x + eps)
      .sort((a, b) => a.x - b.x || a.id - b.id);

    for (let i = 0; i < nodesOnElement.length - 1; i += 1) {
      const left = nodesOnElement[i];
      const right = nodesOnElement[i + 1];
      if (right.x - left.x < eps) continue;
      const key = `${left.id}-${right.id}`;
      if (!segments.has(key)) {
        segments.set(key, {
          id: `${element.id}.${i + 1}`,
          parentId: element.id,
          startNode: left.id,
          endNode: right.id
        });
      }
    }
  });
  return [...segments.values()];
}

function udlRange(load) {
  if (load.startNode && load.endNode) {
    const a = getNode(load.startNode);
    const b = getNode(load.endNode);
    if (!a || !b) return { a: 0, b: 0, length: 0 };
    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);
    return { a: left, b: right, length: right - left };
  }
  const ends = elementEnds(getElement(load.elementId));
  return { a: ends.left.x, b: ends.right.x, length: ends.length };
}

function isUdlRangeCovered(startNode, endNode) {
  const leftX = Math.min(startNode.x, endNode.x);
  const rightX = Math.max(startNode.x, endNode.x);
  const intervals = state.elements
    .map(element => elementEnds(element))
    .map(ends => ({ a: ends.left.x, b: ends.right.x }))
    .sort((a, b) => a.a - b.a || a.b - b.b);
  let coveredUntil = leftX;
  for (const interval of intervals) {
    if (interval.b <= coveredUntil + eps) continue;
    if (interval.a > coveredUntil + eps) return false;
    coveredUntil = Math.max(coveredUntil, interval.b);
    if (coveredUntil >= rightX - eps) return true;
  }
  return false;
}

const option = (value, label) => `<option value="${value}">${label}</option>`;

function refreshSelects() {
  const nodeOptions = sortedNodes().map(node => option(node.id, `${nodeLabel(node)} - x=${fmt(node.x)} m`)).join('');
  const elementOptions = state.elements.map(element => {
    const ends = elementEnds(element);
    return option(element.id, `E${element.id} - ${nodeLabel(element.startNode)} ke ${nodeLabel(element.endNode)} (${fmt(ends.length)} m)`);
  }).join('');

  [controls.elementStart, controls.elementEnd, controls.supportNode, controls.pointLoadNode, controls.udlStartNode, controls.udlEndNode].forEach(select => { select.innerHTML = nodeOptions; });
  [controls.pointLoadElement].forEach(select => { select.innerHTML = elementOptions; });

  controls.pointLoadElement.closest('div').style.display = controls.pointLoadTarget.value === 'element' ? '' : 'none';
  controls.pointLoadOffset.closest('div').style.display = controls.pointLoadTarget.value === 'element' ? '' : 'none';
  controls.pointLoadNode.closest('div').style.display = controls.pointLoadTarget.value === 'node' ? '' : 'none';
}

function renderModelList() {
  const nodes = sortedNodes().map(node => `<p>${nodeLabel(node)}: x=${fmt(node.x)} m, support=${node.support}</p>`).join('') || '<p>Belum ada node.</p>';
  const elements = state.elements.map(element => {
    const ends = elementEnds(element);
    return `<p>E${element.id}: ${nodeLabel(element.startNode)}-${nodeLabel(element.endNode)}, L=${fmt(ends.length)} m</p>`;
  }).join('') || '<p>Belum ada element.</p>';
  const loads = state.loads.map(load => {
    if (load.type === 'point') return `<p>${load.label}: P=${fmt(load.p)} kN, sudut=${fmt(load.angle ?? 90)}&deg;, Fx=${fmt(pointFx(load))} kN, Fy=${fmt(pointFy(load))} kN di x=${fmt(load.x)} m</p>`;
    const range = udlRange(load);
    return `<p>${load.label}: w=${fmt(load.w)} kN/m dari ${nodeLabel(load.startNode)} ke ${nodeLabel(load.endNode)} (${fmt(range.a)}-${fmt(range.b)} m)</p>`;
  }).join('') || '<p>Belum ada beban.</p>';
  $('#modelList').innerHTML = `<article><h3>Node</h3>${nodes}</article><article><h3>Element</h3>${elements}</article><article><h3>Beban</h3>${loads}</article>`;
}

function drawSupport(node, x, y) {
  if (node.support === 'free') return '';
  const groundY = y + 58;
  const hatch = Array.from({ length: 6 }, (_, i) => {
    const hx = x - 34 + i * 13;
    return `<line class="diagram-ground-hatch" x1="${hx}" y1="${groundY + 7}" x2="${hx + 10}" y2="${groundY - 3}"></line>`;
  }).join('');

  if (node.support === 'fixed') {
    const connected = state.elements
      .filter(element => element.startNode === node.id || element.endNode === node.id)
      .map(element => getNode(element.startNode === node.id ? element.endNode : element.startNode))
      .filter(Boolean);
    const hasLeftElement = connected.some(other => other.x < node.x - eps);
    const hasRightElement = connected.some(other => other.x > node.x + eps);
    const wallSide = hasRightElement && !hasLeftElement ? 'left' : hasLeftElement && !hasRightElement ? 'right' : 'center';
    const faceX = wallSide === 'center' ? x + 10 : x;
    const wallX = wallSide === 'left' ? x - 24 : wallSide === 'right' ? x + 2 : x - 12;
    const wallWidth = 22;
    const hatches = Array.from({ length: 6 }, (_, i) => {
      const hy = y - 52 + i * 20;
      if (wallSide === 'right') {
        return `<line class="diagram-fixed-hatch" x1="${wallX + wallWidth + 18}" y1="${hy + 12}" x2="${wallX + wallWidth - 2}" y2="${hy - 8}"></line>`;
      }
      return `<line class="diagram-fixed-hatch" x1="${wallX - 18}" y1="${hy + 12}" x2="${wallX + 2}" y2="${hy - 8}"></line>`;
    }).join('');
    return `
      <g class="diagram-support-group">
        <rect class="diagram-fixed-wall" x="${wallX}" y="${y - 64}" width="${wallWidth}" height="128" rx="3"></rect>
        <line class="diagram-fixed-face" x1="${faceX}" y1="${y - 58}" x2="${faceX}" y2="${y + 58}"></line>
        ${hatches}
      </g>
    `;
  }

  const typeText = node.support === 'roller' ? 'ROLLER' : 'PIN';
  const rollers = node.support === 'roller'
    ? `<g class="diagram-roller-set">
        <circle class="diagram-roller" cx="${x - 16}" cy="${groundY - 9}" r="6"></circle>
        <circle class="diagram-roller" cx="${x}" cy="${groundY - 9}" r="6"></circle>
        <circle class="diagram-roller" cx="${x + 16}" cy="${groundY - 9}" r="6"></circle>
      </g>`
    : '';

  return `
    <g class="diagram-support-group">
      <line class="diagram-support-cap" x1="${x - 23}" y1="${y + 18}" x2="${x + 23}" y2="${y + 18}"></line>
      <polygon class="diagram-support" points="${x},${y + 20} ${x - 30},${y + 50} ${x + 30},${y + 50}"></polygon>
      ${rollers}
      <line class="diagram-ground-line" x1="${x - 38}" y1="${groundY}" x2="${x + 38}" y2="${groundY}"></line>
      ${hatch}
      <text class="diagram-support-type" x="${x}" y="${groundY + 22}">${typeText}</text>
    </g>
  `;
}

function renderSvg() {
  const nodes = sortedNodes();
  if (!nodes.length) {
    svg.innerHTML = '<text class="diagram-label" x="300" y="170">Tambahkan node untuk mulai menggambar balok.</text><line x1="90" y1="220" x2="870" y2="220" stroke="#D8E0EA" stroke-width="2"/>';
    return;
  }
  const minX = Math.min(...nodes.map(node => node.x), 0);
  const maxX = Math.max(...nodes.map(node => node.x), 1);
  const span = Math.max(maxX - minX, 1);
  const left = 90;
  const right = 870;
  const y = 315;
  const sx = x => left + ((x - minX) / span) * (right - left);

  let content = `
    <defs>
      <linearGradient id="beamGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#d7ece5"/>
        <stop offset="28%" stop-color="#87afa4"/>
        <stop offset="58%" stop-color="#2e6a59"/>
        <stop offset="100%" stop-color="#0b4032"/>
      </linearGradient>
      <linearGradient id="beamEdgeGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#0B2A5B" stop-opacity=".1"/>
        <stop offset="16%" stop-color="#0B2A5B" stop-opacity=".75"/>
        <stop offset="84%" stop-color="#0B2A5B" stop-opacity=".75"/>
        <stop offset="100%" stop-color="#0B2A5B" stop-opacity=".1"/>
      </linearGradient>
      <linearGradient id="udlBandGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#d67a00" stop-opacity=".16"/>
        <stop offset="100%" stop-color="#d67a00" stop-opacity=".03"/>
      </linearGradient>
      <radialGradient id="nodeGrad" cx="38%" cy="32%" r="62%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#d4ede5"/>
      </radialGradient>
      <filter id="beamShadow" x="-10%" y="-60%" width="120%" height="220%">
        <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#0B2A5B" flood-opacity=".22"/>
      </filter>
      <filter id="nodeShadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="3" stdDeviation="3.5" flood-color="#0B2A5B" flood-opacity=".3"/>
      </filter>
      <filter id="supportGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0B2A5B" flood-opacity=".25"/>
      </filter>
      <marker id="arrowOrange" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto">
        <path d="M0,0 L10,5 L0,10 Z" fill="#d67a00"/>
      </marker>
    </defs>
    <line x1="${left}" y1="${y + 92}" x2="${right}" y2="${y + 92}" stroke="#c8ddd7" stroke-width="1.5"/>
    <line x1="${left}" y1="${y + 88}" x2="${left}" y2="${y + 96}" stroke="#0B2A5B" stroke-width="2"/>
    <line x1="${right}" y1="${y + 88}" x2="${right}" y2="${y + 96}" stroke="#0B2A5B" stroke-width="2"/>
    <text class="diagram-axis-label" x="${left - 2}" y="${y + 125}">x (m)</text>
  `;
  let beamLayer = '';
  let loadLayer = '';
  let supportLayer = '';

  state.elements.forEach(element => {
    const a = getNode(element.startNode);
    const b = getNode(element.endNode);
    const x1 = sx(a.x);
    const x2 = sx(b.x);
    const mid = (x1 + x2) / 2;
    beamLayer += `
      <g class="diagram-element-group">
        <line class="diagram-element-glow" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"></line>
        <line class="diagram-element-shadow" x1="${x1}" y1="${y + 8}" x2="${x2}" y2="${y + 8}"></line>
        <line class="diagram-element-edge" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"></line>
        <line class="diagram-element" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"></line>
        <line class="diagram-element-highlight" x1="${x1 + 6}" y1="${y - 6}" x2="${x2 - 6}" y2="${y - 6}"></line>
        <circle class="diagram-element-cap" cx="${x1}" cy="${y}" r="8"></circle>
        <circle class="diagram-element-cap" cx="${x2}" cy="${y}" r="8"></circle>
        <rect class="diagram-element-label-bg" x="${mid - 18}" y="${y + 16}" width="36" height="22" rx="7"></rect>
        <text class="diagram-label diagram-element-label" x="${mid}" y="${y + 32}" text-anchor="middle">E${element.id}</text>
      </g>
    `;
  });

  const occupyLane = (lanes, x1, x2) => {
    const padding = 42;
    let lane = 0;
    while (lanes[lane]?.some(range => !(x2 + padding < range.x1 || x1 - padding > range.x2))) lane += 1;
    if (!lanes[lane]) lanes[lane] = [];
    lanes[lane].push({ x1, x2 });
    return lane;
  };

  const udlTopLanes = [];
  const udlBottomLanes = [];
  const udlAnchorZones = [];
  const pointLanes = [];
  const udlLoads = state.loads.filter(load => load.type === 'udl');
  const pointLoads = state.loads.filter(load => load.type === 'point');

  udlLoads.forEach(load => {
    const range = udlRange(load);
    const x1 = sx(range.a);
    const x2 = sx(range.b);
    const isDownward = load.w >= 0;
    const lane = occupyLane(isDownward ? udlTopLanes : udlBottomLanes, x1, x2);
    const railY = isDownward ? y - 88 - lane * 68 : y + 92 + lane * 58;
    const beamY = isDownward ? y - 22 : y + 23;
    const bandY = Math.min(railY, beamY);
    const bandHeight = Math.abs(beamY - railY);
    const spacing = Math.max(28, Math.min(42, (x2 - x1) / Math.max(3, Math.ceil((x2 - x1) / 34))));
    loadLayer += `<rect class="diagram-udl-band" x="${x1}" y="${bandY}" width="${Math.max(x2 - x1, 1)}" height="${bandHeight}" rx="3"></rect>`;
    for (let x = x1 + spacing / 2; x < x2; x += spacing) {
      const arrowStartY = isDownward ? railY + 4 : railY - 4;
      loadLayer += `<line class="diagram-udl" x1="${x}" y1="${arrowStartY}" x2="${x}" y2="${beamY}"></line>`;
    }
    const labelX = Math.max(left + 4, Math.min(x1 + 8, right - 135));
    const labelTop = isDownward ? railY - 31 : railY + 9;
    const labelTextY = isDownward ? railY - 14 : railY + 26;
    loadLayer += `<line class="diagram-udl-top" x1="${x1}" y1="${railY}" x2="${x2}" y2="${railY}"/><line class="diagram-udl-base" x1="${x1}" y1="${beamY}" x2="${x2}" y2="${beamY}"/><rect class="diagram-label-bg orange" x="${labelX - 6}" y="${labelTop}" width="148" height="24" rx="6"></rect><text class="diagram-label diagram-load-label" x="${labelX}" y="${labelTextY}">${load.label} ${fmt(load.w)} kN/m</text>`;
    udlAnchorZones.push({ x1, x2, y: railY, isDownward });
  });

  pointLoads.forEach(load => {
    const x = sx(load.x);
    const lane = occupyLane(pointLanes, x - 42, x + 92);
    const fx = pointFx(load);
    const fy = pointFy(load);
    const magnitude = Math.hypot(fx, fy) || 1;
    const ux = fx / magnitude;
    const uy = fy / magnitude;
    const endX = x;
    const matchingUdl = udlAnchorZones
      .filter(zone => x >= zone.x1 - eps && x <= zone.x2 + eps && zone.isDownward === (fy >= 0))
      .sort((a, b) => fy >= 0 ? a.y - b.y : b.y - a.y)[0];
    const endY = matchingUdl?.y ?? (fy >= 0 ? y - 22 : y + 23);
    const hasUdlAnchor = Boolean(matchingUdl);
    const arrowLength = 62;
    const laneLift = lane * 68;
    const startX = endX - ux * arrowLength;
    const startY = endY - uy * arrowLength - laneLift;
    const lineClass = Math.abs(fx) > Math.abs(fy) ? 'diagram-hload' : 'diagram-load';
    const labelX = Math.max(left + 4, Math.min(startX - 10, right - 145));
    const labelY = Math.min(startY, endY) - 26;
    const headLength = 17;
    const headWidth = 9;
    const baseX = endX - ux * headLength;
    const baseY = endY - uy * headLength;
    const perpX = -uy;
    const perpY = ux;
    const headPoints = [
      `${endX},${endY}`,
      `${baseX + perpX * headWidth},${baseY + perpY * headWidth}`,
      `${baseX - perpX * headWidth},${baseY - perpY * headWidth}`
    ].join(' ');
    const stemEndX = baseX;
    const stemEndY = baseY;
    const anchor = hasUdlAnchor ? `<line class="diagram-load-seat" x1="${endX - 14}" y1="${endY}" x2="${endX + 14}" y2="${endY}"></line>` : `<circle class="diagram-load-anchor" cx="${endX}" cy="${endY}" r="4"></circle>`;
    loadLayer += `<g class="diagram-point-load"><line class="${lineClass}" x1="${startX}" y1="${startY}" x2="${stemEndX}" y2="${stemEndY}"></line><polygon class="${lineClass}-head" points="${headPoints}"></polygon>${anchor}<rect class="diagram-label-bg" x="${labelX - 6}" y="${labelY - 16}" width="158" height="24" rx="6"></rect><text class="diagram-label diagram-load-label" x="${labelX}" y="${labelY}">${load.label} ${fmt(load.p)} kN @ ${fmt(load.angle ?? 90)}&deg;</text></g>`;
  });

  nodes.forEach(node => {
    const x = sx(node.x);
    supportLayer += drawSupport(node, x, y);
    // vertical dimension line
    supportLayer += `<line class="diagram-dim-line" x1="${x}" y1="${y + 8}" x2="${x}" y2="${y + 88}"/>`;
    // node circle with gradient
    supportLayer += `<circle class="diagram-node-ring" cx="${x}" cy="${y}" r="13"/><circle class="diagram-node" cx="${x}" cy="${y}" r="9" fill="url(#nodeGrad)" filter="url(#nodeShadow)"/>`;
    // node label (letter)
    supportLayer += `<text class="diagram-node-label" x="${x}" y="${y + 78}">${nodeLabel(node)}</text>`;
    // dimension label (position in m)
    supportLayer += `<rect fill="rgba(255,255,255,.88)" x="${x - 26}" y="${y + 93}" width="52" height="18" rx="4"/>`;
    supportLayer += `<text class="diagram-dim-label" x="${x}" y="${y + 106}">${fmt(node.x)} m</text>`;
  });

  svg.innerHTML = content + beamLayer + loadLayer + supportLayer;
}

function validateModel() {
  if (state.nodes.length < 2) throw new Error('Minimal ada 2 node.');
  if (state.elements.length < 1) throw new Error('Minimal ada 1 element.');

  for (const element of state.elements) {
    const ends = elementEnds(element);
    if (Math.abs(ends.length) < eps) throw new Error(`Panjang E${element.id} tidak boleh nol.`);
  }

  for (const load of state.loads) {
    if (load.type === 'udl') {
      const startNode = getNode(load.startNode);
      const endNode = getNode(load.endNode);
      if (!startNode || !endNode) throw new Error(`${load.label} harus punya node awal dan node akhir.`);
      if (Math.abs(startNode.x - endNode.x) < eps) throw new Error(`${load.label} tidak boleh memiliki panjang nol.`);
      if (!isUdlRangeCovered(startNode, endNode)) throw new Error(`${load.label} harus berada pada rentang node yang terhubung element.`);
    }
    if (load.type === 'point') {
      const insideAny = state.elements.some(element => {
        const ends = elementEnds(element);
        return load.x >= ends.left.x - eps && load.x <= ends.right.x + eps;
      });
      if (!insideAny) throw new Error(`${load.label} berada di luar panjang element.`);
    }
  }

  const meshElements = analysisElements();
  const activeNodeIds = new Set();
  meshElements.forEach(element => {
    activeNodeIds.add(element.startNode);
    activeNodeIds.add(element.endNode);
  });
  const invalidSupport = state.nodes.find(node => node.support !== 'free' && !activeNodeIds.has(node.id));
  if (invalidSupport) throw new Error(`Support ${nodeLabel(invalidSupport)} harus berada pada node yang dilalui element balok.`);

  const fixed = state.nodes.filter(node => node.support === 'fixed');
  const verticalSupports = state.nodes.filter(node => ['pin', 'roller', 'fixed'].includes(node.support));
  const simpleSupports = state.nodes.filter(node => ['pin', 'roller'].includes(node.support));
  const horizontalLoads = state.loads.filter(load => load.type === 'point' && Math.abs(pointFx(load)) > eps);
  const horizontalSupports = state.nodes.filter(node => ['pin', 'fixed'].includes(node.support));

  if (horizontalLoads.length && horizontalSupports.length < 1) throw new Error('Beban horizontal membutuhkan support pin atau fixed.');
  if (horizontalLoads.length && horizontalSupports.length > 1) throw new Error('Model dengan lebih dari satu restraint horizontal belum didukung pada versi awal.');

  if (verticalSupports.length < 1) throw new Error('Struktur harus punya support yang cukup.');
  if (fixed.length === 0 && simpleSupports.length < 2) throw new Error('Balok tanpa fixed membutuhkan minimal dua support vertikal.');

  return { type: 'stiffness', supports: verticalSupports };
}

function normalizeLoads() {
  return state.loads.map(load => {
    if (load.type === 'point') return { ...load, fx: pointFx(load), fy: pointFy(load) };
    const range = udlRange(load);
    return { ...load, a: range.a, b: range.b, total: load.w * range.length, centroid: (range.a + range.b) / 2 };
  });
}


function addEquivalentPointLoad(force, element, x, p, nodeIndex) {
  const ends = elementEnds(element);
  const leftIndex = nodeIndex.get(ends.left.id);
  const rightIndex = nodeIndex.get(ends.right.id);
  const localX = x - ends.left.x;
  const r = localX / ends.length;
  const n1 = 1 - 3 * r * r + 2 * r * r * r;
  const n2 = ends.length * (r - 2 * r * r + r * r * r);
  const n3 = 3 * r * r - 2 * r * r * r;
  const n4 = ends.length * (-r * r + r * r * r);
  force[leftIndex * 2] -= p * n1;
  force[leftIndex * 2 + 1] -= p * n2;
  force[rightIndex * 2] -= p * n3;
  force[rightIndex * 2 + 1] -= p * n4;
}

function addEquivalentUdl(force, element, a, b, w, nodeIndex) {
  const ends = elementEnds(element);
  const leftIndex = nodeIndex.get(ends.left.id);
  const rightIndex = nodeIndex.get(ends.right.id);
  const from = Math.max(a, ends.left.x);
  const to = Math.min(b, ends.right.x);
  if (to <= from + eps) return;
  const mid = (from + to) / 2;
  const half = (to - from) / 2;
  const gauss = [
    { x: -0.8611363116, weight: 0.3478548451 },
    { x: -0.3399810436, weight: 0.6521451549 },
    { x: 0.3399810436, weight: 0.6521451549 },
    { x: 0.8611363116, weight: 0.3478548451 }
  ];
  gauss.forEach(point => {
    const globalX = mid + half * point.x;
    const r = (globalX - ends.left.x) / ends.length;
    const n1 = 1 - 3 * r * r + 2 * r * r * r;
    const n2 = ends.length * (r - 2 * r * r + r * r * r);
    const n3 = 3 * r * r - 2 * r * r * r;
    const n4 = ends.length * (-r * r + r * r * r);
    const scale = w * half * point.weight;
    force[leftIndex * 2] -= scale * n1;
    force[leftIndex * 2 + 1] -= scale * n2;
    force[rightIndex * 2] -= scale * n3;
    force[rightIndex * 2 + 1] -= scale * n4;
  });
}

function solveLinearSystem(matrix, vector) {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-10) throw new Error('Struktur tidak stabil atau support belum cukup. Periksa lagi tipe support dan posisi tumpuan.');
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const divisor = a[col][col];
    for (let j = col; j <= n; j += 1) a[col][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= n; j += 1) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map(row => row[n]);
}

function solveReactions(model, loads) {
  const meshElements = analysisElements();
  const activeNodeIds = new Set();
  meshElements.forEach(element => {
    activeNodeIds.add(element.startNode);
    activeNodeIds.add(element.endNode);
  });
  const nodes = sortedNodes().filter(node => activeNodeIds.has(node.id));
  const nodeIndex = new Map(nodes.map((node, index) => [node.id, index]));
  const dofCount = nodes.length * 2;
  const stiffness = Array.from({ length: dofCount }, () => Array(dofCount).fill(0));
  const force = Array(dofCount).fill(0);
  const ei = 1;

  meshElements.forEach(element => {
    const ends = elementEnds(element);
    const leftIndex = nodeIndex.get(ends.left.id);
    const rightIndex = nodeIndex.get(ends.right.id);
    const l = ends.length;
    const local = [
      [12 * ei / l ** 3, 6 * ei / l ** 2, -12 * ei / l ** 3, 6 * ei / l ** 2],
      [6 * ei / l ** 2, 4 * ei / l, -6 * ei / l ** 2, 2 * ei / l],
      [-12 * ei / l ** 3, -6 * ei / l ** 2, 12 * ei / l ** 3, -6 * ei / l ** 2],
      [6 * ei / l ** 2, 2 * ei / l, -6 * ei / l ** 2, 4 * ei / l]
    ];
    const map = [leftIndex * 2, leftIndex * 2 + 1, rightIndex * 2, rightIndex * 2 + 1];
    for (let i = 0; i < 4; i += 1) {
      for (let j = 0; j < 4; j += 1) stiffness[map[i]][map[j]] += local[i][j];
    }
  });

  loads.forEach(load => {
    if (load.type === 'point' && Math.abs(pointFy(load)) > eps) {
      const nodeAtLoad = nodes.find(node => Math.abs(node.x - load.x) < eps);
      if (nodeAtLoad) {
        force[nodeIndex.get(nodeAtLoad.id) * 2] -= pointFy(load);
      } else {
        const element = meshElements.find(item => {
          const ends = elementEnds(item);
          return load.x > ends.left.x + eps && load.x < ends.right.x - eps;
        });
        if (!element) throw new Error(`${load.label} berada di luar element.`);
        addEquivalentPointLoad(force, element, load.x, pointFy(load), nodeIndex);
      }
    }
    if (load.type === 'udl') {
      meshElements.forEach(element => addEquivalentUdl(force, element, load.a, load.b, load.w, nodeIndex));
    }
  });

  const constrained = new Set();
  nodes.forEach((node, index) => {
    if (['pin', 'roller', 'fixed'].includes(node.support)) constrained.add(index * 2);
    if (node.support === 'fixed') constrained.add(index * 2 + 1);
  });
  const free = Array.from({ length: dofCount }, (_, index) => index).filter(index => !constrained.has(index));
  if (!constrained.size) throw new Error('Struktur harus punya support yang cukup.');

  const displacements = Array(dofCount).fill(0);
  if (free.length) {
    const reducedK = free.map(row => free.map(col => stiffness[row][col]));
    const reducedF = free.map(row => force[row]);
    const solved = solveLinearSystem(reducedK, reducedF);
    free.forEach((dof, index) => { displacements[dof] = solved[index]; });
  }

  const reactionsByDof = stiffness.map(row => row.reduce((sum, value, col) => sum + value * displacements[col], 0)).map((value, index) => value - force[index]);
  const totalHorizontal = loads.filter(load => load.type === 'point').reduce((sum, load) => sum + pointFx(load), 0);
  const horizontalSupports = nodes.filter(node => ['pin', 'fixed'].includes(node.support));
  const horizontalSupport = horizontalSupports[0];

  return nodes
    .map((node, index) => ({
      nodeId: node.id,
      x: node.x,
      vertical: constrained.has(index * 2) ? reactionsByDof[index * 2] : 0,
      moment: constrained.has(index * 2 + 1) ? reactionsByDof[index * 2 + 1] : 0,
      horizontal: horizontalSupport && node.id === horizontalSupport.id ? -totalHorizontal : 0
    }))
    .filter(reaction => Math.abs(reaction.vertical) > 1e-7 || Math.abs(reaction.moment) > 1e-7 || Math.abs(reaction.horizontal) > 1e-7)
    .map(reaction => ({
      ...reaction,
      vertical: Math.abs(reaction.vertical) < 1e-7 ? 0 : reaction.vertical,
      moment: Math.abs(reaction.moment) < 1e-7 ? 0 : reaction.moment,
      horizontal: Math.abs(reaction.horizontal) < 1e-7 ? 0 : reaction.horizontal
    }));
}
function shearAt(x, loads, reactions) {
  let shear = 0;
  reactions.forEach(reaction => { if (x >= reaction.x - eps) shear += reaction.vertical; });
  loads.forEach(load => {
    if (load.type === 'point' && x >= load.x - eps) shear -= pointFy(load);
    if (load.type === 'udl' && x > load.a + eps) shear -= load.w * Math.min(x - load.a, load.b - load.a);
  });
  return Math.abs(shear) < 1e-7 ? 0 : shear;
}

function momentAt(x, loads, reactions) {
  let moment = 0;
  reactions.forEach(reaction => {
    if (x >= reaction.x - eps) {
      moment += reaction.vertical * (x - reaction.x);
      if (reaction.moment) moment -= reaction.moment;
    }
  });
  loads.forEach(load => {
    if (load.type === 'point' && x >= load.x - eps) moment -= pointFy(load) * (x - load.x);
    if (load.type === 'udl' && x > load.a + eps) {
      const length = Math.min(x - load.a, load.b - load.a);
      const centroid = load.a + length / 2;
      moment -= load.w * length * (x - centroid);
    }
  });
  return Math.abs(moment) < 1e-7 ? 0 : moment;
}

function axialAt(x, loads, reactions) {
  let sumFxLeft = 0;
  reactions.forEach(reaction => { if (x >= reaction.x - eps) sumFxLeft += reaction.horizontal || 0; });
  loads.forEach(load => { if (load.type === 'point' && x >= load.x - eps) sumFxLeft += pointFx(load); });
  const axial = -sumFxLeft;
  return Math.abs(axial) < 1e-7 ? 0 : axial;
}

function sampleBeam(loads, reactions) {
  const minX = Math.min(...state.nodes.map(node => node.x));
  const maxX = Math.max(...state.nodes.map(node => node.x));
  const samples = new Set();
  const breakpoints = new Set([minX, maxX]);

  for (let i = 0; i <= 120; i += 1) samples.add(minX + ((maxX - minX) * i) / 120);
  state.nodes.forEach(node => { samples.add(node.x); breakpoints.add(node.x); });
  reactions.forEach(reaction => breakpoints.add(reaction.x));
  loads.forEach(load => {
    if (load.type === 'point') { samples.add(load.x); breakpoints.add(load.x); }
    if (load.type === 'udl') { samples.add(load.a); samples.add(load.b); breakpoints.add(load.a); breakpoints.add(load.b); }
  });

  const sortedBreaks = [...breakpoints].sort((a, b) => a - b);
  for (let i = 0; i < sortedBreaks.length - 1; i += 1) {
    const left = sortedBreaks[i];
    const right = sortedBreaks[i + 1];
    if (right - left < eps) continue;
    const vLeft = shearAt(left + 1e-7, loads, reactions);
    const vRight = shearAt(right - 1e-7, loads, reactions);
    if (Math.abs(vLeft) < 1e-7) samples.add(left);
    if (Math.abs(vRight) < 1e-7) samples.add(right);
    if (vLeft * vRight < 0) {
      const root = left + (Math.abs(vLeft) / (Math.abs(vLeft) + Math.abs(vRight))) * (right - left);
      if (root > minX - eps && root < maxX + eps) samples.add(root);
    }
  }

  return [...samples].sort((a, b) => a - b).map(x => ({ x, axial: axialAt(x, loads, reactions), shear: shearAt(x, loads, reactions), moment: momentAt(x, loads, reactions) }));
}

function buildElementTable(loads, reactions) {
  return analysisElements().map(element => {
    const ends = elementEnds(element);
    const mid = (ends.left.x + ends.right.x) / 2;
    return {
      id: element.id,
      label: element.parentId ? `E${element.parentId}.${String(element.id).split('.').pop()}` : `E${element.id}`,
      start: ends.left.x,
      end: ends.right.x,
      nStart: axialAt(ends.left.x + 1e-6, loads, reactions),
      nEnd: axialAt(ends.right.x - 1e-6, loads, reactions),
      vStart: shearAt(ends.left.x + 1e-6, loads, reactions),
      vEnd: shearAt(ends.right.x - 1e-6, loads, reactions),
      mStart: momentAt(ends.left.x + 1e-6, loads, reactions),
      mMid: momentAt(mid, loads, reactions),
      mEnd: momentAt(ends.right.x - 1e-6, loads, reactions)
    };
  });
}

function renderSummary(reactions, samples) {
  const maxMoment = samples.reduce((max, item) => Math.abs(item.moment) > Math.abs(max.moment) ? item : max, samples[0] || { x: 0, moment: 0 });
  const reactionCards = reactions.map(reaction => {
    const supportMoment = reaction.moment ? '<span>M = ' + fmt(reaction.moment) + ' kNm</span>' : '';
    const horizontal = reaction.horizontal ? '<span>Rx = ' + fmt(reaction.horizontal) + ' kN</span>' : '';
    return '<article class="result-card-small"><span>N' + reaction.nodeId + ' @ x=' + fmt(reaction.x) + ' m</span><strong>Ry = ' + fmt(reaction.vertical) + ' kN</strong>' + horizontal + supportMoment + '</article>';
  }).join('');
  const sign = maxMoment.moment >= 0 ? 'Sagging' : 'Hogging';
  const mmaxCard = '<article class="result-card-small highlight"><span>Mmax @ x=' + fmt(maxMoment.x) + ' m</span><strong>' + fmt(maxMoment.moment) + ' kNm</strong><span>' + sign + '</span></article>';
  $('#reactionResults').innerHTML = reactionCards + mmaxCard;
}
function renderTable(rows) {
  $('#forceTableBody').innerHTML = rows.map(row => `<tr><td>${row.label || `E${row.id}`}</td><td>${fmt(row.start)} m</td><td>${fmt(row.end)} m</td><td>${fmt(row.nStart)} kN</td><td>${fmt(row.nEnd)} kN</td><td>${fmt(row.vStart)} kN</td><td>${fmt(row.vEnd)} kN</td><td>${fmt(row.mStart)} kNm</td><td>${fmt(row.mMid)} kNm</td><td>${fmt(row.mEnd)} kNm</td></tr>`).join('');
}

const valueLabelPlugin = {
  id: 'valueLabelPlugin',
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx;
    ctx.save();
    const { chartArea, scales } = chart;
    if (!chartArea || !scales?.x) return;

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      if (dataset.hidden || !dataset.data?.length) return;
      const meta = chart.getDatasetMeta(datasetIndex);
      const values = dataset.data.map(point => point.y);
      const rawValues = dataset.rawValues || values;

      // Always show: first, last, max-abs, min-abs
      const indices = new Set();
      indices.add(0);                                           // start
      indices.add(values.length - 1);                          // end
      indices.add(rawValues.map(Math.abs).indexOf(Math.max(...rawValues.map(Math.abs)))); // peak
      // add min only if meaningfully different
      const minIdx = rawValues.indexOf(Math.min(...rawValues));
      if (Math.abs(rawValues[minIdx]) > 0.01) indices.add(minIdx);

      ctx.font = '700 10.5px Inter, sans-serif';

      indices.forEach(index => {
        const point = meta.data[index];
        if (!point) return;
        const rawVal = rawValues[index] ?? values[index];
        if (Math.abs(rawVal) < 0.001) return; // skip near-zero

        const displayVal = `${fmt(rawVal)} ${dataset.unit}`;
        const metrics = ctx.measureText(displayVal);
        const pw = metrics.width + 10;
        const ph = 18;

        // position: above baseline if positive band, below if negative
        const isFirst = index === 0;
        const isLast = index === values.length - 1;
        let px = point.x;
        let py = values[index] >= 0 ? point.y - 13 : point.y + 22;

        // clamp horizontally inside chart area
        px = Math.max(chartArea.left + pw / 2 + 2, Math.min(px, chartArea.right - pw / 2 - 2));

        // pill background
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.strokeStyle = dataset.borderColor + '88';
        ctx.lineWidth = 1;
        const rx = 4;
        ctx.beginPath();
        ctx.roundRect(px - pw / 2, py - 13, pw, ph, rx);
        ctx.fill();
        ctx.stroke();

        // text
        ctx.fillStyle = dataset.borderColor;
        ctx.textAlign = 'center';
        ctx.fillText(displayVal, px, py);

        // tiny dot at data point
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = dataset.borderColor;
        ctx.fill();
      });
    });
    ctx.restore();
  }
};

function chartDataset(label, data, color, unit, hidden = false, rawValues = null, baseline = 0) {
  return {
    label,
    data,
    unit,
    rawValues,
    hidden,
    parsing: false,
    borderColor: color,
    backgroundColor: color + '22',
    fill: {
      target: { value: baseline },
      above: color + '22',
      below: color + '22'
    },
    tension: 0,
    pointRadius: 0,
    pointHitRadius: 12,
    borderWidth: 2.8,
    borderJoinStyle: 'round',
    borderCapStyle: 'round'
  };
}

const diagramBands = {
  afd: { center: 2, label: 'AFD' },
  sfd: { center: 0, label: 'SFD' },
  bmd: { center: -2, label: 'BMD' }
};

function toBandData(points, band, rawValues = null) {
  const values = rawValues || points.map(point => point.y);
  const maxAbs = Math.max(...values.map(value => Math.abs(value)), 1);
  const amplitude = 0.62;
  return points.map((point, index) => ({
    x: point.x,
    y: diagramBands[band].center + (point.y / maxAbs) * amplitude
  }));
}

const bandGuidePlugin = {
  id: 'bandGuidePlugin',
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales?.y) return;
    ctx.save();

    const bandColors = {
      bmd: { line: 'rgba(212,0,0,.2)', fill: 'rgba(212,0,0,.04)', text: '#d40000' },
      sfd: { line: 'rgba(0,77,255,.18)', fill: 'rgba(0,77,255,.04)', text: '#004dff' },
      afd: { line: 'rgba(107,79,216,.18)', fill: 'rgba(107,79,216,.04)', text: '#6b4fd8' }
    };

    Object.entries(diagramBands).forEach(([key, band]) => {
      const yPx = scales.y.getPixelForValue(band.center);
      const c = bandColors[key];

      // dashed baseline
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = c.line;
      ctx.beginPath();
      ctx.moveTo(chartArea.left, yPx);
      ctx.lineTo(chartArea.right, yPx);
      ctx.stroke();
      ctx.setLineDash([]);

      // pill label
      const label = band.label;
      ctx.font = '800 11px Inter, sans-serif';
      const tw = ctx.measureText(label).width;
      const px = chartArea.left + 8;
      const py = yPx - 9;
      const pw = tw + 14;
      const ph = 18;

      ctx.fillStyle = 'rgba(255,255,255,.95)';
      ctx.strokeStyle = c.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = c.text;
      ctx.textAlign = 'left';
      ctx.fillText(label, px + 7, py + 13);
    });

    ctx.restore();
  }
};

function buildJumpAwareSeries(loads, reactions, key, valueFn) {
  const minX = Math.min(...state.nodes.map(node => node.x));
  const maxX = Math.max(...state.nodes.map(node => node.x));
  const breakpoints = new Set([minX, maxX]);
  state.nodes.forEach(node => breakpoints.add(node.x));
  reactions.forEach(reaction => breakpoints.add(reaction.x));
  loads.forEach(load => {
    if (load.type === 'point') breakpoints.add(load.x);
    if (load.type === 'udl') { breakpoints.add(load.a); breakpoints.add(load.b); }
  });
  const points = [...breakpoints].sort((a, b) => a - b);
  const series = [];
  points.forEach((x, index) => {
    const leftValue = index === 0 ? valueFn(x + 1e-7) : valueFn(x - 1e-7);
    const rightValue = index === points.length - 1 ? valueFn(x - 1e-7) : valueFn(x + 1e-7);
    if (index > 0) series.push({ x, y: leftValue, source: key });
    series.push({ x, y: rightValue, source: key });
  });
  return series;
}

function renderCharts(samples, loads, reactions) {
  const afdRaw = buildJumpAwareSeries(loads, reactions, 'axial', x => axialAt(x, loads, reactions));
  const sfdRaw = buildJumpAwareSeries(loads, reactions, 'shear', x => shearAt(x, loads, reactions));
  const bmdRaw = samples.map(item => ({ x: item.x, y: item.moment }));
  const bmdDisplay = bmdRaw.map(point => ({ x: point.x, y: -point.y }));
  const afdData = toBandData(afdRaw, 'afd');
  const sfdData = toBandData(sfdRaw, 'sfd');
  const bmdData = toBandData(bmdDisplay, 'bmd', bmdRaw.map(point => point.y));
  const afdRawValues = afdRaw.map(point => point.y);
  const sfdRawValues = sfdRaw.map(point => point.y);
  const bmdRawValues = bmdRaw.map(point => point.y);
  const mode = controls.diagramOutput.value;
  const shouldHide = name => mode !== 'all' && mode !== name;
  const minX = Math.min(...state.nodes.map(node => node.x));
  const maxX = Math.max(...state.nodes.map(node => node.x));
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: false },
    plugins: {
      legend: {
        display: true,
        labels: { usePointStyle: true, boxWidth: 9, font: { weight: 800 } }
      },
      tooltip: {
        callbacks: {
          label(context) {
            const dataset = context.dataset;
            const rawValue = dataset.rawValues?.[context.dataIndex] ?? context.parsed.y;
            return `${dataset.label}: ${fmt(rawValue)} ${dataset.unit}`;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        min: minX,
        max: maxX,
        title: { display: true, text: 'x (m)' },
        ticks: { maxTicksLimit: 8, callback: value => fmt(value) }
      },
      y: {
        min: -2.9,
        max: 2.9,
        title: { display: true, text: 'AFD / SFD / BMD' },
        ticks: {
          stepSize: 1,
          callback(value) {
            if (Math.abs(value - diagramBands.afd.center) < 0.01) return 'AFD';
            if (Math.abs(value - diagramBands.sfd.center) < 0.01) return 'SFD';
            if (Math.abs(value - diagramBands.bmd.center) < 0.01) return 'BMD';
            return '';
          }
        }
      }
    }
  };

  if (state.forceChart) state.forceChart.destroy();
  state.forceChart = new Chart($('#forceDiagramChart'), {
    type: 'line',
    data: {
      datasets: [
        chartDataset('AFD - N', afdData, '#6b4fd8', 'kN', shouldHide('afd'), afdRawValues, diagramBands.afd.center),
        chartDataset('SFD - V', sfdData, '#004dff', 'kN', shouldHide('sfd'), sfdRawValues, diagramBands.sfd.center),
        chartDataset('BMD - M', bmdData, '#d40000', 'kNm', shouldHide('bmd'), bmdRawValues, diagramBands.bmd.center)
      ]
    },
    options,
    plugins: [bandGuidePlugin, valueLabelPlugin]
  });
}
function updateChartVisibility() {
  const mode = controls.diagramOutput.value;
  if (!state.forceChart) return;
  state.forceChart.data.datasets.forEach(dataset => {
    if (dataset.label.startsWith('AFD')) dataset.hidden = mode !== 'all' && mode !== 'afd';
    if (dataset.label.startsWith('SFD')) dataset.hidden = mode !== 'all' && mode !== 'sfd';
    if (dataset.label.startsWith('BMD')) dataset.hidden = mode !== 'all' && mode !== 'bmd';
  });
  state.forceChart.update();
}

function analyze() {
  try {
    const model = validateModel();
    const loads = normalizeLoads();
    const reactions = solveReactions(model, loads);
    const samples = sampleBeam(loads, reactions);
    const table = buildElementTable(loads, reactions);
    renderSummary(reactions, samples);
    renderTable(table);
    renderCharts(samples, loads, reactions);
    showMessage('Analisis berhasil. Support pin, roller, dan fixed dihitung dengan metode kekakuan balok 1D.', true);
  } catch (error) {
    $('#reactionResults').innerHTML = '';
    $('#forceTableBody').innerHTML = '<tr><td colspan="10">Belum ada hasil analisis.</td></tr>';
    showMessage(error.message);
  }
}

function addNode() {
  const x = Number(controls.nodeX.value);
  if (!Number.isFinite(x)) return showMessage('Posisi node harus berupa angka.');
  if (state.nodes.some(node => Math.abs(node.x - x) < eps)) return showMessage('Sudah ada node pada posisi X tersebut.');
  state.nodes.push({ id: state.nextNodeId++, x, support: 'free' });
  controls.nodeX.value = '';
  refresh();
}

function addElement() {
  const startNode = Number(controls.elementStart.value);
  const endNode = Number(controls.elementEnd.value);
  if (!startNode || !endNode || startNode === endNode) return showMessage('Node awal dan akhir element harus berbeda.');
  const a = getNode(startNode);
  const b = getNode(endNode);
  if (Math.abs(a.x - b.x) < eps) return showMessage('Panjang element tidak boleh nol.');
  const exists = state.elements.some(element => [element.startNode, element.endNode].sort().join('-') === [startNode, endNode].sort().join('-'));
  if (exists) return showMessage('Element tersebut sudah ada.');
  state.elements.push({ id: state.nextElementId++, startNode, endNode });
  refresh();
}

function setSupport() {
  const node = getNode(controls.supportNode.value);
  if (!node) return showMessage('Pilih node support.');
  node.support = controls.supportType.value;
  refresh();
}

function addPointLoad() {
  const p = Number(controls.pointLoadValue.value);
  if (!Number.isFinite(p) || Math.abs(p) < eps) return showMessage('Nilai beban titik harus diisi.');
  let x = null;
  if (controls.pointLoadTarget.value === 'node') {
    const node = getNode(controls.pointLoadNode.value);
    if (!node) return showMessage('Pilih node untuk beban titik.');
    x = node.x;
  } else {
    const element = getElement(controls.pointLoadElement.value);
    if (!element) return showMessage('Pilih element untuk beban titik.');
    const ends = elementEnds(element);
    const offset = Number(controls.pointLoadOffset.value);
    if (!Number.isFinite(offset) || offset < -eps || offset > ends.length + eps) return showMessage('Beban tidak boleh berada di luar panjang element.');
    x = getNode(element.startNode).x <= getNode(element.endNode).x ? getNode(element.startNode).x + offset : getNode(element.startNode).x - offset;
  }
  const angle = Number(controls.pointLoadAngle.value || 90);
  if (!Number.isFinite(angle)) return showMessage('Sudut beban harus berupa angka derajat.');
  const radians = (angle * Math.PI) / 180;
  const fx = Math.abs(p * Math.cos(radians)) < 1e-7 ? 0 : p * Math.cos(radians);
  const fy = Math.abs(p * Math.sin(radians)) < 1e-7 ? 0 : p * Math.sin(radians);
  state.loads.push({ id: state.nextLoadId, type: 'point', direction: 'inclined', x, p, angle, fx, fy, label: `P${state.nextLoadId}` });
  state.nextLoadId += 1;
  controls.pointLoadValue.value = '';
  controls.pointLoadAngle.value = '90';
  refresh();
}

function addUdl() {
  const startNode = getNode(controls.udlStartNode.value);
  const endNode = getNode(controls.udlEndNode.value);
  const w = Number(controls.udlValue.value);
  if (!startNode || !endNode) return showMessage('Pilih node awal dan node akhir beban merata.');
  if (startNode.id === endNode.id || Math.abs(startNode.x - endNode.x) < eps) return showMessage('Rentang beban merata tidak boleh nol.');
  if (!isUdlRangeCovered(startNode, endNode)) return showMessage('Rentang beban merata harus mengikuti element yang sudah dibuat.');
  if (!Number.isFinite(w) || Math.abs(w) < eps) return showMessage('Nilai beban merata harus diisi.');
  state.loads.push({ id: state.nextLoadId, type: 'udl', startNode: startNode.id, endNode: endNode.id, w, label: `w${state.nextLoadId}` });
  state.nextLoadId += 1;
  controls.udlValue.value = '';
  refresh();
}

function resetModel() {
  state.nodes = [];
  state.elements = [];
  state.loads = [];
  state.nextNodeId = 1;
  state.nextElementId = 1;
  state.nextLoadId = 1;
  if (state.forceChart) state.forceChart.destroy();
  state.forceChart = null;
  $('#reactionResults').innerHTML = '';
  $('#forceTableBody').innerHTML = '<tr><td colspan="10">Belum ada hasil analisis.</td></tr>';
  showMessage('Model direset. Tambahkan node sesuai panjang balok yang diinginkan.', true);
  refresh();
}

function loadPresetModel() {
  const key = controls.presetModel?.value || '';
  const preset = presets[key];
  if (!preset) return showMessage('Pilih preset soal terlebih dahulu.');
  if (state.nodes.length || state.elements.length || state.loads.length) {
    const ok = confirm('Preset akan mengganti model yang sedang dibuat. Lanjutkan?');
    if (!ok) return;
  }
  if (state.forceChart) state.forceChart.destroy();
  state.forceChart = null;
  state.nodes = preset.nodes.map(node => ({ ...node }));
  state.elements = preset.elements.map(element => ({ ...element }));
  state.loads = preset.loads.map(load => ({ ...load }));
  state.nextNodeId = Math.max(...state.nodes.map(node => node.id), 0) + 1;
  state.nextElementId = Math.max(...state.elements.map(element => Number(element.id) || 0), 0) + 1;
  state.nextLoadId = Math.max(...state.loads.map(load => load.id), 0) + 1;
  $('#reactionResults').innerHTML = '';
  $('#forceTableBody').innerHTML = '<tr><td colspan="10">Belum ada hasil analisis.</td></tr>';
  refresh();
  showMessage(preset.message, true);
}

function refresh() {
  refreshSelects();
  renderSvg();
  renderModelList();
}

$('#addNodeBtn').addEventListener('click', addNode);
$('#addElementBtn').addEventListener('click', addElement);
$('#setSupportBtn').addEventListener('click', setSupport);
$('#addPointLoadBtn').addEventListener('click', addPointLoad);
$('#addUdlBtn').addEventListener('click', addUdl);
$('#analyzeBtn').addEventListener('click', analyze);
$('#resetBtn').addEventListener('click', resetModel);
$('#loadPresetBtn').addEventListener('click', loadPresetModel);
controls.pointLoadTarget.addEventListener('change', refreshSelects);
controls.diagramOutput.addEventListener('change', updateChartVisibility);

refresh();
showMessage('Mulai dengan menambahkan node sesuai panjang balok yang diinginkan.', true);

