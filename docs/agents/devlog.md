# devlog.md

# Project Dev Log & Core Memory

> **[IMMUTABLE AI DIRECTIVE]**
> **DO NOT MODIFY THIS INSTRUCTION BLOCK.**
> This file is the project's historical ledger and your core memory. It is organized into "Epochs" (major milestones) and sequential "Sessions".
>
> **Your Responsibilities:**
>
> 1. **Session Incrementation:** Never use dates. Increment the Session ID sequentially (e.g., Session 001, Session 002) for every new `[END SESSION]` teardown.
> 2. **Teardown Protocol:** At the end of a session, append a new Session Entry under the Active Epoch. Keep it dense, technical, and focused on _decisions_ and _roadblocks_ rather than granular code steps.
> 3. **Epoch Archiving:** When the User declares a major milestone complete, summarize the previous Epoch's sessions into a dense, 3-4 sentence paragraph to save token context, then begin a new Epoch.

---

## Active Epoch: 04 - Rendering Optimization & Deployment

### Session 015

- **Focus Area:** UI Rendering Optimization, DOM Virtualization, and 1D Marquee Drag Engine (Phase 13).
- **Key Decisions:**
  - **Tree Virtualization:** Replaced deeply nested, recursive DOM rendering with a headless virtualization engine (`@tanstack/react-virtual`). Created `useFlattenedTree.ts` to mathematically flatten the 1D structure, dropping hidden/collapsed nodes before render.
  - **1D Math Marquee Engine:** Completely ripped out DOM-based `onMouseEnter` tick-dependent painting. Implemented a purely mathematical drag engine that calculates the active row index via `Math.floor(offsetY / ROW_HEIGHT)` during `pointermove`.
  - **Auto-Scroll Loop:** Bound a `requestAnimationFrame` loop to the drag state, allowing smooth, infinite scrolling when the cursor hits the top/bottom 40px of the tree container.
- **Roadblocks Resolved:**
  - **Stale Closure Misalignment:** Fixed an issue where the math marquee mapped indices to a "ghost" array of closed folders. Fixed by pointing the selection engine to a `useRef` tracking the latest `flatNodes` array, bypassing React's `memo` closures.
  - **Fixed Positioning clipping:** Fixed the Context Menu flying off-screen or clipping under panes. Virtualization's `transform: translateY()` creates a new CSS containing block, breaking `position: fixed`. Fixed by ejecting the menu via `createPortal(..., document.body)`.
- **Core Files Modified:**
  - `package.json`, `src/components/tree/useFlattenedTree.ts`
  - `src/components/tree/TreeNode.tsx`, `src/components/tree/FileTree.tsx`, `src/components/tree/ContextMenu.tsx`, `src/store/workspaceStore.ts`

---

### Session 016

- **Focus Area:** Branding, Build Pipeline, Auto-Updater Integration, and Open-Source Launch (Phase 14).
- **Key Decisions:**
  - **Branding:** Designed and integrated a pure SVG geometric logo representing context compression.
  - **Build System:** Integrated `electron-builder` to compile NSIS (Windows), DMG (Mac), and AppImage (Linux) targets directly from the Vite `dist/` output.
  - **Distribution Strategy:** Transitioned the project to a public repository with an MIT License. Leveraged `electron-updater` linked to GitHub Releases for seamless, zero-cost differential updates.
  - **Production Security:** Locked `webPreferences.devTools` behind `!app.isPackaged` to ensure the Chromium inspector is stripped from public binaries.
- **Roadblocks Resolved:**
  - **Packaged Asset Resolution:** Fixed a bug where the `TitleBar` logo disappeared in the compiled executable. Changed absolute asset paths (`/icon.svg`) to relative paths (`./icon.svg`) to prevent Electron from incorrectly querying the OS root drive when running via the `file://` protocol.
  - **CLI Argument Swallowing:** Fixed NPM swallowing the publish flag by enforcing the `--` separator (`npm run dist -- -p always`).
  - **Token Handling:** Clarified the auto-updater security architecture: GitHub PATs are strictly for local developer uploads via `electron-builder` and are never required by the client-side `electron-updater`.

---

### Session 017

