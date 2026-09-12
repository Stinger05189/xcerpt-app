// main.cjs
// 1. Expand the thread pool immediately to prevent Chokidar/I/O starvation
process.env.UV_THREADPOOL_SIZE = Math.max(16, require('os').cpus().length).toString();

const path = require('path');
const fs = require('fs/promises');
const os = require('os');
const { app, BrowserWindow, ipcMain, dialog, nativeImage, shell } = require('electron');
const chokidar = require('chokidar');
const { performance, monitorEventLoopDelay } = require('perf_hooks');
const fsSync = require('fs');
const { autoUpdater } = require('electron-updater');
const { exec } = require('child_process');
const ignore = require('ignore');

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
          if (now - stats.mtimeMs > 3600000) {
            await fs.rm(fullPath, { recursive: true, force: true });
          }
        } catch (e) { /* ignore locked files */ }
      }
    }
  } catch (e) { /* ignore */ }
}

// --- File Scanner Logic ---
async function scanDirectory(rootPath, blacklist, respectGitignore = true, currentPath = rootPath, relativeToRoot = '', isDir = true, context = { gitignoreRules: [], treeOnlyRules: [] }) {
  const name = path.basename(currentPath);
  const node = {
    path: currentPath,
    name: currentPath === rootPath ? rootPath : name,
    type: isDir ? 'directory' : 'file',
    size: 0,
    children: []
  };

  if (currentPath === rootPath) {
    try {
      await fs.stat(rootPath);
    } catch (e) {
      return { node, rules: [], treeOnly: [], isMissing: true };
    }
  }

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
    return { node, rules: context.gitignoreRules, treeOnly: context.treeOnlyRules, isMissing: false };
  }

  let entries;
  try {
    entries = await fs.readdir(currentPath, { withFileTypes: true });
  } catch (e) {
    return { node, rules: context.gitignoreRules, treeOnly: context.treeOnlyRules, isMissing: false };
  }

  if (respectGitignore) {
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
  }

  const ig = ignore();
  ig.add(blacklist);
  if (respectGitignore && context.gitignoreRules.length > 0) {
    ig.add(context.gitignoreRules);
  }

  const sortedEntries = entries
    .filter(entry => {
      const childRelative = path.posix.join(relativeToRoot.replace(/\\/g, '/'), entry.name);
      if (ig.ignores(childRelative) || blacklist.includes(entry.name)) return false;
      return true;
    })
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
      respectGitignore,
      childPath, 
      childRelative, 
      entry.isDirectory(), 
      context
    );
    node.children.push(childNode);
    node.size += childNode.size;
  }

  return { node, rules: context.gitignoreRules, treeOnly: context.treeOnlyRules, isMissing: false };
}

