// ── Dashboard Navigation ─────────────────────────────────────
function showDashboard() {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  const dash = document.getElementById('tab-dashboard');
  if (dash) dash.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const navBack = document.getElementById('nav-back');
  if (navBack) navBack.style.display = 'none';
  // Hide nav tab buttons on dashboard
  const nav = document.getElementById('main-nav');
  if (nav) nav.classList.add('dashboard-mode');
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
  // Show nav tab buttons when in a section
  const nav = document.getElementById('main-nav');
  if (nav) nav.classList.remove('dashboard-mode');
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
    `<circle cx="${x2}" cy="${y2}" r="6" fill="#00d4aa" stroke="#080d18" stroke-width="1.5" onclick="clickPsychroPoint(1)" style="cursor:pointer"/>` +
    `<text x="${lx2}" y="${ly2}" fill="#00d4aa" font-size="9.5" font-family="Share Tech Mono,monospace" font-weight="bold">SA</text>`;
  syncPsychroModal();
}

function updatePsychroTarget() {
  const grp = document.getElementById('psychro-target');
  if (grp) grp.innerHTML = '';
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
  const color = isOA ? '#f0a430' : isSA ? '#00d4aa' : '#60c8ff';

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

  const COLS = ['#f0a430','#60c8ff','#80e060','#e080c0','#c0a040','#80b0ff','#00d4aa','#ff8060'];
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
    const col = isOA ? '#f0a430' : isSA ? '#00d4aa' : COLS[i % COLS.length];
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
  const liquidLoad = itLoad * ratio;                        // kW
  const airLoad    = itLoad - liquidLoad;                   // kW
  const dt         = tr - ts;
  const flow_m3h   = (liquidLoad * 3600) / (4186 * dt);    // m³/h
  const flow_lmin  = flow_m3h * 1000 / 60;
  setResult('adc4-liquid', liquidLoad, 1);
  setResult('adc4-air',    airLoad,    1);
  setResult('adc4-flow',   flow_m3h,   2);
  setResult('adc4-lmin',   flow_lmin,  1);
}
