// preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('ping'),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  scanDirectory: (path, blacklist) => ipcRenderer.invoke('fs:scanDirectory', path, blacklist),
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),

  // Window Controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),

  // Stubs for future phases
  onFileChange: (callback) => {},
  saveWorkspace: (data) => {},
  stageExport: (config) => {},
  startDrag: (tempFilePath) => {}
});