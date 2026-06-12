/* ============================================================
   GB200 NVL72 液冷資料中心數位孿生 — dctwin.js
   自包含模組：載入後自動註冊導覽按鈕、儀表板卡片與 3D 場景。
   整合方式：在 index.html 的 </body> 前加入
     <link rel="stylesheet" href="dctwin.css">
     <script type="module" src="dctwin.js"></script>
   ============================================================ */

let THREE = null, OrbitControls = null;

async function loadThree() {
  try {
    THREE = await import('three');
    ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
  } catch (e) {
    // 後備：頁面缺少 import map 時改走 esm.sh（會自動改寫相依）
    THREE = await import('https://esm.sh/three@0.163.0');
    ({ OrbitControls } = await import('https://esm.sh/three@0.163.0/examples/jsm/controls/OrbitControls.js'));
  }
}

/* ── 模擬引擎（單一資料源） ──────────────────────── */
const S = {
  racks: 10,        // GB200 NVL72 機櫃數
  kwRack: 120.3,    // kW / 櫃 → 預設總負載 1203 kW
  supply: 45.0,     // 冷卻水供應溫度 °C（暖水直接液冷）
  dt: 10.3,         // 設計供回水溫差 K
  capture: 95,      // 液冷捕獲比例 %
  copL: 8.0,        // 液冷迴路等效 COP（暖水可大量自然冷卻）
  copA: 3.5,        // 殘餘空冷 COP
  pumpKW: 20,       // CDU / 二次側泵浦功率
  lossPct: 9,       // UPS + PDU + 配電損失 % of IT
  miscKW: 36,       // 照明 + 監控 + 雜項
  chillerRT: 850,   // 冰機裝置容量（N+1）
  // 衍生值
  it: 0, liquid: 0, air: 0, flow: 0, ret: 0, pue: 0, total: 0, rtLoad: 0,
};

function compute() {
  S.it = S.racks * S.kwRack;
  S.liquid = S.it * S.capture / 100;
  S.air = S.it - S.liquid;
  S.flow = S.liquid * 3600 / (988 * 4.186 * S.dt);     // m³/h（水 @50°C）
  S.ret = S.supply + S.dt;
  const coolKW = S.liquid / S.copL + S.air / S.copA + S.pumpKW;
  const lossKW = S.it * S.lossPct / 100;
  S.total = S.it + coolKW + lossKW + S.miscKW;
  S.pue = S.total / S.it;
  S.rtLoad = (S.it + S.pumpKW) / 3.517;
}

const fmt = (v, d = 1) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

/* ── DOM 注入 ───────────────────────────────────── */
const TAB = 'dctwin';

function injectDOM() {
  if (document.getElementById('tab-' + TAB)) return;

  // 1) 主 section
  const sec = document.createElement('section');
  sec.id = 'tab-' + TAB;
  sec.className = 'tab-section';
  sec.innerHTML = `
  <div class="dt-shell">
    <aside class="dt-side" id="dt-side">
      <div class="dt-side-head">
        <div class="dt-side-logo">⌗</div>
        <div class="dt-side-title">
          <b>資料中心數位孿生</b>
          <span>INTEGRATED CONTROL CENTER</span>
        </div>
      </div>

      <div class="dt-group-label">全局核心營運指標</div>
      <div class="dt-pue-card">
        <div>
          <span class="dt-k">全局運行 PUE</span>
          <span class="dt-v" id="dt-s-pue">—</span>
        </div>
        <span class="dt-badge" id="dt-s-grade">運轉良好</span>
      </div>
      <div class="dt-mini-grid">
        <div class="dt-mini"><span class="dt-k">總 IT 負載</span><span class="dt-v" id="dt-s-it">— <small>kW</small></span></div>
        <div class="dt-mini"><span class="dt-k">冰機裝置容量</span><span class="dt-v" id="dt-s-rt">— <small>RT</small></span></div>
        <div class="dt-mini"><span class="dt-k">二次側供水</span><span class="dt-v cyan" id="dt-s-sup">— <small>°C</small></span></div>
        <div class="dt-mini"><span class="dt-k">二次側流量</span><span class="dt-v cyan" id="dt-s-flow">— <small>m³/h</small></span></div>
      </div>
      <div class="dt-power">
        <span class="dt-k">系統供電迴路狀態</span>
        <span class="dt-v">正常供電 (2N Grid Secured)</span>
      </div>

      <div class="dt-group-label">孿生場景導覽</div>
      <button class="dt-scene-btn active" data-scene="white">
        <span class="ico">🖥️</span>
        <span><b>GB200 液冷機房</b><span>White Space (IT Load)</span></span>
      </button>
      <button class="dt-scene-btn" data-scene="grey">
        <span class="ico">⚡</span>
        <span><b>2N 關鍵機電灰區</b><span>Grey Space (Power MSB)</span></span>
      </button>
      <button class="dt-scene-btn" data-scene="plant">
        <span class="ico">💧</span>
        <span><b>冰水動力中心</b><span>Chiller Plant (Hydronic Loop)</span></span>
      </button>
      <div style="height:14px"></div>
    </aside>

    <div class="dt-view" id="dt-view">
      <button class="dt-side-toggle" id="dt-side-toggle" aria-label="收合側邊欄" title="收合 / 展開側邊欄">«</button>
      <div class="dt-canvas-wrap" id="dt-canvas-wrap"></div>
      <div class="dt-loading" id="dt-loading">INITIALIZING DIGITAL TWIN…</div>

      <div class="dt-view-head">
        <div class="dt-chip">
          <span class="ico">🟩</span>
          <div>
            <h2><em>NVIDIA GB200 NVL72</em>液冷資料中心數位孿生</h2>
            <span class="sub">HIGH-FIDELITY THERMODYNAMIC ENGINE</span>
          </div>
        </div>
        <div class="dt-online">SYSTEM ONLINE</div>
      </div>

      <!-- 總體營運指標 -->
      <div class="dt-panel" id="dt-metrics">
        <div class="dt-panel-head"><span class="ico">📈</span>總體營運指標 (Global Metrics)
          <button class="dt-panel-close" data-close="dt-metrics" aria-label="關閉面板">✕</button>
        </div>
        <div class="dt-panel-body">
          <div class="dt-metric-row hero-green"><span class="dt-k">總 IT 負載 (Total Load)</span><span class="dt-v" id="dt-m-it">—<small>kW</small></span></div>
          <div class="dt-metric-row hero-cyan"><span class="dt-k">冷卻水供應 (Supply Temp)</span><span class="dt-v" id="dt-m-sup">—<small>°C</small></span></div>
          <div class="dt-metric-row hero-red"><span class="dt-k">冷卻水回流 (Return Temp)</span><span class="dt-v" id="dt-m-ret">—<small>°C</small></span></div>
          <div class="dt-metric-pair">
            <div class="dt-metric-row"><span class="dt-k">系統 PUE</span><span class="dt-v" style="color:var(--dt-green)" id="dt-m-pue">—</span></div>
            <div class="dt-metric-row"><span class="dt-k">冷卻液流量</span><span class="dt-v" id="dt-m-flow">—<small>m³/h</small></span></div>
          </div>
          <div class="dt-tip">💡 提示：在 3D 場景中點擊任一 <b>機櫃 (Rack)</b> 或 <b>冷卻單元 (CDU)</b> 以檢視設備詳細狀態。</div>
        </div>
      </div>

      <!-- 設備詳情 -->
      <div class="dt-panel" id="dt-detail" hidden>
        <div class="dt-panel-head"><span class="ico">🔍</span><span id="dt-d-title">設備詳情</span>
          <button class="dt-panel-close" data-close="dt-detail" aria-label="關閉面板">✕</button>
        </div>
        <div class="dt-panel-body" id="dt-d-body"></div>
      </div>

      <!-- 模擬計算 -->
      <div class="dt-panel" id="dt-sim" hidden>
        <div class="dt-panel-head"><span class="ico">🧮</span>模擬計算 (What-if)
          <button class="dt-panel-close" data-close="dt-sim" aria-label="關閉面板">✕</button>
        </div>
        <div class="dt-panel-body">
          <div class="dt-field"><label>機櫃數量 (GB200 NVL72)</label>
            <div class="row"><input type="range" id="dt-i-racks" min="4" max="24" step="1"><input type="number" id="dt-n-racks" min="4" max="24" step="1"><span class="unit">櫃</span></div></div>
          <div class="dt-field"><label>每櫃 IT 功率</label>
            <div class="row"><input type="range" id="dt-i-kw" min="60" max="140" step="0.1"><input type="number" id="dt-n-kw" min="60" max="140" step="0.1"><span class="unit">kW</span></div></div>
          <div class="dt-field"><label>冷卻水供應溫度</label>
            <div class="row"><input type="range" id="dt-i-sup" min="15" max="50" step="0.5"><input type="number" id="dt-n-sup" min="15" max="50" step="0.5"><span class="unit">°C</span></div></div>
          <div class="dt-field"><label>設計供回水溫差 ΔT</label>
            <div class="row"><input type="range" id="dt-i-dt" min="4" max="15" step="0.1"><input type="number" id="dt-n-dt" min="4" max="15" step="0.1"><span class="unit">K</span></div></div>
          <div class="dt-field"><label>液冷捕獲比例</label>
            <div class="row"><input type="range" id="dt-i-cap" min="60" max="100" step="1"><input type="number" id="dt-n-cap" min="60" max="100" step="1"><span class="unit">%</span></div></div>
          <div class="dt-field"><label>液冷迴路等效 COP</label>
            <div class="row"><input type="range" id="dt-i-cop" min="3" max="14" step="0.1"><input type="number" id="dt-n-cop" min="3" max="14" step="0.1"><span class="unit">—</span></div></div>
          <div class="dt-sim-note">所有指標即時連動：調整參數後，側欄、營運指標與 3D 管路熱度同步更新。供水溫度愈高，自然冷卻時數愈長、COP 愈高。</div>
        </div>
      </div>

      <!-- 底部視角工具列 -->
      <div class="dt-toolbar" role="toolbar" aria-label="視角與模擬工具">
        <button class="dt-tool" data-act="metrics"><span class="ico">📊</span>營運數據</button>
        <button class="dt-tool active" data-act="overview" data-view><span class="ico">🛰️</span>全景俯瞰</button>
        <button class="dt-tool" data-act="cold" data-view><span class="ico">❄️</span>冷通道</button>
        <button class="dt-tool" data-act="hot" data-view><span class="ico">🔥</span>熱通道</button>
        <button class="dt-tool" data-act="rack" data-view><span class="ico">🗄️</span>機櫃特寫</button>
        <button class="dt-tool" data-act="cdu" data-view><span class="ico">🌀</span>CDU 特寫</button>
        <button class="dt-tool" data-act="pipes" data-view><span class="ico">🛠️</span>頂部管路</button>
        <button class="dt-tool" data-act="sim"><span class="ico">🧮</span>模擬計算</button>
        <button class="dt-tool" data-act="doors"><span class="ico">🚪</span>機櫃開門</button>
        <button class="dt-tool" data-act="explode"><span class="ico">💥</span>爆炸視圖</button>
      </div>
    </div>
  </div>`;
  const main = document.querySelector('main') || document.body;
  main.appendChild(sec);

  // 2) 導覽按鈕
  const nav = document.getElementById('main-nav') || document.querySelector('header nav');
  if (nav && !nav.querySelector(`[data-tab="${TAB}"]`)) {
    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.dataset.tab = TAB;
    btn.textContent = '數位孿生';
    btn.addEventListener('click', openTwin);
    nav.appendChild(btn);
  }

  // 3) 儀表板入口卡（複製既有卡片樣式，找不到就略過）
  try {
    const dash = document.getElementById('tab-dashboard');
    const sample = dash && [...dash.querySelectorAll('[onclick]')].find(el => /showTab\(/.test(el.getAttribute('onclick') || ''));
    if (sample && !dash.querySelector('.dt-dash-entry')) {
      const card = sample.cloneNode(true);
      card.classList.add('dt-dash-entry');
      card.removeAttribute('onclick');
      const texts = [...card.querySelectorAll('*')].filter(el => el.children.length === 0 && el.textContent.trim());
      // 粗略替換文案：標題 / 描述 / 工具數
      let replaced = 0;
      texts.forEach(el => {
        const t = el.textContent.trim();
        if (/工具$/.test(t)) { el.textContent = '3 場景'; replaced++; }
        else if (t.length >= 3 && t.length <= 12 && replaced < 3 && /[\u4e00-\u9fff]/.test(t) && !/場景/.test(el.textContent)) {
          if (!card.dataset.titleDone) { el.textContent = 'GB200 數位孿生'; card.dataset.titleDone = '1'; }
          else if (!card.dataset.descDone) { el.textContent = '液冷機房 3D 即時模擬'; card.dataset.descDone = '1'; }
        }
      });
      const bar = card.querySelector('[class*="accent"], [style*="gradient"]');
      if (bar) bar.classList.add('dt-dash-card-accent');
      card.addEventListener('click', openTwin);
      sample.parentElement.appendChild(card);
    }
  } catch (e) { /* 儀表板卡片為加分項，失敗不影響主功能 */ }

  bindUI(sec);
}

/* ── 分頁切換 ───────────────────────────────────── */
function openTwin() {
  try { if (typeof window.showTab === 'function') window.showTab(TAB); } catch (e) {}
  const sec = document.getElementById('tab-' + TAB);
  if (!sec.classList.contains('active')) {
    document.querySelectorAll('.tab-section').forEach(s => s.classList.toggle('active', s === sec));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === TAB));
    const back = document.getElementById('nav-back');
    if (back) back.style.display = '';
    const nav = document.getElementById('main-nav');
    if (nav) nav.style.display = '';
    window.scrollTo(0, 0);
  }
  ensureInit();
}

