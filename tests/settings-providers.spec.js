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

async function openSettings() {
  await app.evaluate(({ ipcMain }) => {
    try { ipcMain.removeHandler('get-provider-config'); } catch (e) {}
    try { ipcMain.removeHandler('save-provider-config'); } catch (e) {}
    try { ipcMain.removeHandler('fetch-models'); } catch (e) {}
    ipcMain.handle('get-provider-config', async () => null);
    ipcMain.handle('save-provider-config', async (e, cfg) => { globalThis.__savedCfg = cfg; return cfg; });
    ipcMain.handle('fetch-models', async () => null);
  });
  await win.locator('#settingsLink').click();
  await expect(win.locator('#settingsScreen')).toBeVisible();
}

test('provider dropdown prefills endpoint, toggle masks key', async () => {
  await openSettings();
  await expect(win.locator('#providerSelect')).toBeVisible();
  await win.locator('#providerSelect').selectOption('openai');
  await expect(win.locator('#endpointInput')).toHaveValue('https://api.openai.com/v1');
  await win.locator('#providerSelect').selectOption('anthropic');
  await expect(win.locator('#endpointInput')).toHaveValue('https://api.anthropic.com/v1');
  await win.locator('#providerSelect').selectOption('ollama');
  await expect(win.locator('#endpointInput')).toHaveValue('http://localhost:11434');
  await expect(win.locator('#apiKeyInput')).toHaveAttribute('type', 'password');
  await win.locator('#apiKeyToggle').click();
  await expect(win.locator('#apiKeyInput')).toHaveAttribute('type', 'text');
  await win.locator('#apiKeyToggle').click();
  await expect(win.locator('#apiKeyInput')).toHaveAttribute('type', 'password');
  await win.locator('#settingsSkip').click();
  await expect(win.locator('#pickScreen')).toBeVisible();
});

test('custom provider keeps freeform endpoint and model', async () => {
  await openSettings();
  await win.locator('#providerSelect').selectOption('custom');
  await win.locator('#endpointInput').fill('https://my-own-host.example/api');
  await win.locator('#modelInput').fill('typed-manually');
  await win.getByRole('button', { name: 'Save' }).click();
  await expect(win.getByRole('button', { name: /Saved!|Updated!/ })).toBeVisible({ timeout: 5000 });
  const saved = await app.evaluate(() => globalThis.__savedCfg);
  expect(saved.endpoint).toBe('https://my-own-host.example/api');
  expect(saved.model).toBe('typed-manually');
  await win.locator('#settingsSkip').click();
});

test('radio and dropdown stay in sync, preset models visible', async () => {
  await openSettings();
  await win.locator('#providerSelect').selectOption('ollama');
  await expect(win.locator('#modelSelect')).toBeVisible();
  await expect(win.locator('input[name="provider"][value="ollama"]')).toBeChecked();
  await win.locator('input[name="provider"][value="cloud"]').check();
  await expect(win.locator('#providerSelect')).not.toHaveValue('ollama');
  await win.locator('#settingsSkip').click();
});

test('opening settings shows preset models for provider', async () => {
  await openSettings();
  await expect(win.locator('#modelSelect')).toBeVisible();
  expect(await win.locator('#modelSelect option').count()).toBeGreaterThan(0);
  await win.locator('#settingsSkip').click();
});

test('fetch failure keeps freeform model editable and save works', async () => {
  await openSettings();
  await win.locator('#providerSelect').selectOption('custom');
  await win.locator('#endpointInput').fill('https://my-own-host.example/api');
  await win.locator('#fetchModelsBtn').click();
  await expect(win.locator('#modelsNotice')).toBeVisible();
  await win.locator('#modelInput').fill('typed-after-failure');
  await expect(win.locator('#modelInput')).toBeEnabled();
  await win.getByRole('button', { name: 'Save' }).click();
  await expect(win.getByRole('button', { name: /Saved!|Updated!/ })).toBeVisible({ timeout: 5000 });
  const saved = await app.evaluate(() => globalThis.__savedCfg);
  expect(saved.model).toBe('typed-after-failure');
  await win.locator('#settingsSkip').click();
});

test('special-char key round-trips, never logged raw', async () => {
  await openSettings();
  const tricky = 'sk-quo"te-uni';
  await win.locator('#providerSelect').selectOption('openai');
  await win.locator('#apiKeyInput').fill(tricky);
  const logs = [];
  const orig = console.log;
  console.log = (...args) => { logs.push(args.join(' ')); orig.apply(console, args); };
  const proc = app.process();
  const onData = (d) => logs.push(String(d));
  if (proc.stdout) proc.stdout.on('data', onData);
  if (proc.stderr) proc.stderr.on('data', onData);
  try {
    await win.getByRole('button', { name: 'Save' }).click();
    await expect(win.getByRole('button', { name: /Saved!|Updated!/ })).toBeVisible({ timeout: 5000 });
    const saved = await app.evaluate(() => globalThis.__savedCfg);
    expect(saved.apiKey).toBe(tricky);
    expect(logs.join('\n')).not.toContain(tricky);
  } finally {
    console.log = orig;
    if (proc.stdout) proc.stdout.off('data', onData);
    if (proc.stderr) proc.stderr.off('data', onData);
  }
  await win.locator('#settingsSkip').click();
});
