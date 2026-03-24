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

**Epoch 3, Phase 11: Global Application Configuration & Theming**
_Context: Phase 10 (Presets & History) is complete. We are now shifting to application-wide configuration. We need to introduce a workspace-agnostic `config.json` schema to manage dynamic CSS variable injection for real-time scale, font, and color updates._

## Active Queue (Current / Next Session)

- [ ] **Task 1: AppConfig Schema & Persistence**
  - _Details:_ Create a new `config.json` schema managed by the Node.js main process. Wire this into the `AppStore` alongside the `AppState` so global settings persist entirely independent of individual workspaces.
- [ ] **Task 2: Global Settings UI Modal**
  - _Details:_ Build a centralized Settings modal accessible from the TitleBar or Sidebar. Include controls for Background colors, Foreground/Text colors, Accent colors, Selection states, and global keyboard shortcuts.
- [ ] **Task 3: Dynamic CSS Variable Injection**
  - _Details:_ Implement a Theme Engine (likely a `useEffect` hook near the root) that reacts to `AppStore` config changes and maps the settings to `--color-*` CSS variables at the `:root` level for instant, reload-free theming.

## Pending Queue (Upcoming)

- [ ] **Task 4: Extension Overrides (Phase 12)**
  - _Details:_ Build a UI to define extension mappings (e.g., `.uproject` -> `.json`). Integrate this into the export engine and ensure `ExportedFileTree.md` explicitly annotates the renames.
