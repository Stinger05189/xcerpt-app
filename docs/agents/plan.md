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

**Phase 1 & 2: Core Shell, State Management, and IPC File Integration**
_Context: We are building the base layout, global state, and the communication bridge necessary to read the local file system before building the visual tree._

## Active Queue (Current / Next Session)

- [x] **Task 1: Build the UI Shell Layout**
  - _Details:_ Construct the main application grid using Tailwind CSS (Sidebar, Main Stage, Top Tabs). Establish the premium dark-mode aesthetic.
  - _Target Files:_ `src/App.tsx`, `src/index.css`, `src/components/layout/`
- [x] **Task 2: Initialize the Workspace Zustand Store**
  - _Details:_ Create `useWorkspaceStore` implementing the `XcerptWorkspace` interface. Must support the "Untitled" state, root paths, and rule arrays.
  - _Target Files:_ `src/store/workspaceStore.ts`
- [x] **Task 3: Establish the IPC Bridge**
  - _Details:_ Create typed communication channels in `preload.cjs` and `main.cjs` to allow React to request directory scans.
  - _Target Files:_ `preload.cjs`, `main.cjs`, `src/types/ipc.d.ts`

## Pending Queue (Upcoming)

- [ ] **Task 4: Implement Node.js File System Scanner**
  - _Details:_ Build the recursive directory scanner using `chokidar` in the Main process that emits the raw nested JSON tree.
  - _Target Files:_ `main.cjs` (or an imported module like `src/main/scanner.ts`)
- [ ] **Task 5: Build the Unified Tree Component**
  - _Details:_ Create the recursive React component to render the file tree, utilizing Stable Relative Paths as keys.
  - _Target Files:_ `src/components/tree/FileTree.tsx`, `src/components/tree/TreeNode.tsx`

## Blockers / Unresolved Constraints
