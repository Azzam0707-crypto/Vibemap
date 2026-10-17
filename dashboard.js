function badgeFor(changeType) {
  if (changeType === 'added') return { icon: '+', tint: '#dce1ff', badge: 'New', badgeBg: '#dce1ff', badgeFg: '#0041ca' };
  if (changeType === 'deleted') return { icon: '×', tint: '#f6dede', badge: 'Removed', badgeBg: '#f6dede', badgeFg: '#b3261e' };
  if (changeType === 'modified') return { icon: '~', tint: '#dfe2ee', badge: 'Wired', badgeBg: '#dfe2ee', badgeFg: '#5a5e68' };
  return { icon: '•', tint: '#efedf1', badge: 'File', badgeBg: '#efedf1', badgeFg: '#434655' };
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function el(tag, style, text) {
  const e = document.createElement(tag);
  if (style) e.setAttribute('style', style);
  if (text !== undefined) e.textContent = text;
  return e;
}

const CHANGE_LIST_CAP = 5;

function renderChanges(list, byChange) {
  const wrap = document.getElementById('changeList');
  wrap.innerHTML = '';
  document.getElementById('changeCount').textContent = list.length + ' changes';
  const shown = list.length > CHANGE_LIST_CAP ? list.slice(0, CHANGE_LIST_CAP) : list;
  for (const item of shown) {
    wrap.appendChild(changeRow(item, byChange));
  }
  let btn = document.getElementById('seeAllBtn');
  if (btn) btn.remove();
  if (list.length > CHANGE_LIST_CAP) {
    btn = el('button', 'padding:10px 20px;border:1px solid #d8dbe4;border-radius:8px;background:#ffffff;color:#2e5ce6;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit', 'See all file information');
    btn.id = 'seeAllBtn';
    btn.addEventListener('click', () => {
      for (const item of list.slice(CHANGE_LIST_CAP)) {
        wrap.appendChild(changeRow(item, byChange));
      }
      btn.remove();
    });
    wrap.parentNode.appendChild(btn);
  }
}

function changeRow(item, byChange) {
  const b = badgeFor(byChange.get(item.filePath));
  const row = el('div', 'display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-top:1px solid #f4f3f7');
  row.className = 'change-item';
  row.setAttribute('data-path', item.filePath);
  row.appendChild(el('span', `width:28px;height:28px;border-radius:8px;background:${b.tint};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px`, b.icon));
  const mid = el('div', 'display:flex;flex-direction:column;gap:2px;min-width:0');
  mid.appendChild(el('span', 'font-size:14px;font-weight:600', shortName(item.filePath)));
  mid.appendChild(el('span', 'font-size:13px;color:#434655', item.summary));
  row.appendChild(mid);
  row.appendChild(el('span', `margin-left:auto;font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;background:${b.badgeBg};color:${b.badgeFg};flex-shrink:0`, b.badge));
  return row;
}

function shortName(filePath) {
  const base = String(filePath).split('/').pop();
  const role = ROLE_BY_BASENAME[base.toLowerCase()];
  return role ? base + ' — ' + role : base;
}

const ROLE_BY_BASENAME = {
  'index.js': 'entry point, starts the app',
  'main.js': 'entry point, starts the app',
  'app.js': 'main screen setup',
  'dashboard.js': 'renderer, draws the Project Map and Settings UI',
  'scanner.js': 'reads files from your folder',
  'parser.js': 'finds functions and imports in code',
  'diagram.js': 'lays out the Project Map',
  'summarizer.js': 'talks to the AI service',
  'analyze.js': 'runs the full scan pipeline',
  'provider-config.js': 'remembers your AI settings',
  'history.js': 'remembers your recent scans',
  'models.js': 'fetches available AI models',
  'main.js': 'opens the app window',
  'preload.js': 'connects the window to the app',
};

const ENTRY_FILES = new Set(['index.js', 'index.jsx', 'index.ts', 'index.tsx', 'main.js', 'main.jsx', 'main.ts', 'main.tsx', 'app.js', 'app.jsx', 'app.ts', 'app.tsx', 'server.js', 'app.py', 'main.py', 'server.py']);

let mapJsplumb = null;
let mapZoom = 1;
let mapChangesByPath = new Map();
let mapSummaryByPath = new Map();

function fileIcon(bg) {
  return `<span style="width:22px;height:22px;border-radius:6px;background:${bg};display:flex;align-items:center;justify-content:center;flex-shrink:0"><i data-lucide="file-code" style="width:13px;height:13px;color:#ffffff"></i></span>`;
}

function applyIcons(root) {
  try {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: root || document });
    }
  } catch (e) { /* icons are decorative */ }
}

