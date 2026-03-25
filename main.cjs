// main.cjs
// 1. Expand the thread pool immediately to prevent Chokidar/I/O starvation
process.env.UV_THREADPOOL_SIZE = Math.max(16, require('os').cpus().length).toString();

const path = require('path');
const fs = require('fs/promises');
const os = require('os');
const { app, BrowserWindow, ipcMain, dialog, nativeImage, shell } = require('electron');
const chokidar = require('chokidar');
const { performance, monitorEventLoopDelay } = require('perf_hooks');
const fsSync = require('fs'); // Added for Synchronous testing
const { autoUpdater } = require('electron-updater');

// Start monitoring the event loop for lag
const elMonitor = monitorEventLoopDelay({ resolution: 10 });
elMonitor.enable();

const SESSIONS_DIR = path.join(app.getPath('userData'), 'XcerptSessions');

let fileWatcher = null;
let watchedPaths = new Set();
let currentBlacklist = [];
let mainWindow = null;

let isWatcherUpdating = false;
let pendingWatcherUpdate = false;

const TREE_ONLY_REGEX = /\.(lock|png|jpe?g|gif|svg|ico|webp|pdf|mp4|webm|wav|mp3|zip|tar|gz|bz2|7z|bin|dll|exe|so|dylib|class|jar)$/i;
const TREE_ONLY_EXACT = ['.DS_Store', '.env', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

// --- Background Garbage Collection ---
// Silently cleans up old temporary export folders so they don't pile up
async function cleanupOldExports() {
  try {
    const tmpDir = os.tmpdir();
    const files = await fs.readdir(tmpDir);
    const now = Date.now();
    for (const file of files) {
      if (file.startsWith('xcerpt_export_') || file.startsWith('xcerpt_ephemeral_')) {
        const fullPath = path.join(tmpDir, file);
        try {
          const stats = await fs.stat(fullPath);
          // Delete folders older than 1 hour
          if (now - stats.mtimeMs > 3600000) {
            await fs.rm(fullPath, { recursive: true, force: true });
          }
        } catch (e) { /* ignore locked files */ }
      }
    }
  } catch (e) { /* ignore */ }
}

// --- File Scanner Logic ---
async function scanDirectory(rootPath, blacklist, currentPath = rootPath, relativeToRoot = '', isDir = true, context = { gitignoreRules: [], treeOnlyRules: [] }) {
  const name = path.basename(currentPath);

  const node = {
    path: currentPath,
    name: currentPath === rootPath ? rootPath : name,
    type: isDir ? 'directory' : 'file',
    size: 0,
    children: []
  };

  if (!isDir) {
    if (TREE_ONLY_REGEX.test(name) || TREE_ONLY_EXACT.includes(name)) {
      context.treeOnlyRules.push(path.posix.join(relativeToRoot.replace(/\\/g, '/')));
    }
    try {
      const stats = await fs.stat(currentPath);
      node.size = stats.size || 0;
    } catch (e) {
      node.size = 0;
    }
    return { node, rules: context.gitignoreRules, treeOnly: context.treeOnlyRules };
  }

  let entries;
  try {
    entries = await fs.readdir(currentPath, { withFileTypes: true });
  } catch (e) {
    return { node, rules: context.gitignoreRules, treeOnly: context.treeOnlyRules };
  }

  const hasGitignore = entries.some(e => e.name === '.gitignore' && e.isFile());
  if (hasGitignore) {
    try {
      const gitignorePath = path.join(currentPath, '.gitignore');
      const content = await fs.readFile(gitignorePath, 'utf-8');
      const lines = content.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'))
        .map(l => path.posix.join(relativeToRoot.replace(/\\/g, '/'), l));
      context.gitignoreRules.push(...lines);
    } catch (e) {}
  }

  const sortedEntries = entries
    .filter(entry => !blacklist.includes(entry.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  for (const entry of sortedEntries) {
    const childPath = path.join(currentPath, entry.name);
    const childRelative = path.posix.join(relativeToRoot.replace(/\\/g, '/'), entry.name);
    
    const { node: childNode } = await scanDirectory(
      rootPath, 
      blacklist, 
      childPath, 
      childRelative, 
      entry.isDirectory(), 
      context
    );
    
    node.children.push(childNode);
    node.size += childNode.size;
  }

  return { node, rules: context.gitignoreRules, treeOnly: context.treeOnlyRules };
}

// --- Export Engine Logic ---
async function processExport(payload) {
  // Use unique timestamped folder to bypass Windows Defender locking
  const exportDir = path.join(os.tmpdir(), `xcerpt_export_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
  fsSync.mkdirSync(exportDir, { recursive: true });

  const chunkPaths = [];

  for (let i = 0; i < payload.chunks.length; i++) {
    const chunk = payload.chunks[i];
    const chunkDir = path.join(exportDir, `chunk_${chunk.id}`);
    fsSync.mkdirSync(chunkDir, { recursive: true });
    chunkPaths.push(chunkDir);
    
    if (chunk.id === 1) {
      fsSync.writeFileSync(path.join(chunkDir, 'ExportedFileTree.md'), payload.treeMarkdown, 'utf-8');
    }
    
    // Process files synchronously to bypass event-loop starvation from background watchers
    chunk.files.forEach((file) => {
      try {
        const content = fsSync.readFileSync(file.absolutePath, 'utf-8');
        let lines = content.split('\n');
        
        const sortedComps = [...file.compressions].sort((a, b) => b.startLine - a.startLine);
        for (const comp of sortedComps) {
          const skipCount = comp.endLine - comp.startLine + 1;
          const marker = `// ... [Skipped ${skipCount} lines] ...`;
          lines.splice(comp.startLine - 1, skipCount, marker);
        }
        
        const outPath = path.join(chunkDir, file.flatFileName);
        fsSync.writeFileSync(outPath, lines.join('\n'), 'utf-8');
      } catch (err) {
        console.error(`Error processing file ${file.absolutePath}:`, err);
      }
    });
  }

  return chunkPaths;
}

