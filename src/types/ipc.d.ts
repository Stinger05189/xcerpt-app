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
  size: number;
}

export interface ExportChunk {
  id: number;
  files: ExportFile[];
}

export interface ExportPayload {
  chunks: ExportChunk[];
  treeMarkdown: string;
  metrics?: { excluded: number; treeOnly: number; size: number; tokens: number; };
}

export interface EphemeralPayload {
  files: ExportFile[];
  treeMarkdown: string;
}

// --- App Config Schema ---
export interface AppConfig {
  theme: {
    scale: number;
    font: {
      size: number;
      family: string;
    };
    colors: {
      bgBase: string;
      bgPanel: string;
      bgHover: string;
      textPrimary: string;
      textMuted: string;
      borderSubtle: string;
      accent: string;
    };
  };
  shortcuts: Record<string, string>;
  extensionOverrides: Record<string, string>;
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
  stats: {
    totalExports: number;
    ephemeralExports: number;
    fileFrequencies: Record<string, number>;
  };
}

export interface ExportHistory {
  id: string;
  date: string;
  fileCount: number;
  totalSize: number;
  estimatedTokens: number;
  files: string[];
}

export interface Preset {
  id: string;
  name: string;
  inclusions: string[];
  exclusions: string[];
  treeOnly: string[];
  compressions: Record<string, CompressionRuleIPC[]>;
  history: ExportHistory[];
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
  };
  activePresetId: string;
  presets: Preset[];
  uiState: {
    expandedFolders: string[];
    activeTab: string | null;
    paneWidths?: { sidebar: number; tree: number };
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
  setZoomFactor: (factor: number) => void;

  // Git & App Version Info
  getVersion: () => Promise<string>;
  getGitStatus: (targetPath: string) => Promise<Record<string, string>>;

  // Export & OS API
  stageExport: (payload: ExportPayload) => Promise<string[]>;
  stageEphemeralExport: (payload: EphemeralPayload) => Promise<string[]>;
  startDrag: (filePaths: string[]) => void;
  openPath: (path: string) => Promise<string>;
  showItemInFolder: (path: string) => void;

  // Persistence API
  loadAppConfig: () => Promise<AppConfig | null>;
  saveAppConfig: (config: AppConfig) => Promise<void>;
  loadAppState: () => Promise<AppStatePayload | null>;
  saveAppState: (payload: AppStatePayload) => Promise<void>;
  loadSession: (id: string) => Promise<WorkspacePayload | null>;
  saveSession: (id: string, payload: WorkspacePayload) => Promise<void>;
  getWorkspaceMetadata: () => Promise<WorkspaceMetadata[]>;
  renameWorkspace: (id: string, newName: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;

  // Auto-Updater
  onUpdateStatus: (callback: (status: 'update-available' | 'update-downloaded') => void) => () => void;
  onUpdateProgress: (callback: (percent: number) => void) => () => void;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;

  // Event Listeners
  onFileChange: (callback: (event: 'add' | 'change' | 'unlink', path: string) => void) => () => void;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}