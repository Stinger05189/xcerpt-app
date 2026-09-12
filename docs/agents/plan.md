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

## Active Queue: Version 1.6.1 (Curation Integrity, Path Hashing & Metric Re-Orientation)

- [ ] **WP-01: Legacy Workspace Migration & Exclude/Include Inversion Integrity**
  - _Details:_ Audit legacy workspace schema conversions. Fix edge cases where older paths appear locked in an excluded state and cannot be re-included. Ensure un-scoped legacy paths are properly promoted to canonical scoped keys (`${rootId}::${relativePath}`) during hydration without stale ghost rules surviving.
- [ ] **WP-02: Path Referencing & Hashing Architecture Investigation**
  - _Details:_ Investigate migrating from raw string path rules to deterministic path identifiers or path hashes (e.g., Murmur3/FNV-1a or hierarchical Trie node IDs). Eliminate cross-directory filter bleeding where modifying rules in one subfolder inadvertently influences identically named paths elsewhere.
- [ ] **WP-03: Export Preview Tree Metric Re-Orientation & Directory Counts**
  - _Details:_ Refactor `PayloadPreviewTree.tsx` and `ExportStage.tsx` metric cards to strictly display exported totals (true exported size, exported token counts, files included in export payload) rather than whole-workspace numbers. Add per-directory included file counts on folder rows (e.g., `src/components (4 / 12 files)`).
- [ ] **WP-04: Throughput SLA Fine-Tuning**
  - _Details:_ Shave the remaining 3.9ms off the 10,000-node benchmark in `run-diagnostics.mjs` (currently 28.91ms vs 25ms SLA) by streamlining path tokenization and early returning on empty exclude prefix sets.

---

## Completed in Version 1.6.0 (Zero-Hitch Foundation & Curation Architecture)

- [x] **WP-01: Performance & Virtual In-Memory Export Engine**
  - Eliminated eager 1500ms disk writes; implemented pure RAM Virtual Payload Graph and JIT physical staging (`VIRTUAL_READY` $\to$ `STAGING_LOCK` $\to$ `DISK_READY`).
- [x] **WP-02: Scoped Rule Architecture & Read-Only File Locking Eradication**
  - Root-qualified rule keys (`${rootId}::${relativePath}`); hardened `fs:readFile` with guaranteed `try/finally` closes and non-locking Chokidar options.
- [x] **WP-03: Hierarchical Payload Preview Tree & True Size Metrics**
  - Binary export toggle (`All Files` vs `Single Unified context.md`); virtualized preview tree with True-Size skip math and live tokens.
- [x] **WP-04: Tab Lifecycle, Multi-Root Ephemeral Packaging & Ergonomics**
  - Transient vs pinned editor tabs, horizontal wheel/drag overflow scrolling, context menu focus guards, skip indicator pencil badges (`✏️`).
- [x] **WP-05: Descriptive Manifest Naming & In-Line Protocol Option**
  - Canonical manifest naming (`Xcerpt_Manifest_<Roots>.md`) and prompt manifest protocol injection toggle.
- [x] **WP-06: $O(\text{depth})$ Rule Indexing & Compaction**
  - Resolved 285ms flame-chart bottleneck by hoisting status to `FlatNode`, using $O(\text{depth})$ ancestor Set checks, and compacting redundant child file rules.

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
