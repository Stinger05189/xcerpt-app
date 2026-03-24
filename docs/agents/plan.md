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

**Epoch 3, Phase 12: Extension Overrides**
_Context: Phase 11 (Global Config & Theming) is complete. We are now completing the final feature of Epoch 3: enabling users to define global extension mappings (e.g., `.uproject` -> `.json`) to bypass arbitrary AI chat upload filters, while ensuring the LLM is explicitly informed of the spoofing in the prompt payload._

## Active Queue (Current / Next Session)

- [ ] **Task 1: Extension Overrides UI & State**
  - _Details:_ Build a dictionary management interface inside the `SettingsModal` to allow users to add, edit, and delete extension mappings (saved to `AppStore.config.extensionOverrides`).
- [ ] **Task 2: Export Engine Integration**
  - _Details:_ Modify `exportEngine.ts` (for both Ephemeral and Full Workspaces) to dynamically intercept and rename files matching these extensions during the flattening process before they are written to disk.
- [ ] **Task 3: Prompt Integrity Mapping**
  - _Details:_ Update the `ExportedFileTree.md` generation logic to strictly adhere to the "Truth in Prompting" architecture rule. Renamed files must explicitly annotate the structural spoofing (e.g., `MyGame.uproject (Exported as MyGame.json)`).

## Pending Queue (Upcoming)

- [ ] **Task 4: Epoch 3 Review & Stabilization**
  - _Details:_ Final UI polish, bug hunting, and ensuring all workflows established in Epoch 3 (Ephemeral Exports, Presets, History, Theming, Overrides) function seamlessly together.
