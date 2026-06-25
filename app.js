// ── Dashboard Navigation ─────────────────────────────────────
function showDashboard() {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  const dash = document.getElementById('tab-dashboard');
  if (dash) dash.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navBack = document.getElementById('nav-back');
  if (navBack) navBack.style.display = 'none';
  // 首頁：隱藏所有分頁按鈕與返回鍵
  const nav = document.getElementById('main-nav');
  if (nav) { nav.classList.add('dashboard-mode'); nav.classList.remove('calc-mode'); }
}

function showTab(tabId) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  const section = document.getElementById('tab-' + tabId);
  if (section) section.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  if (activeBtn) activeBtn.classList.add('active');
  const navBack = document.getElementById('nav-back');
  if (navBack) navBack.style.display = '';
  // 計算內容頁：最上方只留返回鍵，其他分頁按鈕不顯示
  const nav = document.getElementById('main-nav');
  if (nav) { nav.classList.remove('dashboard-mode'); nav.classList.add('calc-mode'); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Tab Navigation ──────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    showTab(btn.dataset.tab);
  });
});

// Show dashboard on load
showDashboard();

// ── Helpers ─────────────────────────────────────────────────
function fmt(n, dec = 2) {
  if (!isFinite(n) || isNaN(n)) return '—';
  return n.toLocaleString('zh-TW', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function setResult(id, value, dec = 2) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = fmt(value, dec);
  const box = el.closest('.result-box');
  if (box) box.classList.add('has-result');
}

function getVal(id) {
  return parseFloat(document.getElementById(id).value);
}

// ── AF-01 換氣次數法 ─────────────────────────────────────────
function calcAF1() {
  const V = getVal('af1-volume');
  const n = getVal('af1-ach');
  if (!V || !n || V <= 0 || n <= 0) return;
  setResult('af1-val', V * n);
}

// ── AF-02 顯熱負荷法 ─────────────────────────────────────────
// Q (m³/h) = Qs (W) / (ρ × Cp × ΔT) × 3600
function calcAF2() {
  const Qs  = getVal('af2-qs');
  const dT  = getVal('af2-dt');
  const rho = getVal('af2-rho') || 1.2;
  const Cp  = 1005; // J/(kg·K)
  if (!Qs || !dT || Qs <= 0 || dT <= 0) return;
  const Q_m3h = (Qs / (rho * Cp * dT)) * 3600;
  setResult('af2-val', Q_m3h);
}

// ── AF-03 新鮮空氣量 ─────────────────────────────────────────
function calcAF3() {
  const N = getVal('af3-people');
  const q = getVal('af3-q');
  if (!N || !q || N <= 0 || q <= 0) return;
  setResult('af3-val', N * q);
}

// ── AF-04 風管截面積 ─────────────────────────────────────────
function calcAF4() {
  const Q_m3h = getVal('af4-q');
  const v     = getVal('af4-v');
  if (!Q_m3h || !v || Q_m3h <= 0 || v <= 0) return;
  const Q_m3s = Q_m3h / 3600;
  const A = Q_m3s / v;           // m²
  const D = Math.sqrt(4 * A / Math.PI) * 1000; // mm
  setResult('af4-area', A, 4);
  setResult('af4-diam', D, 0);
}

// ── WF-01 冷凍水流量 ─────────────────────────────────────────
// m³/h = kW × 3600 / (4186 × ΔT)
function calcWF1() {
  const Q_kw = getVal('wf1-load');
  const dT   = getVal('wf1-dt');
  if (!Q_kw || !dT || Q_kw <= 0 || dT <= 0) return;

  const m3h  = (Q_kw * 1000 * 3600) / (4186 * dT);
  const lmin = m3h * 1000 / 60;
  const gpm  = m3h * 4.40287;

  setResult('wf1-m3h', m3h);
  setResult('wf1-lmin', lmin);
  setResult('wf1-gpm', gpm);
}

// ── WF-02 冷卻水流量 ─────────────────────────────────────────
function calcWF2() {
  const Qevap = getVal('wf2-qevap');
  const COP   = getVal('wf2-cop');
  const dT    = getVal('wf2-dt');
  if (!Qevap || !COP || !dT || Qevap <= 0 || COP <= 0 || dT <= 0) return;

  const Qcond = Qevap * (1 + 1 / COP);
  const m3h   = (Qcond * 1000 * 3600) / (4186 * dT);

  setResult('wf2-qcond', Qcond);
  setResult('wf2-flow', m3h);
}

// ── WF-03 管道管徑 ──────────────────────────────────────────
const DN_SERIES = [15, 20, 25, 32, 40, 50, 65, 80, 100, 125, 150, 200, 250, 300, 350, 400, 450, 500];

function selectDN(calcDiam_mm) {
  for (const dn of DN_SERIES) {
    if (dn >= calcDiam_mm) return dn;
  }
  return Math.ceil(calcDiam_mm / 25) * 25;
}

function calcWF3() {
  const Q_m3h = getVal('wf3-q');
  const v     = getVal('wf3-v');
  if (!Q_m3h || !v || Q_m3h <= 0 || v <= 0) return;

  const Q_m3s = Q_m3h / 3600;
  const D_m   = Math.sqrt(4 * Q_m3s / (Math.PI * v));
  const D_mm  = D_m * 1000;
  const dn    = selectDN(D_mm);

  setResult('wf3-diam', D_mm, 1);
  document.getElementById('wf3-dn').textContent = 'DN ' + dn;
  document.getElementById('wf3-dn').closest('.result-box').classList.add('has-result');
}

// ── WF-04 制冷量單位換算 ────────────────────────────────────
// 1 RT = 3.517 kW = 3024 kcal/h = 12000 BTU/h
function calcWF4() {
  const rawVal  = getVal('wf4-val');
  const unit    = document.getElementById('wf4-unit').value;
  if (!rawVal || rawVal <= 0) return;

  let kw;
  switch (unit) {
    case 'kw':   kw = rawVal; break;
    case 'rt':   kw = rawVal * 3.517; break;
    case 'kcal': kw = rawVal / 860; break;
    case 'btu':  kw = rawVal / 3412.14; break;
    default:     kw = rawVal;
  }

  setResult('wf4-kw',   kw);
  setResult('wf4-rt',   kw / 3.517);
  setResult('wf4-kcal', kw * 860);
  setResult('wf4-btu',  kw * 3412.14, 0);
}

// ── Psychrometric Helpers ────────────────────────────────────
// Saturation vapor pressure (Magnus formula, kPa)
function satPressure(T) {
  return 0.61078 * Math.exp(17.27 * T / (T + 237.3));
}
// Humidity ratio ω (kg water / kg dry air)
function omegaFromTRH(T, RH) {
  const pws = satPressure(T);
  const pw  = (RH / 100) * pws;
  return 0.622 * pw / (101.325 - pw);
}
// Specific enthalpy (kJ / kg dry air)
function enthalpyAir(T, omega) {
  return 1.006 * T + omega * (2501 + 1.86 * T);
}
// Dew point temperature (°C)
function dewPoint(T, RH) {
  const a = 17.27, b = 237.3;
  const g = (a * T / (b + T)) + Math.log(RH / 100);
  return (b * g) / (a - g);
}
// Wet bulb temperature (°C) — Stull 2011 approximation
function wetBulb(T, RH) {
  return T * Math.atan(0.151977 * Math.sqrt(RH + 8.313659)) +
    Math.atan(T + RH) - Math.atan(RH - 1.676331) +
    0.00391838 * Math.pow(RH, 1.5) * Math.atan(0.023101 * RH) - 4.686035;
}
// Specific volume of moist air (m³/kg dry air) at 101.325 kPa
function specificVol(T, RH) {
  return 287.042 * (T + 273.15) * (1 + 1.6078 * omegaFromTRH(T, RH)) / 101325;
}

// ── Clean Room 連動狀態 ───────────────────────────────────────
const ISO_ACH = { 5: [240, 360], 6: [150, 200], 7: [60, 100], 8: [5, 30] };

const crState = {
  area: null, vol: null, H: null,
  achLo: null, Qiso: null, Qex: null, QsupMin: null,
  Qtotal: null, dT: null, Troom: null, Tsupply: null,
  QsupCool: null, QsupDesign: null,
  QFFU: null
};

function syncCR() {
  const sv = (id, val, dec) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = (val !== null && isFinite(val)) ? fmt(val, dec !== undefined ? dec : 1) : '—';
  };
  sv('cr2-ref-area',    crState.area,       1);
  sv('cr3-ref-qtotal',  crState.Qtotal,     1);
  sv('cr3-ref-dt',      crState.dT,         1);
  sv('cr4-ref-area',    crState.area,       1);
  sv('cr4-ref-qdesign', crState.QsupDesign, 0);
  sv('cr5-ref-qffu',    crState.QFFU,       0);
  sv('cr5-ref-qex',     crState.Qex,        0);
  if (crState.H !== null) {
    const el = document.getElementById('cr4-rh');
    if (el && !el.dataset.edited) el.value = crState.H;
  }
}

// ── CR-01 空間與排氣參數 ──────────────────────────────────────
function calcCR1() {
  const iso = parseInt(document.getElementById('cr1-iso').value);
  const L   = getVal('cr1-L'), W = getVal('cr1-W'), H = getVal('cr1-H');
  const Qex = getVal('cr1-qex') || 0;
  if (!L || !W || !H || L <= 0 || W <= 0 || H <= 0) return;
  const area = L * W, vol = area * H;
  const [achLo] = ISO_ACH[iso];
  const Qiso    = vol * achLo;
  const QsupMin = Math.max(Qiso, Qex * 1.1);
  setResult('cr1-area',   area,    1);
  setResult('cr1-vol',    vol,     1);
  setResult('cr1-ach-lo', achLo,   0);
  setResult('cr1-qsup',   QsupMin, 0);
  Object.assign(crState, { area, vol, H, achLo, Qiso, Qex, QsupMin });
  syncCR();
}

// ── CR-02 熱負荷與環境參數 ────────────────────────────────────
function calcCR2() {
  const area  = crState.area;
  const equip = getVal('cr2-equip') || 0;
  const light = getVal('cr2-light') || 0;
  const ppl   = getVal('cr2-ppl')   || 0;
  const Troom = getVal('cr2-troom');
  const Tsup  = getVal('cr2-tsup');
  if (!area || area <= 0 || !Troom || !Tsup || Troom <= Tsup) return;
  const Qtotal    = (area * (equip + light) + ppl * 100) / 1000;
  const dT        = Troom - Tsup;
  const QsupCool  = Qtotal * 3600 / (1.2 * 1.006 * dT);
  const QsupDesign = Math.max(crState.QsupMin || 0, QsupCool);
  setResult('cr2-qtotal',  Qtotal,     1);
  setResult('cr2-qcool',   QsupCool,   0);
  setResult('cr2-qdesign', QsupDesign, 0);
  Object.assign(crState, { Qtotal, dT, Troom, Tsupply: Tsup, QsupCool, QsupDesign });
  syncCR();
}

// ── CR-03 DCC 選型 ────────────────────────────────────────────
function calcCR3() {
  const Q  = crState.Qtotal, dT = crState.dT;
  if (!Q || !dT || Q <= 0 || dT <= 0) return;
  const Tchws = getVal('cr3-chws'), Tchwr = getVal('cr3-chwr');
  const nDCC  = Math.max(1, Math.round(getVal('cr3-ndcc') || 2));
  const vFace = getVal('cr3-vface') || 2.5;
  if (!Tchws || !Tchwr || Tchwr <= Tchws) return;
  const dTchw  = Tchwr - Tchws;
  const qUnit  = Q / nDCC;
  const mWater = qUnit * 0.86 / dTchw;
  const qAir   = qUnit * 3600 / (1.2 * 1.006 * dT);
  const aFace  = qAir / (vFace * 3600);
  const fH = Math.sqrt(aFace / 2), fW = 2 * fH;
  setResult('cr3-qunit',  qUnit,  1);
  setResult('cr3-mwater', mWater, 2);
  setResult('cr3-aface',  aFace,  3);
  const dimsEl = document.getElementById('cr3-dims');
  if (dimsEl) {
    dimsEl.textContent = fmt(fH, 2) + '×' + fmt(fW, 2);
    const box = dimsEl.closest('.result-box');
    if (box) box.classList.add('has-result');
  }
}

// ── CR-04 FFU 送風核算 ────────────────────────────────────────
function calcCR4() {
  const area    = crState.area;
  const ffuArea = parseFloat(document.getElementById('cr4-fsize').value);
  const vel  = getVal('cr4-vel');
  const cov  = getVal('cr4-cov');
  const rh   = getVal('cr4-rh');
  if (!area || area <= 0 || !vel || !cov || !rh || rh <= 0) return;
  const qEach  = ffuArea * vel * 3600;
  const nFFU   = Math.ceil((area * cov / 100) / ffuArea);
  const qTotal = nFFU * qEach;
  const ach    = qTotal / (area * rh);
  setResult('cr4-each',   qEach,  0);
  setResult('cr4-n',      nFFU,   0);
  setResult('cr4-qtotal', qTotal, 0);
  setResult('cr4-ach',    ach,    1);
  crState.QFFU = qTotal;
  syncCR();
  const cmpEl = document.getElementById('cr4-compare');
  if (cmpEl) {
    if (crState.QsupDesign && crState.QsupDesign > 0) {
      const r = qTotal / crState.QsupDesign;
      if (r >= 1) {
        cmpEl.className = 'cr-compare ok';
        cmpEl.textContent = '✓ FFU 供風 ' + fmt(qTotal, 0) + ' m³/h ≥ 設計需求 ' + fmt(crState.QsupDesign, 0) + ' m³/h（+' + fmt((r - 1) * 100, 1) + '%）';
      } else {
        cmpEl.className = 'cr-compare warn';
        cmpEl.textContent = '⚠ FFU 供風不足：' + fmt(qTotal, 0) + ' < 需求 ' + fmt(crState.QsupDesign, 0) + ' m³/h（差 ' + fmt((1 - r) * 100, 1) + '%）';
      }
    } else {
      cmpEl.className = 'cr-compare';
      cmpEl.textContent = '';
    }
  }
}

// ── CR-05 回風道實務核算 ──────────────────────────────────────
function calcCR5() {
  const QFFU  = crState.QFFU || 0;
  const Qex   = crState.Qex  || 0;
  if (QFFU <= 0) return;
  const nGrille = getVal('cr5-ngrille') || 4;
  const vGrille = getVal('cr5-vgrille') || 2.0;
  const vDuct   = getVal('cr5-vduct')   || 3.0;
  const dtype   = document.getElementById('cr5-dtype').value;
  const dH      = getVal('cr5-dH') || 0.5;
  const Qreturn    = Math.max(0, QFFU - Qex);
  const qPerGrille = Qreturn / nGrille;
  const aGrille    = qPerGrille / (vGrille * 3600);
  const aDuct      = Qreturn / (vDuct * 3600);
  setResult('cr5-qreturn',    Qreturn,    0);
  setResult('cr5-qpergrille', qPerGrille, 0);
  setResult('cr5-agrille',    aGrille,    4);
  setResult('cr5-aduct',      aDuct,      4);
  const dimsEl = document.getElementById('cr5-dims');
  if (dimsEl) {
    const dims = dtype === 'round'
      ? 'Ø' + fmt(Math.sqrt(4 * aDuct / Math.PI) * 1000, 0) + ' mm'
      : fmt(dH, 2) + '×' + fmt(aDuct / dH, 2) + ' m';
    dimsEl.textContent = dims;
    const box = dimsEl.closest('.result-box');
    if (box) box.classList.add('has-result');
  }
}

