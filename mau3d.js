// MAU-05 Three.js 3D Viewer — ES Module
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Component definitions ─────────────────────────────────────────
const DEF = {
  g4:   { label:'初效濾 G4',    depth:0.22, cat:'filter', col:0x1e5030, top:0x2e8050 },
  f7:   { label:'中效濾 F7',    depth:0.28, cat:'filter', col:0x1e3870, top:0x2850b0 },
  hepa: { label:'高效濾 HEPA',  depth:0.34, cat:'filter', col:0x4a1888, top:0x6828b8 },
  chw:  { label:'冰水盤管 CHW', depth:0.52, cat:'chw',    col:0x0e2e80, top:0x1858c0 },
  hhw:  { label:'熱水盤管 HHW', depth:0.52, cat:'hhw',    col:0x801808, top:0xc03018 },
  wash: { label:'水洗段',        depth:0.68, cat:'wash',   col:0x083858, top:0x1080a8 },
  fan:  { label:'送風機 FAN',   depth:0.90, cat:'fan',    col:0x283040, top:0x4060a0 },
};

const PARAMS_DEF = {
  g4:   [
    { key:'eff',   label:'過濾效率', unit:'%',  val:70  },
    { key:'dP0',   label:'初阻',     unit:'Pa', val:50  },
    { key:'dPmax', label:'終阻',     unit:'Pa', val:150 },
  ],
  f7:   [
    { key:'eff',   label:'過濾效率', unit:'%',  val:85  },
    { key:'dP0',   label:'初阻',     unit:'Pa', val:100 },
    { key:'dPmax', label:'終阻',     unit:'Pa', val:250 },
  ],
  hepa: [
    { key:'eff',   label:'過濾效率', unit:'%',  val:99.97 },
    { key:'dP0',   label:'初阻',     unit:'Pa', val:250   },
    { key:'dPmax', label:'終阻',     unit:'Pa', val:600   },
  ],
  chw:  [
    { key:'Ts',   label:'供水溫度', unit:'°C',   val:7   },
    { key:'Tr',   label:'回水溫度', unit:'°C',   val:12  },
    { key:'Q',    label:'冷卻量',   unit:'kW',   val:50  },
    { key:'rows', label:'排數',     unit:'排',   val:4   },
    { key:'flow', label:'水流量',   unit:'m³/h', val:8.6 },
  ],
  hhw:  [
    { key:'Ts',   label:'供水溫度', unit:'°C',   val:60  },
    { key:'Tr',   label:'回水溫度', unit:'°C',   val:50  },
    { key:'Q',    label:'加熱量',   unit:'kW',   val:30  },
    { key:'rows', label:'排數',     unit:'排',   val:2   },
    { key:'flow', label:'水流量',   unit:'m³/h', val:2.6 },
  ],
  wash: [
    { key:'P',      label:'水壓',   unit:'bar',   val:2.5 },
    { key:'nozzle', label:'噴嘴數', unit:'個',    val:12  },
    { key:'flow',   label:'噴水量', unit:'L/min', val:30  },
  ],
  fan:  [
    { key:'Q',   label:'風量', unit:'m³/h', val:10000 },
    { key:'Ps',  label:'靜壓', unit:'Pa',   val:800   },
    { key:'kW',  label:'功率', unit:'kW',   val:11    },
    { key:'rpm', label:'轉速', unit:'rpm',  val:1450  },
    { key:'eta', label:'效率', unit:'%',    val:68    },
  ],
};

// ── Scene state ───────────────────────────────────────────────────
const W = 1.6, H = 1.6;  // duct cross-section
const INLET = 0.7, OUTLET = 0.7, GAP = 0.1;

let scene, camera, renderer, controls, raycaster;
let ductGroup = null, extraGroup = null;
const compGroups = [];     // { group, id, key }
const paramStore = {};     // { compId: { paramKey: value } }
let selectedId = null;

