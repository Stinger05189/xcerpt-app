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

**Epoch 3, Phase 10: Workspace Presets & Sidebar Overhaul**
_Context: The UI and Ephemeral payload engines are stable. We are now migrating the workspace schema to support isolated "Presets" (e.g., "Frontend Bug", "DB Migration"). This allows users to maintain entirely independent visual exclusion rules and compression states within the same codebase._

## Active Queue (Current / Next Session)

- [ ] **Task 1: Schema Migration & Store Refactor**
  - _Details:_ Refactor the `WorkspacePayload` JSON schema and `workspaceStore` to introduce the `presets[]` array. Move `exclusions`, `treeOnly`, `compressions`, and `inclusions` out of the global workspace root and into individual Preset objects.
- [ ] **Task 2: Sidebar UI Restructure**
  - _Details:_ Overhaul the Sidebar flyout to support Preset CRUD operations (Create, Rename, Delete, Switch).
- [ ] **Task 3: Global vs. Preset Compartmentalization**
  - _Details:_ Clearly separate the UI for Workspace Global Rules (Hard Blacklists, Global Stats) from Preset-Specific Rules (Tree-Only lists, Exclusions, History).

## Pending Queue (Upcoming)

- [ ] **Task 4: Global Application Configuration & Theming (Phase 11)**
  - _Details:_ Introduce `AppConfig` persistence. Implement dynamic CSS variable injection at the `:root` level for real-time scale, font, and color updates.
- [ ] **Task 5: Extension Overrides (Phase 12)**
  - _Details:_ Build a UI to define extension mappings (e.g., `.uproject` -> `.json`). Integrate this into the export engine and ensure `ExportedFileTree.md` explicitly annotates the renames.
