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

- **Stack:** TS (Strict), Electron (Desktop Shell), Node.js (Main Process), React 19+ (Renderer), Vite, Zustand (Global State), Tailwind CSS v4, Lucide, `@monaco-editor/react`, `chokidar`, `ignore`.
- **Naming/Structure:** Feature-grouped in `src/`. `PascalCase.tsx` (Components/Views), `camelCase.ts` (Utils/Hooks), `PascalCase` (Types/Interfaces, no 'I' prefix), `camelCase` (Vars/Functions).
- **Styling:** Tailwind utility classes directly via `className`. Dark mode primary.

## 2. Architecture & State (Zustand)

- **IPC Bridge (`preload.cjs`):** Strict separation. React handles UI; Node handles `fs`/OS. React communicates via typed `ipcRenderer.invoke` (`window.api`). Assign global `mainWindow` in Node to prevent variable shadowing in IPC broadcasts.
- **Dual-Store & Hydration:** `AppStore` (Global IDE) vs `WorkspaceStore` (Active Project). Xcerpt uses a _Single Re-hydrating Store_. On tab switch: synchronously save outgoing state to disk, wipe memory to prevent V8 crashes, inject incoming JSON payload, and trigger background `chokidar` rescan.
- **State Identifiers:** React `key` props and Zustand IDs (selected/expanded/excluded) MUST use the file's Stable Relative Path or canonical Scoped Key (`${rootId}::${relativePath}`). Never use UI indexes.
- **Setting Persistence Parity:** Every configuration property stored in `WorkspaceStore` (e.g., `embedProtocol`, `mergeToSingleFile`, `respectGitignore`) MUST be explicitly mapped in `Bootstrapper.tsx`'s `getWorkspacePayload` and initialized in `generateFreshWorkspace`. If omitted from `getWorkspacePayload`, background disk flushes will overwrite settings with defaults.
- **Performance Constraints:**
  - **Granular Boolean Selectors in Virtual Lists:** In virtualized lists where pointer sweeps update global coordinates, row components must NEVER subscribe to monolithic state maps. Use granular boolean selectors (`useStore(s => s.selectedFiles.has(key))`).
  - **Decoupling Non-Interactive Panes during Dragging:** Components not participating in high-frequency pointer interactions (e.g., `Sidebar`) must NEVER use monolithic store destructuring. Use atomic property selectors to ensure 60fps marquee selection performance.
  - **Zero Heavy Computation in Render Bodies:** Components like `TreeNodeComponent` must NEVER instantiate rule indices or execute path resolution inside render. Pre-calculate `status: FileStatus` during tree flattening (`useFlattenedTree`) and pass it down as a pure prop.
- **Flat-State Sync Pattern:** Nested configuration objects (like `Presets`) must be unpacked into flat Zustand state properties (`includes`, `excludes`) upon activation, and repacked before saving or switching contexts.
- **Session-Bound Snapshots:** Ephemeral session state that must survive workspace tab switches should be hoisted to the global `AppStore` (`workspaceSnapshots`). The `WorkspaceStore` acts as the active consumer.
- **The Global History Engine (Command Pattern):** Any user mutation that alters `WorkspaceStore` or `AppStore` MUST be pushed to the global history stack using `useHistoryStore.getState().push()`. Save only minimal inverse delta closures, compressing bulk array operations via Base64 `lz-string`.

## 3. Node.js & I/O

- **Thread Pool Sizing:** Set `process.env.UV_THREADPOOL_SIZE = Math.max(16, require('os').cpus().length).toString()` as line 1 of `main.cjs` before loading asynchronous modules to prevent event loop starvation.
- **Guaranteed Handle Releases (Zero OS Locks):** Any routine reading files in Node.js (such as `fs:readFile`) MUST open descriptors read-only (`'r'`) and wrap handle closures in `try ... finally { if (fh) await fh.close(); }` to prevent Windows Defender / `EBUSY` locks.
- **Platform Line-Ending Normalization (CRLF Protection):** Any routine reading file text for skip-block slicing or export packaging MUST normalize `\r\n` to `\n` before calculating line arrays.
- **Chokidar & Filtering:** Never use string globs on Windows for `ignored`. Use custom path-splitting predicate functions (`[\/\\]`). Set `useFsEvents: false` and `usePolling: false` to avoid persistent OS file locks. Wrap watcher `all` listeners in `ready` events.
- **Recursive Opts:** Use `fs.readdir({ withFileTypes: true })` and `dirent.isDirectory()` instead of `fs.stat` loops. Pass a single mutable `Context` object down recursive chains.
- **Temp Directories & Unique Timestamps:** Never rapidly delete and recreate static temporary directory paths. Always append unique timestamps and random suffixes (`xcerpt_export_<timestamp>_<rand>`).

