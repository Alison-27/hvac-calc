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
  sf_d:[{ key:'Q', label:'風量', unit:'m³/h', val:10000 }, { key:'Ps', label:'靜壓', unit:'Pa', val:800 }, { key:'kW', label:'功率', unit:'kW', val:11 }, { key:'rpm', label:'轉速', unit:'rpm', val:1450 }, { key:'eta', label:'效率', unit:'%', val:68 }],
  sf_e:[{ key:'Q', label:'風量', unit:'m³/h', val:10000 }, { key:'Ps', label:'靜壓', unit:'Pa', val:800 }, { key:'kW', label:'功率', unit:'kW', val:9.5 }, { key:'eta', label:'效率', unit:'%', val:72 }],
  rf_d:[{ key:'Q', label:'風量', unit:'m³/h', val:8000 }, { key:'Ps', label:'靜壓', unit:'Pa', val:600 }, { key:'kW', label:'功率', unit:'kW', val:7.5 }, { key:'rpm', label:'轉速', unit:'rpm', val:1200 }, { key:'eta', label:'效率', unit:'%', val:66 }],
  es:  [{ key:'L', label:'段長', unit:'mm', val:300 }],
};

// ── Dimensions ────────────────────────────────────────────────────
const W = 1.6, H = 1.6;
const PT = 0.040, FD = 0.056, FB = 0.060, LH = 0.22, LP = 0.040;
const INLET = 0.50, OUTLET = 0.50, GAP = 0.06;
const DOOR_OPEN_ANGLE = Math.PI * 0.88;

// ── Colour palette ────────────────────────────────────────────────
const CC = { topPanel:0x4a5e72, bodyPanel:0x3c4e60, flange:0x2c3c4c, leg:0x1e2c38, trim:0x3a5062, rib:0x506272, bolt:0x5a6e80 };

// ── Helpers ───────────────────────────────────────────────────────
function mkM(col, met, rgh, emC, emI) {
  met = met !== undefined ? met : 0.72;
  rgh = rgh !== undefined ? rgh : 0.32;
  const m = new THREE.MeshStandardMaterial({ color:col, metalness:met, roughness:rgh });
  if (emC !== undefined) { m.emissive = new THREE.Color(emC); m.emissiveIntensity = emI || 0.18; }
  return m;
}
function bx(x,y,z){ return new THREE.BoxGeometry(x,y,z); }
function cy(r1,r2,h,s){ return new THREE.CylinderGeometry(r1,r2,h,s||14); }
function sp(r){ return new THREE.SphereGeometry(r,8,6); }
function put(g,geo,mat,x,y,z){
  const m = new THREE.Mesh(geo, mat instanceof THREE.Material ? mat.clone() : mat);
  m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; g.add(m); return m;
}

// ── Scene state ───────────────────────────────────────────────────
let scene, camera, renderer, controls, raycaster;
let ductGroup=null, extraGroup=null;
let compassRenderer=null, compassScene=null, compassCam=null, compassEl=null;
const compGroups = [];   // { group, id, key, cx }
const paramStore  = {};
const doorHinges  = [];  // hinges for door animation

let selectedId  = null;
let isolatedId  = null;
let isModalOpen = false;

// Door animation
let doorAngle  = 0;
let doorTarget = 0;

// Camera animation
const CAM_DEF = { px:2.6, py:2.2, pz:5.0, lx:0, ly:0, lz:0 };
let camTarget = null;  // { px,py,pz,lx,ly,lz } or null

