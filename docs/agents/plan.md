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

**Epoch 2, Phase 8: The Workspace Browser & Metadata Querying**
_Context: We have successfully implemented the implicit auto-save persistence engine and the multi-workspace Title Bar. The next critical feature is the "Home" screen—a centralized browser overlay that reads the metadata of all saved sessions in the OS AppData folder, allowing the user to search, filter, and open historical workspaces based on their root paths._

## Active Queue (Current / Next Session)

- [ ] **Task 1: The Browser UI Overlay**
  - _Details:_ Build a full-screen or large modal component (`WorkspaceBrowser.tsx`) triggered by clicking the Home logo in the `TitleBar`.
- [ ] **Task 2: IPC Metadata Wiring**
  - _Details:_ Connect the browser to the `window.api.getWorkspaceMetadata()` endpoint. Ensure the UI can gracefully handle empty states (no history) and loading states.
- [ ] **Task 3: Path-Based Querying & Sorting**
  - _Details:_ Implement a search bar that filters workspaces based on their `rootPaths` (e.g., typing "UE_Projects" shows all workspaces containing that path), sorted by `updatedAt` descending.
- [ ] **Task 4: Browser Actions (Open, Rename, Delete)**
  - _Details:_ Allow users to click a workspace to open it (adding it to `AppStore` tabs and switching context). Implement inline renaming (updates the JSON metadata) and a delete function (removes the JSON from disk).

## Pending Queue (Upcoming)

- [ ] **Task 5: Stats & History Data Wiring**
  - _Details:_ Now that workspaces are persistent, replace the mockup UI in the Sidebar Stats & History tabs with real token calculations (`js-tiktoken`) and track actual export occurrences in the JSON payload.
- [ ] **Task 6: Performance Optimization & Caching**
  - _Details:_ While the single re-hydrating store prevents memory crashes, switching between massive workspaces currently takes 3-4 seconds. Investigate caching the `rawTree` in a local IndexedDB or background worker to make tab switching nearly instantaneous.

## Blockers / Unresolved Constraints

- None at this time.