function flatDiagramFiles(diagram) {
  if (!diagram) return [];
  if (Array.isArray(diagram.nodes)) return diagram.nodes.map((n) => ({ id: n.id, name: n.label || n.id, kind: n.type || 'file', badge: 'unchanged', group: '' }));
  const out = [];
  for (const g of diagram.groups || []) for (const f of g.files) out.push({ ...f, group: g.id });
  for (const f of diagram.rootFiles || []) out.push({ ...f, group: '' });
  return out;
}

function setZoom(z) {
  mapZoom = Math.min(2, Math.max(0.25, Math.round(z * 100) / 100));
  applyMapPan();
  const label = document.getElementById('zoomLabel');
  if (label) label.textContent = Math.round(mapZoom * 100) + '%';
  if (mapJsplumb) mapJsplumb.repaintEverything();
}

function mapTooltipText(fileId, groupId) {
  const name = fileId ? String(fileId).split('/').pop() : groupId;
  let desc;
  if (fileId && mapSummaryByPath.has(fileId)) desc = mapSummaryByPath.get(fileId);
  else if (fileId && mapChangesByPath.has(fileId)) {
    const c = mapChangesByPath.get(fileId);
    desc = (c === 'added' ? 'New file' : c === 'deleted' ? 'Removed file' : 'Changed file') + ': ' + fileId;
  }
  else if (groupId) desc = 'Folder ' + groupId;
  else desc = 'No changes recorded here';
  return name + '\n' + desc;
}

function showTip(x, y, text) {
  const tip = document.getElementById('mapTip');
  const area = document.getElementById('mapArea');
  if (!tip || !area) return;
  tip.textContent = text;
  tip.style.display = 'block';
  const maxL = Math.max(8, area.clientWidth - tip.offsetWidth - 8);
  const maxT = Math.max(8, area.clientHeight - tip.offsetHeight - 8);
  tip.style.left = Math.min(Math.max(8, x), maxL) + 'px';
  tip.style.top = Math.min(Math.max(8, y), maxT) + 'px';
}

function hideTip() {
  const tip = document.getElementById('mapTip');
  if (tip) tip.style.display = 'none';
}

let tipTimer = null;
function showTipAt(e, text) {
  const area = document.getElementById('mapArea');
  if (!area) return;
  const rect = area.getBoundingClientRect();
  showTip(e.clientX - rect.left + 14, e.clientY - rect.top + 14, text);
}
function wireTooltip(card, fileId, groupId) {
  let tipText = null;
  card.addEventListener('mouseenter', (e) => {
    clearTimeout(tipTimer);
    tipText = mapTooltipText(fileId, groupId);
    tipTimer = setTimeout(() => showTipAt(e, tipText), 300);
  });
  card.addEventListener('mousemove', (e) => {
    const tip = document.getElementById('mapTip');
    if (tip && tip.style.display === 'block') showTipAt(e, tipText || mapTooltipText(fileId, groupId));
  });
  card.addEventListener('mouseleave', () => { clearTimeout(tipTimer); tipText = null; hideTip(); });
}

function flashChangeItem(key) {
  const items = [...document.querySelectorAll('.change-item')];
  const match = items.find((it) => it.getAttribute('data-path') === key)
    || items.find((it) => key.endsWith('/') && (it.getAttribute('data-path') || '').startsWith(key.slice(0, -1)));
  if (!match) return;
  const byChange = match.querySelector('span:last-child');
  const tint = (byChange && byChange.style && byChange.style.background) || '#dce1ff';
  match.classList.add('highlighted');
  match.style.background = tint;
  match.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  setTimeout(() => { match.classList.remove('highlighted'); match.style.background = ''; }, 1500);
}

function makeFileCard(f, isEntry) {
  const card = el('div', `position:absolute;width:170px;padding:10px 12px;background:#ffffff;border:${isEntry ? '1.5px solid #2e5ce6' : '1px solid #eaeae7'};border-radius:8px;display:flex;gap:10px;align-items:center;cursor:pointer${isEntry ? ';box-shadow:0 1px 3px rgba(0,0,0,.06)' : ''}`);
  card.className = 'map-file map-node';
  card.setAttribute('data-file', f.id);
  card.id = 'mf-' + f.id.replace(/[^a-zA-Z0-9]/g, '_');
  const sub = (f.group ? f.group + ' · ' : '') + (f.kind || '');
  card.innerHTML = `${fileIcon(f.badge === 'unchanged' ? '#8b8fa3' : '#2e5ce6')}<span style="display:flex;flex-direction:column;gap:1px;min-width:0"><span style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(f.name)}</span><span style="font-size:11px;color:#434655">${escapeHtml(sub)}</span></span>`;
  return card;
}