// ── Init ──────────────────────────────────────────────────────────
function init() {
  const container = document.getElementById('mau3d-container');
  if (!container || renderer) return;
  const isLight = document.body.dataset.theme === 'light';

  scene = new THREE.Scene();
  scene.background = new THREE.Color(isLight ? 0xe6ecf5 : 0x060c16);

  const cw = container.clientWidth || 640;
  const ch = container.clientHeight || 400;
  camera = new THREE.PerspectiveCamera(38, cw/ch, 0.1, 100);
  camera.position.set(CAM_DEF.px, CAM_DEF.py, CAM_DEF.pz);

  renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(cw, ch);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0x8090a8, isLight ? 3.5 : 2.4));
  const key = new THREE.DirectionalLight(0xffffff, isLight ? 2.2 : 3.6);
  key.position.set(5,9,6); key.castShadow=true; key.shadow.mapSize.set(2048,2048);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x80a8c0, 0.55); fill.position.set(-4,0,-3); scene.add(fill);
  const front = new THREE.DirectionalLight(0x708898, 0.90); front.position.set(0,1,9); scene.add(front);
  const rim   = new THREE.DirectionalLight(0x4070cc, 0.35); rim.position.set(0,-4,7);  scene.add(rim);

  if (!isLight) {
    const grid = new THREE.GridHelper(22,44,0x142030,0x0a1520);
    grid.position.y = -(H/2 + LH + 0.14);
    scene.add(grid);
  }

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.06;
  controls.minDistance = 1.0; controls.maxDistance = 28;
  controls.target.set(0,0,0);

  raycaster = new THREE.Raycaster();
  renderer.domElement.style.cursor = 'grab';
  controls.addEventListener('start', ()=>{ renderer.domElement.style.cursor='grabbing'; });
  controls.addEventListener('end',   ()=>{ renderer.domElement.style.cursor='grab'; });
  renderer.domElement.addEventListener('click', onCanvasClick);

  new ResizeObserver(()=>{
    const src = isModalOpen
      ? document.getElementById('mau3d-modal-canvas-wrap')
      : document.getElementById('mau3d-container');
    if (!src) return;
    const rw = src.clientWidth, rh = src.clientHeight;
    if (!rw||!rh) return;
    camera.aspect = rw/rh; camera.updateProjectionMatrix(); renderer.setSize(rw,rh);
  }).observe(container);

  new MutationObserver(()=>{
    if (!scene) return;
    scene.background.set(document.body.dataset.theme==='light' ? 0xe6ecf5 : 0x060c16);
  }).observe(document.body,{attributes:true,attributeFilter:['data-theme']});

  (function loop(){
    requestAnimationFrame(loop);

    // Door animation
    if (Math.abs(doorAngle - doorTarget) > 0.0015) {
      doorAngle += (doorTarget - doorAngle) * 0.09;
      doorHinges.forEach(h => { h.rotation.x = doorAngle; });
      updateDoorBtn();
    }

    // Camera animation
    if (camTarget) {
      const alpha = 0.055;
      camera.position.x += (camTarget.px - camera.position.x) * alpha;
      camera.position.y += (camTarget.py - camera.position.y) * alpha;
      camera.position.z += (camTarget.pz - camera.position.z) * alpha;
      controls.target.x  += (camTarget.lx - controls.target.x) * alpha;
      controls.target.y  += (camTarget.ly - controls.target.y) * alpha;
      controls.target.z  += (camTarget.lz - controls.target.z) * alpha;
      if (Math.abs(camera.position.z - camTarget.pz) < 0.006 &&
          Math.abs(camera.position.x - camTarget.px) < 0.006) {
        camTarget = null;
      }
      controls.update();
    }

    controls.update();
    renderer.render(scene, camera);

    // Compass gizmo
    if (compassRenderer && compassScene && compassCam) {
      compassCam.quaternion.copy(camera.quaternion);
      compassRenderer.render(compassScene, compassCam);
    }
  })();

  initCompass(container);
  window.dispatchEvent(new Event('mau3d-ready'));
}

function updateDoorBtn() {
  const b1 = document.getElementById('mau3d-door-btn');
  const b2 = document.getElementById('mau3d-modal-door-btn');
  const open = doorTarget > 0.01;
  const txt = open ? '🔓 關閉外殼門' : '🔑 打開外殼門';
  const cls = open ? 'active' : '';
  [b1,b2].forEach(b=>{ if(b){ b.textContent=txt; b.className='mau3d-tool-btn '+cls; }});
}

// ── Build Scene ───────────────────────────────────────────────────
function buildScene(comps) {
  if (ductGroup)  { scene.remove(ductGroup);  ductGroup=null; }
  if (extraGroup) { scene.remove(extraGroup); extraGroup=null; }
  while (compGroups.length) { scene.remove(compGroups.pop().group); }
  doorHinges.length = 0;

  let compLen = 0;
  comps.forEach(c => { const d=DEF[c.key]; if(d) compLen += d.depth+GAP; });
  if (comps.length) compLen -= GAP;
  const totalLen = INLET + (comps.length ? GAP+compLen+GAP : 0) + OUTLET;
  const xStart   = -totalLen/2;

  ductGroup = buildBaseFrame(totalLen, xStart);
  scene.add(ductGroup);

  let xCursor = xStart + INLET + (comps.length ? GAP : 0);
  comps.forEach(comp => {
    const def = DEF[comp.key];
    if (!def) return;
    if (!paramStore[comp.id]) {
      paramStore[comp.id] = {};
      (PARAMS_DEF[comp.key]||[]).forEach(p => { paramStore[comp.id][p.key]=p.val; });
    }
    const compCx = xCursor + def.depth/2;
    const group  = buildComp(comp.key, def, xCursor);
    group.userData = { id:comp.id, key:comp.key };
    group.traverse(o => { if (o.isMesh) o.userData.compId = comp.id; });
    scene.add(group);
    compGroups.push({ group, id:comp.id, key:comp.key, cx:compCx });
    xCursor += def.depth + GAP;
  });

  extraGroup = new THREE.Group();
  addLabel(extraGroup,'OA →', xStart+INLET*0.5,          H*0.65, W/2+0.22, 0xf0a430);
  addLabel(extraGroup,'→ SA', xStart+totalLen-OUTLET*0.5, H*0.65, W/2+0.22, 0x00d4aa);
  if (comps.length) {
    const from = new THREE.Vector3(xStart+INLET+0.04, 0, 0);
    const to   = new THREE.Vector3(xStart+totalLen-OUTLET-0.04, 0, 0);
    const arr  = new THREE.ArrowHelper(to.clone().sub(from).normalize(), from,
      to.distanceTo(from), 0x1a4060, 0.16, 0.10);
    arr.line.material.opacity=0.18; arr.line.material.transparent=true;
    extraGroup.add(arr);
  }
  scene.add(extraGroup);
}

