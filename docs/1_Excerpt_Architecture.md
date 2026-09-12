# 1_Excerpt_Architecture.md

# Xcerpt: System Architecture & Technical Specifications

> **Scope:** Technical specification of internal subsystems, state machines, IPC protocols, and performance algorithms.

---

## 1. Process Model & Threading Architecture

Xcerpt adheres to a multi-process Electron architecture that strictly separates OS-level file manipulation from UI rendering via a secure Context Bridge.

```
+------------------------------------------------------------------------------------------------+
|                                    MAIN PROCESS (Node.js)                                      |
|                                                                                                |
|  - Thread Pool: UV_THREADPOOL_SIZE = max(16, os.cpus().length)                                 |
|  - Event Loop Monitor: perf_hooks.monitorEventLoopDelay (resolution: 10ms)                     |
|  - Background GC: cleanupOldExports() sweeps tmpdir directories older than 1hr                |
|  - Chokidar Watcher: Filtered via path-splitting functions; shielded by ready state            |
|  - Export Generation: fsSync write operations to isolate from async event-loop lag             |
|  - Token Calculation: js-tiktoken cl100k_base executed sequentially over I/O pool               |
+------------------------------------------------------------------------------------------------+
                                              ▲
                                              │  ipcRenderer.invoke / ipcRenderer.send
                                              │  ipcRenderer.on (Listeners)
                                              ▼
+------------------------------------------------------------------------------------------------+
|                                 CONTEXT BRIDGE (preload.cjs)                                   |
|                                                                                                |
|  - contextIsolation: true, nodeIntegration: false                                              |
|  - Exposes typed window.api interface (window controls, fs, git, updater, persistence)         |
|  - webFrame.setZoomFactor: Direct access for zero-overhead application scaling                 |
+------------------------------------------------------------------------------------------------+
                                              ▲
                                              │  Typed Function Calls / Reactive Events
                                              ▼
+------------------------------------------------------------------------------------------------+
|                                  RENDERER PROCESS (Chromium)                                   |
|                                                                                                |
|  - React 19 + TypeScript (Strict Mode)                                                         |
|  - Zustand State Topology: AppStore (Global), WorkspaceStore (Active), HistoryStore (Commands)  |
|  - @tanstack/react-virtual: Virtualized DOM rendering with 1D mathematical marquee engine       |
|  - @monaco-editor/react: Isolated skip-block context compression with local draft state        |
|  - Dynamic CSS Variable Engine: Direct injection into document.documentElement                |
+------------------------------------------------------------------------------------------------+
```

### 1.1. Main Process Responsibilities (`main.cjs`)

1. **Thread Pool Optimization:** Upon bootstrapping, `UV_THREADPOOL_SIZE` is expanded:
   ```javascript
   process.env.UV_THREADPOOL_SIZE = Math.max(
   	16,
   	require("os").cpus().length,
   ).toString();
   ```
   This prevents Chokidar's background disk polling and `fs.stat` calls from starving Node's internal worker pool during heavy file operations.
2. **Event Loop Monitoring:** Monitors microtask queue latency via `monitorEventLoopDelay({ resolution: 10 })` to verify that export bundling does not stall UI communications.
3. **Synchronous Export Operations:** Disk payload writes are intentionally handled using `fsSync` (`fsSync.writeFileSync`, `fsSync.mkdirSync`). In desktop environments, blocking the main thread for 10–25ms to generate temporary payloads is preferable to allowing thousands of async microtasks to compete with real-time UI rendering.
4. **Temporary Directory Lifecycle:** Payloads are written to unique timestamped directories in `os.tmpdir()` (`xcerpt_export_<timestamp>_<rand>` and `xcerpt_ephemeral_<timestamp>_<rand>`). A background garbage collector runs on startup to remove directories older than one hour.

### 1.2. The Context Bridge Interface (`preload.cjs`)

Communication between Chromium and Node.js is strictly typed and governed by `contextBridge.exposeInMainWorld('api', { ... })`:

- **Filesystem Operations:** `scanDirectory`, `readFile`, `readImageBase64`, `calculateTokens`.
- **Window Controls:** `minimizeWindow`, `maximizeWindow`, `closeWindow`, `setZoomFactor`.
- **System & Shell:** `showItemInFolder`, `openPath`, `openExternal`, `startDrag`.
- **Persistence:** `loadAppConfig`, `saveAppConfig`, `loadAppState`, `saveAppState`, `loadSession`, `saveSession`, `getWorkspaceMetadata`, `renameWorkspace`, `deleteWorkspace`.
- **Auto-Updater:** `checkForUpdates`, `installUpdate`, `onUpdateStatus`, `onUpdateProgress`.
- **Watcher Events:** `onFileChange` bridging external `add`, `change`, and `unlink` events to React.

