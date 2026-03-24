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

## Active Epoch: 03 - Advanced Workflows & Customization

### Session 009

- **Focus Area:** Architectural roadmapping, schema redesign, and documentation overhaul for Epoch 3.
- **Key Decisions:**
  - **Explicit Quick Exports:** Decoupled selection-based ephemeral exports from the background chunking engine. To protect the React UI thread during rapid marquee drags, "Quick Exports" will require an explicit user click ("Stage Selection") rather than continuous background generation.
  - **Workspace Presets:** Planned the migration of the `XcerptWorkspace` JSON schema. Global workspace states (like hard blacklists) will be separated from ephemeral configurations (Exclusions, Tree-Only paths), which will now live inside a `presets[]` array to allow multi-context swapping within the same codebase.
  - **AppConfig & Theming:** Designed a global `config.json` schema managed by the `AppStore` to handle application-agnostic settings. CSS variables will be injected at the `:root` level for real-time, performant theming (colors, fonts, scale).
  - **Extension Overrides:** Formulated a dictionary-based extension mapping system (e.g., `.uproject` -> `.json`) to bypass AI upload filters, ensuring the physical renaming is strictly documented inside the `ExportedFileTree.md` prompt legend so the LLM retains spatial awareness.
- **Roadblocks Resolved:**
  - Mitigated potential performance bottlenecks for the upcoming "Selection Stats" feature by establishing that token estimation will use a fast byte-to-token heuristic (rather than deep file reads) during tree painting.
- **Core Files Modified:**
  - `docs/0_Excerpt_Overview.md`, `docs/1_Excerpt_Architecture.md`, `docs/2_Excerpt_Workflows.md`, `docs/3_Excerpt_Implementation.md`

---

### Session 010

- **Focus Area:** Ephemeral Quick Exports, Selection Stats Heuristics, and Responsive UI Stabilization (Phase 9).
- **Key Decisions:**
  - **Live Token Heuristics:** Implemented a fast `bytes / 4` token estimation heuristic inside a `useMemo` in the `FileTree` to provide instant stats during rapid marquee selections without blocking the React UI thread with deep file reads.
  - **Ephemeral Export Engine:** Decoupled quick-exports from the workspace background chunker. Added `fs:stageEphemeralExport` to Node.js which generates process-bound, isolated temp directories exclusively containing the user's active tree selection.
  - **Sidebar Flyout Architecture:** Converted the right-side Rules/Stats sidebar into a fixed-position flyout overlay (`z-40`) controlled by global state and a `Tab` hotkey. This prioritizes the File Tree and Monaco Editor on narrow aspect ratios.
  - **Anti-CLS (Cumulative Layout Shift):** Stabilized the `FileTree` bottom action bar. It is now permanently mounted in the DOM, utilizing `opacity` and `pointer-events: none` to toggle visibility. This entirely eliminates vertical layout popping that previously caused target files to move out from under the user's cursor during selections.
  - **Container Queries for Panes:** Wrapped the `FileTree` in a Tailwind `@container`. UI elements now conditionally hide text labels (e.g., `@[240px]:inline`) based on the pane's localized width rather than the global OS window viewport.
- **Roadblocks Resolved:**
  - Fixed a TypeScript interface mismatch where `setExportState` threw errors because it lacked the new `isEphemeralBuilding` and `ephemeralDragPaths` properties added to the Zustand store.
- **Core Files Modified:**
  - `src/store/workspaceStore.ts`, `src/types/ipc.d.ts`
  - `main.cjs`, `preload.cjs`, `src/utils/exportEngine.ts`
  - `src/components/tree/FileTree.tsx`, `src/components/tree/TreeNode.tsx`
  - `src/components/layout/Sidebar.tsx`, `src/components/layout/TitleBar.tsx`

---

### Session 011

- **Focus Area:** Workspace Presets, Session Snapshots, and Ephemeral History (Phase 10).
- **Key Decisions:**
  - **Flat-State Sync Pattern:** Migrated the `WorkspacePayload` schema to `v3.0` to support multi-context presets. To prevent massive React refactoring and render locks, the active preset's rules are unpacked into "flat" Zustand state properties (`includes`, `excludes`, `compressions`) and repacked (`getPackedPresets()`) before saving or switching presets.
  - **Session-Bound Snapshots:** Implemented an in-memory snapshot pattern to support a "Revert Session Changes" feature. Snapshots are captured on preset load/creation and are strictly session-bound.
  - **Elevated Snapshot Memory:** Shifted the `presetSnapshots` registry into the global `AppStore` (`workspaceSnapshots`) to ensure session revert capabilities survive workspace tab switching without permanently writing them to the disk schema.
  - **Drag-Triggered History:** Decoupled export history logging from the payload generation step. History is now uniquely logged exactly once per `onDragStart` event, retaining the exact `files: string[]` array for future restoration.
  - **History UX & Flyout Inspector:** Transformed history items into robust cards with dual inline actions ("Package Context" & "Select in Tree"). Implemented a `HistoryInspector` fixed-position flyout that projects to the right of the sidebar, allowing users to safely peek at a history item's contents via hover without mutating their active tree selection.