async function processEphemeralExport(payload) {
  const ephemeralDir = path.join(os.tmpdir(), `xcerpt_ephemeral_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
  fsSync.mkdirSync(ephemeralDir, { recursive: true });

  const createdPaths = [];

  const treePath = path.join(ephemeralDir, 'ExportedFileTree.md');
  fsSync.writeFileSync(treePath, payload.treeMarkdown, 'utf-8');
  createdPaths.push(treePath);

  payload.files.forEach((file) => {
    try {
      const content = fsSync.readFileSync(file.absolutePath, 'utf-8');
      let lines = content.split('\n');
      
      const sortedComps = [...file.compressions].sort((a, b) => b.startLine - a.startLine);
      for (const comp of sortedComps) {
        const skipCount = comp.endLine - comp.startLine + 1;
        const marker = `// ... [Skipped ${skipCount} lines] ...`;
        lines.splice(comp.startLine - 1, skipCount, marker);
      }
      
      const outPath = path.join(ephemeralDir, file.flatFileName);
      fsSync.writeFileSync(outPath, lines.join('\n'), 'utf-8');
      createdPaths.push(outPath);
    } catch (err) {
      console.error(`Error processing ephemeral file ${file.absolutePath}:`, err);
    }
  });

  return createdPaths;
}

// --- Watcher Lifecycle Management ---
async function setupWatcher() {
  if (isWatcherUpdating) {
    pendingWatcherUpdate = true;
    return;
  }
  isWatcherUpdating = true;
  pendingWatcherUpdate = false;

  try {
    if (fileWatcher) {
      await fileWatcher.close();
      fileWatcher = null;
    }
    
    if (watchedPaths.size > 0) {
      
      // 1. BULLETPROOF WINDOWS IGNORING:
      // Instead of failing string globs, we split the path natively.
      // If ANY folder in the path matches a blacklist word, Chokidar instantly drops it.
      const ignoreFunc = (testPath) => {
        const pathParts = testPath.split(/[\/\\]/);
        return currentBlacklist.some(b => pathParts.includes(b));
      };
    
      fileWatcher = chokidar.watch(Array.from(watchedPaths), {
        ignored: ignoreFunc,
        persistent: true,
        ignoreInitial: true,
      });
    
      // 2. EVENT SHIELDING:
      // Do not attach the 'all' listener until the initial background scan is 100% complete.
      // This prevents thousands of 'add' events from flooding the IPC bridge and freezing React.
      fileWatcher.on('ready', () => {
        fileWatcher.on('all', (event, filePath) => {
          if (['change', 'add', 'unlink'].includes(event) && mainWindow) {
            mainWindow.webContents.send('fs:file-changed', event, filePath);
          }
        });
      });
    }
  } finally {
    isWatcherUpdating = false;
    if (pendingWatcherUpdate) {
      setupWatcher();
    }
  }
}

// --- Window Management ---
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,
    },
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

