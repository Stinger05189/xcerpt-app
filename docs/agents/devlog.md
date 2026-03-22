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

## Active Epoch: 01 - Foundation & Architecture

### Session 001

- **Focus Area:** Project initialization, environment scaffolding, and agent documentation formalization.
- **Key Decisions:**
  - Adopted Electron + React + Vite + TypeScript as the core stack for "Xcerpt" to replace the legacy Python/PyQt version.
  - Chose Zustand for global state management to handle deep tree structures without Redux boilerplate.
  - Established the "Stable Relative Path" architectural rule: all React keys and state maps (expanded, selected, excluded) will bind to relative file paths instead of UI indexes to permanently resolve the erratic selection/scroll resets found in the legacy application.
- **Roadblocks Resolved:**
  - Initial Vite/Electron boilerplate generated manually by the User to ensure a stable launch point and avoid AI hallucination during complex build-step configurations.
- **Core Files Modified:**
  - `package.json`, `vite.config.ts`, `main.cjs`, `preload.cjs`
  - `agents/conventions.md`, `agents/plan.md`, `agents/devlog.md`

## Active Epoch: 02 - Context Compression & Export Staging

### Session 002

- **Focus Area:** Integrating Monaco Editor for Context Compression and building the Export Staging chunking logic.
- **Key Decisions:**
  - Decided to use `@monaco-editor/react` for the code viewer. We will mount it conditionally in a right-hand split pane to preserve performance.
  - Context compression markers (`startLine`, `endLine`) will be stored in Zustand mapped to the stable relative path of the file.
  - Added `fs:readFile` IPC endpoint to allow the Renderer to lazily load file contents into Monaco only when selected, keeping memory usage low.
- **Roadblocks Resolved:**
  - Resolved Vite/Tailwind v4 CSS compilation issue by explicitly installing and configuring the `@tailwindcss/vite` plugin.
- **Core Files Modified:**
  - `src/store/workspaceStore.ts`, `src/components/layout/MainStage.tsx`
  - `main.cjs`, `preload.cjs`, `src/types/ipc.d.ts`

---

### Session 003

- **Focus Area:** Implemented Context Editor (Monaco) and Export Staging preview; resolved critical React/Monaco integration bugs.
- **Key Decisions:**
  - Shifted away from Tailwind utility classes inside Monaco configuration. Monaco's virtualized DOM fails to parse classes with special characters (like `/`). We now use standard global CSS classes (e.g., `.monaco-skip-block-line`) for editor decorations.
- **Roadblocks Resolved:**
  - **Stale Closures:** The `xcerpt-skip-block` context menu was trapping the initial `relativePath` in a stale closure. Fixed by forcing a React unmount/remount of the `<ContextEditor>` using `key={activeFile}`.
  - **React Strict Mode Artifacts:** Identified and safely ignored the `Uncaught {type: 'cancelation'}` error thrown by Monaco during React 18's strict mode double-mount.

---

### Session 004

- **Focus Area:** Workflow Refinement, Context Resiliency, & Frameless Shell formatting.
- **Key Decisions:**
  - Implemented a custom frameless Electron shell (`frame: false`) utilizing `WebkitAppRegion` in React and IPC window controls.
  - Moved the `HARD_BLACKLIST` (`.git`, `node_modules`) to global state. Passing this array over IPC to the Node.js scanner entirely bypassed the massive performance hit of reading dependency directories.
  - **Drift Management:** Upgraded the `CompressionRule` schema to capture the exact string `signature` of the skipped block. Xcerpt now assumes files are edited externally; upon file load, it automatically scans +/- 50 lines to detect offset changes and heals the skip coordinates in Zustand.
  - Locked the Monaco editor to `readOnly: true`, disabled TS diagnostics, enabled the minimap, and added a `Ctrl/Cmd + Backspace` quick-skip shortcut.
- **Roadblocks Resolved:**
  - Fixed the Monaco style-persistence bug. Decorations were disappearing because React fired the `useEffect` before Monaco had fully ingested the new file content. Bound decoration updates to a strict content matching check.
  - Fixed Export Stage rendering lag by wrapping the batch limit numeric input in a local React debounce effect.
- **Core Files Modified:**
  - `main.cjs`, `preload.cjs`, `src/types/ipc.d.ts`
  - `src/components/layout/TitleBar.tsx`, `src/App.tsx`, `src/components/layout/Sidebar.tsx`
  - `src/store/workspaceStore.ts`, `src/components/editor/ContextEditor.tsx`, `src/components/export/ExportStage.tsx`

---

### Session 005

- **Focus Area:** Export Engine, Native Drag & Drop, Tertiary "Tree-Only" State, and Curation UI enhancements.
- **Key Decisions:**
  - Implemented a session-scoped OS temp directory (`xcerpt_session_<pid>`) that wipes and rebuilds on every payload generation to prevent disk bloat.
  - Flattened all exported files and encoded their relative paths into the filename (e.g., `src_components_Button.tsx`) to prevent naming collisions and support LLM chat interfaces that reject folder uploads.
  - Introduced a tertiary `tree-only` state. These files are skipped during physical export but are injected into the generated `ExportedFileTree.md` as `[Content Omitted]`, preserving structural context for the LLM.
  - Built a marquee-style "paint" selection system with a contextual action bar and global keyboard shortcuts (A, S, D, Esc) to drastically speed up curation.
  - Decoupled the React `useEffect` auto-build pipeline to mark payloads as `isStale` instantly, while deferring the Node.js disk write via a 1.5s debounce.
- **Roadblocks Resolved:**
  - `startDrag` failed on directories; refactored the UI to map chunk folders into an array of absolute file paths.
  - Addressed React rendering bottlenecks during bulk selections by creating a single-pass `applyRuleToSelection` Zustand mutation.
- **Remaining Roadblocks:**
  - Chokidar watcher is still locking up Node on massive roots and not consistently triggering the payload refresh.
  - Needs a much more aggressive default blacklist (Unreal Engine, Obsidian, etc.) and smart predictions for tree-only files (`package-lock.json`, `.env`).

---

## Archived Epochs

- **Epoch 01 (Foundation & Architecture):** Established the Electron+React+Zustand+Tailwind v4 stack. Built the IPC bridge, implemented the recursive file scanner in Node.js, and constructed the Unified Tree UI with dynamic visual exclusion filtering using `ignore`.
- **Epoch 00 (Template Setup):** Initialized the Agent Forge workflow.