// ── Base Frame ────────────────────────────────────────────────────
function buildBaseFrame(totalLen, xStart) {
  const g=new THREE.Group(), cx=xStart+totalLen/2;
  const mat = mkM(CC.leg, 0.84, 0.40);
  [-1,1].forEach(side => {
    const z = side*W*0.38;
    put(g, bx(totalLen, LH*0.55, LP*0.35), mat, cx, -(H/2+LH*0.55/2+LP*0.1), z);
    put(g, bx(totalLen, LP*0.28, LP*1.6),  mat, cx, -(H/2+LP*0.20), z);
    put(g, bx(totalLen, LP*0.28, LP*1.6),  mat, cx, -(H/2+LH*0.62), z);
  });
  return g;
}

// ── Build AHU Module ──────────────────────────────────────────────
function buildComp(key, def, x0) {
  const g=new THREE.Group(), D=def.depth, cx=x0+D/2;
  const iD = D - FD*2;

  const mTop    = mkM(CC.topPanel,  0.72, 0.28);
  const mBody   = mkM(CC.bodyPanel, 0.70, 0.34);
  const mFlange = mkM(CC.flange,    0.78, 0.36);
  const mLeg    = mkM(CC.leg,       0.84, 0.40);
  const mTrim   = mkM(CC.trim,      0.74, 0.36);

  // ── Top / Bottom / Back panels ──
  put(g, bx(iD, PT, W),  mTop,  cx,  H/2+PT/2, 0);
  put(g, bx(iD, PT, W),  mBody, cx, -H/2-PT/2, 0);
  put(g, bx(iD, H,  PT), mBody, cx,  0, -(W/2+PT/2));

  // Top stiffener ribs
  [-W*0.27,0,W*0.27].forEach(rz =>
    put(g, bx(iD*0.94, PT*0.55, PT*0.55), mkM(CC.rib,0.74,0.26), cx, H/2+PT+PT*0.28, rz)
  );

  // Front trim strips (top / bottom of the open face)
  put(g, bx(iD, PT, PT), mTrim, cx,  H/2, W/2);
  put(g, bx(iD, PT, PT), mTrim, cx, -H/2, W/2);
  put(g, bx(PT, H+PT, PT), mTrim, x0,     0, W/2);
  put(g, bx(PT, H+PT, PT), mTrim, x0+D,   0, W/2);

  // ── Flange rings ──
  [x0+FD/2, x0+D-FD/2].forEach(fx => buildFlangeRing(g, fx, mFlange));

  // ── Base legs ──
  const lxOff = Math.min(D*0.18, 0.16);
  [x0+lxOff, x0+D-lxOff].forEach(lx =>
    [-W*0.38, W*0.38].forEach(lz => {
      put(g, bx(LP, LH, LP),              mLeg, lx, -(H/2+LH/2),   lz);
      put(g, bx(LP*1.6, LP*0.25, LP*2.2), mLeg, lx, -(H/2+LP*0.12), lz);
      put(g, bx(LP*2.4, LP*0.22, LP*2.8), mLeg, lx, -(H/2+LH),     lz);
    })
  );

  // ── Front door panel (hinged at bottom, drops open) ──────────
  const doorHinge = new THREE.Group();
  doorHinge.position.set(cx, -H/2, W/2+PT/2);

  const doorPanel = new THREE.Mesh(bx(iD, H, PT), mkM(CC.topPanel, 0.68, 0.32));
  doorPanel.position.set(0, H/2, 0);
  doorPanel.userData.isDoor = true;
  doorHinge.add(doorPanel);

  // Inspection window
  const winMat = new THREE.MeshStandardMaterial({
    color:0x305060, metalness:0.40, roughness:0.35, transparent:true, opacity:0.38,
  });
  const win = new THREE.Mesh(bx(iD*0.36, H*0.28, PT*0.5), winMat);
  win.position.set(0, H*0.18, PT*0.55);
  doorHinge.add(win);

  // Window frame
  const wfMat = mkM(CC.flange, 0.78, 0.36);
  const wfw = iD*0.36, wfh = H*0.28, wfb = LP*0.7;
  put(doorHinge, bx(wfw+wfb*2, wfb, PT*0.7), wfMat, 0, H*0.18+wfh/2+wfb/2, PT*0.4);
  put(doorHinge, bx(wfw+wfb*2, wfb, PT*0.7), wfMat, 0, H*0.18-wfh/2-wfb/2, PT*0.4);
  put(doorHinge, bx(wfb, wfh, PT*0.7), wfMat,  wfw/2+wfb/2, H*0.18, PT*0.4);
  put(doorHinge, bx(wfb, wfh, PT*0.7), wfMat, -wfw/2-wfb/2, H*0.18, PT*0.4);

  // Door handle
  const hMat = mkM(0x6a8090, 0.88, 0.22);
  put(doorHinge, bx(0.018, 0.088, 0.018), hMat, iD*0.28, H*0.18, PT+0.014);
  put(doorHinge, sp(0.022), hMat, iD*0.28, H*0.24, PT+0.022);
  put(doorHinge, sp(0.022), hMat, iD*0.28, H*0.12, PT+0.022);

  // Hinge brackets at top corners of door
  const hbMat = mkM(CC.flange, 0.82, 0.30);
  [-iD*0.38, iD*0.38].forEach(hx =>
    put(doorHinge, bx(LP*1.4, LP*0.6, LP*1.4), hbMat, hx, H, 0)
  );

  doorHinge.rotation.x = doorAngle;
  g.add(doorHinge);
  doorHinges.push(doorHinge);

  // ── Internal detail ──
  if      (def.cat==='filter')                  addFilterDetail(g, key, def, cx, D);
  else if (def.cat==='chw'||def.cat==='hhw')    addCoilDetail(g, def, cx, D);
  else if (def.cat==='fan')                     addFanDetail(g, def, cx, D);
  else if (def.cat==='damper')                  addDamperDetail(g, def, cx, D);
  else if (def.cat==='mixing')                  addMixingDetail(g, def, cx, D);
  else if (def.cat==='heater')                  addHeaterDetail(g, def, cx, D);
  else if (def.cat==='ep')                      addEPDetail(g, def, cx, D);

  return g;
}

