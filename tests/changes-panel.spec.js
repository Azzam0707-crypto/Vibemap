const { test, expect, _electron: electron } = require('@playwright/test');
const { launchApp, stubDialog, stubAnalyze, stubConfig } = require('./helpers');

const MANY = {
  status: 'ok',
  entries: [],
  changes: [],
  diagram: { groups: [], rootFiles: [], edges: [] },
  summary: {
    ok: true,
    overallSummary: 'Big project recap.',
    fileSummaries: [
      { filePath: 'a.js', summary: 'The entry point that starts everything.' },
      { filePath: 'b.js', summary: 'Handles login and user sessions.' },
      { filePath: 'c.js', summary: 'Draws the project map on screen.' },
      { filePath: 'd.js', summary: 'Reads files from your folder.' },
      { filePath: 'e.js', summary: 'Talks to the AI service.' },
      { filePath: 'f.js', summary: 'Caches your recent scans.' },
      { filePath: 'g.js', summary: 'Formats dates and times.' },
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

async function openMany() {
  await stubDialog(app, 'C:\\fake\\big');
  await stubAnalyze(app, MANY);
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
}

test('panel shows first 5 with See-all button when over cap', async () => {
  await openMany();
  await expect(win.locator('.change-item')).toHaveCount(5);
  await expect(win.locator('#seeAllBtn')).toBeVisible();
  await expect(win.locator('#seeAllBtn')).toContainText('See all file information');
  await expect(win.locator('.change-item').first()).toContainText('a.js');
  await expect(win.locator('.change-item').first()).toContainText('starts everything');
  await win.getByRole('button', { name: 'See all file information' }).click();
  await expect(win.locator('.change-item')).toHaveCount(7);
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});

test('no button when at or under cap', async () => {
  await stubDialog(app, 'C:\\fake\\small');
  await stubAnalyze(app, {
    status: 'ok', entries: [], changes: [],
    diagram: { groups: [], rootFiles: [], edges: [] },
    summary: { ok: true, overallSummary: 'Small.', fileSummaries: [{ filePath: 'a.js', summary: 'Only file here.' }] },
  });
  await win.getByRole('button', { name: 'Pick a project folder' }).click();
  await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
  await expect(win.locator('.change-item')).toHaveCount(1);
  await expect(win.locator('#seeAllBtn')).toBeHidden();
  await win.getByRole('button', { name: 'Choose a different project' }).click();
});
