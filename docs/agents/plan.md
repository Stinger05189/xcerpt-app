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

**Epoch 4, Phase 13: UI Rendering Optimization & Virtualization**
_Context: We have completely resolved Node.js backend performance limits. However, the React Frontend struggles to paint massive DOM structures (like the 800+ node UE plugin tree). We must optimize `FileTree.tsx` to maintain a buttery smooth 60 FPS during drag-painting and scrolling._

## Active Queue (Current / Next Session)

- [ ] **Task 1: DOM Virtualization Evaluation**
  - _Details:_ Assess and implement a virtualization strategy for the unified file tree (e.g., `react-window`, `react-virtuoso`, or `@tanstack/react-virtual`). We must convert the deeply nested `TreeNode` recursive rendering into a flattened, virtualized list to prevent React from keeping thousands of hidden DOM nodes in memory.
- [ ] **Task 2: Paint Selection Architecture**
  - _Details:_ Refactor the `onMouseEnter` drag-to-paint implementation. Determine if we can decouple visual CSS updates from React's state loop during the drag, ensuring 60 FPS feedback without causing full-tree layout thrashing.
- [ ] **Task 3: Hover & Memoization Pass**
  - _Details:_ Audit `TreeNode.tsx` for unnecessary re-renders. Implement `React.memo` with custom comparison functions to ensure only explicitly hovered or painted rows trigger a render cycle.

## Pending Queue (Upcoming)

- [ ] **Task 4: Epoch Archiving**
  - _Details:_ Summarize Epoch 3 sessions into an archive paragraph and prepare the roadmap for a v1.0 Launch Prep.
