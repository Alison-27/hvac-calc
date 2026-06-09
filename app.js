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

// ── Enter key triggers calc ──────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const card = e.target.closest('.calc-card');
  if (card) card.querySelector('.calc-btn')?.click();
});
