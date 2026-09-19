# 0_Excerpt_Overview.md

# Xcerpt: Product Specification & System Overview

> **Version:** 2.2.0+  
> **Status:** Production / Active Architecture  
> **Target Platforms:** macOS (Apple Silicon & Intel), Windows 10/11 (x64), Linux (AppImage)

---

## 1. Executive Summary & Mission Statement

Modern Large Language Models (LLMs) like Google Gemini 2.5/3.5, GPT-4o, and Claude 3.7 Sonnet possess expansive context windows, yet interacting with them remains hampered by severe user-interface friction:

1. **Chat UI File Constraints:** Web-based chat interfaces impose arbitrary limits on file counts, file sizes, and specific file extensions (e.g., rejecting `.uproject`, `.env`, `.lock`, or binary-adjacent assets).
2. **Context Bloat & Token Inefficiency:** Providing entire multi-thousand-line source files forces models to parse boilerplate, third-party libraries, and uninformative declarations. This dilutes attention, burns prompt tokens, and increases reasoning hallucination rates.
3. **Context Switching Costs:** Developers repeatedly assemble, re-copy, and re-filter codebase context as they switch between frontend tasks, database migrations, and bug reproduction workflows.

**Xcerpt** is a desktop Context Staging Integrated Development Environment (IDE). Positioned as an intelligent middle-layer between a developer's local filesystem and browser-based AI chats, Xcerpt empowers engineers to visually curate files, surgically compress massive source files through custom skip-block annotations, organize independent presets within persistent workspaces, drag optimized context packages straight into chat applications, and bidirectionally ingest LLM code work packets via an integrated Monaco Diff Studio.

```
+-------------------------------------------------------------------------+
|                               Local Codebases                           |
|       [Frontend Repo]        [Backend Service]        [Shared Docs]     |
+-------------------------------------------------------------------------+
                                     │
                                     ▼
+-------------------------------------------------------------------------+
|                               XCERPT IDE                                |
|  - Multi-Root Tree Ingestion & Fast Regex Curation                      |
|  - Monaco-Powered Code Compression (Skip Blocks with Drift Healing)     |
|  - Workspace Presets & Session-Bound Snapshots                          |
|  - Single-Child Directory Collapsing & Extension Overrides              |
|  - BPE Token Estimation (js-tiktoken cl100k_base)                       |
|  - Bidirectional Dev Studio with Boundary Tokens (<<<FILE_START>>>)     |
+-------------------------------------------------------------------------+
                                     │
                                     ▼
+-------------------------------------------------------------------------+
|                            Native OS Drag & Drop                        |
|   - Flat Timestamped Payloads    - Monolithic context.md Exports        |
|   - ExportedFileTree.md Map      - Ephemeral Quick-Export Bundles       |
+-------------------------------------------------------------------------+
                                     │
                                     ▼
+-------------------------------------------------------------------------+
|                            AI Chat Interfaces                           |
|         [Claude]               [ChatGPT]               [Gemini]         |
+-------------------------------------------------------------------------+
```

---

## 2. Core Value Pillars & Technical Innovations

### 2.1. Surgical Context Compression (Skip Blocks)

Rather than exporting a source file in its entirety, Xcerpt integrates a customized instance of the Monaco Editor (`@monaco-editor/react`) that allows developers to highlight code blocks and designate them as **Skip Blocks** using hotkeys (`Ctrl/Cmd + Backspace`).

- **Structural Integrity:** Skipped lines are collapsed into contextual markers (e.g., `// ... [Skipped 140 lines] ...`), preserving class, namespace, and interface boundaries.
- **Drift Reconciliation:** When external edits shift line coordinates, Xcerpt uses a cryptographic signature search across a $\pm 50$-line heuristic window to realign skip markers automatically without data loss.
- **Deferred Draft Isolation:** Highlighting and skip mutations occur in a localized draft state, insulating the global export engine and UI thread from rapid re-render lockups.

### 2.2. Ephemeral Quick Exports

Developers frequently need to grab 2–5 specific files to answer an immediate query without adjusting the broader workspace configuration:

- **1D Mathematical Marquee Brush:** Selecting files is calculated using cursor coordinates (`Math.floor(offsetY / ROW_HEIGHT)`), delivering 60fps continuous multi-selection without DOM event thrashing.
- **Exact BPE Tokenization:** While brushing, files display fast byte-to-token estimates. Once the cursor settles, the backend executes non-blocking `cl100k_base` token counting via `js-tiktoken`.
- **Process-Bound Temporary Generation:** Clicking "Package Context" invokes a dedicated Node.js routine that writes a flat, timestamped ephemeral directory to `os.tmpdir()` in sub-second time, immediately exposing a native OS drag handle.

### 2.3. Bidirectional Inbound Response Engineering (Dev Studio)

- **Deterministic File Boundary Tokens:** Outbound manifests instruct models to bound all files with `<<<FILE_START: [ACTION] path>>>` and `<<<FILE_END>>>`, eliminating parsing ambiguities for complex markdown documentation files that contain internal code blocks.
- **Outer Code Fence Stripping:** Wrapper fences (such as ````markdown`) are stripped cleanly while internal snippets are preserved.
- **Multi-Root Disk Diffing & Monaco Review:** Inbound work packets are matched against physical files on disk across all active workspace roots, populating Monaco Diff side-by-side and inline editors with manual editing and one-click merging.
