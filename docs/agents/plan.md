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

**Export Execution Engine & OS Integration**
_Context: The application shell, performance optimizations, and context compression UI are fully hardened. We are now moving into the core backend functionality: actually parsing the files, executing the skip commands, and preparing the files for native drag-and-drop._

## Active Queue (Current / Next Session)

- [ ] **Task 1: Main Process Export Execution**
  - _Details:_ Write the Node.js file writer logic. When "Stage Export" is triggered, Node should create a temporary OS folder, iterate through the included files, physically splice out the skipped blocks based on `compressions` state, and write the compressed output.
  - _Target Files:_ `main.cjs`, `preload.cjs`, `src/components/export/ExportStage.tsx`
- [ ] **Task 2: ExportedFileTree.md Generation**
  - _Details:_ Alongside the generated files, write a script to generate a highly optimized markdown representation of the project structure, annotating skipped vs. included files to give the LLM spatial awareness.
  - _Target Files:_ `main.cjs`
- [ ] **Task 3: OS Native Drag & Drop**
  - _Details:_ Wire the UI chunk icons to Electron's `webContents.startDrag` API via IPC so users can drag the generated temp folders directly into ChatGPT/Claude.
  - _Target Files:_ `main.cjs`, `preload.cjs`, `src/components/export/ExportStage.tsx`

## Pending Queue (Upcoming)

- [ ] **Task 4: Stats & History Data Wiring**
  - _Details:_ Replace the mockup UI in the Sidebar Stats & History tabs with real data calculated from the `workspaceStore` and past export payloads.
- [ ] **Task 5: Save/Load Workspace (`.xcerpt` files)**
  - _Details:_ Implement IPC calls to serialize the Zustand store, save it to disk as a custom `.xcerpt` JSON file, and load it back.

## Blockers / Unresolved Constraints

- None at this time.
