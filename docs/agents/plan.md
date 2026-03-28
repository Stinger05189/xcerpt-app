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

**Epoch 4, Phase 17: External Integrations & Advanced Chunking**
_Context: With the core application stabilized, high-fidelity tokenization integrated, and the UI overhauled for brand appeal, we are shifting focus to advanced payload delivery and intelligent context chunking._

## Active Queue (Current / Next Session)

- [ ] **Task 1: AI Provider Direct Integrations (Exploratory)**
  - _Details:_ Investigate bypassing manual drag-and-drop by integrating direct API hooks (e.g., OpenAI/Anthropic keys) or clipboard manipulations to push payloads directly to active web sessions.
- [ ] **Task 2: Intelligent Semantic Chunking**
  - _Details:_ Upgrade the `maxFilesPerChunk` logic to support `maxTokensPerChunk`, utilizing the newly integrated `js-tiktoken` engine to dynamically slice payloads based on strict LLM context window limits rather than arbitrary file counts.

## Pending Queue (Upcoming)

- [ ] **Task 3: OS-Level Context Menus**
  - _Details:_ Investigate adding "Open with Xcerpt" to Windows Explorer and macOS Finder context menus via Electron installer configurations.
- [ ] **Task 4: Deep Linking**
  - _Details:_ Implement custom URI schemes (`xcerpt://`) to allow external applications or terminal commands to quickly boot specific workspaces or presets.

---

**Completed in Last Session:**

- [x] Architected and implemented the Global Undo/Redo Engine (Command Pattern + LZ-String compression).
- [x] Built async context resolution for cross-workspace undo/redo navigation.
- [x] Added "Hide Excluded" and "Hide Tree-Only" filtering toggles.
- [x] Added "Expand All" and "Collapse All" bulk folder actions.
- [x] Integrated exact scroll restoration into the history commands.
