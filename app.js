// ── Tab Navigation ──────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');
  });
});

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
  h += `<path d="${sat}" stroke="#00a882" stroke-width="2" fill="none" clip-path="url(#cc)"/>`;
  h += `<rect x="${ml}" y="${mt}" width="${cw}" height="${ch}" fill="none" stroke="#243d5c" stroke-width="1"/>`;
  h += `<text x="${ml+cw/2}" y="${vh-5}" text-anchor="middle" fill="#6a8aa8" font-size="12" font-family="Rajdhani,sans-serif" font-weight="600">乾球溫度 (°C)</text>`;
  h += `<text x="${ml-48}" y="${mt+ch/2}" text-anchor="middle" fill="#6a8aa8" font-size="12" font-family="Rajdhani,sans-serif" font-weight="600" transform="rotate(-90,${ml-48},${mt+ch/2})">含濕量 ω (g/kg)</text>`;
  h += `<g id="psychro-target"></g>`;
  h += `<g id="psychro-process"></g>`;
  h += `<g id="psychro-pts"></g>`;
  svg.innerHTML = h;
}

function updatePsychroPoints(T1, RH1, T2, RH2) {
  const grp = document.getElementById('psychro-pts');
  if (!grp) return;
  const proc = document.getElementById('psychro-process');
  if (proc) proc.innerHTML = '';
  const w1 = Math.min(omegaFromTRH(T1, RH1) * 1000, 30);
  const w2 = Math.min(omegaFromTRH(T2, RH2) * 1000, 30);
  const x1 = PC.tx(T1), y1 = PC.ty(w1);
  const x2 = PC.tx(T2), y2 = PC.ty(w2);
  const h1 = enthalpyAir(T1, w1/1000).toFixed(1);
  const h2 = enthalpyAir(T2, w2/1000).toFixed(1);
  const lbl = (x, y, color, line1, line2) => {
    const lx = x > PC.ml + PC.cw - 110 ? x - 96 : x + 8;
    const ly = y > PC.mt + 50 ? y - 8 : y + 18;
    return `<rect x="${lx-2}" y="${ly-12}" width="94" height="29" rx="2" fill="rgba(8,13,24,.9)"/>` +
           `<text x="${lx}" y="${ly}" fill="${color}" font-size="10" font-family="Share Tech Mono,monospace">${line1}</text>` +
           `<text x="${lx}" y="${ly+13}" fill="${color}88" font-size="9" font-family="Share Tech Mono,monospace">${line2}</text>`;
  };
  grp.innerHTML =
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#f0a430" stroke-width="1.8" stroke-dasharray="7,4" opacity=".9"/>` +
    `<circle cx="${x1}" cy="${y1}" r="6" fill="#f0a430" stroke="#080d18" stroke-width="1.5"/>` +
    lbl(x1, y1, '#f0a430', `OA ${T1}°C/${RH1}%`, `h=${h1} kJ/kg`) +
    `<circle cx="${x2}" cy="${y2}" r="6" fill="#00d4aa" stroke="#080d18" stroke-width="1.5"/>` +
    lbl(x2, y2, '#00d4aa', `SA ${T2}°C/${RH2}%`, `h=${h2} kJ/kg`);
}

function updatePsychroTarget() {
  const grp = document.getElementById('psychro-target');
  if (!grp) return;
  const get = id => parseFloat(document.getElementById(id)?.value);
  const tgtT    = get('tgt-sa-t')     ?? 22;
  const tgtTtol = get('tgt-sa-t-tol') ?? 1;
  const tgtRH   = get('tgt-sa-rh')    ?? 50;
  const tgtRHtol= get('tgt-sa-rh-tol')?? 5;

  const corners = [
    [tgtT - tgtTtol, tgtRH - tgtRHtol],
    [tgtT + tgtTtol, tgtRH - tgtRHtol],
    [tgtT + tgtTtol, tgtRH + tgtRHtol],
    [tgtT - tgtTtol, tgtRH + tgtRHtol],
  ].map(([T, RH]) => {
    const wg = Math.max(0, Math.min(omegaFromTRH(T, Math.max(1, Math.min(100, RH))) * 1000, PC.wmax));
    return { x: PC.tx(T), y: PC.ty(wg) };
  });

  const pts = corners.map(c => `${c.x},${c.y}`).join(' ');
  const lx = corners[3].x + 3;
  const ly = corners[2].y - 4;
  grp.innerHTML =
    `<polygon points="${pts}" fill="rgba(0,212,170,.05)" stroke="#00d4aa" stroke-width="1.2" stroke-dasharray="4,3" clip-path="url(#cc)"/>` +
    `<text x="${lx}" y="${ly}" fill="#00d4aa" font-size="9" font-family="Share Tech Mono,monospace" opacity=".7">SA Target</text>`;
}

// ── MAU-05 3D Interactive Model ──────────────────────────────

