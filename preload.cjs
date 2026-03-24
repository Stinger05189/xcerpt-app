// preload.cjs
const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('ping'),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  scanDirectory: (path, blacklist) => ipcRenderer.invoke('fs:scanDirectory', path, blacklist),
  readFile: (path) => ipcRenderer.invoke('fs:readFile', path),

  // Window Controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  setZoomFactor: (factor) => webFrame.setZoomFactor(factor),

  // Export Engine & Native OS
  stageExport: (payload) => ipcRenderer.invoke('fs:stageExport', payload),
  stageEphemeralExport: (payload) => ipcRenderer.invoke('fs:stageEphemeralExport', payload),
  startDrag: (filePaths) => ipcRenderer.send('drag:start', filePaths),
  openPath: (path) => ipcRenderer.invoke('shell:openPath', path),
  showItemInFolder: (path) => ipcRenderer.send('shell:showItemInFolder', path),

  // Persistence API
  loadAppConfig: () => ipcRenderer.invoke('app:loadConfig'),
  saveAppConfig: (config) => ipcRenderer.invoke('app:saveConfig', config),
  loadAppState: () => ipcRenderer.invoke('app:loadState'),
  saveAppState: (payload) => ipcRenderer.invoke('app:saveState', payload),
  loadSession: (id) => ipcRenderer.invoke('workspace:loadSession', id),
  saveSession: (id, payload) => ipcRenderer.invoke('workspace:saveSession', id, payload),
  getWorkspaceMetadata: () => ipcRenderer.invoke('workspace:getMetadata'),
  renameWorkspace: (id, newName) => ipcRenderer.invoke('workspace:rename', id, newName),
  deleteWorkspace: (id) => ipcRenderer.invoke('workspace:delete', id),

  // Listeners
  onFileChange: (callback) => {
    const handler = (_, eventType, path) => callback(eventType, path);
    ipcRenderer.on('fs:file-changed', handler);
    return () => ipcRenderer.removeListener('fs:file-changed', handler);
  },

  saveWorkspace: (data) => {}
});