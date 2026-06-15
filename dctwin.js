/* ============================================================
   GB200 NVL72 液冷資料中心數位孿生 — dctwin.js
   自包含模組：載入後自動註冊導覽按鈕、儀表板卡片與 3D 場景。
   整合方式：在 index.html 的 </body> 前加入
     <link rel="stylesheet" href="dctwin.css">
     <script type="module" src="dctwin.js"></script>
   ============================================================ */

let THREE = null, OrbitControls = null, RoomEnvironment = null;
let EffectComposer = null, RenderPass = null, UnrealBloomPass = null, OutputPass = null;

async function loadThree() {
  try {
    THREE = await import('three');
    ({ OrbitControls }    = await import('three/addons/controls/OrbitControls.js'));
    ({ RoomEnvironment }  = await import('three/addons/environments/RoomEnvironment.js'));
    ({ EffectComposer }   = await import('three/addons/postprocessing/EffectComposer.js'));
    ({ RenderPass }       = await import('three/addons/postprocessing/RenderPass.js'));
    ({ UnrealBloomPass }  = await import('three/addons/postprocessing/UnrealBloomPass.js'));
    ({ OutputPass }       = await import('three/addons/postprocessing/OutputPass.js'));
  } catch (e) {
    // 後備：頁面缺少 import map 時改走 esm.sh（會自動改寫相依）
    const B = 'https://esm.sh/three@0.163.0';
    THREE = await import(B);
    ({ OrbitControls }    = await import(B + '/examples/jsm/controls/OrbitControls.js'));
    ({ RoomEnvironment }  = await import(B + '/examples/jsm/environments/RoomEnvironment.js'));
    ({ EffectComposer }   = await import(B + '/examples/jsm/postprocessing/EffectComposer.js'));
    ({ RenderPass }       = await import(B + '/examples/jsm/postprocessing/RenderPass.js'));
    ({ UnrealBloomPass }  = await import(B + '/examples/jsm/postprocessing/UnrealBloomPass.js'));
    ({ OutputPass }       = await import(B + '/examples/jsm/postprocessing/OutputPass.js'));
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
  T.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  T.renderer.toneMappingExposure = 1.02;
  T.renderer.domElement.classList.add('dt-canvas');
  wrap.appendChild(T.renderer.domElement);

  T.scene = new THREE.Scene();
  T.scene.background = new THREE.Color(PAL.bg);
  T.scene.fog = new THREE.Fog(PAL.bg, 26, 70);

  // 環境貼圖：給所有金屬材質真實反射（質感關鍵）
  if (RoomEnvironment) {
    const pmrem = new THREE.PMREMGenerator(T.renderer);
    T.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    T.scene.environmentIntensity = 0.3;
  }

  T.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  T.camera.position.set(8.5, 5, 10.5);

  T.controls = new OrbitControls(T.camera, T.renderer.domElement);
  T.controls.target.set(0, 1.2, 0);
  T.controls.enableDamping = true;
  T.controls.dampingFactor = 0.08;
  T.controls.maxPolarAngle = Math.PI * 0.495;
  T.controls.minDistance = 1.5;
  T.controls.maxDistance = 40;

  // ── Bloom 輝光後製（電影感特效關鍵）──
  if (EffectComposer && !T.reduced) {
    T.composer = new EffectComposer(T.renderer);
    T.composer.addPass(new RenderPass(T.scene, T.camera));
    T.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.62, 0.55, 0.72);
    T.composer.addPass(T.bloom);
    T.composer.addPass(new OutputPass());
  }

  // 燈光（冷藍主調 + 熱通道紅光，比照實景渲染）
  T.scene.add(new THREE.AmbientLight(0x9fb2cd, 0.45));
  const key = new THREE.DirectionalLight(0xdce9ff, 1.1);
  key.position.set(8, 14, 6);
  T.scene.add(key);
  // 熱通道內部紅色光暈
  const hotGlow = new THREE.PointLight(0xff4455, 1.1, 9);
  hotGlow.position.set(0, 1.4, 0);
  T.scene.add(hotGlow);
  // 暖色補光：打亮機櫃正面（前門朝外，冷通道側 ±z）
  [-5.5, 5.5].forEach(zL => {
    const warm = new THREE.PointLight(0xffe2ae, 0.38, 24);
    warm.position.set(0, 2.6, zL);
    T.scene.add(warm);
  });

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
  if (T.composer) {
    T.composer.setSize(w, h);
    T.composer.setPixelRatio(Math.min(devicePixelRatio, 2));
  }
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
    new THREE.MeshStandardMaterial({ color: 0x0a0e18, roughness: 0.42, metalness: 0.55 })
  );
  f.rotation.x = -Math.PI / 2;
  g.add(f);
  const grid = new THREE.GridHelper(Math.max(w, d), Math.max(w, d), PAL.grid1, PAL.grid2);
  grid.position.y = 0.002;
  g.add(grid);
}

/* 機房空間外殼（高架地板 + 牆面 + 天花線槽燈帶），讓白區像真實機房 */
function buildRoomShell(g) {
  const W = 22, D = 16, H = 5.2;
  // 內向房間外殼（BackSide：從外可看入、從內可見牆與天花）
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(W, H, D),
    new THREE.MeshStandardMaterial({ color: 0x10151d, roughness: 0.72, metalness: 0.2, side: THREE.BackSide })
  );
  shell.position.y = H / 2 - 0.05;
  g.add(shell);

  // 天花線槽燈帶（沿 x，數排）
  const stripMat = new THREE.MeshStandardMaterial({ color: 0x0a0f16, emissive: 0xdfeaff, emissiveIntensity: 1.3 });
  const trayMat  = new THREE.MeshStandardMaterial({ color: 0x2a3446, roughness: 0.5, metalness: 0.6 });
  for (let zi = -2; zi <= 2; zi++) {
    const z = zi * 3.2;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(W - 3, 0.06, 0.18), stripMat);
    strip.position.set(0, H - 0.12, z); g.add(strip);
    const tray = new THREE.Mesh(new THREE.BoxGeometry(W - 2, 0.1, 0.4), trayMat);
    tray.position.set(0, H - 0.42, z + 1.4); g.add(tray);
  }
  // 縱向線槽（沿 z）
  [-7, 7].forEach(x => {
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, D - 2), trayMat);
    tray.position.set(x, H - 0.42, 0); g.add(tray);
  });

  // 高架地板：冷通道穿孔出風地磚（外側兩冷通道）
  if (!_grilleTex) _grilleTex = grilleTexture();
  [-RK.rowZ - RK.d / 2 - 0.35, RK.rowZ + RK.d / 2 + 0.35].forEach(cz => {
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(8, 0.9),
      new THREE.MeshStandardMaterial({ map: _grilleTex, color: 0x6a7da0, roughness: 0.6, metalness: 0.4, emissive: 0x12325a, emissiveIntensity: 0.35 }));
    tile.rotation.x = -Math.PI / 2; tile.position.set(0, 0.02, cz); g.add(tile);
  });

  // 機房環境補光（柔和天花散光）
  const roomAmb = new THREE.HemisphereLight(0xbcd2f5, 0x0a0e16, 0.35);
  g.add(roomAmb);
}

