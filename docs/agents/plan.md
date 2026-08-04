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

- [x] Added `respectGitignore` toggle to allow manual inclusion/export of git-ignored files.
- [x] Implemented missing directory detection (`isMissing`) and `relocateRootPath` migration workflow.
- [x] Patched `exportEngine` to disambiguate identical root folder names in multi-root workspaces.
- [x] Resolved workspace renaming persistence bug and added inline workspace renaming to `Sidebar.tsx`.
