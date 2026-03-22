// main.cjs
const path = require('path');
const fs = require('fs/promises');
const os = require('os');
const { app, BrowserWindow, ipcMain, dialog, nativeImage, shell } = require('electron');
const chokidar = require('chokidar');

const SESSION_TEMP_DIR = path.join(os.tmpdir(), `xcerpt_session_${process.pid}`);
let fileWatcher = null;
let mainWindow = null;

// --- File Scanner Logic ---
async function scanDirectory(rootPath, blacklist, currentPath = rootPath, relativeToRoot = '') {
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
    
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    
    // Process directories first, applying the dynamic blacklist
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
      
      const { node: childNode, rules: childRules } = await scanDirectory(rootPath, blacklist, childPath, childRelative);
      
      node.children.push(childNode);
      node.size += childNode.size;
      gitignoreRules.push(...childRules);
    }
  }

  return { node, rules: gitignoreRules };
}
// --- End Scanner Logic ---

// --- Export Engine Logic ---
async function processExport(payload) {
  // Wipe previous session chunks if they exist, then recreate base dir
  await fs.rm(SESSION_TEMP_DIR, { recursive: true, force: true });
  await fs.mkdir(SESSION_TEMP_DIR, { recursive: true });

  const chunkPaths = [];

  for (let i = 0; i < payload.chunks.length; i++) {
    const chunk = payload.chunks[i];
    const chunkDir = path.join(SESSION_TEMP_DIR, `chunk_${chunk.id}`);
    await fs.mkdir(chunkDir, { recursive: true });
    chunkPaths.push(chunkDir);
    
    // Provide the spatial map to the LLM only in the first chunk
    if (chunk.id === 1) {
      await fs.writeFile(path.join(chunkDir, 'ExportedFileTree.md'), payload.treeMarkdown, 'utf-8');
    }
    
    for (const file of chunk.files) {
      try {
        const content = await fs.readFile(file.absolutePath, 'utf-8');
        let lines = content.split('\n');
        
        // Apply compressions (sort descending to safely splice without shifting indexes)
        const sortedComps = [...file.compressions].sort((a, b) => b.startLine - a.startLine);
        for (const comp of sortedComps) {
          const skipCount = comp.endLine - comp.startLine + 1;
          const marker = `// ... [Skipped ${skipCount} lines] ...`;
          lines.splice(comp.startLine - 1, skipCount, marker);
        }
        
        // Write the file entirely flat
        const outPath = path.join(chunkDir, file.flatFileName);
        await fs.writeFile(outPath, lines.join('\n'), 'utf-8');
      } catch (err) {
        console.error(`Error processing file ${file.absolutePath}:`, err);
      }
    }
  }

  return chunkPaths;
}
// --- End Export Engine Logic ---

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV !== 'production') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  // Initialize Global Watcher (empty at first)
  fileWatcher = chokidar.watch([], {
    ignored: [/(^|[\/\\])\../], // ignore dotfiles by default
    persistent: true,
    ignoreInitial: true,
  });

  fileWatcher.on('all', (event, filePath) => {
    // Only emit on change/add/unlink to avoid excessive noise
    if (['change', 'add', 'unlink'].includes(event) && mainWindow) {
      mainWindow.webContents.send('fs:file-changed', event, filePath);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (fileWatcher) fileWatcher.close();
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
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

ipcMain.handle('fs:scanDirectory', async (_, dirPath, blacklist) => {
  try { 
    // Dynamically update the watcher to ignore the heavy blacklist folders
    if (fileWatcher) {
      const ignorePatterns = blacklist.map(b => `**/${b}/**`);
      fileWatcher.options.ignored = [/(^|[\/\\])\../, ...ignorePatterns];
      fileWatcher.add(dirPath);
    }
    return await scanDirectory(dirPath, blacklist); 
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

ipcMain.handle('shell:openPath', async (_, targetPath) => {
  return await shell.openPath(targetPath);
});

ipcMain.on('drag:start', (e, filePaths) => {
  // Pass array of files directly to the OS Native Drag
  const iconPath = path.join(__dirname, 'public', 'drag-package.png');
  const icon = nativeImage.createFromPath(iconPath);
  e.sender.startDrag({ files: filePaths, icon: icon });
});