function toggleCR5DuctH() {
  const g = document.getElementById('cr5-H-group');
  if (g) g.style.display = document.getElementById('cr5-dtype').value === 'rect' ? '' : 'none';
}

// ── DCC-01 顯熱冷卻量 ─────────────────────────────────────────
function calcDCC1() {
  const Q   = getVal('dcc1-q');
  const T1  = getVal('dcc1-t1'), T2 = getVal('dcc1-t2');
  const rho = getVal('dcc1-rho') || 1.2;
  if (!Q || Q <= 0 || T1 == null || T2 == null) return;
  const kw = (Q / 3600) * rho * 1.005 * (T1 - T2);
  setResult('dcc1-cap', kw);
  setResult('dcc1-rt',  kw / 3.517);
}

// ── DCC-02 盤管面積 ───────────────────────────────────────────
function calcDCC2() {
  const Q  = getVal('dcc2-q');
  const fv = getVal('dcc2-fv');
  if (!Q || !fv || Q <= 0 || fv <= 0) return;
  const area = Q / (fv * 3600);
  const side = Math.round(Math.sqrt(area) * 1000);
  setResult('dcc2-area', area, 3);
  const sideEl = document.getElementById('dcc2-side');
  sideEl.textContent = side + ' × ' + side;
  sideEl.closest('.result-box').classList.add('has-result');
}

// ── DCC-03 CHW 需求 + 露點確認 ────────────────────────────────
function calcDCC3() {
  const cap  = getVal('dcc3-cap');
  const Ts   = getVal('dcc3-ts'), Tr = getVal('dcc3-tr');
  const rmT  = getVal('dcc3-rmt'), rmRH = getVal('dcc3-rmrh');
  if (!cap || !Ts || !Tr || cap <= 0 || Ts >= Tr) return;
  const m3h = (cap * 1000 * 3600) / (4186 * (Tr - Ts));
  const dp   = dewPoint(rmT, rmRH);
  const safe = Ts >= dp;
  setResult('dcc3-flow', m3h);
  setResult('dcc3-dp',   dp, 1);
  const riskEl = document.getElementById('dcc3-risk');
  riskEl.textContent = safe ? '✓ 安全' : '⚠ 結露風險';
  riskEl.style.color  = safe ? 'var(--teal)' : 'var(--amber)';
  riskEl.closest('.result-box').classList.add('has-result');
}

// ── MAU-01 全熱冷卻負荷 ───────────────────────────────────────
function calcMAU1() {
  const Q  = getVal('mau1-q');
  const T1 = getVal('mau1-t1'), RH1 = getVal('mau1-rh1');
  const T2 = getVal('mau1-t2'), RH2 = getVal('mau1-rh2');
  if (!Q || Q <= 0) return;
  const m   = Q * 1.2 / 3600; // kg/s
  const w1  = omegaFromTRH(T1, RH1), w2 = omegaFromTRH(T2, RH2);
  const h1  = enthalpyAir(T1, w1),   h2 = enthalpyAir(T2, w2);
  const Qt  = m * (h1 - h2);
  const Qs  = m * 1.006 * (T1 - T2);
  const Ql  = Qt - Qs;
  setResult('mau1-qt',  Qt);
  setResult('mau1-qs',  Qs);
  setResult('mau1-ql',  Ql);
  setResult('mau1-shr', Qt > 0 ? Qs / Qt : 0);
  updatePsychroPoints(T1, RH1, T2, RH2);
  updateMAUDiagram(T1, RH1, T2, RH2);
}

// ── MAU-02 除濕量 ─────────────────────────────────────────────
function calcMAU2() {
  const Q  = getVal('mau2-q');
  const T1 = getVal('mau2-t1'), RH1 = getVal('mau2-rh1');
  const T2 = getVal('mau2-t2'), RH2 = getVal('mau2-rh2');
  if (!Q || Q <= 0) return;
  const m  = Q * 1.2 / 3600; // kg/s
  const w1 = omegaFromTRH(T1, RH1);
  const w2 = omegaFromTRH(T2, RH2);
  setResult('mau2-w1', w1 * 1000, 2); // g/kg
  setResult('mau2-w2', w2 * 1000, 2);
  setResult('mau2-wd', m * (w1 - w2) * 3600);
  updatePsychroPoints(T1, RH1, T2, RH2);
  updateMAUDiagram(T1, RH1, T2, RH2);
}

// ── MAU-03 CHW 需求 ───────────────────────────────────────────
function calcMAU3() {
  const cap = getVal('mau3-cap');
  const Ts  = getVal('mau3-ts'), Tr = getVal('mau3-tr');
  if (!cap || !Ts || !Tr || cap <= 0 || Ts >= Tr) return;
  const m3h = (cap * 1000 * 3600) / (4186 * (Tr - Ts));
  setResult('mau3-m3h',  m3h);
  setResult('mau3-lmin', m3h * 1000 / 60);
}

// ── Psychrometric Chart ──────────────────────────────────────
const PC = {
  ml: 64, mr: 25, mt: 22, mb: 48,
  vw: 700, vh: 420,
  Tmin: 0, Tmax: 46, wmin: 0, wmax: 31,
  get cw() { return this.vw - this.ml - this.mr; },
  get ch() { return this.vh - this.mt - this.mb; },
  tx(T) { return this.ml + (T - this.Tmin) / (this.Tmax - this.Tmin) * this.cw; },
  ty(w) { return this.mt + this.ch * (1 - (w - this.wmin) / (this.wmax - this.wmin)); }
};

function initPsychroChart() {
  const svg = document.getElementById('psychro-svg');
  if (!svg) return;
  const { ml, mr, mt, mb, vw, vh, cw, ch } = PC;
  let h = '';

  h += `<rect x="0" y="0" width="${vw}" height="${vh}" fill="#080d18"/>`;
  h += `<rect x="${ml}" y="${mt}" width="${cw}" height="${ch}" fill="#0b1120"/>`;
  h += `<defs><clipPath id="cc"><rect x="${ml}" y="${mt}" width="${cw}" height="${ch}"/></clipPath></defs>`;

  for (let T = 0; T <= 45; T += 5) {
    const x = PC.tx(T); const major = T % 10 === 0;
    h += `<line x1="${x}" y1="${mt}" x2="${x}" y2="${mt+ch}" stroke="${major?'#1e3050':'#141e30'}" stroke-width="${major?.8:.4}"/>`;
    h += `<text x="${x}" y="${mt+ch+17}" text-anchor="middle" fill="${major?'#4a6a88':'#30485e'}" font-size="11" font-family="Share Tech Mono,monospace">${T}</text>`;
  }
  for (let w = 0; w <= 30; w += 5) {
    const y = PC.ty(w); const major = w % 10 === 0;
    h += `<line x1="${ml}" y1="${y}" x2="${ml+cw}" y2="${y}" stroke="${major?'#1e3050':'#141e30'}" stroke-width="${major?.8:.4}"/>`;
    h += `<text x="${ml-8}" y="${y+4}" text-anchor="end" fill="#4a6a88" font-size="11" font-family="Share Tech Mono,monospace">${w}</text>`;
  }

  const RH_LINES = [10,20,30,40,50,60,70,80,90];
  for (const rh of RH_LINES) {
    let path = '', lx, ly;
    for (let T = 0; T <= 45.5; T += 0.4) {
      const w = omegaFromTRH(T, rh) * 1000;
      if (w > 30) break;
      lx = PC.tx(T); ly = PC.ty(w);
      path += (path==='' ? `M${lx},${ly}` : ` L${lx},${ly}`);
    }
    if (path) {
      h += `<path d="${path}" stroke="#1e3555" stroke-width="0.7" fill="none" clip-path="url(#cc)"/>`;
      if (lx != null) h += `<text x="${lx+3}" y="${ly+4}" fill="#2a4560" font-size="9" font-family="Share Tech Mono,monospace">${rh}%</text>`;
    }
  }

  let sat = '';
  for (let T = 0; T <= 45.2; T += 0.3) {
    const w = omegaFromTRH(T, 100) * 1000;
    if (w > 30) break;
    const x = PC.tx(T), y = PC.ty(w);
    sat += (T===0 ? `M${x},${y}` : ` L${x},${y}`);
  }
  h += `<path d="${sat}" stroke="#2a4a68" stroke-width="1.2" fill="none" clip-path="url(#cc)"/>`;
  h += `<rect x="${ml}" y="${mt}" width="${cw}" height="${ch}" fill="none" stroke="#243d5c" stroke-width="1"/>`;
  h += `<text x="${ml+cw/2}" y="${vh-5}" text-anchor="middle" fill="#6a8aa8" font-size="12" font-family="Rajdhani,sans-serif" font-weight="600">乾球溫度 (°C)</text>`;
  h += `<text x="${ml-48}" y="${mt+ch/2}" text-anchor="middle" fill="#6a8aa8" font-size="12" font-family="Rajdhani,sans-serif" font-weight="600" transform="rotate(-90,${ml-48},${mt+ch/2})">含濕量 ω (g/kg)</text>`;
  h += `<g id="psychro-target"></g>`;
  h += `<g id="psychro-process"></g>`;
  h += `<g id="psychro-pts"></g>`;
  h += `<g id="psychro-tooltip"></g>`;
  svg.innerHTML = h;
}

function updatePsychroPoints(T1, RH1, T2, RH2) {
  const grp = document.getElementById('psychro-pts');
  if (!grp) return;
  const proc = document.getElementById('psychro-process');
  if (proc) proc.innerHTML = '';
  _currentPsychroStates = [
    { id:'OA', label:'室外空氣', T:T1, RH:RH1, wg:omegaFromTRH(T1,RH1)*1000, h:enthalpyAir(T1,omegaFromTRH(T1,RH1)) },
    { id:'SA', label:'送風',     T:T2, RH:RH2, wg:omegaFromTRH(T2,RH2)*1000, h:enthalpyAir(T2,omegaFromTRH(T2,RH2)) },
  ];
  _tooltipIdx = -1;
  const tt = document.getElementById('psychro-tooltip');
  if (tt) tt.innerHTML = '';
  const w1 = Math.min(omegaFromTRH(T1, RH1) * 1000, 30);
  const w2 = Math.min(omegaFromTRH(T2, RH2) * 1000, 30);
  const x1 = PC.tx(T1), y1 = PC.ty(w1);
  const x2 = PC.tx(T2), y2 = PC.ty(w2);
  const lx1 = x1 > PC.ml + PC.cw - 28 ? x1 - 22 : x1 + 8;
  const ly1 = y1 > PC.mt + 14 ? y1 - 7 : y1 + 14;
  const lx2 = x2 > PC.ml + PC.cw - 28 ? x2 - 22 : x2 + 8;
  const ly2 = y2 > PC.mt + 14 ? y2 - 7 : y2 + 14;
  grp.innerHTML =
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#f0a430" stroke-width="1.8" stroke-dasharray="7,4" opacity=".9"/>` +
    `<circle cx="${x1}" cy="${y1}" r="6" fill="#f0a430" stroke="#080d18" stroke-width="1.5" onclick="clickPsychroPoint(0)" style="cursor:pointer"/>` +
    `<text x="${lx1}" y="${ly1}" fill="#f0a430" font-size="9.5" font-family="Share Tech Mono,monospace" font-weight="bold">OA</text>` +
    `<circle cx="${x2}" cy="${y2}" r="6" fill="#4a88d8" stroke="#080d18" stroke-width="1.5" onclick="clickPsychroPoint(1)" style="cursor:pointer"/>` +
    `<text x="${lx2}" y="${ly2}" fill="#4a88d8" font-size="9.5" font-family="Share Tech Mono,monospace" font-weight="bold">SA</text>`;
  syncPsychroModal();
}

function updatePsychroTarget() {
  const grp = document.getElementById('psychro-target');
  if (!grp) return;
  const get = id => parseFloat(document.getElementById(id)?.value);
  const tgtT  = get('tgt-sa-t')  ?? 22;
  const tgtRH = get('tgt-sa-rh') ?? 50;

  const wg = Math.max(PC.wmin, Math.min(omegaFromTRH(tgtT, Math.max(1, Math.min(100, tgtRH))) * 1000, PC.wmax));
  const x  = PC.tx(Math.max(PC.Tmin + 0.5, Math.min(PC.Tmax - 0.5, tgtT)));
  const y  = PC.ty(wg);
  const R  = 7;
  const lx = x > PC.ml + PC.cw - 52 ? x - 50 : x + 11;
  const ly = y > PC.mt + 14 ? y - 6 : y + 14;
  const diamond = `${x},${y-R} ${x+R},${y} ${x},${y+R} ${x-R},${y}`;

  grp.innerHTML =
    `<polygon points="${diamond}" fill="rgba(74,136,216,0.18)" stroke="#4a88d8" stroke-width="1.6" clip-path="url(#cc)"/>` +
    `<text x="${lx}" y="${ly}" fill="#4a88d8" font-size="9" font-family="Share Tech Mono,monospace" opacity=".9">SA 目標</text>`;
  syncPsychroModal();
}

// ── MAU-05 3D Interactive Model ──────────────────────────────

const COMP_CATALOG = [
  { key:'ai',     label:'進風段 AI',   cat:'damper',  w:0.5,  rgb:[26,40,56]  },
  { key:'mb',     label:'混合箱 MB',   cat:'mixing',  w:0.7,  rgb:[16,32,48]  },
  { key:'ee',     label:'節能段 EE',   cat:'mixing',  w:0.7,  rgb:[16,30,48]  },
  { key:'pf-g4',  label:'板式濾 G4',   cat:'filter',  w:0.5,  rgb:[36,62,96]  },
  { key:'pf-f7',  label:'袋式濾 F7',   cat:'filter',  w:0.5,  rgb:[46,74,112] },
  { key:'hf-h13', label:'高效濾 H13',  cat:'filter',  w:0.5,  rgb:[58,88,132] },
  { key:'cc',     label:'冷水盤管 CC', cat:'chw',     w:1.8,  rgb:[0,104,145] },
  { key:'hc',     label:'熱水盤管 HC', cat:'hhw',     w:1.8,  rgb:[145,68,0]  },
  { key:'eh',     label:'電熱段 EH',   cat:'heater',  w:0.7,  rgb:[96,16,16]  },
  { key:'ep',     label:'靜電除塵 EP', cat:'ep',      w:0.7,  rgb:[42,48,16]  },
  { key:'sf_d',   label:'送風機 SF-D', cat:'fan',     w:1.6,  rgb:[24,38,60]  },
  { key:'sf_e',   label:'送風機 EC',   cat:'fan',     w:1.6,  rgb:[20,50,60]  },
  { key:'rf_d',   label:'回風機 RF-D', cat:'fan',     w:1.6,  rgb:[40,24,60]  },
  { key:'es',     label:'空段 ES',     cat:'empty',   w:0.5,  rgb:[22,30,40]  },
  { key:'ao',     label:'出風段 AO',   cat:'damper',  w:0.5,  rgb:[26,40,56]  },
];

