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

## Active Queue: Version 2.0.0 (LLM Dev Session & Diff Merge Studio)

- [ ] **WP-01: Dev Session Domain Architecture & Store Foundation**
  - _Details:_ Implement domain schemas in `src/types/session.ts` (`DevSession`, `ParsedFileAction`, `DiffHunk`, `MarkdownExplanationSection`). Implement `sessionStore.ts` and IPC persistence under `XcerptSessions/<workspaceId>/sessions/<sessionId>.json`.
- [ ] **WP-02: Fault-Tolerant Protocol-Compliant Response Parser (Worker Engine)**
  - _Details:_ Build an off-thread Web Worker parsing engine capable of depth-aware code fence matching, nested backtick handling, heuristic fence recovery for unclosed blocks, extension-preserving deduplication, and automated protocol header comment stripping (`stripProtocolScaffolding`).
- [ ] **WP-03: Monaco Side-by-Side Diff Merge Studio & Hunk Engine**
  - _Details:_ Implement the Dev Session Main Stage with Monaco side-by-side diffing comparing incoming LLM code against live disk files. Wire hunk-level merge actions, full file accept/reject workflows, and dedicated modes for `[NEW]` files and `[DELETED]` tombstones.
- [ ] **WP-04: Co-Located Explanation & Reasoning Drawer**
  - _Details:_ Build a collapsible, split-pane Architectural Intent & Reasoning Drawer above the diff editor that renders parsed markdown rationale and links sections dynamically to affected file actions.
- [ ] **WP-05: Ephemeral Pre-Session Checkpoints & Non-Invasive Git Safety**
  - _Details:_ Implement in-memory and disk-backed pre-merge file snapshots (`snapshotFiles`), non-destructive `[Revert Session]` rollback, Git status probing (`git status --porcelain`), and optional commit generator pre-populated with architectural intent.

---

## Completed in Version 1.6.1 (Session 023 & Session 024)

- [x] **WP-01: Export Traversal Path Normalization & Double-Slash Eradication**
  - Replaced `${cleanRelative}/${child.name}` with `${cleanRelative}${child.name}` and added redundant slash collapsing (`/\/+/g, '/'`) across `normalizePath` and `canonicalizePath`.
- [x] **WP-02: Tree-Only & Skip Block Physical Staging Verification**
  - Verified omission of tree-only files from chunk file lists and normalized CRLF line endings to `\n` in `main.cjs` to eliminate Windows line drift.
- [x] **WP-03: Diagnostic Regression Suite for Path Slashes & Export Integrity**
  - Added Suite 8 to `scripts/run-diagnostics.mjs`, verifying zero double slashes, exact compressions key matching, and strict exclusion of tree-only/excluded files from export files.
- [x] **WP-04: Workspace Persistence for `embedProtocol` Setting**
  - Added `embedProtocol` to `getWorkspacePayload` and `generateFreshWorkspace` in `Bootstrapper.tsx` to ensure preferences persist to disk.
- [x] **WP-05: Tree-Only Metric Zeroing & Preview Tree Polish**
  - Zeroed out `trueSize`, `tokens`, and `size` on tree-only/excluded nodes in `exportEngine.ts` and rendered em-dashes (`—`) in `PayloadPreviewTree.tsx`.
- [x] **WP-06: Bottom-Up Hierarchical Specificity & Compaction**
  - Optimized rule resolution order (`lastIndexOf`) and implemented `generateExclusionsForSelection` for automated preset curation.
