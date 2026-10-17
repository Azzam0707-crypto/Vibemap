const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scanFolder } = require('../scanner');

let tmp;

test.beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vibemap-'));
  for (const f of ['index.js', 'README.md', 'src/app.js', 'src/util.ts', 'node_modules/fake/index.js', '.git/config', 'dist/bundle.js']) {
    const abs = path.join(tmp, ...f.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, '// x');
  }
});

test.afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('excludes default dirs and counts files', async () => {
  const entries = await scanFolder(tmp);
  const paths = entries.map((e) => e.filePath);
  expect(paths.some((p) => p.startsWith('node_modules/') || p.startsWith('.git/') || p.startsWith('dist/'))).toBe(false);
  expect(entries.filter((e) => e.entryType === 'file').map((e) => e.filePath).sort()).toEqual(['README.md', 'index.js', 'src/app.js', 'src/util.ts']);
  expect(paths).toContain('src');
  const appJs = entries.find((e) => e.filePath === 'src/app.js');
  expect(appJs.fileExt).toBe('.js');
  expect(appJs.depth).toBe(2);
  expect(typeof appJs.sizeBytes).toBe('number');
});

test('respects maxDepth', async () => {
  const entries = await scanFolder(tmp, { maxDepth: 1 });
  expect(entries.every((e) => e.depth <= 1)).toBe(true);
  expect(entries.some((e) => e.filePath === 'src/app.js')).toBe(false);
});