/* ── three.js 場景 ──────────────────────────────── */
const T = {           // three.js 執行期物件
  ready: false, renderer: null, scene: null, camera: null, controls: null,
  groups: {}, racks: [], cdus: [], pickables: [],
  supplyMats: [], returnMats: [], rackHeatMats: [],
  plantSup: [], plantRet: [],
  camTween: null, activeScene: 'white', clock: null, reduced: false,
  pipeParticles: [], liveDisplay: null, liveTarget: null, _liveTick: null,
  _lastTime: 0, _lastDOM: 0,
};

const PAL = {
  bg: 0x080d18, floor: 0x0a1322, grid1: 0x16263e, grid2: 0x0f1a2c,
  rack: 0x10161f, rackEdge: 0x1f2c3f, door: 0x141c28, led: 0x76b900,
  cdu: 0x14202e, cduFace: 0x35c8ff,
  steel: 0x39465a, tray: 0x222c3a,
};

function ensureInit() {
  const sec = document.getElementById('tab-' + TAB);
  if (!sec || !sec.classList.contains('active')) return;
  if (T.ready) { onResize(); return; }
  T.ready = true;
  initThree().catch(err => {
    console.error('[dctwin] 3D 初始化失敗', err);
    const l = document.getElementById('dt-loading');
    if (l) l.textContent = '3D 引擎載入失敗：請確認 index.html 內含 three.js import map';
  });
}

async function initThree() {
  await loadThree();
  T.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wrap = document.getElementById('dt-canvas-wrap');

  T.renderer = new THREE.WebGLRenderer({ antialias: true });
  T.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  T.renderer.domElement.classList.add('dt-canvas');
  wrap.appendChild(T.renderer.domElement);

  T.scene = new THREE.Scene();
  T.scene.background = new THREE.Color(PAL.bg);
  T.scene.fog = new THREE.Fog(PAL.bg, 20, 52);

  T.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  T.camera.position.set(11, 8, 12);

  T.controls = new OrbitControls(T.camera, T.renderer.domElement);
  T.controls.target.set(0, 1.2, 0);
  T.controls.enableDamping = true;
  T.controls.dampingFactor = 0.08;
  T.controls.maxPolarAngle = Math.PI * 0.495;
  T.controls.minDistance = 1.5;
  T.controls.maxDistance = 40;

  // 燈光
  T.scene.add(new THREE.AmbientLight(0x90aacd, 0.55));
  const key = new THREE.DirectionalLight(0xcfe4ff, 0.9);
  key.position.set(8, 14, 6);
  T.scene.add(key);
  const fillG = new THREE.PointLight(0x76b900, 0.5, 30);
  fillG.position.set(0, 5, 0);
  T.scene.add(fillG);

  // 三個場景群組
  T.groups.white = buildWhiteSpace();
  T.groups.grey = buildGreySpace();
  T.groups.plant = buildPlant();
  T.groups.grey.visible = false;
  T.groups.plant.visible = false;
  T.scene.add(T.groups.white, T.groups.grey, T.groups.plant);

  T.clock = new THREE.Clock();
  new ResizeObserver(onResize).observe(wrap);
  onResize();

  T.renderer.domElement.addEventListener('pointerdown', e => { T._down = [e.clientX, e.clientY]; });
  T.renderer.domElement.addEventListener('pointerup', onPick);

  document.getElementById('dt-loading')?.remove();
  compute();
  refreshUI();
  buildPipeParticles();
  startLiveSim();
  animate();
}

