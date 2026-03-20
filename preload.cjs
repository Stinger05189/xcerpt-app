// preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Phase 1: Establish IPC Bridge
  ping: () => ipcRenderer.invoke('ping'),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  scanDirectory: (path) => ipcRenderer.invoke('fs:scanDirectory', path),
  
  // Stubs for future phases
  onFileChange: (callback) => {},
  saveWorkspace: (data) => {},
  stageExport: (config) => {},
  startDrag: (tempFilePath) => {}
});