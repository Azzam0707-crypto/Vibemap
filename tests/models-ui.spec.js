const { test, expect, _electron: electron } = require('@playwright/test');
const { launchApp } = require('./helpers');

let app;
let win;

test.beforeAll(async () => {
  ({ app, win } = await launchApp(electron));
});

test.afterAll(async () => {
  if (app) await app.close();
});

async function openSettingsWith(fetchStub) {
  await app.evaluate(({ ipcMain }, body) => {
    try { ipcMain.removeHandler('get-provider-config'); } catch (e) {}
    try { ipcMain.removeHandler('save-provider-config'); } catch (e) {}
    try { ipcMain.removeHandler('fetch-models'); } catch (e) {}
    ipcMain.handle('get-provider-config', async () => null);
    ipcMain.handle('save-provider-config', async (e, cfg) => cfg);
    ipcMain.handle('fetch-models', async (e, cfg) => body);
  }, fetchStub);
  await win.locator('#settingsLink').click();
  await expect(win.locator('#settingsScreen')).toBeVisible();
}

test('fetch populates model dropdown, selection fills field like typing', async () => {
  await openSettingsWith(['gpt-4o-mini', 'gpt-4o']);
  await win.locator('#endpointInput').fill('https://api.openai.com/v1');
  await win.locator('#fetchModelsBtn').click();
  await expect(win.locator('#modelSelect option')).toHaveCount(2);
  await win.locator('#modelSelect').selectOption('gpt-4o');
  await expect(win.locator('#modelInput')).toHaveValue('gpt-4o');
  await win.getByRole('button', { name: 'Save' }).click();
  await expect(win.getByRole('button', { name: /Saved!|Updated!/ })).toBeVisible({ timeout: 5000 });
  await win.locator('#settingsSkip').click();
  await expect(win.locator('#pickScreen')).toBeVisible();
});

test('failed fetch shows notice, text input stays usable', async () => {
  await openSettingsWith(null);
  await win.locator('#endpointInput').fill('https://api.openai.com/v1');
  await win.locator('#fetchModelsBtn').click();
  await expect(win.locator('#modelsNotice')).toBeVisible();
  await expect(win.locator('#modelsNotice')).toContainText("Couldn't fetch models");
  await win.locator('#modelInput').fill('typed-manually');
  await expect(win.locator('#modelInput')).toBeEnabled();
  await expect(win.locator('#modelInput')).toHaveValue('typed-manually');
  await win.locator('#settingsSkip').click();
  await expect(win.locator('#pickScreen')).toBeVisible();
});
