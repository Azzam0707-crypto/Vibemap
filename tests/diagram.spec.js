const { test, expect } = require('@playwright/test');
const { generateDiagram } = require('../diagram');

const file = (filePath) => ({ filePath, entryType: 'file', fileExt: '.js', sizeBytes: 10, depth: 1 });
const pc = (filePath, importsChanged) => ({ filePath, functionsAdded: [], functionsRemoved: [], functionsModified: [], importsChanged });
const allIds = (d) => [...d.groups.flatMap((g) => g.files.map((f) => f.id)), ...d.rootFiles.map((f) => f.id)];

test('maps import graph to file entries with edges', () => {
  const entries = ['App.js', 'Dashboard.js', 'utils.js'].map(file);
  const parsed = [pc('App.js', ['./Dashboard']), pc('Dashboard.js', ['./utils']), pc('utils.js', [])];
  const d = generateDiagram(entries, parsed);
  expect(allIds(d).sort()).toEqual(['App.js', 'Dashboard.js', 'utils.js']);
  expect(d.edges).toEqual([
    { from: 'App.js', to: 'Dashboard.js', kind: 'direct' },
    { from: 'Dashboard.js', to: 'utils.js', kind: 'direct' },
    { from: 'App.js', to: 'utils.js', kind: 'transitive' },
  ]);
});

test('smart-filters large projects: hub + entry + changed survive', () => {
  const entries = [file('src/utils.js'), file('src/index.js')];
  const parsed = [pc('src/utils.js', []), pc('src/index.js', ['./utils'])];
  for (let i = 0; i < 60; i++) {
    entries.push(file(`src/leaf${i}.js`));
    parsed.push(pc(`src/leaf${i}.js`, ['./utils']));
  }
  for (let i = 0; i < 60; i++) entries.push(file(`lib/other${i}.js`));
  const changes = [{ filePath: 'lib/other0.js', changeType: 'modified', diffText: '', linesAdded: 1, linesRemoved: 0 }];
  const d = generateDiagram(entries, parsed, changes);
  const ids = allIds(d);
  expect(ids).toContain('src/utils.js');
  expect(ids).toContain('src/index.js');
  expect(ids).toContain('lib/other0.js');
  const edgeKeys = d.edges.map((e) => e.from + '->' + e.to);
  expect(new Set(edgeKeys).size).toBe(edgeKeys.length);
});