function onResize() {
  if (!T.renderer) return;
  const wrap = document.getElementById('dt-canvas-wrap');
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (!w || !h) return;
  T.renderer.setSize(w, h);
  T.camera.aspect = w / h;
  T.camera.updateProjectionMatrix();
}

/* 文字標籤（canvas sprite） */
function makeLabel(text, color = '#9eff2e', scale = 1) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = '700 46px "Share Tech Mono", monospace';
  const w = Math.ceil(ctx.measureText(text).width) + 36;
  c.width = w; c.height = 76;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(8,13,24,0.85)';
  g.strokeStyle = color;
  g.lineWidth = 3;
  g.beginPath(); g.roundRect(2, 2, w - 4, 72, 12); g.fill(); g.stroke();
  g.font = '700 44px "Share Tech Mono", monospace';
  g.fillStyle = color;
  g.textBaseline = 'middle';
  g.fillText(text, 18, 40);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(w / 76 * 0.42 * scale, 0.42 * scale, 1);
  return sp;
}

function floorAndGrid(g, w = 34, d = 22) {
  const f = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color: PAL.floor, roughness: 0.92, metalness: 0.1 })
  );
  f.rotation.x = -Math.PI / 2;
  g.add(f);
  const grid = new THREE.GridHelper(Math.max(w, d), Math.max(w, d), PAL.grid1, PAL.grid2);
  grid.position.y = 0.002;
  g.add(grid);
}

/* ── 場景 1：GB200 液冷機房（White Space） ───────── */
const RK = { w: 0.62, h: 2.24, d: 1.22, pitch: 0.86, rowZ: 1.9, pipeY: 3.05 };

function buildWhiteSpace() {
  const g = new THREE.Group();
  floorAndGrid(g);
  buildRacks(g, S.racks);
  return g;
}

function disposeGroup(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.map?.dispose(); m.dispose(); });
  });
}

