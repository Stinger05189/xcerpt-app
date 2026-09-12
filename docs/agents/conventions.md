<!-- docs/agents/conventions.md -->

# conventions.md

# Project Conventions & Architecture

> **[IMMUTABLE AI DIRECTIVE]**
> **DO NOT MODIFY THIS INSTRUCTION BLOCK.**
> This file serves as the living architectural "brain" for this specific project. It contains the source of truth for the tech stack, naming conventions, structural constraints, and learned lessons.
>
> **Your Responsibilities:**
>
> 1. **Read First:** Reference this file during Phase 1 (Triangulation) of every session to ensure your proposed strategy aligns with established patterns.
> 2. **Maintain & Rewrite:** During the `[END SESSION]` teardown protocol, you are expected to rewrite, append, or reorganize the sections _below_ this block. If we establish a new architectural rule, encounter a recurring bug, or solidify a naming convention, you must add it here so it is not forgotten in future sessions.
> 3. **Keep it Dense:** Remove outdated patterns. Keep descriptions concise and technical.

---

## 1. Stack & Formatting

- **Stack:** TS (Strict), Electron (Desktop Shell), Node.js (Main Process), React 18+ (Renderer), Vite, Zustand (Global State), LocalStorage (Temp Config), Tailwind CSS v4, Lucide, `@monaco-editor/react`, `chokidar`, `ignore`/`micromatch`.
- **Naming/Structure:** Feature-grouped in `src/`. `PascalCase.tsx` (Components/Views), `camelCase.ts` (Utils/Hooks), `PascalCase` (Types/Interfaces, no 'I' prefix), `camelCase` (Vars/Functions).
- **Styling:** Tailwind utility classes directly via `className` (`clsx`/`tailwind-merge` for conditionals). Dark mode primary.

## 2. Architecture & State (Zustand)

- **IPC Bridge (`preload.cjs`):** Strict separation. React handles UI; Node handles `fs`/OS. React communicates via typed `ipcRenderer.invoke` (`window.api`). Assign global `mainWindow` in Node to prevent variable shadowing in IPC broadcasts.
- **Dual-Store & Hydration:** `AppStore` (Global IDE) vs `WorkspaceStore` (Active Project). Xcerpt uses a _Single Re-hydrating Store_. On tab switch: synchronously save outgoing state to disk, wipe memory to prevent V8 crashes, inject incoming JSON payload, and trigger background `chokidar` rescan.
- **State Identifiers:** React `key` props and Zustand IDs (selected/expanded/excluded) MUST use the file's Stable Relative Path or canonical Scoped Key (`${rootId}::${relativePath}`). Never use UI indexes.
- **Performance Constraints:**
  - **Granular Boolean Selectors in Virtual Lists:** In virtualized lists where mouse moves trigger global coordinate/selection updates (e.g., marquee dragging), row components must NEVER subscribe to the full Set or object (`s => s.selectedFiles`). They must subscribe to granular boolean selectors: `useStore(s => s.selectedFiles.has(key))`. This ensures that rows whose selection status has not toggled do not re-render.
  - **Decoupling Non-Interactive Panes during Dragging:** Components not participating in high-frequency pointer interactions (e.g., `Sidebar`) must NEVER use monolithic store destructuring (`const { ... } = useWorkspaceStore()`). Use atomic property selectors to ensure the sidebar does not re-render during 60fps marquee selection painting.
  - **Zero Heavy Computation in Render Bodies:** Components like `TreeNodeComponent` must NEVER instantiate rule engines or run path classification (`getScopedFileStatus`) inside render. Pre-calculate `status: FileStatus` during tree flattening (`useFlattenedTree`) and pass it down as a pure prop.
- **Flat-State Sync Pattern:** To prevent deep selector render locks across the app, nested configuration objects (like `Presets`) must be unpacked into flat Zustand state properties (`includes`, `excludes`) upon activation, and repacked before saving or switching contexts.
- **Session-Bound Snapshots:** Ephemeral session state that must survive workspace tab switches (like "Revert Changes" snapshots) should be hoisted to the global `AppStore` (`workspaceSnapshots`). The `WorkspaceStore` acts as the active consumer.
- **Cross-Store Reactivity:** When global configurations in the `AppStore` (like `extensionOverrides`) dictate output behavior managed by the `WorkspaceStore`, you must explicitly bridge the stores. Invoke `useWorkspaceStore.getState().setExportState({ isStale: true })` inside the `AppStore` action to manually trigger the dependent pipeline.
- **The Global History Engine (Command Pattern):** Any state mutation triggered by a user action that modifies the `WorkspaceStore` or `AppStore` MUST be pushed to the global history stack using `useHistoryStore.getState().push()`. Never save full state snapshots. Save only the minimal inverse delta closures (e.g., `() => toggleFolderExpansion(path)`).
- **LZ-String Compression for Bulk History:** When a History Command closure requires storing a massive array (e.g., "Expand All Folders", "Select All Files"), wrap the array in `compressHistoryPayload` before pushing it, and `decompressHistoryPayload` inside the undo/redo callbacks.
- **Deferred Editor State (Anti-Lockup):** When handling rapid user inputs (such as adding multiple Monaco skip-blocks), maintain a localized React state (`draftCompressions`), track dirty status via stringified comparisons against props, and commit to the global store strictly via explicit user confirmation (Save/Discard).

## 3. Node.js & I/O

