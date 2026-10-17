const { test, expect, _electron: electron } = require('@playwright/test');
const { launchApp, stubDialog, stubAnalyze, stubConfig } = require('./helpers');

const GROUPED = {
  status: 'ok',
  entries: [
    { filePath: 'src/index.js', entryType: 'file', fileExt: '.js', sizeBytes: 100, depth: 2 },
    { filePath: 'src/a.js', entryType: 'file', fileExt: '.js', sizeBytes: 50, depth: 2 },
    { filePath: 'lib/b.js', entryType: 'file', fileExt: '.js', sizeBytes: 50, depth: 2 },
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
    rootFiles: [],
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

async function openGrouped() {
  await stubDialog(app, 'C:\\fake\\project');
  await stubAnalyze(app, GROUPED);
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
}

test('flat cards render with folder subtitle, no group boxes', async () => {
  await openGrouped();
  await expect(win.locator('.map-group')).toHaveCount(0);
  await expect(win.locator('#mapCanvas > .map-file')).toHaveCount(3);
  await expect(win.locator('.map-file[data-file="src/a.js"]')).toBeVisible();
  await expect(win.locator('.map-file[data-file="lib/b.js"]')).toBeVisible();
  await expect(win.locator('.map-file[data-file="src/a.js"]')).toContainText('src/');
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});

test('no collapse or resize controls in flat mode', async () => {
  await openGrouped();
  await expect(win.locator('.map-group-header')).toHaveCount(0);
  await expect(win.locator('.map-resize')).toHaveCount(0);
  await expect(win.locator('#mapCanvas > .map-file')).toHaveCount(3);
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});

test('connectors render visibly for each edge', async () => {
  await openGrouped();
  await expect(win.locator('.jtk-connector')).toHaveCount(1);
  const vis = await win.locator('.jtk-connector path').evaluateAll((els) => els
    .filter((p) => (p.getAttribute('d') || '').includes('C'))
    .map((p) => ({
      d: p.getAttribute('d'),
      visible: getComputedStyle(p).visibility !== 'hidden' && getComputedStyle(p).display !== 'none',
    })));
  expect(vis).toHaveLength(1);
  expect(vis[0].visible).toBe(true);
  expect(vis[0].d.length).toBeGreaterThan(5);
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});

test('direct and transitive edges render with different styles', async () => {
  await stubDialog(app, 'C:\\fake\\kinds');
  await stubAnalyze(app, {
    ...GROUPED,
    diagram: {
      ...GROUPED.diagram,
      edges: [
        { from: 'src/a.js', to: 'src/index.js', kind: 'direct' },
        { from: 'src/a.js', to: 'lib/b.js', kind: 'transitive' },
      ],
    },
  });
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  await expect(win.locator('.jtk-connector')).toHaveCount(2);
  const strokes = await win.locator('.jtk-connector path').evaluateAll((els) => els
    .filter((p) => (p.getAttribute('d') || '').includes('C'))
    .map((p) => ({
      stroke: p.getAttribute('stroke'),
      dash: p.getAttribute('stroke-dasharray'),
    })));
  expect(strokes).toHaveLength(2);
  expect(strokes[0].stroke).not.toBe(strokes[1].stroke);
  expect(strokes.some((s) => s.dash && s.dash.length > 0)).toBe(true);
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});

test('map legend shows direct and indirect line samples', async () => {
  await openGrouped();
  await expect(win.locator('#legendDirect')).toBeVisible();
  await expect(win.locator('#legendTransitive')).toBeVisible();
  await expect(win.locator('#legendDirect')).toContainText('imports directly');
  await expect(win.locator('#legendTransitive')).toContainText('related indirectly');
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});

test('file cards do not move on drag', async () => {
  await openGrouped();
  const sel = '.map-file[data-file="src/a.js"]';
  const before = await win.locator(sel).boundingBox();
  await win.mouse.move(before.x + 10, before.y + 10);
  await win.mouse.down();
  await win.mouse.move(before.x + 120, before.y + 60, { steps: 10 });
  await win.mouse.up();
  const after = await win.locator(sel).boundingBox();
  expect(Math.round(after.x)).toBe(Math.round(before.x));
  expect(Math.round(after.y)).toBe(Math.round(before.y));
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});

test('flat cards stay fixed size (no resize handle)', async () => {
  await openGrouped();
  const w = await win.locator('.map-file[data-file="src/a.js"]').evaluate((e) => getComputedStyle(e).width);
  expect(parseInt(w)).toBeGreaterThan(100);
  await expect(win.locator('.map-resize')).toHaveCount(0);
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});

test('file click highlights matching change item, no-match does nothing', async () => {
  await openGrouped();
  await win.locator('.map-file[data-file="src/a.js"]').click();
  await expect(win.locator('.change-item.highlighted').first()).toBeVisible();
  await win.waitForTimeout(1700);
  await expect(win.locator('.change-item.highlighted')).toHaveCount(0);
  await win.evaluate(() => {
    document.querySelector('.map-file[data-file="lib/b.js"]').setAttribute('data-file', 'nope/x.js');
  });
  await win.locator('.map-file[data-file="nope/x.js"]').click();
  await expect(win.locator('.change-item.highlighted')).toHaveCount(0);
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});

test('pan on canvas background moves view, card drag does not pan', async () => {
  await openGrouped();
  await win.locator('#mapArea').scrollIntoViewIfNeeded();
  await win.evaluate(() => {
    window.__md = [];
    document.getElementById('mapArea').addEventListener('mousedown', (e) => window.__md.push((e.target.id || e.target.className || '').toString().slice(0, 60)));
  });
  const before = await win.locator('#mapCanvas').evaluate((e) => e.style.transform || 'none');
  const px = await win.evaluate(() => {
    const r = document.getElementById('mapArea').getBoundingClientRect();
    return { x: r.x + r.width - 80, y: Math.min(r.y + r.height - 80, window.innerHeight - 100) };
  });
  await win.mouse.move(px.x, px.y);
  await win.mouse.down();
  await win.mouse.move(px.x - 100, px.y - 100, { steps: 10 });
  await win.mouse.up();
  const after = await win.locator('#mapCanvas').evaluate((e) => e.style.transform || 'none');
  expect(after).not.toBe(before);
  const card = await win.locator('.map-file[data-file="src/a.js"]').boundingBox();
  const panBefore = await win.locator('#mapCanvas').evaluate((e) => e.getAttribute('data-pan'));
  await win.mouse.move(card.x + 10, card.y + 10);
  await win.mouse.down();
  await win.mouse.move(card.x + 60, card.y + 40, { steps: 8 });
  await win.mouse.up();
  const panAfter = await win.locator('#mapCanvas').evaluate((e) => e.getAttribute('data-pan'));
  expect(panAfter).toBe(panBefore);
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});

test('hover shows tooltip after delay', async () => {
  await openGrouped();
  await win.locator('.map-file[data-file="src/a.js"]').hover();
  await expect(win.locator('#mapTip')).toBeVisible({ timeout: 2000 });
  await expect(win.locator('#mapTip')).toContainText('New helper file.');
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});

test('zoom buttons scale', async () => {
  await openGrouped();
  await expect(win.locator('#zoomLabel')).toContainText('100%');
  await win.locator('#zoomIn').click();
  await expect(win.locator('#zoomLabel')).toContainText('125%');
  await win.locator('#zoomOut').click();
  await expect(win.locator('#zoomLabel')).toContainText('100%');
  await expect(win.locator('#zoomFit')).toBeVisible();
  await win.locator('#zoomIn').click();
  await win.locator('#zoomFit').click();
  expect(await win.locator('#mapCanvas').evaluate((e) => e.getAttribute('data-pan'))).toBe('0,0');
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});