function makeGroupBox(g) {
  const n = g.files.length;
  const box = el('div', 'position:absolute;min-width:210px;background:#ffffff;border:1px solid #eaeae7;border-radius:10px;display:flex;flex-direction:column');
  box.className = 'map-group';
  box.setAttribute('data-group', g.id);
  const header = el('div', 'display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:pointer;user-select:none');
  header.className = 'map-group-header';
  header.innerHTML = `<i data-lucide="chevron-down" class="map-chevron" style="width:14px;height:14px;color:#9196a8"></i><i data-lucide="folder" style="width:14px;height:14px;color:#9196a8"></i><span style="font-size:12px;font-weight:600;color:#5a5e68;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(g.label)}</span><span class="map-group-count" style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:999px;background:#f2f2f6;color:#9196a8;flex-shrink:0">${escapeHtml(n === 1 ? '1 file' : n + ' files')}</span>`;
  const body = el('div', 'position:relative;padding:4px 12px 16px');
  body.className = 'map-group-body';
  const handle = el('div', 'position:absolute;right:2px;bottom:2px;width:16px;height:16px;cursor:nwse-resize');
  handle.className = 'map-resize';
  header.addEventListener('click', () => {
    const collapsed = body.style.display === 'none';
    body.style.display = collapsed ? '' : 'none';
    const ch = header.querySelector('.map-chevron');
    if (ch) ch.setAttribute('data-lucide', collapsed ? 'chevron-down' : 'chevron-right');
    applyIcons(box);
    if (mapJsplumb) mapJsplumb.revalidate(box);
  });
  box.appendChild(header);
  box.appendChild(body);
  box.appendChild(handle);
  handle.addEventListener('mousedown', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const startW = box.offsetWidth, startH = box.offsetHeight, sx = ev.clientX, sy = ev.clientY;
    const move = (me) => {
      box.style.width = Math.max(210, startW + me.clientX - sx) + 'px';
      box.style.height = Math.max(60, startH + me.clientY - sy) + 'px';
      if (mapJsplumb) mapJsplumb.revalidate(box);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (mapJsplumb) mapJsplumb.repaintEverything();
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  });
  return { box, body };
}

