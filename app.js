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

// ── CR-01 ISO 換氣需求 ────────────────────────────────────────
const ISO_ACH = { 5: [240, 360], 6: [150, 200], 7: [60, 100], 8: [5, 30] };

function calcCR1() {
  const iso = parseInt(document.getElementById('cr1-iso').value);
  const L = getVal('cr1-l'), W = getVal('cr1-w'), H = getVal('cr1-h');
  if (!L || !W || !H || L <= 0 || W <= 0 || H <= 0) return;
  const V = L * W * H;
  const [achMin, achMid] = ISO_ACH[iso];
  setResult('cr1-ach-min', achMin, 0);
  setResult('cr1-ach-mid', achMid, 0);
  setResult('cr1-q-min',   V * achMin);
}

// ── CR-02 風量分配 ────────────────────────────────────────────
function calcCR2() {
  const Qt = getVal('cr2-qt');
  const fa = getVal('cr2-fa');
  if (!Qt || fa == null || Qt <= 0) return;
  setResult('cr2-fresh',  Qt * (fa / 100));
  setResult('cr2-recirc', Qt * (1 - fa / 100));
}

// ── CR-03 冷卻負荷估算 ────────────────────────────────────────
function calcCR3() {
  const area   = getVal('cr3-area');
  const equip  = getVal('cr3-equip') || 0;
  const light  = getVal('cr3-light') || 0;
  const people = getVal('cr3-people') || 0;
  if (!area || area <= 0) return;
  const qEqp    = area   * equip  / 1000;
  const qLight  = area   * light  / 1000;
  const qPeople = people * 100    / 1000; // 100 W/人 sensible
  setResult('cr3-qeqp',    qEqp);
  setResult('cr3-qlight',  qLight);
  setResult('cr3-qpeople', qPeople, 1);
  setResult('cr3-qtotal',  qEqp + qLight + qPeople);
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

// ── Enter key triggers calc ──────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const card = e.target.closest('.calc-card');
  if (card) card.querySelector('.calc-btn')?.click();
});