function buildFlangeRing(g, fx, mat) {
  const boltMat = mkM(CC.bolt, 0.85, 0.28);
  put(g, bx(FD, FB, W+FB*2), mat, fx,  H/2+FB/2, 0);
  put(g, bx(FD, FB, W+FB*2), mat, fx, -H/2-FB/2, 0);
  put(g, bx(FD, H,  FB),     mat, fx,  0,  W/2+FB/2);
  put(g, bx(FD, H,  FB),     mat, fx,  0, -W/2-FB/2);
  [[H*0.38,W*0.38],[H*0.38,-W*0.38],[-H*0.38,W*0.38],[-H*0.38,-W*0.38]].forEach(([by,bz]) => {
    const bolt = new THREE.Mesh(cy(0.018,0.018,FD*0.6,8), boltMat.clone());
    bolt.rotation.z = Math.PI/2; bolt.position.set(fx, by, bz); g.add(bolt);
  });
}

// ── Filter Detail ─────────────────────────────────────────────────
function addFilterDetail(g, key, def, cx, D) {
  const isBag = key==='pf-f7', isHEPA = key==='hf-h13';
  if (isBag) {
    const bagMat = new THREE.MeshStandardMaterial({ color:0x2a3c52, metalness:0.12, roughness:0.82 });
    const n=7;
    for (let i=0;i<n;i++) {
      const z = -W*0.40 + (i/(n-1))*W*0.80;
      put(g, bx(D*0.82, H*0.82, W*0.072), bagMat, cx, 0, z);
      const eGeo = new THREE.EdgesGeometry(bx(D*0.83, H*0.84, W*0.076));
      const eL = new THREE.LineSegments(eGeo, new THREE.LineBasicMaterial({color:0x506878,opacity:0.7,transparent:true}));
      eL.position.set(cx,0,z); g.add(eL);
    }
    const rMat = mkM(CC.flange, 0.80, 0.38);
    put(g, bx(D*0.88, LP*0.5, W*0.88), rMat, cx,  H*0.43, 0);
    put(g, bx(D*0.88, LP*0.5, W*0.88), rMat, cx, -H*0.43, 0);
  } else {
    const mThick = isHEPA ? D*0.80 : D*0.72;
    const mediaMat = new THREE.MeshStandardMaterial({
      color: isHEPA ? 0x252535 : 0x253828, metalness:0.08, roughness:0.88,
      transparent:isHEPA, opacity:isHEPA?0.94:1.0,
    });
    put(g, bx(mThick, H*0.84, W*0.84), mediaMat, cx, 0, 0);
    const cols=isHEPA?16:6, rows=10, ex=cx+mThick/2+0.003, yh=H*0.42, zh=W*0.42, pts=[];
    for (let r=1;r<rows;r++) { const y=-yh+(r/rows)*yh*2; pts.push(new THREE.Vector3(ex,y,-zh),new THREE.Vector3(ex,y,zh)); }
    for (let c=1;c<cols;c++) { const z=-zh+(c/cols)*zh*2; pts.push(new THREE.Vector3(ex,-yh,z),new THREE.Vector3(ex,yh,z)); }
    const geo=new THREE.BufferGeometry().setFromPoints(pts);
    const idx=[]; for(let i=0;i<pts.length;i+=2) idx.push(i,i+1); geo.setIndex(idx);
    g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color:isHEPA?0xa0a0c0:0x40a060, transparent:true, opacity:0.60 })));
    const fMat=mkM(CC.flange,0.76,0.40), fB=LP*0.75;
    put(g,bx(mThick+LP,fB,W*0.86+fB*2), fMat, cx,  H*0.43+fB/2, 0);
    put(g,bx(mThick+LP,fB,W*0.86+fB*2), fMat, cx, -H*0.43-fB/2, 0);
    put(g,bx(mThick+LP,H*0.86,fB),       fMat, cx,  0,  W*0.43+fB/2);
    put(g,bx(mThick+LP,H*0.86,fB),       fMat, cx,  0, -W*0.43-fB/2);
  }
}

