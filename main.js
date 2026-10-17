const { app, BrowserWindow, dialog, ipcMain, safeStorage } = require('electron');
const path = require('path');
const { analyzeFolder } = require('./analyze');
const { saveProviderConfig, loadProviderConfig } = require('./provider-config');
const { fetchModels } = require('./models');
const { loadHistory, saveEntry } = require('./history');

const userDir = () => app.getPath('userData');

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 900,
    backgroundColor: '#faf9fd',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true
    }
  });
  win.loadFile('index.html');
}

ipcMain.handle('analyze-folder', async (event, folder) => {
  const send = (p) => { try { if (win) win.webContents.send('analyze-progress', p); } catch (e) {} };
  const result = await analyzeFolder(folder, await loadProviderConfig(userDir(), safeStorage), send);
  if (result && result.status === 'ai-error') console.log('analyze-folder ai-error:', result.error);
  if (result && result.status === 'ok') {
    try {
      await saveEntry(userDir(), {
        folderPath: folder,
        folderName: String(folder).split(/[\\/]/).filter(Boolean).pop() || String(folder),
        lastScannedAt: new Date().toISOString(),
        result,
      });
    } catch (e) { console.log('history save failed:', e && e.message); }
  }
  return result;
});

ipcMain.handle('get-scan-history', async () => loadHistory(userDir()));

ipcMain.handle('open-history-entry', async (event, folderPath) => {
  const list = await loadHistory(userDir());
  const hit = list.find((e) => e.folderPath === folderPath);
  return hit ? hit.result : null;
});

ipcMain.handle('save-provider-config', async (event, cfg) => {
  const logged = { ...(cfg || {}), apiKey: cfg && cfg.apiKey ? '<redacted>' : undefined };
  console.log('save-provider-config received:', JSON.stringify(logged));
  const saved = await saveProviderConfig(userDir(), cfg, safeStorage);
  console.log('save-provider-config written to:', userDir());
  return saved;
});

ipcMain.handle('get-provider-config', async () => loadProviderConfig(userDir(), safeStorage));

ipcMain.handle('fetch-models', async (event, cfg) => fetchModels(cfg || await loadProviderConfig(userDir(), safeStorage)));

ipcMain.handle('pick-folder', async () => {
  const res = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  const selected = res.canceled ? null : res.filePaths[0] || null;
  console.log(selected);
  return selected;
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