## 4. UI & Shell

- **Visual Filtering:** Excluded items are NOT removed from the DOM. Apply an "excluded" status flag for `opacity: 0.4` and a disabled state.
- **Frameless Window (`frame: false`):** Apply `WebkitAppRegion: 'drag'` to the layout container. Apply `'no-drag'` ONLY to interactive leaf nodes (buttons/tabs) and use padding on the parent to expose the drag region.
- **Modal Overlays & Frameless Windows:** When implementing full-screen overlays (like the Workspace Browser), do not unmount or obscure the `TitleBar`. Apply `opacity-30 pointer-events-none` to the background UI, ensuring OS window controls remain functional.
- **Virtualization & Fixed Positioning (CSS Transforms):** Virtualization relies on `transform: translateY(px)` to move rows. In CSS, `transform` creates a new containing block, breaking `position: fixed`. Any context menu or fixed overlay triggered from inside a virtualized list MUST use `createPortal(..., document.body)`.
- **Scale Inputs & Cursor Drift:** Bind `<input type="range">` scale sliders strictly to local React `useState` while dragging, and commit to the global Zustand store only on `onMouseUp`, `onTouchEnd`, or `onKeyUp`.

## 5. Monaco Editor & Diff Studio

- **Monaco Component Lifecycle & Model Isolation:** In dynamic multi-file diff editors or previewers, ALWAYS bind `key={activeAction.id}` to the editor component. If an editor instance is reused across changing file action props, Monaco's internal model updates will fire `onDidChangeModelContent` against stale closures.
- **Explicit Model Language Assignment:** Do not rely exclusively on the `language` prop of `@monaco-editor/react` for custom extensions (like Lua, GLSL, HLSL, GDScript). In the editor's `onMount` callback, explicitly execute `monaco.editor.setModelLanguage(model, language)` on both original and modified models.
- **Unified Action Toolbars:** Avoid nested secondary headers inside editor previewers. Maintain a single, high-density toolbar above the editor managing target paths, language tags, line counts, skip badges, unsaved dirty states, and action triggers.

## 6. Virtual Staging & Zero-Hitch I/O (v1.6+)

- **Virtual In-Memory Payload Rule:** Never write physical files to disk merely because curation rules, selections, or skip blocks changed. The payload graph is computed 100% in RAM.
- **JIT Physical Staging Machine:** Physical file generation occurs ONLY when the user explicitly triggers an export or on `onDragStart`. The UI displays explicit ready states: `VIRTUAL_READY` $\to$ `STAGING_LOCK` $\to$ `DISK_READY`. Any subsequent mutation resets state to `VIRTUAL_READY`.
- **Root-Qualified Rule Keys:** All file-level preset rules (includes, excludes, tree-only, compressions) MUST use canonical composite keys: `${rootId}::${relativePath}`.
- **Windows Path Canonicalization:** On Windows, always uppercase drive letters (`C:`) and normalize backslashes to forward slashes before computing scoped keys (`${rootId}::${relativePath}`).
- **Redundant Slash Collapsing:** In `normalizePath` and `canonicalizePath`, always collapse multiple slashes (`clean = clean.replace(/\/+/g, '/')`) before checking trailing slashes.
- **Directory Trailing Slash Invariant & Child Joining:** Directory keys MUST always terminate with `/`. When traversing trees or concatenating a child node onto a normalized directory path `cleanDir`, use `${cleanDir}${child.name}`, NEVER `${cleanDir}/${child.name}` to prevent double slashes (`//`).
- **Physical vs. Tree-Only Accounting Rule:** Non-included file nodes (`tree-only` and `excluded`) MUST report `0` for `size`, `trueSize`, and `tokens` in the virtual graph. Parent directories MUST aggregate strictly the physical payload actually being exported.
- **Hierarchical Specificity Precedence (Bottom-Up):**
  1. Exact file and directory rules (`includeExact`, `treeOnlyExact`, `excludeExact`) ALWAYS override ancestor folder rules.
  2. Ancestor directory lookups MUST evaluate bottom-up (closest/deepest ancestor first via `cleanRel.lastIndexOf('/')`). The closest ancestor's rule wins.
