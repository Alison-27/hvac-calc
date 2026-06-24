/* ════════════════════════════════════════════════════════════
   HYDROPUZZLE PRO·V5 — 冰水管路製圖工具
   規格（介質 + 參數庫） + 製圖（可拖拉節點畫布 + 自動配 DN + 儀表板）
   ════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const FLUIDS = {
    pure: { name: '純水',       cp: 4.186, rho: 998, mu: 1.00, color: '#2563eb' },
    eg25: { name: '25% 乙二醇', cp: 3.85,  rho: 1035, mu: 2.10, color: '#0ea5a4' },
    eg33: { name: '33% 乙二醇', cp: 3.68,  rho: 1050, mu: 2.95, color: '#7c3aed' },
    eg40: { name: '40% 乙二醇', cp: 3.55,  rho: 1062, mu: 3.80, color: '#d9730d' },
  };
  const SIZES = [[15,15.8],[20,21],[25,26.6],[32,35.1],[40,40.9],[50,52.5],[65,62.7],[80,77.9],[100,102.3],[125,128.2],[150,154.1],[200,202.7],[250,254.5],[300,304.8],[350,336.6],[400,387.4]];
  const VMAX = 2.4;
  let _uid = 1;
  const uid = () => 'n' + (_uid++);

  const HP = {
    fluid: 'pure',
    templates: [
      { id: 't1', name: 'DCC 標準型機組', color: '#2563eb', kw: 49.7, dt: 5 },
      { id: 't2', name: 'MAU 大風量機組', color: '#16a34a', kw: 200, dt: 7 },
    ],
    nodes: [],
    conns: [],
    view: { zoom: 1, x: 60, y: 40 },
    copyMode: false,
    history: [], future: [],
  };
  window.HP = HP;

  // ── 計算 ──
  const tplLPM = (kw, dt) => {
    const f = FLUIDS[HP.fluid];
    const ls = kw / (f.cp * (f.rho / 1000) * dt);
    return ls * 60;
  };
  function dnFor(lpm) {
    const Q = lpm / 60000;
    if (Q <= 0) return { dn: '—', v: 0, num: 0 };
    for (const [dn, idmm] of SIZES) {
      const D = idmm / 1000, v = Q / (Math.PI * D * D / 4);
      if (v <= VMAX) return { dn: 'DN' + dn, v, num: dn };
    }
    const [dn, idmm] = SIZES[SIZES.length - 1];
    const D = idmm / 1000;
    return { dn: 'DN' + dn, v: Q / (Math.PI * D * D / 4), num: dn };
  }
  // 節點流量（equip 自身；header/zone 彙整上游）
  function nodeFlow(id, seen) {
    seen = seen || new Set();
    if (seen.has(id)) return 0;
    seen.add(id);
    const n = HP.nodes.find(x => x.id === id);
    if (!n) return 0;
    let flow = 0;
    if (n.type === 'equip') {
      const t = HP.templates.find(x => x.id === n.tplId);
      flow = t ? tplLPM(t.kw, t.dt) * (n.qty || 1) : 0;
    }
    HP.conns.filter(c => c.to === id).forEach(c => { flow += nodeFlow(c.from, seen); });
    return flow;
  }

  // ── 歷史 ──
  const snapshot = () => JSON.stringify({ nodes: HP.nodes, conns: HP.conns, templates: HP.templates, fluid: HP.fluid });
  function pushHistory() { HP.history.push(snapshot()); if (HP.history.length > 50) HP.history.shift(); HP.future = []; }
  function restore(s) { const d = JSON.parse(s); HP.nodes = d.nodes; HP.conns = d.conns; HP.templates = d.templates; HP.fluid = d.fluid; renderAll(); }
  window.hpUndo = () => { if (!HP.history.length) return; HP.future.push(snapshot()); restore(HP.history.pop()); };
  window.hpRedo = () => { if (!HP.future.length) return; HP.history.push(snapshot()); restore(HP.future.pop()); };

  // ── 規格：介質 + 參數庫 ──
  window.hpSetFluid = (f) => { pushHistory(); HP.fluid = f; renderSpec(); renderCanvas(); updateDash(); syncFluidSel(); };
  function syncFluidSel() {
    const sel = document.getElementById('hp-fluid-sel');
    if (sel) { sel.innerHTML = Object.keys(FLUIDS).map(k => `<option value="${k}">${FLUIDS[k].name}</option>`).join(''); sel.value = HP.fluid; }
  }
  function renderSpec() {
    const f = FLUIDS[HP.fluid];
    const btns = document.getElementById('hp-fluid-btns');
    if (btns) btns.innerHTML = Object.keys(FLUIDS).map(k =>
      `<button class="hp-fluid-btn${k === HP.fluid ? ' on' : ''}" onclick="hpSetFluid('${k}')">${FLUIDS[k].name}</button>`).join('');
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('hp-cp', f.cp.toFixed(3)); set('hp-rho', f.rho); set('hp-mu', f.mu.toFixed(2));
    const col = document.getElementById('hp-lpm-col'); if (col) col.textContent = `LPM (${f.name})`;
    const body = document.getElementById('hp-tpl-body');
    if (body) body.innerHTML = HP.templates.map(t => {
      const lpm = tplLPM(t.kw, t.dt);
      return `<tr>
        <td><input class="hp-tpl-name" value="${t.name}" onchange="hpTplEdit('${t.id}','name',this.value)"></td>
        <td><input type="color" class="hp-tpl-color" value="${t.color}" onchange="hpTplEdit('${t.id}','color',this.value)"></td>
        <td><input type="number" class="hp-tpl-num" value="${t.kw}" step="0.1" onchange="hpTplEdit('${t.id}','kw',this.value)"></td>
        <td><input type="number" class="hp-tpl-num" value="${t.dt}" step="0.5" onchange="hpTplEdit('${t.id}','dt',this.value)"></td>
        <td class="hp-tpl-lpm">${lpm.toFixed(1)}</td>
        <td><button class="hp-tpl-del" onclick="hpDelTemplate('${t.id}')">🗑</button></td>
      </tr>`;
    }).join('');
    renderLibTpls();
  }
  window.hpTplEdit = (id, k, v) => {
    const t = HP.templates.find(x => x.id === id); if (!t) return;
    pushHistory();
    t[k] = (k === 'kw' || k === 'dt') ? parseFloat(v) || 0 : v;
    renderSpec(); renderCanvas(); updateDash();
  };
  window.hpAddTemplate = () => { pushHistory(); HP.templates.push({ id: 'tpl' + uid(), name: '新機組', color: '#f59e0b', kw: 50, dt: 5 }); renderSpec(); };
  window.hpDelTemplate = (id) => { pushHistory(); HP.templates = HP.templates.filter(x => x.id !== id); HP.nodes = HP.nodes.filter(n => n.tplId !== id); HP.conns = HP.conns.filter(c => HP.nodes.find(n => n.id === c.from) && HP.nodes.find(n => n.id === c.to)); renderSpec(); renderCanvas(); updateDash(); };
  function renderLibTpls() {
    const wrap = document.getElementById('hp-lib-tpls');
    if (!wrap) return;
    wrap.innerHTML = HP.templates.map(t =>
      `<button class="hp-lib-tpl" style="--c:${t.color}" onclick="hpAddNode('equip','${t.id}')">
        <span class="hp-lib-tpl-bar"></span>
        <span class="hp-lib-tpl-name">${t.name}</span>
        <span class="hp-lib-tpl-kw">${t.kw} KW</span></button>`).join('');
  }

  // ── 視圖切換 ──
  window.hpView = (v) => {
    document.querySelectorAll('.hp-navbtn').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    document.getElementById('hp-spec').hidden = v !== 'spec';
    document.getElementById('hp-draw').hidden = v !== 'draw';
    if (v === 'draw') { renderCanvas(); updateDash(); }
  };
  window.hpToggleCopy = () => { HP.copyMode = !HP.copyMode; document.getElementById('hp-copy-mode')?.classList.toggle('on', HP.copyMode); };

  // ── 新增節點 ──
  window.hpAddNode = (type, tplId) => {
    pushHistory();
    const c = document.getElementById('hp-canvas-wrap');
    const cx = (c.clientWidth / 2 - HP.view.x) / HP.view.zoom - 110;
    const cy = (c.clientHeight / 2 - HP.view.y) / HP.view.zoom - 60;
    const jitter = HP.nodes.length * 12 % 80;
    const node = { id: uid(), type, x: cx + jitter, y: cy + jitter };
    if (type === 'header') { node.title = '主總管彙整中心'; node.color = '#f59e0b'; }
    else if (type === 'zone') { node.title = '區域分區 A'; node.color = '#dc2626'; }
    else if (type === 'equip') { const t = HP.templates.find(x => x.id === tplId); node.tplId = tplId; node.title = t ? t.name : '機組'; node.color = t ? t.color : '#2563eb'; node.qty = 1; }
    HP.nodes.push(node);
    renderCanvas(); updateDash();
  };
  window.hpDelNode = (id) => { pushHistory(); HP.nodes = HP.nodes.filter(n => n.id !== id); HP.conns = HP.conns.filter(c => c.from !== id && c.to !== id); renderCanvas(); updateDash(); };
  window.hpQty = (id, d) => { const n = HP.nodes.find(x => x.id === id); if (!n) return; pushHistory(); n.qty = Math.max(1, (n.qty || 1) + d); renderCanvas(); updateDash(); };

  // ── 畫布渲染 ──
  const canvas = () => document.getElementById('hp-canvas');
  const svg = () => document.getElementById('hp-conn-svg');
  function applyTransform() {
    const c = canvas();
    if (c) c.style.transform = `translate(${HP.view.x}px,${HP.view.y}px) scale(${HP.view.zoom})`;
    const z = document.getElementById('hp-zoom-val'); if (z) z.textContent = Math.round(HP.view.zoom * 100) + '%';
  }
  function nodeHTML(n) {
    const flow = nodeFlow(n.id);
    const dn = dnFor(flow);
    const dnCls = dn.v > 2.4 ? 'g4' : dn.v > 1.8 ? 'g3' : 'g2';
    if (n.type === 'equip') {
      return `<div class="hp-node hp-n-equip" data-id="${n.id}" style="left:${n.x}px;top:${n.y}px">
        <div class="hp-node-head" style="--hc:${n.color}"><span class="hp-drag-h">${n.title}</span><button class="hp-node-del" onclick="hpDelNode('${n.id}')">🗑</button></div>
        <div class="hp-node-body">
          <div class="hp-nrow"><span>QTY</span><span class="hp-qty"><button onclick="hpQty('${n.id}',-1)">-</button><b>${n.qty}</b><button onclick="hpQty('${n.id}',1)">+</button></span></div>
          <div class="hp-nrow"><span>FLOW</span><b class="hp-flow">${flow.toFixed(0)} <small>LPM</small></b></div>
          <div class="hp-nrow"><span>SIZE</span><b class="hp-dn ${dnCls}">${dn.dn}</b></div>
        </div>
        <span class="hp-anchor hp-in" data-id="${n.id}"></span><span class="hp-anchor hp-out" data-id="${n.id}"></span></div>`;
    }
    // header / zone
    const isHeader = n.type === 'header';
    return `<div class="hp-node hp-n-${n.type}" data-id="${n.id}" style="left:${n.x}px;top:${n.y}px">
      <div class="hp-node-head" style="--hc:${n.color}"><span class="hp-drag-h hp-edit" data-nid="${n.id}" ondblclick="hpEditTitle(this)">${n.title}</span><button class="hp-node-del" onclick="hpDelNode('${n.id}')">🗑</button></div>
      <div class="hp-node-body hp-zone-body">
        <div class="hp-zrow"><span>${isHeader ? 'SYSTEM SUM' : 'BRANCH FLOW'}</span><b class="hp-flow-big">${flow.toFixed(0)} <small>LPM</small></b></div>
        <div class="hp-zrow hp-match"><span>MATCH DN</span><b class="hp-dn-pill ${dnCls}">${dn.dn}</b></div>
      </div>
      <span class="hp-anchor hp-in" data-id="${n.id}"></span><span class="hp-anchor hp-out" data-id="${n.id}"></span></div>`;
  }
  function renderCanvas() {
    const c = canvas(); if (!c) return;
    let s = svg();
    c.innerHTML = '';
    c.appendChild(s);           // SVG 在底層
    s.innerHTML = '';
    HP.nodes.forEach(n => c.insertAdjacentHTML('beforeend', nodeHTML(n)));
    applyTransform();
    drawConns();
    bindNodeDrag();
  }
  function anchorPos(id, side) {
    const n = HP.nodes.find(x => x.id === id); if (!n) return { x: 0, y: 0 };
    const el = canvas().querySelector(`.hp-node[data-id="${id}"]`);
    const w = el ? el.offsetWidth : 220, h = el ? el.offsetHeight : 120;
    return { x: n.x + (side === 'out' ? w : 0), y: n.y + h / 2 };
  }
  function drawConns() {
    const s = svg(); if (!s) return;
    let max = 2400;
    s.setAttribute('width', max); s.setAttribute('height', 1600);
    s.innerHTML = HP.conns.map(cn => {
      const a = anchorPos(cn.from, 'out'), b = anchorPos(cn.to, 'in');
      const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
      return `<path d="M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}" class="hp-conn-path"/>
              <circle cx="${a.x}" cy="${a.y}" r="4" class="hp-conn-dot"/><circle cx="${b.x}" cy="${b.y}" r="4" class="hp-conn-dot"/>`;
    }).join('');
  }
  window.hpTitle = (id, t) => { const n = HP.nodes.find(x => x.id === id); if (n) { n.title = t.trim() || n.title; } };
  window.hpEditTitle = (el) => {
    el.contentEditable = 'true'; el.focus();
    const done = () => { el.contentEditable = 'false'; const n = HP.nodes.find(x => x.id === el.dataset.nid); if (n) n.title = el.textContent.trim() || n.title; el.removeEventListener('blur', done); };
    el.addEventListener('blur', done);
  };

  // ── 拖拉節點 / 連線 / 平移 / 縮放 ──
  let drag = null, connFrom = null;
  function bindNodeDrag() {
    canvas().querySelectorAll('.hp-node').forEach(el => {
      const id = el.dataset.id;
      const head = el.querySelector('.hp-drag-h');
      head.addEventListener('pointerdown', e => {
        if (head.isContentEditable) return;
        e.stopPropagation();
        const n = HP.nodes.find(x => x.id === id);
        if (HP.copyMode) { pushHistory(); const cp = JSON.parse(JSON.stringify(n)); cp.id = uid(); cp.x += 30; cp.y += 30; HP.nodes.push(cp); renderCanvas(); return; }
        pushHistory();
        drag = { id, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y };
        el.classList.add('dragging');
      });
      el.querySelectorAll('.hp-anchor').forEach(an => {
        an.addEventListener('pointerdown', e => {
          e.stopPropagation();
          connFrom = an.classList.contains('hp-out') ? id : null;
          if (an.classList.contains('hp-in')) connFrom = null; // 由 out 起接
          if (!connFrom && an.classList.contains('hp-in')) connFrom = { in: id };
          connFrom = an.classList.contains('hp-out') ? id : { in: id };
        });
        an.addEventListener('pointerup', e => {
          e.stopPropagation();
          if (connFrom == null) return;
          const target = id;
          let from, to;
          if (typeof connFrom === 'string') { from = connFrom; to = target; }
          else { from = target; to = connFrom.in; }
          if (from && to && from !== to && !HP.conns.find(c => c.from === from && c.to === to)) {
            pushHistory(); HP.conns.push({ id: uid(), from, to }); renderCanvas(); updateDash();
          }
          connFrom = null;
        });
      });
    });
  }
  const wrap = () => document.getElementById('hp-canvas-wrap');
  function initCanvasEvents() {
    const w = wrap(); if (!w || w._hpBound) return; w._hpBound = true;
    w.addEventListener('pointerdown', e => {
      if (e.target.closest('.hp-node') || e.target.closest('.hp-zoom-panel') || e.target.closest('.hp-dash')) return;
      drag = { pan: true, sx: e.clientX, sy: e.clientY, ox: HP.view.x, oy: HP.view.y };
    });
    window.addEventListener('pointermove', e => {
      if (!drag) return;
      if (drag.pan) { HP.view.x = drag.ox + (e.clientX - drag.sx); HP.view.y = drag.oy + (e.clientY - drag.sy); applyTransform(); }
      else if (drag.id) {
        const n = HP.nodes.find(x => x.id === drag.id); if (!n) return;
        n.x = drag.ox + (e.clientX - drag.sx) / HP.view.zoom;
        n.y = drag.oy + (e.clientY - drag.sy) / HP.view.zoom;
        const el = canvas().querySelector(`.hp-node[data-id="${drag.id}"]`);
        if (el) { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
        drawConns();
      }
    });
    window.addEventListener('pointerup', () => {
      if (drag && drag.id) canvas().querySelector(`.hp-node[data-id="${drag.id}"]`)?.classList.remove('dragging');
      drag = null;
    });
    w.addEventListener('wheel', e => {
      e.preventDefault();
      const r = w.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const old = HP.view.zoom;
      const nz = Math.min(2, Math.max(0.3, old * (e.deltaY < 0 ? 1.1 : 0.9)));
      HP.view.x = mx - (mx - HP.view.x) * (nz / old);
      HP.view.y = my - (my - HP.view.y) * (nz / old);
      HP.view.zoom = nz; applyTransform(); drawConns();
    }, { passive: false });
  }
  window.hpFit = () => {
    if (!HP.nodes.length) { HP.view = { zoom: 1, x: 60, y: 40 }; applyTransform(); drawConns(); return; }
    const xs = HP.nodes.map(n => n.x), ys = HP.nodes.map(n => n.y);
    const minX = Math.min(...xs) - 40, maxX = Math.max(...xs) + 280;
    const minY = Math.min(...ys) - 40, maxY = Math.max(...ys) + 200;
    const w = wrap();
    const z = Math.min(1.4, Math.max(0.35, Math.min(w.clientWidth / (maxX - minX), w.clientHeight / (maxY - minY))));
    HP.view.zoom = z; HP.view.x = -minX * z + (w.clientWidth - (maxX - minX) * z) / 2; HP.view.y = -minY * z + 30;
    applyTransform(); drawConns();
  };

  // ── 儀表板 ──
  function updateDash() {
    const f = FLUIDS[HP.fluid];
    const equip = HP.nodes.filter(n => n.type === 'equip');
    const totalLPM = equip.reduce((s, n) => { const t = HP.templates.find(x => x.id === n.tplId); return s + (t ? tplLPM(t.kw, t.dt) * (n.qty || 1) : 0); }, 0);
    let maxDN = 0;
    HP.nodes.forEach(n => { const d = dnFor(nodeFlow(n.id)); if (d.num > maxDN) maxDN = d.num; });
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.innerHTML = v; };
    set('hp-d-fluid', f.name);
    set('hp-d-flow', totalLPM.toFixed(0) + ' <small>LPM</small>');
    set('hp-d-dn', maxDN ? 'DN' + maxDN : '—');
    set('hp-d-count', HP.nodes.length + ' <small>個</small>');
    const save = document.getElementById('hp-zoom-save');
    if (save) { const d = new Date(); save.textContent = '最後儲存路徑 ' + (d.getMonth() + 1).toString().padStart(2, '0') + '/' + d.getDate().toString().padStart(2, '0') + ' ' + d.toTimeString().slice(0, 5); }
  }

  // ── 匯入 / 匯出 ──
  window.hpExportJSON = () => {
    const data = { fluid: HP.fluid, templates: HP.templates, nodes: HP.nodes, conns: HP.conns };
    dl(JSON.stringify(data, null, 2), 'hydropuzzle.json', 'application/json');
  };
  window.hpExportCSV = () => {
    let csv = '節點,類型,流量(LPM),管徑\n';
    HP.nodes.forEach(n => { const fl = nodeFlow(n.id); csv += `${(n.title || '機組').replace(/,/g, ' ')},${n.type},${fl.toFixed(0)},${dnFor(fl).dn}\n`; });
    dl('﻿' + csv, 'hydropuzzle.csv', 'text/csv');
  };
  window.hpExportHTML = () => {
    const rows = HP.nodes.map(n => { const fl = nodeFlow(n.id); return `<tr><td>${n.title || '機組'}</td><td>${n.type}</td><td>${fl.toFixed(0)} LPM</td><td>${dnFor(fl).dn}</td></tr>`; }).join('');
    const html = `<!doctype html><meta charset="utf-8"><title>HydroPuzzle 冰水管路計算</title>
<style>body{font-family:sans-serif;padding:24px}h1{color:#2563eb}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px}</style>
<h1>冰水管路計算 — HydroPuzzle</h1><p>介質：${FLUIDS[HP.fluid].name}　系統總流量：${HP.nodes.filter(n=>n.type==='equip').reduce((s,n)=>{const t=HP.templates.find(x=>x.id===n.tplId);return s+(t?tplLPM(t.kw,t.dt)*(n.qty||1):0)},0).toFixed(0)} LPM</p>
<table><thead><tr><th>節點</th><th>類型</th><th>流量</th><th>管徑</th></tr></thead><tbody>${rows}</tbody></table>`;
    dl(html, 'hydropuzzle.html', 'text/html');
  };
  window.hpImport = () => document.getElementById('hp-file')?.click();
  window.hpImportFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => { try { const d = JSON.parse(r.result); pushHistory(); HP.fluid = d.fluid || 'pure'; HP.templates = d.templates || HP.templates; HP.nodes = d.nodes || []; HP.conns = d.conns || []; renderAll(); } catch (err) { alert('匯入失敗：JSON 格式錯誤'); } };
    r.readAsText(file); e.target.value = '';
  };
  function dl(content, name, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name; a.click();
  }

  function renderAll() { syncFluidSel(); renderSpec(); renderCanvas(); updateDash(); }

  // ── 範例 ──
  function seed() {
    HP.nodes = [
      { id: 'h1', type: 'header', title: '主總管彙整中心', color: '#f59e0b', x: 80, y: 230 },
      { id: 'z1', type: 'zone', title: '區域分區 A', color: '#dc2626', x: 380, y: 60 },
      { id: 'e1', type: 'equip', tplId: 't2', title: 'MAU 大風量機組', color: '#16a34a', qty: 1, x: 720, y: 90 },
      { id: 'e2', type: 'equip', tplId: 't1', title: 'DCC 標準型機組', color: '#2563eb', qty: 6, x: 720, y: 300 },
      { id: 'e3', type: 'equip', tplId: 't1', title: 'DCC 標準型機組', color: '#2563eb', qty: 1, x: 430, y: 360 },
    ];
    HP.conns = [
      { id: 'c1', from: 'e1', to: 'z1' }, { id: 'c2', from: 'z1', to: 'h1' },
      { id: 'c3', from: 'e2', to: 'h1' }, { id: 'c4', from: 'e3', to: 'h1' },
    ];
  }

  function init() {
    const root = document.getElementById('tab-chwpipe');
    if (!root || root._hpInit) return;
    root._hpInit = true;
    seed();
    initCanvasEvents();
    renderAll();
  }
  // 分頁顯示時才初始化（避免量測尺寸為 0）
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('tab-chwpipe');
    if (!root) return;
    new MutationObserver(() => { if (root.classList.contains('active')) { init(); setTimeout(() => { renderCanvas(); }, 60); } })
      .observe(root, { attributes: true, attributeFilter: ['class'] });
    if (root.classList.contains('active')) init();
  });
})();