// ── Init ──────────────────────────────────────────────────────────
function init() {
  const container = document.getElementById('mau3d-container');
  if (!container || renderer) return;

  const light = document.body.dataset.theme === 'light';

  // Scene & background
  scene = new THREE.Scene();
  scene.background = new THREE.Color(light ? 0xe6ecf5 : 0x060c16);

  // Camera
  const w = container.clientWidth  || 640;
  const h = container.clientHeight || 400;
  camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
  camera.position.set(3.2, 2.0, 4.8);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  // Lights
  scene.add(new THREE.AmbientLight(0x8898b0, light ? 3.5 : 2.0));

  const key = new THREE.DirectionalLight(0xffffff, light ? 2.0 : 3.2);
  key.position.set(4, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x00d4aa, 0.55);
  fill.position.set(-3, -1, -2);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0x4070cc, 0.3);
  rim.position.set(0, -3, 6);
  scene.add(rim);

  // Ground grid (dark mode)
  if (!light) {
    const grid = new THREE.GridHelper(18, 36, 0x142030, 0x0a1520);
    grid.position.y = -(H / 2 + 0.08);
    scene.add(grid);
  }

  // OrbitControls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 1.5;
  controls.maxDistance = 22;
  controls.target.set(0, 0, 0);

  // Raycaster
  raycaster = new THREE.Raycaster();

  // Events
  renderer.domElement.style.cursor = 'grab';
  controls.addEventListener('start', () => { renderer.domElement.style.cursor = 'grabbing'; });
  controls.addEventListener('end',   () => { renderer.domElement.style.cursor = 'grab'; });
  renderer.domElement.addEventListener('click', onCanvasClick);

  // Resize observer
  new ResizeObserver(() => {
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (!cw || !ch) return;
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();
    renderer.setSize(cw, ch);
  }).observe(container);

  // Theme observer — update background on toggle
  new MutationObserver(() => {
    if (!scene) return;
    const lm = document.body.dataset.theme === 'light';
    scene.background.set(lm ? 0xe6ecf5 : 0x060c16);
  }).observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

  // Render loop
  (function loop() {
    requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  })();

  // Signal app.js that the 3D scene is ready
  window.dispatchEvent(new Event('mau3d-ready'));
}

// ── Build Scene ───────────────────────────────────────────────────
function buildScene(comps) {
  // Clear previous objects
  if (ductGroup)  { scene.remove(ductGroup);  ductGroup = null;  }
  if (extraGroup) { scene.remove(extraGroup); extraGroup = null; }
  while (compGroups.length) { scene.remove(compGroups.pop().group); }

  // Layout calculations
  let compLen = 0;
  comps.forEach(c => { const d = DEF[c.key]; if (d) compLen += d.depth + GAP; });
  if (comps.length) compLen -= GAP;

  const totalLen = INLET + (comps.length ? GAP + compLen + GAP : 0) + OUTLET;
  const xStart   = -totalLen / 2;

  // Build duct shell
  ductGroup = buildDuct(totalLen, xStart);
  scene.add(ductGroup);

  // Build components
  let xCursor = xStart + INLET + (comps.length ? GAP : 0);
  comps.forEach(comp => {
    const def = DEF[comp.key];
    if (!def) return;

    // Init default params for new component
    if (!paramStore[comp.id]) {
      paramStore[comp.id] = {};
      (PARAMS_DEF[comp.key] || []).forEach(p => { paramStore[comp.id][p.key] = p.val; });
    }

    const group = buildComp(comp.key, def, xCursor);
    group.userData = { id: comp.id, key: comp.key };
    group.traverse(o => { if (o.isMesh) o.userData.compId = comp.id; });

    scene.add(group);
    compGroups.push({ group, id: comp.id, key: comp.key });
    xCursor += def.depth + GAP;
  });

  // OA / SA labels + airflow arrow
  extraGroup = new THREE.Group();
  addLabel(extraGroup, 'OA →', xStart + INLET * 0.5, H * 0.6, W / 2 + 0.12, 0xf0a430);
  addLabel(extraGroup, '→ SA', xStart + totalLen - OUTLET * 0.5, H * 0.6, W / 2 + 0.12, 0x00d4aa);

  if (comps.length) {
    const from = new THREE.Vector3(xStart + INLET + 0.05, 0, 0);
    const to   = new THREE.Vector3(xStart + totalLen - OUTLET - 0.05, 0, 0);
    const dir  = to.clone().sub(from).normalize();
    const arrow = new THREE.ArrowHelper(dir, from, to.distanceTo(from), 0x1a4060, 0.14, 0.09);
    arrow.line.material.opacity = 0.25;
    arrow.line.material.transparent = true;
    extraGroup.add(arrow);
  }
  scene.add(extraGroup);
}

// ── Duct Shell ────────────────────────────────────────────────────
function buildDuct(totalLen, xStart) {
  const group = new THREE.Group();
  const cx = xStart + totalLen / 2;
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1a2d3d, metalness: 0.65, roughness: 0.45,
    transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false,
  });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x1e3a50 });

  // 4 wall panels
  const panels = [
    { size:[totalLen, 0.04, H],  pos:[cx,  H/2+0.02, 0] },
    { size:[totalLen, 0.04, H],  pos:[cx, -H/2-0.02, 0] },
    { size:[totalLen, H, 0.04],  pos:[cx, 0,  W/2+0.02] },
    { size:[totalLen, H, 0.04],  pos:[cx, 0, -W/2-0.02] },
  ];
  panels.forEach(({ size, pos }) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    m.position.set(...pos);
    group.add(m);
  });

  // Corner edge lines
  const corners = [[-W/2,H/2],[W/2,H/2],[W/2,-H/2],[-W/2,-H/2]];
  corners.forEach(([z, y]) => {
    const pts = [
      new THREE.Vector3(xStart, y, z),
      new THREE.Vector3(xStart + totalLen, y, z),
    ];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), edgeMat));
  });

  // Inlet / outlet frames
  [xStart, xStart + totalLen].forEach(x => {
    const frameGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.06, H + 0.06, W + 0.06));
    const frame = new THREE.LineSegments(frameGeo, new THREE.LineBasicMaterial({ color: 0x28485e }));
    frame.position.x = x;
    group.add(frame);
  });

  return group;
}