function buildRacks(parent, count) {
  // 清除舊機櫃層
  const old = parent.getObjectByName('rackLayer');
  if (old) { parent.remove(old); disposeGroup(old); }
  const layer = new THREE.Group();
  layer.name = 'rackLayer';
  T.racks = []; T.cdus = []; T.pickables = [];
  T.supplyMats = []; T.returnMats = []; T.rackHeatMats = [];

  const rows = [Math.ceil(count / 2), Math.floor(count / 2)];

  // ── 共用幾何體（GB200 NVL72 設計語言）────────────
  const geoBody   = new THREE.BoxGeometry(RK.w, RK.h, RK.d);
  const geoFace   = new THREE.BoxGeometry(RK.w - 0.03, RK.h - 0.06, 0.030);
  const MODS  = 18;                                   // 18 NVL2 模組（每格代表 2× NVL2）
  const modH  = (RK.h - 0.12) / MODS;

  // ── 前面板分區尺寸（依 GB200 NVL72 官網照片：黑格區→金托盤→黑格區→金色托盤疊）
  const fanH   = RK.h * 0.135;                        // 頂部黑色風扇/電源格區
  const shelfH = RK.h * 0.095;                        // 金色 NVSwitch/電源托盤
  const fan2H  = RK.h * 0.115;                        // 第二段黑色格區
  const FTRAYS = 18;
  const trayH2 = (RK.h - 0.10 - fanH - shelfH - fan2H) / FTRAYS;  // 金色運算托盤高
  const geoFanSq = new THREE.BoxGeometry(0.066, 0.056, 0.016);    // 黑色方格模組
  const geoShelf = new THREE.BoxGeometry(RK.w - 0.09, shelfH - 0.02, 0.042);
  const geoKnob  = new THREE.CylinderGeometry(0.012, 0.012, 0.022, 8);   // 黑色纜線接頭
  const geoTrayF = new THREE.BoxGeometry(RK.w - 0.10, trayH2 - 0.006, 0.030);  // 金色托盤面
  const geoConn  = new THREE.BoxGeometry(0.052, Math.max(trayH2 - 0.012, 0.02), 0.020); // 托盤側接頭塊

  // ── 內部構造共用幾何體 ─────────────────────────────
  const sledH  = modH;
  const geoSled    = new THREE.BoxGeometry(RK.w - 0.082, sledH - 0.014, RK.d - 0.18);
  const geoGPUblk  = new THREE.BoxGeometry(0.162, sledH - 0.028, 0.220);  // B200 GPU 晶片塊
  const geoCPUblk  = new THREE.BoxGeometry(0.086, sledH - 0.028, 0.132);  // Grace CPU 晶片
  const geoPlate   = new THREE.BoxGeometry(RK.w - 0.11, 0.007, RK.d - 0.22);  // 液冷冷板
  const geoRailInt = new THREE.BoxGeometry(0.022, RK.h - 0.08, 0.022);   // 垂直導軌
  const geoBusBar  = new THREE.BoxGeometry(0.015, RK.h - 0.12, 0.010);   // 電源匯流排
  const geoNVSW    = new THREE.BoxGeometry(RK.w - 0.09, 0.058, RK.d - 0.22);  // NVLink Spine Switch

  // 內部元件共用材質（一次建立、全機櫃共用）
  const gpuBlkMat  = new THREE.MeshStandardMaterial({ color: 0x0c0e0c, roughness: 0.55, metalness: 0.50, emissive: 0x0a0a00, emissiveIntensity: 0.10 });
  const cpuBlkMat  = new THREE.MeshStandardMaterial({ color: 0x0c0c14, roughness: 0.50, metalness: 0.55, emissive: 0x000410, emissiveIntensity: 0.12 });
  const plateMat   = new THREE.MeshStandardMaterial({ color: 0xc89840, roughness: 0.08, metalness: 0.92, emissive: 0x6b5326, emissiveIntensity: 0.50 });
  const sledMatA   = new THREE.MeshStandardMaterial({ color: 0xb07828, roughness: 0.12, metalness: 0.88, emissive: 0x593c14, emissiveIntensity: 0.50 });
  const sledMatB   = new THREE.MeshStandardMaterial({ color: 0xa87020, roughness: 0.14, metalness: 0.88, emissive: 0x523810, emissiveIntensity: 0.50 });
  const railIntMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.60, metalness: 0.72 });
  const busIntMat  = new THREE.MeshStandardMaterial({ color: 0xa05818, roughness: 0.28, metalness: 0.88, emissive: 0x3a1800, emissiveIntensity: 0.28 });
  const nvswMat    = new THREE.MeshStandardMaterial({ color: 0xb08030, emissive: 0x402800, emissiveIntensity: 0.30, roughness: 0.10, metalness: 0.90 });
  const geoMan = new THREE.CylinderGeometry(0.021, 0.021, RK.h - 0.14, 9);  // 後側液冷歧管
  const geoFit = new THREE.CylinderGeometry(0.015, 0.015, 0.046, 8);        // 快接頭

  // 共用材質（非熱敏感，建立一次）— 香檳金 / 近黑，比照官網照片
  const goldA        = new THREE.MeshStandardMaterial({ color: 0xc9a55a, roughness: 0.22, metalness: 0.92, emissive: 0x6b5326, emissiveIntensity: 0.55 });
  const goldB        = new THREE.MeshStandardMaterial({ color: 0xb8934a, roughness: 0.26, metalness: 0.92, emissive: 0x5c4720, emissiveIntensity: 0.55 });
  const goldShelfMat = new THREE.MeshStandardMaterial({ color: 0xcfa95e, roughness: 0.18, metalness: 0.95, emissive: 0x70582a, emissiveIntensity: 0.60 });
  const fanSqMat     = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.78, metalness: 0.35 });
  const connMat      = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.55, metalness: 0.45 });

  let id = 0;
  rows.forEach((n, r) => {
    if (!n) return;
    const z        = r === 0 ? -RK.rowZ : RK.rowZ;
    const face     = r === 0 ? -1 : 1;      // 前門朝外，熱通道在中間
    const backFace = -face;
    const x0       = -(n - 1) * RK.pitch / 2;

    for (let i = 0; i < n; i++) {
      id++;
      const rack = new THREE.Group();
      rack.position.set(x0 + i * RK.pitch, RK.h / 2, z);

      // ── 機箱本體（近黑機架框，GB200 NVL72 色調）
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.46, metalness: 0.70 });
      const body    = new THREE.Mesh(geoBody, bodyMat);
      body.userData = { pick: true, type: 'rack', id };
      rack.add(body);

      // ── 固定內部骨架（不隨爆炸移動）
      // 左右垂直導軌
      [-RK.w / 2 + 0.038, RK.w / 2 - 0.038].forEach(xR => {
        const rail = new THREE.Mesh(geoRailInt, railIntMat);
        rail.position.set(xR, 0, 0);
        rack.add(rail);
      });
      // 銅製電源匯流排（左內側，縱向）
      const bus = new THREE.Mesh(geoBusBar, busIntMat);
      bus.position.set(-RK.w / 2 + 0.055, 0, -RK.d / 4);
      rack.add(bus);
      // NVLink Spine Switch（頂部，藍色發光）
      const nvsw = new THREE.Mesh(geoNVSW, nvswMat);
      nvsw.position.y = RK.h / 2 - 0.046;
      rack.add(nvsw);

      // ── 18 × NVL2 計算模組（爆炸視圖展開）
      const trays = new THREE.Group();
      for (let s = 0; s < MODS; s++) {
        const sled = new THREE.Group();
        const yC = -RK.h / 2 + 0.06 + s * sledH + sledH / 2;
        sled.position.y = yC;
        sled.userData.baseY  = yC;
        sled.userData.spread = (s - (MODS - 1) / 2) * 0.148;

        // 計算板底座（奇偶色交替，增加視覺層次）
        sled.add(new THREE.Mesh(geoSled, s % 2 === 0 ? sledMatA : sledMatB));

        // 2× B200 GPU 晶片塊（綠色發光）
        [-0.148, 0.148].forEach(xG => {
          const gpu = new THREE.Mesh(geoGPUblk, gpuBlkMat);
          gpu.position.set(xG, 0, 0.025);
          sled.add(gpu);
        });

        // 1× Grace CPU 晶片（藍色發光，偏後）
        const cpu = new THREE.Mesh(geoCPUblk, cpuBlkMat);
        cpu.position.set(0, 0, -0.11);
        sled.add(cpu);

        // 液冷冷板（銀色金屬，平鋪蓋在晶片上方）
        const plate = new THREE.Mesh(geoPlate, plateMat);
        plate.position.y = sledH / 2 - 0.008;
        sled.add(plate);

        trays.add(sled);
      }
      // 讓 GPU 晶片材質隨熱模式變色
      T.rackHeatMats.push(gpuBlkMat);
      rack.add(trays);
      rack.userData.trays = trays;

      // ── 前面板（鉸鏈可開門）— 依 GB200 NVL72 官網照片打造
      const hinge = new THREE.Group();
      hinge.position.set(-RK.w / 2 + 0.02, 0, face * RK.d / 2);

      const doorMat = new THREE.MeshStandardMaterial({
        color: 0x0b0b0d, roughness: 0.50, metalness: 0.60,
        emissive: 0x000000, emissiveIntensity: 1,
      });
      const door = new THREE.Mesh(geoFace, doorMat);
      door.position.set(RK.w / 2 - 0.015, 0, face * 0.020);
      door.userData = { pick: true, type: 'rack', id };
      hinge.add(door);

      const cx = RK.w / 2 - 0.015;          // 面板中心 X（hinge 座標）
      const zF = face * 0.038;

      // 1) 黑色風扇／電源模組格（頂部與中段兩區）
      const fanCols = 5;
      [[RK.h / 2 - 0.04 - fanH / 2, fanH],
       [RK.h / 2 - 0.04 - fanH - shelfH - fan2H / 2, fan2H]].forEach(([ySec, hSec]) => {
        const rowsN = Math.max(2, Math.round(hSec / 0.085));
        for (let fr = 0; fr < rowsN; fr++) {
          for (let fc = 0; fc < fanCols; fc++) {
            const sq = new THREE.Mesh(geoFanSq, fanSqMat);
            sq.position.set(
              cx - (RK.w - 0.16) / 2 + (fc + 0.5) * ((RK.w - 0.16) / fanCols),
              ySec - hSec / 2 + (fr + 0.5) * (hSec / rowsN), zF);
            hinge.add(sq);
          }
        }
      });

      // 2) 金色 NVSwitch／電源托盤（大圓托盤 + 黑色纜線接頭）
      const yShelf = RK.h / 2 - 0.04 - fanH - shelfH / 2;
      const shelf  = new THREE.Mesh(geoShelf, goldShelfMat);
      shelf.position.set(cx, yShelf, zF);
      hinge.add(shelf);
      for (let c = 0; c < 8; c++) {
        const knob = new THREE.Mesh(geoKnob, connMat);
        knob.rotation.x = Math.PI / 2;
        knob.position.set(
          cx - (RK.w - 0.20) / 2 + (c + 0.5) * ((RK.w - 0.20) / 8),
          yShelf, zF + face * 0.014);
        hinge.add(knob);
      }

      // 3) 18 × 金色運算托盤疊（左右黑色接頭塊）
      const yTrayTop = RK.h / 2 - 0.04 - fanH - shelfH - fan2H;
      for (let m = 0; m < FTRAYS; m++) {
        const yT   = yTrayTop - (m + 0.5) * trayH2;
        const tray = new THREE.Mesh(geoTrayF, m % 2 === 0 ? goldA : goldB);
        tray.position.set(cx, yT, zF);
        hinge.add(tray);
        [-1, 1].forEach(sd => {
          const conn = new THREE.Mesh(geoConn, connMat);
          conn.position.set(cx + sd * (RK.w / 2 - 0.085), yT, zF + face * 0.006);
          hinge.add(conn);
        });
      }

      rack.add(hinge);
      rack.userData.hinge = hinge;
      rack.userData.face  = face;
      rack.userData.id    = id;
      T.rackHeatMats.push(doorMat, bodyMat);

      // ── 後側液冷歧管（供水藍／回水紅，per-rack）
      [[-0.14, 0x2a8cff], [0.14, 0xff4242]].forEach(([xOff, col]) => {
        const mMat = new THREE.MeshStandardMaterial({
          color: col, emissive: col, emissiveIntensity: 0.55,
          roughness: 0.26, metalness: 0.80,
        });
        const mMesh = new THREE.Mesh(geoMan, mMat);
        mMesh.position.set(xOff, 0, backFace * (RK.d / 2 - 0.055));
        rack.add(mMesh);
        // 快接頭（每 3 個 sled 一組，共 6 個）
        for (let q = 0; q < 6; q++) {
          const qy  = -(RK.h - 0.14) / 2 + (q + 0.5) * ((RK.h - 0.14) / 6);
          const qFit = new THREE.Mesh(geoFit,
            new THREE.MeshStandardMaterial({ color: col, roughness: 0.26, metalness: 0.84 }));
          qFit.rotation.x = Math.PI / 2;
          qFit.position.set(xOff, qy, backFace * (RK.d / 2 - 0.012));
          rack.add(qFit);
        }
      });

      layer.add(rack);
      T.racks.push(rack);
      T.pickables.push(body, door);
    }

    buildRowPiping(layer, n, z, x0);
    buildCDU(layer, x0 - RK.pitch * 0.95, z, r);
    const lab = makeLabel(r === 0 ? 'ROW A · GB200 NVL72' : 'ROW B · GB200 NVL72', '#35c8ff', 0.9);
    lab.position.set(0, RK.h + 1.55, z);
    layer.add(lab);
  });

  // 跨排聯絡主管（場景端部）
  const endX = (Math.max(rows[0], rows[1]) - 1) * RK.pitch / 2 + 1.1;
  [['#3aa0ff', 0.085, -0.16, true], ['#ff5a64', 0.085, 0.16, false]].forEach(([hex, r, dz, isSup]) => {
    const mat = pipeMat(hex, isSup);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, RK.rowZ * 2 + 0.6, 14), mat);
    m.rotation.x = Math.PI / 2;
    m.position.set(endX + dz, RK.pipeY + (isSup ? 0 : 0.3), 0);
    layer.add(m);
    (isSup ? T.supplyMats : T.returnMats).push(mat);
  });

  parent.add(layer);
  paintThermals();
}

