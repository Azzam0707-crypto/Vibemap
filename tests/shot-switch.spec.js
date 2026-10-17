const { test, expect, _electron: electron } = require('@playwright/test');
const { launchApp, stubDialog, stubAnalyze, stubConfig } = require('./helpers');
const { generateDiagram } = require('../diagram');
const { scanFolder } = require('../scanner');

let app;
let win;

test.beforeAll(async () => {
  ({ app, win } = await launchApp(electron));
  await stubConfig(app);
});

test.afterAll(async () => {
  if (app) await app.close();
});

test('shot: button below map area', async () => {
  const entries = await scanFolder('.');
  const files = entries.filter((e) => e.entryType === 'file').map((e) => e.filePath);
  const pick = ['dashboard.js', 'diagram.js', 'scanner.js', 'analyze.js', 'main.js', 'preload.js', 'provider-config.js', 'models.js'].filter((f) => files.includes(f));
  const parsed = pick.map((f, i) => ({
    filePath: f, functionsAdded: [], functionsRemoved: [], functionsModified: [],
    importsChanged: i + 1 < pick.length ? ['./' + pick[i + 1]] : [],
  }));
  const diagram = generateDiagram(entries.filter((e) => pick.includes(e.filePath)), parsed, []);
  await stubDialog(app, 'C:\\fake\\switchshot');
  await stubAnalyze(app, { status: 'ok', entries: [], changes: [], diagram, summary: { ok: true, overallSummary: 'x', fileSummaries: [] } });
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  await win.waitForTimeout(800);
  await win.screenshot({ path: 'test-results/switch-button-below-map.png' });
});