- **Thread Pool Sizing:** Set `process.env.UV_THREADPOOL_SIZE = Math.max(16, require('os').cpus().length).toString()` as line 1 of `main.cjs` before loading asynchronous modules to prevent event loop starvation.
- **Guaranteed Handle Releases (Zero OS Locks):** Any routine reading files in Node.js (such as `fs:readFile`) MUST open descriptors read-only (`'r'`) and wrap handle closures in `try ... finally { if (fh) await fh.close(); }` to prevent Windows Defender / `EBUSY` locks.
- **Chokidar & Filtering:** Never use string globs on Windows for `ignored`. Use custom path-splitting predicate functions (`[\/\\]`). Set `useFsEvents: false` and `usePolling: false` to avoid persistent OS file locks. Wrap watcher `all` listeners in `ready` events to shield the renderer from startup event bursts.
- **Recursive Opts:** Use `fs.readdir({ withFileTypes: true })` and `dirent.isDirectory()` instead of `fs.stat` loops. Pass a single mutable `Context` object down recursive chains instead of array spreading.
- **Temp Directories & Unique Timestamps:** Never rapidly delete and recreate static temporary directory paths. Always append unique timestamps and random suffixes (`xcerpt_export_<timestamp>_<rand>`) to prevent Windows Defender ransomware locks.

## 4. UI & Shell

- **Visual Filtering:** Excluded items are NOT removed from the DOM. Apply an "excluded" status flag for `opacity: 0.4` and a disabled state.
- **Frameless Window (`frame: false`):** Apply `WebkitAppRegion: 'drag'` to the layout container. Apply `'no-drag'` ONLY to interactive leaf nodes (buttons/tabs) and use padding on the parent to expose the drag region.
- **Modal Overlays & Frameless Windows:** When implementing full-screen overlays (like the Workspace Browser), do not unmount the `TitleBar`. Apply `opacity-30 pointer-events-none` to the background UI, ensuring OS window controls (Minimize, Maximize, Close) remain functional.
- **Virtualization & Fixed Positioning (CSS Transforms):** Virtualization relies on `transform: translateY(px)` to move rows. In CSS, `transform` creates a new containing block, breaking `position: fixed`. Any context menu or fixed overlay triggered from inside a virtualized list MUST use `createPortal(..., document.body)` to escape the transformed container.
- **Tick-Independent Dragging:** For 60fps continuous selections (like marquee brushing), never rely on `onMouseEnter` or `onMouseOver`. Always use mathematical 1D indexing based on pointer coordinates (`Math.floor(offsetY / ROW_HEIGHT)`).
- **Anti-Stale Closure Ref-Pinning:** When reading layout arrays in virtualized drag engines, read from a mutable `useRef` tracking the latest flat layout array to prevent referencing stale closure state.

## 5. Monaco Editor

- **Compression Coordinates:** Skip markers (`startLine`, `endLine`) map to the file's canonical scoped key in workspace state.
- **Drift Management:** Store the exact string `signature` of the target line and search a $\pm 50$-line heuristic window on load to auto-heal offsets after external git pulls or edits.
- **Lifecycle & Syncing:** Force React wrapper remount via `key={activeFile}` to prevent stale closures. Before applying decorations, verify `editor.getModel()?.getValue() === reactContent`.

## 6. UX, Theming & Data Integrity

- **Theming Strategy:** Dynamic visual properties are handled via CSS variables (`--color-*`) injected at `:root`.
- **Scale Inputs & Cursor Drift:** Bind `<input type="range">` scale sliders strictly to local React `useState` while dragging, and commit to the global Zustand store only on `onMouseUp`, `onTouchEnd`, or `onKeyUp` to prevent cursor drift.
- **Truth in Prompting:** Any structural transformations made to bypass upload filters (such as extension overrides) MUST be explicitly declared in the manifest legend.

## 7. Virtual Staging & Zero-Hitch I/O (v1.6+)

- **Virtual In-Memory Payload Rule:** Never write physical files to disk merely because curation rules, selections, or skip blocks changed. The payload graph (tokens, sizes, true-skip calculations, tree markdown) is computed 100% in RAM.
- **JIT Physical Staging Machine:** Physical file generation occurs ONLY when the user explicitly triggers an export or on `onDragStart`. The UI displays explicit ready states: `VIRTUAL_READY` $\to$ `STAGING_LOCK` $\to$ `DISK_READY`. Any subsequent mutation resets state to `VIRTUAL_READY`.
- **Root-Qualified Rule Keys:** All file-level preset rules (includes, excludes, tree-only, compressions) MUST use canonical composite keys: `${rootId}::${relativePath}`.
- **Windows Path Canonicalization:** On Windows, always uppercase drive letters (`C:`) and normalize backslashes to forward slashes before computing scoped keys (`${rootId}::${relativePath}`).
- **Directory Trailing Slash Invariant & Child Joining:** Directory keys MUST always terminate with `/`. When traversing trees or concatenating a child node onto a normalized directory path `cleanDir`, use `${cleanDir}${child.name}`, NEVER `${cleanDir}/${child.name}` to prevent double slashes (`//`) that break key indexing.
- **Hierarchical Specificity Precedence (Bottom-Up):**
  1. Exact file and directory rules (`includeExact`, `treeOnlyExact`, `excludeExact`) ALWAYS override ancestor folder rules.
  2. Ancestor directory lookups MUST evaluate bottom-up (closest/deepest ancestor first via `cleanRel.lastIndexOf('/')`). The closest ancestor's rule wins.
- **Exclusion Synthesis for Selection Presets:** "Create Preset from Selection" must generate real, compacted directory exclusions (`generateExclusionsForSelection`) for all unselected files and subtrees rather than relying on implicit runtime flags, ensuring standard, transparent preset curation.
- **Inclusion Punch-Through Independence:** In default curation mode, explicit inclusions punch through ancestor exclusions without inverting the rest of the workspace into a whitelist.
