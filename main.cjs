// main.cjs
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');

// --- File Scanner Logic (Translating Python's FileScanner) ---
async function scanDirectory(rootPath, currentPath = rootPath, relativeToRoot = '') {
  const stats = await fs.stat(currentPath);
  const name = path.basename(currentPath);
  
  const node = {
    path: currentPath,
    name: currentPath === rootPath ? rootPath : name,
    type: stats.isDirectory() ? 'directory' : 'file',
    size: stats.size || 0,
    children: []
  };

  let gitignoreRules = [];

  if (stats.isDirectory()) {
    // 1. Check for .gitignore
    try {
      const gitignorePath = path.join(currentPath, '.gitignore');
      const content = await fs.readFile(gitignorePath, 'utf-8');
      const lines = content.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'))
        .map(l => path.posix.join(relativeToRoot.replace(/\\/g, '/'), l));
      gitignoreRules.push(...lines);
    } catch (e) {
      // No .gitignore found, silently continue
    }

    // 2. Read directory children
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    
    // Process directories first, then files (Sorting)
    const sortedEntries = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of sortedEntries) {
      const childPath = path.join(currentPath, entry.name);
      const childRelative = path.posix.join(relativeToRoot.replace(/\\/g, '/'), entry.name);
      
      const { node: childNode, rules: childRules } = await scanDirectory(rootPath, childPath, childRelative);
      
      node.children.push(childNode);
      node.size += childNode.size;
      gitignoreRules.push(...childRules);
    }
  }

  return { node, rules: gitignoreRules };
}
// --- End Scanner Logic ---

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In development, load the Vite dev server. 
  // In production, load the built index.html.
  if (process.env.NODE_ENV !== 'production') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('ping', () => 'pong');

ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('fs:scanDirectory', async (_, dirPath) => {
  try {
    return await scanDirectory(dirPath);
  } catch (error) {
    console.error('Error scanning directory:', error);
    throw error;
  }
});

ipcMain.handle('fs:readFile', async (_, filePath) => {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
});