---

## 2. State Topology & Store Architecture

Xcerpt implements a **Dual-Store Architecture** paired with a **Command-Pattern History Store**.

```
                           +-------------------------------------+
                           |              AppStore               |
                           |   - config (Theme, Scale, Font)     |
                           |   - openTabs: TabData[]             |
                           |   - activeWorkspaceId               |
                           |   - workspaceSnapshots: Record      |
                           +-------------------------------------+
                                              │
                     Tab Switch / Session Load│ Save / Memory Flush
                                              ▼
+---------------------------------------------------------------------------------------+
|                                    WorkspaceStore                                     |
|  - workspaceId, workspaceName, stats, paneWidths                                      |
|  - rootPaths: string[], missingRoots: Set<string>, rawTrees: Record<string, FileNode> |
|  - hardBlacklist, pendingBlacklist                                                    |
|  - activePresetId, presets: Preset[]                                                  |
|  - UNPACKED ACTIVE PRESET STATE:                                                      |
|      * includes: string[]                                                             |
|      * excludes: string[]                                                             |
|      * treeOnly: string[]                                                             |
|      * compressions: Record<string, CompressionRule[]>                                |
|  - UI STATES: selectedFiles, expandedFolders, activeFile, activeTab, isStale          |
+---------------------------------------------------------------------------------------+
                                              ▲
                                              │ State Inversion Closures
                                              │ Context Resolution Protocol
                                              ▼
                           +-------------------------------------+
                           |            HistoryStore             |
                           |   - undoStack: HistoryCommand[]     |
                           |   - redoStack: HistoryCommand[]     |
                           |   - LZ-String Encoded Payloads      |
                           +-------------------------------------+
```

### 2.1. The AppStore (`src/store/appStore.ts`)

The `AppStore` manages state that persists across workspace switches:

- **`config: AppConfig`:** Theme colors, scale factor (0.75x–1.5x), font families, font sizes, keyboard shortcuts, and extension override maps.
- **`openTabs: TabData[]`:** Active workspace tabs (`{ id, title }`) displayed in the title bar.
- **`activeWorkspaceId: string | null`:** Currently loaded workspace identifier.
- **`workspaceSnapshots: Record<string, Record<string, Preset>>`:** Session snapshots preserved across workspace tab switches, allowing users to revert changes made to any preset.

### 2.2. The WorkspaceStore (`src/store/workspaceStore.ts`)

Xcerpt utilizes a **Single Re-hydrating Store** pattern for workspaces. Instead of instantiating multiple workspace stores in memory, a single store instance manages the active workspace.

1. **Context Switching Sequence:**
   - The outgoing workspace state is packed and saved to disk via `window.api.saveSession`.
   - In-memory data structures (trees, selection sets, Git status) are purged.
   - The incoming workspace JSON is read from disk.
   - `hydrateWorkspace(payload)` unpacks the payload, restores the active preset, and triggers a background rescan.
2. **The Flat-State Sync Pattern:**
   Nested configurations inside `Preset` objects (inclusions, exclusions, tree-only rules, and skip compressions) are unpacked into top-level store properties (`includes`, `excludes`, `treeOnly`, `compressions`). This prevents deep selector evaluation from triggering re-renders in virtualized components. Before saving or switching contexts, `getPackedPresets()` reassembles these flat arrays into the preset array.

### 2.3. The HistoryStore (`src/store/historyStore.ts`)

Xcerpt relies on a zero-snapshot, command-driven undo/redo engine:

- **Command Structure:**
  ```typescript
  interface HistoryCommand {
  	id: string;
  	label: string;
  	context: {
  		workspaceId: string | null;
  		activeTab: string | null;
  		activePresetId: string | null;
  		scrollOffsetY: number;
  	};
  	undo: () => Promise<void> | void;
  	redo: () => Promise<void> | void;
  }
  ```
- **Asynchronous Context Resolution (`resolveContext`):**
  If an undo command was recorded in a different workspace tab, preset, or root directory, `resolveContext` navigates to that workspace, awaits disk hydration, switches the preset, sets the active root, restores the exact vertical scroll coordinate on the virtualized tree, and executes the inverse state mutation.
