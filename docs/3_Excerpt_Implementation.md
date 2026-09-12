# 3_Excerpt_Implementation.md

# Xcerpt: Production Realities, Technical Debt & Engineering Roadmap

> **Scope:** Audit of active implementation status, architectural lessons learned, operating system failure modes, production hardening, and future engineering roadmap.

---

## 1. Implementation Status Matrix

| Subsystem                   | Status         | Key Modules                                | Architecture Summary                                                                                             |
| :-------------------------- | :------------- | :----------------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| **Electron Main Process**   | **Production** | `main.cjs`, `preload.cjs`                  | UV thread pool expansion, `perf_hooks` monitoring, synchronous `fsSync` payload writing, Chokidar file watching. |
| **IPC Bridge**              | **Production** | `preload.cjs`, `types/ipc.d.ts`            | Context isolation enabled, typed `window.api`, bi-directional event streaming.                                   |
| **State Management**        | **Production** | `appStore.ts`, `workspaceStore.ts`         | Dual-Store pattern, single re-hydrating store, unpacked preset sync pattern, session-bound snapshots.            |
| **Global History Engine**   | **Production** | `historyStore.ts`, `ToastContainer.tsx`    | Command pattern, zero-snapshot closures, LZ-String compression, multi-workspace `resolveContext` navigation.     |
| **Tree Virtualization**     | **Production** | `FileTree.tsx`, `useFlattenedTree.ts`      | `@tanstack/react-virtual`, 1D math index mapping, 60fps RAF auto-scroll, anti-stale ref-pinning.                 |
| **Monaco Skip Engine**      | **Production** | `ContextEditor.tsx`                        | Line coordinate skip storage, deferred draft state, ±50 line drift signature healing, multi-cursor merging.      |
| **Export & Token Pipeline** | **Production** | `exportEngine.ts`, `ExportStage.tsx`       | Single-child folder collapsing, extension overrides prompt legend, `js-tiktoken` exact BPE counting.             |
| **Multi-Root Management**   | **Production** | `MainStage.tsx`, `workspaceStore.ts`       | Multi-root tabs, missing root detection (`isMissing`), in-place directory relocation picker.                     |
| **Desktop Shell & Styling** | **Production** | `TitleBar.tsx`, `Sidebar.tsx`, `index.css` | Frameless window, dynamic CSS variable theming, hardware-accelerated zoom scaling, container queries.            |
| **Auto-Updater**            | **Production** | `main.cjs`, `TitleBar.tsx`                 | `electron-updater` hooked to GitHub Releases, title bar progress bar and notification pill.                      |

---

## 2. Technical Debt, Platform Pitfalls & Fragile Areas

Throughout the development of Epochs 01–04, several critical operating system, runtime, and framework bugs were identified and mitigated. Maintaining these defenses is essential for production stability.

### 2.1. Chokidar Path-Matching Failures on Windows

- **The Issue:** Passing standard glob patterns (e.g., `**/node_modules/**` or `**/.git/**`) to Chokidar's `ignored` option fails silently on Windows due to mixed path separators (`/` vs `\`). The watcher then attempts to index entire nested `node_modules` trees, causing 100% CPU utilization and memory exhaustion.
- **The Defense:** Never use string globs for Chokidar ignoring. In `main.cjs`, Xcerpt passes a custom predicate function that splits the path on both forward and backward slashes:
  ```javascript
  const ignoreFunc = (testPath) => {
  	const pathParts = testPath.split(/[\/\\]/);
  	return currentBlacklist.some((b) => pathParts.includes(b));
  };
  ```
- **Fragility Warning:** Any new blacklist or filtering mechanism added to the main process must normalize paths using this regex pattern before evaluation.

### 2.2. Event-Loop Starvation & UV Thread Pool Sizing

- **The Issue:** Node.js defaults to 4 worker threads in its libuv pool (`UV_THREADPOOL_SIZE = 4`). When Chokidar crawls a large repository, asynchronous `fs.stat` operations saturate the thread pool, causing IPC invocations from the renderer process to hang.
- **The Defense:** In the first line of `main.cjs`, before any native modules load:
  ```javascript
  process.env.UV_THREADPOOL_SIZE = Math.max(
  	16,
  	require("os").cpus().length,
  ).toString();
  ```
- **Fragility Warning:** `UV_THREADPOOL_SIZE` must be set before any asynchronous filesystem or DNS calls execute; setting it inside `app.whenReady()` has no effect.

### 2.3. Anti-Virus & Windows Defender Temporary Directory Locks