// --- Export Engine Logic ---
async function processExport(payload) {
  const exportDir = path.join(os.tmpdir(), `xcerpt_export_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
  fsSync.mkdirSync(exportDir, { recursive: true });

  const chunkPaths = [];
  const manifestFileName = payload.manifestFileName || 'ExportedFileTree.md';

  if (payload.mergeToSingleFile) {
    const chunkDir = path.join(exportDir, `chunk_1`);
    fsSync.mkdirSync(chunkDir, { recursive: true });
    chunkPaths.push(chunkDir);

    let combinedContent = `# Exported Workspace Context\n\n`;
    combinedContent += `## Manifest & File Tree\n\`\`\`text\n${payload.treeMarkdown}\n\`\`\`\n\n`;
    combinedContent += `## Files\n\n`;

    const allFiles = payload.chunks.flatMap(c => c.files);
    allFiles.forEach((file) => {
      try {
        const content = fsSync.readFileSync(file.absolutePath, 'utf-8');
        let lines = content.split('\n');
        const sortedComps = [...(file.compressions || [])].sort((a, b) => b.startLine - a.startLine);
        for (const comp of sortedComps) {
          const skipCount = comp.endLine - comp.startLine + 1;
          const marker = `// ... [Skipped ${skipCount} lines] ...`;
          lines.splice(comp.startLine - 1, skipCount, marker);
        }
        
        const ext = path.extname(file.flatFileName).slice(1) || 'text';
        combinedContent += `### ${file.relativePath}\n\n`;
        combinedContent += `\`\`\`${ext}\n${lines.join('\n')}\n\`\`\`\n\n`;
      } catch (err) {
        console.error(`Error processing file ${file.absolutePath}:`, err);
      }
    });

    fsSync.writeFileSync(path.join(chunkDir, 'context.md'), combinedContent, 'utf-8');
    return chunkPaths;
  }

  for (let i = 0; i < payload.chunks.length; i++) {
    const chunk = payload.chunks[i];
    const chunkDir = path.join(exportDir, `chunk_${chunk.id}`);
    fsSync.mkdirSync(chunkDir, { recursive: true });
    chunkPaths.push(chunkDir);

    if (chunk.id === 1) {
      fsSync.writeFileSync(path.join(chunkDir, manifestFileName), payload.treeMarkdown, 'utf-8');
    }
    
    chunk.files.forEach((file) => {
      try {
        const content = fsSync.readFileSync(file.absolutePath, 'utf-8');
        let lines = content.split('\n');
        
        const sortedComps = [...(file.compressions || [])].sort((a, b) => b.startLine - a.startLine);
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
  const manifestFileName = payload.manifestFileName || 'ExportedFileTree.md';

  if (payload.mergeToSingleFile) {
    let combinedContent = `# Ephemeral Quick Export\n\n`;
    combinedContent += `## Manifest & File Tree\n\`\`\`text\n${payload.treeMarkdown}\n\`\`\`\n\n`;
    combinedContent += `## Files\n\n`;

    payload.files.forEach((file) => {
      try {
        const content = fsSync.readFileSync(file.absolutePath, 'utf-8');
        let lines = content.split('\n');
        const sortedComps = [...(file.compressions || [])].sort((a, b) => b.startLine - a.startLine);
        for (const comp of sortedComps) {
          const skipCount = comp.endLine - comp.startLine + 1;
          const marker = `// ... [Skipped ${skipCount} lines] ...`;
          lines.splice(comp.startLine - 1, skipCount, marker);
        }
        
        const ext = path.extname(file.flatFileName).slice(1) || 'text';
        combinedContent += `### ${file.relativePath}\n\n`;
        combinedContent += `\`\`\`${ext}\n${lines.join('\n')}\n\`\`\`\n\n`;
      } catch (err) {
        console.error(`Error processing ephemeral file ${file.absolutePath}:`, err);
      }
    });

    const contextPath = path.join(ephemeralDir, 'context.md');
    fsSync.writeFileSync(contextPath, combinedContent, 'utf-8');
    createdPaths.push(contextPath);
    return createdPaths;
  }

  const treePath = path.join(ephemeralDir, manifestFileName);
  fsSync.writeFileSync(treePath, payload.treeMarkdown, 'utf-8');
  createdPaths.push(treePath);

  payload.files.forEach((file) => {
    try {
      const content = fsSync.readFileSync(file.absolutePath, 'utf-8');
      let lines = content.split('\n');
      
      const sortedComps = [...(file.compressions || [])].sort((a, b) => b.startLine - a.startLine);
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
      const ignoreFunc = (testPath) => {
        const pathParts = testPath.split(/[\/\\]/);
        return currentBlacklist.some(b => pathParts.includes(b));
      };
    
      fileWatcher = chokidar.watch(Array.from(watchedPaths), {
        ignored: ignoreFunc,
        persistent: true,
        ignoreInitial: true,
        useFsEvents: false,
        usePolling: false,
      });

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
    width: 1280,
    height: 840,
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
  cleanupOldExports().catch(() => {});
  createWindow();

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

autoUpdater.on('update-available', () => {
  if (mainWindow) mainWindow.webContents.send('updater:status', 'update-available');
});
autoUpdater.on('update-downloaded', () => {
  if (mainWindow) mainWindow.webContents.send('updater:status', 'update-downloaded');
});
autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) mainWindow.webContents.send('updater:progress', progressObj.percent);
});
ipcMain.handle('updater:check', () => { autoUpdater.checkForUpdatesAndNotify(); });
ipcMain.handle('updater:install', () => { autoUpdater.quitAndInstall(false, true); });

ipcMain.handle('fs:scanDirectory', async (_, dirPath, blacklist, respectGitignore) => {
  try {
    watchedPaths.add(dirPath);
    currentBlacklist = blacklist;
    const payload = await scanDirectory(dirPath, blacklist, respectGitignore); 
    setTimeout(() => {
      setupWatcher().catch(e => console.error("Watcher setup failed:", e));
    }, 500);
    return payload;
  } catch (error) {
    console.error('Error scanning:', error);
    throw error;
  }
});

// Guaranteed file descriptor release: zero file locks on Windows
ipcMain.handle('fs:readFile', async (_, filePath) => {
  let fh = null;
  try {
    const stats = await fs.stat(filePath);
    if (stats.size > 5 * 1024 * 1024) {
      throw new Error(`File exceeds 5MB limit (${(stats.size / (1024 * 1024)).toFixed(2)} MB). Preview disabled.`);
    }

    fh = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(4096);
    const { bytesRead } = await fh.read(buffer, 0, 4096, 0);

    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) {
        throw new Error("Binary file detected. Preview disabled.");
      }
    }

    return await fs.readFile(filePath, 'utf-8');
  } catch (error) { 
    console.error('Error reading:', error); 
    throw error; 
  } finally {
    if (fh) {
      try {
        await fh.close();
      } catch (e) { /* ignore */ }
    }
  }
});

ipcMain.handle('fs:readImageBase64', async (_, filePath) => {
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    let mime = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
    else if (ext === '.gif') mime = 'image/gif';
    else if (ext === '.svg') mime = 'image/svg+xml';
    else if (ext === '.webp') mime = 'image/webp';
    else if (ext === '.ico') mime = 'image/x-icon';

    return `data:${mime};base64,${data.toString('base64')}`;
  } catch (error) {
    console.error('Error reading image:', error);
    throw error;
  }
});

ipcMain.handle('fs:calculateTokens', async (_, filePaths) => {
  try {
    const { getEncoding } = require('js-tiktoken');
    const enc = getEncoding("cl100k_base");
    let totalTokens = 0;
    
    for (const filePath of filePaths) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        totalTokens += enc.encode(content).length;
      } catch (e) {}
    }
    return totalTokens;
  } catch (error) {
    console.error('Error calculating exact tokens:', error);
    return 0;
  }
});

