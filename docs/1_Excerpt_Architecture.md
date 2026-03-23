# 1_Excerpt_Architecture.md

## Overview

This document defines the technical architecture for **Xcerpt**, a premium Electron-based desktop application. The architecture is designed to resolve the performance, state-management, and UI limitations of the previous Python/PyQt version while enabling advanced features like real-time file watching, Monaco-based code compression, native OS drag-and-drop, workspace presets, and dynamic theming.

---

## 1. Technology Stack

- **Application Framework:** Electron + Node.js
- **Build Tool / Bundler:** Vite
- **Frontend Framework:** React 18+ (Strict functional components with Hooks).
- **State Management:** Zustand (Dual-Store architecture).
- **Styling:** Tailwind CSS v4 + Native CSS Variables (for dynamic theming).
- **Code Editor:** `@monaco-editor/react`.
- **File Watching:** `chokidar`.
- **Pattern Matching:** `ignore` + `micromatch`.
- **Token Estimation:** `js-tiktoken` (or fast byte-to-token heuristics for UI threads).

---

## 2. Process Model & IPC (Inter-Process Communication)

Electron uses a multi-process architecture. We strictly separate OS-level tasks from UI rendering using a Context Bridge (`preload.cjs`).

### The Main Process (Node.js)

- **File Scanner:** Reads directories and watches for changes. Emits raw tree data.
- **Dual Export Engines:**
  - _Workspace Export Engine:_ Batches and chunks the entire active preset configuration for massive, full-context payloads.
  - _Ephemeral Export Engine:_ Creates isolated, process-bound temporary directories specifically for user-selected "Quick Exports", optimizing for speed.
- **Native Drag & Drop:** Handles the `webContents.startDrag` API.
- **Persistence:** Automatically writes workspace and config states to the OS `AppData/Roaming/Xcerpt/` directory.

### The Renderer Process (React)

- **Filter Engine:** Applies workspace blacklists and preset exclusion rules in-memory.
- **Tree Rendering:** Renders the unified tree with fast byte/token estimation for current selections.
- **Context Compression UI:** Manages the Monaco editor instance.

---

## 3. Dual-Store Architecture & Performance Caching

1. **The AppStore (`useAppStore`):** Manages the global IDE state (active tabs, global configs, theming, extension overrides).
2. **The WorkspaceStore (`useWorkspaceStore`):** Manages the deep file trees, hard blacklists, and the active Preset configurations.

---

## 4. Data Schema: Persistence & Configuration

### A. The Global AppConfig (`config.json`)

Agnostic of workspaces, this schema dictates the physical appearance and global rules of the application.

```typescript
interface AppConfig {
  theme: {
    scale: number;
    font: {
      size: number;
      family: string;
      colors: {
        text: string;
        foreground: string;
        accent: string;
        fileExtension: string;
      };
    };
    application: {
      accent: string;
      bgPrimary: string;
      bgSecondary: string;
      selectionStyle: string;
    };
  };
  shortcuts: Record<string, string>;
  extensionOverrides: Record<string, string>; // e.g., { ".uproject": ".json" }
}
```

### B. The Implicit `.xcerpt` Workspace

Workspaces utilize an **Implicit Auto-Save** model. The schema separates global workspace constraints (Hard Blacklists) from ephemeral configurations (Presets).

```typescript
interface XcerptWorkspace {
  id: string; // UUID
  version: "3.0";
  metadata: {
    name: string | null;
    createdAt: string;
    updatedAt: string;
    totalIncludedFiles: number; // Based on active preset
    rootPaths: string[];
  };
  rules: {
    hardBlacklist: string[]; // Universal scanner exclusions (.git, node_modules)
  };
  activePresetId: string;
  presets: Array<{
    id: string;
    name: string;
    inclusions: string[];
    exclusions: string[];
    treeOnly: string[];
    compressions: Record<string, CompressionRule[]>;
    history: Array<{
      id: string;
      date: string;
      fileCount: number;
      totalSize: number;
      estimatedTokens: number;
    }>;
  }>;
  uiState: {
    expandedFolders: string[];
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
