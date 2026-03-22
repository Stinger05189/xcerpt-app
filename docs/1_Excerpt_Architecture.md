# 1_Excerpt_Architecture.md

## Overview

This document defines the technical architecture for **Xcerpt**, a premium Electron-based desktop application. The architecture is designed to resolve the performance, state-management, and UI limitations of the previous Python/PyQt version while enabling advanced features like real-time file watching, Monaco-based code compression, native OS drag-and-drop, and a multi-workspace IDE environment.

---

## 1. Technology Stack

- **Application Framework:** Electron + Node.js
- **Build Tool / Bundler:** Vite (Provides rapid HMR during development and optimized builds).
- **Frontend Framework:** React 18+ (Strict functional components with Hooks).
- **State Management:** Zustand (Lightweight, unopinionated, avoids the boilerplate of Redux, excellent for deep tree structures).
- **Styling:** Tailwind CSS v4 (Utility-first, highly maintainable for premium/custom dark-mode UI).
- **Code Editor:** `@monaco-editor/react` (Provides VS Code-level syntax highlighting, line numbers, and selection tracking for Context Compression).
- **File Watching:** `chokidar` (Industry-standard, highly performant file system watcher).
- **Pattern Matching:** `ignore` (Standard `.gitignore` semantics) + `micromatch` (for complex globbing).
- **Token Estimation:** `js-tiktoken` for background token calculation.

---

## 2. Process Model & IPC (Inter-Process Communication)

Electron uses a multi-process architecture. To maintain security and performance, we strictly separate OS-level tasks from UI rendering using a Context Bridge (`preload.cjs`).

### The Main Process (Node.js)

Responsible for heavy lifting, OS integration, and file system access.

- **File Scanner:** Uses `fs.promises` and `chokidar` to read directories and watch for changes. Emits raw tree data to the Renderer.
- **Export Engine:** Creates temporary directories, flattens structures, applies compression transformations, and writes output files.
- **Native Drag & Drop:** Handles the `webContents.startDrag` API to allow users to drag files out of the app directly into browsers.
- **Persistence:** Automatically writes workspace state to the OS `AppData/Roaming/Xcerpt/Sessions/` directory as JSON. Handles querying these files for the Workspace Browser.

### The Renderer Process (React)

Responsible for UI, state, and user interactions.

- **Filter Engine:** Receives the _raw_ tree from Main, applies user-defined `ignore` rules in-memory, and calculates the "dimmed/excluded" visual states.
- **Tree Rendering:** Renders the unified tree using strict virtualization and granular subscriptions to prevent render lockups on large directories.
- **Context Compression UI:** Manages the Monaco editor instance and translates user selections into "Skip Rules".

### The IPC Bridge (`window.api`)

Defined in `preload.cjs`, exposing safe, typed methods:

- `api.scanDirectory(path)`
- `api.onFileChange(callback)`
- `api.saveWorkspace(id, data)` / `api.loadWorkspace(id)` / `api.getWorkspaceMetadata()`
- `api.stageExport(config)`
- `api.startDrag(tempFilePaths)`

---

## 3. Dual-Store Architecture & Performance Caching

To support multiple open workspaces containing potentially 100,000+ files each without crashing the React render cycle, Xcerpt uses a strict **Dual-Store Architecture**:

1. **The AppStore (`useAppStore`):** Manages the global IDE state. This includes the list of active workspace tabs, the currently focused workspace ID, recent workspaces, global application settings, and the state of the Workspace Browser overlay.
2. **The WorkspaceStore (`useWorkspaceStore`):** Manages the deep file trees, exclusion rules, and compression coordinates for a _single_ workspace.

**Memory Caching Strategy:**
When a user switches workspace tabs, the inactive workspace's tree components are fully unmounted from the DOM. However, the `WorkspaceStore` retains the raw tree data in memory (or is serialized to disk and purged from memory if resource limits are reached) to allow instantaneous swapping without triggering a massive `chokidar` rescan.

---

## 4. Data Schema: The Implicit `.xcerpt` Workspace

Xcerpt operates on an **Implicit Auto-Save** model. Every session is saved automatically to the OS AppData folder. The schema is designed to expose lightweight metadata for the Workspace Browser so it doesn't have to parse massive file trees just to display a list of recent projects.

```typescript
interface XcerptWorkspace {
  id: string; // UUID
  version: "2.0";
  metadata: {
    name: string | null; // Null if "Untitled Workspace"
    createdAt: string; // ISO Date
    updatedAt: string; // ISO Date
    totalExports: number;
    totalIncludedFiles: number;
    rootPaths: string[]; // Exposed for path-based querying in the browser
  };
  settings: {
    maxFilesPerChunk: number;
  };
  rules: {
    hardBlacklist: string[];
    inclusions: string[];
    exclusions: string[];
    treeOnly: string[];
  };
  compressions: {
    [filePath: string]: Array<{
      id: string;
      startLine: number;
      endLine: number;
      type: "SKIP" | "GHOST";
      signature: string; // Drift-healing text anchor
    }>;
  };
  uiState: {
    expandedFolders: string[]; // Stable relative paths
    activeTab: string; // Active root path sub-tab
  };
}
```

---

## 5. UI Layout Architecture

The application window is divided into flexible, highly consolidated panes.

### A. The Consolidated Application Header (Title Bar)

- **Left:** The Xcerpt Logo (Acts as the "Home" button to summon the Workspace Browser overlay).
- **Middle:** Global Workspace Tabs (e.g., `Frontend Tasks` | `Backend API` | `+`). Clicking these completely swaps the Main Stage environment.
- **Right:** Standard OS Window Controls (Minimize, Maximize, Close).

### B. The Left Sidebar (The Inspector)

- **Tabs:**
  - _Rules:_ Toggleable lists of Include/Exclude patterns and the Scanner Blacklist.
  - _Stats:_ Live token estimates and file counts.
  - _History:_ List of recent exports.

### C. The Main Stage

- **Sub-Header Bar:** Tabs representing each `rootPath` (e.g., `src`, `docs`) inside the _active_ workspace, plus the "Configure Export" and "Drag to Chat" global actions.
- **Left Split: The Unified Tree**
  - Shows _all_ files. Excluded files are opacity: 0.5 (dimmed).
  - Floating action bar for rapid inclusion/exclusion keyboard mapping (A, S, D).
- **Right Split: Context Editor & Export Preview**
  - _Mode 1 (Editor):_ Monaco instance loads when a file is selected. Used for defining Skip blocks.
  - _Mode 2 (Export Staging):_ A Flat-List view showing the final chunks.
