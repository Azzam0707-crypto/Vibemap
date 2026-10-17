const { test, expect, _electron: electron } = require('@playwright/test');
const { launchApp, stubDialog, stubAnalyze, stubConfig } = require('./helpers');

const GROUPED = {
  status: 'ok',
  entries: [
    { filePath: 'src/index.js', entryType: 'file', fileExt: '.js', sizeBytes: 100, depth: 2 },
    { filePath: 'src/a.js', entryType: 'file', fileExt: '.js', sizeBytes: 50, depth: 2 },
    { filePath: 'lib/b.js', entryType: 'file', fileExt: '.js', sizeBytes: 50, depth: 2 },
    { filePath: 'root.js', entryType: 'file', fileExt: '.js', sizeBytes: 10, depth: 1 },
  ],
  changes: [
    { filePath: 'src/a.js', changeType: 'added', diffText: '', linesAdded: 5, linesRemoved: 0 },
    { filePath: 'lib/b.js', changeType: 'modified', diffText: '', linesAdded: 1, linesRemoved: 1 },
  ],
  diagram: {
    groups: [
      { id: 'src/', label: 'src/', files: [
        { id: 'src/index.js', name: 'index.js', kind: 'script', badge: 'unchanged' },
        { id: 'src/a.js', name: 'a.js', kind: 'script', badge: 'new' },
      ] },
      { id: 'lib/', label: 'lib/', files: [
        { id: 'lib/b.js', name: 'b.js', kind: 'script', badge: 'changed' },
      ] },
    ],
    rootFiles: [{ id: 'root.js', name: 'root.js', kind: 'script', badge: 'unchanged' }],
    edges: [{ from: 'src/a.js', to: 'lib/b.js' }],
  },
  summary: {
    ok: true,
    overallSummary: 'Your project gained a helper in another area.',
    fileSummaries: [
      { filePath: 'src/a.js', summary: 'New helper file.' },
      { filePath: 'lib/b.js', summary: 'Now uses the helper.' },
    ],
  },
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

test('flat grid, folder subtitle, no groups', async () => {
  await stubDialog(app, 'C:\\fake\\flat');
  await stubAnalyze(app, GROUPED);
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  await expect(win.locator('.map-group')).toHaveCount(0);
  expect(await win.locator('#mapCanvas > .map-file').count()).toBe(4);
  const sub = await win.locator('.map-file[data-file=\"src/a.js\"] span span:last-child').textContent();
  expect(sub).toContain('src/');
});
