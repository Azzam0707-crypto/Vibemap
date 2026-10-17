const { test, expect } = require('@playwright/test');
const { scanFolder, DEFAULT_EXCLUDES } = require('../scanner');

test('noise dirs excluded by name', () => {
  for (const d of ['release', 'out', 'coverage', 'test-results']) {
    expect(DEFAULT_EXCLUDES.has(d)).toBe(true);
  }
});

test('scanFolder skips noise files and dirs', async () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vibemap-noise-'));
  try {
    await fs.promises.mkdir(path.join(root, 'src'), { recursive: true });
    await fs.promises.mkdir(path.join(root, 'release'), { recursive: true });
    await fs.promises.mkdir(path.join(root, 'docs', 'superpowers'), { recursive: true });
    await fs.promises.writeFile(path.join(root, 'src', 'app.js'), 'x');
    await fs.promises.writeFile(path.join(root, 'release', 'app.exe'), 'x');
    await fs.promises.writeFile(path.join(root, 'bundle.asar'), 'x');
    await fs.promises.writeFile(path.join(root, 'lib.dll'), 'x');
    await fs.promises.writeFile(path.join(root, '.last-run.json'), 'x');
    await fs.promises.writeFile(path.join(root, 'docs', 'superpowers', 'plan.md'), 'x');
    const out = await scanFolder(root);
    const paths = out.filter((e) => e.entryType === 'file').map((e) => e.filePath);
    expect(paths).toContain('src/app.js');
    for (const p of paths) {
      expect(p).not.toMatch(/\.(asar|exe|dll|so)$/);
    }
    expect(paths.some((p) => p.startsWith('release/'))).toBe(false);
    expect(paths.some((p) => p.startsWith('docs/superpowers/'))).toBe(false);
    expect(paths).not.toContain('.last-run.json');
  } finally {
    await fs.promises.rm(root, { recursive: true, force: true });
  }
});