- **Focus Area:** Workspace Statistics, Git Integration, Export UI Overhaul, and Updater UX (Phase 15).
- **Key Decisions:**
  - **Hard Blacklisting (`.gitignore`):** Shifted `.gitignore` parsing directly into the `main.cjs` recursive scanner using the `ignore` package. Ignored folders are now instantly dropped before IPC transmission or watcher attachment, drastically improving performance.
  - **Git Status Integration:** Integrated a non-blocking `git status --porcelain` execution in the Node backend. Polled dynamically on tab switches and external edits, mapping states (M, A, ??) to distinct text colors in `TreeNode` without overriding explicit Excluded/Tree-Only UI states.
  - **Export Table & Resizability:** Completely overhauled the `ExportStage` payload chunk view from a flat list to a rich, sortable HTML `<table>`. Implemented `<colgroup>` with `table-layout: fixed` and custom pointer drag-handlers for smooth column resizing.
  - **Workspace Statistics:** Expanded the `WorkspacePayload` schema to track `totalExports`, `ephemeralExports`, and `fileFrequencies`. Rendered these as persistent global metrics in the `Sidebar` and wired them to the new Export Table.
  - **Updater UX:** Displayed `appVersion` in the TitleBar alongside a manual "Check for Updates" button and a subtle progress bar mapped to `autoUpdater` download events.
- **Roadblocks Resolved:**
  - **Production Drag-and-Drop Image:** Fixed native dragging in packaged binaries by conditionally routing `nativeImage.createFromPath` to `dist/drag-package.png` when `app.isPackaged` is true.
  - **Z-Index Clipping:** Lowered the resizable tree handle to `z-10` to prevent it from intercepting pointer events when the `Workspace Inspector` flyout overlaps it.
  - **Stale Closures:** Added `fetchGitStatus` to the `MainStage` watcher `useEffect` dependencies to satisfy React hook purity rules.
- **Core Files Modified:**
  - `main.cjs`, `preload.cjs`, `src/types/ipc.d.ts`
  - `src/store/appStore.ts`, `src/store/workspaceStore.ts`
  - `src/components/export/ExportStage.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/MainStage.tsx`, `src/components/layout/TitleBar.tsx`
  - `src/components/tree/TreeNode.tsx`, `src/components/tree/ContextMenu.tsx`, `src/utils/exportEngine.ts`

---

### Session 018

- **Focus Area:** High-Fidelity Tokenization, UI Reactivity, Native Drag-and-Drop Tabs, and Workspace Browser Overhaul (Phase 16).
- **Key Decisions:**
  - **BPE Tokenization (`js-tiktoken`):** Replaced the generic byte-division heuristic with an exact `cl100k_base` BPE tokenizer. To protect the 60fps React marquee engine, file reading and tokenization were offloaded to a non-blocking Node.js IPC handler (`fs:calculateTokens`), triggered only after active UI painting concludes.
  - **Native Tab Reordering:** Implemented standard HTML5 Drag-and-Drop (`draggable={true}`, `onDragStart`, `onDrop`) for both Workspace Tabs (TitleBar) and Root Path Tabs (MainStage), avoiding the bloat of third-party DND libraries.
  - **Export Stage UX:** Refactored the payload chunk data tables from fixed absolute widths to responsive `w-full min-w-max` structures while retaining `<colgroup>` resizability. Added an absolute-positioned Markdown Preview Modal for `ExportedFileTree.md`.
  - **Browser Brand Overhaul:** Redesigned the Workspace Browser with an embedded SVG geometric background, sort/filter controls (Recent, Name, Exports), and explicit data badges for historical payload metrics (`totalExports`, `ephemeralExports`).
- **Roadblocks Resolved:**
  - **Cross-Store Reactivity:** Fixed an issue where changing global `extensionOverrides` didn't rebuild the workspace payload. Bridged the stores by forcing `WorkspaceStore.getState().setExportState({ isStale: true })` whenever the AppStore configuration is updated.
- **Core Files Modified:**
  - `package.json`, `main.cjs`, `preload.cjs`, `src/types/ipc.d.ts`
  - `src/components/tree/FileTree.tsx`, `src/components/export/ExportStage.tsx`
  - `src/components/layout/TitleBar.tsx`, `src/components/layout/MainStage.tsx`, `src/components/layout/WorkspaceBrowser.tsx`
  - `src/store/appStore.ts`, `src/store/workspaceStore.ts`

---

### Session 019

- **Focus Area:** Tree Visibility Toggles, Expand/Collapse All, and Global Undo/Redo Architecture.
- **Key Decisions:**
  - **Global History Engine:** Implemented a cross-boundary `HistoryStore` using the Command Pattern. Instead of saving massive state snapshots, the system saves the inverse mutation closures (deltas) of user actions.
  - **Async Context Resolution:** Built an autonomous environment switcher (`resolveContext`). When an undo is triggered, the engine automatically navigates to the correct Workspace Tab, switches to the correct Preset, and awaits the async disk-hydration sequence before executing the mutation.
  - **LZ-String Compression:** Integrated `lz-string` to Base64-compress bulk array closures (like `Expand All` or large selections) before pushing to the history stack. This allows a massive 1000-step history limit with virtually zero memory footprint.
  - **Scroll Anchoring:** Bound the `FileTree` scroll offset to a Zustand getter. History commands capture the exact Y-coordinate of the tree and instantly snap the virtualization engine back to that pixel upon Undo/Redo.
  - **Tree Filtering Optimization:** Added "Hide Excluded" and "Hide Tree-Only" toggles. Moved the `ignore` evaluation into `useFlattenedTree` using a high-performance, single-pass pre-compiled regex engine to prevent garbage-collection thrashing.