let mauComps = [
  { id:1, key:'ai'    },
  { id:2, key:'mb'    },
  { id:3, key:'pf-g4' },
  { id:4, key:'pf-f7' },
  { id:5, key:'cc'    },
  { id:6, key:'hc'    },
  { id:7, key:'sf_d'  },
  { id:8, key:'ao'    },
];
let _nid = 9;

function updateMAUDiagram(T1, RH1, T2, RH2) {
  window.mau3dUpdateState?.({ T: T1, RH: RH1 }, { T: T2, RH: RH2 });
}

function renderCompPanel() {
  const listEl = document.getElementById('mau3d-list');
  const addEl  = document.getElementById('mau3d-add');
  if (!listEl || !addEl) return;
  listEl.innerHTML = mauComps.length
    ? mauComps.map((c, i) => {
        const d = COMP_CATALOG.find(x => x.key === c.key);
        const n = mauComps.length - 1;
        return '<div class="comp-item">' +
          '<span class="comp-num">' + (i+1) + '</span>' +
          '<span class="comp-label">' + (d ? d.label : c.key) + '</span>' +
          '<div class="comp-acts">' +
            '<button onclick="moveComp(' + c.id + ',-1)"' + (i===0?' disabled':'') + '>↑</button>' +
            '<button onclick="moveComp(' + c.id + ',1)"'  + (i===n ?' disabled':'') + '>↓</button>' +
            '<button class="comp-del" onclick="removeComp(' + c.id + ')">✕</button>' +
          '</div></div>';
      }).join('')
    : '<div class="comp-empty">尚未加入零件</div>';
  addEl.innerHTML = COMP_CATALOG
    .map(d => '<button class="comp-add-btn" onclick="addComp(\'' + d.key + '\')">' + d.label + '</button>')
    .join('');
}

function addComp(key) {
  mauComps.push({ id: _nid++, key: key });
  refreshMAU3D();
}

function removeComp(id) {
  mauComps = mauComps.filter(c => c.id !== id);
  refreshMAU3D();
}

function moveComp(id, dir) {
  const i = mauComps.findIndex(c => c.id === id);
  const j = i + dir;
  if (j < 0 || j >= mauComps.length) return;
  const tmp = mauComps[i]; mauComps[i] = mauComps[j]; mauComps[j] = tmp;
  refreshMAU3D();
}

function refreshMAU3D() {
  renderCompPanel();
  window.mau3dRefresh?.(mauComps);
}

// ── Enter key triggers calc ──────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const card = e.target.closest('.calc-card');
  if (card) card.querySelector('.calc-btn')?.click();
});

// ── cr4-rh manual edit tracking ─────────────────────────────
(function () {
  const el = document.getElementById('cr4-rh');
  if (el) el.addEventListener('input', function () { this.dataset.edited = '1'; });
})();

// ── Theme Toggle ─────────────────────────────────────────────
function setTheme(theme) {
  if (theme === 'light') {
    document.body.setAttribute('data-theme', 'light');
  } else {
    document.body.removeAttribute('data-theme');
  }
  const btnDark  = document.getElementById('btn-dark');
  const btnLight = document.getElementById('btn-light');
  if (btnDark)  btnDark.classList.toggle('active',  theme !== 'light');
  if (btnLight) btnLight.classList.toggle('active', theme === 'light');
  localStorage.setItem('hvac-theme', theme);
}

// ── Psychrometric Chart Tooltip ──────────────────────────────

let _currentPsychroStates = [];
let _tooltipIdx = -1;

function clickPsychroPoint(idx) {
  if (_tooltipIdx === idx) {
    _tooltipIdx = -1;
    const g = document.getElementById('psychro-tooltip');
    if (g) g.innerHTML = '';
  } else {
    _tooltipIdx = idx;
    drawPsychroTooltip();
  }
  syncPsychroModal();
}

function drawPsychroTooltip() {
  const grp = document.getElementById('psychro-tooltip');
  if (!grp || _tooltipIdx < 0 || !_currentPsychroStates[_tooltipIdx]) {
    if (grp) grp.innerHTML = '';
    return;
  }
  const s  = _currentPsychroStates[_tooltipIdx];
  const wb = wetBulb(s.T, s.RH);
  const dp = dewPoint(s.T, s.RH);
  const v  = specificVol(s.T, s.RH);
  const px = PC.tx(Math.max(PC.Tmin + 0.5, Math.min(PC.Tmax - 0.5, s.T)));
  const py = PC.ty(Math.min(Math.max(s.wg, PC.wmin), PC.wmax - 0.5));

  const rows = [
    ['DB', s.T.toFixed(1),  '°C'],
    ['WB', wb.toFixed(1),   '°C'],
    ['RH', s.RH.toFixed(1), '%' ],
    ['DP', dp.toFixed(1),   '°C'],
    ['W',  s.wg.toFixed(2), 'g/kg'],
    ['H',  s.h.toFixed(1),  'kJ/kg'],
    ['V',  v.toFixed(3),    'm³/kg'],
  ];

  const rH = 13, hH = 17, W1 = 18, W2 = 50, W3 = 40;
  const TW = W1 + W2 + W3 + 8, TH = hH + rows.length * rH + 4;
  let bx = px + 10, by = py - TH / 2;
  if (bx + TW > PC.ml + PC.cw - 2) bx = px - TW - 10;
  if (bx < PC.ml + 2) bx = PC.ml + 2;
  if (by < PC.mt + 2) by = PC.mt + 2;
  if (by + TH > PC.mt + PC.ch - 2) by = PC.mt + PC.ch - TH - 2;

  const isOA = _tooltipIdx === 0, isSA = _tooltipIdx === _currentPsychroStates.length - 1;
  const color = isOA ? '#f0a430' : isSA ? '#4a88d8' : '#60c8ff';

  let h = `<rect x="${bx}" y="${by}" width="${TW}" height="${TH}" rx="2" fill="rgba(4,8,16,.96)" stroke="${color}" stroke-width="0.8"/>`;
  h += `<text x="${bx + TW/2}" y="${by + 12}" text-anchor="middle" fill="${color}" font-size="9" font-family="Share Tech Mono,monospace" font-weight="bold">${s.id}</text>`;
  h += `<line x1="${bx+1}" y1="${by+hH}" x2="${bx+TW-1}" y2="${by+hH}" stroke="${color}" stroke-width="0.4" opacity=".5"/>`;
  rows.forEach((r, i) => {
    const ry = by + hH + i * rH + 10;
    h += `<text x="${bx+3}" y="${ry}" fill="#4a6a88" font-size="8" font-family="Share Tech Mono,monospace">${r[0]}</text>`;
    h += `<text x="${bx+W1+2}" y="${ry}" fill="#c0d8f0" font-size="8" font-family="Share Tech Mono,monospace">${r[1]}</text>`;
    h += `<text x="${bx+W1+W2+2}" y="${ry}" fill="#4a6a88" font-size="7.5" font-family="Share Tech Mono,monospace">${r[2]}</text>`;
  });
  grp.innerHTML = h;
}

// ── MAU-06/07 Coil Process ───────────────────────────────────

const COIL_TYPES = [
  { key:'chw',   label:'CHW 冰水盤管' },
  { key:'hhw',   label:'HHW 熱水盤管' },
  { key:'pre',   label:'預冷盤管' },
  { key:'rh',    label:'後熱盤管 (RH)' },
  { key:'humid', label:'加濕段' },
  { key:'heat',  label:'電熱段' },
];

let coilBlocks = [{ id:1, name:'chw', outDB:13, outRH:95 }];
let _cbId = 2;

function psyState(T, RH) {
  const w = omegaFromTRH(T, RH);
  return { T, RH, wg: w * 1000, h: enthalpyAir(T, w) };
}

function renderCoilBlocks() {
  const container = document.getElementById('coil-seq-blocks');
  if (!container) return;
  const T0  = parseFloat(document.getElementById('tgt-oa-t')?.value)  || 35;
  const RH0 = parseFloat(document.getElementById('tgt-oa-rh')?.value) || 70;
  const oaT  = document.getElementById('cf-oa-t');
  const oaRH = document.getElementById('cf-oa-rh');
  if (oaT)  oaT.textContent  = T0.toFixed(1) + '°C';
  if (oaRH) oaRH.textContent = RH0.toFixed(0) + '% RH';

  container.innerHTML = coilBlocks.map(b => {
    const opts = COIL_TYPES.map(c =>
      `<option value="${c.key}"${b.name === c.key ? ' selected' : ''}>${c.label}</option>`
    ).join('');
    return `<div class="cf-arr-v">↓</div>
<div class="flow-coil-block-v" id="fcb-${b.id}">
  <select class="fcbv-select" onchange="updateCB(${b.id},'name',this.value)">${opts}</select>
  <span class="fcbv-sep">|</span>
  <div class="fcbv-field">
    <label>出口 DB</label>
    <input type="number" value="${b.outDB}" step="0.5" onchange="updateCB(${b.id},'outDB',+this.value)">
    <span>°C</span>
  </div>
  <div class="fcbv-field">
    <label>出口 RH</label>
    <input type="number" value="${b.outRH}" step="1" min="0" max="100" onchange="updateCB(${b.id},'outRH',+this.value)">
    <span>%</span>
  </div>
  <div class="fcbv-res" id="fcb-res-${b.id}">— kW</div>
  <button class="fcb-del" onclick="removeCB(${b.id})" title="刪除">✕</button>
</div>`;
  }).join('');
}

function addCoilBlock() {
  coilBlocks.push({ id: _cbId++, name:'chw', outDB:13, outRH:95 });
  renderCoilBlocks();
}

function removeCB(id) {
  coilBlocks = coilBlocks.filter(b => b.id !== id);
  renderCoilBlocks();
  clearCoilSummary();
}

function updateCB(id, key, val) {
  const b = coilBlocks.find(b => b.id === id);
  if (b) b[key] = val;
}

let mau07Tab = 'summ';
function setMau07Tab(tab) {
  mau07Tab = tab;
  document.getElementById('mau07-summ-view').style.display   = tab === 'summ'   ? '' : 'none';
  document.getElementById('mau07-detail-view').style.display = tab === 'detail' ? '' : 'none';
  document.getElementById('tab-summ').classList.toggle('active',   tab === 'summ');
  document.getElementById('tab-detail').classList.toggle('active', tab === 'detail');
}

function clearCoilSummary() {
  const el = document.getElementById('mau-summary-table');
  if (el) el.innerHTML = '<div class="mau-summary-empty">請先在 MAU-06 輸入處理段並按「計算」</div>';
  const tot = document.getElementById('mau-summary-totals');
  if (tot) tot.innerHTML = '<div class="mau-summary-empty">請先在 MAU-06 按「計算」</div>';
  const status = document.getElementById('tgt-status');
  if (status) { status.className = 'tgt-status'; status.textContent = ''; }
  const badge = document.getElementById('cf-sa-badge');
  if (badge) { badge.className = 'cf-sa-badge'; badge.textContent = ''; }
  const saT  = document.getElementById('cf-sa-t');
  const saRH = document.getElementById('cf-sa-rh');
  if (saT)  saT.textContent  = '—';
  if (saRH) saRH.textContent = '—';
  const proc = document.getElementById('psychro-process');
  if (proc) proc.innerHTML = '';
}

function calcCoilProcess() {
  const T0  = parseFloat(document.getElementById('tgt-oa-t')?.value)  || 35;
  const RH0 = parseFloat(document.getElementById('tgt-oa-rh')?.value) || 70;
  const Q   = parseFloat(document.getElementById('tgt-q')?.value)     || 10000;
  const mdot = Q * 1.2 / 3600;

  if (!coilBlocks.length) { clearCoilSummary(); return; }

  const states = [{ id:'OA', label:'室外空氣 (OA)', ...psyState(T0, RH0) }];
  coilBlocks.forEach((b, i) => {
    const name = COIL_TYPES.find(c => c.key === b.name)?.label || b.name;
    states.push({ id: i === coilBlocks.length - 1 ? 'SA' : ('A' + (i+1)),
                  label: i === coilBlocks.length - 1 ? '送風 (SA)' : name,
                  coilLabel: name,
                  ...psyState(b.outDB, b.outRH) });
  });

  states.forEach((s, i) => {
    if (i === 0) return;
    const p = states[i - 1];
    s.dQ  = mdot * (s.h  - p.h);
    s.dQs = mdot * 1.006 * (s.T - p.T);
    s.dQl = s.dQ - s.dQs;
  });

  coilBlocks.forEach((b, i) => {
    const s   = states[i + 1];
    const res = document.getElementById('fcb-res-' + b.id);
    if (!res || !s) return;
    res.className   = 'fcbv-res' + (s.dQ >= 0 ? '' : ' heat');
    res.textContent = `ΔQ:${s.dQ>=0?'+':''}${s.dQ.toFixed(1)} kW  Δw:${(states[i].wg-s.wg).toFixed(2)}g/kg`;
  });

  const sa = states[states.length - 1];
  const saT  = document.getElementById('cf-sa-t');
  const saRH = document.getElementById('cf-sa-rh');
  if (saT)  saT.textContent  = sa.T.toFixed(1)  + '°C';
  if (saRH) saRH.textContent = sa.RH.toFixed(0) + '% RH';

  const tgtT    = parseFloat(document.getElementById('tgt-sa-t')?.value)     || 22;
  const tgtTtol = parseFloat(document.getElementById('tgt-sa-t-tol')?.value) || 1;
  const tgtRH   = parseFloat(document.getElementById('tgt-sa-rh')?.value)    || 50;
  const tgtRHtol= parseFloat(document.getElementById('tgt-sa-rh-tol')?.value)|| 5;
  const tOk  = Math.abs(sa.T  - tgtT)  <= tgtTtol;
  const rhOk = Math.abs(sa.RH - tgtRH) <= tgtRHtol;
  const allOk = tOk && rhOk;

  const status = document.getElementById('tgt-status');
  if (status) {
    status.className = 'tgt-status ' + (allOk ? 'ok' : 'warn');
    status.innerHTML =
      (allOk ? '✓ 達標' : '✗ 偏差') +
      ` · ${sa.T.toFixed(1)}°C (目標 ${tgtT}±${tgtTtol}°C)` +
      ` · ${sa.RH.toFixed(0)}% RH (目標 ${tgtRH}±${tgtRHtol}%)`;
  }
  const badge = document.getElementById('cf-sa-badge');
  if (badge) {
    badge.className = 'cf-sa-badge ' + (allOk ? 'ok' : 'warn');
    badge.textContent = allOk ? '✓' : '✗';
  }

  renderSummaryTable(states, mdot);
  updatePsychroProcess(states);
  const ptsGrp = document.getElementById('psychro-pts');
  if (ptsGrp) ptsGrp.innerHTML = '';
}

