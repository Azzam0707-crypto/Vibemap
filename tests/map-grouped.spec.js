const { test, expect } = require('@playwright/test');
const { generateDiagram } = require('../diagram');

const file = (filePath) => ({ filePath, entryType: 'file', fileExt: '.js', sizeBytes: 10, depth: 2 });
const pc = (filePath, importsChanged) => ({ filePath, functionsAdded: [], functionsRemoved: [], functionsModified: [], importsChanged });

test('groups files by real folder path, root files separate', () => {
  const entries = ['App.js', 'src/index.js', 'src/a.js', 'src/components/B.js'].map(file);
  const parsed = [pc('App.js', []), pc('src/index.js', []), pc('src/a.js', []), pc('src/components/B.js', [])];
  const d = generateDiagram(entries, parsed, []);
  expect(d.groups.map((g) => g.id).sort()).toEqual(['src/', 'src/components/']);
  expect(d.groups.find((g) => g.id === 'src/').files.map((f) => f.id).sort()).toEqual(['src/a.js', 'src/index.js']);
  expect(d.rootFiles.map((f) => f.id)).toEqual(['App.js']);
  expect(d.groups.every((g) => typeof g.label === 'string')).toBe(true);
  expect(d.groups.flatMap((g) => g.files).every((f) => typeof f.name === 'string' && typeof f.kind === 'string')).toBe(true);
});

test('must-keep entry and changed files always present in large project', () => {
  const entries = [file('src/index.js')];
  const parsed = [pc('src/index.js', [])];
  for (let i = 0; i < 60; i++) {
    entries.push(file(`lib/leaf${i}.js`));
    parsed.push(pc(`lib/leaf${i}.js`, []));
  }
  entries.push(file('lib/hotfix.js'));
  const changes = [{ filePath: 'lib/hotfix.js', changeType: 'modified', diffText: '', linesAdded: 1, linesRemoved: 0 }];
  const d = generateDiagram(entries, parsed, changes);
  const ids = [...d.groups.flatMap((g) => g.files.map((f) => f.id)), ...d.rootFiles.map((f) => f.id)];
  expect(ids).toContain('src/index.js');
  expect(ids).toContain('lib/hotfix.js');
});

test('per-folder overflow emits one pseudo-file with count', () => {
  const entries = [];
  for (let i = 0; i < 20; i++) entries.push(file(`big/f${i}.js`));
  const d = generateDiagram(entries, [], []);
  const g = d.groups.find((x) => x.id === 'big/');
  expect(g.files.length).toBeLessThanOrEqual(13);
  const pseudo = g.files.filter((f) => f.kind === 'folder-summary');
  expect(pseudo).toHaveLength(1);
  expect(typeof pseudo[0].count).toBe('number');
  expect(pseudo[0].count).toBeGreaterThan(0);
});

test('edges reference displayed ids across groups, rewired to pseudo, deduped', () => {
  const entries = [file('src/a.js')];
  const parsed = [pc('src/a.js', ['./b'])];
  for (let i = 0; i < 20; i++) {
    entries.push(file(`lib/l${i}.js`));
    parsed.push(pc(`lib/l${i}.js`, ['../src/a']));
  }
  const d = generateDiagram(entries, parsed, []);
  const ids = new Set([...d.groups.flatMap((g) => g.files.map((f) => f.id)), ...d.rootFiles.map((f) => f.id)]);
  expect(d.edges.length).toBeGreaterThan(0);
  for (const e of d.edges) {
    expect(ids.has(e.from)).toBe(true);
    expect(ids.has(e.to)).toBe(true);
  }
  expect(new Set(d.edges.map((e) => e.from + '->' + e.to)).size).toBe(d.edges.length);
});

test('small project shows all files, no pseudo-files', () => {
  const entries = ['App.js', 'src/x.js'].map(file);
  const parsed = [pc('App.js', []), pc('src/x.js', [])];
  const d = generateDiagram(entries, parsed, []);
  expect(d.groups.flatMap((g) => g.files).every((f) => f.kind !== 'folder-summary')).toBe(true);
  expect(d.rootFiles.map((f) => f.id)).toEqual(['App.js']);
});
