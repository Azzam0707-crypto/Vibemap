const { test, expect, _electron: electron } = require('@playwright/test');
const { launchApp, stubDialog, stubConfig } = require('./helpers');

let app;
let win;

test.beforeAll(async () => {
  ({ app, win } = await launchApp(electron));
  await stubConfig(app);
});

test.afterAll(async () => {
  if (app) await app.close();
});

async function openFarApart() {
  const files = (fld, n) => Array.from({ length: n }, (_, i) => ({ id: fld + 'f' + i + '.js', name: 'f' + i + '.js', kind: 'script', badge: 'unchanged' }));
  const r = { status: 'ok', entries: [], changes: [], diagram: { groups: [
    { id: 'a/', label: 'a/', files: files('a/', 2) },
    { id: 'b/', label: 'b/', files: files('b/', 5) },
    { id: 'c/', label: 'c/', files: files('c/', 1) },
  ], rootFiles: [], edges: [] }, summary: { ok: true, overallSummary: 'x', fileSummaries: [] } };
  await stubDialog(app, 'C:\\fake\\far');
  await app.evaluate(({ ipcMain }, res) => {
    try { ipcMain.removeHandler('analyze-folder'); } catch (e) {}
    ipcMain.handle('analyze-folder', async () => res);
  }, JSON.parse(JSON.stringify(r)));
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  await win.waitForTimeout(600);
}

test('Fit button exists in the map header', async () => {
  await openFarApart();
  await expect(win.locator('#zoomFit')).toBeVisible();
  await expect(win.locator('#zoomIn')).toBeVisible();
  await expect(win.locator('#zoomOut')).toBeVisible();
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});

test('fresh launch shows header icons with svg immediately', async () => {
  await win.reload();
  win = await app.firstWindow();
  await expect(win.locator('#pickScreen')).toBeVisible();
  await expect(win.locator('#historyBtn')).toBeVisible();
  await expect(win.locator('#settingsLink')).toBeVisible();
  expect(await win.locator('#historyBtn svg').count()).toBeGreaterThan(0);
  expect(await win.locator('#settingsLink svg').count()).toBeGreaterThan(0);
});
