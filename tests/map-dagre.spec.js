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

test('cards use dagre positions, canvas sized to bounds', async () => {
  await stubDialog(app, 'C:\\fake\\dagre');
  await stubAnalyze(app, {
    status: 'ok', entries: [], changes: [],
    diagram: {
      groups: [{ id: 'src/', label: 'src/', files: [
        { id: 'src/a.js', name: 'a.js', kind: 'script', badge: 'unchanged' },
        { id: 'src/b.js', name: 'b.js', kind: 'script', badge: 'unchanged' },
        { id: 'src/iso.js', name: 'iso.js', kind: 'script', badge: 'unchanged' },
      ] }],
      rootFiles: [],
      edges: [{ from: 'src/a.js', to: 'src/b.js', kind: 'direct' }],
      positions: {
        'src/a.js': { x: 85, y: 35 },
        'src/b.js': { x: 335, y: 35 },
        'src/iso.js': { x: 85, y: 145 },
      },
      bounds: { width: 420, height: 180 },
    },
    summary: { ok: true, overallSummary: 'x', fileSummaries: [] },
  });
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  const lefts = await win.locator('#mapCanvas > .map-file').evaluateAll((els) =>
    els.map((e) => ({ id: e.getAttribute('data-file'), l: e.offsetLeft, t: e.offsetTop })));
  const byId = Object.fromEntries(lefts.map((c) => [c.id, c]));
  // dagre x/y centered nodes → card top-left = pos - half card (170/2, 70/2)
  expect(byId['src/a.js'].l).toBe(85 - 85);
  expect(byId['src/a.js'].t).toBe(35 - 35);
  expect(byId['src/b.js'].l).toBeGreaterThan(byId['src/a.js'].l);
  expect(byId['src/iso.js'].t).toBeGreaterThan(byId['src/a.js'].t);
  const size = await win.locator('#mapCanvas').evaluate((e) => ({ w: parseInt(e.style.width), h: parseInt(e.style.height) }));
  expect(size.w).toBeGreaterThanOrEqual(420);
  expect(size.h).toBeGreaterThanOrEqual(180);
});
