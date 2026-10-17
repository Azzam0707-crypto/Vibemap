const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launchApp, stubDialog, stubConfig, FIXTURE_OK } = require('./helpers');

test('analyzeFolder emits stages in order', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vibemap-prog-'));
  try {
    fs.writeFileSync(path.join(tmp, 'a.js'), 'function a() {}\n');
    const { analyzeFolder } = require('../analyze');
    const seen = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ overallSummary: 's', fileSummaries: [] }) } }] }) });
    try {
      await analyzeFolder(tmp, { type: 'cloud', endpoint: 'https://x.test', apiKey: 'k', model: 'm' }, (p) => seen.push(p));
    } finally {
      globalThis.fetch = origFetch;
    }
    expect(seen.map((s) => s.stage)).toEqual(['scanning', 'analyzing', 'summarizing', 'mapping']);
    expect(seen.every((s) => typeof s.files === 'number' && s.files >= 1)).toBe(true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('scan UI updates stage text, bar and count over time', async () => {
  const { app, win } = await launchApp(electron);
  try {
    await stubConfig(app);
    await stubDialog(app, 'C:\\fake\\project');
    await app.evaluate(({ ipcMain, BrowserWindow }, result) => {
      const stages = ['scanning', 'analyzing', 'summarizing', 'mapping'];
      try { ipcMain.removeHandler('analyze-folder'); } catch (e) {}
      ipcMain.handle('analyze-folder', async () => {
        const w = BrowserWindow.getAllWindows()[0];
        for (const s of stages) {
          w.webContents.send('analyze-progress', { stage: s, files: 42 });
          await new Promise((r) => setTimeout(r, 400));
        }
        return result;
      });
    }, FIXTURE_OK);
    await win.getByRole('button', { name: 'Pick a project folder' }).click();
    await expect(win.locator('#scanScreen')).toBeVisible();
    const observed = new Set();
    const counts = new Set();
    for (let i = 0; i < 20; i++) {
      const t = await win.locator('#scanStage').textContent();
      const w = await win.locator('#scanBar').evaluate((e) => e.style.width);
      const c = await win.locator('#scanCount').textContent();
      observed.add(t + '|' + w);
      counts.add(c);
      if (await win.locator('#dashScreen').isVisible()) break;
      await win.waitForTimeout(200);
    }
    expect([...observed].some((o) => o.startsWith('Reading your project'))).toBe(true);
    expect([...observed].some((o) => o.startsWith('Looking at what changed'))).toBe(true);
    expect([...observed].some((o) => o.startsWith('Writing your summary'))).toBe(true);
    expect([...observed].some((o) => o.startsWith('Building the map'))).toBe(true);
    expect([...observed].map((o) => o.split('|')[1]).filter(Boolean).length).toBeGreaterThan(1);
    await expect(win.locator('#dashScreen')).toBeVisible({ timeout: 10000 });
    expect([...counts].some((c) => c.includes('42'))).toBe(true);
  } finally {
    await app.close();
  }
});