function renderSummaryTable(states, mdot) {
  const wrap  = document.getElementById('mau-summary-table');
  const totEl = document.getElementById('mau-summary-totals');
  if (!wrap) return;

  const fmt     = (v, d=2) => v == null ? '—' : Number(v).toFixed(d);
  const signFmt = v => v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(1);

  // ── 狀態點 Detail table ──────────────────────────────
  const rows = states.map((s, i) => {
    const cls = i === 0 ? 'sp-oa' : i === states.length - 1 ? 'sp-sa' : 'sp-mid';
    const wb  = wetBulb(s.T, s.RH).toFixed(1);
    const dp  = dewPoint(s.T, s.RH).toFixed(1);
    const v   = specificVol(s.T, s.RH).toFixed(3);
    return `<tr class="${cls}">
<td>${s.id}</td><td>${s.label}</td>
<td>${fmt(s.T,1)}</td><td>${wb}</td><td>${fmt(s.RH,1)}</td>
<td>${dp}</td><td>${fmt(s.wg,2)}</td><td>${fmt(s.h,1)}</td>
<td>${v}</td>
</tr>`;
  }).join('');
  wrap.innerHTML =
    `<table class="mau-tbl"><thead><tr>
<th>節點</th><th>名稱</th>
<th>DB °C</th><th>WB °C</th><th>RH %</th><th>DP °C</th>
<th>W g/kg</th><th>H kJ/kg</th><th>V m³/kg</th>
</tr></thead><tbody>${rows}</tbody></table>`;

  if (!totEl) return;

  // ── 核算結果 summary ──────────────────────────────────
  const oa  = states[0], sa = states[states.length - 1];
  const Q   = mdot * 3600 / 1.2;
  const totQ  = mdot * (sa.h  - oa.h);
  const totQs = mdot * 1.006 * (sa.T - oa.T);
  const totQl = totQ - totQs;
  const dehumid = mdot * (oa.wg - sa.wg) / 1000 * 3600;
  const SHR   = totQs / (totQ || 1);
  const isCool = totQ < 0;
  const qCls   = isCool ? '' : ' heat';

  const ri = (lbl, val, unit, cls='') =>
    `<div class="stot-ri${cls}"><div class="stot-ri-lbl">${lbl}</div><div class="stot-ri-val">${val}</div><div class="stot-ri-unit">${unit}</div></div>`;

  // Per-stage breakdown
  const stageRows = states.slice(1).map(s =>
    `<div class="stot-stage${s.dQ >= 0 ? ' cool' : ' heat'}">
      <span class="stot-stage-id">${s.id}</span>
      <span class="stot-stage-name">${s.label}</span>
      <span class="stot-stage-q">ΔQ ${s.dQ >= 0 ? '' : '+'}${(-s.dQ).toFixed(1)} kW</span>
    </div>`
  ).join('');

  totEl.innerHTML =
    `<div class="stot-grid">
      ${ri('總負荷 Q',    totQ.toFixed(1),              'kW',   qCls)}
      ${ri('顯熱 Qs',     totQs.toFixed(1),             'kW',   qCls)}
      ${ri('潛熱 Ql',     totQl.toFixed(1),             'kW',   qCls)}
      ${ri('顯熱比 SHR', (SHR * 100).toFixed(1),       '%'        )}
      ${ri('除濕量',       Math.abs(dehumid).toFixed(2), 'kg/h'     )}
      ${ri('OA→SA 焓差', (oa.h - sa.h).toFixed(1),     'kJ/kg'    )}
      ${ri('設計風量 Q',  Q.toFixed(0),                  'm³/h'     )}
    </div>
    <div class="stot-stages-lbl">各段負荷</div>
    <div class="stot-stages">${stageRows}</div>`;
}

function updatePsychroProcess(states) {
  _currentPsychroStates = states;
  _tooltipIdx = -1;
  const tt = document.getElementById('psychro-tooltip');
  if (tt) tt.innerHTML = '';
  const grp = document.getElementById('psychro-process');
  if (!grp || states.length < 2) { if (grp) grp.innerHTML = ''; return; }

  const COLS = ['#f0a430','#60c8ff','#80e060','#e080c0','#c0a040','#80b0ff','#a080e0','#ff8060'];
  const pts = states.map(s => ({
    ...s,
    px: PC.tx(Math.max(PC.Tmin + 0.5, Math.min(PC.Tmax - 0.5, s.T))),
    py: PC.ty(Math.min(Math.max(s.wg, PC.wmin), PC.wmax - 0.5)),
  }));

  let h = '';
  for (let i = 1; i < pts.length; i++) {
    h += `<line x1="${pts[i-1].px}" y1="${pts[i-1].py}" x2="${pts[i].px}" y2="${pts[i].py}" stroke="#a06828" stroke-width="2.2" stroke-dasharray="5,3" clip-path="url(#cc)"/>`;
  }

  pts.forEach((p, i) => {
    const isOA = i === 0, isSA = i === pts.length - 1;
    const col = isOA ? '#f0a430' : isSA ? '#4a88d8' : COLS[i % COLS.length];
    const num = i + 1;
    const lx = p.px > PC.ml + PC.cw - 28 ? p.px - 16 : p.px + 8;
    const ly = p.py > PC.mt + 14 ? p.py - 7 : p.py + 14;
    h += `<circle cx="${p.px}" cy="${p.py}" r="${isOA||isSA ? 6 : 5}" fill="${col}" stroke="#080d18" stroke-width="1.5" clip-path="url(#cc)" onclick="clickPsychroPoint(${i})" style="cursor:pointer"/>`;
    h += `<text x="${lx}" y="${ly}" fill="${col}" font-size="10" font-family="Share Tech Mono,monospace" font-weight="bold">${num}</text>`;
  });

  grp.innerHTML = h;
  syncPsychroModal();
}

// ── Psychrometric Chart Modal ─────────────────────────────────

let psychroModalOpen = false;

function syncPsychroModal() {
  if (!psychroModalOpen) return;
  const src = document.getElementById('psychro-svg');
  const dst = document.getElementById('psychro-modal-svg');
  if (src && dst) {
    dst.innerHTML = src.innerHTML
      .replace(/id="cc"/g, 'id="cc-m"')
      .replace(/url\(#cc\)/g, 'url(#cc-m)');
  }
}

function openPsychroModal() {
  const modal = document.getElementById('psychro-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  psychroModalOpen = true;
  syncPsychroModal();
}

function closePsychroModal() {
  const modal = document.getElementById('psychro-modal');
  if (!modal) return;
  modal.style.display = 'none';
  psychroModalOpen = false;
}

// ── Init ─────────────────────────────────────────────────────
initPsychroChart();
updatePsychroTarget();
renderCompPanel();
renderCoilBlocks();
['tgt-oa-t','tgt-oa-rh'].forEach(id =>
  document.getElementById(id)?.addEventListener('change', renderCoilBlocks)
);
['tgt-sa-t','tgt-sa-t-tol','tgt-sa-rh','tgt-sa-rh-tol'].forEach(id =>
  document.getElementById(id)?.addEventListener('input', updatePsychroTarget)
);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && psychroModalOpen) closePsychroModal();
});
window.addEventListener('mau3d-ready', () => window.mau3dRefresh?.(mauComps));
setTheme(localStorage.getItem('hvac-theme') || 'dark');

// ── i18n Language Toggle ──────────────────────────────────────────
function _esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const ZH_EN_MAP = {
  // ── Section h2 text nodes ──
  '風量計算': 'Air Flow Calc',
  '水量計算': 'Water Flow Calc',
  '公式參考': 'References',
  '潔淨室空調計算': 'Clean Room HVAC',
  '乾式冷卻盤管 (DCC)': 'Dry Cooling Coil (DCC)',
  '新風空調箱 (MAU)': 'Make-up Air Unit (MAU)',
  'AI Data Center計算書': 'AI Data Center Calc',
  // ── Card h3 titles ──
  '換氣次數法': 'ACH Method',
  '顯熱負荷法': 'Sensible Heat Method',
  '新鮮空氣量': 'Fresh Air Flow',
  '風管截面積 / 風速': 'Duct Area / Velocity',
  '冷凍水流量': 'Chilled Water Flow',
  '冷卻水流量': 'Cooling Water Flow',
  '管道管徑選定': 'Pipe Sizing',
  '制冷量單位換算': 'Capacity Unit Conversion',
  '風量計算公式': 'Airflow Formulas',
  '水量計算公式': 'Water Flow Formulas',
  '空氣物理常數': 'Air Physical Constants',
  '水物理常數': 'Water Physical Constants',
  '換氣次數建議值(ACH)': 'Recommended ACH Values',
  '單位換算': 'Unit Conversion',
  '空間與排氣參數': 'Space & Exhaust Params',
  '熱負荷與環境參數': 'Heat Load & Environment',
  'DCC 選型': 'DCC Selection',
  'FFU 送風核算': 'FFU Airflow Check',
  '回風道實務核算': 'Return Duct Sizing',
  '顯熱冷卻量': 'Sensible Cooling',
  '盤管面積 / 面速度': 'Coil Area / Face Velocity',
  'CHW 需求 + 露點確認': 'CHW Demand + Dew-point',
  '設計目標與室外條件': 'Design Target & Outdoor',
  '盤管處理排列': 'Coil Process Sequence',
  '除濕量計算': 'Dehumidification Calc',
  '冷凍水需求': 'Chilled Water Demand',
  '空氣線圖（焓濕圖）': 'Psychrometric Chart',
  '設計核算總表': 'Design Summary',
  'MAU 構造 3D 模型': 'AHU 3D Model',
  'IT 熱負荷估算': 'IT Load Estimation',
  '冷卻方式智能選型': 'Cooling Strategy',
  'PUE / DCiE 計算': 'PUE / DCiE Calc',
  '液冷 CHW 需求估算': 'Liquid Cooling CHW',
  // ── Input labels ──
  '房間體積 V': 'Room Volume V',
  '換氣次數 n': 'ACH n',
  '顯熱負荷 Qs': 'Sensible Load Qs',
  '送回風溫差 ΔT': 'Supply/Return ΔT',
  '空氣密度 ρ': 'Air Density ρ',
  '人數 N': 'Occupants N',
  '每人新鮮空氣量 q': 'Fresh Air/Person q',
  '風量 Q': 'Airflow Q',
  '設計風速 v': 'Design Velocity v',
  '冷卻負荷 Q': 'Cooling Load Q',
  '蒸發器負荷 Qevap': 'Evaporator Load Qevap',
  '冰水機 COP': 'Chiller COP',
  '冷卻水溫差 ΔT': 'Cooling Water ΔT',
  '水流量 Q': 'Water Flow Q',
  '設計流速 v': 'Design Velocity v',
  '輸入數值': 'Input Value',
  'ISO 潔淨等級': 'ISO Class',
  '房間長 L': 'Room Length L',
  '房間寬 W': 'Room Width W',
  '房間高 H': 'Room Height H',
  '製程排氣量 Q<sub>ex</sub>': 'Process Exhaust Q<sub>ex</sub>',
  '設備熱負荷密度': 'Equipment Heat Density',
  '照明負荷密度': 'Lighting Load Density',
  '人員數': 'Occupants',
  '設計室溫 T<sub>room</sub>': 'Room Temp T<sub>room</sub>',
  '送風溫度 T<sub>sup</sub>': 'Supply Temp T<sub>sup</sub>',
  '冰水供水溫度': 'CHW Supply Temp',
  '冰水回水溫度': 'CHW Return Temp',
  'DCC 台數': 'No. of DCC Units',
  '盤管面風速': 'Coil Face Velocity',
  'FFU 規格': 'FFU Size',
  'FFU 面風速': 'FFU Face Velocity',
  '天花板覆蓋率': 'Ceiling Coverage',
  '房間高度': 'Room Height',
  '回風口數量': 'Return Grilles',
  '回風口面風速': 'Return Grille Velocity',
  '主風管風速': 'Main Duct Velocity',
  '風管型式': 'Duct Type',
  '風管高度': 'Duct Height',
  '通過風量': 'Airflow Through Coil',
  '入口空氣溫度 T₁': 'Inlet Air Temp T₁',
  '出口空氣溫度 T₂': 'Outlet Air Temp T₂',
  '設計面速度': 'Design Face Velocity',
  'DCC 顯熱冷卻量': 'DCC Sensible Cooling',
  'CHW 供水溫度 Ts': 'CHW Supply Ts',
  'CHW 回水溫度 Tr': 'CHW Return Tr',
  '室內溫度 / 相對濕度': 'Indoor Temp / RH',
  '溫度 / 濕度': 'Temp / Humidity',
  '設計風量': 'Design Airflow',
  '溫度目標': 'Temp Target',
  '濕度目標': 'Humidity Target',
  '入口 溫度 / RH': 'Inlet Temp / RH',
  '出口 溫度 / RH': 'Outlet Temp / RH',
  'MAU 全熱冷卻量': 'MAU Total Cooling',
  'CHW 供水溫度': 'CHW Supply Temp',
  'CHW 回水溫度': 'CHW Return Temp',
  '機架數量': 'No. of Racks',
  '每架平均功率密度': 'Avg Power Density',
  'UPS 損失率': 'UPS Loss Rate',
  'PDU 損失率': 'PDU Loss Rate',
  '機架功率密度': 'Rack Power Density',
  'IT 設備功耗': 'IT Equipment Power',
  '冷卻系統功耗 (冰機+冷卻塔+泵)': 'Cooling System Power',
  '照明 + 辦公功耗': 'Lighting + Office',
  '其他雜項': 'Other Misc.',
  'IT 總熱負荷': 'Total IT Heat Load',
  '液冷帶走比例': 'Liquid Cooling Ratio',
  '冷卻水供水溫度 Ts': 'Cooling Water Supply Ts',
  '冷卻水回水溫度 Tr': 'Cooling Water Return Tr',
  // ── Result labels ──
  '所需風量 Q': 'Required Flow Q',
  '新鮮空氣量 Q': 'Fresh Air Flow Q',
  '截面積 A': 'Cross-section A',
  '等效直徑 D': 'Equiv. Dia. D',
  '流量': 'Flow Rate',
  '冷凝負荷': 'Condenser Load',
  '計算管徑 D': 'Calc Pipe Dia. D',
  '建議 DN': 'Recommended DN',
  '冷卻量': 'Cooling Capacity',
  '所需面積': 'Required Area',
  '等效邊長': 'Equiv. Side',
  'CHW 流量': 'CHW Flow',
  '室內露點': 'Indoor Dew Point',
  '結露風險': 'Condensation Risk',
  '入口含濕量 ω₁': 'Inlet Humidity ω₁',
  '出口含濕量 ω₂': 'Outlet Humidity ω₂',
  '除濕量': 'Dehumidification',
  '地板面積': 'Floor Area',
  '房間體積': 'Room Volume',
  'ISO ACH 下限': 'Min ACH (ISO)',
  '最低供風量': 'Min Supply Flow',
  '總顯熱負荷': 'Total Sensible Load',
  '冷卻需求風量': 'Cooling Airflow Req.',
  '設計供風量': 'Design Supply Flow',
  '每台冷量': 'Capacity/Unit',
  '每台冰水量': 'CHW/Unit',
  '每台面積': 'Area/Unit',
  '建議尺寸 H×W': 'Size H×W',
  '每台風量': 'Airflow/Unit',
  'FFU 台數': 'No. of FFUs',
  'FFU 總風量': 'FFU Total Flow',
  '實際 ACH': 'Actual ACH',
  '回風量': 'Return Flow',
  '每口回風': 'Flow/Grille',
  '每口有效面積': 'Effective Area/Grille',
  '主管截面': 'Main Duct Area',
  '主管尺寸': 'Main Duct Size',
  '純 IT 負荷': 'Net IT Load',
  'UPS+PDU 損失': 'UPS+PDU Loss',
  '總 IT 側負荷': 'Total IT-side Load',
  '設施總功耗': 'Total Facility Power',
  '效能評級': 'Efficiency Rating',
  '液冷側熱量': 'Liquid Cooling Heat',
  '殘餘空冷熱量': 'Residual Air Cooling',
  // ── Calc buttons ──
  '計算': 'Calculate',
  '換算': 'Convert',
  '計算 IT 負荷': 'Calc IT Load',
  '選型分析': 'Select Analysis',
  '計算 PUE': 'Calc PUE',
  '計算液冷需求': 'Calc Liquid Cooling',
  // ── MAU UI buttons/labels ──
  '+ 新增處理段': '+ Add Process Block',
  '核算結果': 'Summary',
  '狀態點 Detail': 'State Points',
  '已選零件順序': 'Selected Components',
  '加入零件': 'Add Components',
  '室外設計條件 (OA)': 'Outdoor Design (OA)',
  '供氣目標 (SA Target)': 'Supply Air Target (SA)',
  // ── Hints ──
  '一般辦公室：6–10 次/h｜潔淨室：20–100 次/h': 'Office: 6–10 ACH | Clean room: 20–100 ACH',
  '一般 AHU：8–12°C｜FCU：5–8°C': 'AHU: 8–12°C | FCU: 5–8°C',
  '辦公室：25–30｜會議室：30–50｜餐廳：30–40': 'Office: 25–30 | Meeting: 30–50 | Restaurant: 30–40',
  '主幹管：4–8 m/s｜支管：2–4 m/s｜出風口：2–4 m/s': 'Main: 4–8 m/s | Branch: 2–4 m/s | Diffuser: 2–4 m/s',
  '一般系統：5–7°C｜大溫差系統：8–12°C': 'Standard: 5–7°C | High ΔT: 8–12°C',
  '離心式：5.0–6.5｜螺旋式：4.0–5.5｜氣冷式：2.8–3.5': 'Centrifugal: 5.0–6.5 | Screw: 4.0–5.5 | Air-cooled: 2.8–3.5',
  '主管：1.5–3.0 m/s｜支管：0.9–1.5 m/s': 'Main: 1.5–3.0 m/s | Branch: 0.9–1.5 m/s',
  'DCC 出口通常 14–18°C（須高於室內露點）': 'DCC outlet: 14–18°C (above indoor dew point)',
  'DCC 盤管面速度：2.0–3.0 m/s': 'DCC face velocity: 2.0–3.0 m/s',
  'DCC 建議 14–16°C（須高於室內露點）': 'DCC CHW: 14–16°C (above indoor dew point)',
  'MAU 標準 CHW：7/12°C': 'MAU standard CHW: 7/12°C',
  '一般伺服器：5–15 kW｜GPU/AI 訓練：20–80 kW｜液冷 DGX：60–100 kW': 'Server: 5–15 kW | GPU/AI: 20–80 kW | DGX: 60–100 kW',
  '現代高效 UPS：3–5%｜老舊 UPS：8–12%': 'Modern UPS: 3–5% | Legacy UPS: 8–12%',
  '背板液冷：60–80%｜直接液冷 DLC：85–95%｜沉浸式：95–100%': 'Rear-door: 60–80% | DLC: 85–95% | Immersion: 95–100%',
  '直接液冷可用 40–45°C 供水免冷機，節能效益最大': 'DLC: 40–45°C supply without chiller — max energy savings',
  '製程排氣需補充等量新鮮空氣': 'Process exhaust requires equal fresh air makeup',
  '一般 FAB：500–2000 W/m²': 'General FAB: 500–2000 W/m²',
  '建議 2.0–3.0 m/s': 'Recommended: 2.0–3.0 m/s',
  'ISO 5–6：0.36–0.51 m/s｜ISO 7–8：0.25–0.35 m/s': 'ISO 5–6: 0.36–0.51 m/s | ISO 7–8: 0.25–0.35 m/s',
  'ISO 5：60–80%｜ISO 6：40–60%｜ISO 7：15–20%': 'ISO 5: 60–80% | ISO 6: 40–60% | ISO 7: 15–20%',
  '建議 1.5–3.0 m/s': 'Recommended: 1.5–3.0 m/s',
  '建議 3–6 m/s': 'Recommended: 3–6 m/s',
  '依此判斷最適冷卻方案，可直接輸入或從 ADC-01 帶入': 'Determines optimal strategy; enter directly or pull from ADC-01',
};

