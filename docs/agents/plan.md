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

## Active Queue: Version 2.0.0 (Session 026 Focus)

- [ ] **WP-01: Nested Code Fence & Markdown File Ingestion Hardening**
  - _Details:_ In `sessionParser.ts` and `test-session-parser.mjs`, enforce strict depth checking: when inside an outer block of length $N$ (e.g. 4 backticks), any candidate fence with length $< N$ must be treated strictly as content lines. Add robust handling for Markdown (`.md`, `.mdx`) target files containing nested code blocks to ensure they parse into actions cleanly. Bring `npm run test:session` to 24/24 PASS.
- [ ] **WP-02: Monaco Diff Merge Actions & Physical Disk Modification Pipeline**
  - _Details:_ Upgrade `SessionDiffEditor.tsx` to allow full file merges and hunk cherry-picking. Verify that clicking "Accept & Next" or "Merge Full File" accurately writes the proposed file to disk, updates the active file buffer, and triggers the active review queue auto-advance.
- [ ] **WP-03: Frameless Window Dragging & Dev Studio Header Polish**
  - _Details:_ Apply `WebkitAppRegion: 'drag'` to the header of `DevStudioModal.tsx`, and add `'no-drag'` to interactive buttons (action toggles, merge buttons, tabs, close icon) so the window can be moved freely while in session review.
- [ ] **WP-04: Non-Invasive Git Integration & Post-Session Commit Generator**
  - _Details:_ Implement pre-session git status inspection (`git status --porcelain`) and post-session commit creation offering a commit message pre-populated with the parsed architectural intent.

---

## Completed in Version 2.0.0 (Session 025)

- [x] **WP-01: Dev Session Domain Architecture & Store Foundation**
  - Implemented domain schemas in `src/features/session/types/session.ts` and standalone `sessionStore.ts` with pre-session checkpoint rollback.
- [x] **WP-02: Fault-Tolerant Protocol Parser & Header Stripping Engine**
  - Implemented `sessionParser.ts` with `stripProtocolScaffolding`, extension-preserving deduplication, unclosed fence auto-recovery, and intent extraction.
- [x] **WP-03: IPC Persistence Layer for Dev Sessions**
  - Registered `session:save`, `session:load`, `session:list`, `session:delete`, `session:applyAction`, and `session:revertCheckpoint` in `main.cjs` and `preload.cjs`.
- [x] **WP-04: Monaco Side-by-Side Diff Editor & Specialized Action Viewers**
  - Built `SessionDiffEditor.tsx`, `NewFilePreview.tsx` (for `[NEW]`), and `DeletedFileBanner.tsx` (for `[DELETED]`).
- [x] **WP-05: Co-Located Reasoning Drawer & Full Plan Viewer**
  - Built `ReasoningDrawer.tsx` linked to active action IDs and `FullPlanViewer.tsx` for rendered and raw markdown views.
- [x] **WP-06: Standalone Diagnostic Test Suite**
  - Created `scripts/test-session-parser.mjs` and wired `npm run test:session`.