// ── Coil Detail ───────────────────────────────────────────────────
function addCoilDetail(g, def, cx, D) {
  const isHot = def.cat==='hhw';
  const tubeMat = mkM(isHot?0xff5818:0x18a8f0, 0.82, 0.22);
  const finMat  = new THREE.MeshStandardMaterial({ color:isHot?0xa87840:0x68aabb, metalness:0.74, roughness:0.28, transparent:true, opacity:0.72, side:THREE.DoubleSide });
  const hdrMat  = mkM(isHot?0xc04010:0x1050b0, 0.82, 0.20);
  const nRows=6;
  for (let r=0;r<nRows;r++) {
    const y=-H*0.36+(r/(nRows-1))*H*0.72;
    const tube=new THREE.Mesh(cy(0.028,0.028,W*0.82,14),tubeMat.clone());
    tube.rotation.x=Math.PI/2; tube.position.set(cx,y,0); g.add(tube);
  }
  const nFins=Math.max(4,Math.round(D/0.10)), step=nFins>1?D*0.78/(nFins-1):0;
  for (let f=0;f<nFins;f++) put(g, bx(0.007,H*0.80,W*0.78), finMat, cx-D*0.39+f*step, 0, 0);
  [-1,1].forEach(side => {
    const hz=side*W*0.42;
    const hdr=new THREE.Mesh(cy(0.050,0.050,H*0.76,16),hdrMat.clone());
    hdr.position.set(cx,0,hz); g.add(hdr);
    if (side===1) {
      const pipeMat=mkM(isHot?0xff5818:0x18a8f0,0.80,0.25), insMat=mkM(isHot?0x503020:0x283060,0.22,0.82);
      [-H*0.26,H*0.26].forEach(py => {
        const ins=new THREE.Mesh(cy(0.060,0.060,0.22,12),insMat.clone()); ins.rotation.x=Math.PI/2; ins.position.set(cx,py,W/2+PT+0.11); g.add(ins);
        const pip=new THREE.Mesh(cy(0.036,0.036,0.28,12),pipeMat.clone()); pip.rotation.x=Math.PI/2; pip.position.set(cx,py,W/2+PT+0.14); g.add(pip);
      });
    }
  });
  if (!isHot) {
    const panMat=mkM(0x1a3040,0.72,0.46), panW=W*0.88, panL=D*0.94;
    put(g,bx(panL,LP*0.55,panW),panMat,cx,-H*0.47,0);
    put(g,bx(panL,LP*1.0,LP*0.5),panMat,cx,-H*0.46,panW/2);
    put(g,bx(panL,LP*1.0,LP*0.5),panMat,cx,-H*0.46,-panW/2);
    const drainP=new THREE.Mesh(cy(0.024,0.024,0.18,10),mkM(0x203040,0.80,0.36)); drainP.rotation.x=Math.PI/2; drainP.position.set(cx+D*0.26,-H*0.49,W*0.32); g.add(drainP);
  }
}

// ── Damper Detail ─────────────────────────────────────────────────
function addDamperDetail(g, def, cx, D) {
  const bladeMat=mkM(def.top,0.66,0.36), shaftMat=mkM(0x607888,0.80,0.30);
  const nBlades=7;
  for (let i=0;i<nBlades;i++) {
    const y=-H*0.38+(i/(nBlades-1))*H*0.76;
    const blade=new THREE.Mesh(bx(D*0.72,0.050,W*0.86),bladeMat.clone()); blade.position.set(cx,y,0); blade.rotation.x=0.22; g.add(blade);
    const pivot=new THREE.Mesh(cy(0.012,0.012,W*0.90,8),shaftMat.clone()); pivot.rotation.x=Math.PI/2; pivot.position.set(cx,y,0); g.add(pivot);
  }
  const rod=new THREE.Mesh(cy(0.014,0.014,H*0.78,8),shaftMat.clone()); rod.position.set(cx+D*0.24,0,W*0.40); g.add(rod);
  put(g,bx(LP*1.4,LP*1.4,LP*1.4),mkM(0x405060,0.70,0.44),cx+D*0.26,H*0.35,W*0.40);
}

// ── Mixing Box Detail ─────────────────────────────────────────────
function addMixingDetail(g, def, cx, D) {
  const oaMat=mkM(0xf0a430,0.55,0.45), raMat=mkM(0x30c870,0.55,0.45);
  const n=5;
  for (let i=0;i<n;i++) {
    const z=-W*0.34+(i/(n-1))*W*0.68;
    const b=new THREE.Mesh(bx(D*0.65,0.020,0.055),oaMat.clone()); b.position.set(cx,H*0.44,z); b.rotation.z=0.32; g.add(b);
  }
  for (let i=0;i<n;i++) {
    const y=-H*0.34+(i/(n-1))*H*0.68;
    const b=new THREE.Mesh(bx(D*0.65,0.055,0.020),raMat.clone()); b.position.set(cx,y,W*0.44); b.rotation.y=0.32; g.add(b);
  }
  put(g,bx(0.016,H*0.84,W*0.84),mkM(0x2a4050,0.72,0.38),cx,0,0);
  addLabel(g,'OA',cx,H*0.46,W*0.30,0xf0a430);
  addLabel(g,'RA',cx,0,W*0.48,0x30c870);
}

