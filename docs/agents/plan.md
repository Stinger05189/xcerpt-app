# plan.md

# Short-Term Implementation Plan

> **[IMMUTABLE AI DIRECTIVE]**
> **DO NOT MODIFY THIS INSTRUCTION BLOCK.**
> This file represents the immediate, actionable queue. It does not track long-term project phases (those belong in the User's primary project docs).
>
> **Your Responsibilities:**
>
> 1. **Update on Teardown:** During the `[END SESSION]` protocol, you must update this file. Check off completed tasks (`[x]`), remove stale tasks, and promote pending tasks to the Active Queue based on the User's instructions.
> 2. **Work Packet Alignment:** The tasks listed here must directly map to the "Work Packets" you propose during the Phase 1 Triangulation of the next session.
> 3. **Identify Blockers:** Explicitly list any missing assets, pending User decisions, or dependencies required before a task can begin.

---

## Active Queue: Version 1.6.0 (Zero-Hitch Foundation & Curation Polish)

- [ ] **WP-01: Performance & Virtual In-Memory Export Engine**
  - _Details:_ Rip out eager disk-staging debounces in `MainStage.tsx` and synchronous writes in `main.cjs`. Build the in-memory Virtual Payload Graph in `exportEngine.ts`. Implement the JIT physical staging pipeline with dual-state readiness feedback.
- [ ] **WP-02: Scoped Rule Architecture & Read-Only File Locking Eradication**
  - _Details:_ Refactor `WorkspaceStore` and `filterEngine` to scope curation rules using `${rootId}::${relativePath}` composite keys. Audit `main.cjs` file handle operations, adding `try/finally` blocks to guarantee handle release and eliminate OS file locks.
- [ ] **WP-03: Hierarchical Payload Preview Tree & True Size Metrics**
  - _Details:_ Replace the batch size chunk slider with a binary toggle (`All Files` vs `Single Unified context.md`). Replace the flat chunk table in `ExportStage.tsx` with a virtualized hierarchical tree showing true skip-deducted sizes, live BPE tokens, and inline exclude/tree-only action buttons.
- [ ] **WP-04: Tab Lifecycle, Multi-Root Ephemeral Packaging & Ergonomics**
  - _Details:_ Implement VS Code-style transient vs. pinned tab lifecycle with context menu actions. Add tab bar overflow horizontal mouse-wheel and right-click drag scrolling. Implement unified multi-root ephemeral selections with JIT preview overlay. Add pencil skip badges to `TreeNode.tsx` and wire up live sidebar statistics.
- [ ] **WP-05: Descriptive Manifest Naming & In-Line Protocol Option**
  - _Details:_ Upgrade manifest naming to `Xcerpt_Manifest_<Roots>.md`. Add export toggle to embed `Skill_code_generation_protocol.md` directly into the generated manifest prompt.

## Pending Queue: Version 2.0.0 (LLM Dev Session & Diff Merge Studio)

- [ ] **WP-06: Dev Session Domain Architecture & State Machine**
  - _Details:_ Implement `DevSession`, `ParsedFileAction`, and `DiffHunk` domain schemas. Build session switcher, disk persistence in `XcerptSessions/<id>/sessions/`, and session navigation lifecycles.
- [ ] **WP-07: Fault-Tolerant Protocol-Compliant Response Parser**
  - _Details:_ Build off-thread Web Worker parser supporting the Code Generation Protocol. Implement depth-aware backtick counting, heuristic recovery for missing code fences, extension-preserving deduplication, multi-file section association, and action extraction fallbacks.
- [ ] **WP-08: Monaco Side-by-Side Diff Merge Studio & Skip Visibility**
  - _Details:_ Mount Monaco Diff Editor comparing incoming LLM code against local workspace files. Build hunk-level merging, dedicated `[NEW]` and `[DELETED]` review modes, auto-advance on action completion, and transparent skip block visualizations.
- [ ] **WP-09: Co-Located Explanation & Reasoning Drawer**
  - _Details:_ Extract and co-locate architectural intent and pre-code explanations in an expandable drawer directly above the active diff editor.
- [ ] **WP-10: Checkpoint Engine & Non-Invasive Git Safety**
  - _Details:_ Build pre-session file snapshot and rollback engine. Integrate Git working tree probing (`git status`), optional checkpoint commit tagging, and per-file commit history diffing.

---

**Completed in Architecture & Planning Session:**

- [x] Triangulated root causes of v1.5.0 hitches, file locks, and cross-root rule pollution.
- [x] Defined the finish line vision: Xcerpt as a bidirectional Context Staging & LLM Dev Studio.
- [x] Authored comprehensive technical specification for v1.6.0 (`docs/4_v1.6_Zero_Hitch_Optimization_Spec.md`).
- [x] Authored comprehensive technical specification for v2.0.0 (`docs/5_v2.0_LLM_Dev_Studio_Spec.md`).
- [x] Updated `conventions.md` and `plan.md` with new architectural standards and roadmap queues.
