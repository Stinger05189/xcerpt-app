# Project Dev Log & Core Memory

> **[IMMUTABLE AI DIRECTIVE]**
> **DO NOT MODIFY THIS INSTRUCTION BLOCK.**
> This file is the project's historical ledger and your core memory. It is organized into "Epochs" (major milestones) and sequential "Sessions".
>
> **Your Responsibilities:**
>
> 1. **Session Incrementation:** Never use dates. Increment the Session ID sequentially (e.g., Session 001, Session 002) for every new `[END SESSION]` teardown.
> 2. **Teardown Protocol:** At the end of a session, append a new Session Entry under the Active Epoch. Keep it dense, technical, and focused on _decisions_ and _roadblocks_ rather than granular code steps.
> 3. **Epoch Archiving:** When the User declares a major milestone complete, summarize the previous Epoch's sessions into a dense, 3-4 sentence paragraph to save token context, then begin a new Epoch.

---

## Active Epoch: 01 - Foundation & Architecture

### Session 001

- **Focus Area:** Project initialization, environment scaffolding, and agent documentation formalization.
- **Key Decisions:**
  - Adopted Electron + React + Vite + TypeScript as the core stack for "Xcerpt" to replace the legacy Python/PyQt version.
  - Chose Zustand for global state management to handle deep tree structures without Redux boilerplate.
  - Established the "Stable Relative Path" architectural rule: all React keys and state maps (expanded, selected, excluded) will bind to relative file paths instead of UI indexes to permanently resolve the erratic selection/scroll resets found in the legacy application.
- **Roadblocks Resolved:**
  - Initial Vite/Electron boilerplate generated manually by the User to ensure a stable launch point and avoid AI hallucination during complex build-step configurations.
- **Core Files Modified:**
  - `package.json`, `vite.config.ts`, `main.cjs`, `preload.cjs`
  - `agents/conventions.md`, `agents/plan.md`, `agents/devlog.md`

---

## Archived Epochs

_(Older epochs will be compressed and summarized here to preserve the AI context window as the project scales.)_

- **Epoch 00 (Template Setup):** Initialized the Agent Forge workflow, established the hybrid manual-merge constraints, and set up the blank repository state.
