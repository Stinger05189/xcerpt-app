// src/types/ipc.d.ts
export interface FileNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size: number;
  children: FileNode[];
}

export interface ScanResult {
  node: FileNode;
  rules: string[]; 
  treeOnly: string[];
}

export interface CompressionRuleIPC {
  id: string;
  startLine: number;
  endLine: number;
  type: 'SKIP' | 'GHOST';
  signature: string;
  lineCount: number;
}

export interface ExportFile {
  absolutePath: string;
  relativePath: string;
  flatFileName: string;
  compressions: CompressionRuleIPC[];
}

export interface ExportChunk {
  id: number;
  files: ExportFile[];
}

export interface ExportPayload {
  chunks: ExportChunk[];
  treeMarkdown: string;
}

// --- Persistence Schemas ---
export interface AppStatePayload {
  activeWorkspaceId: string | null;
  openTabs: { id: string; title: string }[];
  openWorkspaceIds?: string[]; // Legacy fallback
}

export interface WorkspaceMetadata {
  id: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
  totalIncludedFiles: number;
  rootPaths: string[];
}

export interface WorkspacePayload {
  id: string;
  version: string;
  metadata: WorkspaceMetadata;
  settings: {
    maxFilesPerChunk: number;
  };
  rules: {
    hardBlacklist: string[];
    inclusions: string[];
    exclusions: string[];
    treeOnly: string[];
  };
  compressions: Record<string, CompressionRuleIPC[]>;
  uiState: {
    expandedFolders: string[];
    activeTab: string | null;
  };
}

export interface ElectronAPI {
  ping: () => Promise<string>;
  selectDirectory: () => Promise<string | null>;
  scanDirectory: (path: string, blacklist: string[]) => Promise<ScanResult>;
  readFile: (path: string) => Promise<string>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;

  // Export & OS API
  stageExport: (payload: ExportPayload) => Promise<string[]>;
  startDrag: (filePaths: string[]) => void;
  openPath: (path: string) => Promise<string>;
  showItemInFolder: (path: string) => void;

  // Persistence API
  loadAppState: () => Promise<AppStatePayload | null>;
  saveAppState: (payload: AppStatePayload) => Promise<void>;
  loadSession: (id: string) => Promise<WorkspacePayload | null>;
  saveSession: (id: string, payload: WorkspacePayload) => Promise<void>;
  getWorkspaceMetadata: () => Promise<WorkspaceMetadata[]>;
  renameWorkspace: (id: string, newName: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;

  // Event Listeners
  onFileChange: (callback: (event: 'add' | 'change' | 'unlink', path: string) => void) => () => void;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}