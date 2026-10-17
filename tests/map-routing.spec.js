const { test, expect, _electron: electron } = require('@playwright/test');
const { launchApp, stubDialog, stubAnalyze, stubConfig } = require('./helpers');

const GROUPED = {
  status: 'ok',
  entries: [
    { filePath: 'src/index.js', entryType: 'file', fileExt: '.js', sizeBytes: 100, depth: 2 },
    { filePath: 'src/a.js', entryType: 'file', fileExt: '.js', sizeBytes: 50, depth: 2 },
    { filePath: 'lib/b.js', entryType: 'file', fileExt: '.js', sizeBytes: 50, depth: 2 },
  ],
  changes: [
    { filePath: 'src/a.js', changeType: 'added', diffText: '', linesAdded: 5, linesRemoved: 0 },
    { filePath: 'lib/b.js', changeType: 'modified', diffText: '', linesAdded: 1, linesRemoved: 1 },
  ],
  diagram: {
    groups: [
      { id: 'src/', label: 'src/', files: [
        { id: 'src/index.js', name: 'index.js', kind: 'script', badge: 'unchanged' },
        { id: 'src/a.js', name: 'a.js', kind: 'script', badge: 'new' },
      ] },
      { id: 'lib/', label: 'lib/', files: [
        { id: 'lib/b.js', name: 'b.js', kind: 'script', badge: 'changed' },
      ] },
    ],
    rootFiles: [],
    edges: [{ from: 'src/a.js', to: 'lib/b.js' }],
  },
  summary: {
    ok: true,
    overallSummary: 'Your project gained a helper in another area.',
    fileSummaries: [
      { filePath: 'src/a.js', summary: 'New helper file.' },
      { filePath: 'lib/b.js', summary: 'Now uses the helper.' },
    ],
  },
};

let app;
let win;

test.beforeAll(async () => {
  ({ app, win } = await launchApp(electron));
  await stubConfig(app);
});

test.afterAll(async () => {
  if (app) await app.close();
});

async function openGrouped() {
  await stubDialog(app, 'C:\\fake\\routing');
  await stubAnalyze(app, GROUPED);
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  await expect(win.locator('.jtk-connector')).toHaveCount(1, { timeout: 5000 });
}

test('neighbor edges avoid file cards in flat grid', async () => {
  const files = (fld, n) => Array.from({ length: n }, (_, i) => ({ id: fld + 'f' + i + '.js', name: 'f' + i + '.js', kind: 'script', badge: 'unchanged' }));
  await stubDialog(app, 'C:\\fake\\tall');
  await stubAnalyze(app, {
    status: 'ok', entries: [], changes: [],
    diagram: {
      groups: [
        { id: 'a/', label: 'a/', files: files('a/', 1) },
        { id: 'mid/', label: 'mid/', files: files('mid/', 8) },
        { id: 'z/', label: 'z/', files: files('z/', 1) },
      ],
      rootFiles: [],
      edges: [
        { from: 'a/f0.js', to: 'mid/f0.js', kind: 'direct' },
        { from: 'mid/f7.js', to: 'z/f0.js', kind: 'direct' },
      ],
    },
    summary: { ok: true, overallSummary: 'x', fileSummaries: [] },
  });
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  await expect(win.locator('.map-group')).toHaveCount(0);
  await expect(win.locator('.jtk-connector')).toHaveCount(2, { timeout: 5000 });
  // Bezier curves between grid neighbors should not cut through a file card rect
  const hits = await win.evaluate(() => {
    const cards = [...document.querySelectorAll('.map-file')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const paths = [...document.querySelectorAll('.jtk-connector path')].map((p) => p.getBoundingClientRect());
    let n = 0;
    for (const c of paths) {
      const cx = c.x + c.width / 2, cy = c.y + c.height / 2;
      for (const k of cards) {
        if (cx > k.x + 8 && cx < k.x + k.w - 8 && cy > k.y + 8 && cy < k.y + k.h - 8) { n++; break; }
      }
    }
    return n;
  });
  expect(hits).toBe(0);
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});

test('connectors sit below cards and use bezier curves', async () => {
  await openGrouped();
  const opts = await win.evaluate(() => window.__mapConnectorOpts || null);
  expect(opts).not.toBeNull();
  expect(opts.name).toBe('Bezier');
  expect(opts.curviness).toBe(50);
  const zConn = await win.locator('.jtk-connector').first().evaluate((e) => getComputedStyle(e).zIndex);
  const zCard = await win.locator('.map-file').first().evaluate((e) => getComputedStyle(e).zIndex);
  expect(parseInt(zConn)).toBeLessThan(parseInt(zCard));
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});
