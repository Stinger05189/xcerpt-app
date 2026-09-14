<!-- docs/agents/devlog.md -->

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

## Active Epoch: 06 - Native LLM Integrations & Copilot Automation (v2.2.0)

### Session 029

- **Focus Area:** Dual-Width Left Pane Layout Architecture, Ultra-High-Performance Flat File/Folder Table View, Modal-Driven Export Configuration, Search Input Focus-Blurring Resolution, Hoisted Context Menu Dismissal, Parser Hyphen Path Invariant, and Multi-Root Disk Diffing Resolution.
- **Key Decisions:**
  - **Dual-Width Left Pane Architecture (`workspaceStore.ts` / `Bootstrapper.tsx` / `MainStage.tsx`):**
    - Recognized that multi-column table views require significantly wider viewports (size, tokens, skips, actions, types) than hierarchical tree views. Extended `paneWidths` to `{ sidebar: 320, tree: 400, table: 680 }` and introduced `leftPaneMode: 'tree' | 'table'`.
    - Persisted `leftPaneMode` and `paneWidths.table` across workspace serialization (`getWorkspacePayload`, `generateFreshWorkspace`, `hydrateWorkspace`).
    - Wired drag-resizing in `MainStage.tsx` to conditionally update `paneWidths.table` vs `paneWidths.tree` depending on the active mode, allowing users to toggle between modes with instant layout restoration.
  - **Ultra-High-Performance Flat Table View (`FileTableView.tsx`):**
    - Implemented a completely flat, non-hierarchical virtualized table using `@tanstack/react-virtual`.
    - Created dual sub-modes: **Files Mode** (individual files with path, extension, bytes/KB, tokens, skips, status, and 1-click rule actions) and **Folders Mode** (directories with aggregated file counts, included counts, total size, tokens, and skips).
    - Added multi-column sorting: File Size (asc/desc with raw byte precision), Tokens, Skips, Path/Name, Type, and Status.
    - Added comprehensive filter suite: **Exported (Included)** (directly solving user requests to view only staged files), **Tree-Only**, **Excluded**, **Has Skips**, and file extension filtering.
    - Implemented 1D mathematical marquee brushing, range selection, multi-selection keybind parity (`A`, `S`, `D`, `Escape`, `Ctrl+A`), and the bottom selection stats bar with ephemeral drag-and-drop packaging.
  - **Modal-Driven Export Configuration (`ExportConfigModal.tsx`):**
    - Completely removed the full-screen `ExportStage` view that previously took over the central Monaco code editor viewport.
    - Built `ExportConfigModal.tsx` as a clean, low-frequency dialog triggered from `MainStage.tsx` header, housing `mergeToSingleFile`, chunk size limits (`maxFilesPerChunk`), `.gitignore` inheritance, the `embedProtocol` toggle, live manifest text preview, and OS export cache folder launcher.
    - Ensured the central Monaco code editor and active file tabs remain permanently mounted and visible.
  - **Search Input Keyboard Focus Blurring:**
    - Diagnosed the root cause of keyboard shortcuts (`A`, `S`, `D`, `Esc`) failing after typing in search: `e.preventDefault()` inside row pointer-down handlers prevented Chromium from blurring active `<input>` elements.
    - Implemented explicit programmatic blurring (`document.activeElement.blur()`) on row pointer-down and container clicks across `FileTree.tsx` and `FileTableView.tsx`, alongside `Escape` key handling inside search inputs.
  - **Hoisted Context Menu State Invariant:**
    - Hoisted right-click context menu state to container level in `FileTree.tsx` and `FileTableView.tsx`, rendering via `createPortal` at the root and auto-dismissing whenever selections change, marquee painting begins, or hotkeys are pressed.
  - **Parser Hyphen Invariant Fix (`sessionParser.ts`):**
    - Resolved the critical bug where `// [MODIFIED] scripts/run-diagnostics.mjs` was parsed as `scripts/run` (filename: `run`). Discovered that character class `[^\s\->]+` was interpreting `\-` as a negated hyphen, truncating paths at the first hyphen. Replaced with `/[^\s]+/` and trailing comment stripping.
  - **Multi-Root Disk Content Resolution (`sessionStore.ts` / `sessionParser.ts`):**
    - Refactored `initSessionFromMarkdown` to parse actions deterministically before disk lookup, and query each path on disk across all `rootPaths` using `window.api.readFile`.
    - Resolved root selection precedence: the parser scans all roots and strictly binds to the root where file content is non-null, preventing false fallbacks to empty roots.
    - Added root-folder prefix stripping (e.g. `xcerpt-app/scripts/...`).
  - **Manifest Code Generation Protocol Expansion (`exportEngine.ts` / `Xcerpt_Manifest_xcerpt-app.md`):**
    - Expanded `CODE_GENERATION_PROTOCOL_INSTRUCTION` to provide explicit guidance on when models must use `[MODIFIED]` (full file output for small files <300 lines or complete rewrites) vs `[PARTIAL_DIFF]` (targeted slices with natural structural anchors and skip taxonomies for large files to avoid 5,000+ line outputs).
    - Enforced `embedProtocol: true` as the default configuration across all workspaces.
  - **Diagnostic Test Suites:**
    - Extended `scripts/run-diagnostics.mjs` with Suite 9 (Flat table extraction, size sorting, exported filter, embedProtocol default).
    - Extended `scripts/test-session-parser.mjs` with Suites 11, 12, and 13 (Hyphenated path invariant, multi-root disk diffing, and `PARTIAL_DIFF` recognition).
