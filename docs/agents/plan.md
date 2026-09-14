<!-- docs/agents/plan.md -->

# plan.md

# Short-Term Implementation Plan

> **[IMMUTABLE AI DIRECTIVE]**
> **DO NOT MODIFY THIS INSTRUCTION BLOCK.**
> This file represents the immediate, actionable queue. It does not track long-term project phases (those belong in the User's primary project docs).
>
> **Your Responsibilities:**
>
> 1. **Update on Teardown:** During the `[END SESSION]` protocol, you must update this file. Check off completed tasks (`[x]`), remove stale tasks, and populate the active queue based on the User's instructions.
> 2. **Work Packet Alignment:** The tasks listed here must directly map to the "Work Packets" you propose during the Phase 1 Triangulation of the next session.
> 3. **Identify Blockers:** Explicitly list any missing assets, pending User decisions, or dependencies required before a task can begin.

---

## Active Queue: Version 2.2.0 (Session 029 Focus)

- [ ] **WP-01: In-Line Partial Hunk Merging in Monaco Diff Editor**
  - _Details:_ Upgrade Monaco Diff Editor in `SessionDiffEditor.tsx` to render inline clickable hunk accept/reject glyphs or custom CodeLens actions directly adjacent to modified blocks, allowing granular hunk-by-hunk application to the working buffer.
- [ ] **WP-02: LLM Streaming Token Pipeline & Live Telemetry**
  - _Details:_ Upgrade the main process `llm:complete` handler to support Server-Sent Events (SSE) streaming (`stream: true`), streaming tokens live into `IngestionTriageStudio.tsx` and the commit message generator with live token speed (tok/sec) indicators.
- [ ] **WP-03: Multi-Provider Model Auto-Discovery & Balance Checker**
  - _Details:_ Add an OpenRouter key balance and credit querying routine (`/api/v1/auth/key`), displaying live credit usage in `SettingsModal.tsx` and warning developers if account balance is low.
- [ ] **WP-04: Session Export to PR Description & Markdown Changelog**
  - _Details:_ Provide a one-click `[Export Pull Request Markdown]` action in the completed session banner, synthesizing a clean GitHub/GitLab PR summary with change breakdowns, intent, and commit references.

---

## Completed in Version 2.1.0 (Session 028)

- [x] **WP-01: Provider-Agnostic LLM Client Architecture & Secure Key Management**
  - Built typed LLM client contracts in `src/features/llm/types/llm.ts`. Implemented `llm:complete` and `llm:testConnection` IPC handlers in `main.cjs` using native `fetch`. Configured OpenRouter as the default provider (`google/gemini-3.5-flash-lite`), with adapters for Google Gemini, OpenAI, and Anthropic.
- [x] **WP-02: Structured Outputs & Function Calling Tool Engine**
  - Implemented `LLMService.ts` for structured JSON execution and markdown fence stripping. Defined JSON schemas for Session Identity (`title`, `description`) and Commit Synthesis (`subject`, `body`) in `sessionCopilotSchemas.ts`.
- [x] **WP-03: Session Creation Copilot (AI Name & Intent Assistant)**
  - Added an `[AI Copilot]` action in `IngestionTriageStudio.tsx`. Formulated zero-code payloads containing strictly preamble reasoning traces and target file paths, enforcing privacy and minimal token consumption.
- [x] **WP-04: Session Completion Commit Synthesizer with Developer Guidance**
  - Added `git:getDiff` and `git:getLog` IPC handlers. Built `commitContextEngine.ts` to aggregate architectural intent, file actions, physical diffs, recent commit logs, and developer guidance notes. Upgraded commit dialog in `DevStudioModal.tsx`.
- [x] **WP-05: Diagnostic & Test Suite**
  - Built `scripts/test-llm-provider.mjs` verifying schema validation, zero-code token discipline, and payload contracts. Registered `test:llm` npm script.
- [x] **WP-06: Settings Stacking Context Resolution & Master-Detail Redesign**
  - Resolved Dev Studio occlusion bug by moving `<SettingsModal />` after `<DevStudioModal />` in `App.tsx` and elevating to `z-50`. Overhauled `SettingsModal.tsx` into a categorized two-column desktop IDE suite.

---

## Completed in Version 2.0.0 (Session 027)

- [x] **Workspace-Scoped Dev Studio & TitleBar Preservation Architecture**
- [x] **Interactive Ingestion Triage Studio with File Boundary Maps**
- [x] **Multi-Location Reasoning Association & Nested Markdown Shielding**
- [x] **Non-Invasive Git Integration & Master-Detail Session Management Suite**
- [x] **IPC Persistence Parity & Regex Range Hazard Fix**