/* ── 場景 1：GB200 液冷機房（White Space） ───────── */
const RK = { w: 0.62, h: 2.24, d: 1.22, pitch: 0.86, rowZ: 1.9, pipeY: 3.05 };

function buildWhiteSpace() {
  const g = new THREE.Group();
  floorAndGrid(g);
  buildRoomShell(g);
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
  // 開放前面式外殼面板（前面留空，開門後可見內部）
  const geoPanelBk = new THREE.BoxGeometry(RK.w, RK.h, 0.02);
  const geoPanelTB = new THREE.BoxGeometry(RK.w, 0.02, RK.d);
  const geoPanelLR = new THREE.BoxGeometry(0.02, RK.h, RK.d);
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

      // ── 機箱本體（開放前面式外殼：背板＋頂底＋兩側，前面留空，開門後可見內部）
      const bodyMat  = new THREE.MeshStandardMaterial({ color: 0x0e1219, roughness: 0.16, metalness: 0.92 });
      const innerMat = new THREE.MeshStandardMaterial({ color: 0x141a24, roughness: 0.5, metalness: 0.4 });
      const body = new THREE.Mesh(geoPanelBk, bodyMat);   // 背板（兼作點選目標）
      body.position.z = -face * (RK.d / 2 - 0.01);
      body.userData = { pick: true, type: 'rack', id };
      rack.add(body);
      const topP = new THREE.Mesh(geoPanelTB, bodyMat); topP.position.y =  RK.h / 2 - 0.01; rack.add(topP);
      const botP = new THREE.Mesh(geoPanelTB, bodyMat); botP.position.y = -RK.h / 2 + 0.01; rack.add(botP);
      [-RK.w / 2 + 0.01, RK.w / 2 - 0.01].forEach(xS => {
        const sd = new THREE.Mesh(geoPanelLR, innerMat); sd.position.x = xS; rack.add(sd);
      });

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
        color: 0x0c0e13, roughness: 0.20, metalness: 0.88,
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

      // 3) 18 × 金色運算托盤疊（左右黑色接頭塊 + 狀態 LED + 把手）
      const yTrayTop = RK.h / 2 - 0.04 - fanH - shelfH - fan2H;
      const ledGeo = new THREE.BoxGeometry(0.012, 0.012, 0.006);
      const handleGeo = new THREE.BoxGeometry(0.05, 0.01, 0.012);
      const ledOn  = new THREE.MeshStandardMaterial({ color: 0x062012, emissive: 0x33dd66, emissiveIntensity: 1.3 });
      const ledAmb = new THREE.MeshStandardMaterial({ color: 0x20160a, emissive: 0xffaa22, emissiveIntensity: 1.2 });
      const hMat   = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.5, metalness: 0.5 });
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
        // 雙狀態 LED（綠/琥珀，交錯）
        const led1 = new THREE.Mesh(ledGeo, (m % 7 === 3) ? ledAmb : ledOn);
        led1.position.set(cx - RK.w / 2 + 0.05, yT, zF + face * 0.018);
        hinge.add(led1);
        const led2 = new THREE.Mesh(ledGeo, ledOn);
        led2.position.set(cx - RK.w / 2 + 0.075, yT, zF + face * 0.018);
        hinge.add(led2);
        // 托盤把手
        const hdl = new THREE.Mesh(handleGeo, hMat);
        hdl.position.set(cx + RK.w / 2 - 0.13, yT, zF + face * 0.02);
        hinge.add(hdl);
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

  // ── 熱通道封閉走廊（透明圍蔽 + 紅色發光地板，比照實景）──
  const maxN  = Math.max(rows[0], rows[1]);
  const corrL = (maxN - 1) * RK.pitch + 1.6;                  // 走廊長（x 向）
  const corrZ = RK.rowZ - RK.d / 2 - 0.02;                    // 內牆 z 位置
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xcfe0ee, transparent: true, opacity: 0.10,
    roughness: 0.06, metalness: 0.0, side: THREE.DoubleSide, depthWrite: false,
  });
  const frameMatC = new THREE.MeshStandardMaterial({ color: 0xb9c4d0, roughness: 0.3, metalness: 0.8 });
  // 兩側玻璃牆（機櫃頂 → 管架高度）
  [-corrZ, corrZ].forEach(zw => {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(corrL, RK.pipeY - RK.h + 0.55), glassMat);
    wall.position.set(0, RK.h + (RK.pipeY - RK.h + 0.55) / 2, zw);
    layer.add(wall);
  });
  // 玻璃屋頂
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(corrL, corrZ * 2), glassMat);
  roof.rotation.x = -Math.PI / 2;
  roof.position.set(0, RK.pipeY + 0.55, 0);
  layer.add(roof);
  // 走廊頂部邊框
  [-corrZ, corrZ].forEach(zw => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(corrL, 0.05, 0.05), frameMatC);
    beam.position.set(0, RK.pipeY + 0.55, zw);
    layer.add(beam);
  });
  // 紅色發光地板（熱通道）
  const hotFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(corrL, corrZ * 2 - 0.1),
    new THREE.MeshStandardMaterial({
      color: 0x551018, emissive: 0xff3344, emissiveIntensity: 0.85,
      transparent: true, opacity: 0.55, roughness: 0.4,
    })
  );
  hotFloor.rotation.x = -Math.PI / 2;
  hotFloor.position.y = 0.012;
  layer.add(hotFloor);

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

