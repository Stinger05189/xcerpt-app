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

**Epoch 2, Phase 6: Auto-Save Serialization & AppStore Foundation**
_Context: We are transitioning from a single-instance volatile workspace to an implicit auto-saving IDE model. Before building the UI tabs or the Workspace Browser, we must establish the base data layer: the `AppStore`, the serialization schema, and the continuous disk-syncing loop in AppData._

## Active Queue (Current / Next Session)

- [ ] **Task 1: Define `AppStore` & Serialization Schema**
  - _Details:_ Create `src/store/appStore.ts` to hold global state (active workspace ID, list of open tabs). Extract the serialization and deserialization functions that convert `useWorkspaceStore` state into the `XcerptWorkspace` JSON schema (including the calculation of metadata like `totalIncludedFiles`).
- [ ] **Task 2: IPC AppData Disk Bridge**
  - _Details:_ Update `main.cjs` and `preload.cjs` to handle writing to and reading from the OS user data directory (`app.getPath('userData')/Sessions`). Implement `api.saveSession(id, data)` and `api.loadSession(id)`.
- [ ] **Task 3: The Auto-Save Middleware / Effect**
  - _Details:_ Implement a React `useEffect` or Zustand middleware that watches for critical changes in the active workspace (rules, compressions, root paths) and debounces a background write to disk.
- [ ] **Task 4: Session Restoration on Launch**
  - _Details:_ Ensure that when the app boots, it queries the last active session ID from a master config file and restores it automatically, dropping the user exactly where they left off.

## Pending Queue (Upcoming)

- [ ] **Task 5: UI Header Consolidation**
  - _Details:_ Rebuild `TitleBar.tsx` to include the global workspace tabs and the interactive Home Logo.
- [ ] **Task 6: The Workspace Browser**
  - _Details:_ Build the Home screen overlay to query metadata across all saved sessions.

## Blockers / Unresolved Constraints

- _Decision Needed:_ We need to decide if we want to use multiple instances of `useWorkspaceStore` (e.g., passing a store context down a React tree) or keep a single global store that we completely wipe and re-hydrate every time the user clicks a different workspace tab. Re-hydrating might cause a slight UI stutter but saves immense memory.