function pipeMat(hex, isSupply) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex), roughness: 0.35, metalness: 0.6,
    emissive: new THREE.Color(hex), emissiveIntensity: 0.35,
  });
}

function buildRowPiping(layer, n, z, x0) {
  const len = (n - 1) * RK.pitch + 2.4;
  const supMat = pipeMat('#3aa0ff', true);
  const retMat = pipeMat('#ff5a64', false);
  T.supplyMats.push(supMat);
  T.returnMats.push(retMat);

  const mainGeo = new THREE.CylinderGeometry(0.085, 0.085, len, 14);
  const sup = new THREE.Mesh(mainGeo, supMat);
  sup.rotation.z = Math.PI / 2;
  sup.position.set(x0 + (n - 1) * RK.pitch / 2, RK.pipeY, z - 0.18);
  layer.add(sup);
  const ret = new THREE.Mesh(mainGeo, retMat);
  ret.rotation.z = Math.PI / 2;
  ret.position.set(sup.position.x, RK.pipeY + 0.3, z + 0.18);
  layer.add(ret);

  // 支架 + 纜線架
  const railMat = new THREE.MeshStandardMaterial({ color: PAL.steel, roughness: 0.7, metalness: 0.5 });
  const tray = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.5), railMat);
  tray.position.set(sup.position.x, RK.pipeY + 0.62, z);
  layer.add(tray);
  for (let i = 0; i <= n; i += 2) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, RK.pipeY + 0.7, 0.06), railMat);
    post.position.set(x0 - RK.pitch / 2 + i * RK.pitch, (RK.pipeY + 0.7) / 2, z);
    layer.add(post);
  }

  // 每櫃垂直落管（供 / 回）
  const dropGeo = new THREE.CylinderGeometry(0.034, 0.034, RK.pipeY - RK.h + 0.32, 10);
  for (let i = 0; i < n; i++) {
    const x = x0 + i * RK.pitch;
    const d1 = new THREE.Mesh(dropGeo, supMat);
    d1.position.set(x - 0.12, RK.h - 0.16 + dropGeo.parameters.height / 2, z - 0.18);
    layer.add(d1);
    const d2 = new THREE.Mesh(dropGeo, retMat);
    d2.position.set(x + 0.12, RK.h - 0.16 + dropGeo.parameters.height / 2 + 0.15, z + 0.18);
    layer.add(d2);
  }
}

function buildCDU(layer, x, z, rowIdx) {
  const cdu = new THREE.Group();
  cdu.position.set(x, RK.h / 2, z);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(RK.w, RK.h, RK.d),
    new THREE.MeshStandardMaterial({ color: PAL.cdu, roughness: 0.45, metalness: 0.6 })
  );
  body.userData = { pick: true, type: 'cdu', id: rowIdx + 1 };
  cdu.add(body);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(RK.w - 0.12, RK.h - 0.5),
    new THREE.MeshStandardMaterial({ color: 0x05121e, emissive: PAL.cduFace, emissiveIntensity: 0.5 })
  );
  face.position.z = (rowIdx === 0 ? -1 : 1) * (RK.d / 2 + 0.002);
  if (rowIdx === 0) face.rotation.y = Math.PI;
  cdu.add(face);
  for (let p = 0; p < 2; p++) {
    const pump = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.3, 12),
      new THREE.MeshStandardMaterial({ color: 0x2a3a52, metalness: 0.7, roughness: 0.4 })
    );
    pump.position.set(-0.12 + p * 0.24, -RK.h / 2 + 0.2, (rowIdx === 0 ? -1 : 1) * (RK.d / 2 + 0.16));
    pump.rotation.x = Math.PI / 2;
    cdu.add(pump);
  }
  const lab = makeLabel('CDU-' + (rowIdx + 1), '#35c8ff', 0.7);
  lab.position.y = RK.h / 2 + 0.45;
  cdu.add(lab);
  layer.add(cdu);
  T.cdus.push(cdu);
  T.pickables.push(body);
}

/* ── 場景 2：2N 關鍵機電灰區 ─────────────────────── */
function buildGreySpace() {
  const g = new THREE.Group();
  floorAndGrid(g, 30, 20);
  const mk = (w, h, d, color, x, z, data, labelText, labColor) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.45 })
    );
    m.position.set(x, h / 2, z);
    if (data) { m.userData = { pick: true, ...data }; T.pickables.push(m); }
    g.add(m);
    if (labelText) {
      const lab = makeLabel(labelText, labColor, 0.8);
      lab.position.set(x, h + 0.55, z);
      g.add(lab);
    }
    return m;
  };
  // A / B 兩路（2N）
  [[-4.2, '#f0a430', 'A'], [4.2, '#35c8ff', 'B']].forEach(([z, col, path]) => {
    for (let i = 0; i < 4; i++)
      mk(1.1, 2.1, 0.9, 0x222e42, -4.5 + i * 2.1, z, { type: 'ups', path, idx: i + 1 }, i === 0 ? `UPS ${path} 路 · 2N` : '', col);
    mk(2.4, 2.3, 1.1, 0x1b2638, 4.6, z, { type: 'msb', path }, `MSB-${path}`, col);
    // 母線槽
    const bus = new THREE.Mesh(
      new THREE.BoxGeometry(13, 0.22, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x10161f, emissive: new THREE.Color(col), emissiveIntensity: 0.5 })
    );
    bus.position.set(0, 2.9, z);
    g.add(bus);
  });
  const lab = makeLabel('2N GRID SECURED · GREY SPACE', '#9eff2e');
  lab.position.set(0, 4.4, 0);
  g.add(lab);
  return g;
}

/* ── 場景 3：冰水動力中心 ───────────────────────── */
function buildPlant() {
  const g = new THREE.Group();
  floorAndGrid(g, 30, 20);
  // 兩台冰水主機（850 RT 裝置容量，N+1）
  for (let i = 0; i < 2; i++) {
    const x = -3 + i * 6;
    const skid = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.3, 1.8),
      new THREE.MeshStandardMaterial({ color: 0x141d2c, roughness: 0.7 }));
    skid.position.set(x, 0.15, 0);
    g.add(skid);
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 4, 22),
      new THREE.MeshStandardMaterial({ color: 0x1c2b3f, metalness: 0.6, roughness: 0.35 }));
    shell.rotation.z = Math.PI / 2;
    shell.position.set(x, 1.05, 0);
    shell.userData = { pick: true, type: 'chiller', id: i + 1 };
    T.pickables.push(shell);
    g.add(shell);
    const shell2 = shell.clone();
    shell2.geometry = new THREE.CylinderGeometry(0.5, 0.5, 4.1, 18);
    shell2.position.y = 1.95;
    g.add(shell2);
    const lab = makeLabel(`CHILLER-${i + 1} · 425 RT`, '#35c8ff', 0.85);
    lab.position.set(x, 3.05, 0);
    g.add(lab);
  }
  // 泵組
  for (let p = 0; p < 3; p++) {
    const pump = new THREE.Group();
    pump.position.set(-3.4 + p * 3.4, 0, 4.4);
    const vol = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 14),
      new THREE.MeshStandardMaterial({ color: 0x24405e, metalness: 0.6, roughness: 0.4 }));
    vol.position.y = 0.35;
    vol.userData = { pick: true, type: 'pump', id: p + 1 };
    T.pickables.push(vol);
    pump.add(vol);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.55, 14),
      new THREE.MeshStandardMaterial({ color: 0x33486a, metalness: 0.6, roughness: 0.4 }));
    motor.position.y = 0.9;
    pump.add(motor);
    g.add(pump);
  }
  const labP = makeLabel('CHW PUMPS · N+1', '#9eff2e', 0.8);
  labP.position.set(0, 1.9, 4.4);
  g.add(labP);
  // 主供回水母管
  [['#3aa0ff', 1.5, true], ['#ff5a64', 2.0, false]].forEach(([hex, y, isSup]) => {
    const mat = pipeMat(hex, isSup);
    (isSup ? T.plantSup : T.plantRet).push(mat);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 14, 16), mat);
    m.rotation.z = Math.PI / 2;
    m.position.set(0, y, -2.6);
    g.add(m);
  });
  return g;
}