- **LZ-String Memory Compression:**
  Bulk operations (such as "Expand All Folders" or "Select All") wrap their path arrays using `compressHistoryPayload` (Base64 LZ-String encoding), allowing up to 1,000 history entries without memory bloat.

---

## 3. Tree Virtualization & Selection Architecture

To render repositories with tens of thousands of files at 60fps, Xcerpt pairs `@tanstack/react-virtual` with a custom 1D projection engine.

```
       Recursive Hierarchical Tree Node
                     │
                     ▼
       useFlattenedTree Hook
       - Pre-compiled ignore instances
       - Drop hidden/collapsed branches
       - Depth-tagged flat array
                     │
                     ▼
       FlatNode[] (1D Array)
       [{ node, relativePath: "src", depth: 1 },
        { node, relativePath: "src/App.tsx", depth: 2 }, ...]
                     │
                     ▼
       @tanstack/react-virtual Virtualizer
       - Total virtual height = FlatNode[].length * 28px
       - Render Window: start index to end index + 15 overscan
                     │
                     ▼
       1D Mathematical Pointer Marquee Engine
       - clientY -> offsetY -> index = Math.floor(offsetY / ROW_HEIGHT)
       - RequestAnimationFrame Auto-Scroller
       - Anti-stale flatNodesRef index resolution
```

### 3.1. Hierarchical Flattening (`useFlattenedTree.ts`)

Rendering deep recursive DOM nodes degrades performance exponentially. `useFlattenedTree` transforms the nested `FileNode` structure into a linear array (`FlatNode[]`):

1. **Single-Pass Ignore Compiling:** Compiles `ignore()` instances for exclusions, tree-only rules, and inclusions once per render pass.
2. **Early Branch Pruning:** If a folder is collapsed or hidden by visibility toggles ("Hide Excluded" / "Hide Tree-Only"), its entire sub-tree is excluded from the flattened array.
3. **Fuzzy Search Integration:** When a search query is active, non-matching branches are mathematically excluded unless they contain matching descendants.

### 3.2. 1D Mathematical Marquee System (`FileTree.tsx`)

DOM-based drag selection (`onMouseEnter` on individual rows) drops frames during rapid cursor sweeps. Xcerpt replaces DOM listeners with a mathematical 1D projection system:

1. **Coordinate Calculation:** When a pointer moves over the container, its `clientY` is captured and converted:
   $$\text{offsetY} = \text{container.scrollTop} + (\text{clientY} - \text{rect.top})$$
   $$\text{currentIndex} = \max\left(0, \min\left(\left\lfloor \frac{\text{offsetY}}{\text{ROW\_HEIGHT}} \right\rfloor, \text{flatNodes.length} - 1\right)\right)$$
2. **Index Range Selection:** The engine sweeps between `startIndex` (captured on `pointerdown`) and `currentIndex`, updating the `selectedFiles` Set in bulk.
3. **60fps RAF Auto-Scroll:** If the cursor approaches within 40px of the container's top or bottom border, a `requestAnimationFrame` loop increments `container.scrollTop` by 15px per frame and recalculates the index selection dynamically.
4. **Anti-Stale Closure Ref Pinning:** The drag listener accesses `flatNodesRef.current` rather than a closure-captured array, preventing selections from referencing stale folder indices after expansions or filter changes.
5. **CSS Transform Matrix Escape:** Because virtualization uses `transform: translateY(...)`, a new CSS containing block is created, which breaks `position: fixed`. To prevent layout bugs, context menus are mounted directly into `document.body` via `createPortal`.

---

## 4. Monaco Code Compression Engine (`ContextEditor.tsx`)

Xcerpt embeds `@monaco-editor/react` to provide surgical code compression.

```
       Source File Loaded from Disk
                     │
                     ▼
       Drift Reconciliation Algorithm
       - Checks expected lines vs stored signature
       - If mismatch detected: scans +/- 50 lines
       - Updates line coordinates automatically
                     │
                     ▼
       Deferred Draft State (draftCompressions)
       - User highlights code block
       - Hits Ctrl/Cmd + Backspace
       - Merges overlapping or adjacent ranges
       - Compares against global state: isDirty calculated
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
    [Save Skips]            [Discard]
         │                       │
         ▼                       ▼
  Commit to Store        Reset Draft to Props
  (Triggers Stale Build) (Zero Disk Overhead)
```

### 4.1. Coordinate System & Skip Rules

Compressions are stored as structured line-coordinate objects:

