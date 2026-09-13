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

## Active Epoch: 05 - Bidirectional LLM Dev Studio (v2.0.0)

### Session 026

- **Focus Area:** Line 1 Path Scaffolding Preservation, Monaco Model Isolation, Single Action Toolbar Streamlining, Comprehensive Language Syntax Engine, and Interactive Full Plan Viewer.
- **Key Decisions:**
  - **Line 1 Action Prefix Pruning:** Refactored `stripProtocolScaffolding` to strip strictly the action tag (`[(NEW|MODIFIED|DELETED|PARTIAL_DIFF)]\s*`) from the first non-empty comment line, preserving the language comment prefix and relative file path (`// src/auth/token.ts`, `# app/config.py`, `<!-- docs/instructions.md -->`, `-- db/migration.sql`). This preserves path context for developers and downstream prompts while eliminating false diff conflicts.
  - **Monaco Model Isolation (`key={activeAction.id}`):** Diagnosed and resolved the cross-action content bleed bug where switching between file actions caused Monaco's `onDidChangeModelContent` to fire against stale closures. Binding `key={activeAction.id}` to both `SessionDiffEditor` and `NewFilePreview` guarantees clean component unmounting and model isolation.
  - **Unified Single Action Toolbar:** Eradicated the duplicate secondary headers in `NewFilePreview` and `SessionDiffEditor`. Consolidated all metadata (language, lines, size, skip badges, status) and controls into a single action toolbar in `DevStudioModal.tsx`.
  - **Context-Sensitive Inline Diff Toggle:** Moved the `Switch to Inline Diff` toggle out of the window title bar and placed it directly inside the file action toolbar, visible strictly for diff actions (`MODIFIED` / `PARTIAL_DIFF`) and hidden for new/deleted files.
  - **Comprehensive Syntax Highlighting:** Expanded `languageHelper.ts` to support game development languages (Lua, HLSL/GLSL shaders, C#, C++, GDScript), web technologies, system languages, JSON, SQL, and dotfiles. Explicitly bound model languages on mount via `monaco.editor.setModelLanguage`.
  - **Interactive Buffer Editing & Rollback:** Enabled `readOnly: false` on the modified pane of `SessionDiffEditor` and `NewFilePreview`. Added `workingContent` buffer tracking in `sessionStore.ts`, allowing users to make manual adjustments prior to or following a merge. Added `revertAction` to restore individual files to pre-session snapshots on disk and reset action status to `PENDING`.
  - **Dedicated Full Plan View & Syntactic Reasoning:** Replaced unformatted plan text with an interactive two-pane architecture in `FullPlanViewer.tsx` featuring categorized navigation (Intent, Work Packets, Extracted Code Artifacts), collapsible artifact cards with popout Monaco inspectors, persistent scroll offsets (`planScrollTop`), and styled inline code pills across `ReasoningDrawer.tsx`.
  - **Identified Roadblocks for Session 027:**
    - _Workspace-Scoped Dev Studio Containment:_ Dev studio currently mounts as a full-screen window overlay covering the main TitleBar. It needs to be refactored to mount below the TitleBar (`top-10`) so users can switch workspace tabs without losing studio context. The entry button in the top-left TitleBar must be removed, leaving the MainStage button as the sole workspace-scoped entry point.
    - _Ingestion Focus Trap & Interactive Triage:_ Fix the bug where empty sessions prevent typing or pasting into the raw input. Overhaul the ingestion modal into an Interactive Triage Studio with one-click clipboard paste, split-pane action previews with file boundary rulers, direct raw text editing, and live re-parsing.
    - _Multi-Location Reasoning Trace Association:_ Extend parser to bind preamble, interstitial, and epilogue markdown commentary to their corresponding file actions.
- **Core Files Modified:**
  - `src/features/session/types/session.ts`, `src/features/session/engine/sessionParser.ts`
  - `src/features/session/store/sessionStore.ts`, `src/features/session/components/diff/SessionDiffEditor.tsx`
  - `src/features/session/components/diff/NewFilePreview.tsx`, `src/features/session/components/diff/languageHelper.ts`
  - `src/features/session/components/DevStudioModal.tsx`, `src/features/session/components/ActionChecklist.tsx`
  - `src/features/session/components/drawer/FullPlanViewer.tsx`, `src/features/session/components/drawer/ReasoningDrawer.tsx`
  - `src/features/session/components/SessionBrowserModal.tsx`, `src/components/layout/MainStage.tsx`
  - `scripts/test-session-parser.mjs`, `src/index.css`

---

## Archived Epochs

- **Epoch 00 (Template Setup):** Initialized the Agent Forge workflow.
- **Epoch 01 (Foundation & Architecture):** Established the core Vite + React + Electron + Zustand stack with Tailwind CSS v4. Enforced the "Stable Relative Path" architectural rule, binding all React keys and Zustand state maps strictly to file paths to permanently resolve UI selection drift. Bootstrapped the initial recursive file scanner and unified frameless Tree UI.
- **Epoch 02 (Context Compression & Export Staging):** Integrated `@monaco-editor/react` for context compression with a read-only, auto-healing skip-block system bound to stable relative paths. Built a high-performance Export Engine leveraging Node.js recursive scanning (using directory-first `dirent` checks to bypass `try/catch` I/O spikes), a single mutable `Context` object for memory safety, and flattened chunk exports via native OS drag-and-drop. Transitioned the architecture to a Multi-Workspace IDE utilizing a Dual-Store setup (`AppStore` for global IDE state, single re-hydrating `WorkspaceStore` for the active project) with implicit auto-saving, responsive container queries, and a full-screen Workspace Browser overlay.
- **Epoch 03 (Advanced Workflows & Customization):** Decoupled the background chunking engine from explicitly invoked, process-bound "Ephemeral Quick Exports". Migrated workspace logic to a Preset-based architecture allowing users to swap visual exclusions and compression profiles instantly. Overhauled the UI with a fixed-position flyout sidebar, eliminated vertical layout shifting (CLS) in the File Tree, and integrated dynamic, CSS-variable-based theming. Introduced a global File Spoofing engine (Extension Overrides) to seamlessly bypass strict LLM upload filters while explicitly logging the physical renaming inside the prompt. Fixed critical Node.js CPU/Event Loop starvation by migrating export I/O to synchronous blocking calls and utilizing native regex evaluations to shield Chokidar watcher events.
- **Epoch 04 (Rendering Optimization & Curation Architecture - v1.6.0 & v1.6.1):** Overhauled outbound curation to a zero-hitch virtual payload graph in RAM, eradicating background disk thrashing and operating system file locks via guarded read-only descriptors. Enforced scoped composite path keys (`${rootId}::${relativePath}`) and bottom-up directory lookups (`lastIndexOf`), resolving cross-root rule pollution and inclusion traps while clocking 10,000 nodes in under 20ms (< 25ms SLA). Eradicated double-slash traversal bugs, standardized canonical manifest naming with embedded code generation protocols, established tree-only 0-byte metrics, and introduced VS Code-style transient/pinned tabs with drag overflow scrolling.
