const { test, expect } = require('@playwright/test');
const { parseCodeChange } = require('../parser');
const { generateDiagram } = require('../diagram');

test('require() calls are detected as imports', () => {
  const p = parseCodeChange('main.js', '', 'const { scanFolder } = require("./scanner");\nfunction f(){}');
  expect(p.importsChanged).toContain('./scanner');
});

test('changed require() target shows as changed import', () => {
  const p = parseCodeChange('e.js', 'const x = require("./a");', 'const x = require("./b");');
  expect(p.importsChanged.slice().sort()).toEqual(['./a', './b']);
});

test('basename collision resolves to sibling-directory match', () => {
  const file = (filePath) => ({ filePath, entryType: 'file', fileExt: '.js', sizeBytes: 10, depth: 2 });
  const pc = (filePath, importsChanged) => ({ filePath, functionsAdded: [], functionsRemoved: [], functionsModified: [], importsChanged });
  const entries = ['src/a/index.js', 'src/b/index.js', 'src/main.js'].map(file);
  const d = generateDiagram(entries, [pc('src/main.js', ['./a/index'])], []);
  expect(d.edges).toEqual([{ from: 'src/main.js', to: 'src/a/index.js', kind: 'direct' }]);
});

test('truly ambiguous basename still drops the edge', () => {
  const file = (filePath) => ({ filePath, entryType: 'file', fileExt: '.js', sizeBytes: 10, depth: 2 });
  const pc = (filePath, importsChanged) => ({ filePath, functionsAdded: [], functionsRemoved: [], functionsModified: [], importsChanged });
  const entries = ['src/a/util.js', 'lib/util.js', 'top/other.js'].map(file);
  const d = generateDiagram(entries, [pc('top/other.js', ['./util'])], []);
  expect(d.edges).toEqual([]);
});
