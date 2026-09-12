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

### Session 024

- **Focus Area:** Version 1.6.1 Path Normalization Hardening, Tree-Only Metric Omission, Setting Persistence Parity, and Windows CRLF Normalization.
- **Key Decisions:**
  - **Double-Slash (`//`) Eradication:** Resolved the defect where concatenating child nodes onto trailing-slash directories produced double slashes (e.g. `src/components//Button.tsx`), causing exact `compressions[scopedKey]` lookups and `treeOnlyExact` checks to fail during export generation.
  - **Redundant Slash Collapsing in `normalizePath` & `canonicalizePath`:** Injected `clean = clean.replace(/\/+/g, '/')` across `filterEngine.ts` to mathematically guarantee single-slash POSIX paths at arbitrary tree depths while preserving directory trailing slashes.
  - **Tree-Only 0-Byte Accounting:** Re-architected `buildNode` in `exportEngine.ts` to zero out exported sizes (`size: 0`, `trueSize: 0`, `tokens: 0`) for any leaf node where `status !== 'included'`. Parent directory aggregations now accurately reflect physical export payloads, and `PayloadPreviewTree.tsx` renders clean em-dashes (`—`) for tree-only items.
  - **Workspace Setting Persistence Parity:** Added `embedProtocol: state.embedProtocol` to `getWorkspacePayload` and `generateFreshWorkspace` in `Bootstrapper.tsx`, ensuring protocol injection preferences persist cleanly to disk.
  - **Windows CRLF Line-Ending Normalization:** Updated `processExport` and `processEphemeralExport` in `main.cjs` to normalize raw disk files via `.replace(/\r\n/g, '\n')` prior to splicing skip markers, eliminating trailing `\r` corruption and offset drift on Windows.
  - **Suite 8 Diagnostic Regression:** Expanded `scripts/run-diagnostics.mjs` with Suite 8, asserting zero double slashes in virtual nodes/export files, exact compressions key matching, and strict omission of tree-only/excluded files from physical chunk lists.
- **Core Files Modified:**
  - `src/utils/filterEngine.ts`, `src/utils/exportEngine.ts`, `main.cjs`
  - `src/components/layout/Bootstrapper.tsx`, `src/components/export/PayloadPreviewTree.tsx`
  - `scripts/run-diagnostics.mjs`

---

## Archived Epochs

- **Epoch 00 (Template Setup):** Initialized the Agent Forge workflow.
- **Epoch 01 (Foundation & Architecture):** Established the core Vite + React + Electron + Zustand stack with Tailwind CSS v4. Enforced the "Stable Relative Path" architectural rule, binding all React keys and Zustand state maps strictly to file paths to permanently resolve UI selection drift. Bootstrapped the initial recursive file scanner and unified frameless Tree UI.
- **Epoch 02 (Context Compression & Export Staging):** Integrated `@monaco-editor/react` for context compression with a read-only, auto-healing skip-block system bound to stable relative paths. Built a high-performance Export Engine leveraging Node.js recursive scanning (using directory-first `dirent` checks to bypass `try/catch` I/O spikes), a single mutable `Context` object for memory safety, and flattened chunk exports via native OS drag-and-drop. Transitioned the architecture to a Multi-Workspace IDE utilizing a Dual-Store setup (`AppStore` for global IDE state, single re-hydrating `WorkspaceStore` for the active project) with implicit auto-saving, responsive container queries, and a full-screen Workspace Browser overlay.
- **Epoch 03 (Advanced Workflows & Customization):** Decoupled the background chunking engine from explicitly invoked, process-bound "Ephemeral Quick Exports". Migrated workspace logic to a Preset-based architecture allowing users to swap visual exclusions and compression profiles instantly. Overhauled the UI with a fixed-position flyout sidebar, eliminated vertical layout shifting (CLS) in the File Tree, and integrated dynamic, CSS-variable-based theming. Introduced a global File Spoofing engine (Extension Overrides) to seamlessly bypass strict LLM upload filters while explicitly logging the physical renaming inside the prompt. Fixed critical Node.js CPU/Event Loop starvation by migrating export I/O to synchronous blocking calls and utilizing native regex evaluations to shield Chokidar watcher events.
- **Epoch 04 (Rendering Optimization & Curation Architecture - v1.6.0 & v1.6.1):** Overhauled outbound curation to a zero-hitch virtual payload graph in RAM, eradicating background disk thrashing and operating system file locks via guarded read-only descriptors. Enforced scoped composite path keys (`${rootId}::${relativePath}`) and bottom-up directory lookups (`lastIndexOf`), resolving cross-root rule pollution and inclusion traps while clocking 10,000 nodes in under 20ms (< 25ms SLA). Eradicated double-slash traversal bugs, standardized canonical manifest naming with embedded code generation protocols, established tree-only 0-byte metrics, and introduced VS Code-style transient/pinned tabs with drag overflow scrolling.
