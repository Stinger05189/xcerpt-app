<!-- docs/agents/devlog.md -->

# devlog.md

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

## Active Epoch: 06 - Native LLM Integrations & Copilot Automation (v2.1.0)

### Session 028

- **Focus Area:** Provider-Agnostic LLM Engine Architecture, Zero-Code Session Creation Copilot, Developer-Guided Commit Synthesizer, Settings Modal Overhaul & Viewport Occlusion Stacking Resolution.
- **Key Decisions:**
  - **Provider-Agnostic LLM Engine (`main.cjs` / `llmService.ts`):** Implemented native Electron main process IPC handlers (`llm:complete`, `llm:testConnection`) utilizing native Node.js `fetch`. Decoupled business logic into standalone async helper `executeLLMComplete` to eliminate dependencies on private `ipcMain.handlers` internal maps. Configured OpenRouter as the default provider with `google/gemini-3.5-flash-lite`, with multi-provider adapters for Google Gemini, OpenAI, and Anthropic.
  - **Zero-Code Token Discipline Copilot (`IngestionTriageStudio.tsx`):** Added an AI Copilot action in the triage studio. Enforced strict token discipline by assembling payloads strictly from parsed reasoning traces (preamble/summary) and target file paths (`[NEW] path.ext`, `[MOD] path.ext`), guaranteeing zero code leak and keeping token usage under ~300 tokens per session creation.
  - **Developer-Guided Commit Synthesizer (`DevStudioModal.tsx` / `commitContextEngine.ts`):** Added a dedicated "Additional Guidance / Trajectory Context" input to the Git commit creator. Assembled session architectural intent, file action metadata, physical Git diffs (via new `git:getDiff` IPC handler), recent Git log history (`git:getLog`), and developer trajectory notes into a structured JSON schema (`{ subject, body }`).
  - **Settings Modal Master-Detail Overhaul & Stacking Resolution:**
    - Diagnosed and resolved the occlusion bug where `DevStudioModal` (`z-40`) rendered on top of `SettingsModal` in DOM order. Moved `<SettingsModal />` below `<DevStudioModal />` in `App.tsx` and elevated its stacking context to `fixed top-10 inset-x-0 bottom-0 z-50` with a dark translucent backdrop (`bg-black/60 backdrop-blur-sm`).
    - Overhauled `SettingsModal.tsx` from a single running scroll list into a two-column desktop IDE suite featuring a left category navigation rail (`Appearance`, `AI & Copilot`, `File Overrides`, `System & Maintenance`).
    - Fixed header layout by anchoring the close button (`X`) at the top right and relocating the "Reset to Defaults" action into the System panel with confirmation guards.
  - **Sandbox Cleanliness & Type Integrity:** Replaced Node `process.versions` calls in the renderer process with sandbox-safe environment strings and resolved TypeScript type mismatches in connection status callbacks.
- **Core Files Modified:**
  - `src/features/llm/types/llm.ts`, `src/features/llm/schemas/sessionCopilotSchemas.ts`, `src/features/llm/engine/llmService.ts`
  - `src/features/session/engine/commitContextEngine.ts`, `src/features/session/components/triage/IngestionTriageStudio.tsx`
  - `src/features/session/components/DevStudioModal.tsx`, `src/components/layout/SettingsModal.tsx`
  - `main.cjs`, `preload.cjs`, `src/types/ipc.d.ts`, `src/store/appStore.ts`, `src/App.tsx`, `scripts/test-llm-provider.mjs`, `package.json`

---

## Archived Epochs

- **Epoch 00 (Template Setup):** Initialized the Agent Forge workflow.
- **Epoch 01 (Foundation & Architecture):** Established the core Vite + React + Electron + Zustand stack with Tailwind CSS v4. Enforced the "Stable Relative Path" architectural rule, binding all React keys and Zustand state maps strictly to file paths to permanently resolve UI selection drift. Bootstrapped the initial recursive file scanner and unified frameless Tree UI.
- **Epoch 02 (Context Compression & Export Staging):** Integrated `@monaco-editor/react` for context compression with a read-only, auto-healing skip-block system bound to stable relative paths. Built a high-performance Export Engine leveraging Node.js recursive scanning (using directory-first `dirent` checks to bypass `try/catch` I/O spikes), a single mutable `Context` object for memory safety, and flattened chunk exports via native OS drag-and-drop. Transitioned the architecture to a Multi-Workspace IDE utilizing a Dual-Store setup (`AppStore` for global IDE state, single re-hydrating `WorkspaceStore` for the active project) with implicit auto-saving, responsive container queries, and a full-screen Workspace Browser overlay.
- **Epoch 03 (Advanced Workflows & Customization):** Decoupled the background chunking engine from explicitly invoked, process-bound "Ephemeral Quick Exports". Migrated workspace logic to a Preset-based architecture allowing users to swap visual exclusions and compression profiles instantly. Overhauled the UI with a fixed-position flyout sidebar, eliminated vertical layout shifting (CLS) in the File Tree, and integrated dynamic, CSS-variable-based theming. Introduced a global File Spoofing engine (Extension Overrides) to seamlessly bypass strict LLM upload filters while explicitly logging the physical renaming inside the prompt. Fixed critical Node.js CPU/Event Loop starvation by migrating export I/O to synchronous blocking calls and utilizing native regex evaluations to shield Chokidar watcher events.
- **Epoch 04 (Rendering Optimization & Curation Architecture - v1.6.0 & v1.6.1):** Overhauled outbound curation to a zero-hitch virtual payload graph in RAM, eradicating background disk thrashing and operating system file locks via guarded read-only descriptors. Enforced scoped composite path keys (`${rootId}::${relativePath}`) and bottom-up directory lookups (`lastIndexOf`), resolving cross-root rule pollution and inclusion traps while clocking 10,000 nodes in under 20ms (< 25ms SLA). Eradicated double-slash traversal bugs, standardized canonical manifest naming with embedded code generation protocols, established tree-only 0-byte metrics, and introduced VS Code-style transient/pinned tabs with drag overflow scrolling.
- **Epoch 05 (Bidirectional LLM Dev Studio - v2.0.0):** Completed the bidirectional inbound response engineering pipeline with Monaco Diff and manual buffer editing while preserving language comment syntax and line 1 relative file paths. Built the Interactive Ingestion Triage Studio with real-time file boundary rulers, multi-location reasoning associations (preamble, interstitial, epilogue), and nested code fence depth tracking for markdown-wrapped files. Established non-invasive Git working tree integration, checkpoint rollbacks, and full-screen session catalog management with IPC projection parity.