function renderMap(diagram, changes, summaries) {
  const area = document.getElementById('mapArea');
  const canvas = document.getElementById('mapCanvas');
  if (!area || !canvas) return;
  mapChangesByPath = new Map(((changes || []).map((c) => [c.filePath, c.changeType])));
  mapSummaryByPath = new Map(((summaries || []).map((s) => [s.filePath, s.summary])));
  if (mapJsplumb) { try { mapJsplumb.reset(); } catch (e) {} mapJsplumb = null; }
  canvas.innerHTML = '';
  mapZoom = 1;
  mapPanX = 0;
  mapPanY = 0;
  applyMapPan();
  const zl = document.getElementById('zoomLabel');
  if (zl) zl.textContent = '100%';
  const files = flatDiagramFiles(diagram);
  if (files.length === 0) return;
  const n = files.length;
  const posMap = (diagram && diagram.positions) || {};
  const bounds = (diagram && diagram.bounds) || null;
  const hasPos = files.some((f) => posMap[f.id]);
  // ponytail: card 170x~70 vs dagre node 150x60 → top-left = center - half card
  const DX = 85, DY = 35;
  const placeFlat = () => {
    if (hasPos) {
      files.forEach((f, i) => {
        const p = posMap[f.id];
        const card = makeFileCard(f, ENTRY_FILES.has(f.name.toLowerCase()));
        if (p) {
          card.style.left = Math.max(0, Math.round(p.x) - DX) + 'px';
          card.style.top = Math.max(0, Math.round(p.y) - DY) + 'px';
        } else {
          // isolated node dagre couldn't place: leftover row below bounds
          card.style.left = (20 + (i % 6) * 190) + 'px';
          card.style.top = ((bounds ? bounds.height : 200) + 20 + Math.floor(i / 6) * 90) + 'px';
        }
        card.addEventListener('click', () => flashChangeItem(f.id));
        wireTooltip(card, f.id, f.group || '');
        canvas.appendChild(card);
      });
      if (bounds) {
        canvas.style.width = (bounds.width + 40) + 'px';
        canvas.style.height = (bounds.height + 40) + 'px';
      } else {
        const l = Math.max(...files.map((f) => (posMap[f.id] ? posMap[f.id].x : 0)));
        const t = Math.max(...files.map((f) => (posMap[f.id] ? posMap[f.id].y : 0)));
        canvas.style.width = (l + DX + 40) + 'px';
        canvas.style.height = (t + DY + 40) + 'px';
      }
      return;
    }
    const cols = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(n))));
    files.forEach((f, i) => {
      const card = makeFileCard(f, ENTRY_FILES.has(f.name.toLowerCase()));
      card.style.left = (20 + (i % cols) * 190) + 'px';
      card.style.top = (20 + Math.floor(i / cols) * 90) + 'px';
      card.addEventListener('click', () => flashChangeItem(f.id));
      wireTooltip(card, f.id, f.group || '');
      canvas.appendChild(card);
    });
    const rows = Math.ceil(n / cols);
    canvas.style.width = (20 + cols * 190) + 'px';
    canvas.style.height = (20 + rows * 90) + 'px';
  };
  if (!window.jsPlumb) {
    placeFlat();
    applyIcons(canvas);
    return;
  }
  mapJsplumb = window.jsPlumb.getInstance({ Container: canvas, Connector: ['Bezier', { curviness: 50 }], PaintStyle: { stroke: '#9aa0ff', strokeWidth: 2 }, Endpoint: 'Blank', Anchors: ['Continuous', 'Continuous'], Overlays: [['Arrow', { location: 1, width: 10, length: 10 }]] });
  window.__mapConnectorOpts = { name: 'Bezier', curviness: 50 };
  placeFlat();
  const validIds = new Set(files.map((f) => 'mf-' + f.id.replace(/[^a-zA-Z0-9]/g, '_')));
  const seenPairs = new Map();
  window.__mapEdgeCurviness = [];
  for (const e of (diagram.edges || [])) {
    const fromId = 'mf-' + String(e.from).replace(/[^a-zA-Z0-9]/g, '_');
    const toId = 'mf-' + String(e.to).replace(/[^a-zA-Z0-9]/g, '_');
    if (!validIds.has(fromId) || !validIds.has(toId)) continue;
    const key = e.from + '->' + e.to;
    const dup = seenPairs.get(key) || 0;
    seenPairs.set(key, dup + 1);
    const curviness = 50 + dup * 10;
    window.__mapEdgeCurviness.push({ from: e.from, to: e.to, curviness });
    try {
      const style = e.kind === 'transitive'
        ? { stroke: '#b7bbe6', strokeWidth: 2, dashstyle: '4 3' }
        : { stroke: '#9aa0ff', strokeWidth: 2 };
      mapJsplumb.connect({ source: fromId, target: toId, paintStyle: style, connector: ['Bezier', { curviness }] });
    } catch (err) { /* skip unconnectable pairs */ }
  }
  window.__mapArrowCount = window.__mapEdgeCurviness.length;
  applyIcons(canvas);
  mapJsplumb.repaintEverything();
  requestAnimationFrame(() => { if (mapJsplumb) mapJsplumb.repaintEverything(); });
  wireMapPan();
}

let mapPanX = 0;
let mapPanY = 0;

function applyMapPan() {
  const canvas = document.getElementById('mapCanvas');
  if (!canvas) return;
  canvas.setAttribute('data-pan', mapPanX + ',' + mapPanY);
  canvas.style.transform = `translate(${mapPanX}px, ${mapPanY}px) scale(${mapZoom})`;
}

function zoomFit() {
  mapPanX = 0;
  mapPanY = 0;
  applyMapPan();
  const area = document.getElementById('mapArea');
  const canvas = document.getElementById('mapCanvas');
  if (!area || !canvas) return;
  const boxes = [...canvas.querySelectorAll(':scope > .map-file')]
    .filter((el) => el.offsetWidth > 0 && el.offsetHeight > 0);
  if (!boxes.length) { setZoom(1); return; }
  // ponytail: skips hidden cards (offsetWidth 0)
  let l = boxes[0].offsetLeft, t = boxes[0].offsetTop, r = boxes[0].offsetLeft + boxes[0].offsetWidth, b = boxes[0].offsetTop + boxes[0].offsetHeight;
  for (const el of boxes) {
    l = Math.min(l, el.offsetLeft);
    t = Math.min(t, el.offsetTop);
    r = Math.max(r, el.offsetLeft + el.offsetWidth);
    b = Math.max(b, el.offsetTop + el.offsetHeight);
  }
  const needW = (r - l) + 40, needH = (b - t) + 40;
  setZoom(Math.min(2, Math.max(0.25, Math.min((area.clientWidth - 48) / needW, (area.clientHeight - 48) / needH))));
}