/* ── 熱力著色（供回水溫度 → 管路顏色 / 機櫃熱度） ── */
function paintThermals() {
  if (!THREE) return;
  // 供水：15°C 深藍 → 50°C 青綠
  const tSup = Math.min(Math.max((S.supply - 15) / 35, 0), 1);
  const cSup = new THREE.Color('#2456ff').lerp(new THREE.Color('#35e0c8'), tSup);
  [...T.supplyMats, ...T.plantSup].forEach(m => { m.color.copy(cSup); m.emissive.copy(cSup); });
  // 回水：45°C 橙 → 70°C 鮮紅
  const tRet = Math.min(Math.max((S.ret - 45) / 25, 0), 1);
  const cRet = new THREE.Color('#ff9a3c').lerp(new THREE.Color('#ff2e44'), tRet);
  [...T.returnMats, ...T.plantRet].forEach(m => { m.color.copy(cRet); m.emissive.copy(cRet); });
  // 機櫃熱度（熱通道模式）
  const heatOn = document.querySelector('#tab-dctwin [data-act="hot"]')?.classList.contains('active');
  const frac = Math.min(S.kwRack / 140, 1);
  T.rackHeatMats.forEach(m => {
    m.emissive.set(heatOn ? new THREE.Color('#ff6a2e').multiplyScalar(0.4 + 0.6 * frac) : new THREE.Color(0x000000));
    m.emissiveIntensity = heatOn ? 0.55 : 1;
  });
}

/* ── 管路流動粒子 ─────────────────────────────────── */
function buildPipeParticles() {
  const old = T.groups.white?.getObjectByName('pipeParticleLayer');
  if (old) {
    old.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    T.groups.white.remove(old);
  }
  T.pipeParticles = [];
  if (!T.groups.white) return;

  const pg = new THREE.Group();
  pg.name = 'pipeParticleLayer';
  const rows = [Math.ceil(S.racks / 2), Math.floor(S.racks / 2)];
  const maxN = Math.max(rows[0], rows[1]);

  rows.forEach((n, r) => {
    if (!n) return;
    const z = r === 0 ? -RK.rowZ : RK.rowZ;
    const x0 = -(n - 1) * RK.pitch / 2;
    const xFar = x0 + (n - 1) * RK.pitch + 1.15;
    const cduX = x0 - RK.pitch * 0.9;
    const cnt = Math.max(8, n + 3);

    for (let i = 0; i < cnt; i++) {
      const jit = (Math.random() - 0.5) * 0.05;
      const t0 = i / cnt;
      // 供水粒子（藍）：CDU → 遠端
      const sg = new THREE.SphereGeometry(0.055, 7, 5);
      const sm = new THREE.MeshStandardMaterial({ color: 0x55d4ff, emissive: 0x00aaff, emissiveIntensity: 2.4, transparent: true, opacity: 0.92, depthTest: false, depthWrite: false });
      const smesh = new THREE.Mesh(sg, sm);
      smesh.renderOrder = 10;
      const ss = new THREE.Vector3(cduX, RK.pipeY + jit, z - 0.18);
      const se = new THREE.Vector3(xFar, RK.pipeY + jit, z - 0.18);
      smesh.position.lerpVectors(ss, se, t0);
      pg.add(smesh);
      T.pipeParticles.push({ mesh: smesh, s: ss, e: se, t: t0, spd: 0.082 + Math.random() * 0.03 });
      // 回水粒子（紅）：遠端 → CDU
      const rg = new THREE.SphereGeometry(0.055, 7, 5);
      const rm = new THREE.MeshStandardMaterial({ color: 0xff6060, emissive: 0xff2200, emissiveIntensity: 2.2, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false });
      const rmesh = new THREE.Mesh(rg, rm);
      rmesh.renderOrder = 10;
      const rs = new THREE.Vector3(xFar, RK.pipeY + 0.3 + jit, z + 0.18);
      const re = new THREE.Vector3(cduX, RK.pipeY + 0.3 + jit, z + 0.18);
      rmesh.position.lerpVectors(rs, re, t0);
      pg.add(rmesh);
      T.pipeParticles.push({ mesh: rmesh, s: rs, e: re, t: t0, spd: 0.068 + Math.random() * 0.025 });
    }
  });

  // 跨排端部聯絡管粒子（z 向）
  const endX = (maxN - 1) * RK.pitch / 2 + 1.1;
  for (let i = 0; i < 6; i++) {
    const t0 = i / 6;
    const sg2 = new THREE.SphereGeometry(0.055, 7, 5);
    const sm2 = new THREE.MeshStandardMaterial({ color: 0x55d4ff, emissive: 0x00aaff, emissiveIntensity: 2.4, transparent: true, opacity: 0.92, depthTest: false, depthWrite: false });
    const s2 = new THREE.Mesh(sg2, sm2);
    s2.renderOrder = 10;
    const ss2 = new THREE.Vector3(endX - 0.16, RK.pipeY, RK.rowZ + 0.15);
    const se2 = new THREE.Vector3(endX - 0.16, RK.pipeY, -RK.rowZ - 0.15);
    s2.position.lerpVectors(ss2, se2, t0);
    pg.add(s2);
    T.pipeParticles.push({ mesh: s2, s: ss2, e: se2, t: t0, spd: 0.1 });

    const rg2 = new THREE.SphereGeometry(0.055, 7, 5);
    const rm2 = new THREE.MeshStandardMaterial({ color: 0xff6060, emissive: 0xff2200, emissiveIntensity: 2.2, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false });
    const r2 = new THREE.Mesh(rg2, rm2);
    r2.renderOrder = 10;
    const rs2 = new THREE.Vector3(endX + 0.16, RK.pipeY + 0.3, -RK.rowZ - 0.15);
    const re2 = new THREE.Vector3(endX + 0.16, RK.pipeY + 0.3, RK.rowZ + 0.15);
    r2.position.lerpVectors(rs2, re2, t0);
    pg.add(r2);
    T.pipeParticles.push({ mesh: r2, s: rs2, e: re2, t: t0, spd: 0.086 });
  }

  T.groups.white.add(pg);
}

/* ── 點擊選取 → 設備詳情 ────────────────────────── */
const ray = { caster: null, v: null };
function onPick(e) {
  if (!T.renderer) return;
  if (T._down && Math.hypot(e.clientX - T._down[0], e.clientY - T._down[1]) > 6) return; // 拖曳不觸發
  ray.caster ??= new THREE.Raycaster();
  ray.v ??= new THREE.Vector2();
  const r = T.renderer.domElement.getBoundingClientRect();
  ray.v.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.caster.setFromCamera(ray.v, T.camera);
  const hits = ray.caster.intersectObjects(T.pickables, false);
  if (!hits.length) return;
  showDetail(hits[0].object.userData);
}

function specRow(k, v, cls = '') {
  return `<div class="dt-spec"><span class="dt-k">${k}</span><span class="dt-v ${cls}">${v}</span></div>`;
}

