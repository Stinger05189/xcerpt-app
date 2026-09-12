# 0_Excerpt_Overview.md

# Xcerpt: Product Specification & System Overview

> **Version:** 1.5.0+  
> **Status:** Production / Active Architecture  
> **Target Platforms:** macOS (Apple Silicon & Intel), Windows 10/11 (x64), Linux (AppImage)

---

## 1. Executive Summary & Mission Statement

Modern Large Language Models (LLMs) like Google Gemini 3.8, GPT 6, and Claude Opus 4.8 possess expansive context windows, yet interacting with them remains hampered by severe user-interface friction:

1. **Chat UI File Constraints:** Web-based chat interfaces impose arbitrary limits on file counts, file sizes, and specific file extensions (e.g., rejecting `.uproject`, `.env`, `.lock`, or binary-adjacent assets).
2. **Context Bloat & Token Inefficiency:** Providing entire multi-thousand-line source files forces models to parse boilerplate, third-party libraries, and uninformative declarations. This dilutes attention, burns prompt tokens, and increases reasoning hallucination rates.
3. **Context Switching Costs:** Developers repeatedly assemble, re-copy, and re-filter codebase context as they switch between frontend tasks, database migrations, and bug reproduction workflows.

**Xcerpt** is a desktop Context Staging Integrated Development Environment (IDE). Positioned as an intelligent middle-layer between a developer's local filesystem and browser-based AI chats, Xcerpt empowers engineers to visually curate files, surgically compress massive source files through custom skip-block annotations, organize independent presets within persistent workspaces, and drag optimized context packages straight into chat applications.

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

### 2.3. Multi-Workspace & Preset Architecture

Complex codebases demand distinct contextual lenses:

- **Workspaces:** Encapsulate multiple root directories, scanner blacklists, Git status trackers, and export batch rules. Every workspace is implicitly persisted to the OS user data directory.
- **Presets:** Staged within workspaces (e.g., _"API Bugfix Context"_, _"UI Styling Context"_). Presets store isolated sets of file inclusions, exclusions, tree-only flags, Monaco compression rules, and export history.
- **Session-Bound Snapshots:** Presets support non-destructive iteration with a "Revert Session Changes" button that compares live configurations against a session snapshot preserved in memory.

### 2.4. AI Filter Bypassing (Chunking & Extension Overrides)

Browser AI chat interfaces impose hard file upload limits:

- **Batch Chunking Engine:** The export pipeline automatically divides large repositories into configurable chunks (e.g., 10–20 files per batch) or compiles the entire selection into a single, unified `context.md` file with markdown code fences.
- **Extension Overrides (File Spoofing):** Users map rejected extensions to accepted formats (e.g., `.uproject` $\to$ `.json`, `.proto` $\to$ `.txt`). During payload flattening, files are renamed on the fly while the injected `ExportedFileTree.md` explicitly annotates the spoofed name, guaranteeing that the LLM maintains awareness of the file's original semantic type.

### 2.5. Resilient Multi-Root Ingestion & Path Relocation

- **Multi-Root Support:** Ingest multiple distinct repositories simultaneously into unified workspaces.
- **Leaf Name Disambiguation:** When multiple roots share the same folder name (e.g., `/client/src` and `/server/src`), the export engine dynamically injects numerical suffixes (`src_1`, `src_2`) to prevent file collisions.
- **Missing Path Recovery:** When external drives are unmounted or directories are renamed, roots are flagged as missing (`isMissing: true`). Xcerpt presents an in-place relocation workflow that transfers all rules, skips, and presets to the new location without loss.

### 2.6. Global History Engine (Command Pattern)

- **Zero-Snapshot Delta Architecture:** Undoing and redoing actions does not clone workspace states. Instead, inverse mutation closures are recorded in a global `HistoryStore`.
- **Async Environment Switching:** Triggering an undo across tabs or presets causes the history engine to autonomously switch workspaces, await disk hydration, select the correct preset, snap the virtualized tree to the exact scroll pixel, and apply the delta.
- **LZ-String Compression:** Bulk operations (e.g., "Expand All Folders" on 5,000 directories) are compressed using Base64 `lz-string` encoding before entering the history stack, maintaining a 1,000-operation history with negligible memory overhead.

---

## 3. Target User Personas & Use Cases

### 3.1. The Full-Stack Web Engineer