- **Roadblocks Resolved:**
  - Prevented a crash caused by legacy history entries missing the newly added `files: string[]` array by implementing strict fallback arrays (`?.files || []`) and defensive rendering.
  - Resolved strict ESLint `@typescript-eslint/no-explicit-any` errors during v2.0 -> v3.0 legacy schema parsing by utilizing strict `unknown` type intersections.
- **Core Files Modified:**
  - `src/types/ipc.d.ts`, `src/store/workspaceStore.ts`, `src/store/appStore.ts`
  - `src/components/layout/Bootstrapper.tsx`, `src/components/layout/Sidebar.tsx`
  - `src/components/tree/FileTree.tsx`

---

### Session 012

- **Focus Area:** Global Application Configuration & Theming (Phase 11).
- **Key Decisions:**
  - **AppConfig Schema:** Implemented a workspace-agnostic `config.json` schema managed by the Node.js main process and integrated into the global `AppStore`.
  - **Dynamic Theme Engine:** Leveraged Tailwind v4's native CSS variable support by injecting `--theme-*` variables directly onto `document.documentElement.style` inside `App.tsx`. This allows real-time, hardware-accelerated color updates without React re-renders.
  - **Granular Font Scaling:** Abandoned overriding font size on the global `body` tag to protect Tailwind's `rem`-based spacing cascade. Dynamic font sizes are now explicitly passed to the `Monaco Editor` (via `options.fontSize`) and the `FileTree` (via inline style).
  - **Settings Modal Integration:** Built the `SettingsModal` as a full-screen overlay, reusing the `opacity-30 pointer-events-none` trick on the underlying layout to ensure TitleBar OS window controls remain functional.
- **Roadblocks Resolved:**
  - **Slider Cursor Drift:** When the UI `zoom` property was tied directly to the global store, dragging the slider scaled the DOM instantly, causing the slider handle to move away from the user's cursor. Fixed by decoupling the visual `<input type="range">` using local `useState` and only committing to the global `AppStore` on `onMouseUp`/`onTouchEnd`/`onKeyUp`.
- **Core Files Modified:**
  - `src/types/ipc.d.ts`, `main.cjs`, `preload.cjs`, `src/store/appStore.ts`
  - `src/App.tsx`, `src/index.css`, `src/components/layout/SettingsModal.tsx`
  - `src/components/layout/TitleBar.tsx`, `src/components/editor/ContextEditor.tsx`, `src/components/tree/FileTree.tsx`

---

### Session 013

- **Focus Area:** Global Extension Overrides and Prompt Integrity (Phase 12).
- **Key Decisions:**
  - **Dictionary Management UI:** Built a dedicated CRUD interface inside the `SettingsModal` allowing users to define arbitrary file extension mappings (e.g., `.uproject` -> `.json`).
  - **File Spoofing Engine:** Modified both the Ephemeral and Full Export engines to dynamically detect and physically rename files based on the global `extensionOverrides` config before they are written to the OS temp directory.
  - **Truth in Prompting:** Adhered strictly to the Prompt Integrity architecture rule by automatically appending `(Exported as [NewFileName])` directly to the `ExportedFileTree.md` Markdown tree structure for any spoofed file, ensuring the LLM understands the original file type despite the bypass.
- **Roadblocks Resolved:**
  - Fixed a TypeScript argument mismatch where the `Sidebar.tsx` history package generation was calling the old `generateEphemeralPayload` signature lacking the new `extensionOverrides` argument.
- **Core Files Modified:**
  - `src/components/layout/SettingsModal.tsx`
  - `src/utils/exportEngine.ts`
  - `src/components/layout/MainStage.tsx`, `src/components/export/ExportStage.tsx`, `src/components/tree/FileTree.tsx`, `src/components/layout/Sidebar.tsx`

---

## Archived Epochs

- **Epoch 00 (Template Setup):** Initialized the Agent Forge workflow.
- **Epoch 01 (Foundation & Architecture):** Established the core Vite + React + Electron + Zustand stack with Tailwind CSS v4. Enforced the "Stable Relative Path" architectural rule, binding all React keys and Zustand state maps strictly to file paths to permanently resolve UI selection drift. Bootstrapped the initial recursive file scanner and unified frameless Tree UI.
- **Epoch 02 (Context Compression & Export Staging):** Integrated `@monaco-editor/react` for context compression with a read-only, auto-healing skip-block system bound to stable relative paths. Built a high-performance Export Engine leveraging Node.js recursive scanning (using directory-first `dirent` checks to bypass `try/catch` I/O spikes), a single mutable `Context` object for memory safety, and flattened chunk exports via native OS drag-and-drop. Transitioned the architecture to a Multi-Workspace IDE utilizing a Dual-Store setup (`AppStore` for global IDE state, single re-hydrating `WorkspaceStore` for the active project) with implicit auto-saving, responsive container queries, and a full-screen Workspace Browser overlay.
