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

### Session 027

- **Focus Area:** Workspace-Scoped Dev Studio Containment, Interactive Ingestion Triage Studio, Multi-Location Reasoning Association, Post-Session Commit Generation, and Session Lifecycle Management Suite.
- **Key Decisions:**
  - **Workspace-Scoped Studio Viewport:** Refactored `DevStudioModal.tsx` from a window-covering overlay (`fixed inset-0`) to mount strictly below the application TitleBar (`top-10 inset-x-0 bottom-0 z-40`). Removed the redundant global Dev Studio button from `TitleBar.tsx`, cementing the `MainStage.tsx` button as the sole workspace-scoped entry point. Bound all session state in `sessionStore.ts` by `workspaceId` (`sessionsByWorkspace`, `activeActionIdsByWorkspace`, `openStudioByWorkspace`), allowing developers to switch workspace tabs in the TitleBar without losing in-flight studio diff review state.
  - **Interactive Ingestion Triage Studio (`IngestionTriageStudio.tsx`):** Eliminated the blind textarea modal and focus traps by building a two-pane visual triage environment:
    - Dedicated `[Paste from Clipboard]` reading `navigator.clipboard.readText()`.
    - Left pane: Real-time action manifest displaying action badges (`[NEW]`, `[MOD]`, `[DEL]`), languages, line metrics, skip counts, heuristic warnings, and click-to-boundary jumping.
    - Right pane: Dual view modes (**Annotated Boundary Map** with distinct visual decorator cards for reasoning traces and code block boundaries vs **Raw Editor View** for direct markdown editing) paired with search match highlighting and live re-parsing.
    - Custom Metadata: Ingestion inputs for optional Session Title and Description with intelligent auto-inference defaults.
  - **Multi-Location Reasoning Association & Markdown Invariant:** Enhanced `sessionParser.ts` to categorize markdown commentary into `preamble` (architectural intent), `interstitial` (file-specific rationale linked to the succeeding code action), and `epilogue` (post-code execution steps). Implemented inner fence depth tracking to shield target `.md` / `.mdx` files wrapped in 3-backtick code fences from premature closing on nested backticks.
  - **Non-Invasive Git Integration & Commit Creator:** Added `git:commit` and `git:getBranch` IPC handlers in `main.cjs` / `preload.cjs`. Surfaced active Git branch tracking in the Dev Studio header and provided an inline commit modal pre-populated with `architecturalIntent`.
  - **Session Lifecycle & Split-Window Resolution:** Resolved the layout glitch where existing sessions split the screen upon entering triage by enforcing strict mutual exclusivity between Ingestion, Session Browser, and the Diff Studio. Added an explicit `[Exit Session]` action to cleanly unload sessions to the archive, and a `SessionCompleteBanner` that triggers when all actions are reviewed.
  - **Master-Detail Session Management Suite:** Overhauled `SessionBrowserModal.tsx` from a cramped modal into a full-screen management suite with quick search, status filtering (`All`, `In Progress`, `Completed`), sortable table columns, multi-selection batch deletion, and a detailed session inspector sidebar.
  - **IPC Persistence Parity & Regex Range Bug Resolution:** Diagnosed and fixed the bug where completed sessions permanently displayed as `Open` by projecting `status`, `description`, and `completedAt` inside `main.cjs`'s `session:list` handler with an automated fallback for legacy sessions. Fixed an unescaped hyphen in `[^\s\->]+` in `sessionParser.ts` that had inadvertently created an ASCII range 45–62, prematurely truncating file paths at forward slashes.
- **Core Files Modified:**
  - `main.cjs`, `preload.cjs`, `src/types/ipc.d.ts`
  - `src/features/session/types/session.ts`, `src/features/session/engine/sessionParser.ts`
  - `src/features/session/store/sessionStore.ts`, `src/features/session/components/DevStudioModal.tsx`
  - `src/features/session/components/triage/IngestionTriageStudio.tsx`, `src/features/session/components/SessionBrowserModal.tsx`
  - `src/features/session/components/drawer/ReasoningDrawer.tsx`, `src/components/layout/MainStage.tsx`
  - `src/components/layout/TitleBar.tsx`, `src/App.tsx`, `scripts/test-session-parser.mjs`

---

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

---

## Archived Epochs

- **Epoch 00 (Template Setup):** Initialized the Agent Forge workflow.
- **Epoch 01 (Foundation & Architecture):** Established the core Vite + React + Electron + Zustand stack with Tailwind CSS v4. Enforced the "Stable Relative Path" architectural rule, binding all React keys and Zustand state maps strictly to file paths to permanently resolve UI selection drift. Bootstrapped the initial recursive file scanner and unified frameless Tree UI.
- **Epoch 02 (Context Compression & Export Staging):** Integrated `@monaco-editor/react` for context compression with a read-only, auto-healing skip-block system bound to stable relative paths. Built a high-performance Export Engine leveraging Node.js recursive scanning (using directory-first `dirent` checks to bypass `try/catch` I/O spikes), a single mutable `Context` object for memory safety, and flattened chunk exports via native OS drag-and-drop. Transitioned the architecture to a Multi-Workspace IDE utilizing a Dual-Store setup (`AppStore` for global IDE state, single re-hydrating `WorkspaceStore` for the active project) with implicit auto-saving, responsive container queries, and a full-screen Workspace Browser overlay.
- **Epoch 03 (Advanced Workflows & Customization):** Decoupled the background chunking engine from explicitly invoked, process-bound "Ephemeral Quick Exports". Migrated workspace logic to a Preset-based architecture allowing users to swap visual exclusions and compression profiles instantly. Overhauled the UI with a fixed-position flyout sidebar, eliminated vertical layout shifting (CLS) in the File Tree, and integrated dynamic, CSS-variable-based theming. Introduced a global File Spoofing engine (Extension Overrides) to seamlessly bypass strict LLM upload filters while explicitly logging the physical renaming inside the prompt. Fixed critical Node.js CPU/Event Loop starvation by migrating export I/O to synchronous blocking calls and utilizing native regex evaluations to shield Chokidar watcher events.
- **Epoch 04 (Rendering Optimization & Curation Architecture - v1.6.0 & v1.6.1):** Overhauled outbound curation to a zero-hitch virtual payload graph in RAM, eradicating background disk thrashing and operating system file locks via guarded read-only descriptors. Enforced scoped composite path keys (`${rootId}::${relativePath}`) and bottom-up directory lookups (`lastIndexOf`), resolving cross-root rule pollution and inclusion traps while clocking 10,000 nodes in under 20ms (< 25ms SLA). Eradicated double-slash traversal bugs, standardized canonical manifest naming with embedded code generation protocols, established tree-only 0-byte metrics, and introduced VS Code-style transient/pinned tabs with drag overflow scrolling.