// ── 管內液體流動貼圖（發光亮帶沿管軸捲動，取代粒子）──
let _flowTexSup = null, _flowTexRet = null;
function makeFlowTexture() {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#262626'; g.fillRect(0, 0, 8, 256);   // 暗底＝管內液體本體
  // 4 道柔邊亮帶（液體流動段）
  for (let b = 0; b < 4; b++) {
    const cy = b * 64 + 24, hw = 30;
    const grad = g.createLinearGradient(0, cy - hw, 0, cy + hw);
    grad.addColorStop(0,   'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,1)');
    grad.addColorStop(1,   'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, cy - hw, 8, hw * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 3);
  return t;
}

function pipeMat(hex, isSupply) {
  if (isSupply && !_flowTexSup) _flowTexSup = makeFlowTexture();
  if (!isSupply && !_flowTexRet) _flowTexRet = makeFlowTexture();
  // 半透明亮面管壁 + 沿管軸捲動的發光亮帶 ＝ 管內液體流動
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex), roughness: 0.12, metalness: 0.55,
    emissive: new THREE.Color(hex), emissiveIntensity: 0.9,
    emissiveMap: isSupply ? _flowTexSup : _flowTexRet,
    transparent: true, opacity: 0.6,
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

  // 支架 + 纜線架（亮面鋼材）
  const railMat = new THREE.MeshStandardMaterial({ color: 0x8fa3b8, roughness: 0.22, metalness: 0.90 });
  const tray = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.5), railMat);
  tray.position.set(sup.position.x, RK.pipeY + 0.62, z);
  layer.add(tray);
  for (let i = 0; i <= n; i += 2) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, RK.pipeY + 0.7, 0.06), railMat);
    post.position.set(x0 - RK.pitch / 2 + i * RK.pitch, (RK.pipeY + 0.7) / 2, z);
    layer.add(post);
  }

  // 纜線架上方鋼藍色平行管束（×3）＋ 藍/紅端蓋（比照實景）
  const bundleGeo = new THREE.CylinderGeometry(0.030, 0.030, len, 10);
  const capGeo    = new THREE.BoxGeometry(0.10, 0.10, 0.12);
  [-0.15, 0, 0.15].forEach((dz, bi) => {
    const bp = new THREE.Mesh(bundleGeo, railMat);
    bp.rotation.z = Math.PI / 2;
    bp.position.set(sup.position.x, RK.pipeY + 0.72, z + dz);
    layer.add(bp);
    const capMat = new THREE.MeshStandardMaterial({
      color: bi % 2 === 0 ? 0x2a6cff : 0xe03030, roughness: 0.30, metalness: 0.70,
      emissive: bi % 2 === 0 ? 0x102a66 : 0x551010, emissiveIntensity: 0.6,
    });
    [-1, 1].forEach(sd => {
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(sup.position.x + sd * (len / 2 - 0.06), RK.pipeY + 0.72, z + dz);
      layer.add(cap);
    });
  });

  // 每櫃垂直落管（供 / 回）＋ 機櫃頂白色快接底座
  const dropGeo = new THREE.CylinderGeometry(0.034, 0.034, RK.pipeY - RK.h + 0.32, 10);
  const baseGeo = new THREE.BoxGeometry(0.13, 0.05, 0.13);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.35, metalness: 0.40 });

  // 密集線纜（熱通道側，天花線槽 → 機櫃頂，深灰網路線 + 少量藍/紅）
  const cableH = RK.pipeY - RK.h + 0.62;
  const cableGeo = new THREE.CylinderGeometry(0.013, 0.013, cableH, 6);
  const cableMats = [
    new THREE.MeshStandardMaterial({ color: 0x3b4350, roughness: 0.6, metalness: 0.4, emissive: 0x10141a, emissiveIntensity: 0.3 }),  // 灰網路線
    new THREE.MeshStandardMaterial({ color: 0x556070, roughness: 0.55, metalness: 0.5, emissive: 0x141820, emissiveIntensity: 0.3 }), // 亮灰
    new THREE.MeshStandardMaterial({ color: 0x3a78d8, roughness: 0.45, metalness: 0.4, emissive: 0x123166, emissiveIntensity: 0.7 }), // 藍
    new THREE.MeshStandardMaterial({ color: 0xd83a3a, roughness: 0.45, metalness: 0.4, emissive: 0x521212, emissiveIntensity: 0.7 }), // 紅
    new THREE.MeshStandardMaterial({ color: 0x2bb564, roughness: 0.5, metalness: 0.35, emissive: 0x0d3a1f, emissiveIntensity: 0.6 }), // 綠
    new THREE.MeshStandardMaterial({ color: 0xe8c23a, roughness: 0.45, metalness: 0.5, emissive: 0x4a3a0a, emissiveIntensity: 0.7 }), // 黃光纖
  ];
  const cableSeq = [0, 2, 1, 0, 4, 1, 3, 0, 5, 1, 2, 0, 1, 3, 0, 1];   // 16 條，灰底 + 彩色點綴
  const zHot = z + (z < 0 ? 1 : -1) * 0.30;                // 朝中央熱通道側

  for (let i = 0; i < n; i++) {
    const x = x0 + i * RK.pitch;
    const d1 = new THREE.Mesh(dropGeo, supMat);
    d1.position.set(x - 0.12, RK.h - 0.16 + dropGeo.parameters.height / 2, z - 0.18);
    layer.add(d1);
    const d2 = new THREE.Mesh(dropGeo, retMat);
    d2.position.set(x + 0.12, RK.h - 0.16 + dropGeo.parameters.height / 2 + 0.15, z + 0.18);
    layer.add(d2);
    [[-0.12, -0.18], [0.12, 0.18]].forEach(([dx, dz]) => {
      const b = new THREE.Mesh(baseGeo, baseMat);
      b.position.set(x + dx, RK.h + 0.025, z + dz);
      layer.add(b);
    });
    // 線纜束（每櫃 12 條，密集落線）
    for (let cI = 0; cI < cableSeq.length; cI++) {
      const jx = (cI - (cableSeq.length - 1) / 2) * 0.030;
      const jz = ((cI * 7) % 5 - 2) * 0.025;
      const cab = new THREE.Mesh(cableGeo, cableMats[cableSeq[cI]]);
      cab.position.set(x + jx, RK.h - 0.12 + cableH / 2, zHot + jz);
      layer.add(cab);
    }
    // 機櫃頂理線槽（深色淺盒）
    const ductTop = new THREE.Mesh(new THREE.BoxGeometry(RK.w - 0.06, 0.05, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x0e1218, roughness: 0.7, metalness: 0.3 }));
    ductTop.position.set(x, RK.h + 0.03, zHot);
    layer.add(ductTop);
  }
}

