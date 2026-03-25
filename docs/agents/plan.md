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

**Epoch 4, Phase 14: Packaging, Deployment & Branding**
_Context: With performance profiling complete and rendering bottlenecks resolved via virtualization, the application is ready to become a standalone executable. We must configure the build tools, integrate branding, and establish an auto-update pipeline for seamless user distribution._

## Active Queue (Current / Next Session)

- [ ] **Task 1: Application Branding (App Icon Integration)**
  - _Details:_ Inject the provided high-quality icon into the Electron build process so that OS taskbars, executable files, and desktop shortcuts display the correct branding.
  - _Blockers:_ User must provide or point to the `.ico` / `.icns` / `.png` asset to be used.
- [ ] **Task 2: Build System & Packaging Configuration**
  - _Details:_ Configure `electron-builder` or Electron Forge to compile the React/Vite/Node assets into a distributable installer (e.g., Windows `.exe`, Mac `.dmg`). Ensure `main.cjs` and `preload.cjs` are correctly bundled.
- [ ] **Task 3: Seamless Background Auto-Updater**
  - _Details:_ Integrate `electron-updater` to automatically check for, download, and install updates in the background (e.g., via GitHub Releases or a dedicated update server). This completely eliminates the need for manual installer downloads. Ensure the update lifecycle (downloading, patching, and prompting for restart) protects the user's local `AppData/Roaming/Xcerpt` workspace data.

## Pending Queue (Upcoming)

- [ ] **Task 4: v1.0 Launch Prep & Final QA**
  - _Details:_ Perform a final pass on the UI states for a compiled binary environment, test production DevTools stripping, and finalize README documentation.