// ── Heater Detail ─────────────────────────────────────────────────
function addHeaterDetail(g, def, cx, D) {
  const rodMat=mkM(0xff4020,0.55,0.30,0x401000,0.50), termMat=mkM(def.top,0.82,0.24);
  const nRods=5;
  for (let r=0;r<nRods;r++) {
    const y=-H*0.36+(r/(nRods-1))*H*0.72;
    const rod=new THREE.Mesh(cy(0.022,0.022,W*0.84,12),rodMat.clone()); rod.rotation.x=Math.PI/2; rod.position.set(cx,y,0); g.add(rod);
    [-1,1].forEach(s => { const t=new THREE.Mesh(cy(0.030,0.030,0.048,10),termMat.clone()); t.rotation.x=Math.PI/2; t.position.set(cx,y,s*W*0.43); g.add(t); });
  }
  const rMat=mkM(CC.flange,0.78,0.38);
  put(g,bx(D*0.78,LP*0.5,W*0.84),rMat,cx,-H*0.38,0);
  put(g,bx(D*0.78,LP*0.5,W*0.84),rMat,cx, H*0.38,0);
  put(g,bx(LP*2.2,LP*2.0,LP*1.4),mkM(0x283848,0.76,0.44),cx,H*0.30,W*0.40);
}

// ── EP Detail ─────────────────────────────────────────────────────
function addEPDetail(g, def, cx, D) {
  const pMat=new THREE.MeshStandardMaterial({color:0x909030,metalness:0.78,roughness:0.26,transparent:true,opacity:0.78});
  const wMat=mkM(0xe0e020,0.92,0.14,0x303000,0.30);
  const n=7;
  for (let i=0;i<n;i++) {
    const z=-W*0.40+(i/(n-1))*W*0.80;
    const pl=new THREE.Mesh(bx(D*0.80,H*0.82,0.012),pMat.clone()); pl.position.set(cx,0,z); g.add(pl);
    if (i<n-1) { const w=new THREE.Mesh(cy(0.005,0.005,H*0.70,6),wMat.clone()); w.position.set(cx,0,z+(W*0.80/(n-1))*0.5); g.add(w); }
  }
  const iMat=mkM(0x808090,0.28,0.70);
  [cx-D*0.22,cx+D*0.22].forEach(ix => put(g,sp(0.042),iMat,ix,H*0.40,0));
}

// ── Fan Detail ────────────────────────────────────────────────────
function addFanDetail(g, def, cx, D) {
  const r=Math.min(W,H)*0.43;
  const scrollMat=mkM(CC.bodyPanel,0.70,0.34), housMat=mkM(CC.flange,0.74,0.32);
  const scrollRing=new THREE.Mesh(new THREE.TorusGeometry(r*1.04,r*0.10,10,48),scrollMat.clone());
  scrollRing.rotation.y=Math.PI/2; scrollRing.position.x=cx; g.add(scrollRing);
  [-D*0.30,D*0.30].forEach(offX => {
    const disc=new THREE.Mesh(cy(r*1.08,r*1.08,LP*0.7,36),housMat.clone()); disc.rotation.z=Math.PI/2; disc.position.x=cx+offX; g.add(disc);
    const bell=new THREE.Mesh(new THREE.TorusGeometry(r*0.50,LP*0.9,8,32),mkM(CC.trim,0.78,0.28).clone()); bell.rotation.y=Math.PI/2; bell.position.x=cx+offX; g.add(bell);
  });
  const bladeMat=new THREE.MeshStandardMaterial({color:0x4878a8,metalness:0.58,roughness:0.40,transparent:true,opacity:0.88});
  for (let b=0;b<12;b++) {
    const ang=(b/12)*Math.PI*2, br=r*0.60;
    const blade=new THREE.Mesh(bx(D*0.52,r*0.52,0.018),bladeMat.clone());
    blade.position.set(cx,Math.sin(ang)*br,Math.cos(ang)*br); blade.rotation.x=ang+0.48; blade.rotation.y=Math.PI/2; g.add(blade);
  }
  const hub=new THREE.Mesh(cy(r*0.10,r*0.10,D*0.64,14),mkM(0x50688a,0.84,0.24).clone()); hub.rotation.z=Math.PI/2; hub.position.x=cx; g.add(hub);
  put(g,bx(D*0.80,H*0.20,W*0.70),mkM(CC.topPanel,0.72,0.34),cx,H*0.44,0);
  put(g,bx(D*0.84,LP*0.6,W*0.74),mkM(CC.flange,0.76,0.38),cx,H*0.34,0);
  const motorMat=mkM(0x1e2c3c,0.80,0.44);
  put(g,bx(D*0.36,r*0.46,r*0.46),motorMat,cx,-(r*0.78),0);
  for (let mf=0;mf<5;mf++) put(g,bx(D*0.38,LP*0.35,r*0.50),mkM(0x283848,0.78,0.38),cx,-(r*0.78)-r*0.20+mf*r*0.11,0);
  const ms=new THREE.Mesh(cy(0.028,0.028,r*0.34,10),mkM(0x50688a,0.84,0.24).clone()); ms.position.set(cx,-(r*0.56),0); g.add(ms);
  [-D*0.12,D*0.12].forEach(px => put(g,bx(LP*0.8,LP*0.6,LP*0.8),mkM(0x303030,0.22,0.80),cx+px,-(r+LP*0.5),0));
}

