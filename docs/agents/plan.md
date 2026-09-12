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

## Active Queue: Version 1.6.1 (Export Alignment, Double-Slash Eradication & Curation Finalization)

- [ ] **WP-01: Export Traversal Path Normalization & Double-Slash Eradication**
  - _Details:_ In `exportEngine.ts`, fix `${cleanRelative}/${child.name}` double-slash concatenation in both `buildNode` and `renderMarkdownTree`. Ensure `cleanRelative` (which has a trailing slash) concatenates cleanly via `${cleanRelative}${child.name}`. Verify that `scopedKey` exactly matches `compressions` maps and `treeOnlyExact` sets.
- [ ] **WP-02: Tree-Only & Skip Block Physical Staging Verification**
  - _Details:_ Verify that `status === 'tree-only'` files are strictly omitted from `exportFiles` in `generateVirtualPayloadGraph` and `generateExportPayload`. Verify that `main.cjs` applies all Monaco skip markers synchronously into physical output files and single `context.md` documents.
- [ ] **WP-03: Diagnostic Regression Suite for Path Slashes & Export Integrity**
  - _Details:_ In `scripts/run-diagnostics.mjs`, add tests verifying that `buildNode` emits single-slash POSIX paths at all tree depths, preserves compressions keys, and correctly omits tree-only files from the final export chunk file list.

---

## Completed in Version 1.6.1 (Session 023)

- [x] **WP-01: Legacy Workspace Migration & Exclude/Include Inversion Integrity**
  - Decoupled inclusion punch-throughs from whitelist mode. Implemented `migrateLegacyRules` to promote un-scoped path rules to canonical keys across roots without ghost rules.
- [x] **WP-02: Deterministic Path Key Architecture & Strict Invariant Enforcement**
  - Enforced trailing slash invariant for directories and bottom-up (`lastIndexOf`) ancestor resolution in `ScopedRuleIndex`.
- [x] **WP-03: Export Preview Tree Metric Re-Orientation & Directory Counts**
  - Enriched `VirtualPayloadNode` with recursive `includedFilesCount` and `totalFilesCount`. Added density badges `(4 / 12 files)` in `PayloadPreviewTree.tsx`.
- [x] **WP-04: Throughput SLA Fine-Tuning & Diagnostic Benchmark Suite**
  - Optimized `getStatus` to run 10,000 nodes in under 20ms (< 25ms SLA).
- [x] **WP-05: Preset Generation From Selection Overhaul**
  - Implemented `generateExclusionsForSelection` to compute real, compacted directory exclusions for all unselected files.

---

## Pending Queue: Version 2.0.0 (LLM Dev Session & Diff Merge Studio)

- [ ] **WP-07: Dev Session Domain Architecture & State Machine**
  - _Details:_ Implement `DevSession`, `ParsedFileAction`, and `DiffHunk` domain schemas. Build session switcher and disk persistence in `XcerptSessions/<id>/sessions/`.
- [ ] **WP-08: Fault-Tolerant Protocol-Compliant Response Parser**
  - _Details:_ Off-thread Web Worker parser for Code Generation Protocol. Depth-aware code fence parsing, heuristic recovery, and protocol header stripping.
- [ ] **WP-09: Monaco Side-by-Side Diff Merge Studio & Skip Visibility**
  - _Details:_ Mount Monaco Diff Editor comparing incoming LLM code against local workspace files. Hunk-level merging and transparent skip block indicators.
- [ ] **WP-10: Co-Located Explanation & Reasoning Drawer**
  - _Details:_ Co-locate architectural intent and pre-code explanations in an expandable drawer above the active diff editor.
- [ ] **WP-11: Checkpoint Engine & Non-Invasive Git Safety**
  - _Details:_ Pre-session file snapshot and rollback engine. Working tree probing (`git status`), commit tagging, and per-file commit history diffing.