// 圓形風扇/濾網的網孔貼圖（一次建立、共用）
let _grilleTex = null;
function grilleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#0c1118'; g.fillRect(0, 0, 96, 96);
  g.fillStyle = '#3a4656';
  for (let yy = 4; yy < 96; yy += 6)
    for (let xx = 4; xx < 96; xx += 6) { g.beginPath(); g.arc(xx, yy, 1.6, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  return t;
}

function buildCDU(layer, x, z, rowIdx) {
  const cdu = new THREE.Group();
  cdu.position.set(x, RK.h / 2, z);

  const FZ  = RK.d / 2;            // 正面 z（本地 +z）
  const HW  = RK.w / 2, HH = RK.h / 2;

  // 機箱外殼（半透明，可看見內部設備）
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x2b3a4d, transparent: true, opacity: 0.26,
    roughness: 0.16, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(RK.w, RK.h, RK.d), bodyMat);
  body.userData = { pick: true, type: 'cdu', id: rowIdx + 1 };
  body.renderOrder = 2;
  cdu.add(body);
  // 金屬邊框（角柱），讓半透明外殼有結構感
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x46566a, roughness: 0.3, metalness: 0.9 });
  [[-HW, -FZ], [HW, -FZ], [-HW, FZ], [HW, FZ]].forEach(([fx, fz]) => {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.028, RK.h, 0.028), frameMat);
    col.position.set(fx, 0, fz); cdu.add(col);
  });

  // ── 內部設備（透過半透明外殼可見）──
  const inSteel = new THREE.MeshStandardMaterial({ color: 0x8595a8, roughness: 0.3, metalness: 0.85 });
  const inDark  = new THREE.MeshStandardMaterial({ color: 0x232d3a, roughness: 0.5, metalness: 0.6 });
  // 板式熱交換器（中段，藍鋼塊帶散熱鰭）
  const hx = new THREE.Mesh(new THREE.BoxGeometry(RK.w - 0.18, 0.5, RK.d - 0.4), inDark);
  hx.position.set(0, 0.18, -0.05); cdu.add(hx);
  for (let fI = 0; fI < 7; fI++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(RK.w - 0.16, 0.46, 0.006), inSteel);
    fin.position.set(0, 0.18, -0.28 + fI * 0.075); cdu.add(fin);
  }
  // 兩台循環泵（下段，臥式泵體 + 馬達）
  [-0.1, 0.1].forEach(px => {
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 14), inSteel);
    pump.rotation.z = Math.PI / 2; pump.position.set(px, -0.55, 0.02); cdu.add(pump);
    const mot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12), inDark);
    mot.rotation.z = Math.PI / 2; mot.position.set(px, -0.55, -0.16); cdu.add(mot);
  });
  // 緩衝水箱（直立圓筒，後側）
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 16), inSteel);
  tank.position.set(0.14, -0.5, -0.32); cdu.add(tank);
  // 內部供/回水立管（藍/紅發光）
  [[-0.13, 0x2a8cff, 0x0a3a7a], [0.13, 0xff4a4a, 0x5a1010]].forEach(([px, col, em]) => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, RK.h - 0.5, 12),
      new THREE.MeshStandardMaterial({ color: col, emissive: em, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.6 }));
    pipe.position.set(px, 0, 0.18); cdu.add(pipe);
  });

  // 正面細節群組（依朝向旋轉，前面朝外）
  const face = rowIdx === 0 ? -1 : 1;
  const F = new THREE.Group();
  F.rotation.y = face === -1 ? Math.PI : 0;
  cdu.add(F);

  if (!_grilleTex) _grilleTex = grilleTexture();
  const darkMat  = new THREE.MeshStandardMaterial({ color: 0x10161f, roughness: 0.55, metalness: 0.5 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x9fb0c2, roughness: 0.22, metalness: 0.92 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xdbe3ec, roughness: 0.34, metalness: 0.3, transparent: true, opacity: 0.55, depthWrite: false });

  // 1) 頂部控制面板（內凹深色框 + 青色螢幕 + 兩顆指示燈）
  const panel = new THREE.Mesh(new THREE.BoxGeometry(RK.w - 0.08, 0.24, 0.03), darkMat);
  panel.position.set(0, HH - 0.17, FZ + 0.005);
  F.add(panel);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x06121c, emissive: 0x35c8ff, emissiveIntensity: 1.3 }));
  screen.position.set(-0.06, HH - 0.17, FZ + 0.022);
  F.add(screen);
  [0.07, 0.13].forEach((px, k) => {
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 12),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: k ? 0x33dd55 : 0xff5a3c, emissiveIntensity: 1.1 }));
    dot.rotation.x = Math.PI / 2;
    dot.position.set(px, HH - 0.17, FZ + 0.022);
    F.add(dot);
  });
  // VERTIV 品牌橫條（白色細條占位）
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.018),
    new THREE.MeshStandardMaterial({ color: 0xf2f6fa, emissive: 0x6a7686, emissiveIntensity: 0.3 }));
  logo.position.set(-0.04, HH - 0.36, FZ + 0.006);
  F.add(logo);

  // 2) 左側散熱百葉（3 組，各 4 道橫向細縫）
  const slotGeo = new THREE.BoxGeometry(0.2, 0.014, 0.012);
  [0.52, 0.30, 0.08].forEach(gy => {
    for (let s = 0; s < 4; s++) {
      const slot = new THREE.Mesh(slotGeo, darkMat);
      slot.position.set(-HW + 0.16, gy - s * 0.032, FZ + 0.004);
      F.add(slot);
    }
  });

  // 3) 兩支發光玻璃管柱（核心特徵：透明玻璃 + 內部發光 + 螺旋線圈 + 金屬接頭）
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xcfe6ff, transparent: true, opacity: 0.24,
    roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05,
  });
  const tubeH = 0.5, tubeY = 0.30, tubeZ = FZ + 0.11;
  const tubeXs = [-0.055, 0.075];
  tubeXs.forEach(tx => {
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, tubeH, 18, 1, true), glassMat);
    glass.position.set(tx, tubeY, tubeZ);
    F.add(glass);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, tubeH - 0.02, 14),
      new THREE.MeshStandardMaterial({ color: 0xbfe0f5, emissive: 0x4aa6e0, emissiveIntensity: 1.35 }));
    core.position.copy(glass.position);
    F.add(core);
    // 螺旋線圈（堆疊細環）
    const coilMat = new THREE.MeshStandardMaterial({ color: 0xafc4d8, roughness: 0.3, metalness: 0.85 });
    for (let cI = 0; cI < 11; cI++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.004, 6, 16), coilMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(tx, tubeY - tubeH / 2 + 0.05 + cI * 0.04, tubeZ);
      F.add(ring);
    }
    // 上下金屬接頭
    [tubeY + tubeH / 2, tubeY - tubeH / 2].forEach(fy => {
      const fit = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.05, 16), steelMat);
      fit.position.set(tx, fy, tubeZ);
      F.add(fit);
    });
  });
  // 底部連接歧管（橫接兩管）
  const manifold = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 12), steelMat);
  manifold.rotation.z = Math.PI / 2;
  manifold.position.set(0.01, tubeY - tubeH / 2 - 0.02, tubeZ);
  F.add(manifold);

  // 4) 下方兩顆圓形風扇（網孔濾網）
  [-0.085, 0.085].forEach(fx => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.05, 24), darkMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(fx, -0.03, FZ + 0.02);
    F.add(ring);
    const grille = new THREE.Mesh(new THREE.CircleGeometry(0.098, 28),
      new THREE.MeshStandardMaterial({ map: _grilleTex, roughness: 0.6, metalness: 0.4 }));
    grille.position.set(fx, -0.03, FZ + 0.046);
    F.add(grille);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 12), steelMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(fx, -0.03, FZ + 0.05);
    F.add(hub);
  });
  // 泵浦馬達（風扇右側橫向圓柱）
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 16), steelMat);
  motor.rotation.x = Math.PI / 2;
  motor.position.set(0.2, -0.04, FZ + 0.03);
  F.add(motor);

  // 5) 下方白色維修門板
  const door = new THREE.Mesh(new THREE.BoxGeometry(RK.w - 0.14, 0.52, 0.03), whiteMat);
  door.position.set(0, -0.5, FZ + 0.006);
  F.add(door);

  // 6) 底部藍光燈條 + 四隻腳
  const glow = new THREE.Mesh(new THREE.BoxGeometry(RK.w - 0.04, 0.03, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x06121c, emissive: 0x35c8ff, emissiveIntensity: 1.6 }));
  glow.position.set(0, -HH + 0.06, FZ + 0.006);
  F.add(glow);
  [[-HW + 0.06, FZ - 0.06], [HW - 0.06, FZ - 0.06], [-HW + 0.06, -FZ + 0.06], [HW - 0.06, -FZ + 0.06]].forEach(([fx, fz]) => {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.06, 10), steelMat);
    foot.position.set(fx, -HH - 0.02, fz);
    cdu.add(foot);
  });

  const lab = makeLabel('CDU-' + (rowIdx + 1), '#35c8ff', 0.7);
  lab.position.y = HH + 0.45;
  cdu.add(lab);
  layer.add(cdu);
  T.cdus.push(cdu);
  T.pickables.push(body);
}

