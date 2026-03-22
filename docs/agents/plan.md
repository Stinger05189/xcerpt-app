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

**Workspace Persistence & Onboarding UI**
_Context: The core extraction, filtering, and export engine is fully optimized. The application now needs the ability to save the Zustand state to a `.xcerpt` file, load previous workspaces, and provide a welcoming start screen when no workspace is active._

## Active Queue (Current / Next Session)

- [ ] **Task 1: Define `.xcerpt` Serialization Schema**
  - _Details:_ Write the utility functions to serialize the essential Zustand state (`rootPaths`, `includes`, `excludes`, `treeOnly`, `hardBlacklist`, `compressions`) while discarding transient state (`isPainting`, `isBuilding`, `rawTrees`).
- [ ] **Task 2: IPC Disk Persistence Bridge**
  - _Details:_ Implement the Main process `dialog.showSaveDialog` and `dialog.showOpenDialog` handlers. Write the serialization to disk and handle reading/parsing back to the UI.
- [ ] **Task 3: Workspace Header Actions**
  - _Details:_ Add "Save", "Save As...", and "Close Workspace" functionality to the Main Stage or Title Bar UI. Update the window title to reflect `WorkspaceName - Xcerpt` or `Untitled Workspace`.
- [ ] **Task 4: The Welcome/Onboarding Screen**
  - _Details:_ Build a modern onboarding landing page that displays when no workspace is active. Include "New Workspace", "Open Workspace", and a "Recent Workspaces" list stored in `localStorage` or Electron `store`.

## Pending Queue (Upcoming)

- [ ] **Task 5: Stats & History Data Wiring**
  - _Details:_ Replace the mockup UI in the Sidebar Stats & History tabs with real token calculations using a lightweight token estimator (e.g., `js-tiktoken`).

## Blockers / Unresolved Constraints

- None at this time.
