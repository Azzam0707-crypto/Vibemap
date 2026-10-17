const { test, expect, _electron: electron } = require('@playwright/test');
const { launchApp, stubDialog, stubAnalyze, stubConfig } = require('./helpers');

function fourGroups() {
  const files = (fld, n) => Array.from({ length: n }, (_, i) => ({ id: fld + 'f' + i + '.js', name: 'f' + i + '.js', kind: 'script', badge: 'unchanged' }));
  return {
    status: 'ok', entries: [], changes: [],
    diagram: {
      groups: [
        { id: 'a/', label: 'a/', files: files('a/', 2) },
        { id: 'b/', label: 'b/', files: files('b/', 2) },
        { id: 'c/', label: 'c/', files: files('c/', 2) },
        { id: 'd/', label: 'd/', files: files('d/', 2) },
      ],
      rootFiles: [{ id: 'root.js', name: 'root.js', kind: 'script', badge: 'unchanged' }],
      edges: [],
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

test('narrow window scrolls horizontally, no clipped cards', async () => {
  await stubDialog(app, 'C:\\fake\\narrow');
  await stubAnalyze(app, fourGroups());
  await win.setViewportSize({ width: 700, height: 900 });
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  const overflow = await win.locator('#mapArea').evaluate((a) => a.scrollWidth > a.clientWidth);
  expect(overflow).toBe(true);
  const clipped = await win.evaluate(() => {
    const area = document.getElementById('mapArea').getBoundingClientRect();
    return [...document.querySelectorAll('#mapCanvas > .map-file')].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width <= 0 || r.height <= 0;
    }).length;
  });
  expect(clipped).toBe(0);
  await win.setViewportSize({ width: 1360, height: 900 });
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});

test('flat grid wraps rows within bounded canvas', async () => {
  await stubDialog(app, 'C:\\fake\\layout');
  await stubAnalyze(app, fourGroups());
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  // 9 files → cols=3, rows=3
  await expect(win.locator('.map-group')).toHaveCount(0);
  await expect(win.locator('#mapCanvas > .map-file')).toHaveCount(9);
  const size = await win.locator('#mapCanvas').evaluate((e) => ({ w: parseInt(e.style.width), h: parseInt(e.style.height) }));
  expect(size.w).toBe(20 + 3 * 190);
  expect(size.h).toBe(20 + 3 * 90);
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});