// ── Component Mesh ────────────────────────────────────────────────
function buildComp(key, def, x0) {
  const group = new THREE.Group();
  const D = def.depth;
  const cx = x0 + D / 2;

  const mat = new THREE.MeshStandardMaterial({
    color: def.col,
    metalness: 0.38,
    roughness: 0.62,
    emissive: new THREE.Color(def.top).multiplyScalar(0.08),
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(D, H * 0.93, W * 0.93), mat.clone());
  body.position.x = cx;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Edge glow
  const eMat = new THREE.LineBasicMaterial({ color: def.top, transparent: true, opacity: 0.55 });
  const eLines = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), eMat);
  eLines.position.x = cx;
  group.add(eLines);

  // Category detail
  if      (def.cat === 'filter')           addFilterDetail(group, key, def, cx, D);
  else if (def.cat === 'chw' || def.cat === 'hhw') addCoilDetail(group, def, cx, D);
  else if (def.cat === 'wash')             addWashDetail(group, def, cx, D);
  else if (def.cat === 'fan')              addFanDetail(group, def, cx, D);

  return group;
}

function addFilterDetail(group, key, def, cx, D) {
  // Grid lines on front face (+X face)
  const cols = key === 'hepa' ? 9 : key === 'f7' ? 7 : 5;
  const rows = 6;
  const yh = (H * 0.93) / 2, zh = (W * 0.93) / 2;
  const pts = [];
  const eps = D / 2 + 0.002;

  for (let r = 1; r < rows; r++) {
    const y = -yh + (r / rows) * H * 0.93;
    pts.push(new THREE.Vector3(cx + eps, y, -zh), new THREE.Vector3(cx + eps, y,  zh));
  }
  for (let c = 1; c < cols; c++) {
    const z = -zh + (c / cols) * W * 0.93;
    pts.push(new THREE.Vector3(cx + eps, -yh, z), new THREE.Vector3(cx + eps,  yh, z));
  }

  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const idx = []; for (let i = 0; i < pts.length; i += 2) idx.push(i, i + 1);
  geo.setIndex(idx);
  group.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    color: def.top, transparent: true, opacity: 0.55,
  })));
}

function addCoilDetail(group, def, cx, D) {
  const hot = def.cat === 'hhw';
  const tubeMat = new THREE.MeshStandardMaterial({
    color: hot ? 0xff6020 : 0x20b0ff,
    emissive: hot ? 0x200800 : 0x001828,
    metalness: 0.72, roughness: 0.28,
  });
  const hdrMat = new THREE.MeshStandardMaterial({
    color: def.top, metalness: 0.82, roughness: 0.2,
  });

  const rows = 6;
  for (let r = 0; r < rows; r++) {
    const y = -H * 0.37 + (r / (rows - 1)) * H * 0.74;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, W * 0.86, 10), tubeMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(cx, y, 0);
    group.add(tube);
  }

  // Header manifolds on left/right sides
  [-1, 1].forEach(side => {
    const hdr = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, H * 0.80, 10), hdrMat);
    hdr.position.set(cx, 0, side * W * 0.43);
    group.add(hdr);
  });
}

function addWashDetail(group, def, cx, D) {
  const dropMat = new THREE.MeshStandardMaterial({
    color: 0x40d0ff, emissive: 0x004860,
    transparent: true, opacity: 0.72, metalness: 0.1, roughness: 0.6,
  });
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x7090a0, metalness: 0.8, roughness: 0.2 });
  const n = 4;

  for (let i = 0; i < n; i++) {
    const z = -W * 0.34 + (i / (n - 1)) * W * 0.68;

    // Nozzle sphere
    const nozzle = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), nozzleMat);
    nozzle.position.set(cx, H * 0.41, z);
    group.add(nozzle);

    // Droplets
    for (let d = 0; d < 6; d++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.022, 5, 4), dropMat);
      const a = ((d / 6) * Math.PI * 0.7) - Math.PI * 0.35;
      drop.position.set(cx, H * 0.41 - 0.12 - d * 0.09, z + Math.sin(a) * 0.13);
      group.add(drop);
    }
  }
}

