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

## Active Queue: Version 2.4.0 (Session 033 Focus)

- [ ] **WP-01: Git Branch Switcher & Multi-Branch Session Isolation (`DevStudioModal.tsx` & `main.cjs`)**
  - Expose Git branch list and branch checkout/switch capabilities via IPC (`git:listBranches`, `git:checkoutBranch`).
  - Render an interactive branch switcher in the Dev Studio and Session Browser subheaders, showing branch indicators on sessions and filtering sessions by target branch.
- [ ] **WP-02: Multi-File Stash Rollback & Ephemeral Checkpoint Browser (`checkpointEngine.ts`)**
  - Allow developers to view pre-session snapshot files as independent browseable trees.
  - Implement selective file checkpoint rollback without rolling back the entire session.
- [ ] **WP-03: Visual File Ledger Graph & Revision Heatmap (`SessionBrowserModal.tsx`)**
  - Add visual frequency indicators and mini revision heatmaps in the File Ledger view to highlight files undergoing the most churn across sessions.
- [ ] **WP-04: Monaco Minimap Diff Markers & Skip Block Decorators (`SessionDiffEditor.tsx`)**
  - Render custom color-coded diff hunk markers and skip block indicators on Monaco's overview ruler and minimap tracks during session review.
- [ ] **WP-05: Comprehensive Diagnostic Suite Expansion (`scripts/test-session-browser.mjs`)**
  - Expand test suites covering multi-branch session isolation, branch checkout rollbacks, and selective checkpoint file restorations.

---

## Completed in Version 2.3.0 (Sessions 031 & 032)

- [x] **WP-01: Multi-Session File Indexing, Content Search Engine & IPC Bridge (`main.cjs`, `preload.cjs`, `types/ipc.d.ts`, `sessionStore.ts`)**
- [x] **WP-02: Enhanced Session Inspector with Resizable Width, File Search, and Action Badges (`SessionBrowserModal.tsx`)**
- [x] **WP-03: Dual-Mode Session Browser: Sessions View vs. File Timeline Mode (`SessionBrowserModal.tsx`)**
- [x] **WP-04: Interactive Multi-Session File Diff Viewer & Revision Time-Machine (`FileHistoryDiffStage.tsx`)**
- [x] **WP-05: Diagnostic Test Suite & Verification (`scripts/test-session-browser.mjs`)**
- [x] **WP-06: Universal Binary & Tree-Only Extension Matrix (`filterEngine.ts` & `main.cjs`)**
- [x] **WP-07: Main Process Token Calculation & IPC Read Shielding (`main.cjs`)**
- [x] **WP-08: High-Performance Binary File Viewer (`BinaryFileViewer.tsx` & `ContextEditor.tsx`)**