- **Scenario:** Developing a Next.js application backed by a Go or Python microservice.
- **Workflow:** The developer creates a workspace with two root paths: `frontend` and `backend`. In the "Authentication Workflow" preset, they include only the auth middleware, route handlers, and React login forms. They open the 2,000-line user database schema, mark lines 200–1800 (irrelevant tables) as skipped, package the selection, and drop it into Claude 3.5 Sonnet to debug a JWT race condition.

### 3.2. The Game Engine & Simulation Developer

- **Scenario:** Working on Unreal Engine 5 or Unity projects with custom binary manifests.
- **Workflow:** Web interfaces reject `.uproject`, `.uplugin`, and `.asset` files. The developer adds an Extension Override mapping `.uproject` $\to$ `.json` and `.uplugin` $\to$ `.json`. They exclude large binary and intermediate folders (`Saved/`, `Intermediate/`, `Binaries/`), select configuration and source files, and drop the resulting chunk into ChatGPT without hitting upload barriers.

### 3.3. The Systems Auditor & Reviewer

- **Scenario:** Conducting a security audit on a sprawling monolithic codebase.
- **Workflow:** The reviewer uses the local filter bar with "Hide Excluded" active to rapidly isolate authorization and networking files. Using keyboard hotkeys (`A` for include, `S` for tree-only context, `D` for exclude), they assemble an audit package and export a monolithic `context.md` containing the spatial directory tree and relevant code blocks for an offline security LLM.

---

## 4. High-Level System Topology

```
+----------------------------------------------------------------------------------------------------+
|                                    ELECTRON HOST ENVIRONMENT                                       |
|                                                                                                    |
|  +-------------------------------------+                +---------------------------------------+  |
|  |       MAIN PROCESS (Node.js)        |                |      RENDERER PROCESS (Chromium)      |  |
|  |                                     |                |                                       |  |
|  |  - main.cjs (UV_THREADPOOL_SIZE=16) |                |  - React 19 Strict Mode               |  |
|  |  - Chokidar File Watcher            |                |  - Tailwind CSS v4 Dynamic Theming    |  |
|  |  - Event Loop Lag Monitor           |  IPC Bridge    |  - @tanstack/react-virtual Tree       |  |
|  |  - Synchronous fsSync Payload I/O   | <============> |  - @monaco-editor/react Skip Engine   |  |
|  |  - cl100k_base Tiktoken Engine      |  preload.cjs   |  - Dual-Store (AppStore, Workspace)   |  |
|  |  - Native OS Drag (startDrag)       |                |  - Command-Pattern HistoryStore       |  |
|  |  - electron-updater Auto-Update     |                |  - Markdown & Image Native Viewers    |  |
|  +-------------------------------------+                +---------------------------------------+  |
|                     │                                                       │                      |
|                     ▼                                                       ▼                      |
|  +-------------------------------------+                +---------------------------------------+  |
|  |         PERSISTENCE & I/O           |                |             WINDOW SHELL              |  |
|  |                                     |                |                                       |  |
|  |  - AppData/Roaming/XcerptSessions/  |                |  - Frameless Custom TitleBar          |  |
|  |  - os.tmpdir()/xcerpt_export_*      |                |  - WebkitAppRegion Window Dragging    |  |
|  |  - os.tmpdir()/xcerpt_ephemeral_*   |                |  - Native OS Controls (Min/Max/Close) |  |
|  +-------------------------------------+                +---------------------------------------+  |
+----------------------------------------------------------------------------------------------------+
```

---

## 5. Production Release State & System Requirements

### 5.1. System Requirements

- **macOS:** macOS 11 (Big Sur) or higher. Native builds provided for Apple Silicon (`arm64`) and Intel (`x64`).
- **Windows:** Windows 10 or 11 (64-bit). Distributed via standard NSIS installers.
- **Linux:** Modern Linux distributions with glibc 2.31+ (Ubuntu 20.04+, Fedora 34+, Arch). Distributed via AppImage.
- **Hardware:** Minimum 4 GB RAM, 500 MB free disk space for staging caches, dual-core x64 or ARM64 processor.

### 5.2. Build & Packaging Pipeline

- **Bundler:** Vite 8 compiling React 19 components to `dist/` with relative asset referencing (`./icon.svg`) to satisfy Electron's `file://` protocol.
- **Packager:** `electron-builder` 25 configuring output targets in `release/`.
- **Auto-Updater:** Integrated `electron-updater` 6 listening to GitHub Releases for background differential updates.
- **Security Posture:** `contextIsolation: true`, `nodeIntegration: false`, and `devTools` disabled in packaged production builds.
