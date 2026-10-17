const { test, expect, _electron: electron } = require('@playwright/test');
const { launchApp, stubDialog, stubAnalyze, stubConfig, FIXTURE_OK } = require('./helpers');

let app;
let win;

test.beforeAll(async () => {
  ({ app, win } = await launchApp(electron));
  await stubConfig(app);
});

test.afterAll(async () => {
  if (app) await app.close();
});

test('switch-project button sits below map area', async () => {
  await stubDialog(app, 'C:\\fake\\switchbtn');
  await stubAnalyze(app, FIXTURE_OK);
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  const btn = win.getByRole('button', { name: 'Choose a different project' });
  await expect(btn).toBeVisible();
  const pos = await btn.evaluate((b) => {
    const r = b.getBoundingClientRect();
    const m = document.getElementById('mapArea').getBoundingClientRect();
    return { btnTop: r.top, mapBottom: m.bottom, btnLeft: r.left, mapLeft: m.left };
  });
  expect(pos.btnTop).toBeGreaterThanOrEqual(pos.mapBottom - 4);
  await btn.click();
  await expect(win.locator('#pickScreen')).toBeVisible();
});