// ── Label ─────────────────────────────────────────────────────────
function addLabel(group, text, x, y, z, hexColor) {
  const cv=document.createElement('canvas'); cv.width=256; cv.height=64;
  const ctx=cv.getContext('2d');
  ctx.font='bold 26px Rajdhani, sans-serif';
  ctx.fillStyle='#'+hexColor.toString(16).padStart(6,'0');
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text,128,32);
  const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),transparent:true}));
  spr.position.set(x,y,z); spr.scale.set(0.9,0.22,1); group.add(spr);
}

// ── Orientation Compass ───────────────────────────────────────────
function makeLabelSprite(text, hexColor) {
  const cv = document.createElement('canvas'); cv.width = 72; cv.height = 44;
  const ctx = cv.getContext('2d');
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.fillStyle = hexColor;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 36, 22);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false
  }));
  spr.scale.set(0.50, 0.31, 1);
  return spr;
}

function initCompass(container) {
  const SIZE = 88;
  compassEl = document.createElement('canvas');
  compassEl.className = 'mau3d-compass';
  compassEl.style.cssText = `position:absolute;bottom:46px;right:8px;width:${SIZE}px;height:${SIZE}px;pointer-events:none;z-index:10;border-radius:6px;`;
  container.style.position = 'relative';
  container.appendChild(compassEl);

  compassRenderer = new THREE.WebGLRenderer({ canvas: compassEl, antialias: true, alpha: true });
  compassRenderer.setSize(SIZE, SIZE);
  compassRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  compassScene = new THREE.Scene();
  compassCam = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
  compassCam.position.set(0, 0, 2.8);
  compassScene.add(new THREE.AmbientLight(0xffffff, 4.0));

  // Axes: X=右/左 (red), Y=上/下 (green), Z=前/後 (teal)
  const AXES = [
    { dir:[1,0,0], col:0xe05050, near:'右', far:'左' },
    { dir:[0,1,0], col:0x40d860, near:'上', far:'下' },
    { dir:[0,0,1], col:0x30a8e0, near:'前', far:'後' },
  ];
  AXES.forEach(({ dir, col, near, far }) => {
    const hexFull = '#' + col.toString(16).padStart(6,'0');
    const dimCol  = (col >> 1) & 0x7f7f7f;
    const hexDim  = '#' + dimCol.toString(16).padStart(6,'0');

    const posArrow = new THREE.ArrowHelper(
      new THREE.Vector3(...dir), new THREE.Vector3(0,0,0), 0.74, col, 0.22, 0.10
    );
    posArrow.line.material.depthTest = false;
    posArrow.cone.material.depthTest = false;
    compassScene.add(posArrow);

    const posLabel = makeLabelSprite(near, hexFull);
    posLabel.position.set(dir[0]*1.10, dir[1]*1.10, dir[2]*1.10);
    compassScene.add(posLabel);

    const negDir = dir.map(v => -v);
    const negArrow = new THREE.ArrowHelper(
      new THREE.Vector3(...negDir), new THREE.Vector3(0,0,0), 0.30, dimCol, 0.001, 0.001
    );
    negArrow.line.material.depthTest = false;
    compassScene.add(negArrow);

    const negLabel = makeLabelSprite(far, hexDim);
    negLabel.position.set(negDir[0]*0.56, negDir[1]*0.56, negDir[2]*0.56);
    compassScene.add(negLabel);
  });

  // Center sphere
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xd0d8e0, depthTest: false })
  );
  compassScene.add(dot);
}