function initI18n() {
  // 1. Plain-text bilingual elements with data-zh/data-en attributes
  document.querySelectorAll('[data-zh][data-en]').forEach(el => {
    const zh = el.dataset.zh, en = el.dataset.en;
    el.innerHTML = '<span class="txt-zh">' + _esc(zh) + '</span>' +
                   '<span class="txt-en">' + _esc(en) + '</span>';
  });
  // 2. HTML bilingual elements
  document.querySelectorAll('[data-zh-html]').forEach(el => {
    const zh = el.dataset.zhHtml, en = el.dataset.enHtml || el.dataset.zhHtml;
    el.innerHTML = '<span class="txt-zh">' + zh + '</span>' +
                   '<span class="txt-en">' + en + '</span>';
  });
  // 3. Auto-scan tab content by ZH_EN_MAP lookup (innerHTML as key)
  const AUTO_SEL = 'h3, label, .result-label, .calc-btn, .hint, .tgt-section-lbl, .mau3d-section-title, .mau07-tab, .comp-add-btn';
  document.querySelectorAll(AUTO_SEL).forEach(el => {
    if (el.dataset.zh) return;
    const key = el.innerHTML.trim();
    const en = ZH_EN_MAP[key];
    if (en !== undefined) {
      el.innerHTML = '<span class="txt-zh">' + key + '</span><span class="txt-en">' + en + '</span>';
    }
  });
  // 4. Section h2 text nodes (h2 has child <span class="tag">, so replace text node only)
  document.querySelectorAll('.section-header h2').forEach(el => {
    el.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        const txt = node.textContent.trim();
        const en = ZH_EN_MAP[txt];
        if (en !== undefined) {
          const span = document.createElement('span');
          span.innerHTML = '<span class="txt-zh"> ' + txt + '</span><span class="txt-en"> ' + en + '</span>';
          node.replaceWith(span);
        }
      }
    });
  });
}
function setLang(lang) {
  document.documentElement.setAttribute('data-lang', lang);
  document.getElementById('btn-zh')?.classList.toggle('active', lang === 'zh');
  document.getElementById('btn-en')?.classList.toggle('active', lang === 'en');
  localStorage.setItem('hvac-lang', lang);
}
initI18n();
setLang(localStorage.getItem('hvac-lang') || 'zh');

// ── AI Data Center Simulator ─────────────────────────────────

// ADC-01: IT Load Estimation
function calcADC1() {
  const racks    = parseFloat(document.getElementById('adc1-racks').value);
  const density  = parseFloat(document.getElementById('adc1-density').value);
  const upsPct   = parseFloat(document.getElementById('adc1-ups').value) / 100;
  const pduPct   = parseFloat(document.getElementById('adc1-pdu').value) / 100;
  if (!racks || !density) return;
  const itLoad   = racks * density;                          // kW
  const upsLoss  = itLoad * upsPct;
  const pduLoss  = itLoad * pduPct;
  const totalIT  = itLoad + upsLoss + pduLoss;
  setResult('adc1-it',    itLoad,  1);
  setResult('adc1-ups',   upsLoss, 1);
  setResult('adc1-total', totalIT, 1);
  // push to ADC-02/03/04
  const d2 = document.getElementById('adc2-density');
  const d3 = document.getElementById('adc3-it');
  const d4 = document.getElementById('adc4-it');
  if (d2) d2.value = density.toFixed(1);
  if (d3) d3.value = totalIT.toFixed(1);
  if (d4) d4.value = totalIT.toFixed(1);
  const r2 = document.getElementById('adc2-ref-it');
  const r3 = document.getElementById('adc3-ref-it');
  if (r2) r2.textContent = totalIT.toFixed(1);
  if (r3) r3.textContent = totalIT.toFixed(1);
}

// ADC-02: Cooling Selection
function calcADC2() {
  const density = parseFloat(document.getElementById('adc2-density').value);
  if (!density) return;
  let method = '', color = '', pue = '', note = '';
  if (density < 5) {
    method = '傳統空調 (CRAC/CRAH)'; color = '#34d399';
    pue = '1.6 – 2.0'; note = '低密度機架，一般空調即可滿足需求';
  } else if (density < 15) {
    method = '精密空調 + 熱走道封閉'; color = '#3b9eff';
    pue = '1.4 – 1.7'; note = '中等密度，建議熱冷走道隔離，Row-based CRAC';
  } else if (density < 30) {
    method = '背板液冷 (Rear-door Heat Exchanger)'; color = '#a78bfa';
    pue = '1.2 – 1.5'; note = '高密度，背板液冷可直接帶走 70–100% 熱量';
  } else if (density < 60) {
    method = '直接液冷 DLC (Warm Water Cooling)'; color = '#f0a430';
    pue = '1.1 – 1.3'; note = '超高密度，直接液冷至晶片/模組，40–45°C 供水可免冷機';
  } else {
    method = '沉浸式液冷 (Immersion Cooling)'; color = '#ff6b8a';
    pue = '1.03 – 1.15'; note = '極端密度 (AI/GPU)，整機浸入冷卻液，近零顯熱散逸至空氣';
  }
  const el = document.getElementById('adc2-result-inner');
  if (el) {
    el.innerHTML = `
      <div class="adc-rec-label">建議冷卻方式</div>
      <div class="adc-rec-method" style="color:${color}">${method}</div>
      <div class="adc-rec-pue"><span class="adc-rec-key">預期 PUE</span><span class="adc-rec-val" style="color:${color}">${pue}</span></div>
      <div class="adc-rec-note">${note}</div>
    `;
    const box = el.closest('.result-box');
    if (box) box.classList.add('has-result');
  }
}

// ADC-03: PUE Calculation
function calcADC3() {
  const itLoad    = parseFloat(document.getElementById('adc3-it').value);
  const coolLoad  = parseFloat(document.getElementById('adc3-cool').value);
  const lightLoad = parseFloat(document.getElementById('adc3-light').value) || 0;
  const otherLoad = parseFloat(document.getElementById('adc3-other').value) || 0;
  if (!itLoad || !coolLoad) return;
  const totalFac = itLoad + coolLoad + lightLoad + otherLoad;
  const pue = totalFac / itLoad;
  const dcie = (1 / pue * 100);
  let grade = '', gradeColor = '';
  if (pue < 1.2) { grade = 'Platinum — 世界頂級'; gradeColor = '#34d399'; }
  else if (pue < 1.4) { grade = 'Gold — 業界領先'; gradeColor = '#3b9eff'; }
  else if (pue < 1.6) { grade = 'Silver — 良好'; gradeColor = '#a78bfa'; }
  else if (pue < 2.0) { grade = 'Bronze — 一般水準'; gradeColor = '#f0a430'; }
  else { grade = '待改善 — 效率偏低'; gradeColor = '#ff6b8a'; }
  setResult('adc3-total', totalFac, 1);
  setResult('adc3-pue',   pue, 3);
  setResult('adc3-dcie',  dcie, 1);
  const gradeEl = document.getElementById('adc3-grade');
  if (gradeEl) { gradeEl.textContent = grade; gradeEl.style.color = gradeColor; }
}

// ADC-04: Liquid Cooling CHW Demand
function calcADC4() {
  const itLoad  = parseFloat(document.getElementById('adc4-it').value);
  const ratio   = parseFloat(document.getElementById('adc4-ratio').value) / 100;
  const ts      = parseFloat(document.getElementById('adc4-ts').value);
  const tr      = parseFloat(document.getElementById('adc4-tr').value);
  if (!itLoad || !ratio || !ts || !tr || tr <= ts) return;
  const liquidLoad = itLoad * ratio;
  const airLoad    = itLoad - liquidLoad;
  const dt         = tr - ts;
  const flow_m3h   = (liquidLoad * 3600) / (4186 * dt);
  const flow_lmin  = flow_m3h * 1000 / 60;
  setResult('adc4-liquid', liquidLoad, 1);
  setResult('adc4-air',    airLoad,    1);
  setResult('adc4-flow',   flow_m3h,   2);
  setResult('adc4-lmin',   flow_lmin,  1);
}