```typescript
interface CompressionRule {
	id: string;
	startLine: number;
	endLine: number;
	type: "SKIP" | "GHOST";
	signature: string; // The exact text content of startLine
	lineCount: number; // endLine - startLine + 1
}
```

### 4.2. Drift Reconciliation Algorithm

When source files are modified outside Xcerpt, stored line coordinates can shift:

1. On file load, Xcerpt reads `compressions[relativePath]`.
2. It evaluates line `comp.startLine - 1`. If `lines[comp.startLine - 1] === comp.signature`, coordinates are aligned.
3. If a mismatch is detected, the algorithm initiates a two-way iterative search across a $\pm 50$-line boundary:
   ```typescript
   let foundOffset = 0;
   for (let i = 1; i <= 50; i++) {
   	if (lines[comp.startLine - 1 + i] === comp.signature) {
   		foundOffset = i;
   		break;
   	}
   	if (lines[comp.startLine - 1 - i] === comp.signature) {
   		foundOffset = -i;
   		break;
   	}
   }
   ```
4. If found, coordinates update automatically (`startLine + foundOffset`, `endLine + foundOffset`), realigning skips before rendering.

### 4.3. Multi-Cursor Range Consolidation

When a user defines skips with multiple selections active, ranges may overlap or touch:

- New selections are merged with existing skips and sorted by `startLine`.
- Contiguous and overlapping blocks ($\text{curr.startLine} \le \text{last.endLine} + 1$) are consolidated into a single skip block, preventing corrupted visual markers.

### 4.4. Deferred Draft State (Anti-Thrashing)

Mutating skip blocks directly within the global store would cause the auto-build pipeline to trigger continuous background payload rebuilds. `ContextEditor` maintains an internal `draftCompressions` state. The `isDirty` state is derived purely during the render pass via string comparison:

```typescript
const isDirty =
	JSON.stringify(draftCompressions) !== JSON.stringify(fileCompressions);
```

Only clicking "Save Skips" commits the changes to `WorkspaceStore`, flagging the workspace as stale and scheduling a background rebuild.

---

## 5. Export Pipeline & Tokenization Engine

```
       Root Paths + Raw Trees + Curation Rules
                         │
                         ▼
             generateExportPayload()
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
  Flattened File List             Markdown Tree Generation
  - Strip excluded files          - Single-child directory collapsing
  - Apply skip compressions       - Extension override annotations
  - Disambiguate duplicate roots  - Skipped block counts [X skips]
  - Collect size metrics          - Tree-only indicators [-]
         │                               │
         └───────────────┬───────────────┘
                         ▼
             Chunking & Batch Slicing
  - Check mergeToSingleFile flag
  - If true: 1 Chunk -> context.md
  - If false: Slice by maxFilesPerChunk limit
                         │
                         ▼
             Physical Disk Generation (main.cjs)
  - Synchronous fsSync writes
  - Unique directory: os.tmpdir()/xcerpt_export_*
  - Exposes drag paths for webContents.startDrag
```

### 5.1. The Single-Child Directory Collapsing Algorithm

To optimize visual context for LLMs, `generateExportPayload` in `src/utils/exportEngine.ts` simplifies linear folder hierarchies:

- If an included directory contains exactly one included sub-directory and no included files, its path is collapsed onto a single line (e.g., `src/components/ui/` instead of three nested tree branches).
- The algorithm evaluates descendants iteratively until a branching point or file leaf is reached:
  ```typescript
  while (isDir && includedChildren.length === 1 && currRelative !== "") {
  	const singleChild = includedChildren[0];
  	collapsedName += `/${singleChild.name}`;
  	currNode = singleChild;
  	// Advance traversal pointer...
  }
  ```

### 5.2. Multi-Root Leaf Disambiguation

If a workspace contains multiple roots with identical folder names (e.g., `/projectA/src` and `/projectB/src`):

1. Root occurrences are tracked during payload compilation.
2. Suffixes are appended to duplicate root identifiers (`src_1`, `src_2`).
3. Flat filenames reflect this disambiguation (e.g., `src_1_index.ts` vs `src_2_index.ts`), preventing collisions in flattened output chunks.

### 5.3. Extension Override Annotation

When a file extension is spoofed via `extensionOverrides`:

- The physical export filename is rewritten (e.g., `Project.uproject` $\to$ `Project_uproject.json`).
- `ExportedFileTree.md` explicitly annotates the transformation in the tree legend:
  ```text
  ├── Project.uproject (Exported as Project_uproject.json)
  ```
  This preserves the LLM's spatial awareness of the original project structure despite the modified upload format.