function showDetail(d) {
  const panel = document.getElementById('dt-detail');
  const title = document.getElementById('dt-d-title');
  const body = document.getElementById('dt-d-body');
  document.getElementById('dt-sim').hidden = true;
  let html = '';
  if (d.type === 'rack') {
    const rn = d.id <= Math.ceil(S.racks / 2) ? `A${String(d.id).padStart(2,'0')}` : `B${String(d.id - Math.ceil(S.racks/2)).padStart(2,'0')}`;
    title.textContent = `Rack-${rn} · GB200 NVL72`;
    const live = T.liveDisplay || { it: S.it, supply: S.supply, ret: S.ret };
    const kwLive = (live.it / S.racks);
    const gpuT = Math.min(95, 62 + (kwLive / 140) * 22 + (Math.random() - 0.5) * 2.8);
    const nvT  = Math.min(88, gpuT - 5.5 + (Math.random() - 0.5) * 1.5);
    const kwPct = Math.min(100, kwLive / 140 * 100);
    const gpuPct = Math.min(100, (gpuT - 30) / 65 * 100);
    const nvPct  = Math.min(100, (nvT  - 28) / 60 * 100);
    const gpuCls = gpuT > 82 ? 'red' : gpuT > 72 ? 'orange' : 'green';
    const barRow = (label, val, unit, pct, cls) =>
      `<div class="dt-bar-row"><div class="dt-bar-head"><span class="dt-k">${label}</span><span class="dt-v ${cls}">${val} <small>${unit}</small></span></div>` +
      `<div class="dt-bar-track"><div class="dt-bar-fill ${cls}" style="width:${pct.toFixed(1)}%"></div></div></div>`;
    html =
      specRow('運算配置', '72× B200 + 36× Grace CPU') +
      barRow('機櫃功耗', fmt(kwLive, 1), 'kW', kwPct, 'green') +
      barRow('GPU 接面溫度', fmt(gpuT, 1), '°C', gpuPct, gpuCls) +
      barRow('NVSwitch 溫度', fmt(nvT, 1), '°C', nvPct, 'cyan') +
      specRow('液冷捕獲', fmt(S.capture, 0) + ' %') +
      specRow('冷卻液進水', fmt(live.supply, 2) + ' °C', 'cyan') +
      specRow('冷卻液出水', fmt(live.ret, 2) + ' °C', 'red') +
      specRow('機櫃流量', fmt(live.flow / S.racks, 2) + ' m³/h') +
      specRow('狀態', '✅ 運轉中', 'green');
  } else if (d.type === 'cdu') {
    const rowRacks = d.id === 1 ? Math.ceil(S.racks / 2) : Math.floor(S.racks / 2);
    const rowHeat = S.liquid * rowRacks / S.racks;
    title.textContent = `CDU-${d.id} · In-Row 冷卻液分配單元`;
    html =
      specRow('服務機櫃', rowRacks + ' 櫃') +
      specRow('熱交換量', fmt(rowHeat) + ' kW', 'green') +
      specRow('二次側流量', fmt(S.flow * rowRacks / S.racks, 1) + ' m³/h', 'cyan') +
      specRow('趨近溫差', '2.0 K') +
      specRow('泵浦', '2× 變頻 (N+1)') +
      specRow('狀態', '✅ 運轉中', 'green');
  } else if (d.type === 'ups') {
    const loadPer = S.total / 2 / 4;
    title.textContent = `UPS ${d.path}${d.idx} · 750 kVA`;
    html =
      specRow('供電路徑', d.path + ' 路（2N 雙迴路）') +
      specRow('額定容量', '750 kVA') +
      specRow('目前負載', fmt(loadPer) + ' kW') +
      specRow('負載率', fmt(loadPer / 675 * 100, 1) + ' %', 'green') +
      specRow('電池後備', '10 min @ 滿載') +
      specRow('狀態', '✅ 雙迴路在線', 'green');
  } else if (d.type === 'msb') {
    title.textContent = `MSB-${d.path} · 主配電盤`;
    html =
      specRow('供電路徑', d.path + ' 路') +
      specRow('饋線', '4× UPS + 機械負載') +
      specRow('通過功率', fmt(S.total / 2) + ' kW') +
      specRow('狀態', '✅ 正常供電', 'green');
  } else if (d.type === 'chiller') {
    title.textContent = `CHILLER-${d.id} · 磁浮離心式`;
    html =
      specRow('額定容量', '425 RT') +
      specRow('裝置配置', '2 台 · N+1') +
      specRow('系統冷負載', fmt(S.rtLoad) + ' RT', 'green') +
      specRow('本機負載率', fmt(Math.min(S.rtLoad / 2, 425) / 425 * 100, 1) + ' %') +
      specRow('冰水供水', fmt(S.supply, 1) + ' °C', 'cyan') +
      specRow('狀態', S.rtLoad > 850 ? '⚠️ 超出裝置容量' : '✅ 運轉中', S.rtLoad > 850 ? 'red' : 'green');
  } else if (d.type === 'pump') {
    title.textContent = `CHWP-${d.id} · 二次側冰水泵`;
    html =
      specRow('配置', '3 台 · N+1 變頻') +
      specRow('系統流量', fmt(S.flow) + ' m³/h', 'cyan') +
      specRow('單泵流量', fmt(S.flow / 2) + ' m³/h') +
      specRow('狀態', '✅ 變頻運轉', 'green');
  }
  body.innerHTML = html;
  panel.hidden = false;
}

/* ── 相機運鏡 ───────────────────────────────────── */
const VIEWS = {
  overview: { p: [11, 8, 12], t: [0, 1.2, 0] },
  cold:     { p: [0, 1.55, 6.6], t: [0, 1.4, -8] },
  hot:      { p: [-6.2, 1.7, 0], t: [8, 1.3, 0] },
  rack:     { p: [2.0, 1.7, 4.6], t: [0.6, 1.2, 1.9] },
  cdu:      { p: () => { const c = T.cdus[0]; return c ? [c.position.x - 1.8, 1.7, c.position.z + (c.position.z < 0 ? -2.2 : 2.2)] : [-6, 1.7, -4]; },
              t: () => { const c = T.cdus[0]; return c ? [c.position.x, 1.2, c.position.z] : [0, 1, 0]; } },
  pipes:    { p: [4.5, 5.6, 4.5], t: [0, RK.pipeY, 0] },
  greyHome: { p: [9, 7, 11], t: [0, 1.2, 0] },
  plantHome:{ p: [8, 6, 10], t: [0, 1.2, 0] },
};

function goView(name) {
  const v = VIEWS[name];
  if (!v || !T.camera) return;
  const p = typeof v.p === 'function' ? v.p() : v.p;
  const t = typeof v.t === 'function' ? v.t() : v.t;
  if (T.reduced) {
    T.camera.position.set(...p);
    T.controls.target.set(...t);
    return;
  }
  T.camTween = {
    t0: performance.now(), dur: 750,
    p0: T.camera.position.clone(), p1: new THREE.Vector3(...p),
    g0: T.controls.target.clone(), g1: new THREE.Vector3(...t),
  };
}

/* ── 主迴圈 ─────────────────────────────────────── */
function animate() {
  requestAnimationFrame(animate);
  const sec = document.getElementById('tab-' + TAB);
  if (!sec || !sec.classList.contains('active')) return;   // 非當前分頁時暫停渲染

  // 相機補間
  if (T.camTween) {
    const k = Math.min((performance.now() - T.camTween.t0) / T.camTween.dur, 1);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    T.camera.position.lerpVectors(T.camTween.p0, T.camTween.p1, e);
    T.controls.target.lerpVectors(T.camTween.g0, T.camTween.g1, e);
    if (k >= 1) T.camTween = null;
  }

  // 機門 / 爆炸視圖補間
  const doorTarget = T._doors ? -1.92 : 0;
  T.racks.forEach(rk => {
    const h = rk.userData.hinge;
    h.rotation.y += ((rk.userData.face === -1 ? -doorTarget : doorTarget) - h.rotation.y) * 0.12;
    rk.userData.trays.children.forEach(tr => {
      const ty = tr.userData.baseY + (T._explode ? tr.userData.spread : 0);
      tr.position.y += (ty - tr.position.y) * 0.12;
    });
  });

  // delta time
  const _now = performance.now() * 0.001;
  const _dt = T._lastTime ? Math.min(_now - T._lastTime, 0.05) : 0.016;
  T._lastTime = _now;

  // 冷卻液脈動（減少動態偏好時停用）
  if (!T.reduced && T.clock) {
    const t = T.clock.getElapsedTime();
    const s = 0.35 + Math.sin(t * 2.2) * 0.12;
    [...T.supplyMats, ...T.plantSup].forEach(m => m.emissiveIntensity = s);
    [...T.returnMats, ...T.plantRet].forEach(m => m.emissiveIntensity = s + 0.08);

    // 管路流動粒子
    if (T.pipeParticles.length) {
      T.pipeParticles.forEach(p => {
        p.t = (p.t + p.spd * _dt) % 1.0;
        p.mesh.position.lerpVectors(p.s, p.e, p.t);
        p.mesh.material.opacity = 0.48 + 0.44 * Math.sin(p.t * Math.PI * 2.5);
      });
    }

    // 即時感測器數據平滑插值（~20fps DOM 更新）
    if (T.liveDisplay && T.liveTarget) {
      const alpha = Math.min(1.6 * _dt, 0.1);
      const ld = T.liveDisplay, lt = T.liveTarget;
      ld.it     += (lt.it     - ld.it)     * alpha;
      ld.supply += (lt.supply - ld.supply) * alpha;
      ld.ret    += (lt.ret    - ld.ret)    * alpha;
      ld.flow   += (lt.flow   - ld.flow)   * alpha;
      ld.pue    += (lt.pue    - ld.pue)    * alpha;
      if (_now - T._lastDOM > 0.05) {
        T._lastDOM = _now;
        refreshUILive();
      }
    }
  }

  T.controls.update();
  T.renderer.render(T.scene, T.camera);
}

