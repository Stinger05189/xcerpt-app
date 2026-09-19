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

- None Yet

---

## Completed in Version 2.2.0 (Session 030)

- [x] **WP-01: Explicit File Boundary Token Specification & Manifest Prompt Overhaul**
  - Updated `CODE_GENERATION_PROTOCOL_INSTRUCTION` in `src/utils/exportEngine.ts` and `Xcerpt_Manifest_xcerpt-app.md`.
  - Mandated `<<<FILE_START: [ACTION] path/to/file.ext>>>` and `<<<FILE_END>>>` boundary tokens.
  - Specified 4-backtick wrapping rule for complex markdown documentation containing internal code blocks.
- [x] **WP-02: Deterministic Boundary Token Parser & Outer Fence Stripping**
  - Implemented `FILE_START_TOKEN_REGEX` and `FILE_END_TOKEN_REGEX` in `src/features/session/engine/sessionParser.ts`.
  - Created `stripOuterCodeFence` to strip matching wrapper code fences while preserving internal code blocks and unadorned code snippets.
  - Updated `stripProtocolScaffolding` and `extractActionAndPath` to support boundary tokens.
  - Upgraded `parseSessionMarkdown` to a dual-mode token/fence state machine with auto-recovery.
- [x] **WP-03: Legacy 3-Backtick Markdown Parsing Forward Lookahead**
  - Added `isInnerUnadornedFence` lookahead helper to resolve unadorned ` ``` ` code blocks inside 3-backtick markdown files.
- [x] **WP-04: Full Plan Viewer & Ingestion Studio Alignment**
  - Updated `FullPlanViewer.tsx` to detect boundary tokens and extract code artifacts 1:1 with session actions.
  - Added a visual verification badge in `IngestionTriageStudio.tsx` when boundary tokens are verified.
- [x] **WP-05: Comprehensive Parser Diagnostic Test Suite Expansion**
  - Added Suites 14 through 19 in `scripts/test-session-parser.mjs` verifying boundary tokens, nested code blocks with/without languages, multi-file sequential documentation, raw un-fenced files, and auto-recovery.

---

## Completed in Version 2.2.0 (Session 029)

- [x] **Dual-Width State Architecture & Left Pane Infrastructure**
- [x] **Export Settings Modal & Editor Viewport De-clutter**
- [x] **Ultra-High-Performance Flat File & Folder Table View**
- [x] **Keyboard Focus Management & Context Menu Dismissal Hardening**
- [x] **Session Parser Hyphen Regex Fix & Multi-Root Disk Diffing Resolution**
