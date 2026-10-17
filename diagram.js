const dagre = require('dagre');

const MAX_NODES = 40;
const MAX_PER_FOLDER = 12;
const W = 150;
const H = 60;

const ENTRY_NAMES = new Set(['index.js', 'index.jsx', 'index.ts', 'index.tsx', 'main.js', 'main.jsx', 'main.ts', 'main.tsx', 'app.js', 'app.jsx', 'app.ts', 'app.tsx', 'server.js', 'app.py', 'main.py', 'server.py']);

function noExt(p) {
  return p.replace(/\.[^./]+$/, '');
}

function resolveImport(spec, files, fromFile) {
  const s = String(spec).replace(/^(\.\.?\/)+/, '');
  for (const f of files) {
    if (f === s || noExt(f) === noExt(s) || f === s + '.js' || noExt(f) === s) return f;
  }
  if (fromFile) {
    const fromDir = fromFile.slice(0, fromFile.lastIndexOf('/') + 1);
    const joined = fromDir + s;
    for (const f of files) {
      if (f === joined || noExt(f) === noExt(joined) || f === joined + '.js' || noExt(f) === joined) {
        const hit = files.filter((g) => g.split('/').pop() === f.split('/').pop());
        if (hit.length === 1 || hit.includes(joined) || hit.includes(joined + '.js')) return f;
      }
    }
    const base = s.split('/').pop();
    const prefix = s.includes('/') ? s.slice(0, s.lastIndexOf('/')) : '';
    const hits = files.filter((f) => {
      const fb = f.split('/').pop();
      if (!(fb === base || noExt(fb) === noExt(base))) return false;
      return !prefix || f.includes('/' + prefix + '/') || f.startsWith(prefix + '/');
    });
    const relHits = hits.filter((f) => f.startsWith(fromDir));
    if (relHits.length === 1) return relHits[0];
    if (hits.length === 1) return hits[0];
    return null;
  }
  const base = s.split('/').pop();
  const hits = files.filter((f) => f.split('/').pop() === base || noExt(f.split('/').pop()) === noExt(base));
  return hits.length === 1 ? hits[0] : null;
}

function folderOf(f) {
  const i = f.lastIndexOf('/');
  return i < 0 ? '' : f.slice(0, i + 1);
}

function baseName(f) {
  return f.split('/').pop().toLowerCase();
}

function kindOf(f) {
  const ext = f.slice(f.lastIndexOf('.') + 1).toLowerCase();
  if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) return 'script';
  if (['json'].includes(ext)) return 'data';
  if (['md', 'txt'].includes(ext)) return 'doc';
  if (['css', 'scss', 'less'].includes(ext)) return 'style';
  if (['html', 'htm'].includes(ext)) return 'page';
  return 'file';
}

function buildEdges(files, parsedChanges, extraRefs) {
  const fileSet = new Set(files);
  const parsed = new Map((parsedChanges || []).map((p) => [p.filePath, p.importsChanged || []]));
  const edges = [];
  const add = (from, to, kind) => {
    if (!to || to === from || !fileSet.has(to)) return;
    const same = edges.find((e) => e.from === from && e.to === to);
    if (same) {
      if (kind === 'direct') same.kind = 'direct';
      return;
    }
    edges.push({ from, to, kind });
  };
  for (const f of files) {
    for (const spec of parsed.get(f) || []) {
      add(f, resolveImport(spec, files, f), 'direct');
    }
    for (const spec of (extraRefs && extraRefs[f]) || []) {
      add(f, resolveImport(spec, files, f), 'direct');
    }
  }
  const directTargets = new Map(files.map((f) => [f, new Set()]));
  for (const e of edges) directTargets.get(e.from).add(e.to);
  for (const e of [...edges]) {
    for (const spec of parsed.get(e.to) || []) {
      const hop2 = resolveImport(spec, files, e.to);
      if (!hop2 || hop2 === e.from || directTargets.get(e.from).has(hop2)) continue;
      add(e.from, hop2, 'transitive');
    }
  }
  return edges;
}

function layoutIds(ids, edges) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const id of ids) g.setNode(id, { width: W, height: H });
  for (const e of edges) if (ids.includes(e.from) && ids.includes(e.to)) g.setEdge(e.from, e.to);
  dagre.layout(g);
  const seen = new Set();
  const pos = {};
  for (const id of ids) {
    let { x, y } = g.node(id);
    x = Math.round(x);
    y = Math.round(y);
    while (seen.has(x + ',' + y)) x += W + 80;
    seen.add(x + ',' + y);
    pos[id] = { x, y };
  }
  return pos;
}

