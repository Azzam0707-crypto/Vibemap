const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vibemap', {
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  analyzeFolder: (folder) => ipcRenderer.invoke('analyze-folder', folder),
  saveProviderConfig: (cfg) => ipcRenderer.invoke('save-provider-config', cfg),
  getProviderConfig: () => ipcRenderer.invoke('get-provider-config'),
  fetchModels: (cfg) => ipcRenderer.invoke('fetch-models', cfg),
  getScanHistory: () => ipcRenderer.invoke('get-scan-history'),
  openHistoryEntry: (folderPath) => ipcRenderer.invoke('open-history-entry', folderPath),
  onAnalyzeProgress: (cb) => {
    const listener = (event, p) => cb(p);
    ipcRenderer.on('analyze-progress', listener);
    return () => ipcRenderer.removeListener('analyze-progress', listener);
  }
});
