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
  await stubDialog(app, 'C:\\fake\\zoom');
  await stubAnalyze(app, GROUPED);
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  await expect(win.locator('.jtk-connector')).toHaveCount(1, { timeout: 5000 });
}

test('wheel does not zoom, fit resets and fits', async () => {
  await openGrouped();
  await expect(win.locator('#zoomLabel')).toContainText('100%');
  await win.locator('#mapArea').hover();
  await win.evaluate(() => {
    const a = document.getElementById('mapArea');
    const r = a.getBoundingClientRect();
    a.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, clientX: r.x + 100, clientY: r.y + 100, bubbles: true, cancelable: true }));
  });
  await win.waitForTimeout(300);
  await expect(win.locator('#zoomLabel')).toContainText('100%');
  await expect(win.locator('#zoomFit')).toBeVisible();
  await win.locator('#zoomIn').click();
  await expect(win.locator('#zoomLabel')).not.toContainText('100%');
  await win.locator('#zoomFit').click();
  const pan = await win.locator('#mapCanvas').evaluate((e) => e.getAttribute('data-pan'));
  expect(pan).toBe('0,0');
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});

test('zoomFit on empty diagram does not throw', async () => {
  await stubDialog(app, 'C:\\fake\\emptyzoom');
  await stubAnalyze(app, { ...GROUPED, diagram: { groups: [], rootFiles: [], edges: [] } });
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  await win.locator('#zoomFit').click();
  await expect(win.locator('#zoomLabel')).toContainText('100%');
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});
