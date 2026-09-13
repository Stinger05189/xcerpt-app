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

## Active Queue: Version 2.0.0 (Session 027 Focus)

- [ ] **WP-01: Workspace-Scoped Dev Studio & TitleBar Preservation Architecture**
  - _Details:_ Remove the Dev Studio icon from the top-left TitleBar (`TitleBar.tsx`), making the MainStage header button (`Stage Context -> Dev Studio -> Configure`) the sole workspace-scoped entry point. Refactor `DevStudioModal.tsx` from a full-screen window overlay (`fixed inset-0`) to mount below the TitleBar (`top-10 inset-x-0 bottom-0` or embedded stage view) so the TitleBar workspace tabs remain visible, draggable, and clickable. Bind dev session store state strictly to the active `workspaceId`, allowing users to switch workspace tabs seamlessly without losing studio review state.
- [ ] **WP-02: Fix Ingestion Focus Trap & Build Interactive Ingestion Triage Studio**
  - _Details:_ Fix the focus/click bug in the ingestion modal that prevented pasting into the raw markdown textarea on fresh sessions. Overhaul the ingestion modal into a two-pane Interactive Triage Studio: provide a primary `[Paste from Clipboard]` action, a left pane showing live extracted actions/warnings, and a right pane with a searchable raw markdown editor with visual file boundary markers and a `[Re-Parse Response]` live recalculation button.
- [ ] **WP-03: Multi-Location Reasoning Association & Markdown Action Resilience**
  - _Details:_ Enhance `sessionParser.ts` to capture and correlate reasoning commentary located at the start of a packet, between files, and at the end of files. Ensure that target Markdown files (`.md`, `.mdx`) wrapped inside outer code fences are properly isolated and do not break parser fence boundaries.
- [ ] **WP-04: Non-Invasive Git Integration & Post-Session Commit Generator**
  - _Details:_ Implement pre-session git status inspection (`git status --porcelain`) and post-session commit creation offering a commit message pre-populated with the parsed architectural intent summary.

---

## Completed in Version 2.0.0 (Session 026)

- [x] **WP-01: Line 1 Protocol Stripping Refinement & Parser Diagnostic Suite**
  - Updated `stripProtocolScaffolding` to strip strictly the action tag prefix while preserving commented file paths on line 1. Diagnostic test suite expanded to 26/26 passing assertions.
- [x] **WP-02: Monaco Model Isolation & Syntax Highlighting Engine**
  - Mounted editors with `key={activeAction.id}` to eliminate model reuse and cross-action content bleed. Expanded `languageHelper.ts` with Lua, shaders (HLSL, GLSL), C#, C++, GDScript, JSON, and dotfiles, calling `monaco.editor.setModelLanguage` on mount.
- [x] **WP-03: Unified Single Action Toolbar & Single-Accept Workflow**
  - Merged dual headers into a single cohesive action toolbar in `DevStudioModal.tsx`. Moved the inline diff toggle into the file toolbar and implemented `revertAction` for disk restoration.
- [x] **WP-04: Full Plan View Artifact Overhaul & Syntactic Reasoning**
  - Built categorized sidebar navigation in `FullPlanViewer.tsx` (Intent, Work Packets, Code Artifacts), collapsible artifact cards with popout Monaco inspectors, persistent scroll offsets, and styled inline code pills.

---

## Completed in Version 2.0.0 (Session 025)

- [x] **Dev Session Domain Architecture & Store Foundation** (`sessionStore.ts`, `session.ts`)
- [x] **Protocol Parser Engine** (`sessionParser.ts`, depth invariant, deduplication)
- [x] **Monaco Diff Merge Engine** (`SessionDiffEditor.tsx`, `NewFilePreview.tsx`, `DeletedFileBanner.tsx`)
- [x] **Reasoning Drawer & Checkpoint Persistence** (`ReasoningDrawer.tsx`, `checkpointEngine.ts`)