- **Inclusion Punch-Through Independence:** Explicit inclusions punch through ancestor exclusions without inverting the rest of the workspace into a whitelist.

## 7. Inbound Dev Session & Diff Merge Architecture (v2.0+)

- **Subsystem Enclave Decoupling:** All dev session studio logic MUST reside within `src/features/session/`. `sessionStore.ts` must maintain zero-state bleed with `workspaceStore.ts`—it receives only `workspaceId` and `rootPaths` as operational parameters.
- **Workspace-Scoped Studio Viewport:** Dev studio views MUST live under the active workspace context below the application TitleBar (`top-10 inset-x-0 bottom-0 z-40`), NEVER as a blind window overlay covering TitleBar tabs. The TitleBar tabs must remain visible, draggable, and interactive so users can switch workspaces without losing studio session state.
- **Line 1 Action Prefix Pruning Rule:**
  - `stripProtocolScaffolding` must strip ONLY the action tag prefix (`[(NEW|MODIFIED|DELETED|PARTIAL_DIFF)]\s*`) from the first non-empty comment line.
  - The commented relative path (`// path/to/file.ext`, `# path/to/file.ext`, `<!-- path/to/file.ext -->`, `-- path/to/file.ext`) MUST be preserved for developer clarity and downstream model context.
- **Nested Code Fence Depth Invariant:** When `inCodeBlock === true` with outer fence length $N$:
  - A closing fence MUST have length $\ge N$ with zero trailing info string characters.
  - Any candidate fence with length $< N$ (such as inner 3-backtick blocks ` ```bash ` inside 4-backtick markdown) MUST be treated strictly as code content.
  - For target `.md` / `.mdx` files wrapped inside standard 3-backtick fences, track `innerFenceDepth` state to prevent inner code blocks from prematurely closing the outer file block.
- **Unclosed Code Fence Boundary Auto-Recovery:** If a new primary markdown header or a new opening fence with an explicit info string of length $\ge N$ is encountered while `inCodeBlock === true`, the parser must auto-close the previous block with an informational warning and immediately begin the subsequent section.
- **Skip Block Transparency Directive:** Xcerpt strictly prohibits synthesizing artificial code to hide skip blocks. If the model emits `// ... [Skipped: N lines] ...`, the skip marker is rendered directly in the diff stream with an amber decoration badge.
- **Extension-Preserving Deduplication:** If an LLM restates a file in multiple parts without closing tags, subsequent occurrences append `.PartN` before the file extension (e.g. `src/App.Part2.tsx`), preserving syntax highlighting and language server features.

## 8. Hard-Learned Gotchas & Defensive Patterns (Session 027+)

- **Regex Character Class Hyphen Range Hazard:** Never leave an unescaped hyphen inside a character class adjacent to other characters (e.g. `[^\s->]`). In JavaScript regex, `->` represents an ASCII character range from `-` (45) to `>` (62), which inadvertently matches and excludes both `.` (46) and `/` (47), breaking path and filename extraction. Always escape hyphens: `[^\s\->]`.
- **IPC Persistence Projection Parity:** Whenever new domain metadata fields are added to entities (e.g. `status`, `description`, `completedAt` on `DevSession`), the main process IPC handlers (such as `main.cjs` `session:list`) MUST explicitly project and return those fields. Omitting them will silently drop the properties across the IPC bridge, leaving client UI components in broken default fallback states.
- **Mutually Exclusive Viewport Modals:** Never stack multiple full-height modal views inside a single flex-column layout (e.g. mounting `IngestionTriageStudio` while `isStudioOpen` is true). Viewport states (`isIngestionModalOpen`, `isBrowserModalOpen`, `isStudioOpen`) must be strictly mutually exclusive in render hierarchy to prevent vertical window-splitting bugs.
- **Strict JavaScript Test Syntax (.mjs):** Never use TypeScript syntax (such as non-null assertion `!`) in `.mjs` test runner files. Node.js executes `.mjs` as standard ECMAScript modules and will throw fatal `SyntaxError: Unexpected token !`.
- **Zero setState in Render Effects:** In high-frequency text ingestion or search views, derive search matches and filtered lists purely via `useMemo([searchQuery, text])` rather than calling `setSearchMatches()` inside `useEffect`, preventing React 19 cascading render warnings.
