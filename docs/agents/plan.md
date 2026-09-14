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

## Active Queue: Version 2.1.0 (Session 028 Focus)

- [ ] **WP-01: Provider-Agnostic LLM Client Architecture & Secure Key Management**
  - _Details:_ Build a modular, extensible LLM client layer in `src/features/llm/` supporting OpenRouter, Google Gemini API, and OpenAI. Configure OpenRouter as the default provider with `google/gemini-3.5-flash-lite` as the default model. Implement secure API key storage via OS-safe local encryption / app config and expose model selection settings in `SettingsModal.tsx`.
- [ ] **WP-02: Structured Outputs & Function Calling Tool Engine**
  - _Details:_ Implement support for deterministic structured JSON responses (`response_format: { type: 'json_schema' }` / `json_object`) and tool calling (`tools`, `tool_choice`). Build schema validators for Session Naming, Description generation, and Commit Message synthesis.
- [ ] **WP-03: Session Creation Copilot (AI Name & Intent Assistant)**
  - _Details:_ Integrate a one-click `[Generate Name & Description]` copilot button in `IngestionTriageStudio.tsx`. Payload strictly includes parsed reasoning traces (preamble/summary) and target file actions (`[NEW] path.ext`, `[MOD] path.ext`) while strictly omitting raw file bodies to preserve minimal token overhead.
- [ ] **WP-04: Session Completion Commit Synthesizer**
  - _Details:_ In `DevStudioModal.tsx` and the `SessionCompleteBanner`, provide an `[AI Generate Commit Message]` action. Construct a targeted context payload containing session architectural intent, file action metadata, Git file diffs, and recent Git log history to synthesize conventional, high-fidelity commit messages.

---

## Completed in Version 2.0.0 (Session 027)

- [x] **WP-01: Workspace-Scoped Dev Studio & TitleBar Preservation Architecture**
  - Removed Dev Studio from TitleBar; anchored studio below TitleBar (`top-10 inset-x-0 bottom-0 z-40`). Bound session state per `workspaceId` in `sessionStore.ts` allowing tab switching without losing review state.
- [x] **WP-02: Fix Ingestion Focus Trap & Interactive Triage Studio**
  - Built `IngestionTriageStudio.tsx` with clipboard paste, real-time action checklist, warning indicators, and jump navigation. Fixed all focus traps.
- [x] **WP-03: Multi-Location Reasoning Association & Markdown Resilience**
  - Categorized reasoning into preamble, file-linked interstitial, and post-code epilogue sections. Added nested code fence depth tracking to prevent inner 3-backtick blocks from breaking outer markdown files.
- [x] **WP-04: Non-Invasive Git Integration & Post-Session Commit Generator**
  - Added `git:commit` and `git:getBranch` IPC handlers. Built commit generation dialog and header branch indicators.
- [x] **WP-05: Session Completion Lifecycle & Master-Detail Management Suite**
  - Added `completeCurrentSession()`, `exitCurrentSession()`, and `SessionCompleteBanner`. Overhauled `SessionBrowserModal.tsx` into a full-screen management suite with sortable tables, search, multi-selection batch deletion, and session inspector.
- [x] **WP-06: IPC Persistence Parity & Regex Range Hazard Fix**
  - Fixed `session:list` in `main.cjs` to project `status`, `description`, and `completedAt`. Escaped hyphens in `[^\s\->]+` in `sessionParser.ts`.

---

## Completed in Version 2.0.0 (Session 026)

- [x] **Line 1 Protocol Stripping Refinement & Parser Diagnostic Suite** (`sessionParser.ts`)
- [x] **Monaco Model Isolation & Syntax Highlighting Engine** (`SessionDiffEditor.tsx`, `languageHelper.ts`)
- [x] **Unified Single Action Toolbar & Single-Accept Workflow** (`DevStudioModal.tsx`)
- [x] **Full Plan View Artifact Overhaul & Syntactic Reasoning** (`FullPlanViewer.tsx`)
