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

**Performance Stabilization, Smart Defaults, & Sync Resiliency**
_Context: The export engine and UI interactions are built, but the application struggles with massive project directories (Unreal Engine, large Node apps). We need to implement aggressive default blacklisting, smart tree-only predictions, and resolve the remaining Chokidar sync bugs._

## Active Queue (Current / Next Session)

- [ ] **Task 1: Aggressive Auto-Blacklist Engine**
  - _Details:_ Expand the hard blacklist to comprehensively cover massive directories (Unreal Engine `Intermediate`/`Saved`, Unity `Library`, iOS `Pods`, Android `build`, Obsidian `.obsidian`, etc.).
  - _Target Files:_ `src/store/workspaceStore.ts`, `main.cjs`
- [ ] **Task 2: Expose Blacklist to Sidebar UI**
  - _Details:_ Update the Rules Sidebar to display these auto-blacklisted paths, allowing the user to explicitly un-blacklist them if they actually need to export them.
  - _Target Files:_ `src/components/layout/Sidebar.tsx`
- [ ] **Task 3: Smart "Tree-Only" Predictions**
  - _Details:_ Automatically flag certain files as `tree-only` upon scanning (e.g., `package-lock.json`, `yarn.lock`, `.env`, `.DS_Store`, binary images) so they provide context but don't consume LLM tokens.
  - _Target Files:_ `src/store/workspaceStore.ts`, `main.cjs`
- [ ] **Task 4: Fix Chokidar File Watcher Sync**
  - _Details:_ Debug and fix the issue where external file edits are not consistently triggering the React auto-build pipeline. Ensure `isStale` correctly forces a rebuild of the chunk payloads.
  - _Target Files:_ `main.cjs`, `src/components/layout/MainStage.tsx`
- [ ] **Task 5: Paint Selection Performance**
  - _Details:_ Optimize the `onMouseEnter` painting logic. It currently causes slight hangs on large trees due to excessive React renders.
  - _Target Files:_ `src/components/tree/TreeNode.tsx`, `src/components/tree/FileTree.tsx`

## Pending Queue (Upcoming)

- [ ] **Task 6: Stats & History Data Wiring**
  - _Details:_ Replace the mockup UI in the Sidebar Stats & History tabs with real token calculations using a lightweight token estimator (e.g., `js-tiktoken`).
- [ ] **Task 7: Save/Load Workspace (`.xcerpt` files)**
  - _Details:_ Implement IPC calls to serialize the Zustand store, save it to disk as a custom `.xcerpt` JSON file, and load it back.

## Blockers / Unresolved Constraints

- None at this time.