// ── Raycasting ────────────────────────────────────────────────────
function onCanvasClick(event) {
  const rect=renderer.domElement.getBoundingClientRect();
  const mx=((event.clientX-rect.left)/rect.width)*2-1;
  const my=-((event.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(new THREE.Vector2(mx,my), camera);
  const meshes=[];
  compGroups.forEach(cg => cg.group.traverse(o=>{ if(o.isMesh&&!o.userData.isDoor) meshes.push(o); }));
  const hits=raycaster.intersectObjects(meshes,false);
  if (hits.length && hits[0].object.userData.compId!==undefined) {
    const id=hits[0].object.userData.compId;
    if (id===selectedId) {
      deselectComp();
    } else {
      selectComp(id);
    }
  } else {
    deselectComp();
  }
}

// ── Selection & Isolation ─────────────────────────────────────────
function selectComp(id) {
  if (selectedId!==null) deselectComp();
  selectedId = id;
  isolatedId = id;

  // Dim all others, highlight selected
  compGroups.forEach(cg => {
    const isSel = cg.id===id;
    cg.group.traverse(o => {
      if (!o.isMesh||!o.material) return;
      if (o.userData.isDoor) return;
      if (!isSel) {
        if (!o.material._origOpacity) {
          o.material._origTransparent = o.material.transparent;
          o.material._origOpacity     = o.material.opacity || 1.0;
          o.material._origDepthWrite  = o.material.depthWrite !== false;
          o.material._isolated = true;
        }
        o.material.transparent = true;
        o.material.opacity = 0.10;
        o.material.depthWrite = false;
      } else {
        if (o.material.emissive) {
          o.material.emissive.set(new THREE.Color(DEF[cg.key]?.top||0x4080ff));
          o.material.emissiveIntensity = 0.48;
        }
      }
    });
  });

  // Smooth camera zoom to component
  const cg = compGroups.find(c=>c.id===id);
  if (cg) {
    const def = DEF[cg.key];
    const D = def ? def.depth : 0.5;
    camTarget = { px:cg.cx+0.5, py:0.35, pz:W/2+2.2, lx:cg.cx, ly:0, lz:0 };
  }

  showParamPanel(id);
}

function deselectComp() {
  // Restore all materials
  compGroups.forEach(cg => {
    cg.group.traverse(o => {
      if (!o.isMesh||!o.material) return;
      if (o.material._isolated) {
        o.material.transparent = o.material._origTransparent || false;
        o.material.opacity     = o.material._origOpacity || 1.0;
        o.material.depthWrite  = o.material._origDepthWrite !== false;
        o.material._isolated   = false;
        delete o.material._origOpacity;
        delete o.material._origTransparent;
        delete o.material._origDepthWrite;
      }
      if (o.material.emissive) {
        o.material.emissive.set(0x000000);
        o.material.emissiveIntensity = 0;
      }
    });
  });

  selectedId = null;
  isolatedId = null;

  // Return camera to default
  camTarget = { ...CAM_DEF };

  hideParamPanel();
}

// ── Parameter Panel ───────────────────────────────────────────────
function buildPanelHTML(id) {
  const cg    = compGroups.find(c=>c.id===id);
  if (!cg) return '';
  const def   = DEF[cg.key];
  const pdefs = PARAMS_DEF[cg.key]||[];
  const vals  = paramStore[id]||{};
  return `
    <div class="mpanel-hdr">
      <span class="mpanel-title" style="color:var(--teal)">${def.label}</span>
      <button class="mpanel-close" onclick="window.mau3dClosePanel()">✕</button>
    </div>
    <div class="mpanel-body">
      ${pdefs.length ? pdefs.map(p=>`
        <div class="mpanel-row">
          <label class="mpanel-label">${p.label}</label>
          <div class="mpanel-input-wrap">
            <input class="mpanel-input" type="number" step="any"
              value="${vals[p.key]!==undefined?vals[p.key]:p.val}"
              onchange="window.mau3dSaveParam(${id},'${p.key}',this.value)">
            <span class="mpanel-unit">${p.unit}</span>
          </div>
        </div>`).join('')
        : '<div class="m3d-info-empty">無可編輯參數</div>'}
    </div>`;
}

function showParamPanel(id) {
  const html = buildPanelHTML(id);
  const overlay = document.getElementById('mau3d-param-panel');
  if (overlay) { overlay.innerHTML=html; overlay.classList.add('visible'); }
  const modalInfo = document.getElementById('mau3d-modal-info');
  if (modalInfo) modalInfo.innerHTML = html;
}

function hideParamPanel() {
  const overlay = document.getElementById('mau3d-param-panel');
  if (overlay) { overlay.classList.remove('visible'); overlay.innerHTML=''; }
  const modalInfo = document.getElementById('mau3d-modal-info');
  if (modalInfo) modalInfo.innerHTML = '<div class="m3d-info-empty">點選零件查看參數</div>';
}

// ── Public API ────────────────────────────────────────────────────
window.mau3dRefresh = function(comps) {
  if (!scene) { setTimeout(()=>window.mau3dRefresh(comps), 80); return; }
  deselectComp();
  buildScene(comps);
};

window.mau3dClosePanel = deselectComp;

window.mau3dSaveParam = function(id, key, val) {
  if (!paramStore[id]) paramStore[id]={};
  paramStore[id][key] = parseFloat(val);
};

window.mau3dToggleDoor = function() {
  doorTarget = doorTarget > 0.01 ? 0 : DOOR_OPEN_ANGLE;
};

window.mau3dExpand = function() {
  const modal = document.getElementById('mau3d-modal');
  const wrap  = document.getElementById('mau3d-modal-canvas-wrap');
  const info  = document.getElementById('mau3d-modal-info');
  if (!modal||!wrap) return;
  modal.classList.add('active');
  isModalOpen = true;
  wrap.style.position = 'relative';
  wrap.appendChild(renderer.domElement);
  if (compassEl) wrap.appendChild(compassEl);
  if (info) info.innerHTML = selectedId!==null
    ? buildPanelHTML(selectedId)
    : '<div class="m3d-info-empty">點選零件查看參數</div>';
  requestAnimationFrame(()=>{
    const rw=wrap.clientWidth, rh=wrap.clientHeight;
    if (!rw||!rh) return;
    camera.aspect=rw/rh; camera.updateProjectionMatrix(); renderer.setSize(rw,rh);
  });
};

window.mau3dCollapse = function() {
  const modal     = document.getElementById('mau3d-modal');
  const container = document.getElementById('mau3d-container');
  if (!modal||!container) return;
  modal.classList.remove('active');
  isModalOpen = false;
  container.appendChild(renderer.domElement);
  if (compassEl) container.appendChild(compassEl);
  requestAnimationFrame(()=>{
    const rw=container.clientWidth, rh=container.clientHeight;
    if (!rw||!rh) return;
    camera.aspect=rw/rh; camera.updateProjectionMatrix(); renderer.setSize(rw,rh);
  });
};

// ── Bootstrap ─────────────────────────────────────────────────────
if (document.readyState==='loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
