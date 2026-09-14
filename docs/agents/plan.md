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

## Active Queue: Version 2.3.0 (Session 030 Focus)

- None Yet

---

## Completed in Version 2.2.0 (Session 029)

- [x] **WP-01: Dual-Width State Architecture & Left Pane Infrastructure**
  - Extended `paneWidths` in `ipc.d.ts` and `workspaceStore.ts` to `{ sidebar: 320, tree: 400, table: 680 }`.
  - Added `leftPaneMode: 'tree' | 'table'` to workspace state and persistence in `Bootstrapper.tsx`.
  - Updated `MainStage.tsx` left pane container and drag-resizer to dynamically adapt between `paneWidths.tree` and `paneWidths.table`.
- [x] **WP-02: Export Settings Modal & Editor Viewport De-clutter**
  - Built `ExportConfigModal.tsx` dialog for low-frequency export configuration (`mergeToSingleFile`, `maxFilesPerChunk`, `respectGitignore`, `embedProtocol`, live manifest viewer, OS cache folder opener).
  - Replaced full-screen `ExportStage` takeover with modal trigger in `MainStage.tsx` header, ensuring `ContextEditor` and file tabs remain permanently visible.
- [x] **WP-03: Ultra-High-Performance Flat File & Folder Table View (`FileTableView.tsx`)**
  - Implemented flat virtualized table supporting Files Mode and Folders Mode with `@tanstack/react-virtual`.
  - Added multi-column sorting for File Size (bytes/KB), Tokens, Skips, Path/Name, Type, and Status.
  - Added filter suite: **Exported (Included)**, **Tree-Only**, **Excluded**, **Has Skips**, and file extension filter.
  - Added 1D mathematical marquee selection brush, range selection, selection stats bar, and ephemeral drag packaging.
  - Added header toggle button to switch between Tree View and Table View.
- [x] **WP-04: Keyboard Focus Management & Context Menu Dismissal Hardening**
  - Implemented explicit input blurring on row pointer-down and container clicks in `FileTree.tsx` and `FileTableView.tsx` so `A`, `S`, `D` hotkeys work immediately.
  - Hoisted context menu state to container level and guaranteed dismissal on pointer down, selection change, or keypress.
- [x] **WP-05: Session Parser Hyphen Regex Fix & Multi-Root Disk Diffing Resolution**
  - Fixed hyphen truncation bug (`scripts/run-diagnostics.mjs` $\to$ `scripts/run`) by removing hyphen negation from `extractActionAndPath`.
  - Hardened multi-root disk querying in `initSessionFromMarkdown` and `sessionParser.ts`, ensuring non-null content takes precedence and root folder prefixes are stripped.
  - Expanded `CODE_GENERATION_PROTOCOL_INSTRUCTION` in `exportEngine.ts` and `Xcerpt_Manifest_xcerpt-app.md` with explicit `[MODIFIED]` vs `[PARTIAL_DIFF]` guidelines.
  - Extended test suites in `run-diagnostics.mjs` and `test-session-parser.mjs` (all 13 suites passing).

---

## Completed in Version 2.1.0 (Session 028)

- [x] **Provider-Agnostic LLM Client Architecture & Secure Key Management**
- [x] **Structured Outputs & Function Calling Tool Engine**
- [x] **Session Creation Copilot (AI Name & Intent Assistant)**
- [x] **Session Completion Commit Synthesizer with Developer Guidance**
- [x] **Diagnostic & Test Suite (`test-llm-provider.mjs`)**
- [x] **Settings Stacking Context Resolution & Master-Detail Redesign**