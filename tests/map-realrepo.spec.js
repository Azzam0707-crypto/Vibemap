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

test('real repo: noise absent, dagre ranks, screenshot', async () => {
  const entries = await scanFolder('.');
  const files = entries.filter((e) => e.entryType === 'file').map((e) => e.filePath);
  // synthetic import chain over real file names so edges exist
  const pick = ['dashboard.js', 'diagram.js', 'scanner.js', 'analyze.js', 'main.js', 'preload.js', 'provider-config.js', 'models.js', 'parser.js', 'refs.js', 'summarizer.js', 'git-reader.js'].filter((f) => files.includes(f));
  expect(pick.length).toBeGreaterThanOrEqual(8);
  const parsed = pick.map((f, i) => ({
    filePath: f, functionsAdded: [], functionsRemoved: [], functionsModified: [],
    importsChanged: i + 1 < pick.length ? ['./' + pick[i + 1]] : [],
  }));
  const diagram = generateDiagram(entries.filter((e) => pick.includes(e.filePath)), parsed, []);
  const ids = [...diagram.groups.flatMap((g) => g.files.map((f) => f.id)), ...diagram.rootFiles.map((f) => f.id)];
  const noise = ids.filter((p) => /\.(asar|exe|dll|so)$/i.test(p) || /^(release|dist-release|out|coverage|test-results)\//.test(p) || p === '.last-run.json' || p.startsWith('docs/superpowers/'));
  expect(noise).toEqual([]);
  expect(diagram.edges.length).toBeGreaterThan(0);
  // dagre ranks: chain head left of chain tail
  expect(diagram.positions[pick[0]].x).toBeLessThan(diagram.positions[pick[pick.length - 1]].x);
  await stubDialog(app, 'C:\\fake\\realrepo');
  await stubAnalyze(app, {
    status: 'ok', entries: [], changes: [],
    diagram, summary: { ok: true, overallSummary: 'real repo chain', fileSummaries: [] },
  });
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  await expect(win.locator('.map-group')).toHaveCount(0);
  await win.waitForTimeout(800);
  await win.locator('#mapArea').screenshot({ path: 'test-results/dagre-realrepo-grid.png' });
  await win.locator('#zoomFit').click();
  await win.waitForTimeout(300);
  await win.locator('#mapArea').screenshot({ path: 'test-results/dagre-realrepo.png' });
});