function wireMapPan() {
  const area = document.getElementById('mapArea');
  const canvas = document.getElementById('mapCanvas');
  if (!area || !canvas || area.dataset.panWired) return;
  area.dataset.panWired = '1';
  mapPanX = 0;
  mapPanY = 0;
  area.addEventListener('mousedown', (ev) => {
    if (ev.target.closest('.map-file, button')) return;
    ev.preventDefault();
    const sx = ev.clientX, sy = ev.clientY, ox = mapPanX, oy = mapPanY;
    let moved = false;
    const move = (me) => {
      moved = true;
      mapPanX = ox + me.clientX - sx;
      mapPanY = oy + me.clientY - sy;
      applyMapPan();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      void moved;
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  });
}

function renderDashboard(res) {
  document.getElementById('recapText').textContent = res.summary.overallSummary;
  const stats = document.getElementById('statRow');
  stats.innerHTML = '';
  const nFiles = res.entries.filter((e) => e.entryType === 'file').length;
  for (const label of [`${nFiles} files`, `${res.summary.fileSummaries.length} areas explained`]) {
    const s = el('span', 'font-size:12px;color:#434655;display:flex;align-items:center;gap:6px');
    s.appendChild(el('span', 'width:6px;height:6px;border-radius:999px;background:#2e5ce6;display:inline-block'));
    s.appendChild(document.createTextNode(label));
    stats.appendChild(s);
  }
  const byChange = new Map((res.changes || []).map((c) => [c.filePath, c.changeType]));
  renderChanges(res.summary.fileSummaries, byChange);
  renderMap(res.diagram, res.changes || [], res.summary.fileSummaries || []);
  show('dashScreen');
}

const ERRORS = {
  empty: { kicker: 'Empty folder', icon: '!', tint: '#efedf1', iconColor: '#5a5e68', title: 'This folder looks empty', desc: 'Pick a folder that has your project files in it.', action: 'Choose another folder' },
  large: { kicker: 'Too large', icon: '!', tint: '#dfe2ee', iconColor: '#5a5e68', title: 'This project is pretty big', desc: 'VibeMap is still scanning, just taking a bit longer than usual.', action: 'Keep waiting' },
  ai: { kicker: 'AI not responding', icon: '×', tint: '#f6dede', iconColor: '#b3261e', title: "Couldn't reach the AI", desc: 'Check your API key or endpoint in AI Settings, then try again.', action: 'Open AI Settings' },
};

function showError(kind) {
  const s = ERRORS[kind];
  const wrap = document.getElementById('errorCard');
  wrap.innerHTML = '';
  wrap.appendChild(el('div', `width:48px;height:48px;border-radius:12px;background:${s.tint};display:flex;align-items:center;justify-content:center;font-size:20px;color:${s.iconColor}`, s.icon));
  wrap.appendChild(el('span', 'font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#747686', s.kicker));
  wrap.appendChild(el('h2', 'margin:0;font-size:16px;font-weight:700', s.title));
  wrap.appendChild(el('p', 'margin:0;font-size:13px;color:#434655;line-height:20px', s.desc));
  const btn = el('button', 'margin-top:4px;padding:10px 20px;border:none;border-radius:8px;background:#2e5ce6;color:#ffffff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit', s.action);
  btn.addEventListener('click', () => show(kind === 'ai' ? 'settingsScreen' : 'pickScreen'));
  wrap.appendChild(btn);
  show('errorScreen');
}

const STAGE_TEXT = {
  scanning: 'Reading your project...',
  analyzing: 'Looking at what changed...',
  summarizing: 'Writing your summary...',
  mapping: 'Building the map...',
};
const STAGE_PCT = { scanning: 25, analyzing: 50, summarizing: 75, mapping: 100 };

function applyProgress(p) {
  if (!p || !STAGE_TEXT[p.stage]) return;
  document.getElementById('scanStage').textContent = STAGE_TEXT[p.stage];
  document.getElementById('scanBar').style.width = STAGE_PCT[p.stage] + '%';
  if (typeof p.files === 'number') document.getElementById('scanCount').textContent = p.files + ' files looked at so far';
}

async function onPick() {
  const folder = await window.vibemap.pickFolder();
  if (!folder) return;
  await runScan(folder);
}

async function openHistory() {
  const list = await window.vibemap.getScanHistory().catch(() => []);
  const wrap = document.getElementById('historyList');
  const empty = document.getElementById('historyEmpty');
  wrap.innerHTML = '';
  empty.style.display = (!list || list.length === 0) ? '' : 'none';
  for (const e of list || []) {
    const row = el('div', 'background:#ffffff;border:1px solid #eaeae7;border-radius:12px;padding:16px 18px;display:flex;gap:12px;align-items:center');
    row.className = 'history-row';
    row.setAttribute('data-path', e.folderPath);
    const mid = el('div', 'display:flex;flex-direction:column;gap:2px;min-width:0;flex:1');
    mid.appendChild(el('span', 'font-size:14px;font-weight:600', e.folderName || e.folderPath));
    mid.appendChild(el('span', 'font-size:12px;color:#747686;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', e.folderPath));
    mid.appendChild(el('span', 'font-size:12px;color:#9196a8', relTimeFn(e.lastScannedAt)));
    row.appendChild(mid);
    const openBtn = el('button', 'padding:8px 16px;border:none;border-radius:8px;background:#2e5ce6;color:#ffffff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit', 'Open');
    openBtn.addEventListener('click', async () => {
      const cached = await window.vibemap.openHistoryEntry(e.folderPath);
      if (!cached) return;
      renderDashboard(cached);
    });
    const rescanBtn = el('button', 'padding:8px 16px;border:1px solid #d8dbe4;border-radius:8px;background:#ffffff;color:#434655;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit', 'Rescan');
    rescanBtn.addEventListener('click', () => runScan(e.folderPath));
    row.appendChild(openBtn);
    row.appendChild(rescanBtn);
    wrap.appendChild(row);
  }
  show('historyScreen');
}

async function runScan(folder) {
  document.getElementById('pickedPath').textContent = folder;
  show('scanScreen');
  document.getElementById('scanBar').style.width = '10%';
  document.getElementById('scanCount').textContent = '0 files looked at so far';
  document.getElementById('scanStage').textContent = STAGE_TEXT.scanning;
  const unsub = typeof window.vibemap.onAnalyzeProgress === 'function'
    ? window.vibemap.onAnalyzeProgress(applyProgress)
    : null;
  let res;
  try {
    res = await window.vibemap.analyzeFolder(folder);
  } catch (e) {
    if (unsub) unsub();
    showError('ai');
    return;
  }
  if (unsub) unsub();
  if (!res || res.status === 'empty') {
    showError('empty');
    return;
  }
  document.getElementById('scanBar').style.width = '100%';
  document.getElementById('scanCount').textContent = (res.entries ? res.entries.length : 0) + ' files looked at so far';
  if (res.status === 'ai-error') {
    showError('ai');
    return;
  }
  renderDashboard(res);
}

function suggestModel(endpoint, type) {
  if (type === 'ollama') return 'llama3';
  const e = String(endpoint || '').toLowerCase();
  if (!e) return '';
  if (e.includes('generativelanguage.googleapis.com')) return 'gemini-3.8-flash';
  if (e.includes('api.openai.com')) return 'gpt-4o-mini';
  if (e.includes('anthropic.com')) return 'claude-haiku-5-5';
  if (e.includes('localhost:11434')) return 'llama3';
  return '';
}

const PROVIDER_PRESETS = {
  openai: { endpoint: 'https://api.openai.com/v1', models: ['gpt-4o-mini', 'gpt-4o'], type: 'cloud' },
  anthropic: { endpoint: 'https://api.anthropic.com/v1', models: ['claude-haiku-5-5', 'claude-sonnet-4'], type: 'cloud' },
  gemini: { endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai', models: ['gemini-3.8-flash'], type: 'cloud' },
  ollama: { endpoint: 'http://localhost:11434', models: ['llama3'], type: 'ollama' },
  custom: { endpoint: '', models: [], type: 'cloud' },
}; // ponytail: static model lists are fallback only; Fetch models button remains source of truth

function presetKeyFor(cfg) {
  if (!cfg || !cfg.endpoint) return 'openai';
  const e = String(cfg.endpoint).toLowerCase();
  if (cfg.type === 'ollama' || e.includes('localhost:11434')) return 'ollama';
  if (e.includes('generativelanguage.googleapis.com')) return 'gemini';
  if (e.includes('api.openai.com')) return 'openai';
  if (e.includes('anthropic.com')) return 'anthropic';
  return 'custom';
}

function applyProviderPreset(key) {
  const p = PROVIDER_PRESETS[key] || PROVIDER_PRESETS.custom;
  const ep = document.getElementById('endpointInput');
  if (key !== 'custom') ep.value = p.endpoint;
  const sel = document.getElementById('modelSelect');
  sel.innerHTML = '';
  for (const id of p.models) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = id;
    sel.appendChild(opt);
  }
  sel.style.display = p.models.length ? '' : 'none';
}

let hadConfigBefore = false;

function showPickGate(hasConfig) {
  document.getElementById('pickBtn').disabled = !hasConfig;
  document.getElementById('pickHint').style.display = hasConfig ? 'none' : '';
}

function refreshPickGate() {
  window.vibemap.getProviderConfig().then((cfg) => showPickGate(!!cfg)).catch(() => showPickGate(false));
}

function show(id) {
  for (const s of ['pickScreen', 'scanScreen', 'dashScreen', 'errorScreen', 'settingsScreen', 'historyScreen']) {
    document.getElementById(s).style.display = s === id ? 'flex' : 'none';
  }
  const foot = document.getElementById('pickFooter');
  if (foot) foot.style.display = id === 'pickScreen' ? '' : 'none';
  if (id === 'pickScreen') refreshPickGate();
  paintHeaderIcons(id);
}

const relTimeFn = (typeof window !== 'undefined' && window.historyUi && window.historyUi.relTime)
  || ((iso) => String(iso));

function paintHeaderIcons(activeScreen) {
  const hb = document.getElementById('historyBtn');
  const sb = document.getElementById('settingsLink');
  if (hb) {
    hb.style.background = activeScreen === 'historyScreen' ? '#0041ca' : '#2e5ce6';
    hb.classList.toggle('active', activeScreen === 'historyScreen');
  }
  if (sb) {
    sb.style.background = activeScreen === 'settingsScreen' ? '#0041ca' : '#2e5ce6';
    sb.classList.toggle('active', activeScreen === 'settingsScreen');
  }
  applyIcons(document.querySelector('header'));
}

async function openSettings() {
  const cfg = await window.vibemap.getProviderConfig().catch(() => null);
  hadConfigBefore = !!cfg;
  const psel = document.getElementById('providerSelect');
  if (cfg) {
    const radio = document.querySelector(`input[name="provider"][value="${cfg.type}"]`);
    if (radio) radio.checked = true;
    document.getElementById('endpointInput').value = cfg.endpoint || '';
    document.getElementById('modelInput').value = cfg.model && cfg.model !== 'default' ? cfg.model : '';
    document.getElementById('apiKeyInput').value = cfg.apiKey || '';
    if (psel) psel.value = presetKeyFor(cfg);
    document.querySelectorAll('input[name="provider"]').forEach((r) => r.dispatchEvent(new Event('change')));
  } else if (psel && !psel.value) {
    psel.value = 'openai';
  }
  if (psel) applyProviderPreset(psel.value);
  const keyInput = document.getElementById('apiKeyInput');
  if (keyInput) keyInput.type = 'password';
  const toggle = document.getElementById('apiKeyToggle');
  if (toggle) toggle.textContent = 'Show';
  document.getElementById('settingsSaved').style.display = 'none';
  document.getElementById('modelsNotice').style.display = 'none';
  show('settingsScreen');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('pickBtn').addEventListener('click', onPick);
  document.getElementById('backBtn').addEventListener('click', () => show('pickScreen'));
  document.getElementById('settingsLink').addEventListener('click', async (e) => {
    e.preventDefault();
    await openSettings();
  });
  document.getElementById('settingsSkip').addEventListener('click', (e) => {
    e.preventDefault();
    show('pickScreen');
  });
  document.getElementById('pickSettingsLink').addEventListener('click', async (e) => {
    e.preventDefault();
    await openSettings();
  });
  document.getElementById('historyBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    await openHistory();
  });
  document.getElementById('historyBack').addEventListener('click', (e) => {
    e.preventDefault();
    show('pickScreen');
  });
  const paintCards = () => {
    const type = (document.querySelector('input[name="provider"]:checked') || {}).value || 'cloud';
    const on = ['border:1.5px solid #2e5ce6', 'background:#fbfcff'];
    const off = ['border:1.5px solid #efedf1', 'background:#ffffff'];
    const cloud = document.getElementById('cloudCard');
    const ollama = document.getElementById('ollamaCard');
    cloud.setAttribute('style', cloud.getAttribute('style').replace(/border:[^;]+/, on[0]).replace(/background:[^;]+/, on[1]));
    ollama.setAttribute('style', ollama.getAttribute('style').replace(/border:[^;]+/, off[0]).replace(/background:[^;]+/, off[1]));
    if (type === 'ollama') {
      cloud.setAttribute('style', cloud.getAttribute('style').replace(/border:[^;]+/, off[0]).replace(/background:[^;]+/, off[1]));
      ollama.setAttribute('style', ollama.getAttribute('style').replace(/border:[^;]+/, on[0]).replace(/background:[^;]+/, on[1]));
    }
  };
  document.querySelectorAll('input[name="provider"]').forEach((r) => r.addEventListener('change', paintCards));
  document.querySelectorAll('input[name="provider"]').forEach((r) => r.addEventListener('change', () => {
    const psel = document.getElementById('providerSelect');
    if (!psel) return;
    const t = (document.querySelector('input[name="provider"]:checked') || {}).value;
    if (t === 'ollama' && psel.value !== 'ollama') { psel.value = 'ollama'; applyProviderPreset('ollama'); }
    else if (t === 'cloud' && psel.value === 'ollama') { psel.value = 'openai'; applyProviderPreset('openai'); }
  }));
  const maybeSuggest = () => {
    const modelEl = document.getElementById('modelInput');
    if (modelEl.value.trim()) return;
    const type = (document.querySelector('input[name="provider"]:checked') || {}).value || 'cloud';
    const s = suggestModel(document.getElementById('endpointInput').value, type);
    if (s) modelEl.value = s;
  };
  document.getElementById('endpointInput').addEventListener('input', maybeSuggest);
  document.querySelectorAll('input[name="provider"]').forEach((r) => r.addEventListener('change', maybeSuggest));
  document.getElementById('modelSelect').addEventListener('change', () => {
    const sel = document.getElementById('modelSelect');
    if (sel.value) document.getElementById('modelInput').value = sel.value;
  });
  const providerSel = document.getElementById('providerSelect');
  if (providerSel) {
    providerSel.addEventListener('change', () => {
      applyProviderPreset(providerSel.value);
      const preset = PROVIDER_PRESETS[providerSel.value] || PROVIDER_PRESETS.custom;
      const radio = document.querySelector(`input[name="provider"][value="${preset.type}"]`);
      if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
      else maybeSuggest();
    });
  }
  const keyToggle = document.getElementById('apiKeyToggle');
  if (keyToggle) {
    keyToggle.addEventListener('click', () => {
      const input = document.getElementById('apiKeyInput');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      keyToggle.textContent = show ? 'Hide' : 'Show';
    });
  }
  document.getElementById('fetchModelsBtn').addEventListener('click', async () => {
    const btn = document.getElementById('fetchModelsBtn');
    const notice = document.getElementById('modelsNotice');
    const sel = document.getElementById('modelSelect');
    notice.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Fetching...';
    const type = (document.querySelector('input[name="provider"]:checked') || {}).value || 'cloud';
    const current = {
      type,
      endpoint: document.getElementById('endpointInput').value.trim(),
      apiKey: document.getElementById('apiKeyInput').value,
      model: document.getElementById('modelInput').value.trim(),
    };
    let list = null;
    try {
      list = await window.vibemap.fetchModels(current);
    } catch (e) {
      list = null;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Fetch models';
    }
    if (!list || list.length === 0) {
      notice.style.display = '';
      return;
    }
    sel.innerHTML = '';
    for (const id of list) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = id;
      sel.appendChild(opt);
    }
    sel.style.display = '';
    if (!document.getElementById('modelInput').value.trim()) {
      document.getElementById('modelInput').value = list[0];
    }
  });
  document.getElementById('saveProviderBtn').addEventListener('click', async () => {    const btn = document.getElementById('saveProviderBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    const psel = document.getElementById('providerSelect');
    const preset = (psel && PROVIDER_PRESETS[psel.value]) || PROVIDER_PRESETS.custom;
    const radioType = (document.querySelector('input[name="provider"]:checked') || {}).value;
    const type = psel ? preset.type : (radioType || 'cloud');
    const cfg = {
      type,
      endpoint: document.getElementById('endpointInput').value.trim(),
      apiKey: document.getElementById('apiKeyInput').value,
      model: document.getElementById('modelInput').value.trim() || (type === 'ollama' ? 'llama3' : 'default'),
    };
    try {
      await window.vibemap.saveProviderConfig(cfg);
    } finally {
      btn.disabled = false;
    }
    const label = hadConfigBefore ? 'Updated!' : 'Saved!';
    hadConfigBefore = true;
    document.getElementById('settingsSaved').style.display = '';
    showPickGate(true);
    btn.textContent = label;
    setTimeout(() => { btn.textContent = 'Save'; }, 1500);
  });
  document.getElementById('zoomIn').addEventListener('click', () => setZoom(mapZoom + 0.25));
  document.getElementById('zoomOut').addEventListener('click', () => setZoom(mapZoom - 0.25));
  document.getElementById('zoomLabel').addEventListener('click', () => setZoom(1));
  document.getElementById('zoomFit').addEventListener('click', zoomFit);
  showPickGate(false);
  refreshPickGate();
  paintHeaderIcons('pickScreen');
});
