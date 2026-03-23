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

## Current Macro-Objective

**Epoch 3, Phase 9: Selection Stats & Ephemeral Quick Exports**
_Context: With the multi-workspace architecture stable, we are shifting focus to micro-workflows. Phase 9 introduces the ability to view live token estimates for specific file selections and explicitly generate lightning-fast, process-bound temporary payloads without altering the global workspace export configuration._

## Active Queue (Current / Next Session)

- [ ] **Task 1: Root Path Context Menu**
  - _Details:_ Add a right-click `onContextMenu` handler to the Root Path sub-tabs in `MainStage.tsx` that triggers an IPC call to `window.api.showItemInFolder`.
- [ ] **Task 2: Selection Stats UI & Heuristics**
  - _Details:_ Implement a fixed bottom bar in `FileTree.tsx`. When `selectedFiles.size > 0`, display the selection count, combined disc size, and an estimated token count calculated via a fast byte-to-token heuristic to prevent UI thread blocking.
- [ ] **Task 3: Ephemeral Quick Export Engine**
  - _Details:_ Add an explicit "Stage Selection" button to the new tree bottom bar. Wire this to a new Node.js IPC handler that creates an isolated, temporary directory containing _only_ the selected files and an abbreviated `ExportedFileTree.md`. Once generated, convert the button into a draggable pill.

## Pending Queue (Upcoming)

- [ ] **Task 4: Workspace Presets & Sidebar Overhaul (Phase 10)**
  - _Details:_ Migrate the `WorkspacePayload` JSON schema to support a `presets[]` array. Overhaul the Sidebar to include Preset CRUD operations and separate Global Rules from Preset Rules.
- [ ] **Task 5: Global Application Configuration & Theming (Phase 11)**
  - _Details:_ Introduce `AppConfig` persistence. Implement dynamic CSS variable injection at the `:root` level for real-time scale, font, and color updates.
- [ ] **Task 6: Extension Overrides (Phase 12)**
  - _Details:_ Build a UI to define extension mappings (e.g., `.uproject` -> `.json`). Integrate this into the export engine and ensure `ExportedFileTree.md` explicitly annotates the renames.
