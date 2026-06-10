// MAU-05 Three.js 3D Viewer — ES Module
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Component definitions (YSM AHU Segments) ─────────────────────
const DEF = {
  ai:       { label:'進風段 AI',   depth:0.28, cat:'damper', col:0x1a2838, top:0x3a5870 },
  mb:       { label:'混合箱 MB',   depth:0.38, cat:'mixing', col:0x102030, top:0x208878 },
  ee:       { label:'節能段 EE',   depth:0.38, cat:'mixing', col:0x101e30, top:0x306090 },
  'pf-g4':  { label:'板式濾 G4',   depth:0.16, cat:'filter', col:0x1e5030, top:0x2e8050 },
  'pf-f7':  { label:'袋式濾 F7',   depth:0.26, cat:'filter', col:0x1e3870, top:0x2850b0 },
  'hf-h13': { label:'高效濾 H13',  depth:0.32, cat:'filter', col:0x4a1888, top:0x6828b8 },
  cc:       { label:'冷水盤管 CC', depth:0.52, cat:'chw',    col:0x0e2e80, top:0x1858c0 },
  hc:       { label:'熱水盤管 HC', depth:0.52, cat:'hhw',    col:0x801808, top:0xc03018 },
  eh:       { label:'電熱段 EH',   depth:0.22, cat:'heater', col:0x601010, top:0xff4020 },
  ep:       { label:'靜電除塵 EP', depth:0.22, cat:'ep',     col:0x2a3010, top:0xa0b020 },
  sf_d:     { label:'送風機 SF-D', depth:0.90, cat:'fan',    col:0x283040, top:0x4060a0 },
  sf_e:     { label:'送風機 EC',   depth:0.90, cat:'fan',    col:0x1a3848, top:0x28a880 },
  rf_d:     { label:'回風機 RF-D', depth:0.90, cat:'fan',    col:0x283040, top:0x6040a0 },
  es:       { label:'空段 ES',     depth:0.30, cat:'empty',  col:0x161e28, top:0x2a3848 },
  ao:       { label:'出風段 AO',   depth:0.28, cat:'damper', col:0x1a2838, top:0x3a5870 },
};

const PARAMS_DEF = {
  ai: [{ key:'dP', label:'阻力', unit:'Pa', val:20 }],
  ao: [{ key:'dP', label:'阻力', unit:'Pa', val:20 }],
  mb: [{ key:'OA', label:'新風比', unit:'%', val:30 }, { key:'dP', label:'阻力', unit:'Pa', val:30 }],
  ee: [{ key:'OA', label:'新風比', unit:'%', val:30 }, { key:'dP', label:'阻力', unit:'Pa', val:30 }],
  'pf-g4':  [{ key:'eff', label:'過濾效率', unit:'%', val:70 }, { key:'dP0', label:'初阻', unit:'Pa', val:50 }, { key:'dPmax', label:'終阻', unit:'Pa', val:150 }],
  'pf-f7':  [{ key:'eff', label:'過濾效率', unit:'%', val:85 }, { key:'dP0', label:'初阻', unit:'Pa', val:100 }, { key:'dPmax', label:'終阻', unit:'Pa', val:250 }],
  'hf-h13': [{ key:'eff', label:'過濾效率', unit:'%', val:99.95 }, { key:'dP0', label:'初阻', unit:'Pa', val:250 }, { key:'dPmax', label:'終阻', unit:'Pa', val:600 }],
  cc:  [{ key:'Ts', label:'供水溫度', unit:'°C', val:7 }, { key:'Tr', label:'回水溫度', unit:'°C', val:12 }, { key:'Q', label:'冷卻量', unit:'kW', val:50 }, { key:'rows', label:'排數', unit:'排', val:6 }, { key:'flow', label:'水流量', unit:'m³/h', val:8.6 }],
  hc:  [{ key:'Ts', label:'供水溫度', unit:'°C', val:60 }, { key:'Tr', label:'回水溫度', unit:'°C', val:50 }, { key:'Q', label:'加熱量', unit:'kW', val:30 }, { key:'rows', label:'排數', unit:'排', val:2 }, { key:'flow', label:'水流量', unit:'m³/h', val:2.6 }],
  eh:  [{ key:'kW', label:'加熱功率', unit:'kW', val:20 }, { key:'V', label:'電壓', unit:'V', val:380 }, { key:'dP', label:'阻力', unit:'Pa', val:25 }],
  ep:  [{ key:'eff', label:'除塵效率', unit:'%', val:90 }, { key:'kV', label:'電壓', unit:'kV', val:12 }, { key:'dP0', label:'初阻', unit:'Pa', val:30 }],
  sf_d: [{ key:'Q', label:'風量', unit:'m³/h', val:10000 }, { key:'Ps', label:'靜壓', unit:'Pa', val:800 }, { key:'kW', label:'功率', unit:'kW', val:11 }, { key:'rpm', label:'轉速', unit:'rpm', val:1450 }, { key:'eta', label:'效率', unit:'%', val:68 }],
  sf_e: [{ key:'Q', label:'風量', unit:'m³/h', val:10000 }, { key:'Ps', label:'靜壓', unit:'Pa', val:800 }, { key:'kW', label:'功率', unit:'kW', val:9.5 }, { key:'eta', label:'效率', unit:'%', val:72 }],
  rf_d: [{ key:'Q', label:'風量', unit:'m³/h', val:8000 }, { key:'Ps', label:'靜壓', unit:'Pa', val:600 }, { key:'kW', label:'功率', unit:'kW', val:7.5 }, { key:'rpm', label:'轉速', unit:'rpm', val:1200 }, { key:'eta', label:'效率', unit:'%', val:66 }],
  es:  [{ key:'L', label:'段長', unit:'mm', val:300 }],
};

