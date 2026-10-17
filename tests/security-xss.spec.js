const { test, expect, _electron: electron } = require('@playwright/test');
const { launchApp, stubDialog, stubAnalyze, stubConfig } = require('./helpers');

const EVIL = '"><img src=x onerror=alert(1)>.js';
const PAYLOAD = {
  status: 'ok', entries: [], changes: [],
  diagram: {
    groups: [],
    rootFiles: [{ id: EVIL, name: EVIL, kind: 'script', badge: 'unchanged', group: 'evil/><b>.js' }],
    edges: [],
  },
  summary: { ok: true, overallSummary: 'x', fileSummaries: [] },
};

let app;
let win;

test.beforeAll(async () => {
  ({ app, win } = await launchApp(electron));
  await stubConfig(app);
});

test.afterAll(async () => {
  if (app) await app.close();
});

test('crafted filename renders as literal text, no img element', async () => {
  await stubDialog(app, 'C:\\fake\\xss');
  await stubAnalyze(app, PAYLOAD);
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  await expect(win.locator('#mapCanvas > .map-file')).toHaveCount(1);
  expect(await win.locator('#mapCanvas .map-file img').count()).toBe(0);
  const txt = await win.locator('#mapCanvas .map-file').first().textContent();
  expect(txt).toContain('"><img src=x onerror=alert(1)>.js');
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});
