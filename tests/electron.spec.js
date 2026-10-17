const { test, expect, _electron: electron } = require('@playwright/test');
const { launchApp, stubConfig } = require('./helpers');

let app;
let win;

test.beforeAll(async () => {
  ({ app, win } = await launchApp(electron));
  await stubConfig(app);
});

test.afterAll(async () => {
  if (app) await app.close();
});

test('opens with title and pick button', async () => {
  expect(await win.title()).toBe('VibeMap');
  await expect(win.getByRole('button', { name: 'Pick a project folder' })).toBeVisible();
});

test('pick click renders stubbed path', async () => {
  await app.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: ['C:\\fake\\project'] });
  });
  await app.evaluate(({ ipcMain }) => {
    try { ipcMain.removeHandler('analyze-folder'); } catch (e) {}
    ipcMain.handle('analyze-folder', async () => ({ status: 'empty' }));
  });
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#pickedPath')).toHaveText('C:\\fake\\project');
});