// ADC-05: Calculation Report
function genADCReport() {
  const wrap = document.getElementById('adc5-report');
  if (!wrap) return;

  const gv  = id => parseFloat(document.getElementById(id)?.value) || 0;
  const gvs = id => document.getElementById(id)?.value?.trim() || '';

  // ADC-01 inputs
  const racks   = gv('adc1-racks');
  const density = gv('adc1-density');
  const upsPct  = gv('adc1-ups') / 100;
  const pduPct  = gv('adc1-pdu') / 100;
  if (!racks || !density) {
    wrap.innerHTML = '<div class="adc-report-empty">請先完成 ADC-01（填入機架數量與功率密度）再生成計算書</div>';
    return;
  }
  const itLoad  = racks * density;
  const upsLoss = itLoad * upsPct;
  const pduLoss = itLoad * pduPct;
  const totalIT = itLoad + upsLoss + pduLoss;

  // ADC-02 cooling strategy
  const d2 = gv('adc2-density') || density;
  let method = '', coolColor = '', pueRange = '', note2 = '';
  if      (d2 < 5)  { method = '傳統空調 (CRAC/CRAH)';               coolColor = '#34d399'; pueRange = '1.6 – 2.0'; note2 = '低密度，一般空調即可'; }
  else if (d2 < 15) { method = '精密空調 + 熱走道封閉';               coolColor = '#3b9eff'; pueRange = '1.4 – 1.7'; note2 = '中密度，建議熱冷走道隔離'; }
  else if (d2 < 30) { method = '背板液冷 (Rear-door HX)';            coolColor = '#a78bfa'; pueRange = '1.2 – 1.5'; note2 = '高密度，背板液冷可帶走 70-100% 熱量'; }
  else if (d2 < 60) { method = '直接液冷 DLC (Warm Water Cooling)';  coolColor = '#f0a430'; pueRange = '1.1 – 1.3'; note2 = '超高密度，40-45°C 供水可免冷機'; }
  else              { method = '沉浸式液冷 (Immersion Cooling)';      coolColor = '#ff6b8a'; pueRange = '1.03 – 1.15'; note2 = '極端密度 AI/GPU，近零空氣散熱'; }

  // ADC-03 PUE
  const it3    = gv('adc3-it')    || totalIT;
  const cool3  = gv('adc3-cool');
  const light3 = gv('adc3-light') || 20;
  const other3 = gv('adc3-other') || 10;
  const hasP3  = cool3 > 0;
  const totalFac = it3 + cool3 + light3 + other3;
  const pue  = hasP3 ? totalFac / it3 : null;
  const dcie = pue ? (1 / pue * 100) : null;
  let grade = '尚未計算', gradeColor = 'var(--text-muted)', gradeCls = '';
  if (pue !== null) {
    if      (pue < 1.2) { grade = 'Platinum — 世界頂級'; gradeColor = '#34d399'; gradeCls = 'hi'; }
    else if (pue < 1.4) { grade = 'Gold — 業界領先';     gradeColor = '#3b9eff'; gradeCls = 'hi'; }
    else if (pue < 1.6) { grade = 'Silver — 良好';       gradeColor = '#a78bfa'; gradeCls = ''; }
    else if (pue < 2.0) { grade = 'Bronze — 一般水準';   gradeColor = '#f0a430'; gradeCls = 'warn'; }
    else                { grade = '待改善 — 效率偏低';   gradeColor = '#ff6b8a'; gradeCls = 'bad'; }
  }

  // ADC-04 liquid cooling
  const it4     = gv('adc4-it')    || totalIT;
  const ratio4  = (gv('adc4-ratio') || 70) / 100;
  const ts4     = gv('adc4-ts')    || 20;
  const tr4     = gv('adc4-tr')    || 30;
  const hasL4   = tr4 > ts4;
  const liquidQ = it4 * ratio4;
  const airQ    = it4 - liquidQ;
  const dt4     = tr4 - ts4;
  const flowM3h = hasL4 ? (liquidQ * 3600) / (4186 * dt4) : null;
  const flowLm  = flowM3h ? flowM3h * 1000 / 60 : null;

  // Project info
  const projName = gvs('adc5-project') || '（未填寫）';
  const roomName = gvs('adc5-room')    || '（未填寫）';
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  const row = (lbl, val, unit, cls='') =>
    `<div class="adc-rpt-row">
      <span class="adc-rpt-lbl">${lbl}</span>
      <span><span class="adc-rpt-val ${cls}">${val}</span><span class="adc-rpt-unit">${unit}</span></span>
    </div>`;

  wrap.innerHTML = `
    <div class="adc-rpt-header">
      <div class="adc-rpt-title">AI DATA CENTER 工程計算書</div>
      <div class="adc-rpt-meta">專案：${projName}　機房：${roomName}　計算日期：${dateStr}</div>
    </div>
    <div class="adc-rpt-grid">
      <div class="adc-rpt-sec">
        <div class="adc-rpt-sec-title">ADC-01 · IT 熱負荷估算</div>
        ${row('機架數量',       racks,              '架')}
        ${row('功率密度',       density,            'kW/架')}
        ${row('UPS 損失率',     (upsPct*100).toFixed(1), '%')}
        ${row('PDU 損失率',     (pduPct*100).toFixed(1), '%')}
        ${row('純 IT 負荷',     itLoad.toFixed(1),  'kW')}
        ${row('UPS+PDU 損失',   (upsLoss+pduLoss).toFixed(1), 'kW')}
        ${row('總 IT 側負荷',   totalIT.toFixed(1), 'kW', 'hi')}
      </div>
      <div class="adc-rpt-sec">
        <div class="adc-rpt-sec-title">ADC-02 · 冷卻方式建議</div>
        ${row('分析功率密度', d2, 'kW/架')}
        <div class="adc-rpt-row"><span class="adc-rpt-lbl">建議冷卻方式</span></div>
        <div class="adc-rpt-method" style="color:${coolColor}">${method}</div>
        ${row('預期 PUE 範圍',  pueRange, '')}
        <div class="adc-rpt-note">${note2}</div>
      </div>
      <div class="adc-rpt-sec">
        <div class="adc-rpt-sec-title">ADC-03 · PUE / DCiE</div>
        ${row('IT 設備功耗',   it3.toFixed(1),       'kW')}
        ${row('冷卻系統功耗',  cool3.toFixed(1),     'kW')}
        ${row('照明+辦公',     light3.toFixed(1),    'kW')}
        ${row('其他雜項',      other3.toFixed(1),    'kW')}
        ${row('設施總功耗',    totalFac.toFixed(1),  'kW')}
        ${row('PUE',          pue  ? pue.toFixed(3)  : '未計算', '', gradeCls)}
        ${row('DCiE',         dcie ? dcie.toFixed(1) : '未計算', '%', gradeCls)}
        <div class="adc-rpt-row"><span class="adc-rpt-lbl">效能評級</span>
          <span class="adc-rpt-val ${gradeCls}" style="color:${gradeColor};font-size:.78rem">${grade}</span>
        </div>
      </div>
      <div class="adc-rpt-sec">
        <div class="adc-rpt-sec-title">ADC-04 · 液冷 CHW 需求</div>
        ${row('IT 總熱負荷',   it4.toFixed(1),      'kW')}
        ${row('液冷帶走比例',  (ratio4*100).toFixed(0), '%')}
        ${row('供水溫度 Ts',   ts4,                 '°C')}
        ${row('回水溫度 Tr',   tr4,                 '°C')}
        ${row('液冷側熱量',    liquidQ.toFixed(1),  'kW')}
        ${row('殘餘空冷熱量',  airQ.toFixed(1),     'kW')}
        ${row('冷卻水流量',    flowM3h ? flowM3h.toFixed(2) : '—', 'm³/h', 'hi')}
        ${row('冷卻水流量',    flowLm  ? flowLm.toFixed(1)  : '—', 'L/min', 'hi')}
      </div>
    </div>
    <div class="adc-rpt-print-bar">
      <button class="adc-rpt-print-btn" onclick="window.print()">🖨 列印 / 匯出 PDF</button>
    </div>`;
}

function printADCReport() {
  genADCReport();
  setTimeout(() => window.print(), 200);
}

// ════════════════════════════════════════════════════════════
// 公式換算器 (Unit Converter) — 卡片 06
// ════════════════════════════════════════════════════════════
const CONV = [
  // 負荷/流量換算：冷負荷(RT/kW/BTU) ↔ 風量(Air, ΔT10°C) ↔ 水流量(Water, ΔT 可調)
  { icon: '🧊', name: '負荷/流量換算', special: 'loadflow', dtDefault: 5,
    units: [['美制冷凍噸 (US RT)', 3.5169], ['千瓦 (kW)', 1], ['BTU/hr', 0.00029307],
            ['風量 CMH (Air)', 0.00334972], ['風量 CFM (Air)', 0.00569117],
            ['流量 LPM (Water)', 'w_lpm'], ['流量 GPM (Water)', 'w_gpm']],
    rot: ['1 RT ≈ 2.4 GPM (ΔT 5.56°C)', '1 kW ≈ 0.172 m³/h CHW (ΔT5°C)', '風量以 Δt 10°C、標準空氣計'] },
  { icon: '❄️', name: '冷凍噸/功率',
    units: [['千瓦 (kW)', 1], ['美制冷凍噸 (RT)', 3.517], ['仟卡/時 (kcal/h)', 0.001163], ['英熱單位/時 (BTU/h)', 0.00029307], ['馬力 (HP)', 0.7457]],
    rot: ['1 RT = 3.517 kW = 12,000 BTU/h', '1 RT = 3,024 kcal/h'] },
  { icon: '💨', name: '風量/流量',
    units: [['每時立方公尺 (CMH · m³/h)', 1], ['每分立方公尺 (CMM · m³/min)', 60], ['立方英呎/分 (CFM · ft³/min)', 1.69901],
            ['公升/秒 (l/s)', 3.6], ['公升/分 (LPM)', 0.06], ['美制加侖/分 (GPM)', 0.227125], ['英制加侖/分 (UK GPM)', 0.272765]],
    rot: ['1 CMM ≈ 1.7 CMH', '1 GPM ≈ 3.785 LPM', '1 CFM = 1.699 CMH'] },
  { icon: '⬛', name: '面積',
    units: [['平方公尺 (m²)', 1], ['平方公分 (cm²)', 0.0001], ['平方公釐 (mm²)', 0.000001], ['平方英呎 (ft²)', 0.092903], ['平方英吋 (in²)', 0.00064516], ['坪', 3.30579]],
    rot: ['1 坪 = 3.306 m²', '1 m² = 10.764 ft²'] },
  { icon: '🌡️', name: '溫度', special: 'temp',
    units: [['攝氏 (°C)', 0], ['華氏 (°F)', 1], ['凱氏 (K)', 2]],
    rot: ['°F = °C × 9/5 + 32', 'K = °C + 273.15'] },
  { icon: '⏲️', name: '壓力',
    units: [['帕 (Pa)', 1], ['千帕 (kPa)', 1000], ['巴 (bar)', 100000], ['磅力/平方吋 (psi)', 6894.76], ['毫米水柱 (mmAq)', 9.80665], ['公尺水柱 (mH₂O)', 9806.65], ['毫米汞柱 (mmHg)', 133.322], ['標準大氣壓 (atm)', 101325]],
    rot: ['1 bar = 100 kPa ≈ 10.2 mH₂O ≈ 14.5 psi', '1 mmAq = 9.807 Pa'] },
  { icon: '🚀', name: '速度',
    units: [['公尺/秒 (m/s)', 1], ['公尺/分 (m/min)', 1/60], ['公里/時 (km/h)', 1/3.6], ['英呎/分 (FPM · ft/min)', 0.00508], ['英呎/秒 (ft/s)', 0.3048]],
    rot: ['1 m/s = 196.85 FPM', '1 m/s = 3.6 km/h'] },
  { icon: '📏', name: '長度',
    units: [['公尺 (m)', 1], ['公釐 (mm)', 0.001], ['公分 (cm)', 0.01], ['公里 (km)', 1000], ['英吋 (in)', 0.0254], ['英呎 (ft)', 0.3048]],
    rot: ['1 in = 25.4 mm', '1 ft = 304.8 mm'] },
  { icon: '🧱', name: '熱傳透率(U值)',
    units: [['瓦/平方公尺·度 (W/m²·K)', 1], ['仟卡/時·平方公尺·度 (kcal/h·m²·°C)', 1.163], ['英熱單位/時·平方英呎·度 (BTU/h·ft²·°F)', 5.67826]],
    rot: ['1 kcal/(h·m²·°C) = 1.163 W/(m²·K)', '1 BTU/(h·ft²·°F) = 5.678 W/(m²·K)'] },
  { icon: '⚖️', name: '質量流量',
    units: [['公斤/秒 (kg/s)', 1], ['公斤/時 (kg/h)', 1/3600], ['公斤/分 (kg/min)', 1/60], ['磅/時 (lb/h)', 0.000125998], ['磅/秒 (lb/s)', 0.453592], ['公噸/時 (t/h)', 1000/3600]],
    rot: ['1 kg/s = 3600 kg/h', '1 lb ≈ 0.454 kg'] },
];
let convCat = 0;
let convDt = 5;   // 負荷/流量換算的冰水溫差 ΔT

function convInit() {
  const cats = document.getElementById('conv-cats');
  if (!cats) return;
  cats.innerHTML = CONV.map((c, i) =>
    `<button class="conv-cat${i === 0 ? ' active' : ''}" onclick="convSelect(${i})"><span class="ci">${c.icon}</span>${c.name}</button>`).join('');
  convSelect(0);
  document.getElementById('conv-from-val').addEventListener('input', convCalc);
  document.getElementById('conv-from-unit').addEventListener('change', convCalc);
  document.getElementById('conv-to-unit').addEventListener('change', convCalc);
  document.getElementById('conv-swap').addEventListener('click', () => {
    const f = document.getElementById('conv-from-unit');
    const t = document.getElementById('conv-to-unit');
    [f.value, t.value] = [t.value, f.value];
    convCalc();
  });
}

function convSelect(i) {
  convCat = i;
  const c = CONV[i];
  document.querySelectorAll('.conv-cat').forEach((b, k) => b.classList.toggle('active', k === i));
  const opts = c.units.map((u, k) => `<option value="${k}">${u[0]}</option>`).join('');
  document.getElementById('conv-from-unit').innerHTML = opts;
  document.getElementById('conv-to-unit').innerHTML = opts;
  document.getElementById('conv-to-unit').value = Math.min(1, c.units.length - 1);
  let dtHtml = '';
  if (c.special === 'loadflow') {
    dtHtml = `<div class="conv-dt"><span class="conv-dt-lbl">冰水溫差 ΔT Water<small>用於 LPM/GPM 換算</small></span>` +
      `<span class="conv-dt-in"><input type="number" id="conv-dt-input" value="${convDt}" min="1" step="0.5" oninput="convSetDt(this.value)"><span class="unit">°C</span></span></div>`;
  }
  document.getElementById('conv-rot-chips').innerHTML =
    dtHtml + c.rot.map(r => `<span class="conv-rot-chip">${r}</span>`).join('');
  convCalc();
}

function convSetDt(v) { convDt = parseFloat(v) || 5; convCalc(); }

function convCalc() {
  const c = CONV[convCat];
  const v = parseFloat(document.getElementById('conv-from-val').value);
  const fi = +document.getElementById('conv-from-unit').value;
  const ti = +document.getElementById('conv-to-unit').value;
  const out = document.getElementById('conv-to-val');
  if (isNaN(v)) { out.textContent = '—'; return; }
  let res;
  if (c.special === 'temp') {
    let cdeg = fi === 0 ? v : fi === 1 ? (v - 32) * 5 / 9 : v - 273.15;
    res = ti === 0 ? cdeg : ti === 1 ? cdeg * 9 / 5 + 32 : cdeg + 273.15;
  } else if (c.special === 'loadflow') {
    const f = c.units.map(u => u[1] === 'w_lpm' ? 0.0697667 * convDt : u[1] === 'w_gpm' ? 0.264085 * convDt : u[1]);
    res = v * f[fi] / f[ti];
  } else {
    res = v * c.units[fi][1] / c.units[ti][1];
  }
  const abs = Math.abs(res);
  out.textContent = abs !== 0 && (abs >= 1e9 || abs < 1e-6)
    ? res.toExponential(5)
    : (+res.toFixed(abs >= 100 ? 3 : abs >= 1 ? 5 : 8)).toLocaleString('en-US', { maximumFractionDigits: 8 });
}

// ════════════════════════════════════════════════════════════
// 風管尺寸計算 (Duct Sizing · Equal Friction) — 卡片 09
// ════════════════════════════════════════════════════════════
const DS = {
  shape: 'round',
  rough: { galv: 0.00015, ss: 0.00005, pvc: 0.00001, flex: 0.003 },   // 絕對粗糙度 m
  velMax: { mau: [12, 15], sa: [6, 9], ra: [5, 7], ea: [8, 11] },     // 建議流速範圍 m/s
  stdD: [100, 125, 150, 175, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 1000, 1100, 1200, 1300, 1400, 1600, 1800, 2000],
  records: [],
};

function dsSetShape(s) {
  DS.shape = s;
  document.getElementById('ds-shape-round').classList.toggle('active', s === 'round');
  document.getElementById('ds-shape-rect').classList.toggle('active', s === 'rect');
  document.getElementById('ds-recth-group').style.display = s === 'rect' ? '' : 'none';
  dsCalc();
}

// Swamee-Jain 近似 Colebrook 摩擦係數
function dsFriction(D, v, eps) {
  if (v <= 0 || D <= 0) return 0;
  const nu = 1.51e-5;                       // 空氣動黏度 m²/s
  const Re = v * D / nu;
  if (Re < 2300) return 64 / Re;
  const f = 0.25 / Math.pow(Math.log10(eps / (3.7 * D) + 5.74 / Math.pow(Re, 0.9)), 2);
  return f;
}

function dsDP(D, Q, eps) {                  // Pa/m（圓管）
  const A = Math.PI * D * D / 4;
  const v = Q / A;
  return dsFriction(D, v, eps) / D * 1.2 * v * v / 2;
}

