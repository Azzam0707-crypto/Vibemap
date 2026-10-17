const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

test('config survives full close + relaunch, both settings entry points', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibemap-ud-'));
  try {
    let app = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`], executablePath: require('electron') });
    let win = await app.firstWindow();
    await win.waitForLoadState('load');
    await win.locator('#settingsLink').click();
    await win.locator('#endpointInput').fill('https://persist.test/v1');
    await win.locator('#modelInput').fill('persist-model');
    await win.locator('#apiKeyInput').fill('sk-persist');
    await win.getByRole('button', { name: 'Save' }).click();
    await expect(win.getByRole('button', { name: 'Saved!' })).toBeVisible();
    const raw = fs.readFileSync(path.join(userDataDir, 'provider.json'), 'utf8');
    expect(raw).not.toContain('sk-persist');
    expect(raw).toContain('https://persist.test/v1');
    await app.close();

    app = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`], executablePath: require('electron') });
    win = await app.firstWindow();
    await win.waitForLoadState('load');
    await win.locator('#settingsLink').click();
    await expect(win.locator('#endpointInput')).toHaveValue('https://persist.test/v1');
    await expect(win.locator('#modelInput')).toHaveValue('persist-model');
    await expect(win.locator('#apiKeyInput')).toHaveValue('sk-persist');
    await win.locator('#settingsSkip').click();
    await app.close();
  } finally {
    for (let i = 0; i < 10; i++) {
      try { fs.rmSync(userDataDir, { recursive: true, force: true }); break; }
      catch { await new Promise((r) => setTimeout(r, 500)); }
    }
  }
});

test('pick-screen settings link also populates saved values', async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibemap-ud-'));
  try {
    let app = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`], executablePath: require('electron') });
    let win = await app.firstWindow();
    await win.waitForLoadState('load');
    await win.locator('#settingsLink').click();
    await win.locator('#endpointInput').fill('https://persist.test/v1');
    await win.locator('#modelInput').fill('persist-model');
    await win.locator('#apiKeyInput').fill('sk-persist');
    await win.getByRole('button', { name: 'Save' }).click();
    await expect(win.getByRole('button', { name: 'Saved!' })).toBeVisible();
    await app.close();

    app = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`], executablePath: require('electron') });
    win = await app.firstWindow();
    await win.waitForLoadState('load');
    await win.locator('#pickSettingsLink').click();
    await expect(win.locator('#settingsScreen')).toBeVisible();
    const keyVal = await win.locator('#apiKeyInput').inputValue();
    console.log('PICK-LINK endpoint=[' + await win.locator('#endpointInput').inputValue() + '] model=[' + await win.locator('#modelInput').inputValue() + '] key=[' + keyVal.slice(0, 4) + '...(len=' + keyVal.length + ')]');
    await expect(win.locator('#endpointInput')).toHaveValue('https://persist.test/v1');
    await expect(win.locator('#modelInput')).toHaveValue('persist-model');
    await expect(win.locator('#apiKeyInput')).toHaveValue('sk-persist');
    await app.close();
  } finally {
    for (let i = 0; i < 10; i++) {
      try { fs.rmSync(userDataDir, { recursive: true, force: true }); break; }
      catch { await new Promise((r) => setTimeout(r, 500)); }
    }
  }
});