function generateDiagram(entries, parsedChanges, changes, extraRefs) {
  const files = (entries || []).filter((e) => e.entryType === 'file').map((e) => e.filePath);
  const changedSet = new Set((changes || []).map((c) => c.filePath));
  const changeType = new Map((changes || []).map((c) => [c.filePath, c.changeType]));
  const badgeFor = (f) => changedSet.has(f) ? (changeType.get(f) === 'added' ? 'new' : 'changed') : 'unchanged';
  const allEdges = buildEdges(files, parsedChanges, extraRefs);
  const degree = new Map(files.map((f) => [f, 0]));
  for (const e of allEdges) {
    degree.set(e.from, degree.get(e.from) + 1);
    degree.set(e.to, degree.get(e.to) + 1);
  }
  const mustKeep = new Set();
  for (const f of files) {
    if (ENTRY_NAMES.has(baseName(f)) || changedSet.has(f)) mustKeep.add(f);
  }
  // ponytail: MAX_NODES caps total displayed file nodes + pseudo-files.
  // mustKeep (entry/changed) always survives; enforcement drops low-degree
  // non-mustKeep files, so total can overflow if mustKeep alone exceeds cap.
  const keep = new Set(mustKeep);
  const rest = files.filter((f) => !mustKeep.has(f)).sort((a, b) => (degree.get(b) || 0) - (degree.get(a) || 0));
  for (const f of rest) {
    if (keep.size >= MAX_NODES) break;
    keep.add(f);
  }
  const dropped = files.filter((f) => !keep.has(f));
  const droppedByFolder = new Map();
  for (const f of dropped) {
    const fld = folderOf(f);
    if (!droppedByFolder.has(fld)) droppedByFolder.set(fld, []);
    droppedByFolder.get(fld).push(f);
  }
  const byFolder = new Map();
  const pushFile = (f) => {
    const fld = folderOf(f);
    if (!byFolder.has(fld)) byFolder.set(fld, []);
    byFolder.get(fld).push({ id: f, name: f.split('/').pop(), kind: kindOf(f), badge: badgeFor(f) });
  };
  for (const f of files) if (keep.has(f)) pushFile(f);
  for (const [fld, list] of droppedByFolder) {
    const shown = byFolder.get(fld) || [];
    const room = MAX_PER_FOLDER - shown.length;
    const overflow = list.length - Math.max(0, room);
    if (overflow > 0) {
      if (!byFolder.has(fld)) byFolder.set(fld, []);
      byFolder.get(fld).push({ id: fld + '…', name: '+' + overflow + ' more', kind: 'folder-summary', count: overflow });
    } else {
      for (const f of list) pushFile(f);
    }
  }
  for (const [fld, arr] of [...byFolder]) {
    if (arr.length > MAX_PER_FOLDER) {
      const excess = arr.length - MAX_PER_FOLDER;
      const evictFirst = (x) => [
        mustKeep.has(x.id) ? 1 : 0,
        degree.get(x.id) || 0,
      ];
      const cut = arr
        .filter((x) => x.kind !== 'folder-summary')
        .sort((a, b) => evictFirst(a)[0] - evictFirst(b)[0] || evictFirst(a)[1] - evictFirst(b)[1])
        .slice(0, excess).map((x) => x.id);
      byFolder.set(fld, arr.filter((x) => !cut.includes(x.id)));
      const existing = byFolder.get(fld).find((x) => x.kind === 'folder-summary');
      if (existing) existing.count += excess;
      else byFolder.get(fld).push({ id: fld + '…', name: '+' + excess + ' more', kind: 'folder-summary', count: excess });
    }
  }
  const keptIds = new Set([...byFolder.values()].flatMap((a) => a.map((x) => x.id)));
  const pseudoOf = (f) => {
    const fld = folderOf(f);
    const arr = byFolder.get(fld) || [];
    const pseudo = arr.find((x) => x.kind === 'folder-summary');
    return pseudo ? pseudo.id : null;
  };
  const seenE = new Set();
  const edges = [];
  for (const e of allEdges) {
    let from = keptIds.has(e.from) ? e.from : pseudoOf(e.from);
    let to = keptIds.has(e.to) ? e.to : pseudoOf(e.to);
    if (!from || !to || from === to) continue;
    const k = from + '->' + to;
    const existing = edges.find((x) => x.from === from && x.to === to);
    if (existing) {
      if (e.kind === 'direct') existing.kind = 'direct';
      continue;
    }
    seenE.add(k);
    edges.push({ from, to, kind: e.kind || 'direct' });
  }
  const folderIds = [...byFolder.keys()].filter((f) => f !== '').sort();
  const flatIds = [...keptIds];
  const flatEdges = edges.filter((e) => keptIds.has(e.from) && keptIds.has(e.to));
  const pos = layoutIds(flatIds, flatEdges);
  const xs = flatIds.map((id) => pos[id].x);
  const ys = flatIds.map((id) => pos[id].y);
  const bounds = flatIds.length
    ? { width: Math.max(...xs) + W / 2 + 40, height: Math.max(...ys) + H / 2 + 40 }
    : { width: 0, height: 0 };
  const attach = (arr) => arr.map((f) => ({ ...f, x: pos[f.id] ? pos[f.id].x : 0, y: pos[f.id] ? pos[f.id].y : 0 }));
  const groups = folderIds.map((fld) => ({
    id: fld,
    label: fld,
    files: attach(byFolder.get(fld)),
  }));
  const rootFiles = attach(byFolder.get('') || []);
  return { groups, rootFiles, edges, positions: pos, bounds };
}

module.exports = { generateDiagram, resolveImport };