function dsCalc() {
  const flowRaw = parseFloat(document.getElementById('ds-flow').value) || 0;
  const unit  = document.getElementById('ds-flow-unit').value;
  const Qcmh  = unit === 'cfm' ? flowRaw * 1.699 : flowRaw;
  const Q     = Qcmh / 3600;                                  // m³/s
  const eps   = DS.rough[document.getElementById('ds-mat').value];
  const limit = parseFloat(document.getElementById('ds-fric').value) || 1.0;
  const app   = document.getElementById('ds-app').value;
  const szEl  = document.getElementById('ds-size');
  const vEl   = document.getElementById('ds-vel');
  const dpEl  = document.getElementById('ds-dp');
  const chk   = document.getElementById('ds-check');
  if (Q <= 0) { szEl.textContent = vEl.textContent = dpEl.textContent = '—'; chk.className = 'ds-check'; return; }

  let sizeTxt = '—', v = 0, dp = 0;
  if (DS.shape === 'round') {
    let chosen = DS.stdD[DS.stdD.length - 1];
    for (const Dmm of DS.stdD) {
      if (dsDP(Dmm / 1000, Q, eps) <= limit) { chosen = Dmm; break; }
    }
    const D = chosen / 1000;
    v  = Q / (Math.PI * D * D / 4);
    dp = dsDP(D, Q, eps);
    sizeTxt = 'Ø ' + chosen + ' mm';
  } else {
    const H = (parseFloat(document.getElementById('ds-recth').value) || 400) / 1000;
    // 求等效圓管徑（等摩擦），再反推寬度 W（50mm 級距）
    let De = 0.1;
    for (const Dmm of DS.stdD) { if (dsDP(Dmm / 1000, Q, eps) <= limit) { De = Dmm / 1000; break; } De = Dmm / 1000; }
    let W = H;
    for (let Wmm = 100; Wmm <= 3000; Wmm += 50) {
      const a = Wmm / 1000, b = H;
      const Deq = 1.30 * Math.pow(a * b, 0.625) / Math.pow(a + b, 0.25);
      if (Deq >= De) { W = a; break; }
      W = a;
    }
    const A = W * H;
    v = Q / A;
    // 矩形管壓損：以水力直徑近似
    const Dh = 4 * A / (2 * (W + H));
    dp = dsFriction(Dh, v, eps) / Dh * 1.2 * v * v / 2;
    sizeTxt = Math.round(W * 1000) + ' × ' + Math.round(H * 1000) + ' mm';
  }
  szEl.textContent = sizeTxt;
  vEl.textContent  = v.toFixed(2) + ' m/s';
  dpEl.textContent = dp.toFixed(2) + ' Pa/m';

  const [vLo, vHi] = DS.velMax[app];
  const pass = dp <= limit * 1.05 && v <= vHi * 1.15;
  chk.className = 'ds-check ' + (pass ? 'pass' : 'fail');
  chk.innerHTML = pass
    ? `✅ <b>工程校核：通過 (${app.toUpperCase()})</b> — 此配置完全符合 Darcy-Colebrook 物理模型，壓損保持在 ±5% 內，流速與壓損平衡良好（建議範圍 ${vLo}~${vHi} m/s）。`
    : `⚠️ <b>工程校核：注意 (${app.toUpperCase()})</b> — 流速 ${v.toFixed(1)} m/s 或壓損 ${dp.toFixed(2)} Pa/m 超出建議範圍（流速 ${vLo}~${vHi} m/s、壓損 ≤ ${limit} Pa/m），請放大尺寸或調整摩擦限制。`;
}

function dsAddRecord() {
  const name = document.getElementById('ds-name').value || '段落';
  const size = document.getElementById('ds-size').textContent;
  if (size === '—') return;
  DS.records.push({
    name,
    flow: document.getElementById('ds-flow').value + ' ' + document.getElementById('ds-flow-unit').value.toUpperCase(),
    size,
    vel: document.getElementById('ds-vel').textContent,
    dp:  document.getElementById('ds-dp').textContent,
  });
  const tb = document.querySelector('#ds-records tbody');
  tb.innerHTML = DS.records.map((r, i) =>
    `<tr><td>${r.name}</td><td class="mono">${r.flow}</td><td class="mono">${r.size}</td><td class="mono">${r.vel}</td><td class="mono">${r.dp}</td>
     <td><button class="bom-del" onclick="dsDelRecord(${i})">✕</button></td></tr>`).join('');
}
function dsDelRecord(i) {
  DS.records.splice(i, 1);
  const tb = document.querySelector('#ds-records tbody');
  tb.innerHTML = DS.records.length
    ? DS.records.map((r, k) =>
      `<tr><td>${r.name}</td><td class="mono">${r.flow}</td><td class="mono">${r.size}</td><td class="mono">${r.vel}</td><td class="mono">${r.dp}</td>
       <td><button class="bom-del" onclick="dsDelRecord(${k})">✕</button></td></tr>`).join('')
    : '<tr class="ds-empty"><td colspan="6" style="text-align:center;color:var(--text-muted)">尚無記錄</td></tr>';
}

// ════════════════════════════════════════════════════════════
// 風管鐵皮計算 (Duct Material Estimator) — 卡片 10
// ════════════════════════════════════════════════════════════
const BOM = {
  rows: [],
  // SMACNA 低壓矩形鍍鋅：最大邊 → 板厚分級
  gaugeOf(maxSide, cls) {
    const shift = cls === 'mid' ? 1 : cls === 'high' ? 2 : 0;
    const order = ['26#', '24#', '22#', '20#', '18#'];
    let g;
    if (maxSide <= 300) g = 0;
    else if (maxSide <= 750) g = 1;
    else if (maxSide <= 1350) g = 2;
    else if (maxSide <= 2100) g = 3;
    else g = 4;
    return order[Math.min(g + shift, 4)];
  },
  // kg/m²（鍍鋅）；不鏽鋼以 1.02 比重微調
  kgm2: { '26#': 4.46, '24#': 5.66, '22#': 6.86, '20#': 8.08, '18#': 10.52 },
  colors: { '18#': '#ff5a64', '20#': '#f0a430', '22#': '#e8d44d', '24#': '#5ad97b', '26#': '#35c8ff' },
  sheet37: 0.9144 * 2.1336,   // 3'×7' m²
  sheet48: 1.2192 * 2.4384,   // 4'×8' m²
};

function bomPreset(w, h) {
  document.getElementById('bom-shape').value = 'rect';
  document.getElementById('bom-w').value = w;
  document.getElementById('bom-h').value = h;
  bomShapeSync();
}

function bomShapeSync() {
  const s = document.getElementById('bom-shape').value;
  document.getElementById('bom-h-group').style.display = s === 'round' ? 'none' : '';
  document.getElementById('bom-w-lbl').textContent = s === 'round' ? '直徑 Ø (mm)' : '寬度 W (mm)';
}

function bomAdd() {
  const shape = document.getElementById('bom-shape').value;
  const w = parseFloat(document.getElementById('bom-w').value) || 0;
  const h = shape === 'round' ? 0 : (parseFloat(document.getElementById('bom-h').value) || 0);
  const l = parseFloat(document.getElementById('bom-l').value) || 0;
  const q = parseInt(document.getElementById('bom-qty').value) || 1;
  const ins = document.getElementById('bom-ins-chk').checked;
  if (!w || !l || (shape === 'rect' && !h)) return;
  BOM.rows.push({ shape, w, h, l, q, ins });
  bomRender();
}

function bomDel(i) { BOM.rows.splice(i, 1); bomRender(); }
function bomClear() { BOM.rows = []; bomRender(); }

function bomRowCalc(r, cls, flange) {
  const perim = r.shape === 'round' ? Math.PI * r.w / 1000 : 2 * (r.w + r.h) / 1000;  // m
  const lenEff = r.l + (flange ? 0.075 : 0);   // 法蘭摺接每支補 75mm
  const area = perim * lenEff * r.q;           // m²（不含損耗）
  const gauge = BOM.gaugeOf(r.shape === 'round' ? r.w : Math.max(r.w, r.h), cls);
  return { perim, area, gauge };
}

function bomRender() {
  const cls    = document.getElementById('bom-class').value;
  const mat    = document.getElementById('bom-mat').value;
  const waste  = parseFloat(document.getElementById('bom-waste').value) || 1.15;
  const flange = document.getElementById('bom-flange-chk').checked;
  const tb = document.querySelector('#bom-table tbody');

  if (!BOM.rows.length) {
    tb.innerHTML = '<tr class="bom-empty"><td colspan="10" style="text-align:center;color:var(--text-muted)">目前無資料，請由上方輸入</td></tr>';
  } else {
    tb.innerHTML = BOM.rows.map((r, i) => {
      const c = bomRowCalc(r, cls, flange);
      return `<tr><td class="mono">${i + 1}</td><td>${r.shape === 'round' ? '圓' : '矩'}</td>
        <td class="mono">${r.w}</td><td class="mono">${r.shape === 'round' ? '—' : r.h}</td>
        <td class="mono">${r.l}</td><td class="mono">${r.q}</td><td class="mono">${c.gauge}</td>
        <td class="mono">${c.area.toFixed(2)}</td><td>${r.ins ? '✓' : ''}</td>
        <td><button class="bom-del" onclick="bomDel(${i})">✕</button></td></tr>`;
    }).join('');
  }

  // 分級彙總
  const sums = {};
  let totArea = 0, totIns = 0, totW = 0;
  BOM.rows.forEach(r => {
    const c = bomRowCalc(r, cls, flange);
    totArea += c.area;
    if (r.ins) totIns += c.area;
    sums[c.gauge] = (sums[c.gauge] || 0) + c.area;
  });
  const matFactor = mat === 'ss' ? 1.02 : 1;
  document.getElementById('bom-total-area').textContent = totArea.toFixed(2);
  document.getElementById('bom-total-ins').textContent  = BOM.rows.filter(r => r.ins).length;

  const gEl = document.getElementById('bom-gauges');
  gEl.innerHTML = ['18#', '20#', '22#', '24#', '26#'].map(g => {
    const a = (sums[g] || 0) * waste;
    const s37 = a / BOM.sheet37, s48 = a / BOM.sheet48;
    const wkg = a * BOM.kgm2[g] * matFactor;
    totW += wkg;
    return `<div class="bom-gauge" style="--g-color:${BOM.colors[g]}">
      <span class="g-tag">${g}</span>
      <span class="g-area">${a.toFixed(2)} m²</span>
      <span class="g-detail">3'×7'：${Math.ceil(s37)} (${s37.toFixed(1)}) 張 ｜ 4'×8'：${Math.ceil(s48)} (${s48.toFixed(1)}) 張 ｜ ${wkg.toFixed(1)} kg</span>
    </div>`;
  }).join('');
  document.getElementById('bom-weight').textContent  = totW.toFixed(0);
  document.getElementById('bom-insarea').textContent = (totIns * waste).toFixed(2);
}

function bomExportCSV() {
  if (!BOM.rows.length) return;
  const cls    = document.getElementById('bom-class').value;
  const flange = document.getElementById('bom-flange-chk').checked;
  const proj   = document.getElementById('bom-proj').value || 'duct-bom';
  let csv = '#,形狀,W(mm),H(mm),L(m),數量,板厚,面積(m2),保溫\n';
  BOM.rows.forEach((r, i) => {
    const c = bomRowCalc(r, cls, flange);
    csv += `${i + 1},${r.shape},${r.w},${r.shape === 'round' ? '' : r.h},${r.l},${r.q},${c.gauge},${c.area.toFixed(2)},${r.ins ? 'Y' : ''}\n`;
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
  a.download = proj + '.csv';
  a.click();
}

// ── 初始化（公式換算 + 風管工具） ──
document.addEventListener('DOMContentLoaded', () => {
  convInit();
  ['ds-flow', 'ds-fric', 'ds-recth'].forEach(id =>
    document.getElementById(id)?.addEventListener('input', dsCalc));
  ['ds-flow-unit', 'ds-app', 'ds-mat'].forEach(id =>
    document.getElementById(id)?.addEventListener('change', dsCalc));
  dsCalc();
  document.getElementById('bom-shape')?.addEventListener('change', bomShapeSync);
  ['bom-class', 'bom-mat'].forEach(id =>
    document.getElementById(id)?.addEventListener('change', bomRender));
  ['bom-waste'].forEach(id =>
    document.getElementById(id)?.addEventListener('input', bomRender));
  document.getElementById('bom-flange-chk')?.addEventListener('change', bomRender);
});

// ════════════════════════════════════════════════════════════
// 放射狀工程計算平台 Hub — 分類導覽視窗
// ════════════════════════════════════════════════════════════
// 細項格式：[中文, 英文, 分頁, 圖示]
const HUB = {
  air:   { name: '空調風系統', en: 'Air System',     color: '#1d9e75', ico: '💨',
           items: [['風量計算', 'Airflow', 'airflow', '💨'], ['風管尺寸計算', 'Duct Sizing', 'ductsize', '🌀'], ['風管鐵皮計算', 'Duct BOM', 'ductbom', '🔩']] },
  water: { name: '空調水系統', en: 'Water System',   color: '#378add', ico: '💧',
           items: [['水量計算', 'Water Flow', 'waterflow', '💧'], ['冰水管路計算', 'Chilled Water Piping', 'chwpipe', '🧊']] },
  chilled: { name: '空調冰水系統', en: 'Chilled Water System', color: '#22b8cf', ico: '❄️',
           items: [['冰水泵計算', 'CHW Pump', 'chwpump', '🌀'], ['冷卻水塔補水量', 'CT Makeup Water', 'ctmakeup', '🗼'], ['膨脹水箱選型', 'Expansion Tank', 'exptank', '🛢️']] },
  clean: { name: '潔淨室空調', en: 'Cleanroom HVAC', color: '#7f77dd', ico: '🏭',
           items: [['潔淨室空調', 'Cleanroom', 'cleanroom', '🏭']] },
  equip: { name: '空調設備',   en: 'HVAC Equipment', color: '#ba7517', ico: '❄️',
           items: [['乾式盤管 DCC', 'Dry Coil DCC', 'dcc', '❄️'], ['空調箱 AHU / MAU', 'AHU / MAU', 'mau', '🌡️']] },
  ai:    { name: 'AI Data Center', en: 'AI Data Center', color: '#639922', ico: '🤖',
           items: [['AI DC 計算書', 'AI DC Report', 'datacenter', '🤖'], ['數位孿生', 'Digital Twin', 'dctwin', '🟩']] },
  conv:  { name: '公式換算',   en: 'Unit Converter',  color: '#4a8aa0', ico: '⚖️',
           items: [['公式換算', 'Unit Converter', 'reference', '⚖️']] },
};
let hubActive = 'air';
const _lang = () => document.documentElement.getAttribute('data-lang') === 'en' ? 'en' : 'zh';
const _bi = (zh, en) => `<span class="txt-zh">${zh}</span><span class="txt-en">${en}</span>`;

function openHub(cat) {
  const c = HUB[cat];
  if (!c) return;
  // 細項只有一項 → 直接進入，不開視窗
  if (c.items.length === 1) { showTab(c.items[0][2]); return; }
  // 第一個多細項分類為起始
  hubActive = cat;
  renderHub();
  const m = document.getElementById('hub-modal');
  if (m) { m.hidden = false; document.body.style.overflow = 'hidden'; }
}
function closeHub() {
  const m = document.getElementById('hub-modal');
  if (m) { m.hidden = true; document.body.style.overflow = ''; }
}
function selectHubCat(cat) { hubActive = cat; renderHub(); }
function hubGo(tab) { closeHub(); showTab(tab); }

function renderHub() {
  const catCol = document.getElementById('hub-cat-col');
  const itemCol = document.getElementById('hub-item-col');
  if (!catCol || !itemCol) return;
  // 左欄只列出「多細項」分類（單細項直接進入，不出現在清單）
  const multiCats = Object.keys(HUB).filter(k => HUB[k].items.length > 1);
  if (!multiCats.includes(hubActive)) hubActive = multiCats[0];
  catCol.innerHTML = multiCats.map(k => {
    const c = HUB[k], on = k === hubActive;
    return `<button class="hub-cat${on ? ' on' : ''}" style="--acc:${c.color}" onclick="selectHubCat('${k}')">
      <span class="hub-cat-ico">${c.ico}</span><span>${_bi(c.name, c.en)}</span></button>`;
  }).join('');
  const c = HUB[hubActive];
  itemCol.style.setProperty('--acc', c.color);
  itemCol.innerHTML =
    `<div class="hub-item-head"><span class="hub-item-h-ico">${c.ico}</span><span>${_bi(c.name, c.en)}</span><small>${c.en}</small></div>` +
    c.items.map(([zh, en, tab, ico]) =>
      `<button class="hub-item" onclick="hubGo('${tab}')">
        <span class="hub-item-ico">${ico}</span><span class="hub-item-name">${_bi(zh, en)}</span><span class="hub-item-arr">→</span></button>`).join('');
}

// Esc 關閉視窗
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { const m = document.getElementById('hub-modal'); if (m && !m.hidden) closeHub(); }
});

