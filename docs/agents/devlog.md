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

## Active Epoch: 05 - Bidirectional LLM Dev Studio (v2.0.0)

### Session 025

- **Focus Area:** Inbound Dev Session Domain Architecture, Standalone Protocol Parser, Monaco Diff Merge Viewers, and Diagnostic Test Suite.
- **Key Decisions:**
  - **Decoupled Feature Enclave (`src/features/session/`):** Established the inbound dev session studio completely isolated from `workspaceStore.ts`. Designed `sessionStore.ts` to manage active sessions, file actions, review statuses (`PENDING`, `MERGED`, `REJECTED`), pre-session file snapshots, and physical mutations via dedicated IPC handlers (`session:*`).
  - **Protocol-Compliant Parsing Engine (`sessionParser.ts`):** Implemented an off-thread pure parser supporting depth-aware backtick code fence parsing, extension-preserving deduplication (`.Part2.ext`), unclosed fence auto-recovery at header boundaries, and automated regex stripping (`stripProtocolScaffolding`) to purge line-1 action comments from diff inputs across C-style, Python, HTML, and SQL comment formats.
  - **Monaco Diff & Specialized Viewers:** Integrated `@monaco-editor/react` `DiffEditor` for side-by-side and inline visual comparisons, paired with `NewFilePreview.tsx` (syntax-highlighted single editor for `[NEW]`) and `DeletedFileBanner.tsx` (tombstone view for `[DELETED]`).
  - **Reasoning Drawer & Full Plan Viewer:** Built a collapsible drawer rendering pre-code summaries and linked architectural intent directly above diffs, and created `FullPlanViewer.tsx` to display unadulterated markdown commentary.
  - **Diagnostic Test Harness (`scripts/test-session-parser.mjs`):** Built a standalone Node.js diagnostic suite achieving 22 passing assertions across 6 suites.
  - **Identified Roadblocks for Session 026:**
    - _Suite 1 Nested Fence Defect:_ In `sessionParser.ts`, when `inCodeBlock === true` with outer fence length $N=4$, an inner 3-backtick fence with an info string (` ```bash `) was falsely matched as `isNewOpeningFenceWhileUnclosed`. Any fence where `length < codeFenceLength` must be strictly treated as text.
    - _Monaco Diff Interactivity:_ Need interactive merge gutter actions / arrows to cherry-pick individual hunks, and verify full-file disk writing for modified files.
    - _Markdown File Ingestion:_ Files targeting `.md` or `.mdx` require specialized fence escaping so their contents are not swallowed by outer markdown fences.
    - _Modal Header Dragging:_ `DevStudioModal` header needs `WebkitAppRegion: 'drag'` with `'no-drag'` leaf controls to restore native window movement.
- **Core Files Modified:**
  - `src/features/session/types/session.ts`, `src/features/session/engine/sessionParser.ts`
  - `src/features/session/engine/diffHunkEngine.ts`, `src/features/session/engine/checkpointEngine.ts`
  - `src/features/session/store/sessionStore.ts`, `src/features/session/components/diff/*`
  - `src/features/session/components/drawer/*`, `src/features/session/components/DevStudioModal.tsx`
  - `src/components/layout/TitleBar.tsx`, `src/App.tsx`, `main.cjs`, `preload.cjs`, `package.json`
  - `scripts/test-session-parser.mjs`

---

## Archived Epochs

- **Epoch 00 (Template Setup):** Initialized the Agent Forge workflow.
- **Epoch 01 (Foundation & Architecture):** Established the core Vite + React + Electron + Zustand stack with Tailwind CSS v4. Enforced the "Stable Relative Path" architectural rule, binding all React keys and Zustand state maps strictly to file paths to permanently resolve UI selection drift. Bootstrapped the initial recursive file scanner and unified frameless Tree UI.
- **Epoch 02 (Context Compression & Export Staging):** Integrated `@monaco-editor/react` for context compression with a read-only, auto-healing skip-block system bound to stable relative paths. Built a high-performance Export Engine leveraging Node.js recursive scanning (using directory-first `dirent` checks to bypass `try/catch` I/O spikes), a single mutable `Context` object for memory safety, and flattened chunk exports via native OS drag-and-drop. Transitioned the architecture to a Multi-Workspace IDE utilizing a Dual-Store setup (`AppStore` for global IDE state, single re-hydrating `WorkspaceStore` for the active project) with implicit auto-saving, responsive container queries, and a full-screen Workspace Browser overlay.
- **Epoch 03 (Advanced Workflows & Customization):** Decoupled the background chunking engine from explicitly invoked, process-bound "Ephemeral Quick Exports". Migrated workspace logic to a Preset-based architecture allowing users to swap visual exclusions and compression profiles instantly. Overhauled the UI with a fixed-position flyout sidebar, eliminated vertical layout shifting (CLS) in the File Tree, and integrated dynamic, CSS-variable-based theming. Introduced a global File Spoofing engine (Extension Overrides) to seamlessly bypass strict LLM upload filters while explicitly logging the physical renaming inside the prompt. Fixed critical Node.js CPU/Event Loop starvation by migrating export I/O to synchronous blocking calls and utilizing native regex evaluations to shield Chokidar watcher events.
- **Epoch 04 (Rendering Optimization & Curation Architecture - v1.6.0 & v1.6.1):** Overhauled outbound curation to a zero-hitch virtual payload graph in RAM, eradicating background disk thrashing and operating system file locks via guarded read-only descriptors. Enforced scoped composite path keys (`${rootId}::${relativePath}`) and bottom-up directory lookups (`lastIndexOf`), resolving cross-root rule pollution and inclusion traps while clocking 10,000 nodes in under 20ms (< 25ms SLA). Eradicated double-slash traversal bugs, standardized canonical manifest naming with embedded code generation protocols, established tree-only 0-byte metrics, and introduced VS Code-style transient/pinned tabs with drag overflow scrolling.