app.whenReady().then(async () => {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
  // Fire and forget the temp folder cleanup
  cleanupOldExports().catch(() => {});

  createWindow();

  // Initialize Background Auto-Updater
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (fileWatcher) fileWatcher.close();
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers ---
ipcMain.handle('ping', () => 'pong');

ipcMain.handle('window:minimize', (e) => { BrowserWindow.fromWebContents(e.sender)?.minimize(); });
ipcMain.handle('window:maximize', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win) win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.handle('window:close', (e) => { BrowserWindow.fromWebContents(e.sender)?.close(); });

ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// --- Auto-Updater IPC Handlers ---
autoUpdater.on('update-available', () => {
  if (mainWindow) mainWindow.webContents.send('updater:status', 'update-available');
});

autoUpdater.on('update-downloaded', () => {
  if (mainWindow) mainWindow.webContents.send('updater:status', 'update-downloaded');
});

ipcMain.handle('updater:install', () => {
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle('fs:scanDirectory', async (_, dirPath, blacklist) => {
  try {
    watchedPaths.add(dirPath);
    currentBlacklist = blacklist;
    
    const payload = await scanDirectory(dirPath, blacklist); 
    
    setTimeout(() => {
      setupWatcher().catch(e => console.error("Watcher setup failed:", e));
    }, 500);
    
    return payload;
  } 
  catch (error) { console.error('Error scanning:', error); throw error; }
});

ipcMain.handle('fs:readFile', async (_, filePath) => {
  try { return await fs.readFile(filePath, 'utf-8'); } 
  catch (error) { console.error('Error reading:', error); throw error; }
});

ipcMain.handle('fs:stageExport', async (_, payload) => {
  try { return await processExport(payload); }
  catch (error) { console.error('Error staging export:', error); throw error; }
});

ipcMain.handle('fs:stageEphemeralExport', async (_, payload) => {
  try { return await processEphemeralExport(payload); }
  catch (error) { console.error('Error staging ephemeral export:', error); throw error; }
});

ipcMain.handle('shell:openPath', async (_, targetPath) => {
  return await shell.openPath(targetPath);
});

ipcMain.on('shell:showItemInFolder', (_, targetPath) => {
  shell.showItemInFolder(targetPath);
});

ipcMain.on('drag:start', (e, filePaths) => {
  const iconPath = path.join(__dirname, 'public', 'drag-package.png');
  const icon = nativeImage.createFromPath(iconPath);
  e.sender.startDrag({ files: filePaths, icon: icon });
});

// --- Persistence IPC Handlers ---
ipcMain.handle('app:loadConfig', async () => {
  try {
    const data = await fs.readFile(path.join(SESSIONS_DIR, 'config.json'), 'utf-8');
    return JSON.parse(data);
  } catch (e) { return null; }
});

ipcMain.handle('app:saveConfig', async (_, payload) => {
  await fs.writeFile(path.join(SESSIONS_DIR, 'config.json'), JSON.stringify(payload, null, 2), 'utf-8');
});

ipcMain.handle('app:loadState', async () => {
  try {
    const data = await fs.readFile(path.join(SESSIONS_DIR, 'app.json'), 'utf-8');
    return JSON.parse(data);
  } catch (e) { return null; }
});

ipcMain.handle('app:saveState', async (_, payload) => {
  await fs.writeFile(path.join(SESSIONS_DIR, 'app.json'), JSON.stringify(payload, null, 2), 'utf-8');
});

ipcMain.handle('workspace:loadSession', async (_, id) => {
  try {
    watchedPaths.clear();
    setupWatcher();
    
    const data = await fs.readFile(path.join(SESSIONS_DIR, `${id}.json`), 'utf-8');
    return JSON.parse(data);
  } catch (e) { return null; }
});

ipcMain.handle('workspace:saveSession', async (_, id, payload) => {
  await fs.writeFile(path.join(SESSIONS_DIR, `${id}.json`), JSON.stringify(payload, null, 2), 'utf-8');
});

ipcMain.handle('workspace:getMetadata', async () => {
  try {
    const files = await fs.readdir(SESSIONS_DIR);
    const metadataList = [];
    for (const file of files) {
      if (file === 'app.json' || !file.endsWith('.json')) continue;
      try {
        const data = JSON.parse(await fs.readFile(path.join(SESSIONS_DIR, file), 'utf-8'));
        if (data.metadata) metadataList.push(data.metadata);
      } catch (e) { /* skip malformed */ }
    }
    return metadataList.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  } catch (e) { return []; }
});

ipcMain.handle('workspace:rename', async (_, id, newName) => {
  try {
    const filePath = path.join(SESSIONS_DIR, `${id}.json`);
    const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    data.metadata.name = newName || null;
    data.metadata.updatedAt = new Date().toISOString();
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) { console.error('Failed to rename workspace:', e); }
});

ipcMain.handle('workspace:delete', async (_, id) => {
  try {
    await fs.unlink(path.join(SESSIONS_DIR, `${id}.json`));
  } catch (e) { console.error('Failed to delete workspace:', e); }
});