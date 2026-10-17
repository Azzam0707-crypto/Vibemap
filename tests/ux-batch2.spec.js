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

async function stubConfig(cfg) {
  await app.evaluate(({ ipcMain }, c) => {
    try { ipcMain.removeHandler('get-provider-config'); } catch (e) {}
    ipcMain.handle('get-provider-config', async () => c);
  }, cfg);
}

async function stubSave(delayMs = 0) {
  await app.evaluate(({ ipcMain }, d) => {
    try { ipcMain.removeHandler('save-provider-config'); } catch (e) {}
    ipcMain.handle('save-provider-config', async (e, cfg) => {
      if (d) await new Promise((r) => setTimeout(r, d));
      globalThis.__savedCfg = cfg;
      return cfg;
    });
  }, delayMs);
}

test('settings skip link reads Back to Pick Folder', async () => {
  await stubConfig(null);
  await stubSave(0);
  await win.locator('#settingsLink').click();
  await expect(win.locator('#settingsScreen')).toBeVisible();
  await expect(win.locator('#settingsSkip')).toHaveText('Back to Pick Folder');
  await win.locator('#settingsSkip').click();
  await expect(win.locator('#pickScreen')).toBeVisible();
});

test('first save shows loading then Saved!', async () => {
  await stubConfig(null);
  await stubSave(2000);
  await win.locator('#settingsLink').click();
  await win.locator('#endpointInput').fill('https://first.test/v1');
  await win.locator('#modelInput').fill('first-model');
  const btn = win.locator('#saveProviderBtn');
  await btn.click();
  await expect(btn).toBeDisabled({ timeout: 1000 });
  await expect(btn).toHaveText('Saving...');
  await expect(win.getByRole('button', { name: 'Saved!' })).toBeVisible({ timeout: 5000 });
  await expect(btn).toBeEnabled();
});

test('second save with changes shows Updated!', async () => {
  await app.evaluate(() => { globalThis.__savedCfg = { type: 'cloud', endpoint: 'https://old.test', apiKey: '', model: 'old' }; });
  await app.evaluate(({ ipcMain }) => {
    try { ipcMain.removeHandler('get-provider-config'); } catch (e) {}
    ipcMain.handle('get-provider-config', async () => globalThis.__savedCfg);
    try { ipcMain.removeHandler('save-provider-config'); } catch (e) {}
    ipcMain.handle('save-provider-config', async (e, cfg) => (globalThis.__savedCfg = cfg));
  });
  await win.locator('#settingsLink').click();
  await win.locator('#endpointInput').fill('https://new.test/v1');
  await win.getByRole('button', { name: 'Save' }).click();
  await expect(win.getByRole('button', { name: 'Updated!' })).toBeVisible({ timeout: 5000 });
});

test('no config disables pick button with required-AI copy', async () => {
  await stubConfig(null);
  await win.reload();
  win = await app.firstWindow();
  await expect(win.locator('#pickScreen')).toBeVisible();
  await expect(win.locator('#pickBtn')).toBeDisabled();
  await expect(win.locator('#pickHint')).toBeVisible();
  await expect(win.locator('#pickSettingsLink')).toHaveText('Set up your AI');
  await expect(win.locator('#pickSettingsLink')).not.toContainText('optional');
  await expect(win.locator('#scanScreen')).toBeHidden();
});

test('saved config enables pick button', async () => {
  await stubConfig({ type: 'cloud', endpoint: 'https://x.test', apiKey: 'k', model: 'm' });
  await win.reload();
  win = await app.firstWindow();
  await expect(win.locator('#pickBtn')).toBeEnabled();
  await expect(win.locator('#pickHint')).toBeHidden();
});
