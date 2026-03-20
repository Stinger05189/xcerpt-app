# 1_Excerpt_Architecture.md

## Overview

This document defines the technical architecture for **Xcerpt**, a premium Electron-based desktop application. The architecture is designed to resolve the performance, state-management, and UI limitations of the previous Python/PyQt version while enabling advanced features like real-time file watching, Monaco-based code compression, and native OS drag-and-drop.

---

## 1. Technology Stack

- **Application Framework:** Electron + Node.js
- **Build Tool / Bundler:** Vite (Provides rapid HMR during development and optimized builds).
- **Frontend Framework:** React 18+ (Strict functional components with Hooks).
- **State Management:** Zustand (Lightweight, unopinionated, avoids the boilerplate of Redux, excellent for deep tree structures).
- **Styling:** Tailwind CSS (Utility-first, highly maintainable for premium/custom dark-mode UI).
- **Code Editor:** `@monaco-editor/react` (Provides VS Code-level syntax highlighting, line numbers, and selection tracking for Context Compression).
- **File Watching:** `chokidar` (Industry-standard, highly performant file system watcher).
- **Pattern Matching:** `ignore` (Standard `.gitignore` semantics) + `micromatch` (for complex globbing).
- **Token Estimation:** `tiktoken` (or a lightweight JS port like `js-tiktoken`) for background token calculation.

---

## 2. Process Model & IPC (Inter-Process Communication)

Electron uses a multi-process architecture. To maintain security and performance, we strictly separate OS-level tasks from UI rendering using a Context Bridge (`preload.js`).

### The Main Process (Node.js)

Responsible for heavy lifting, OS integration, and file system access.

- **File Scanner:** Uses `fs.promises` and `chokidar` to read directories and watch for changes. Emits raw tree data to the Renderer.
- **Export Engine:** Creates temporary directories, flattens structures, applies compression transformations, and writes output files.
- **Native Drag & Drop:** Handles the `webContents.startDrag` API to allow users to drag files out of the app directly into browsers (ChatGPT, Claude).
- **Persistence:** Reads/Writes `.xcerpt` workspace files to disk.

### The Renderer Process (React)

Responsible for UI, state, and user interactions.

- **Filter Engine:** Receives the _raw_ tree from Main, applies user-defined `ignore`/`micromatch` rules in-memory, and calculates the "dimmed/excluded" visual states. (Doing this in the Renderer ensures instantaneous UI updates when a user toggles a rule, without requiring a re-scan of the disk).
- **Tree Rendering:** Renders the unified tree.
- **Context Compression UI:** Manages the Monaco editor instance and translates user selections into "Skip Rules".

### The IPC Bridge (`window.api`)

Defined in `preload.js`, exposing safe, typed methods:

- `api.scanDirectory(path)`
- `api.onFileChange(callback)`
- `api.saveWorkspace(data)`
- `api.stageExport(config)`
- `api.startDrag(tempFilePath)`

---

## 3. Data Schema: The `.xcerpt` Workspace

Xcerpt operates on a "Save-As" model. The working state is kept in memory/localStorage (as an "Untitled Workspace"). When saved, it generates a `.xcerpt` (JSON) file.

```typescript
interface XcerptWorkspace {
  version: "1.0";
  metadata: {
    name: string; // e.g., "Frontend App Research"
    createdAt: string; // ISO Date
    lastOpened: string; // ISO Date
    exportCount: number;
  };
  settings: {
    rootPaths: string[]; // Array of absolute paths (Multi-root support)
    maxFilesPerChunk: number; // For batch exporting (e.g., 10)
    includeExportedFileTree: boolean;
  };
  rules: {
    inclusions: string[]; // e.g., ["src/**/*.ts"]
    exclusions: string[]; // e.g., ["node_modules/", "*.log"]
  };
  // The Context Compression Engine mapping
  compressions: {
    [filePath: string]: {
      // Array of blocks to skip/ghost
      skips: Array<{
        id: string;
        startLine: number;
        endLine: number;
        type: "SKIP" | "GHOST";
      }>;
    };
  };
  uiState: {
    expandedFolders: string[]; // Stable paths of expanded tree nodes
    activeTab: string; // Currently viewed root path
  };
}
```

---

## 4. State Management & Fixing Previous UI Bugs

The biggest issue in the previous version was **scroll positions and selections resetting** when filters were applied or files changed.

**The Solution:**
Instead of using array indexes or UI-bound IDs, Zustand will map everything to **Stable Relative Paths** (e.g., `src/components/Button.tsx`).

- `expandedFolders: Set<string>`
- `selectedFiles: Set<string>`

When `chokidar` detects a file change, or a user applies a new filter, React reconciles the tree. Because the component `key` prop is the Stable Relative Path, React maintains the DOM node, preserving scroll position and expanded state automatically.

---

## 5. UI Layout Architecture

The application window is divided into flexible, resizable panes.

### A. The Left Sidebar (The Inspector)

- **Top:** Fuzzy Search Bar (Filters the active sidebar tab).
- **Tabs:**
  - _Rules:_ Toggleable lists of Include/Exclude patterns.
  - _Stats:_ Live token estimates (Total, Included, Skipped).
  - _History:_ List of recent exports (Clicking one previews the chunk payload).

### B. The Main Stage

- **Header Bar:** Tabs representing each `rootPath` in the workspace.
- **Left Split: The Unified Tree**
  - Shows _all_ files. Excluded files are opacity: 0.5 (dimmed).
  - Checkboxes next to items. Toggling a checkbox pushes a rule to the `rules` array in Zustand.
  - Tree local search/filter bar (filters the _view_, not the export rules).
- **Right Split: Context Editor & Export Preview**
  - _Mode 1 (Editor):_ Monaco instance loads when a file is selected. Used for defining `compressions` (Skip/Ghost blocks).
  - _Mode 2 (Export Staging):_ A Flat-List view showing the final chunks (e.g., Chunk 1: 10 files, Chunk 2: 4 files). Includes the draggable visual package icon.

---

## 6. Core Subsystems

### A. Context Compression Engine

1.  User selects lines 50-100 in Monaco.
2.  User triggers context menu: "Skip Block".
3.  Zustand adds `{ startLine: 50, endLine: 100, type: "SKIP" }` to the `compressions` map for that file.
4.  Monaco Editor decorations API visually replaces lines 50-100 with a foldable, stylized pill reading `[ ... Skipped 50 lines ... ]`.
5.  During export, the Main process reads the file, splices out lines 50-100, and inserts the markdown summary flag.

### B. Export Staging & Drag-and-Drop Pipeline

1.  User clicks "Prepare Export" in the UI.
2.  Renderer sends the filtered file list + compression rules to Main via IPC.
3.  Main creates a unique Temp Directory (`/temp/xcerpt_export_123/`).
4.  Main reads files, applies compressions, applies formatting, and writes to Temp Directory.
5.  Main groups files into chunks based on `maxFilesPerChunk` (e.g., subfolders `/chunk_1/`, `/chunk_2/`).
6.  Main replies to Renderer with the success and temp paths.
7.  Renderer displays the "Drag to Chat" icons.
8.  User clicks and drags an icon. The Renderer triggers `api.startDrag(chunk1Path)`, handing off the file transfer to the OS native drag-and-drop system.