// ── Dimensions ────────────────────────────────────────────────────
const W = 1.6, H = 1.6;   // duct cross-section (Z = width, Y = height)
const PT  = 0.040;          // panel skin thickness
const FD  = 0.056;          // flange ring depth (X)
const FB  = 0.060;          // flange bar thickness
const LH  = 0.22;           // leg height
const LP  = 0.040;          // leg post width
const INLET = 0.50, OUTLET = 0.50, GAP = 0.06;

// ── Colour palette ────────────────────────────────────────────────
const CC = {
  topPanel:  0x4a5e72,  // top surface (lighter — catches key light)
  bodyPanel: 0x3c4e60,  // sides / back
  flange:    0x2c3c4c,  // flange rings
  leg:       0x1e2c38,  // structural steel legs
  trim:      0x3a5062,  // front-face trim bars
  rib:       0x506272,  // stiffener ribs on top
  bolt:      0x5a6e80,  // bolt heads
};

// ── Geometry / material helpers ───────────────────────────────────
function mkM(col, met, rgh, emCol, emI) {
  met = met !== undefined ? met : 0.72;
  rgh = rgh !== undefined ? rgh : 0.32;
  const m = new THREE.MeshStandardMaterial({ color: col, metalness: met, roughness: rgh });
  if (emCol !== undefined) {
    m.emissive = new THREE.Color(emCol);
    m.emissiveIntensity = emI !== undefined ? emI : 0.18;
  }
  return m;
}

function bx(gx, gy, gz) { return new THREE.BoxGeometry(gx, gy, gz); }
function cy(rt, rb, h, s) { return new THREE.CylinderGeometry(rt, rb, h, s || 14); }
function sp(r) { return new THREE.SphereGeometry(r, 8, 6); }