function addFanDetail(group, def, cx, D) {
  const r = Math.min(W, H) * 0.40;
  const fx = cx + D / 2 + 0.008; // face x position

  // Housing ring (Torus)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(r, 0.038, 10, 48),
    new THREE.MeshStandardMaterial({ color: def.top, metalness: 0.68, roughness: 0.32 })
  );
  ring.rotation.y = Math.PI / 2;
  ring.position.x = fx;
  group.add(ring);

  // Hub
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.12, r * 0.12, 0.07, 12),
    new THREE.MeshStandardMaterial({ color: 0x405870, metalness: 0.75, roughness: 0.28 })
  );
  hub.rotation.z = Math.PI / 2;
  hub.position.x = fx;
  group.add(hub);

  // Blades
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x4878a8, metalness: 0.5, roughness: 0.42,
    transparent: true, opacity: 0.88,
  });
  const nBlades = 7;
  for (let b = 0; b < nBlades; b++) {
    const angle = (b / nBlades) * Math.PI * 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.025, r * 0.76, r * 0.24), bladeMat);
    blade.position.set(fx, Math.sin(angle) * r * 0.48, Math.cos(angle) * r * 0.48);
    blade.rotation.x = angle + 0.4;
    blade.rotation.y = Math.PI / 2;
    group.add(blade);
  }
}

// ── Label sprite ──────────────────────────────────────────────────
function addLabel(group, text, x, y, z, hexColor) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.font = 'bold 26px Rajdhani, sans-serif';
  ctx.fillStyle = '#' + hexColor.toString(16).padStart(6, '0');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }));
  spr.position.set(x, y, z);
  spr.scale.set(0.9, 0.22, 1);
  group.add(spr);
}

// ── Click / Raycasting ────────────────────────────────────────────
function onCanvasClick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const mx =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
  const my = -((event.clientY - rect.top)  / rect.height) * 2 + 1;
  raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);

  const meshes = [];
  compGroups.forEach(cg => cg.group.traverse(o => { if (o.isMesh) meshes.push(o); }));

  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length && hits[0].object.userData.compId !== undefined) {
    showParamPanel(hits[0].object.userData.compId);
  } else {
    hideParamPanel();
  }
}

// ── Parameter Panel ───────────────────────────────────────────────
function showParamPanel(id) {
  if (selectedId !== null) highlightComp(selectedId, false);
  selectedId = id;
  highlightComp(id, true);

  const cg = compGroups.find(c => c.id === id);
  if (!cg) return;
  const def   = DEF[cg.key];
  const pdefs = PARAMS_DEF[cg.key] || [];
  const vals  = paramStore[id] || {};

  const panel = document.getElementById('mau3d-param-panel');
  if (!panel) return;

  panel.innerHTML = `
    <div class="mpanel-hdr">
      <span class="mpanel-title">${def.label}</span>
      <button class="mpanel-close" onclick="window.mau3dClosePanel()">✕</button>
    </div>
    <div class="mpanel-body">
      ${pdefs.map(p => `
        <div class="mpanel-row">
          <label class="mpanel-label">${p.label}</label>
          <div class="mpanel-input-wrap">
            <input class="mpanel-input" type="number" step="any"
              value="${vals[p.key] !== undefined ? vals[p.key] : p.val}"
              onchange="window.mau3dSaveParam(${id},'${p.key}',this.value)">
            <span class="mpanel-unit">${p.unit}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  panel.classList.add('visible');
}

function hideParamPanel() {
  if (selectedId !== null) { highlightComp(selectedId, false); selectedId = null; }
  const panel = document.getElementById('mau3d-param-panel');
  if (panel) panel.classList.remove('visible');
}

function highlightComp(id, on) {
  const cg = compGroups.find(c => c.id === id);
  if (!cg) return;
  cg.group.traverse(o => {
    if (o.isMesh && o.material) {
      if (on) {
        o.material.emissiveIntensity = 0.55;
        o.material.emissive?.set(DEF[cg.key]?.top || 0x4080ff);
      } else {
        o.material.emissiveIntensity = 1.0;
        if (o.material.emissive) o.material.emissive.set(new THREE.Color(DEF[cg.key]?.top || 0).multiplyScalar(0.08));
      }
    }
  });
}

// ── Public API ────────────────────────────────────────────────────
window.mau3dRefresh = function (comps) {
  if (!scene) { setTimeout(() => window.mau3dRefresh(comps), 80); return; }
  hideParamPanel();
  buildScene(comps);
};

window.mau3dClosePanel  = hideParamPanel;
window.mau3dSaveParam   = function (id, key, val) {
  if (!paramStore[id]) paramStore[id] = {};
  paramStore[id][key] = parseFloat(val);
};

// ── Bootstrap ─────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