- **Roadblocks Resolved:**
  - **Cascading Render Warnings:** Fixed React Strict Mode errors caused by synchronous `setState` updates inside the `ToastContainer` effect by deferring the visibility mutation to the macro-task queue (`setTimeout(() => setVisible(true), 0)`).
- **Core Files Modified:**
  - `package.json`
  - `src/store/historyStore.ts`, `src/store/workspaceStore.ts`, `src/store/appStore.ts`
  - `src/components/layout/ToastContainer.tsx`, `src/components/layout/TitleBar.tsx`, `src/components/layout/Bootstrapper.tsx`
  - `src/components/tree/FileTree.tsx`, `src/components/tree/useFlattenedTree.ts`
  - `src/App.tsx`

---

### Session 020

- **Focus Area:** Editor UX Refinement, Monolithic Context Export, and Deferred State Management (Phase 17).
- **Key Decisions:**
  - **Monolithic Context Export:** Added a `mergeToSingleFile` workspace configuration. The Node.js backend intercepts the standard multi-file chunking loop to physically construct a unified `context.md` file containing the markdown tree and all code blocks, fulfilling specific LLM context requirements.
  - **Deferred Editor State (Dirty Engine):** Decoupled the Monaco editor's skip-block mutations from the global `workspaceStore`. `ContextEditor.tsx` now uses a localized `draftCompressions` state, preventing instantaneous background payload rebuilds and UI event-loop starvation during rapid highlighting. Added explicit Save/Discard toolbar controls.
  - **Multi-Cursor & Monaco Overhauls:** Upgraded the `xcerpt-skip-block` action to iterate through `editor.getSelections()`, sorting and mathematically merging overlapping ranges to prevent corrupted skip markers. Enforced `showSlider: 'always'` and `size: 'fill'` on the minimap, and injected skip-block visualizations into the scrollbar via `overviewRuler`.
- **Roadblocks Resolved:**
  - **Refs in Render Phase:** Fixed strict-mode ESLint crashes caused by reading `lastSavedRef.current` during the render phase to calculate the `isDirty` state. Converted the check to a pure string comparison against the prop.
  - **Verbatim Module Syntax:** Resolved TypeScript compilation errors in `ContextEditor.tsx` by explicitly using `type` imports for `CompressionRule`.
- **Core Files Modified:**
  - `src/store/workspaceStore.ts`, `src/types/ipc.d.ts`
  - `main.cjs`, `src/utils/exportEngine.ts`
  - `src/components/editor/ContextEditor.tsx`, `src/components/export/ExportStage.tsx`, `src/components/layout/MainStage.tsx`

---

## Archived Epochs

- **Epoch 00 (Template Setup):** Initialized the Agent Forge workflow.
- **Epoch 01 (Foundation & Architecture):** Established the core Vite + React + Electron + Zustand stack with Tailwind CSS v4. Enforced the "Stable Relative Path" architectural rule, binding all React keys and Zustand state maps strictly to file paths to permanently resolve UI selection drift. Bootstrapped the initial recursive file scanner and unified frameless Tree UI.
- **Epoch 02 (Context Compression & Export Staging):** Integrated `@monaco-editor/react` for context compression with a read-only, auto-healing skip-block system bound to stable relative paths. Built a high-performance Export Engine leveraging Node.js recursive scanning (using directory-first `dirent` checks to bypass `try/catch` I/O spikes), a single mutable `Context` object for memory safety, and flattened chunk exports via native OS drag-and-drop. Transitioned the architecture to a Multi-Workspace IDE utilizing a Dual-Store setup (`AppStore` for global IDE state, single re-hydrating `WorkspaceStore` for the active project) with implicit auto-saving, responsive container queries, and a full-screen Workspace Browser overlay.
- **Epoch 03 (Advanced Workflows & Customization):** Decoupled the background chunking engine from explicitly invoked, process-bound "Ephemeral Quick Exports". Migrated workspace logic to a Preset-based architecture allowing users to swap visual exclusions and compression profiles instantly. Overhauled the UI with a fixed-position flyout sidebar, eliminated vertical layout shifting (CLS) in the File Tree, and integrated dynamic, CSS-variable-based theming. Introduced a global File Spoofing engine (Extension Overrides) to seamlessly bypass strict LLM upload filters while explicitly logging the physical renaming inside the prompt. Fixed critical Node.js CPU/Event Loop starvation by migrating export I/O to synchronous blocking calls and utilizing native regex evaluations to shield Chokidar watcher events.