ipcMain.handle('fs:stageExport', async (_, payload) => {
  try { return await processExport(payload); }
  catch (error) { console.error('Error staging export:', error); throw error; }
});

ipcMain.handle('fs:stageEphemeralExport', async (_, payload) => {
  try { return await processEphemeralExport(payload); }
  catch (error) { console.error('Error staging ephemeral export:', error); throw error; }
});

ipcMain.handle('shell:openPath', async (_, targetPath) => { return await shell.openPath(targetPath); });
ipcMain.handle('shell:openExternal', async (_, url) => { return await shell.openExternal(url); });
ipcMain.on('shell:showItemInFolder', (_, targetPath) => { shell.showItemInFolder(targetPath); });

ipcMain.handle('app:getVersion', () => app.getVersion());

ipcMain.handle('git:getStatus', async (_, dirPath) => {
  return new Promise((resolve) => {
    exec('git status --porcelain', { cwd: dirPath }, (error, stdout) => {
      if (error) {
        resolve({});
        return;
      }
      const statusMap = {};
      const lines = stdout.split('\n').filter(line => line.trim().length > 0);
      lines.forEach(line => {
        const status = line.substring(0, 2);
        const file = line.substring(3).trim().replace(/^"|"$/g, '');
        statusMap[file] = status;
      });
      resolve(statusMap);
    });
  });
});

ipcMain.on('drag:start', (e, filePaths) => {
  const iconPath = app.isPackaged 
    ? path.join(__dirname, 'dist', 'drag-package.png')
    : path.join(__dirname, 'public', 'drag-package.png');
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
      } catch (e) {}
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