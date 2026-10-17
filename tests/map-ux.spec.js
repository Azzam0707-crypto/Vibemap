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
  await stubDialog(app, 'C:\\fake\\ux3');
  await stubAnalyze(app, GROUPED);
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  await win.locator('#mapArea').scrollIntoViewIfNeeded();
}

test('tooltip follows cursor across the card', async () => {
  await openGrouped();
  const card = win.locator('.map-file[data-file="src/a.js"]');
  const box = await card.boundingBox();
  await win.mouse.move(box.x + 15, box.y + 15);
  await win.mouse.move(box.x + 15, box.y + 15, { steps: 2 });
  await expect(win.locator('#mapTip')).toBeVisible({ timeout: 3000 });
  const p1 = await win.locator('#mapTip').evaluate((e) => ({ l: parseFloat(e.style.left), t: parseFloat(e.style.top) }));
  await win.mouse.move(box.x + 120, box.y + 20, { steps: 6 });
  await win.waitForTimeout(200);
  const p2 = await win.locator('#mapTip').evaluate((e) => ({ l: parseFloat(e.style.left), t: parseFloat(e.style.top) }));
  expect(Math.abs(p2.l - p1.l)).toBeGreaterThan(30);
  const area = await win.locator('#mapArea').boundingBox();
  const tip = await win.locator('#mapTip').boundingBox();
  expect(tip.x).toBeGreaterThanOrEqual(area.x - 2);
  expect(tip.x + tip.width).toBeLessThanOrEqual(area.x + area.width + 2);
  expect(tip.y).toBeGreaterThanOrEqual(area.y - 2);
  expect(tip.y + tip.height).toBeLessThanOrEqual(area.y + area.height + 2);
  await win.mouse.move(40, 300);
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});

test('wheel does not zoom (buttons only)', async () => {
  await openGrouped();
  await expect(win.locator('#zoomLabel')).toContainText('100%');
  await win.locator('#mapArea').hover();
  await win.evaluate(() => {
    const area = document.getElementById('mapArea');
    const r = area.getBoundingClientRect();
    area.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true, cancelable: true }));
  });
  await win.waitForTimeout(300);
  await expect(win.locator('#zoomLabel')).toContainText('100%');
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});