// 分類列：箭頭捲動 + 拖曳滑動
function hubStripScroll(dir) {
  const s = document.getElementById('hub2-strip');
  if (s) s.scrollBy({ left: dir * 360, behavior: 'smooth' });
}
(function () {
  const s = document.getElementById('hub2-strip');
  if (!s) return;
  let down = false, sx = 0, sl = 0, moved = false;
  s.addEventListener('pointerdown', e => { down = true; moved = false; sx = e.clientX; sl = s.scrollLeft; s.classList.add('drag'); });
  s.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - sx;
    if (Math.abs(dx) > 4) moved = true;
    s.scrollLeft = sl - dx;
  });
  const end = () => { down = false; s.classList.remove('drag'); };
  s.addEventListener('pointerup', end);
  s.addEventListener('pointerleave', end);
  // 拖曳後的點擊不觸發進入視窗
  s.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); } }, true);
  // 滑鼠滾輪 → 橫向捲動
  s.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { s.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
})();

// ════════════════════════════════════════════════════════════
// 冰水管路計算 (Chilled Water Piping · Hazen-Williams)
// ════════════════════════════════════════════════════════════
const CHW = {
  // 標準管 DN(mm) → 內徑(mm)（Sch40 鋼管近似）
  sizes: [[15,15.8],[20,21.0],[25,26.6],[32,35.1],[40,40.9],[50,52.5],[65,62.7],[80,77.9],[100,102.3],[125,128.2],[150,154.1],[200,202.7],[250,254.5],[300,304.8],[350,336.6],[400,387.4],[450,438.2],[500,489.0],[600,590.6]],
  velMax: { main: 2.4, branch: 1.5, riser: 3.0 },
};
function chwCalc() {
  const raw  = parseFloat(document.getElementById('chw-flow')?.value) || 0;
  const unit = document.getElementById('chw-flow-unit')?.value || 'm3h';
  const app  = document.getElementById('chw-app')?.value || 'main';
  const C    = parseFloat(document.getElementById('chw-mat')?.value) || 140;
  const dt   = parseFloat(document.getElementById('chw-dt')?.value) || 5;
  const Qm3h = unit === 'ls' ? raw * 3.6 : unit === 'gpm' ? raw * 0.2271 : raw;
  const Q    = Qm3h / 3600;   // m³/s
  const set  = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const chk  = document.getElementById('chw-check');
  if (Q <= 0) { ['chw-dn','chw-id','chw-vel','chw-fric','chw-load'].forEach(i => set(i,'—')); if (chk) chk.className = 'ds-check'; return; }

  const vLim = CHW.velMax[app];
  let chosen = CHW.sizes[CHW.sizes.length - 1];
  for (const [dn, idmm] of CHW.sizes) {
    const D = idmm / 1000, v = Q / (Math.PI * D * D / 4);
    if (v <= vLim) { chosen = [dn, idmm]; break; }
  }
  const [dn, idmm] = chosen;
  const D = idmm / 1000;
  const v = Q / (Math.PI * D * D / 4);
  // Hazen-Williams 摩擦坡降 (m/m) → Pa/m（×9806）
  const S = 10.67 * Math.pow(Q, 1.852) / (Math.pow(C, 1.852) * Math.pow(D, 4.87));
  const paPerM = S * 9806;
  // 對應冷負荷 kW = Q(L/s) × 4.186 × ΔT
  const kw = (Qm3h * 1000 / 3600) * 4.186 * dt;

  set('chw-dn', 'DN' + dn);
  set('chw-id', idmm.toFixed(1) + ' mm');
  set('chw-vel', v.toFixed(2) + ' m/s');
  set('chw-fric', paPerM.toFixed(0) + ' Pa/m');
  set('chw-load', kw.toFixed(0) + ' kW (' + (kw / 3.517).toFixed(0) + ' RT)');

  const ok = v <= vLim * 1.02 && paPerM <= 450;
  if (chk) {
    chk.className = 'ds-check ' + (ok ? 'pass' : 'fail');
    chk.innerHTML = ok
      ? `✅ <b>校核通過</b>：DN${dn} 流速 ${v.toFixed(2)} m/s（上限 ${vLim}）、摩擦損失 ${paPerM.toFixed(0)} Pa/m，配置合理。`
      : `⚠️ <b>校核注意</b>：流速 ${v.toFixed(2)} m/s 或摩擦損失 ${paPerM.toFixed(0)} Pa/m 偏高，建議放大管徑。`;
  }
}
['chw-flow','chw-dt'].forEach(id => document.getElementById(id)?.addEventListener('input', chwCalc));
['chw-flow-unit','chw-app','chw-mat'].forEach(id => document.getElementById(id)?.addEventListener('change', chwCalc));
document.addEventListener('DOMContentLoaded', () => { if (document.getElementById('chw-flow')) chwCalc(); });

// ════════════════════════════════════════════════════════════
// 空調水系統新增計算：冰水泵 / 冷卻水塔補水 / 膨脹水箱
// ════════════════════════════════════════════════════════════
const IEC_KW = [0.37,0.55,0.75,1.1,1.5,2.2,3,3.7,4,5.5,7.5,11,15,18.5,22,30,37,45,55,75,90,110,132,160,200,250,315];
const _g = id => parseFloat(document.getElementById(id)?.value);
const _setT = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

// 冰水泵
function chwpumpCalc() {
  const Q = _g('pmp-q'), Hr = _g('pmp-h'), hu = document.getElementById('pmp-h-unit')?.value;
  const ep = (_g('pmp-effp') || 70) / 100, em = (_g('pmp-effm') || 90) / 100, mg = (_g('pmp-margin') || 0) / 100;
  if (!Q || !Hr) { ['pmp-hyd','pmp-shaft','pmp-input','pmp-motor'].forEach(i => _setT(i,'—')); return; }
  const H = hu === 'kpa' ? Hr / 9.80665 : Hr;       // kPa → m 水柱
  const hyd = 1000 * 9.81 * (Q / 3600) * H / 1000;  // kW
  const shaft = hyd / ep;
  const input = shaft / em;
  const need = input * (1 + mg);
  const motor = IEC_KW.find(k => k >= need) || Math.ceil(need);
  _setT('pmp-hyd', hyd.toFixed(2) + ' kW');
  _setT('pmp-shaft', shaft.toFixed(2) + ' kW');
  _setT('pmp-input', input.toFixed(2) + ' kW');
  _setT('pmp-motor', motor + ' kW (' + (motor / 0.7457).toFixed(1) + ' HP)');
}

// 冷卻水塔補水量
// 冷卻水塔補水量（多案例質量平衡）
const CTM = {
  cases: [
    { rt: 1000, hrf: 1.25, dt: 5, coc: 4, wind: 0.05 },
    { rt: 800,  hrf: 1.3,  dt: 5, coc: 6, wind: 0.02 },
    { rt: 500,  hrf: 1.2,  dt: 5, coc: 3, wind: 0.1 },
    { rt: 1200, hrf: 1.25, dt: 6, coc: 4, wind: 0.05 },
    { rt: 600,  hrf: 1.25, dt: 5, coc: 4, wind: 0.05 },
    { rt: 2000, hrf: 1.25, dt: 5, coc: 8, wind: 0.01 },
  ],
};
function ctmCompute(c) {
  const circ = c.rt * 3.517 * c.hrf / (4.186 * c.dt);   // 循環水量 L/s
  const evap = circ * (c.dt * 1.8) * 0.00085;           // 蒸發損失
  const wind = circ * (c.wind / 100);                   // 飛濺損失
  const blow = Math.max(evap / (c.coc - 1) - wind, 0);  // 排放損失
  const makeupA = evap + wind + blow;                   // 補給水總量 A
  const cocEq = wind > 0 ? evap / wind + 1 : 0;         // 等效濃縮倍率
  const makeupB = evap + wind;                          // 簡式補給水量 B
  const design = circ * 0.02;                           // 建議補給總水量（2% 設計）
  return { circ, evap, wind, blow, makeupA, cocEq, makeupB, design };
}
window.ctmSet = (i, f, v) => { const c = CTM.cases[i]; if (!c) return; c[f] = parseFloat(v) || 0; ctmRenderResults(); };
window.ctmAddCase = () => { if (CTM.cases.length >= 8) return; CTM.cases.push({ ...CTM.cases[CTM.cases.length - 1] }); ctmRender(); };
window.ctmDelCase = () => { if (CTM.cases.length <= 1) return; CTM.cases.pop(); ctmRender(); };
window.ctmManual = (open) => { const m = document.getElementById('ctm-modal'); if (m) { m.hidden = !open; document.body.style.overflow = open ? 'hidden' : ''; } };
function ctmRender() {
  const t = document.getElementById('ctm-table'); if (!t) return;
  const n = CTM.cases.length;
  const head = `<tr><th class="ctm-rowlbl">計算項目 / 案例</th>${CTM.cases.map((_, i) => `<th>CASE-${i + 1}</th>`).join('')}</tr>`;
  const sec = (cls, lbl) => `<tr class="ctm-sec ${cls}"><td colspan="${n + 1}">${lbl}</td></tr>`;
  const inRow = (lbl, sub, f, step) => `<tr class="ctm-in-row"><td class="ctm-rowlbl">${lbl}<small>${sub}</small></td>${CTM.cases.map((c, i) => `<td><input type="number" class="ctm-cell-in" value="${c[f]}" step="${step}" oninput="ctmSet(${i},'${f}',this.value)"></td>`).join('')}</tr>`;
  const outRow = (lbl, sub, key, cls = '') => `<tr class="ctm-out-row ${cls}"><td class="ctm-rowlbl">${lbl}<small>${sub}</small></td>${CTM.cases.map((_, i) => `<td><span id="ctm-r-${key}-${i}" class="ctm-cell-out">—</span></td>`).join('')}</tr>`;
  t.innerHTML = `<thead>${head}</thead><tbody>`
    + sec('ctm-sec-in', '輸入參數 (INPUTS)')
    + inRow('1. 冷凍主機噸數 (RT)', '冷凍噸', 'rt', '10')
    + inRow('2. 排熱係數 (HRF)', 'factor', 'hrf', '0.05')
    + inRow('3. 冷卻水溫差 ΔT', '℃', 'dt', '0.5')
    + inRow('4. 濃縮倍數 (COC)', 'cycles', 'coc', '0.5')
    + inRow('5. 飛濺水損失率 (Windage)', '%', 'wind', '0.01')
    + sec('ctm-sec-a', '計算結果 A：質量平衡 (Mass Balance)')
    + outRow('循環水量 (Circulation)', 'L/s', 'circ')
    + outRow('蒸發損失 (Evaporation)', 'L/s', 'evap')
    + outRow('飛濺損失 (Windage)', 'L/s', 'wind')
    + outRow('排放損失 (Blowdown)', 'L/s', 'blow')
    + outRow('補給水總量 (Makeup-A)', 'L/s', 'makeupA', 'ctm-emph')
    + sec('ctm-sec-b', '計算結果 B：簡便決策係數')
    + outRow('等效濃縮倍率 (COC eq)', 'Cycles', 'cocEq')
    + outRow('簡式補給水量 (Makeup-B)', 'L/s', 'makeupB')
    + sec('ctm-sec-out', '設計輸出 (DESIGN OUTPUT)')
    + outRow('建議補給總水量', 'L/s · 含 2% 設計裕度', 'design', 'ctm-design')
    + '</tbody>';
  ctmRenderResults();
}
function ctmRenderResults() {
  CTM.cases.forEach((c, i) => {
    const r = ctmCompute(c);
    const set = (k, v) => { const e = document.getElementById('ctm-r-' + k + '-' + i); if (e) e.textContent = v; };
    set('circ', r.circ.toFixed(2)); set('evap', r.evap.toFixed(3)); set('wind', r.wind.toFixed(3));
    set('blow', r.blow.toFixed(3)); set('makeupA', r.makeupA.toFixed(2));
    set('cocEq', r.cocEq.toFixed(1) + ' ×'); set('makeupB', r.makeupB.toFixed(2));
    set('design', r.design.toFixed(2));
  });
}

// 膨脹水箱（隔膜式）
const _waterRho = T => {  // 水密度 kg/m³（近似多項式，0–100°C）
  return 999.85 + 6.33e-2 * T - 8.52e-3 * T * T + 6.94e-5 * T * T * T - 3.6e-7 * T * T * T * T;
};
function exptankCalc() {
  const V = _g('exp-v'), tmin = _g('exp-tmin'), tmax = _g('exp-tmax');
  const Pi = _g('exp-pi'), Pf = _g('exp-pf');
  if (!V || tmax <= tmin || Pf <= Pi) { ['exp-rate','exp-ve','exp-af','exp-vt'].forEach(i => _setT(i,'—')); return; }
  const rate = _waterRho(tmin) / _waterRho(tmax) - 1;   // 體積膨脹率
  const Ve = V * rate;                                  // 膨脹水量 L
  const PiA = Pi + 101.3, PfA = Pf + 101.3;             // 絕對壓力
  const af = 1 - PiA / PfA;                             // 接收係數
  const Vt = Ve / af;                                   // 水箱容積 L
  _setT('exp-rate', (rate * 100).toFixed(2) + ' %');
  _setT('exp-ve', Ve.toFixed(1) + ' L');
  _setT('exp-af', af.toFixed(3));
  _setT('exp-vt', Vt.toFixed(0) + ' L (≈' + Math.ceil(Vt / 50) * 50 + ' L 級)');
}

(function bindWaterCalcs() {
  const bind = (ids, fn) => ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', fn); el.addEventListener('change', fn); }
  });
  document.addEventListener('DOMContentLoaded', () => {
    bind(['pmp-q','pmp-h','pmp-h-unit','pmp-effp','pmp-effm','pmp-margin'], chwpumpCalc);
    bind(['exp-v','exp-tmin','exp-tmax','exp-pi','exp-pf'], exptankCalc);
    if (document.getElementById('pmp-q')) chwpumpCalc();
    if (document.getElementById('exp-v')) exptankCalc();
    if (document.getElementById('ctm-table')) ctmRender();
    document.addEventListener('keydown', e => { if (e.key === 'Escape') ctmManual(false); });
  });
})();