/* ── UI 綁定與刷新 ──────────────────────────────── */
function bindUI(sec) {
  // 側欄收合
  const side = sec.querySelector('#dt-side');
  const tg = sec.querySelector('#dt-side-toggle');
  tg.addEventListener('click', () => {
    side.classList.toggle('collapsed');
    tg.textContent = side.classList.contains('collapsed') ? '»' : '«';
    setTimeout(onResize, 320);
  });

  // 場景切換
  sec.querySelectorAll('.dt-scene-btn').forEach(b => b.addEventListener('click', () => {
    sec.querySelectorAll('.dt-scene-btn').forEach(x => x.classList.toggle('active', x === b));
    const name = b.dataset.scene;
    T.activeScene = name;
    if (T.groups.white) {
      T.groups.white.visible = name === 'white';
      T.groups.grey.visible = name === 'grey';
      T.groups.plant.visible = name === 'plant';
      goView(name === 'white' ? 'overview' : name === 'grey' ? 'greyHome' : 'plantHome');
      document.getElementById('dt-detail').hidden = true;
    }
    // 白區工具僅於白區可用
    sec.querySelectorAll('.dt-tool[data-view], [data-act="doors"], [data-act="explode"]').forEach(t => {
      if (t.dataset.act !== 'overview') t.style.display = name === 'white' ? '' : 'none';
    });
  }));

  // 面板關閉
  sec.querySelectorAll('.dt-panel-close').forEach(b => b.addEventListener('click', () => {
    document.getElementById(b.dataset.close).hidden = true;
    if (b.dataset.close === 'dt-metrics') sec.querySelector('[data-act="metrics"]').classList.remove('active');
    if (b.dataset.close === 'dt-sim') sec.querySelector('[data-act="sim"]').classList.remove('active');
  }));
  sec.querySelector('[data-act="metrics"]').classList.add('active');

  // 工具列
  sec.querySelectorAll('.dt-tool').forEach(b => b.addEventListener('click', () => {
    const act = b.dataset.act;
    if (b.dataset.view !== undefined) {
      sec.querySelectorAll('.dt-tool[data-view]').forEach(x => x.classList.toggle('active', x === b));
      goView(act === 'hot' || act === 'cold' ? act : act);
      paintThermals();
      return;
    }
    if (act === 'metrics') {
      const p = document.getElementById('dt-metrics');
      p.hidden = !p.hidden;
      b.classList.toggle('active', !p.hidden);
    } else if (act === 'sim') {
      const p = document.getElementById('dt-sim');
      p.hidden = !p.hidden;
      document.getElementById('dt-detail').hidden = true;
      b.classList.toggle('active', !p.hidden);
    } else if (act === 'doors') {
      T._doors = !T._doors;
      b.classList.toggle('active', T._doors);
    } else if (act === 'explode') {
      T._explode = !T._explode;
      b.classList.toggle('active', T._explode);
      if (T._explode && !T._doors) { T._doors = true; sec.querySelector('[data-act="doors"]').classList.add('active'); }
    }
  }));

  // 模擬輸入（slider ↔ number 雙向）
  const fields = [
    ['racks', v => { S.racks = Math.round(v); }, () => S.racks, true],
    ['kw',    v => { S.kwRack = v; }, () => S.kwRack],
    ['sup',   v => { S.supply = v; }, () => S.supply],
    ['dt',    v => { S.dt = v; }, () => S.dt],
    ['cap',   v => { S.capture = v; }, () => S.capture],
    ['cop',   v => { S.copL = v; }, () => S.copL],
  ];
  fields.forEach(([key, set, get, rebuild]) => {
    const r = sec.querySelector('#dt-i-' + key);
    const n = sec.querySelector('#dt-n-' + key);
    r.value = n.value = get();
    const apply = v => {
      v = parseFloat(v);
      if (!isFinite(v)) return;
      v = Math.min(Math.max(v, parseFloat(r.min)), parseFloat(r.max));
      set(v);
      r.value = n.value = get();
      compute();
      refreshUI();
      if (rebuild && T.groups.white) {
        buildRacks(T.groups.white, S.racks);
        buildPipeParticles();
      } else paintThermals();
    };
    r.addEventListener('input', () => apply(r.value));
    n.addEventListener('change', () => apply(n.value));
  });
}

function refreshUI() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v; };
  set('dt-s-pue', fmt(S.pue, 3));
  set('dt-s-it', fmt(S.it, 0) + ' <small>kW</small>');
  set('dt-s-rt', fmt(S.chillerRT, 0) + ' <small>RT</small>');
  set('dt-s-sup', fmt(S.supply, 1) + ' <small>°C</small>');
  set('dt-s-flow', fmt(S.flow, 0) + ' <small>m³/h</small>');
  set('dt-m-it', fmt(S.it, 0) + '<small>kW</small>');
  set('dt-m-sup', fmt(S.supply, 2) + '<small>°C</small>');
  set('dt-m-ret', fmt(S.ret, 2) + '<small>°C</small>');
  set('dt-m-pue', fmt(S.pue, 2));
  set('dt-m-flow', fmt(S.flow, 1) + '<small>m³/h</small>');
  const grade = document.getElementById('dt-s-grade');
  if (grade) {
    const over = S.rtLoad > S.chillerRT;
    grade.textContent = over ? '冷量不足' : S.pue <= 1.35 ? '運轉良好' : '效率偏低';
    grade.classList.toggle('warn', over || S.pue > 1.35);
  }
  // 重設即時數據基準（參數變更後同步）
  if (T.liveDisplay) {
    T.liveDisplay.it = T.liveTarget.it = S.it;
    T.liveDisplay.supply = T.liveTarget.supply = S.supply;
    T.liveDisplay.ret = T.liveTarget.ret = S.ret;
    T.liveDisplay.flow = T.liveTarget.flow = S.flow;
    T.liveDisplay.pue = T.liveTarget.pue = S.pue;
  }
}

/* ── 即時模擬（感測器雜訊）────────────────────────── */
function startLiveSim() {
  compute();
  T.liveDisplay = { it: S.it, supply: S.supply, ret: S.ret, flow: S.flow, pue: S.pue };
  T.liveTarget  = { ...T.liveDisplay };
  if (T._liveTick) clearInterval(T._liveTick);
  T._liveTick = setInterval(() => {
    const rng = (base, amp) => base + (Math.random() - 0.5) * amp * 2;
    T.liveTarget.it     = Math.max(S.it * 0.974, Math.min(S.it * 1.026, rng(S.it, S.it * 0.014)));
    T.liveTarget.supply = rng(S.supply, 0.22);
    T.liveTarget.flow   = Math.max(S.flow * 0.97, rng(S.flow, S.flow * 0.018));
    T.liveTarget.ret    = T.liveTarget.supply + S.dt + rng(0, 0.16);
    const liveIT = T.liveTarget.it;
    const coolKW = liveIT * S.capture / 100 / S.copL + liveIT * (1 - S.capture / 100) / S.copA + S.pumpKW;
    T.liveTarget.pue = (liveIT + coolKW + S.it * S.lossPct / 100 + S.miscKW) / liveIT;
  }, 1500);
}

function refreshUILive() {
  if (!T.liveDisplay) return;
  const ld = T.liveDisplay;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v; };
  set('dt-s-pue',  fmt(ld.pue, 3));
  set('dt-s-it',   fmt(ld.it, 0) + ' <small>kW</small>');
  set('dt-s-sup',  fmt(ld.supply, 1) + ' <small>°C</small>');
  set('dt-s-flow', fmt(ld.flow, 0) + ' <small>m³/h</small>');
  set('dt-m-it',   fmt(ld.it, 0) + '<small>kW</small>');
  set('dt-m-sup',  fmt(ld.supply, 2) + '<small>°C</small>');
  set('dt-m-ret',  fmt(ld.ret, 2) + '<small>°C</small>');
  set('dt-m-pue',  fmt(ld.pue, 2));
  set('dt-m-flow', fmt(ld.flow, 1) + '<small>m³/h</small>');
  const grade = document.getElementById('dt-s-grade');
  if (grade) {
    const over = S.rtLoad > S.chillerRT;
    grade.textContent = over ? '冷量不足' : ld.pue <= 1.35 ? '運轉良好' : '效率偏低';
    grade.classList.toggle('warn', over || ld.pue > 1.35);
  }
}

/* ── 啟動 ───────────────────────────────────────── */
function boot() {
  injectDOM();
  compute();
  refreshUI();
  // 若使用者透過其他路徑開啟本分頁，偵測後再初始化 3D
  const sec = document.getElementById('tab-' + TAB);
  new MutationObserver(() => { if (sec.classList.contains('active')) ensureInit(); })
    .observe(sec, { attributes: true, attributeFilter: ['class'] });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