/* ── 場景 2：2N 關鍵機電灰區（設備還原為實際外型）──── */
function buildGreySpace() {
  const g = new THREE.Group();
  floorAndGrid(g, 36, 24);

  const M = (c, r = 0.45, m = 0.6, e = 0x000000, ei = 1) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, emissive: e, emissiveIntensity: ei });
  const steel = M(0x6a7888, 0.32, 0.88);
  const darkP = M(0x141b26, 0.6, 0.4);

  // 機電櫃（UPS / 電池櫃）：本體 + 內凹門板 + 散熱百葉 + 顯示器 + LED + 把手 + 踢腳
  const cabinet = (x, z, w, h, d, color, accent, data, label, opt = {}) => {
    const grp = new THREE.Group(); grp.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(color, 0.45, 0.55));
    body.position.y = h / 2;
    if (data) { body.userData = { pick: true, ...data }; T.pickables.push(body); }
    grp.add(body);
    const fz = d / 2;
    const door = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, h - 0.18, 0.015), darkP);
    door.position.set(0, h / 2, fz + 0.009); grp.add(door);
    for (let s = 0; s < (opt.louvers ?? 5); s++) {
      const lv = new THREE.Mesh(new THREE.BoxGeometry(w - 0.26, 0.018, 0.012), steel);
      lv.position.set(0, (opt.ventLow ? 0.35 : h - 0.16) - s * 0.05 * (opt.ventLow ? -1 : 1), fz + 0.018);
      grp.add(lv);
    }
    if (opt.screen !== false) {
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.45, 0.4), 0.16),
        M(0x06121c, 0.4, 0.3, new THREE.Color(accent).getHex(), 1.1));
      scr.position.set(-w * 0.1, h * 0.62, fz + 0.02); grp.add(scr);
      [0x33dd55, 0xf0a430, 0xff5a3c].forEach((c, k) => {
        const led = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 10), M(0x0a0a0a, 0.4, 0.4, c, 1.1));
        led.rotation.x = Math.PI / 2; led.position.set(w * 0.22, h * 0.68 - k * 0.06, fz + 0.02); grp.add(led);
      });
    }
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.03), steel);
    handle.position.set(w * 0.34, h * 0.42, fz + 0.025); grp.add(handle);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d), M(0x0b0f16, 0.7, 0.3));
    plinth.position.y = 0.035; grp.add(plinth);
    g.add(grp);
    if (label) { const l = makeLabel(label, accent, 0.8); l.position.set(x, h + 0.45, z); g.add(l); }
    return grp;
  };

  // 配電盤連排（MSB）：多櫃連排 + 斷路器格線 + 電錶
  const switchgear = (x, z, sections, accent, data, label) => {
    const grp = new THREE.Group(); grp.position.set(x, 0, z);
    const w = 0.9, h = 2.2, d = 0.95;
    for (let s = 0; s < sections; s++) {
      const sx = (s - (sections - 1) / 2) * w;
      const body = new THREE.Mesh(new THREE.BoxGeometry(w - 0.008, h, d), M(0x1d2636, 0.45, 0.55));
      body.position.set(sx, h / 2, 0);
      if (data && s === 0) { body.userData = { pick: true, ...data }; T.pickables.push(body); }
      grp.add(body);
      const fz = d / 2;
      // 斷路器隔室格線（4 段）
      for (let b = 0; b < 4; b++) {
        const slot = new THREE.Mesh(new THREE.BoxGeometry(w - 0.16, 0.012, 0.012), steel);
        slot.position.set(sx, 0.5 + b * 0.42, fz + 0.012); grp.add(slot);
        const sw = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.02), M(0x0a0a0a, 0.5, 0.4, 0x33dd55, 0.6));
        sw.position.set(sx + w * 0.28, 0.5 + b * 0.42, fz + 0.02); grp.add(sw);
      }
      // 電錶（青色小螢幕）
      const meter = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.1), M(0x06121c, 0.4, 0.3, new THREE.Color(accent).getHex(), 1.0));
      meter.position.set(sx - w * 0.15, h - 0.28, fz + 0.014); grp.add(meter);
    }
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(sections * w, 0.07, d), M(0x0b0f16, 0.7, 0.3));
    plinth.position.y = 0.035; grp.add(plinth);
    g.add(grp);
    if (label) { const l = makeLabel(label, accent, 0.85); l.position.set(x, h + 0.45, z); g.add(l); }
  };

  // 變壓器：油箱 + 兩側波浪散熱鰭 + 頂部 3 套管 + 底座
  const transformer = (x, z, accent, data, label) => {
    const grp = new THREE.Group(); grp.position.set(x, 0, z);
    const tank = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.4, 1.0), M(0x3c4452, 0.5, 0.72));
    tank.position.y = 0.82;
    if (data) { tank.userData = { pick: true, ...data }; T.pickables.push(tank); }
    grp.add(tank);
    const finMat = M(0x4c5868, 0.4, 0.82);
    [-0.68, 0.68].forEach(sx => {
      for (let f = 0; f < 8; f++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.1, 0.1), finMat);
        fin.position.set(sx, 0.82, -0.42 + f * 0.12); grp.add(fin);
      }
    });
    [-0.38, 0, 0.38].forEach(bx => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.34, 12), M(0xc6a26a, 0.35, 0.2));
      b.position.set(bx, 1.66, 0.28); grp.add(b);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), M(0x9a7f50, 0.4, 0.3));
      cap.position.set(bx, 1.85, 0.28); grp.add(cap);
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 1.2), M(0x10141c, 0.7, 0.3));
    base.position.y = 0.06; grp.add(base);
    g.add(grp);
    if (label) { const l = makeLabel(label, accent, 0.8); l.position.set(x, 2.2, z); g.add(l); }
  };

  // A / B 兩路（2N 配置）
  [[-4.8, '#f0a430', 'A'], [4.8, '#35c8ff', 'B']].forEach(([z, col, path]) => {
    transformer(-8.2, z, col, { type: 'tx', path }, `TX-${path} · 2000kVA`);
    for (let i = 0; i < 4; i++)
      cabinet(-5.8 + i * 1.3, z, 1.15, 2.1, 0.9, 0x232f44, col, { type: 'ups', path, idx: i + 1 },
        i === 0 ? `UPS ${path} 路 · 2N` : '');
    // 電池櫃 ×2（多百葉、無顯示器）
    cabinet(0.4, z, 1.15, 2.0, 0.9, 0x1b2433, col, { type: 'batt', path }, `BATTERY-${path}`, { screen: false, louvers: 8 });
    cabinet(1.7, z, 1.15, 2.0, 0.9, 0x1b2433, col, { type: 'batt', path }, '', { screen: false, louvers: 8 });
    switchgear(5.2, z, 3, col, { type: 'msb', path }, `MSB-${path}`);
    // 架空匯流排 + 吊架
    const bus = new THREE.Mesh(new THREE.BoxGeometry(15, 0.18, 0.3),
      M(0x10161f, 0.4, 0.6, new THREE.Color(col).getHex(), 0.5));
    bus.position.set(-0.5, 2.95, z); g.add(bus);
    for (let hgr = 0; hgr < 6; hgr++) {
      const hang = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), steel);
      hang.position.set(-7 + hgr * 2.6, 3.25, z); g.add(hang);
    }
  });
  const lab = makeLabel('2N GRID SECURED · GREY SPACE', '#9eff2e');
  lab.position.set(0, 4.4, 0);
  g.add(lab);
  return g;
}

