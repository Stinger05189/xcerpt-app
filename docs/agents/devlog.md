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

## Active Epoch: 04 - Rendering Optimization & Deployment

### Session 023

- **Focus Area:** Version 1.6.1 Curation Integrity, Path Invariant Hardening, and Preset Exclusion Synthesis.
- **Key Decisions:**
  - **Inclusion-Trap Decoupling:** Resolved the critical bug where adding an explicit inclusion to an item inadvertently converted the entire workspace into an exclusion whitelist. Established that in default mode, inclusions act as specific punch-throughs against ancestor exclusions without penalizing sibling files.
  - **Bottom-Up Hierarchical Specificity (`lastIndexOf`):** Refactored `ScopedRuleIndex.getStatus` so that exact target rules (`includeExact`, `treeOnlyExact`, `excludeExact`) are checked first, and directory ancestors are checked bottom-up (closest ancestor first via `cleanRel.lastIndexOf('/')`). Deeper subfolder and child rules now override parent folder inclusions deterministically.
  - **Exclusion Synthesis for Selection Presets:** Re-architected `createPresetFromSelection`. Rather than relying on implicit runtime flags, the engine now traverses workspace trees via `generateExclusionsForSelection` and synthesizes real, compacted exclusion rules for all non-selected directories and files. The resulting preset is 100% transparent, editable, and visible in the Sidebar.
  - **Directory Trailing Slash Invariant:** Enforced strict slash invariants (`/` for directories, no slash for files) across `toScopedPathKey`, `compactRules`, `TreeNode`, and `FileTree`.
  - **Throughput SLA Verification:** Streamlined `getStatus` with cons-string concatenation and early returns, running 10,000 nodes in under 20ms and comfortably beating the < 25ms SLA.
- **Roadblocks Identified for Next Session:**
  - **Double-Slash Path Formatting Defect:** Identified that `${cleanRelative}/${child.name}` in `exportEngine.ts` caused double-slash paths (`src/components//Button.tsx`) when `cleanRelative` already had a trailing slash. This caused `compressions` lookups and `tree-only` status checks to miss during export generation.
- **Core Files Modified:**
  - `src/types/ipc.d.ts`, `src/utils/filterEngine.ts`, `src/utils/exportEngine.ts`
  - `src/store/workspaceStore.ts`, `src/components/tree/FileTree.tsx`, `src/components/tree/TreeNode.tsx`, `src/components/tree/ContextMenu.tsx`, `src/components/tree/useFlattenedTree.ts`
  - `src/components/export/PayloadPreviewTree.tsx`, `src/components/export/ExportStage.tsx`
  - `scripts/run-diagnostics.mjs`

---

### Session 022

- **Focus Area:** Version 1.6.0 Zero-Hitch Architecture, Performance Optimization, and Inheritance Bug Resolutions.
- **Key Decisions:**
  - **In-Memory Virtual Payload Graph & JIT Staging:** Completely eliminated eager background disk writes during curation. State mutations recalculate a pure in-memory Virtual Payload Graph; physical staging to temporary disk directories occurs Just-In-Time (`VIRTUAL_READY` $\to$ `STAGING_LOCK` $\to$ `DISK_READY`) strictly when an export is triggered or on drag initiation.
  - **Scoped Composite Key Architecture:** Refactored preset rule schemas to use `${rootId}::${relativePath}` composite keys, guaranteeing multi-root rule isolation without cross-root rule pollution while preserving global directory blacklists.
  - **$O(\text{depth})$ Ancestor Prefix Tree Lookups:** Replaced the $O(N \times R)$ linear prefix loop with slash-delimited ancestor `Set<string>` lookups. Node evaluation latency dropped from >118ms to ~24ms, and benchmark velocity surged from 84,000 ops/sec to 345,000+ ops/sec.
  - **Wildcard Segregation for Rule Indexing:** Isolated literal paths and directory prefixes from regex evaluation. Only rules containing actual glob wildcards (`*`, `?`, `[`) are dispatched to `ignore()`; literal paths resolve in $O(1)$ and $O(\text{depth})$ Set checks.
  - **Granular Zustand Selectors:** Swapped whole-store and whole-set subscriptions (`s => s.selectedFiles`) in `TreeNodeComponent` and `Sidebar` for granular boolean selectors (`s => s.selectedFiles.has(...)`). Unselected nodes and the sidebar no longer re-render during marquee drag painting, eliminating a 696ms INP bottleneck.
  - **Hierarchical Rule Compaction (`compactRules`):** Added automated pruning of redundant child file rules when an ancestor directory rule is active, preventing unbounded sidebar list bloat.
  - **Tab Lifecycle & Context Menu Focus:** Introduced VS Code-style transient (italic) vs pinned editor tabs, horizontal mouse-wheel/right-drag overflow scrolling, and capture-phase click-outside dismissal for context menus.
  - **Diagnostic & Live Profiling Suite:** Introduced `scripts/run-diagnostics.mjs` and an in-app "Profile Active Workspace" tool in the Sidebar Stats tab with instant clipboard export.