### 5.4. High-Fidelity BPE Token Estimation

1. **UI Fast Path:** During active marquee brushing, token counts are estimated on the renderer thread using an approximate heuristic:
   $$\text{estimatedTokens} = \text{Math.round}(\text{totalBytes} / 4)$$
2. **Offline Exact BPE Path:** Once active painting settles, an effect triggers `window.api.calculateTokens(filePaths)`. The Node.js main process reads the target files and calculates exact token counts using `js-tiktoken` configured with the `cl100k_base` vocabulary, returning the verified count via IPC.

---

## 6. File Watching & Native OS Integration

### 6.1. Resilient Chokidar Configuration (`main.cjs`)

Watching enterprise repositories can easily exhaust operating system resources. Xcerpt implements three defensive watching patterns:

1. **Windows Path-Splitting Ignorer:** String globs (`**/node_modules/**`) often fail silently on Windows due to backslash normalization issues. Xcerpt uses a native path-splitting evaluation function:
   ```javascript
   const ignoreFunc = (testPath) => {
   	const pathParts = testPath.split(/[\/\\]/);
   	return currentBlacklist.some((b) => pathParts.includes(b));
   };
   ```
2. **Event Shielding:** The watcher does not attach its event listener until the initial scan completes:
   ```javascript
   fileWatcher.on("ready", () => {
   	fileWatcher.on("all", (event, filePath) => {
   		if (["change", "add", "unlink"].includes(event) && mainWindow) {
   			mainWindow.webContents.send("fs:file-changed", event, filePath);
   		}
   	});
   });
   ```
   This shields the IPC bridge from thousands of startup `add` notifications.
3. **Sequential Setup Mutex:** Modifications to watched paths are locked behind `isWatcherUpdating` and `pendingWatcherUpdate` flags, preventing rapid directory changes from spawning orphaned watcher instances.

### 6.2. Native OS Drag-and-Drop

Web browsers reject drag-and-drop operations involving raw folder objects. Xcerpt bridges this by starting drag events directly from the Electron main process via `webContents.startDrag`:

- An array of absolute file paths pointing to the staged temporary files is passed to `startDrag`.
- A custom 32x32 drag badge (`drag-package.png`) is assigned to provide clear visual feedback across OS boundaries.
- The path resolves conditionally based on package status:
  ```javascript
  const iconPath = app.isPackaged
  	? path.join(__dirname, "dist", "drag-package.png")
  	: path.join(__dirname, "public", "drag-package.png");
  ```

---

## 7. Dynamic Theming, Scaling, & Responsive Layout

### 7.1. CSS Variable Theming

Theme customizations are stored in `AppConfig` and injected into `:root` by `App.tsx`:

```typescript
const root = document.documentElement;
root.style.setProperty("--theme-bg-base", colors.bgBase);
root.style.setProperty("--theme-bg-panel", colors.bgPanel);
root.style.setProperty("--theme-bg-hover", colors.bgHover);
root.style.setProperty("--theme-text-primary", colors.textPrimary);
root.style.setProperty("--theme-text-muted", colors.textMuted);
root.style.setProperty("--theme-border-subtle", colors.borderSubtle);
root.style.setProperty("--theme-accent", colors.accent);
```

Tailwind CSS v4 maps these properties directly using the `@theme` directive in `src/index.css`, allowing dynamic theme updates across the application without requiring component remounts.

### 7.2. Hardware-Accelerated UI Scaling

Application-wide zoom adjustments bypass CSS recalculations by routing directly through Chromium's rendering engine:

```typescript
if (window.api && window.api.setZoomFactor) {
	window.api.setZoomFactor(scale); // e.g., 0.85 to 1.25
}
```

To prevent cursor drift while dragging UI scale range sliders, `<input type="range">` components track scale values in local React state during interaction, committing mutations to the global store only on `onMouseUp`, `onTouchEnd`, or `onKeyUp`.

### 7.3. Split-Pane Layouts via Container Queries

Because Xcerpt features user-resizable split panes, traditional viewport media queries (`@media (min-width: 768px)`) fail when applied to interior panels. Sub-components use Tailwind container queries (`@container`):

- Action buttons toggle text labels (`hidden @[240px]:inline`).
- File size tags reveal dynamically (`hidden @[200px]:inline`).
- Panels degrade gracefully from multi-column configurations to compact icon layouts as pane widths are adjusted.
