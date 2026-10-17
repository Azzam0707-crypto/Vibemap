const { test, expect, _electron: electron } = require('@playwright/test');
const { launchApp, stubDialog, stubAnalyze, stubConfig } = require('./helpers');

const EDGES = {
  status: 'ok', entries: [], changes: [],
  diagram: {
    groups: [
      { id: 'src/', label: 'src/', files: [
        { id: 'src/a.js', name: 'a.js', kind: 'script', badge: 'unchanged' },
        { id: 'src/b.js', name: 'b.js', kind: 'script', badge: 'unchanged' },
      ] },
    ],
    rootFiles: [
      { id: 'c.js', name: 'c.js', kind: 'script', badge: 'unchanged' },
      { id: 'd.js', name: 'd.js', kind: 'script', badge: 'unchanged' },
    ],
    edges: [
      { from: 'src/a.js', to: 'src/b.js', kind: 'direct' },
      { from: 'src/a.js', to: 'c.js', kind: 'transitive' },
    ],
  },
  summary: { ok: true, overallSummary: 'x', fileSummaries: [] },
};

const DUPS = {
  status: 'ok', entries: [], changes: [],
  diagram: {
    groups: [{ id: 'src/', label: 'src/', files: [
      { id: 'src/a.js', name: 'a.js', kind: 'script', badge: 'unchanged' },
      { id: 'src/b.js', name: 'b.js', kind: 'script', badge: 'unchanged' },
    ] }],
    rootFiles: [],
    edges: [
      { from: 'src/a.js', to: 'src/b.js', kind: 'direct' },
      { from: 'src/a.js', to: 'src/b.js', kind: 'transitive' },
    ],
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

async function openWith(payload, folder) {
  await stubDialog(app, folder);
  await stubAnalyze(app, payload);
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  await expect(win.locator('.jtk-connector')).toHaveCount(payload.diagram.edges.length, { timeout: 5000 });
}

test('bezier with arrows', async () => {
  await openWith(EDGES, 'C:\\fake\\curves');
  const opts = await win.evaluate(() => window.__mapConnectorOpts || null);
  expect(opts).not.toBeNull();
  expect(opts.name).toBe('Bezier');
  expect(opts.curviness).toBe(50);
  const arrows = await win.evaluate(() => window.__mapArrowCount || 0);
  expect(arrows).toBe(2);
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});

test('duplicate edges fan out', async () => {
  await openWith(DUPS, 'C:\\fake\\dups');
  const curves = await win.evaluate(() => window.__mapEdgeCurviness || []);
  expect(curves.length).toBe(2);
  expect(curves[0].curviness).not.toBe(curves[1].curviness);
  const ds = await win.locator('.jtk-connector path').evaluateAll((els) => els
    .filter((p) => (p.getAttribute('d') || '').includes('C'))
    .map((p) => p.getAttribute('d')));
  expect(new Set(ds).size).toBe(2);
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});