- **The Issue:** In earlier architectures, payload staging repeatedly wiped (`fs.rm`) and recreated (`fs.mkdir`) a static temporary directory (e.g., `os.tmpdir()/xcerpt_export`). Windows Defender frequently flags rapid directory recreation with batch file writes as potential ransomware activity, placing an exclusive lock on the directory and causing `EPERM` or `EBUSY` crashes.
- **The Defense:** Every export operation writes to a uniquely timestamped folder:
  ```javascript
  const exportDir = path.join(
  	os.tmpdir(),
  	`xcerpt_export_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
  );
  ```
  Stale directories are cleaned up by a non-blocking background sweeper (`cleanupOldExports()`) that removes folders older than one hour on startup.

### 2.4. Synchronous vs. Asynchronous File Generation Tradeoffs

- **The Issue:** Using asynchronous `await fs.writeFile` inside a loop for 500+ files queues hundreds of microtasks in V8. If the user simultaneously paints selections in the virtualized tree, microtask contention causes visible frame drops in the UI.
- **The Defense:** Export generation in `main.cjs` uses `fsSync` (`fsSync.writeFileSync`). On modern SSDs, synchronously writing a 5MB payload takes 15–30ms, running entirely isolated from Chromium's rendering thread and avoiding microtask queue contention.

### 2.5. React 19 / Strict Mode Cascading Render Warnings

- **The Issue:** React 19 disallows synchronous `setState` calls inside a component's top-level `useEffect` if that update triggers another immediate re-render, throwing cascading render warnings and interrupting CSS transitions.
- **The Defense:** Visual notifications (e.g., `ToastContainer.tsx`) and fast tab-switching effects defer state mutations to the macro-task queue using zero-delay timeouts:
  ```typescript
  const showTimer = setTimeout(() => setVisible(true), 0);
  ```

### 2.6. React Ref Reads During the Render Phase

- **The Issue:** Checking `ref.current` during render to derive state (e.g., computing `isDirty` by comparing `lastSavedRef.current` with local state) violates React purity rules and triggers build errors with modern linting rules.
- **The Defense:** Compute dirty states through pure stringified comparisons of props and state during render:
  ```typescript
  const isDirty =
  	JSON.stringify(draftCompressions) !== JSON.stringify(fileCompressions);
  ```
  Refs should be updated strictly inside `useEffect` or event handlers.

### 2.7. CSS Transform Matrix Containing Blocks in Virtualized Lists

- **The Issue:** `@tanstack/react-virtual` positions rows using `style={{ transform: translateY(...) }}`. Under the CSS specification, any non-none `transform` value turns that element into the containing block for all descendants, including those with `position: fixed`. Context menus rendered inside row components will misalign relative to the viewport.
- **The Defense:** `ContextMenu.tsx` must escape the transformed container by using a React portal attached directly to `document.body`:
  ```typescript
  return createPortal(<div ref={menuRef} style={{ top: y, left: x }} ... />, document.body);
  ```

### 2.8. Memory Creep in Deep History Stacks

- **The Issue:** Allowing up to 1,000 undo/redo actions can lead to significant memory consumption if commands capture large arrays (e.g., lists of 10,000 folder paths from "Expand All Folders").
- **The Defense:** Bulk array payloads are compressed with Base64 `lz-string` encoding before entering `HistoryCommand`:
  ```typescript
  const prevCompressed = compressHistoryPayload(
  	Array.from(get().expandedFolders),
  );
  ```
  Decompression occurs only when `undo()` or `redo()` is actively invoked.

### 2.9. State Synchronization Before Background Disk Flushing

- **The Issue:** `Bootstrapper.tsx` continuously flushes `WorkspaceStore` state to disk using a 300ms debounced subscriber. If metadata (such as `workspaceName`) is modified via direct IPC calls without updating the in-memory Zustand store first, the debounced store flush will overwrite the disk changes with stale in-memory state.
- **The Defense:** Whenever invoking backend persistence handlers (e.g., `renameWorkspace`), update the active Zustand store state simultaneously:
  ```typescript
  await window.api.renameWorkspace(id, newName);
  useWorkspaceStore.getState().setWorkspaceName(newName);
  ```

---

## 3. Security, Sandboxing & Production Hardening

### 3.1. Context Isolation & Electron API Surface

- **Context Isolation:** Enforced via `contextIsolation: true` and `nodeIntegration: false`. The renderer process cannot access Node's `require`, `process`, or native bindings directly.
- **Guarded IPC Handlers:** The `fs:readFile` handler implements two safety checks before returning file buffers to the renderer:
  1. **Size Barrier:** Rejects files larger than 5 MB to prevent memory bloat in Monaco editor instances:
     ```javascript
     if (stats.size > 5 * 1024 * 1024) throw new Error("File too large.");
     ```
  2. **Binary Detection:** Reads the first 4,096 bytes into a buffer; if a null byte (`0x00`) is detected, the file is flagged as binary and preview is disabled.

### 3.2. DevTools Stripping & Packaging Flags

- In `main.cjs`, Chromium DevTools are locked behind packaging status:
  ```javascript
  devTools: !app.isPackaged;
  ```
  In packaged binaries (`npm run dist`), keyboard shortcuts like `Ctrl+Shift+I` are disabled, and the Chromium inspector is omitted.

### 3.3. GitHub Personal Access Token (PAT) Architecture

- **Developer Uploads:** A GitHub PAT with `repo` scope is required solely by the developer's local terminal to push compiled release artifacts to GitHub Releases (`npm run dist -- -p always`).
- **Client Auto-Updater:** The client application uses `electron-updater` to query public GitHub Releases via unauthenticated endpoints. No secrets or tokens are compiled into the client application.

### 3.4. Packaged Asset Resolution (The `file://` Protocol)

- In packaged applications, static assets are served from inside an `app.asar` archive via the `file://` protocol.
- **Relative Path Requirement:** All HTML image tags and SVG references must use relative paths (e.g., `src="./icon.svg"`). Absolute paths (e.g., `src="/icon.svg"`) cause Chromium to look at the filesystem root (e.g., `C:\icon.svg`), resulting in broken assets.
- **Native Drag Images:** The drag badge path must resolve based on packaging status:
  ```javascript
  const iconPath = app.isPackaged
  	? path.join(__dirname, "dist", "drag-package.png")
  	: path.join(__dirname, "public", "drag-package.png");
  ```