function put(group, geo, mat, x, y, z, castShadow) {
  const m = new THREE.Mesh(geo, mat instanceof THREE.Material ? mat.clone() : mat);
  m.position.set(x, y, z);
  m.castShadow  = castShadow !== false;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

// ── Scene state ───────────────────────────────────────────────────
let scene, camera, renderer, controls, raycaster;
let ductGroup = null, extraGroup = null;
const compGroups = [];
const paramStore = {};
let selectedId = null;

// ── Init ──────────────────────────────────────────────────────────
function init() {
  const container = document.getElementById('mau3d-container');
  if (!container || renderer) return;

  const isLight = document.body.dataset.theme === 'light';
  scene = new THREE.Scene();
  scene.background = new THREE.Color(isLight ? 0xe6ecf5 : 0x060c16);

  const cw = container.clientWidth  || 640;
  const ch = container.clientHeight || 400;
  camera = new THREE.PerspectiveCamera(38, cw / ch, 0.1, 100);
  camera.position.set(2.6, 2.2, 5.0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(cw, ch);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // Lights
  scene.add(new THREE.AmbientLight(0x8090a8, isLight ? 3.5 : 2.4));

  const key = new THREE.DirectionalLight(0xffffff, isLight ? 2.2 : 3.6);
  key.position.set(5, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x80a8c0, 0.55);
  fill.position.set(-4, 0, -3);
  scene.add(fill);

  // Front fill — illuminates the open face of each module
  const front = new THREE.DirectionalLight(0x708898, 0.90);
  front.position.set(0, 1, 9);
  scene.add(front);

  const rim = new THREE.DirectionalLight(0x4070cc, 0.35);
  rim.position.set(0, -4, 7);
  scene.add(rim);

  if (!isLight) {
    const grid = new THREE.GridHelper(22, 44, 0x142030, 0x0a1520);
    grid.position.y = -(H / 2 + LH + 0.14);
    scene.add(grid);
  }

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 1.2;
  controls.maxDistance = 24;
  controls.target.set(0, 0, 0);

  raycaster = new THREE.Raycaster();
  renderer.domElement.style.cursor = 'grab';
  controls.addEventListener('start', () => { renderer.domElement.style.cursor = 'grabbing'; });
  controls.addEventListener('end',   () => { renderer.domElement.style.cursor = 'grab'; });
  renderer.domElement.addEventListener('click', onCanvasClick);

  new ResizeObserver(() => {
    const rw = container.clientWidth, rh = container.clientHeight;
    if (!rw || !rh) return;
    camera.aspect = rw / rh;
    camera.updateProjectionMatrix();
    renderer.setSize(rw, rh);
  }).observe(container);

  new MutationObserver(() => {
    if (!scene) return;
    scene.background.set(document.body.dataset.theme === 'light' ? 0xe6ecf5 : 0x060c16);
  }).observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

  (function loop() {
    requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  })();

  window.dispatchEvent(new Event('mau3d-ready'));
}

// ── Build Scene ───────────────────────────────────────────────────
function buildScene(comps) {
  if (ductGroup)  { scene.remove(ductGroup);  ductGroup = null; }
  if (extraGroup) { scene.remove(extraGroup); extraGroup = null; }
  while (compGroups.length) { scene.remove(compGroups.pop().group); }

  let compLen = 0;
  comps.forEach(c => { const d = DEF[c.key]; if (d) compLen += d.depth + GAP; });
  if (comps.length) compLen -= GAP;

  const totalLen = INLET + (comps.length ? GAP + compLen + GAP : 0) + OUTLET;
  const xStart   = -totalLen / 2;

  ductGroup = buildBaseFrame(totalLen, xStart);
  scene.add(ductGroup);

  let xCursor = xStart + INLET + (comps.length ? GAP : 0);
  comps.forEach(comp => {
    const def = DEF[comp.key];
    if (!def) return;
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

  extraGroup = new THREE.Group();
  addLabel(extraGroup, 'OA →', xStart + INLET * 0.5,           H * 0.65, W / 2 + 0.22, 0xf0a430);
  addLabel(extraGroup, '→ SA', xStart + totalLen - OUTLET * 0.5, H * 0.65, W / 2 + 0.22, 0x00d4aa);

  if (comps.length) {
    const from = new THREE.Vector3(xStart + INLET + 0.04, 0, 0);
    const to   = new THREE.Vector3(xStart + totalLen - OUTLET - 0.04, 0, 0);
    const arrow = new THREE.ArrowHelper(
      to.clone().sub(from).normalize(), from, to.distanceTo(from), 0x1a4060, 0.16, 0.10
    );
    arrow.line.material.opacity = 0.18;
    arrow.line.material.transparent = true;
    extraGroup.add(arrow);
  }
  scene.add(extraGroup);
}

// ── Base Frame (C-channel rails) ──────────────────────────────────
function buildBaseFrame(totalLen, xStart) {
  const g   = new THREE.Group();
  const cx  = xStart + totalLen / 2;
  const mat = mkM(CC.leg, 0.84, 0.40);
  const railY = -(H / 2 + LH + LP * 0.4);

  [-1, 1].forEach(side => {
    const z = side * W * 0.38;
    // Web (vertical plate)
    put(g, bx(totalLen, LH * 0.55, LP * 0.35), mat, cx, railY + LH * 0.28, z);
    // Top flange
    put(g, bx(totalLen, LP * 0.28, LP * 1.6), mat, cx, railY + LH * 0.58, z);
    // Bottom flange
    put(g, bx(totalLen, LP * 0.28, LP * 1.6), mat, cx, railY, z);
  });
  return g;
}

// ── Build one AHU Module ──────────────────────────────────────────
function buildComp(key, def, x0) {
  const g  = new THREE.Group();
  const D  = def.depth;
  const cx = x0 + D / 2;

  const mTop    = mkM(CC.topPanel,  0.72, 0.28);
  const mBody   = mkM(CC.bodyPanel, 0.70, 0.34);
  const mFlange = mkM(CC.flange,    0.78, 0.36);
  const mLeg    = mkM(CC.leg,       0.84, 0.40);
  const mTrim   = mkM(CC.trim,      0.74, 0.36);
  const mRib    = mkM(CC.rib,       0.74, 0.26);

  const iW = W - PT * 2;   // inner clear width
  const iH = H - PT * 2;   // inner clear height
  const iD = D - FD * 2;   // inner clear depth

  // ── Casing Panels (open on Z+ front face) ──────────────────
  // Top panel
  put(g, bx(iD, PT, W), mTop, cx, H / 2 + PT / 2, 0);
  // Bottom panel
  put(g, bx(iD, PT, W), mBody, cx, -(H / 2 + PT / 2), 0);
  // Back panel (Z−)
  put(g, bx(iD, H, PT), mBody, cx, 0, -(W / 2 + PT / 2));

  // ── Stiffener Ribs on Top ──────────────────────────────────
  [-W * 0.27, 0, W * 0.27].forEach(rz => {
    put(g, bx(iD * 0.95, PT * 0.55, PT * 0.55), mRib, cx, H / 2 + PT + PT * 0.28, rz);
  });

  // ── Front-face Trim Bars (top + bottom edge of the opening) ─
  put(g, bx(iD, PT, PT), mTrim, cx,  H / 2,       W / 2);
  put(g, bx(iD, PT, PT), mTrim, cx, -H / 2,       W / 2);
  put(g, bx(PT, H + PT,  PT), mTrim, x0,       0, W / 2);
  put(g, bx(PT, H + PT,  PT), mTrim, x0 + D,   0, W / 2);

  // ── Flange Rings at Both Ends ──────────────────────────────
  [x0 + FD / 2, x0 + D - FD / 2].forEach(fx => buildFlangeRing(g, fx, mFlange, mkM));

  // ── Base Legs (angle-iron posts at 4 corners) ──────────────
  const lxOff = Math.min(D * 0.18, 0.16);
  [x0 + lxOff, x0 + D - lxOff].forEach(lx => {
    [-W * 0.38, W * 0.38].forEach(lz => {
      // Vertical post
      put(g, bx(LP, LH, LP),              mLeg, lx, -(H / 2 + LH / 2), lz);
      // Gusset (small horizontal plate at top of leg)
      put(g, bx(LP * 1.6, LP * 0.25, LP * 2.2), mLeg, lx, -(H / 2 + LP * 0.12), lz);
      // Foot plate
      put(g, bx(LP * 2.4, LP * 0.22, LP * 2.8), mLeg, lx, -(H / 2 + LH), lz);
    });
  });

  // ── Category-specific Internals ────────────────────────────
  if      (def.cat === 'filter')                    addFilterDetail(g, key, def, cx, D, x0);
  else if (def.cat === 'chw' || def.cat === 'hhw') addCoilDetail(g, def, cx, D);
  else if (def.cat === 'fan')                       addFanDetail(g, def, cx, D);
  else if (def.cat === 'damper')                    addDamperDetail(g, def, cx, D);
  else if (def.cat === 'mixing')                    addMixingDetail(g, def, cx, D);
  else if (def.cat === 'heater')                    addHeaterDetail(g, def, cx, D);
  else if (def.cat === 'ep')                        addEPDetail(g, def, cx, D);

  return g;
}

// ── Flange Ring ───────────────────────────────────────────────────
function buildFlangeRing(g, fx, mat) {
  const boltMat = mkM(CC.bolt, 0.85, 0.28);
  // Top bar
  put(g, bx(FD, FB, W + FB * 2), mat, fx,  H / 2 + FB / 2, 0);
  // Bottom bar
  put(g, bx(FD, FB, W + FB * 2), mat, fx, -(H / 2 + FB / 2), 0);
  // Front bar (Z+)
  put(g, bx(FD, H, FB), mat, fx, 0,  W / 2 + FB / 2);
  // Back bar (Z−)
  put(g, bx(FD, H, FB), mat, fx, 0, -(W / 2 + FB / 2));
  // Bolt heads (visible on face, 8 positions)
  const boltY = [H * 0.38, -H * 0.38, 0];
  const boltZ = [W * 0.38, -W * 0.38];
  boltY.forEach(by => boltZ.forEach(bz => {
    const bolt = new THREE.Mesh(cy(0.018, 0.018, FD * 0.6, 8), boltMat.clone());
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(fx, by, bz);
    g.add(bolt);
  }));
}

// ── Filter Detail ─────────────────────────────────────────────────
function addFilterDetail(g, key, def, cx, D, x0) {
  const isBag  = key === 'pf-f7';
  const isHEPA = key === 'hf-h13';

  if (isBag) {
    // Bag filter: vertical pocket bags
    const bagMat   = new THREE.MeshStandardMaterial({ color: 0x2a3c52, metalness: 0.12, roughness: 0.82 });
    const frameMat = mkM(CC.flange, 0.72, 0.42);
    const nBags = 7;
    for (let i = 0; i < nBags; i++) {
      const z = -W * 0.40 + (i / (nBags - 1)) * W * 0.80;
      put(g, bx(D * 0.82, H * 0.82, W * 0.072), bagMat, cx, 0, z);
      // Wire frame on each bag face
      const fGeo = new THREE.EdgesGeometry(bx(D * 0.83, H * 0.84, W * 0.076));
      const fLine = new THREE.LineSegments(fGeo, new THREE.LineBasicMaterial({ color: 0x506878, opacity: 0.7, transparent: true }));
      fLine.position.set(cx, 0, z);
      g.add(fLine);
    }
    // Holding rails (top + bottom)
    const railMat = mkM(CC.flange, 0.80, 0.38);
    put(g, bx(D * 0.88, LP * 0.5, W * 0.88), railMat, cx,  H * 0.43, 0);
    put(g, bx(D * 0.88, LP * 0.5, W * 0.88), railMat, cx, -H * 0.43, 0);

  } else {
    // Panel filter (G4) or HEPA — flat media in a cassette frame
    const mediaThick = isHEPA ? D * 0.80 : D * 0.70;
    const mediaCol   = isHEPA ? 0x252535 : 0x253828;
    const mediaMat   = new THREE.MeshStandardMaterial({
      color: mediaCol, metalness: 0.08, roughness: 0.88,
      transparent: isHEPA, opacity: isHEPA ? 0.94 : 1.0,
    });
    put(g, bx(mediaThick, H * 0.84, W * 0.84), mediaMat, cx, 0, 0);

    // Grid lines on downstream face
    const cols = isHEPA ? 16 : 6;
    const rows = 10;
    const ex = cx + mediaThick / 2 + 0.003;
    const yh = H * 0.42, zh = W * 0.42;
    const pts = [];
    for (let r = 1; r < rows; r++) {
      const y = -yh + (r / rows) * yh * 2;
      pts.push(new THREE.Vector3(ex, y, -zh), new THREE.Vector3(ex, y, zh));
    }
    for (let c = 1; c < cols; c++) {
      const z = -zh + (c / cols) * zh * 2;
      pts.push(new THREE.Vector3(ex, -yh, z), new THREE.Vector3(ex, yh, z));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const idx = []; for (let i = 0; i < pts.length; i += 2) idx.push(i, i + 1);
    geo.setIndex(idx);
    g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: isHEPA ? 0xa0a0c0 : 0x40a060, transparent: true, opacity: 0.60,
    })));

    // Cassette frame bars (top/bottom/left/right)
    const fMat = mkM(CC.flange, 0.76, 0.40);
    const fB = LP * 0.75;
    put(g, bx(mediaThick + LP, fB, W * 0.86 + fB * 2), fMat, cx,  H * 0.43 + fB / 2, 0);
    put(g, bx(mediaThick + LP, fB, W * 0.86 + fB * 2), fMat, cx, -H * 0.43 - fB / 2, 0);
    put(g, bx(mediaThick + LP, H * 0.86, fB), fMat, cx, 0,  W * 0.43 + fB / 2);
    put(g, bx(mediaThick + LP, H * 0.86, fB), fMat, cx, 0, -W * 0.43 - fB / 2);
  }
}

// ── Coil Detail ───────────────────────────────────────────────────
function addCoilDetail(g, def, cx, D) {
  const isHot = def.cat === 'hhw';
  const tubeCol = isHot ? 0xff5818 : 0x18a8f0;
  const finCol  = isHot ? 0xa87840 : 0x68aabb;
  const hdrCol  = isHot ? 0xc04010 : 0x1050b0;

  const tubeMat = mkM(tubeCol, 0.82, 0.22);
  const finMat  = new THREE.MeshStandardMaterial({
    color: finCol, metalness: 0.74, roughness: 0.28,
    transparent: true, opacity: 0.70, side: THREE.DoubleSide,
  });
  const hdrMat  = mkM(hdrCol, 0.82, 0.20);

  const nRows = 6;
  const tubeR = 0.028;

  // Copper tubes (Z-axis, multiple rows in Y)
  for (let r = 0; r < nRows; r++) {
    const y = -H * 0.36 + (r / (nRows - 1)) * H * 0.72;
    const tube = new THREE.Mesh(cy(tubeR, tubeR, W * 0.82, 14), tubeMat.clone());
    tube.rotation.x = Math.PI / 2;
    tube.position.set(cx, y, 0);
    g.add(tube);
  }

  // Aluminium fin plates (thin slices, stacked along X)
  const nFins = Math.max(4, Math.round(D / 0.10));
  const finStep = nFins > 1 ? D * 0.78 / (nFins - 1) : 0;
  for (let f = 0; f < nFins; f++) {
    const fx = cx - D * 0.39 + f * finStep;
    put(g, bx(0.007, H * 0.80, W * 0.78), finMat, fx, 0, 0);
  }

  // Header manifolds (Z sides)
  [-1, 1].forEach(side => {
    const hz = side * W * 0.42;
    put(g, cy(0.050, 0.050, H * 0.76, 16), hdrMat, cx, 0, hz, false).rotation.set(0, 0, 0);
    g.children[g.children.length - 1].position.set(cx, 0, hz);

    // Pipe stubs on Z+ (service) side only
    if (side === 1) {
      const pipeMat = mkM(tubeCol, 0.80, 0.25);
      const insMat  = mkM(isHot ? 0x503020 : 0x283060, 0.22, 0.82);
      [-H * 0.26, H * 0.26].forEach(py => {
        // Insulation jacket
        const ins = new THREE.Mesh(cy(0.060, 0.060, 0.22, 12), insMat.clone());
        ins.rotation.x = Math.PI / 2;
        ins.position.set(cx, py, W / 2 + PT + 0.11);
        g.add(ins);
        // Inner copper pipe
        const pipe = new THREE.Mesh(cy(0.036, 0.036, 0.28, 12), pipeMat.clone());
        pipe.rotation.x = Math.PI / 2;
        pipe.position.set(cx, py, W / 2 + PT + 0.14);
        g.add(pipe);
      });
    }
  });

  // Drain pan (below coil — cooling sections only)
  if (!isHot) {
    const panMat = mkM(0x1a3040, 0.74, 0.46);
    const panW = W * 0.88, panL = D * 0.94;
    put(g, bx(panL, LP * 0.55, panW), panMat, cx, -(H * 0.47), 0);
    put(g, bx(panL, LP * 1.0, LP * 0.5), panMat, cx, -(H * 0.46),  panW / 2);
    put(g, bx(panL, LP * 1.0, LP * 0.5), panMat, cx, -(H * 0.46), -panW / 2);
    // Drain stub
    const drainP = new THREE.Mesh(cy(0.024, 0.024, 0.18, 10), mkM(0x203040, 0.80, 0.36));
    drainP.rotation.x = Math.PI / 2;
    drainP.position.set(cx + D * 0.26, -(H * 0.49), W * 0.32);
    g.add(drainP);
  }
}

// ── Damper Detail ─────────────────────────────────────────────────
function addDamperDetail(g, def, cx, D) {
  const bladeMat = mkM(def.top, 0.66, 0.36);
  const shaftMat = mkM(0x607888, 0.80, 0.30);
  const nBlades = 7;

  for (let i = 0; i < nBlades; i++) {
    const y = -H * 0.38 + (i / (nBlades - 1)) * H * 0.76;
    // Blade body
    const blade = new THREE.Mesh(bx(D * 0.72, 0.050, W * 0.86), bladeMat.clone());
    blade.position.set(cx, y, 0);
    blade.rotation.x = 0.22;
    g.add(blade);
    // Pivot shaft through blade
    const pivot = new THREE.Mesh(cy(0.012, 0.012, W * 0.90, 8), shaftMat.clone());
    pivot.rotation.x = Math.PI / 2;
    pivot.position.set(cx, y, 0);
    g.add(pivot);
  }
  // Actuator linkage rod (vertical bar connecting all pivots on Z+ side)
  const rod = new THREE.Mesh(cy(0.014, 0.014, H * 0.78, 8), shaftMat.clone());
  rod.position.set(cx + D * 0.24, 0, W * 0.40);
  g.add(rod);
  // Actuator box
  put(g, bx(LP * 1.4, LP * 1.4, LP * 1.4), mkM(0x405060, 0.70, 0.44), cx + D * 0.26, H * 0.35, W * 0.40);
}

// ── Mixing Box Detail ─────────────────────────────────────────────
function addMixingDetail(g, def, cx, D) {
  const oaMat  = mkM(0xf0a430, 0.55, 0.45);   // amber = OA damper
  const raMat  = mkM(0x30c870, 0.55, 0.45);   // green = RA damper
  const divMat = mkM(0x2a4050, 0.72, 0.38);
  const n = 5;

  // OA blades (horizontal — louvre on top-face direction)
  for (let i = 0; i < n; i++) {
    const z = -W * 0.34 + (i / (n - 1)) * W * 0.68;
    const b = new THREE.Mesh(bx(D * 0.65, 0.020, 0.055), oaMat.clone());
    b.position.set(cx, H * 0.44, z);
    b.rotation.z = 0.32;
    g.add(b);
  }
  // RA blades (vertical — louvre on back-face direction)
  for (let i = 0; i < n; i++) {
    const y = -H * 0.34 + (i / (n - 1)) * H * 0.68;
    const b = new THREE.Mesh(bx(D * 0.65, 0.055, 0.020), raMat.clone());
    b.position.set(cx, y, W * 0.44);
    b.rotation.y = 0.32;
    g.add(b);
  }
  // Mixing divider septum
  put(g, bx(0.016, H * 0.84, W * 0.84), divMat, cx, 0, 0);
  // Labels
  addLabel(g, 'OA', cx, H * 0.46, W * 0.30, 0xf0a430);
  addLabel(g, 'RA', cx, 0, W * 0.48, 0x30c870);
}

// ── Heater Detail ─────────────────────────────────────────────────
function addHeaterDetail(g, def, cx, D) {
  const rodMat  = mkM(0xff4020, 0.55, 0.30, 0x401000, 0.50);
  const termMat = mkM(def.top,  0.82, 0.24);
  const nRods   = 5;

  for (let r = 0; r < nRods; r++) {
    const y = -H * 0.36 + (r / (nRods - 1)) * H * 0.72;
    // Heating element rod
    const rod = new THREE.Mesh(cy(0.022, 0.022, W * 0.84, 12), rodMat.clone());
    rod.rotation.x = Math.PI / 2;
    rod.position.set(cx, y, 0);
    g.add(rod);
    // End terminals
    [-1, 1].forEach(side => {
      const term = new THREE.Mesh(cy(0.030, 0.030, 0.048, 10), termMat.clone());
      term.rotation.x = Math.PI / 2;
      term.position.set(cx, y, side * W * 0.43);
      g.add(term);
    });
  }
  // Support frame (2 horizontal rails)
  const railMat = mkM(CC.flange, 0.78, 0.38);
  [-H * 0.38, H * 0.38].forEach(ry => {
    put(g, bx(D * 0.78, LP * 0.5, W * 0.84), railMat, cx, ry, 0);
  });
  // Electric terminal box on Z+ side
  put(g, bx(LP * 2.2, LP * 2.0, LP * 1.4), mkM(0x283848, 0.76, 0.44), cx, H * 0.30, W * 0.40);
}

// ── Electrostatic Precipitator Detail ────────────────────────────
function addEPDetail(g, def, cx, D) {
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x909030, metalness: 0.78, roughness: 0.26,
    transparent: true, opacity: 0.78,
  });
  const wireMat = mkM(0xe0e020, 0.92, 0.14, 0x303000, 0.30);
  const n = 7;

  for (let i = 0; i < n; i++) {
    const z = -W * 0.40 + (i / (n - 1)) * W * 0.80;
    // Collection plate
    const plate = new THREE.Mesh(bx(D * 0.80, H * 0.82, 0.012), plateMat.clone());
    plate.position.set(cx, 0, z);
    g.add(plate);
    // Ionizing wire between plates
    if (i < n - 1) {
      const zmid = z + (W * 0.80 / (n - 1)) * 0.5;
      const wire = new THREE.Mesh(cy(0.005, 0.005, H * 0.70, 6), wireMat.clone());
      wire.position.set(cx, 0, zmid);
      g.add(wire);
    }
  }
  // HV insulator blocks (top of plates)
  const insMat = mkM(0x808090, 0.28, 0.70);
  [cx - D * 0.22, cx + D * 0.22].forEach(ix => {
    put(g, sp(0.042), insMat, ix, H * 0.40, 0);
  });
}

