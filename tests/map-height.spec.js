const { test, expect, _electron: electron } = require('@playwright/test');
const { launchApp, stubDialog, stubAnalyze, stubConfig } = require('./helpers');

let app;
let win;

test.beforeAll(async () => {
  ({ app, win } = await launchApp(electron));
  await stubConfig(app);
});

test.afterAll(async () => {
  if (app) await app.close();
});

test('tall diagram keeps mapArea capped, canvas scrolls inside', async () => {
  const files = (fld, n) => Array.from({ length: n }, (_, i) => ({ id: fld + 'f' + i + '.js', name: 'f' + i + '.js', kind: 'script', badge: 'unchanged' }));
  // tall vertical spread: stub positions with large y range, huge bounds
  const groups = [
    { id: 'a/', label: 'a/', files: files('a/', 8) },
    { id: 'b/', label: 'b/', files: files('b/', 8) },
    { id: 'c/', label: 'c/', files: files('c/', 8) },
  ];
  const positions = {};
  let y = 35;
  for (const g of groups) for (const f of g.files) { positions[f.id] = { x: 85, y }; y += 110; }
  const bounds = { width: 420, height: y };
  await stubDialog(app, 'C:\\fake\\tallmap');
  await stubAnalyze(app, {
    status: 'ok', entries: [], changes: [],
    diagram: { groups, rootFiles: [], edges: [], positions, bounds },
    summary: { ok: true, overallSummary: 'x', fileSummaries: [] },
  });
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  await expect(win.locator('#mapCanvas > .map-file')).toHaveCount(24);
  const areaH = await win.locator('#mapArea').evaluate((e) => e.getBoundingClientRect().height);
  const canvasH = await win.locator('#mapCanvas').evaluate((e) => parseInt(e.style.height) || e.scrollHeight);
  expect(canvasH).toBeGreaterThan(areaH);
  expect(areaH).toBeLessThanOrEqual(640);
  const overflowY = await win.locator('#mapArea').evaluate((e) => getComputedStyle(e).overflowY);
  expect(['auto', 'scroll']).toContain(overflowY);
  const scrollable = await win.locator('#mapArea').evaluate((e) => e.scrollHeight > e.clientHeight + 10);
  expect(scrollable).toBe(true);
});
