const fs = require('fs');
const os = require('os');
const path = require('path');

async function launchApp(electron) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibemap-ud-'));
  const app = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`], executablePath: require('electron') });
  const win = await app.firstWindow();
  // Clicks dispatched before DOMContentLoaded handlers attach are silently lost
  // (static buttons paint before dashboard.js wires them). Wait for load first.
  await win.waitForLoadState('load');
  // ponytail: auto-clean temp profile on close; upgrade to explicit fixture if per-test dirs needed.
  const origClose = app.close.bind(app);
  let cleaned = false;
  app.close = async (...a) => {
    try { await origClose(...a); } finally {
      if (!cleaned) {
        cleaned = true;
        for (let i = 0; i < 10; i++) {
          try { fs.rmSync(userDataDir, { recursive: true, force: true }); break; }
          catch { await new Promise((r) => setTimeout(r, 500)); }
        }
      }
    }
  };
  return {
    app,
    win,
    userDataDir,
    cleanup: async () => {
      try { await app.close(); } catch {}
      for (let i = 0; i < 10; i++) {
        try { fs.rmSync(userDataDir, { recursive: true, force: true }); break; }
        catch { await new Promise((r) => setTimeout(r, 500)); }
      }
    },
  };
}

async function stubDialog(app, folder) {
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] });
  }, folder);
}

async function stubAnalyze(app, result, delayMs = 0) {
  await app.evaluate(({ ipcMain }, args) => {
    try { ipcMain.removeHandler('analyze-folder'); } catch (e) {}
    ipcMain.handle('analyze-folder', async () => {
      if (args.delayMs) await new Promise((r) => setTimeout(r, args.delayMs));
      return args.result;
    });
  }, { result, delayMs });
}

const FIXTURE_OK = {
  status: 'ok',
  entries: [
    { filePath: 'App.js', entryType: 'file', fileExt: '.js', sizeBytes: 100, depth: 1 },
    { filePath: 'utils.js', entryType: 'file', fileExt: '.js', sizeBytes: 50, depth: 1 },
  ],
  changes: [{ filePath: 'App.js', changeType: 'modified', diffText: '', linesAdded: 1, linesRemoved: 0 }],
  diagram: {
    nodes: [
      { id: 'App.js', label: 'App.js', type: 'file', x: 100, y: 100 },
      { id: 'utils.js', label: 'utils.js', type: 'file', x: 400, y: 100 },
    ],
    edges: [{ from: 'App.js', to: 'utils.js' }],
  },
  summary: {
    ok: true,
    overallSummary: 'Your project gained a helper and wired it into the main screen.',
    fileSummaries: [{ filePath: 'App.js', summary: 'Main screen now uses the helper.' }],
  },
};

async function stubConfig(app, cfg) {
  const finalCfg = cfg === undefined ? { type: 'cloud', endpoint: 'https://test.local', apiKey: 'k', model: 'm' } : cfg;
  await app.evaluate(async ({ ipcMain, BrowserWindow }, c) => {
    try { ipcMain.removeHandler('get-provider-config'); } catch (e) {}
    ipcMain.handle('get-provider-config', async () => c);
    // Fresh temp profile has no provider.json, so the pick-gate left the
    // button disabled on load. Sync it now that the stub is installed.
    try {
      const on = !!c;
      await Promise.all(BrowserWindow.getAllWindows().map((w) =>
        w.webContents.executeJavaScript(`typeof showPickGate==="function"&&showPickGate(${on})`).catch(() => {})));
    } catch (e) {}
  }, finalCfg);
}

module.exports = { launchApp, stubDialog, stubAnalyze, stubConfig, FIXTURE_OK };
