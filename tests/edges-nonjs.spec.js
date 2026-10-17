const { test, expect } = require('@playwright/test');
const { generateDiagram, resolveImport } = require('../diagram');

const file = (filePath) => ({ filePath, entryType: 'file', fileExt: filePath.endsWith('.json') ? '.json' : filePath.slice(filePath.lastIndexOf('.')), sizeBytes: 10, depth: 2 });

test('shared resolveImport reuses sibling logic for non-JS specs', () => {
  const files = ['src/a/index.js', 'src/b/index.js', 'src/main.js'];
  expect(resolveImport('./a/index', files, 'src/main.js')).toBe('src/a/index.js');
  expect(resolveImport('x', files, 'src/main.js')).toBeNull();
});

test('html script/link refs become direct edges', () => {
  const { extractRefs } = require('../refs');
  const refs = extractRefs('index.html', '<html><head><link href="./style.css"></head><body><script src="./app.js"></script><script src="https://cdn.example/x.js"></script></body></html>');
  expect(refs.sort()).toEqual(['./app.js', './style.css']);
  const entries = ['index.html', 'app.js', 'style.css'].map(file);
  const d = generateDiagram(entries, [], [], { 'index.html': refs });
  expect(d.edges).toContainEqual({ from: 'index.html', to: 'app.js', kind: 'direct' });
  expect(d.edges).toContainEqual({ from: 'index.html', to: 'style.css', kind: 'direct' });
});

test('css import/url refs become direct edges', () => {
  const { extractRefs } = require('../refs');
  const refs = extractRefs('style.css', '@import "./base.css";\n.a { background: url(./img.png); }\n.b { background: url(https://x/y.png); }');
  expect(refs.sort()).toEqual(['./base.css', './img.png']);
  const entries = ['style.css', 'base.css', 'img.png'].map(file);
  const d = generateDiagram(entries, [], [], { 'style.css': refs });
  expect(d.edges).toContainEqual({ from: 'style.css', to: 'base.css', kind: 'direct' });
  expect(d.edges).toContainEqual({ from: 'style.css', to: 'img.png', kind: 'direct' });
});

test('package.json script path tokens become direct edges', () => {
  const { extractRefs } = require('../refs');
  const refs = extractRefs('package.json', '{"scripts": {"build": "node ./build.js", "test": "jest --coverage"}}');
  expect(refs).toEqual(['./build.js']);
  const entries = ['package.json', 'build.js'].map(file);
  const d = generateDiagram(entries, [], [], { 'package.json': refs });
  expect(d.edges).toContainEqual({ from: 'package.json', to: 'build.js', kind: 'direct' });
});
