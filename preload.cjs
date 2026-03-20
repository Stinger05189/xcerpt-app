const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Phase 1: Establish IPC Bridge
  ping: () => ipcRenderer.invoke('ping'),
  
  // Stubs for future phases
  scanDirectory: (path) => {},
  onFileChange: (callback) => {},
  saveWorkspace: (data) => {},
  stageExport: (config) => {},
  startDrag: (tempFilePath) => {}
});