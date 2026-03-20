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

**Workflow Refinement, Frameless Shell, and Context Enhancements**
_Context: The core UI and IPC bridge are functional. We are now addressing workflow friction, performance bottlenecks (hard blacklists), editor features (un-skipping, multi-cursor), and customizing the Electron shell before finalizing the drag-and-drop export engine._

## Active Queue (Current / Next Session)

- [ ] **Task 1: Frameless Shell & Branding**
  - _Details:_ Remove the default OS title bar. Build a custom, draggable window header. Code a custom SVG brand icon.
  - _Target Files:_ `main.cjs`, `src/components/layout/TitleBar.tsx` (New)
- [ ] **Task 2: Performance & Workspace Management**
  - _Details:_ Implement a hard "blacklist" in the `chokidar` scanner to completely bypass heavy directories (`.git`, `node_modules`) for instant loading. Add the ability to remove a root path from the workspace.
  - _Target Files:_ `main.cjs`, `src/store/workspaceStore.ts`, `src/components/layout/MainStage.tsx`
- [ ] **Task 3: Context Compression Overhaul**
  - _Details:_ Fix the styling persistence bug between file switches. Add UI to "Un-skip" specific blocks, "Clear All Skips", and support Undo/Redo. Ensure multi-cursor (alt+click) skips function properly.
  - _Target Files:_ `src/components/editor/ContextEditor.tsx`, `src/store/workspaceStore.ts`
- [ ] **Task 4: Export Staging UI/UX Overhaul**
  - _Details:_ Add a "Cancel" button to return to the editor. Make batch size configurable (e.g., 25 vs unlimited). Add metadata (files per chunk, total tokens/size). Fix nested scrollbar layout issues. Add a way to preview the modified/compressed file output.
  - _Target Files:_ `src/components/export/ExportStage.tsx`, `src/components/layout/MainStage.tsx`

## Pending Queue (Upcoming)

- [ ] **Task 5: Stats, History, & Fuzzy Search**
  - _Details:_ Populate the remaining Sidebar tabs. Implement fuzzy searching for the file tree and rules list.
- [ ] **Task 6: Main Process Export Execution & OS Drag/Drop**
  - _Details:_ Write the physical file splicing logic, generate `ExportedFileTree.md`, and wire the chunk icons to Electron's `startDrag` API.

## Blockers / Unresolved Constraints

- None at this time.
