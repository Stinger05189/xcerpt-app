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

## Active Epoch: 06 - Native LLM Integrations & Copilot Automation (v2.3.0)

### Session 032

- **Focus Area:** Dev Session Browser Overhaul, File Ledger Revision Time-Machine, Multi-Session Comparison Triangulation, Deep Code Content Search, and Persistent Resizable Inspector.
- **Key Decisions:**
  - **Dual-Mode Session Navigation Architecture (`SessionBrowserModal.tsx`):**
    - Diagnosed the core workflow friction in session review: searching through dozens of historic sessions to locate when a specific file was introduced, altered, or deleted was slow and un-indexed, with file pill names clipped on the right.
    - Split the Session Browser into two top-level operational modes: **Sessions View** (session-centric review) and **File Ledger View** (file-centric revision tracking).
  - **Cross-Session File Ledger & Node.js Aggregation (`main.cjs` / `sessionStore.ts`):**
    - Implemented `session:getFileLedger` in `main.cjs` to scan and aggregate all session files in `<userData>/XcerptSessions/dev_sessions/<workspaceId>` in sub-10ms.
    - Computes an inverted file-to-session index returning unique relative paths, total revision counts, latest action types, and chronological occurrence histories (`FileSessionOccurrence[]`).
  - **Interactive Revision Time-Machine (`FileHistoryDiffStage.tsx`):**
    - Built a dedicated multi-session comparison stage featuring an interactive horizontal revision timeline track (`Disk [Current]` ⇄ `Session N` ⇄ `Session N-1` ⇄ `Checkpoint Original`).
    - Implemented Comparison Triangulation: allows developers to toggle between:
      1. `Session vs. Current Disk` (identifies whether working tree diverges from proposed state).
      2. `Session vs. Previous Session Revision` (isolates the incremental diff introduced in that specific session).
      3. `Session vs. Pre-Session Checkpoint` (shows total changes from pre-session base).
    - If the compared states are identical, Monaco Diff is automatically bypassed in favor of a clean unified editor badged with `Identical (No Differences)`.
    - Added one-click "Apply Revision to Disk" action with confirmation, enabling instantaneous rollbacks or cherry-picks to physical disk directly from the session ledger.
  - **Deep File Code Content Search:**
    - Augmented the Sessions table search bar with a toggleable `Search Code` mode (`searchInCodeContent`), querying inside `workingContent`, `proposedContent`, and `rawPayloadContent` across all historic sessions.
  - **Resizable & Persistent Inspector:**
    - Upgraded the right-hand inspector pane with pointer drag resizing, boundary clamping (280px–800px), and persistent storage in `localStorage` (`xcerpt_session_inspector_width`).
    - Overhauled file cards with full-width wrapping, unclipped paths, action badges with iconography (`[NEW]`, `[MOD]`, `[DIFF]`, `[DEL]`), and quick-view code preview dialogs.
  - **Automated Diagnostic Suite (`scripts/test-session-browser.mjs`):**
    - Created a 6-suite test script verifying multi-session file aggregation, chronological ordering, deep content search, diff comparisons, action badge classification, and width clamping. All 6 suites pass.
- **Core Files Modified/Created:**
  - `src/features/session/types/session.ts`, `src/features/session/store/sessionStore.ts`
  - `main.cjs`, `preload.cjs`, `src/types/ipc.d.ts`
  - `src/features/session/components/diff/FileHistoryDiffStage.tsx`
  - `src/features/session/components/SessionBrowserModal.tsx`
  - `scripts/test-session-browser.mjs`, `package.json`

---

### Session 031

- **Focus Area:** Universal Binary & Tree-Only Extension Matrix, Main Process Token Shielding, 0ms Binary Viewer, and Diagnostic Expansion.
- **Key Decisions:**
  - **Universal Binary & Tree-Only Matrix (`filterEngine.ts` / `main.cjs`):**
    - Established `BINARY_OR_TREE_ONLY_REGEX` and `isBinaryPath` covering Unreal Engine assets (`.uasset`, `.umap`, `.ubulk`, `.uexp`, `.uptnl`, `.pak`), Unity assets, 3D models (`.fbx`, `.blend`), documents (`.pdf`, `.docx`), audio/video, compressed archives, databases, and compiled binaries.
    - Updated `scanDirectory` in `main.cjs` to automatically classify discovered binary files into `treeOnlyRules` upon root ingestion, preserving spatial awareness while strictly omitting content from context payloads.
  - **Token Calculation & Read Shielding (`main.cjs`):**
    - Hardened `fs:calculateTokens` to skip binary paths immediately, capped exact BPE tokenization at 2MB with proportional estimation for larger files, and introduced non-blocking 4KB null-byte sniffing.
    - Guarded `fs:readFile` to reject binary files instantly before disk reads.
  - **Zero-Token Virtual Graph Accounting & High-Performance Viewer (`BinaryFileViewer.tsx`):**
    - Filtered out binary files from exact token IPC invocations in `FileTree.tsx` and `FileTableView.tsx`, treating binary context tokens as 0.
    - Created `BinaryFileViewer.tsx` with category badges and native OS controls (`Open with Default App`, `Reveal in OS`), loading previews in 0ms without mounting Monaco.
  - **Diagnostic Test Suite Expansion (`scripts/run-diagnostics.mjs`):**
    - Added Suite 10 verifying binary classification across 19 categories with zero false positives on source code files. All 10 suites pass.
