const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal, safe IPC surface to the renderer process.
contextBridge.exposeInMainWorld('api', {
  openFile: () => ipcRenderer.invoke('open-file'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', { filePath, content }),
  print: () => ipcRenderer.invoke('print'),
  exportPdf: (suggestedName) => ipcRenderer.invoke('export-pdf', suggestedName),
  pickMedia: (mediaType) => ipcRenderer.invoke('pick-media', mediaType),
  showAbout: () => ipcRenderer.invoke('show-about'),
  openDownload: () => ipcRenderer.invoke('open-download'),
  onUpdateAvailable: (callback) =>
    ipcRenderer.on('update-available', (event, info) => callback(info)),
  getVersion: () => ipcRenderer.invoke('get-version'),
  getLaunchFile: () => ipcRenderer.invoke('get-launch-file'),
  onOpenExternalFile: (callback) =>
    ipcRenderer.on('open-external-file', (event, file) => callback(file)),
  confirmSave: (fileName) => ipcRenderer.invoke('confirm-save', fileName),
  confirmClose: () => ipcRenderer.invoke('confirm-close'),
  onAppCloseRequest: (callback) =>
    ipcRenderer.on('app-close-request', () => callback()),
  i18nGet: () => ipcRenderer.invoke('i18n-get'),
  i18nSet: (locale) => ipcRenderer.invoke('i18n-set', locale),
  loadSession: () => ipcRenderer.invoke('load-session'),
  saveSession: (session) => ipcRenderer.invoke('save-session', session)
});
