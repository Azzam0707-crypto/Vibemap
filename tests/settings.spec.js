const { test, expect, _electron: electron } = require('@playwright/test');
const { launchApp, stubDialog, stubAnalyze } = require('./helpers');

let app;
let win;

test.beforeAll(async () => {
  ({ app, win } = await launchApp(electron));
});

test.afterAll(async () => {
  if (app) await app.close();
});

test('settings screen renders and saves through IPC', async () => {
  await app.evaluate(({ ipcMain }) => {
    try { ipcMain.removeHandler('save-provider-config'); } catch (e) {}
    try { ipcMain.removeHandler('get-provider-config'); } catch (e) {}
    ipcMain.handle('get-provider-config', async () => null);
    ipcMain.handle('save-provider-config', async (e, cfg) => cfg);
  });
  await win.locator('#settingsLink').click();
  await expect(win.locator('#settingsScreen')).toBeVisible();
  await win.getByRole('radio', { name: /Ollama/ }).check();
  await win.locator('#endpointInput').fill('http://localhost:11434');
  await win.getByRole('button', { name: 'Save' }).click();
  await expect(win.locator('#settingsSaved')).toBeVisible();
  await win.locator('#settingsSkip').click();
  await expect(win.locator('#pickScreen')).toBeVisible();
});

test('settings model field saves typed value and persists on reload', async () => {
  let saved = null;
  await app.evaluate(({ ipcMain }) => {
    try { ipcMain.removeHandler('save-provider-config'); } catch (e) {}
    try { ipcMain.removeHandler('get-provider-config'); } catch (e) {}
    ipcMain.handle('get-provider-config', async () => globalThis.__savedCfg || null);
    ipcMain.handle('save-provider-config', async (e, cfg) => (globalThis.__savedCfg = cfg));
  });
  await win.locator('#settingsLink').click();
  await expect(win.locator('#settingsScreen')).toBeVisible();
  await win.locator('#modelInput').fill('gpt-4o-mini');
  await win.getByRole('button', { name: 'Save' }).click();
  await expect(win.getByRole('button', { name: 'Saved!' })).toBeVisible();
  await win.reload();
  win = await app.firstWindow();
  await win.locator('#settingsLink').click();
  await expect(win.locator('#modelInput')).toHaveValue('gpt-4o-mini');
  saved = await app.evaluate(() => globalThis.__savedCfg);
  expect(saved.model).toBe('gpt-4o-mini');
});

test('endpoint typing suggests model without overwriting', async () => {
  await app.evaluate(({ ipcMain }) => {
    try { ipcMain.removeHandler('save-provider-config'); } catch (e) {}
    try { ipcMain.removeHandler('get-provider-config'); } catch (e) {}
    ipcMain.handle('get-provider-config', async () => null);
    ipcMain.handle('save-provider-config', async (e, cfg) => cfg);
  });
  await win.locator('#settingsLink').click();
  await win.getByRole('radio', { name: /Cloud API/ }).check();
  await win.locator('#modelInput').fill('');
  await win.locator('#endpointInput').fill('https://api.openai.com/v1');
  await expect(win.locator('#modelInput')).toHaveValue('gpt-4o-mini');
  await win.locator('#modelInput').fill('my-custom');
  await win.locator('#endpointInput').fill('https://generativelanguage.googleapis.com/v1beta/openai');
  await expect(win.locator('#modelInput')).toHaveValue('my-custom');
  await win.locator('#modelInput').fill('');
  await win.locator('#endpointInput').fill('https://api.anthropic.com/v1');
  await expect(win.locator('#modelInput')).toHaveValue('claude-haiku-5-5');
  await win.locator('#modelInput').fill('');
  await win.locator('#endpointInput').fill('https://my-own-host.example/api');
  await expect(win.locator('#modelInput')).toHaveValue('');
});

test('gate blocks scan when no config: pick stays disabled', async () => {
  await app.evaluate(({ ipcMain }) => {
    try { ipcMain.removeHandler('get-provider-config'); } catch (e) {}
    ipcMain.handle('get-provider-config', async () => null);
  });
  await win.reload();
  win = await app.firstWindow();
  await expect(win.locator('#pickBtn')).toBeDisabled({ timeout: 10000 });
  await expect(win.locator('#scanScreen')).toBeHidden();
});