- **Roadblocks Resolved:**
  - **Windows Backslash Mismatch in Folder Exclude Inheritance:** Fixed an issue where `C:\...` roots failed `startsWith` checks against canonical `C:/...` keys, causing child files inside excluded directories to remain included.
  - **Component-Level Rule Indexing Storm:** Resolved a severe 285ms flame-chart bottleneck where `TreeNodeComponent` was compiling a fresh `ScopedRuleIndex` on every render. Hoisted status calculation to `useFlattenedTree` and passed `status` as a pure prop.
- **Core Files Modified:**
  - `main.cjs`, `package.json`, `scripts/run-diagnostics.mjs`
  - `src/utils/filterEngine.ts`, `src/utils/exportEngine.ts`
  - `src/store/workspaceStore.ts`, `src/types/ipc.d.ts`
  - `src/components/tree/TreeNode.tsx`, `src/components/tree/FileTree.tsx`, `src/components/tree/useFlattenedTree.ts`, `src/components/tree/ContextMenu.tsx`
  - `src/components/layout/MainStage.tsx`, `src/components/layout/Sidebar.tsx`
  - `src/components/editor/ContextEditor.tsx`, `src/components/export/ExportStage.tsx`, `src/components/export/PayloadPreviewTree.tsx`

---

### Session 021

- **Focus Area:** Gitignore Rule Overriding, Missing Path Relocation, Multi-Root Export Disambiguation, and Workspace Name Persistence.
- **Key Decisions:**
  - **Gitignore Rule Bypass:** Added a `respectGitignore` workspace setting. Updated `main.cjs` to conditionally bypass `.gitignore` parsing when set to false, allowing users to explicitly export git-ignored files via custom tree rules.
  - **Missing Path Relocation:** Modified `scanDirectory` IPC to catch root `ENOENT` errors and return an explicit `isMissing: true` flag. Built `relocateRootPath` in `WorkspaceStore` and created a "Directory Not Found" fallback view in `MainStage` with a "Locate Directory" dialog picker.
  - **Multi-Root Name Disambiguation:** Enhanced `generateExportPayload` in `exportEngine.ts` to detect identical root leaf folder names (e.g. two roots named `src`) and dynamically append occurrence suffixes (`src_1`, `src_2`) to prevent file collisions.
  - **Workspace Name Persistence & Inspector Rename:** Added `setWorkspaceName` to Zustand. Fixed a race condition where auto-saving overwrote newly renamed workspaces back to `null`. Added inline workspace renaming directly to the Workspace Inspector header in `Sidebar.tsx`.
- **Roadblocks Resolved:**
  - Resolved workspace name reversion by syncing React store state in `WorkspaceBrowser` and `Sidebar` prior to background disk flushes.

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

## Archived Epochs

- **Epoch 00 (Template Setup):** Initialized the Agent Forge workflow.
- **Epoch 01 (Foundation & Architecture):** Established the core Vite + React + Electron + Zustand stack with Tailwind CSS v4. Enforced the "Stable Relative Path" architectural rule, binding all React keys and Zustand state maps strictly to file paths to permanently resolve UI selection drift. Bootstrapped the initial recursive file scanner and unified frameless Tree UI.
- **Epoch 02 (Context Compression & Export Staging):** Integrated `@monaco-editor/react` for context compression with a read-only, auto-healing skip-block system bound to stable relative paths. Built a high-performance Export Engine leveraging Node.js recursive scanning (using directory-first `dirent` checks to bypass `try/catch` I/O spikes), a single mutable `Context` object for memory safety, and flattened chunk exports via native OS drag-and-drop. Transitioned the architecture to a Multi-Workspace IDE utilizing a Dual-Store setup (`AppStore` for global IDE state, single re-hydrating `WorkspaceStore` for the active project) with implicit auto-saving, responsive container queries, and a full-screen Workspace Browser overlay.
- **Epoch 03 (Advanced Workflows & Customization):** Decoupled the background chunking engine from explicitly invoked, process-bound "Ephemeral Quick Exports". Migrated workspace logic to a Preset-based architecture allowing users to swap visual exclusions and compression profiles instantly. Overhauled the UI with a fixed-position flyout sidebar, eliminated vertical layout shifting (CLS) in the File Tree, and integrated dynamic, CSS-variable-based theming. Introduced a global File Spoofing engine (Extension Overrides) to seamlessly bypass strict LLM upload filters while explicitly logging the physical renaming inside the prompt. Fixed critical Node.js CPU/Event Loop starvation by migrating export I/O to synchronous blocking calls and utilizing native regex evaluations to shield Chokidar watcher events.