- **Core Files Modified:**
  - `src/utils/filterEngine.ts`, `main.cjs`, `src/components/tree/FileTree.tsx`, `src/components/tree/FileTableView.tsx`
  - `src/components/editor/BinaryFileViewer.tsx`, `src/components/editor/ContextEditor.tsx`
  - `scripts/run-diagnostics.mjs`

---

### Session 030

- **Focus Area:** Explicit File Boundary Parsing Architecture (`<<<FILE_START>>>` / `<<<FILE_END>>>`), Complex Nested Markdown Documentation Extraction, Outer Code Fence Stripping, Unadorned Internal Code Block Lookahead, and Full Plan Synchronization.
- **Key Decisions:**
  - **Explicit File Boundary Token Protocol (`src/utils/exportEngine.ts` / `Xcerpt_Manifest_xcerpt-app.md`):**
    - Upgraded `CODE_GENERATION_PROTOCOL_INSTRUCTION` to mandate top-level boundary tokens: `<<<FILE_START: [ACTION] path/to/file.ext>>>` and `<<<FILE_END>>>`.
  - **Deterministic Token Parser & Outer Fence Stripping (`sessionParser.ts`):**
    - Implemented `FILE_START_TOKEN_REGEX` and `FILE_END_TOKEN_REGEX` supporting all action tags, quoted paths, and HTML comment variants.
    - Implemented `stripOuterCodeFence` which inspects lines between boundary tokens to safely remove outer matching markdown wrappers while leaving internal 3-backtick and unadorned code snippets intact.
  - **Legacy Markdown Parsing Forward Lookahead (`isInnerUnadornedFence`):**
    - For legacy responses lacking boundary tokens, augmented 3-backtick markdown tracking with forward lookahead to prevent premature file truncation.
  - **Full Plan Viewer Synchronization (`FullPlanViewer.tsx`):**
    - Updated artifact extraction to detect boundary tokens, synchronizing Full Plan view 1:1 with parsed session actions.
  - **Test Suite Expansion (`scripts/test-session-parser.mjs`):**
    - Added Suites 14 through 19 covering boundary tokens with nested code blocks, raw files without fences, and deletion tombstones. All 19 suites pass.
- **Core Files Modified:**
  - `src/utils/exportEngine.ts`, `Xcerpt_Manifest_xcerpt-app.md`
  - `src/features/session/engine/sessionParser.ts`, `src/features/session/components/drawer/FullPlanViewer.tsx`
  - `src/features/session/components/triage/IngestionTriageStudio.tsx`
  - `scripts/test-session-parser.mjs`

---

## Archived Epochs

- **Epoch 00 (Template Setup):** Initialized the Agent Forge workflow.
- **Epoch 01 (Foundation & Architecture):** Established the core stack with Tailwind CSS v4. Enforced Stable Relative Paths, binding selection maps strictly to file paths.
- **Epoch 02 (Context Compression & Export Staging):** Integrated Monaco Editor for context compression with read-only skip-blocks. Built recursive Export Engine and multi-workspace single re-hydrating store.
- **Epoch 03 (Advanced Workflows & Customization):** Decoupled background chunking from Ephemeral Quick Exports. Migrated to Presets, CSS variable theming, and Extension Overrides.
- **Epoch 04 (Rendering Optimization & Curation Architecture - v1.6.0 & v1.6.1):** Outbound curation via in-memory virtual payload graph. Scoped composite keys (`${rootId}::${relativePath}`) and bottom-up directory resolution (< 25ms SLA for 10k nodes).
- **Epoch 05 (Bidirectional LLM Dev Studio - v2.0.0):** Monaco Diff merge pipeline with language comment headers, Interactive Ingestion Triage Studio with real-time boundary rulers, Git working tree checkpoints, and catalog management.