// ── Fan Detail ────────────────────────────────────────────────────
function addFanDetail(g, def, cx, D) {
  const fColor  = def.top;
  const r = Math.min(W, H) * 0.43;   // impeller outer radius

  // ── Scroll housing (thick torus simulating volute casing) ──
  const scrollMat  = mkM(CC.bodyPanel, 0.70, 0.34);
  const housingMat = mkM(CC.flange,    0.74, 0.32);

  // Main scroll ring
  const scrollRing = new THREE.Mesh(
    new THREE.TorusGeometry(r * 1.04, r * 0.10, 10, 48),
    scrollMat.clone()
  );
  scrollRing.rotation.y = Math.PI / 2;
  scrollRing.position.x = cx;
  g.add(scrollRing);

  // Side plates (circular discs closing the scroll)
  [-D * 0.30, D * 0.30].forEach(offX => {
    const sideDisc = new THREE.Mesh(cy(r * 1.08, r * 1.08, LP * 0.7, 36), housingMat.clone());
    sideDisc.rotation.z = Math.PI / 2;
    sideDisc.position.x = cx + offX;
    g.add(sideDisc);

    // Inlet bell ring (where air enters the impeller eye)
    const bell = new THREE.Mesh(
      new THREE.TorusGeometry(r * 0.50, LP * 0.9, 8, 32),
      mkM(CC.trim, 0.78, 0.28).clone()
    );
    bell.rotation.y = Math.PI / 2;
    bell.position.x = cx + offX;
    g.add(bell);
  });

  // ── Impeller blades (backward-curved, running X axis) ──────
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x4878a8, metalness: 0.58, roughness: 0.40,
    transparent: true, opacity: 0.88,
  });
  const nBlades = 12;
  for (let b = 0; b < nBlades; b++) {
    const angle  = (b / nBlades) * Math.PI * 2;
    const br     = r * 0.60;
    const blade  = new THREE.Mesh(bx(D * 0.52, r * 0.52, 0.018), bladeMat.clone());
    blade.position.set(cx, Math.sin(angle) * br, Math.cos(angle) * br);
    blade.rotation.x = angle + 0.48;
    blade.rotation.y = Math.PI / 2;
    g.add(blade);
  }

  // ── Hub + shaft ─────────────────────────────────────────────
  const hubMat = mkM(0x50688a, 0.84, 0.24);
  const hub    = new THREE.Mesh(cy(r * 0.10, r * 0.10, D * 0.64, 14), hubMat.clone());
  hub.rotation.z = Math.PI / 2;
  hub.position.x = cx;
  g.add(hub);

  // ── Discharge nozzle (plenum box at top of fan section) ─────
  const dischMat = mkM(CC.topPanel, 0.72, 0.34);
  put(g, bx(D * 0.80, H * 0.20, W * 0.70), dischMat, cx, H * 0.44, 0);
  // Flanged transition at discharge
  put(g, bx(D * 0.84, LP * 0.6, W * 0.74), mkM(CC.flange, 0.76, 0.38), cx, H * 0.34, 0);

  // ── Motor (mounted on vibration isolators below fan wheel) ──
  const motorMat = mkM(0x1e2c3c, 0.80, 0.44);
  const mBox = put(g, bx(D * 0.36, r * 0.46, r * 0.46), motorMat, cx, -(r * 0.78), 0);
  // Motor cooling fins (horizontal rings)
  const mfMat = mkM(0x283848, 0.78, 0.38);
  for (let mf = 0; mf < 5; mf++) {
    const my = -(r * 0.78) - r * 0.20 + mf * r * 0.11;
    put(g, bx(D * 0.38, LP * 0.35, r * 0.50), mfMat, cx, my, 0);
  }
  // Motor shaft (connecting motor to hub)
  const mshaft = new THREE.Mesh(cy(0.028, 0.028, r * 0.34, 10), hubMat.clone());
  mshaft.position.set(cx, -(r * 0.56), 0);
  g.add(mshaft);

  // Vibration isolator pads (rubber mounts under motor)
  const padMat = mkM(0x303030, 0.22, 0.80);
  [-D * 0.12, D * 0.12].forEach(px => {
    put(g, bx(LP * 0.8, LP * 0.6, LP * 0.8), padMat, cx + px, -(r + LP * 0.5), 0);
  });
}

// ── Canvas label sprite ───────────────────────────────────────────
function addLabel(group, text, x, y, z, hexColor) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.font = 'bold 26px Rajdhani, sans-serif';
  ctx.fillStyle = '#' + hexColor.toString(16).padStart(6, '0');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 32);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), transparent: true,
  }));
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
    if (o.isMesh && o.material && o.material.emissive) {
      if (on) {
        o.material.emissiveIntensity = 0.55;
        o.material.emissive.set(new THREE.Color(DEF[cg.key]?.top || 0x4080ff));
      } else {
        o.material.emissiveIntensity = 0;
        o.material.emissive.set(0x000000);
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

window.mau3dClosePanel = hideParamPanel;
window.mau3dSaveParam  = function (id, key, val) {
  if (!paramStore[id]) paramStore[id] = {};
  paramStore[id][key] = parseFloat(val);
};

// ── Bootstrap ─────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