const COMP_CATALOG = [
  { key:'g4',   label:'初效濾 G4',   cat:'filter', w:0.5,  rgb:[36,62,96]  },
  { key:'f7',   label:'中效濾 F7',   cat:'filter', w:0.5,  rgb:[46,74,112] },
  { key:'hepa', label:'高效濾 HEPA', cat:'filter', w:0.5,  rgb:[58,88,132] },
  { key:'chw',  label:'冰水盤管', cat:'chw',  w:1.8,  rgb:[0,104,145] },
  { key:'hhw',  label:'熱水盤管', cat:'hhw',  w:1.8,  rgb:[145,68,0]  },
  { key:'wash', label:'水洗段',        cat:'wash', w:2.0,  rgb:[18,58,96]  },
  { key:'fan',  label:'送風機',         cat:'fan',  w:1.6,  rgb:[24,38,60]  },
];

let mauComps = [
  { id:1, key:'g4' },
  { id:2, key:'chw' },
  { id:3, key:'fan' },
  { id:4, key:'f7' },
];
let _nid = 5;

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

// ── MAU-06/07 Coil Process ───────────────────────────────────

const COIL_TYPES = [
  { key:'chw',   label:'CHW 冰水盤管' },
  { key:'hhw',   label:'HHW 熱水盤管' },
  { key:'dx',    label:'DX 直膨' },
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
    return `<div class="cf-arrow">→</div>
<div class="flow-coil-block" id="fcb-${b.id}">
  <div class="fcb-hdr">
    <select class="fcb-select" onchange="updateCB(${b.id},'name',this.value)">${opts}</select>
    <button class="fcb-del" onclick="removeCB(${b.id})" title="刪除">✕</button>
  </div>
  <div class="fcb-field">
    <label>出口 DB</label>
    <input type="number" value="${b.outDB}" step="0.5" onchange="updateCB(${b.id},'outDB',+this.value)">
    <span>°C</span>
  </div>
  <div class="fcb-field">
    <label>出口 RH</label>
    <input type="number" value="${b.outRH}" step="1" min="0" max="100" onchange="updateCB(${b.id},'outRH',+this.value)">
    <span>%</span>
  </div>
  <div class="fcb-result" id="fcb-res-${b.id}"><div class="fcb-q">— kW</div></div>
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
    const qSign = s.dQ >= 0 ? '+' : '';
    const cls   = s.dQ >= 0 ? '' : ' heat';
    res.innerHTML =
      `<div class="fcb-q${cls}">ΔQ: ${qSign}${s.dQ.toFixed(1)} kW</div>` +
      `<div class="fcb-q${cls}" style="opacity:.7">Δw: ${(states[i].wg - s.wg).toFixed(2)} g/kg</div>`;
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
    const cls  = i === 0 ? 'sp-oa' : i === states.length - 1 ? 'sp-sa' : 'sp-mid';
    const qCls = s.dQ != null ? (s.dQ >= 0 ? ' class="q-heat"' : ' class="q-cool"') : '';
    return `<tr class="${cls}">
<td>${s.id}</td><td>${s.label}</td>
<td>${fmt(s.T,1)}</td><td>${fmt(s.RH,1)}</td>
<td>${fmt(s.wg,2)}</td><td>${fmt(s.h,1)}</td>
<td${qCls}>${signFmt(s.dQ)}</td>
<td${qCls}>${signFmt(s.dQs)}</td>
<td${qCls}>${signFmt(s.dQl)}</td>
</tr>`;
  }).join('');
  wrap.innerHTML =
    `<table class="mau-tbl"><thead><tr>
<th>節點</th><th>名稱</th>
<th>DB °C</th><th>RH %</th><th>ω g/kg</th><th>h kJ/kg</th>
<th>ΔQ kW</th><th>ΔQs kW</th><th>ΔQl kW</th>
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
    const lx  = p.px > PC.ml + PC.cw - 114 ? p.px - 106 : p.px + 8;
    const ly  = p.py > PC.mt + 50 ? p.py - 10 : p.py + 18;
    h += `<circle cx="${p.px}" cy="${p.py}" r="${isOA||isSA ? 6 : 5}" fill="${col}" stroke="#080d18" stroke-width="1.5" clip-path="url(#cc)"/>`;
    h += `<rect x="${lx-2}" y="${ly-12}" width="104" height="28" rx="2" fill="rgba(8,13,24,.9)"/>`;
    h += `<text x="${lx}" y="${ly}" fill="${col}" font-size="10" font-family="Share Tech Mono,monospace">${p.id} ${p.T.toFixed(1)}°C/${p.RH}%</text>`;
    h += `<text x="${lx}" y="${ly+13}" fill="${col}88" font-size="9" font-family="Share Tech Mono,monospace">h=${p.h.toFixed(1)} ω=${p.wg.toFixed(2)} g/kg</text>`;
  });

  grp.innerHTML = h;
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
window.addEventListener('mau3d-ready', () => window.mau3dRefresh?.(mauComps));
setTheme(localStorage.getItem('hvac-theme') || 'dark');
