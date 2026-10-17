const { test, expect, _electron: electron } = require('@playwright/test');
const { launchApp, stubDialog, stubConfig, FIXTURE_OK } = require('./helpers');

const CACHED = {
  status: 'ok',
  entries: [{ filePath: 'old.js', entryType: 'file', fileExt: '.js', sizeBytes: 10, depth: 1 }],
  changes: [],
  diagram: { groups: [], rootFiles: [{ id: 'old.js', name: 'old.js', kind: 'script', badge: 'unchanged' }], edges: [] },
  summary: { ok: true, overallSummary: 'Cached recap from last week.', fileSummaries: [] },
};

const HIST = [
  { folderPath: 'C:\\work\\alpha', folderName: 'alpha', lastScannedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), result: CACHED },
  { folderPath: 'C:\\work\\beta', folderName: 'beta', lastScannedAt: new Date(Date.now() - 12 * 86400 * 1000).toISOString(), result: CACHED },
];

let app;
let win;

test.beforeAll(async () => {
  ({ app, win } = await launchApp(electron));
  await stubConfig(app);
});

test.afterAll(async () => {
  if (app) await app.close();
});

async function stubHistory(list) {
  await app.evaluate(({ ipcMain }, l) => {
    try { ipcMain.removeHandler('get-scan-history'); } catch (e) {}
    try { ipcMain.removeHandler('open-history-entry'); } catch (e) {}
    ipcMain.handle('get-scan-history', async () => l);
    ipcMain.handle('open-history-entry', async (e, p) => {
      const hit = l.find((x) => x.folderPath === p);
      return hit ? hit.result : null;
    });
  }, list);
}

test('header icons present on pick + dashboard, history opens', async () => {
  await stubHistory([]);
  await expect(win.locator('#historyBtn')).toBeVisible();
  await expect(win.locator('#settingsLink')).toBeVisible();
  await expect(win.locator('#historyBtn svg, #historyBtn i')).toHaveCount(1);
  await win.locator('#historyBtn').click();
  await expect(win.locator('#historyScreen')).toBeVisible();
  await win.locator('#historyBack').click();
  await expect(win.locator('#pickScreen')).toBeVisible();
});

test('history rows render name/path/relative time, empty state otherwise', async () => {
  await stubHistory(HIST);
  await win.locator('#historyBtn').click();
  await expect(win.locator('.history-row')).toHaveCount(2);
  await expect(win.locator('.history-row').first()).toContainText('alpha');
  await expect(win.locator('.history-row').first()).toContainText('C:\\work\\alpha');
  await expect(win.locator('.history-row').first()).toContainText('hours ago');
  await expect(win.locator('.history-row').nth(1)).toContainText('12 days ago');
  await win.locator('#historyBack').click();
  await stubHistory([]);
  await win.locator('#historyBtn').click();
  await expect(win.locator('#historyEmpty')).toBeVisible();
  await expect(win.locator('#historyEmpty')).toContainText('No scans yet');
  await win.locator('#historyBack').click();
});

test('Open renders cached payload without analyze-folder', async () => {
  await stubHistory(HIST);
  await app.evaluate(({ ipcMain }) => {
    globalThis.__analyzeCalls = 0;
    try { ipcMain.removeHandler('analyze-folder'); } catch (e) {}
    ipcMain.handle('analyze-folder', async () => {
      globalThis.__analyzeCalls++;
      return { status: 'empty' };
    });
  });
  await win.locator('#historyBtn').click();
  await win.locator('.history-row').first().getByRole('button', { name: 'Open' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  await expect(win.locator('#recapText')).toContainText('Cached recap from last week.');
  expect(await app.evaluate(() => globalThis.__analyzeCalls)).toBe(0);
});

test('Rescan triggers scan flow for that path without dialog', async () => {
  await app.evaluate(({ ipcMain }, r) => {
    globalThis.__analyzePaths = [];
    try { ipcMain.removeHandler('analyze-folder'); } catch (e) {}
    ipcMain.handle('analyze-folder', async (e, folder) => {
      globalThis.__analyzePaths.push(folder);
      return r;
    });
  }, FIXTURE_OK);
  await win.reload();
  win = await app.firstWindow();
  await stubHistory(HIST);
  await win.locator('#historyBtn').click();
  await win.locator('.history-row').first().getByRole('button', { name: 'Rescan' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  expect(await app.evaluate(() => globalThis.__analyzePaths)).toEqual(['C:\\work\\alpha']);
});

test('active icon state marks current screen', async () => {
  await win.reload();
  win = await app.firstWindow();
  await win.locator('#historyBtn').click();
  await expect(win.locator('#historyScreen')).toBeVisible();
  await expect(win.locator('#historyBtn')).toHaveClass(/active/);
  await expect(win.locator('#settingsLink')).not.toHaveClass(/active/);
  await stubDialog(app, 'C:\\fake\\x');
  await win.locator('#historyBack').click();
  await expect(win.locator('#historyBtn')).not.toHaveClass(/active/);
});
