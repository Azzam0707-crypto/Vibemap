const { test, expect, _electron: electron } = require('@playwright/test');
const { launchApp, stubDialog, stubAnalyze, stubConfig } = require('./helpers');

function twelve() {
  const mk = (fld, n) => Array.from({ length: n }, (_, i) => ({ id: fld + 'f' + i + '.js', name: 'f' + i + '.js', kind: 'script', badge: 'unchanged' }));
  return {
    status: 'ok', entries: [], changes: [],
    diagram: {
      groups: [
        { id: 'a/', label: 'a/', files: mk('a/', 6) },
        { id: 'b/', label: 'b/', files: mk('b/', 6) },
      ],
      rootFiles: [],
      edges: [{ from: 'a/f0.js', to: 'b/f0.js' }],
    },
    summary: { ok: true, overallSummary: 'x', fileSummaries: [] },
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

test('grid bounded, fit no dead space', async () => {
  await stubDialog(app, 'C:\\fake\\bounded');
  await stubAnalyze(app, twelve());
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  // 12 files → cols=4, rows=3, width=20+4*190=780, height=20+3*90=290
  const size = await win.locator('#mapCanvas').evaluate((e) => ({ w: parseInt(e.style.width), h: parseInt(e.style.height) }));
  expect(size.w).toBe(780);
  expect(size.h).toBe(290);
  await win.locator('#zoomFit').click();
  expect(await win.locator('#mapCanvas').evaluate((e) => e.getAttribute('data-pan'))).toBe('0,0');
  const label = await win.locator('#zoomLabel').textContent();
  expect(parseInt(label)).toBeLessThanOrEqual(100);
  const visible = await win.locator('#mapCanvas > .map-file').evaluateAll((els) => els.map((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }));
  expect(visible.every(Boolean)).toBe(true);
});
