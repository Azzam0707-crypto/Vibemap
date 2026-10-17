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

test('pick shows scanning then dashboard with cards and map', async () => {
  await stubDialog(app, 'C:\\fake\\project');
  await stubAnalyze(app, FIXTURE_OK, 1500);
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#scanScreen')).toBeVisible();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  await expect(win.locator('#recapText')).toContainText('helper');
  await expect(win.locator('.change-item')).toHaveCount(1);
  await expect(win.locator('.map-node')).toHaveCount(2);
  const pos = await win.locator('.map-node').evaluateAll((els) => els.map((e) => e.style.left + ',' + e.style.top));
  expect(new Set(pos).size).toBe(2);
});

test('empty folder shows empty state and back button', async () => {
  await win.reload();
  win = await app.firstWindow();
  await stubDialog(app, 'C:\\fake\\empty');
  await stubAnalyze(app, { status: 'empty' });
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#errorScreen')).toBeVisible({ timeout: 10000 });
  await expect(win.locator('#errorScreen')).toContainText('This folder looks empty');
  await win.getByRole('button', { name: 'Choose another folder' }).click();
  await expect(win.locator('#pickScreen')).toBeVisible();
});

test('ai failure shows ai error state', async () => {
  await win.reload();
  win = await app.firstWindow();
  await stubDialog(app, 'C:\\fake\\project');
  await stubAnalyze(app, { status: 'ai-error', error: 'boom' });
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#errorScreen')).toBeVisible({ timeout: 10000 });
  await expect(win.locator('#errorScreen')).toContainText("Couldn't reach the AI");
});
