// main.cjs
const path = require('path');
const fs = require('fs/promises');
const os = require('os');
const { app, BrowserWindow, ipcMain, dialog, nativeImage, shell } = require('electron');
const chokidar = require('chokidar');

const SESSION_TEMP_DIR = path.join(os.tmpdir(), `xcerpt_session_${process.pid}`);
const SESSIONS_DIR = path.join(app.getPath('userData'), 'XcerptSessions');

let fileWatcher = null;
let mainWindow = null;

const TREE_ONLY_REGEX = /\.(lock|png|jpe?g|gif|svg|ico|webp|pdf|mp4|webm|wav|mp3|zip|tar|gz|bz2|7z|bin|dll|exe|so|dylib|class|jar)$/i;
const TREE_ONLY_EXACT = ['.DS_Store', '.env', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

// --- File Scanner Logic ---

// The new Context object completely eliminates O(N^2) array spreading during deep recursion
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
    // We only stat files to get their byte size. Directories bypass this entirely.
    try {
      const stats = await fs.stat(currentPath);
      node.size = stats.size || 0;
    } catch (e) {
      node.size = 0;
    }
    return { node, rules: context.gitignoreRules, treeOnly: context.treeOnlyRules };
  }

  // If it's a directory, read entries
  let entries;
  try {
    entries = await fs.readdir(currentPath, { withFileTypes: true });
  } catch (e) {
    // Permission denied or missing directory
    return { node, rules: context.gitignoreRules, treeOnly: context.treeOnlyRules };
  }

  // 1. Check for .gitignore before blindly trying to read it
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
    } catch (e) {
      // Silently continue if read fails
    }
  }

  // 2. Process directory entries
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
    
    // Pass the context reference down. Destructuring the return is no longer necessary for the arrays.
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

  // Only the top-level call returns the accumulated arrays
  return { node, rules: context.gitignoreRules, treeOnly: context.treeOnlyRules };
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
  mainWindow = new BrowserWindow({
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

app.whenReady().then(async () => {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
  createWindow();

  // Initialize Global Watcher (empty at first, relying strictly on our dynamic blacklist)
  fileWatcher = chokidar.watch([], {
    ignored: [], 
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
      fileWatcher.options.ignored = [...ignorePatterns];
      
      // DEFER: Do not let Chokidar indexing block the IPC event loop.
      // Wait 500ms so Node can instantly serialize and return the tree payload to React.
      setTimeout(() => {
        if (fileWatcher) fileWatcher.add(dirPath);
      }, 500);
    }
    
    // The top-level call kicks off the context object
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

ipcMain.on('shell:showItemInFolder', (_, targetPath) => {
  shell.showItemInFolder(targetPath);
});

ipcMain.on('drag:start', (e, filePaths) => {
  // Pass array of files directly to the OS Native Drag
  const iconPath = path.join(__dirname, 'public', 'drag-package.png');
  const icon = nativeImage.createFromPath(iconPath);
  e.sender.startDrag({ files: filePaths, icon: icon });
});

// --- Persistence IPC Handlers ---
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