- **Core Files Modified / Created:**
  - `src/types/ipc.d.ts`, `src/store/workspaceStore.ts`, `src/components/layout/Bootstrapper.tsx`
  - `src/components/export/ExportConfigModal.tsx` (new), `src/components/tree/FileTableView.tsx` (new)
  - `src/components/tree/TreeNode.tsx`, `src/components/tree/FileTree.tsx`, `src/components/layout/MainStage.tsx`
  - `src/features/session/engine/sessionParser.ts`, `src/features/session/store/sessionStore.ts`
  - `src/features/session/components/triage/IngestionTriageStudio.tsx`, `src/features/session/components/ActionChecklist.tsx`
  - `src/utils/exportEngine.ts`, `Xcerpt_Manifest_xcerpt-app.md`
  - `scripts/run-diagnostics.mjs`, `scripts/test-session-parser.mjs`

---

## Archived Epochs

- **Epoch 00 (Template Setup):** Initialized the Agent Forge workflow.
- **Epoch 01 (Foundation & Architecture):** Established the core Vite + React + Electron + Zustand stack with Tailwind CSS v4. Enforced the "Stable Relative Path" architectural rule, binding all React keys and Zustand state maps strictly to file paths to permanently resolve UI selection drift. Bootstrapped the initial recursive file scanner and unified frameless Tree UI.
- **Epoch 02 (Context Compression & Export Staging):** Integrated `@monaco-editor/react` for context compression with a read-only, auto-healing skip-block system bound to stable relative paths. Built a high-performance Export Engine leveraging Node.js recursive scanning (using directory-first `dirent` checks to bypass `try/catch` I/O spikes), a single mutable `Context` object for memory safety, and flattened chunk exports via native OS drag-and-drop. Transitioned the architecture to a Multi-Workspace IDE utilizing a Dual-Store setup (`AppStore` for global IDE state, single re-hydrating `WorkspaceStore` for the active project) with implicit auto-saving, responsive container queries, and a full-screen Workspace Browser overlay.
- **Epoch 03 (Advanced Workflows & Customization):** Decoupled the background chunking engine from explicitly invoked, process-bound "Ephemeral Quick Exports". Migrated workspace logic to a Preset-based architecture allowing users to swap visual exclusions and compression profiles instantly. Overhauled the UI with a fixed-position flyout sidebar, eliminated vertical layout shifting (CLS) in the File Tree, and integrated dynamic, CSS-variable-based theming. Introduced a global File Spoofing engine (Extension Overrides) to seamlessly bypass strict LLM upload filters while explicitly logging the physical renaming inside the prompt. Fixed critical Node.js CPU/Event Loop starvation by migrating export I/O to synchronous blocking calls and utilizing native regex evaluations to shield Chokidar watcher events.
- **Epoch 04 (Rendering Optimization & Curation Architecture - v1.6.0 & v1.6.1):** Overhauled outbound curation to a zero-hitch virtual payload graph in RAM, eradicating background disk thrashing and operating system file locks via guarded read-only descriptors. Enforced scoped composite path keys (`${rootId}::${relativePath}`) and bottom-up directory lookups (`lastIndexOf`), resolving cross-root rule pollution and inclusion traps while clocking 10,000 nodes in under 20ms (< 25ms SLA). Eradicated double-slash traversal bugs, standardized canonical manifest naming with embedded code generation protocols, established tree-only 0-byte metrics, and introduced VS Code-style transient/pinned tabs with drag overflow scrolling.
- **Epoch 05 (Bidirectional LLM Dev Studio - v2.0.0):** Completed the bidirectional inbound response engineering pipeline with Monaco Diff and manual buffer editing while preserving language comment syntax and line 1 relative file paths. Built the Interactive Ingestion Triage Studio with real-time file boundary rulers, multi-location reasoning associations (preamble, interstitial, epilogue), and nested code fence depth tracking for markdown-wrapped files. Established non-invasive Git working tree integration, checkpoint rollbacks, and full-screen session catalog management with IPC projection parity.