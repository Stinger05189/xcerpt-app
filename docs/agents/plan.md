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

- [ ] **Task 1: Stats & History Data Wiring**
  - _Details:_ Now that workspaces are fully persistent and queryable, replace the mockup UI in the Sidebar Stats & History tabs. Integrate `js-tiktoken` for real-time token calculations and track actual export occurrences in the JSON payload.
- [ ] **Task 2: Performance Optimization & Tree Caching**
  - _Details:_ While the single re-hydrating store prevents memory crashes, switching between massive workspaces currently takes ~3-4 seconds. Investigate caching the `rawTree` in a local IndexedDB or utilizing a background Web Worker to make tab switching nearly instantaneous.

## Pending Queue (Upcoming)

- [ ] **Task 3: Dynamic Heuristics & Smart Blacklisting**
  - _Details:_ Implement an auto-detection engine during directory scanning that suggests or automatically flags common "tree-only" files (`package-lock.json`, `.env`) and heavy dependencies based on project type.
- [ ] **Task 4: Application Polish & Packaging**
  - _Details:_ Finalize UI/UX polish, handle empty states across all views, configure Electron Builder for cross-platform distribution (Windows `.exe`, Mac `.dmg`), and finalize app icons.