/* ── 場景 3：冰水動力中心（比照水路系統照片）──────── */
function buildPlant() {
  const g = new THREE.Group();
  floorAndGrid(g, 40, 28);

  const M = (c, r = 0.4, m = 0.65, e = 0x000000, ei = 1) =>
    new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, emissive: e, emissiveIntensity: ei });
  const steel = M(0x9aa8b8, 0.3, 0.88);
  const lite  = M(0xc4ccd4, 0.45, 0.55);   // 冷卻塔淺灰外殼
  const dark  = M(0x28323f, 0.55, 0.6);
  if (!_grilleTex) _grilleTex = grilleTexture();

  const GRN = '#33d98f', RED = '#ff5a64';   // 綠＝供水(CHWS/CWS)、紅＝回水(CHWR/CWR)
  // 管路（綠/紅，帶流動發光貼圖；不入熱力陣列以保留綠色）
  const pipe = (hex, isSup, len, dir, px, py, pz, r = 0.075) => {
    const mm = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), pipeMat(hex, isSup));
    if (dir === 'x') mm.rotation.z = Math.PI / 2;
    if (dir === 'z') mm.rotation.x = Math.PI / 2;
    mm.position.set(px, py, pz);
    g.add(mm); return mm;
  };
  const elbow = (hex, px, py, pz) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8),
      M(new THREE.Color(hex).getHex(), 0.2, 0.6, new THREE.Color(hex).getHex(), 0.4));
    e.position.set(px, py, pz); g.add(e);
  };

  // 共用材質 / 設備細節輔助
  const blueShell = M(0x6fb4d6, 0.3, 0.7);    // 淺藍殼管
  const blueCap   = M(0x4a8fb5, 0.35, 0.7);   // 水室端蓋
  const motorGrn  = M(0x1f7a4d, 0.4, 0.55);   // 綠色馬達
  const yellowCp  = M(0xf2c029, 0.4, 0.5);    // 黃色聯軸器
  const panelMat  = M(0x1b2a3e, 0.4, 0.5);
  // 螺栓法蘭（軸向沿 X），parent 本地座標
  const flangeX = (parent, x, y, z, r) => {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.05, 22), steel);
    d.rotation.z = Math.PI / 2; d.position.set(x, y, z); parent.add(d);
    for (let b = 0; b < 12; b++) {
      const a = b / 12 * Math.PI * 2;
      const bo = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.07, 6), dark);
      bo.rotation.z = Math.PI / 2;
      bo.position.set(x, y + Math.cos(a) * r * 0.82, z + Math.sin(a) * r * 0.82); parent.add(bo);
    }
  };
  // 散熱鰭馬達（軸沿 X）
  const finnedX = (parent, x, y, z, r, len, col) => {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 16), col);
    body.rotation.z = Math.PI / 2; body.position.set(x, y, z); parent.add(body);
    const n = Math.max(4, Math.floor(len / 0.07));
    for (let f = 0; f < n; f++) {
      const fin = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.16, r * 1.16, 0.018, 16), col);
      fin.rotation.z = Math.PI / 2; fin.position.set(x - len / 2 + 0.04 + f * (len - 0.08) / (n - 1), y, z); parent.add(fin);
    }
  };

  // ── 頂樓冷卻水塔（架高樓板 + 支柱，與機房分層）──
  const ROOF = 4.2, ctX = 9, ctZ = -7;
  // 頂樓樓板
  const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 7.5), M(0x3a4658, 0.6, 0.45));
  deck.position.set(ctX, ROOF, ctZ); g.add(deck);
  // 支柱（樓板 → 地面）
  [[-4.4, -3], [4.4, -3], [-4.4, 3], [4.4, 3], [0, -3], [0, 3]].forEach(([dx, dz]) => {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.34, ROOF, 0.34), M(0x29323e, 0.6, 0.5));
    col.position.set(ctX + dx, ROOF / 2, ctZ + dz); g.add(col);
  });
  // 頂樓前緣護欄
  const rail = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 0.06), M(0x4a5666, 0.5, 0.6));
  rail.position.set(ctX, ROOF + 0.4, ctZ + 3.75); g.add(rail);
  for (let rp = 0; rp < 6; rp++) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), M(0x4a5666, 0.5, 0.6));
    post.position.set(ctX - 4.5 + rp * 1.8, ROOF + 0.4, ctZ + 3.75); g.add(post);
  }

  const ct = new THREE.Group(); ct.position.set(ctX, ROOF + 0.15, ctZ); g.add(ct);
  const ctCell = (ox) => {
    // 支撐墊高
    [[-1.4, -1.3], [1.4, -1.3], [-1.4, 1.3], [1.4, 1.3]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.8, 0.16), steel);
      leg.position.set(ox + lx, 0.9, lz); ct.add(leg);
    });
    // 集水盤
    const basin = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.3, 2.9), dark);
    basin.position.set(ox, 1.9, 0); ct.add(basin);
    // 主體外殼
    const cell = new THREE.Mesh(new THREE.BoxGeometry(3, 1.9, 2.8), lite);
    cell.position.set(ox, 3.0, 0); ct.add(cell);
    // 進風百葉（四面層疊）
    for (let s = 0; s < 7; s++) {
      const ly = 2.3 + s * 0.2;
      const lvF = new THREE.Mesh(new THREE.BoxGeometry(3.04, 0.1, 2.84), dark);
      lvF.position.set(ox, ly, 0); ct.add(lvF);
    }
    // 頂板
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.12, 2.85), steel);
    top.position.set(ox, 4.0, 0); ct.add(top);
    // 角柱（延伸至頂部）
    [[-1.45, -1.35], [1.45, -1.35], [-1.45, 1.35], [1.45, 1.35]].forEach(([lx, lz]) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 0.1), steel);
      post.position.set(ox + lx, 4.6, lz); ct.add(post);
    });
    // 風扇蓋（圓筒擴散罩）
    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.95, 0.5, 28, 1, true), dark);
    shroud.position.set(ox, 4.35, 0); ct.add(shroud);
    // 橘色風扇葉片（6 片繞 hub）+ 中央輪轂
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.18, 14), M(0xd86a1a, 0.4, 0.6));
    hub.position.set(ox, 4.5, 0); ct.add(hub);
    for (let b = 0; b < 6; b++) {
      const a = b / 6 * Math.PI * 2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.03, 0.26), M(0xe8801f, 0.45, 0.5));
      blade.position.set(ox + Math.cos(a) * 0.55, 4.5, Math.sin(a) * 0.55);
      blade.rotation.y = -a; blade.rotation.x = 0.32; ct.add(blade);
    }
  };
  ctCell(-2.2); ctCell(2.2);
  const ctLab = makeLabel('ROOFTOP 頂樓 · 冷卻水塔', '#35c8ff', 1.0);
  ctLab.position.set(ctX, ROOF + 5.6, ctZ); g.add(ctLab);
  // 冷卻水立管（機房 → 頂樓，綠供 / 紅回）
  [[-0.35, GRN, true], [0.05, RED, false]].forEach(([dx, hex, isS]) => {
    pipe(hex, isS, ROOF + 0.3, 'y', ctX - 3.5 + dx, (ROOF + 0.3) / 2, ctZ + 3.2, 0.1);
  });
  // 頂樓水平接管（立管 → 兩塔）
  pipe(GRN, true, 6, 'x', ctX, ROOF + 0.5, ctZ + 3.2, 0.09);
  pipe(RED, false, 6, 'x', ctX, ROOF + 0.85, ctZ + 3.5, 0.09);
  elbow(GRN, ctX - 3.85, ROOF + 0.4, ctZ + 3.2);

  // ── 兩台離心式冰水主機（殼管 + 水室法蘭 + 離心壓縮機 + 控制盤，比照照片）──
  const buildChiller = (cz, idx) => {
    const c = new THREE.Group(); c.position.set(-9, 0, cz); g.add(c);
    // 底座 + 兩支鞍座
    const skid = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.2, 1.7), dark);
    skid.position.y = 0.1; c.add(skid);
    [-1.5, 1.5].forEach(sx => {
      const sad = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.45, 1.4), dark);
      sad.position.set(sx, 0.42, 0); c.add(sad);
    });
    // 蒸發器（下殼管，淺藍）
    const evap = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 3.7, 26), blueShell);
    evap.rotation.z = Math.PI / 2; evap.position.set(0, 0.95, 0);
    evap.userData = { pick: true, type: 'chiller', id: idx }; T.pickables.push(evap); c.add(evap);
    // 冷凝器（上殼管）
    const cond = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 3.7, 24), blueShell);
    cond.rotation.z = Math.PI / 2; cond.position.set(0, 1.66, 0); c.add(cond);
    // 殼身束帶環
    [-1.05, 0, 1.05].forEach(bx => {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 26), blueCap);
      ring.rotation.z = Math.PI / 2; ring.position.set(bx, 0.95, 0); c.add(ring);
    });
    // 兩端水室 + 螺栓法蘭
    [-1.85, 1.85].forEach(ex => {
      const wb = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.22, 22), blueCap);
      wb.rotation.z = Math.PI / 2; wb.position.set(ex, 0.95, 0); c.add(wb);
      flangeX(c, ex + Math.sign(ex) * 0.13, 0.95, 0, 0.52);
    });
    // 水室進出水噴嘴（綠供 / 紅回，接母管）
    pipe(GRN, true, 1.5, 'y', -1.85, 1.55, 0.42, 0.085);
    pipe(RED, false, 1.5, 'y', 1.85, 1.55, -0.42, 0.085);
    // ── 離心壓縮機（冷凝器頂部，近 +x 端）──
    const comp = new THREE.Group(); comp.position.set(0.9, 2.2, 0); c.add(comp);
    const vol = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 14), M(0x2c3947, 0.45, 0.7));
    comp.add(vol);
    finnedX(comp, -0.95, 0.06, 0, 0.28, 0.95, M(0x3a4a60, 0.4, 0.7));   // 馬達
    const term = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.22), dark);
    term.position.set(-0.95, 0.34, 0); comp.add(term);                  // 接線盒
    // 吸入口 + 進口導葉（IGV）
    const suc = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.28, 20), M(0x2c3947, 0.45, 0.7));
    suc.rotation.z = Math.PI / 2; suc.position.set(0.5, 0, 0); comp.add(suc);
    const igv = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), M(0x2e8f5a, 0.4, 0.5, 0x0a3a22, 0.4));
    igv.rotation.y = Math.PI / 2; igv.position.set(0.66, 0, 0); comp.add(igv);
    // 排氣彎管接冷凝器
    const dis = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.55, 12), steel);
    dis.position.set(-0.15, -0.42, 0); comp.add(dis);
    // 油分離器（小立罐）
    const eco = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.66, 14), blueCap);
    eco.position.set(1.65, 1.95, 0.32); c.add(eco);
    const ecoCap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), blueCap);
    ecoCap.position.set(1.65, 2.28, 0.32); c.add(ecoCap);
    // ── 控制盤（前面 -z 側，含螢幕 + 狀態燈）──
    const pbox = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.82, 0.16), panelMat);
    pbox.position.set(-0.15, 1.3, -0.92); c.add(pbox);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.4), M(0x06121c, 0.4, 0.3, 0x35c8ff, 1.1));
    scr.position.set(-0.15, 1.22, -0.835); c.add(scr);
    [0xff5a3c, 0xf0a430, 0x33dd55, 0x35c8ff, 0xc060ff].forEach((cc, k) => {
      const led = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.01, 10), M(0x0a0a0a, 0.4, 0.4, cc, 1.2));
      led.rotation.x = Math.PI / 2; led.position.set(-0.43 + k * 0.14, 1.58, -0.835); c.add(led);
    });
    const ped = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.95, 0.1), dark);
    ped.position.set(-0.15, 0.6, -0.9); c.add(ped);
    // 銘牌
    const lab = makeLabel(`CH-0${idx} · 800 RT`, '#35c8ff', 0.85);
    lab.position.set(0, 3.05, 0); c.add(lab);
  };
  buildChiller(-2.6, 1);
  buildChiller(2.6, 2);

  // ── 板式熱交換器（Free Cooling HX，板組 + 端框 + 拉桿 + 角接管）──
  const hxX = 1.5, hxZ = 2.2, plateN = 26, plateGap = 0.026;
  const packLen = plateN * plateGap;
  // 固定端框板（深色厚板）
  const frA = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 1.3), M(0x141b26, 0.5, 0.5));
  frA.position.set(hxX - packLen / 2 - 0.06, 0.9, hxZ);
  frA.userData = { pick: true, type: 'hx', id: 1 }; T.pickables.push(frA); g.add(frA);
  const frB = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 1.3), M(0x141b26, 0.5, 0.5));
  frB.position.set(hxX + packLen / 2 + 0.05, 0.9, hxZ); g.add(frB);
  // 不鏽鋼板組（密疊薄板）
  for (let f = 0; f < plateN; f++) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(plateGap * 0.6, 1.5, 1.24),
      M(f % 2 ? 0x9fb0c2 : 0x778799, 0.28, 0.9));
    plate.position.set(hxX - packLen / 2 + 0.02 + f * plateGap, 0.9, hxZ); g.add(plate);
  }
  // 上下拉桿（兩支）
  [0.55, -0.55].forEach(dy => {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, packLen + 0.3, 10), steel);
    rod.rotation.z = Math.PI / 2; rod.position.set(hxX, 0.9 + dy, hxZ); g.add(rod);
  });
  // 四角接管（藍進/藍出、綠/紅）在固定端框上
  const hxFx = hxX - packLen / 2 - 0.12;
  [[0.5, 0.42, '#2a8cff', true], [-0.5, 0.42, '#33d98f', true],
   [0.5, -0.42, '#ff5a64', false], [-0.5, -0.42, '#7fd0ff', true]].forEach(([dy, dz, hex, isS]) => {
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.34, 14), steel);
    noz.rotation.z = Math.PI / 2; noz.position.set(hxFx - 0.1, 0.9 + dy, hxZ + dz); g.add(noz);
    flangeX(g, hxFx - 0.26, 0.9 + dy, hxZ + dz, 0.13);
    pipe(hex, isS, 0.5, 'x', hxFx - 0.45, 0.9 + dy, hxZ + dz, 0.07);
  });
  const hxLab = makeLabel('FREE COOLING HX', '#9eff2e', 0.8);
  hxLab.position.set(hxX, 2.0, hxZ); g.add(hxLab);

  // ── 膨脹水箱（紅色直立罐）──
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.8, 18), M(0xb23030, 0.4, 0.5, 0x3a0808, 0.3));
  tank.position.set(4.2, 1.0, -0.5); g.add(tank);
  const tankTop = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M(0xb23030, 0.4, 0.5));
  tankTop.position.set(4.2, 1.9, -0.5); g.add(tankTop);

  // ── 泵組陣列（4 台端吸離心泵：綠色散熱鰭馬達 + 黃色聯軸器 + 蝸殼，比照照片）──
  for (let p = 0; p < 4; p++) {
    const px = -4.2 + p * 2.5;
    const isG = p % 2 === 0;
    const pz = 5.4, ay = 0.5;
    // 共用混凝土底盤
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 0.66), M(0x4a5666, 0.6, 0.4));
    base.position.set(px + 0.15, 0.07, pz); g.add(base);
    // 蝸殼泵體（軸沿 X，朝 -x 為吸入端）
    const vol = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 22), dark);
    vol.rotation.z = Math.PI / 2; vol.position.set(px - 0.62, ay, pz);
    vol.userData = { pick: true, type: 'pump', id: p + 1 }; T.pickables.push(vol); g.add(vol);
    // 軸向吸入口法蘭（-x 端）
    flangeX(g, px - 0.82, ay, pz, 0.26);
    const sucPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 14), steel);
    sucPipe.rotation.z = Math.PI / 2; sucPipe.position.set(px - 1.0, ay, pz); g.add(sucPipe);
    // 頂部出水口 + 立管（綠供 / 紅回）
    const disch = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.24, 12), steel);
    disch.position.set(px - 0.62, ay + 0.34, pz); g.add(disch);
    pipe(isG ? GRN : RED, isG, 0.7, 'y', px - 0.62, ay + 0.75, pz, 0.075);
    // 黃色聯軸器護罩
    const coupler = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.26, 14), yellowCp);
    coupler.rotation.z = Math.PI / 2; coupler.position.set(px - 0.28, ay, pz); g.add(coupler);
    // 綠色散熱鰭馬達（臥式同軸）
    finnedX(g, px + 0.22, ay, pz, 0.21, 0.62, motorGrn);
    // 馬達接線盒
    const tb = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.13, 0.16), M(0x12604a, 0.45, 0.5));
    tb.position.set(px + 0.22, ay + 0.26, pz); g.add(tb);
    // 馬達端散熱罩
    const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.12, 14), dark);
    cowl.rotation.z = -Math.PI / 2; cowl.position.set(px + 0.6, ay, pz); g.add(cowl);
  }
  const labP = makeLabel('CHW / CW PUMPS · N+1', '#9eff2e', 0.85);
  labP.position.set(-1, 1.5, 5.4); g.add(labP);

  // ── 主管網（雙高度母管：綠供 / 紅回 + 立管 + 彎頭）──
  pipe(GRN, true,  20, 'x', 0, 1.5, 3.3, 0.11);   // 綠供水母管
  pipe(RED, false, 20, 'x', 0, 2.0, 3.7, 0.11);   // 紅回水母管
  pipe(GRN, true,  9, 'z', -6.5, 1.5, -1, 0.09);  // 往冰機側
  pipe(RED, false, 9, 'z', -6.0, 2.0, -1, 0.09);
  // 通往頂樓冷卻塔的冷卻水母管（機房內橫向，連到立管底部）
  pipe(GRN, true, 9, 'x', 1, 1.5, -3.8, 0.1);
  pipe(RED, false, 9, 'x', 1, 2.0, -4.2, 0.1);
  pipe(GRN, true, 2.6, 'z', 5.15, 1.5, -2.5, 0.1);   // 轉向頂樓立管
  pipe(RED, false, 2.6, 'z', 5.55, 2.0, -2.5, 0.1);
  [[-8, 1.75, 3.3], [0, 1.75, 3.5], [4.2, 1.5, 1.4], [5.15, 1.6, -3.8]].forEach(([ex, ey, ez]) => elbow(GRN, ex, ey, ez));

  // 場景分層標示
  const labRoom = makeLabel('PLANT ROOM 機房', '#9eff2e', 1.0);
  labRoom.position.set(-2, 0.4, 6.6); g.add(labRoom);
  const lab = makeLabel('CHILLER PLANT · 冰水動力中心', '#35c8ff', 1.0);
  lab.position.set(-2, 5.2, 5); g.add(lab);
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

/* ── 管路流動（改用發光貼圖捲動，不再用粒子）────────── */
function buildPipeParticles() {
  // 清除任何舊版粒子層（若存在）
  const old = T.groups.white?.getObjectByName('pipeParticleLayer');
  if (old) {
    old.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    T.groups.white.remove(old);
  }
  T.pipeParticles = [];
  // 流動效果由 pipeMat 的 emissiveMap 在 animate 中捲動產生，此處不再建立幾何體
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
    const s = 0.85 + Math.sin(t * 2.2) * 0.18;
    [...T.supplyMats, ...T.plantSup].forEach(m => m.emissiveIntensity = s);
    [...T.returnMats, ...T.plantRet].forEach(m => m.emissiveIntensity = s + 0.1);

    // 管內液體流動：沿管軸捲動發光亮帶（供水、回水反向）
    const flow = _dt * 0.55;
    if (_flowTexSup) _flowTexSup.offset.y -= flow;
    if (_flowTexRet) _flowTexRet.offset.y += flow * 0.85;

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
  if (T.composer) T.composer.render();
  else T.renderer.render(T.scene, T.camera);
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
