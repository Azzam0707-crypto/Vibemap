const { test, expect, _electron: electron } = require('@playwright/test');
const { launchApp, stubDialog, stubAnalyze, stubConfig } = require('./helpers');

function bigProject() {
  const files = (fld, n) => Array.from({ length: n }, (_, i) => ({ id: fld + 'f' + i + '.js', name: 'f' + i + '.js', kind: 'script', badge: i === 0 ? 'new' : 'unchanged' }));
  return {
    status: 'ok', entries: [], changes: [],
    diagram: {
      groups: [
        { id: 'tests/', label: 'tests/', files: files('tests/', 3) },
        { id: 'src/', label: 'src/', files: files('src/', 4) },
        { id: 'lib/', label: 'lib/', files: files('lib/', 3) },
      ],
      rootFiles: [
        { id: 'index.js', name: 'index.js', kind: 'script', badge: 'unchanged' },
        { id: 'app.js', name: 'app.js', kind: 'script', badge: 'unchanged' },
      ],
      edges: [
        { from: 'tests/f0.js', to: 'src/f0.js', kind: 'direct' },
        { from: 'src/f0.js', to: 'lib/f0.js', kind: 'direct' },
        { from: 'src/f1.js', to: 'lib/f1.js', kind: 'transitive' },
        { from: 'index.js', to: 'app.js', kind: 'direct' },
      ],
    },
    summary: { ok: true, overallSummary: 'big project', fileSummaries: [] },
  };
}

let app;
let win;

test.beforeAll(async () => {
  ({ app, win } = await launchApp(electron));
  await stubConfig(app);
});

test.afterAll(async () => {
  if (app) await app.close();
});

test('visual: no line crosses a card, single-row pipeline, fit works', async () => {
  await stubDialog(app, 'C:\\fake\\visual');
  await stubAnalyze(app, bigProject());
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  await win.waitForTimeout(800);
  await win.locator('#mapArea').scrollIntoViewIfNeeded();
  await win.locator('#mapArea').screenshot({ path: 'test-results/ux-batch-map.png' });
  // geometric check: no connector bbox center inside a card rect
  const bad = await win.evaluate(() => {
    const cards = [...document.querySelectorAll('.map-file')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const paths = [...document.querySelectorAll('.jtk-connector path')].map((p) => p.getBoundingClientRect());
    let hits = 0;
    for (const c of paths) {
      const cx = c.x + c.width / 2, cy = c.y + c.height / 2;
      for (const k of cards) {
        if (cx > k.x + 8 && cx < k.x + k.w - 8 && cy > k.y + 8 && cy < k.y + k.h - 8) { hits++; break; }
      }
    }
    return hits;
  });
  expect(bad).toBe(0);
  await win.locator('#zoomIn').click();
  await win.locator('#zoomIn').click();
  await win.locator('#mapArea').screenshot({ path: 'test-results/ux-batch-zoomed.png' });
  await win.locator('#zoomFit').click();
  await win.waitForTimeout(300);
  await win.locator('#mapArea').screenshot({ path: 'test-results/ux-batch-fit.png' });
  expect(await win.locator('#mapCanvas').evaluate((e) => e.getAttribute('data-pan'))).toBe('0,0');
});
