<!-- docs/agents/plan.md -->

# plan.md

# Short-Term Implementation Plan

> **[IMMUTABLE AI DIRECTIVE]**
> **DO NOT MODIFY THIS INSTRUCTION BLOCK.**
> This file represents the immediate, actionable queue. It does not track long-term project phases (those belong in the User's primary project docs).
>
> **Your Responsibilities:**
>
> 1. **Update on Teardown:** During the `[END SESSION]` protocol, you must update this file. Check off completed tasks (`[x]`), remove stale tasks, and populate the active queue based on the User's instructions.
> 2. **Work Packet Alignment:** The tasks listed here must directly map to the "Work Packets" you propose during the Phase 1 Triangulation of the next session.
> 3. **Identify Blockers:** Explicitly list any missing assets, pending User decisions, or dependencies required before a task can begin.

---

## Active Queue: Version 2.3.0 (Session 031 Focus)

- [x] **WP-01: Universal Binary & Tree-Only Extension Matrix (`filterEngine.ts` & `main.cjs`)**
  - Defined `BINARY_OR_TREE_ONLY_REGEX` and `isBinaryPath` covering Unreal Engine (`.uasset`, `.umap`, `.ubulk`, `.uexp`, `.uptnl`, `.pak`), Unity, 3D models (`.fbx`, `.blend`), documents (`.pdf`), audio/video, archives, executables, and databases.
  - Automatically classified binary assets into `treeOnlyRules` upon folder scanning in `main.cjs`.
- [x] **WP-02: Main Process Token Calculation & IPC Read Shielding (`main.cjs`)**
  - Guarded `fs:calculateTokens` to skip binary files instantly, cap exact BPE tokenization at 2MB with fast proportional approximation, and perform non-blocking 4KB null-byte sniffing.
  - Guarded `fs:readFile` to immediately reject known binary files with `"Binary file detected. Preview disabled."` before any disk I/O.
- [x] **WP-03: Frontend Token & Stats Guarding (`FileTree.tsx` & `FileTableView.tsx`)**
  - Filtered out `isBinaryPath` in `calculateExactTokens` in both tree and table views, avoiding unnecessary IPC roundtrips.
  - Updated selection statistics to treat binary files as 0 context tokens.
- [x] **WP-04: High-Performance Binary File Viewer (`BinaryFileViewer.tsx` & `ContextEditor.tsx`)**
  - Created `BinaryFileViewer.tsx` with asset category icon badges and native OS actions (`Open with Default App`, `Reveal in OS`).
  - Decoupled `ContextEditor` from calling `readFile` or mounting Monaco on binary assets, loading previews in 0ms.
- [x] **WP-05: Diagnostic Test Suite Expansion & Validation (`run-diagnostics.mjs`)**
  - Added Suite 10 covering binary classification across Unreal Engine assets, PDFs, 3D models, archives, and executables, verifying zero false positives on source code files.

---

## Completed in Version 2.2.0 (Session 030)

- [x] **WP-01: Explicit File Boundary Token Specification & Manifest Prompt Overhaul**
- [x] **WP-02: Deterministic Boundary Token Parser & Outer Fence Stripping**
- [x] **WP-03: Legacy 3-Backtick Markdown Parsing Forward Lookahead**
- [x] **WP-04: Full Plan Viewer & Ingestion Studio Alignment**
- [x] **WP-05: Comprehensive Parser Diagnostic Test Suite Expansion**