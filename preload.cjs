// preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('ping'),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  scanDirectory: (path) => ipcRenderer.invoke('fs:scanDirectory', path),
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
  // Stubs for future phases
  onFileChange: (callback) => {},
  saveWorkspace: (data) => {},
  stageExport: (config) => {},
  startDrag: (tempFilePath) => {}
});