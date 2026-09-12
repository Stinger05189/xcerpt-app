// src/types/ipc.d.ts
export type ScopedPathKey = `${string}::${string}`;
export type StagingStatus = 'VIRTUAL_READY' | 'STAGING_LOCK' | 'DISK_READY';

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
  isMissing?: boolean;
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
  trueSize?: number;
  tokens?: number;
  rootPath?: string;
}

export interface ExportChunk {
  id: number;
  files: ExportFile[];
}

export interface ExportPayload {
  chunks: ExportChunk[];
  treeMarkdown: string;
  manifestFileName?: string;
  metrics?: { excluded: number; treeOnly: number; size: number; tokens: number; trueSize?: number; };
  mergeToSingleFile?: boolean;
  embedProtocol?: boolean;
  isWhitelistMode?: boolean;
}

export interface EphemeralPayload {
  files: ExportFile[];
  treeMarkdown: string;
  manifestFileName?: string;
  mergeToSingleFile?: boolean;
  embedProtocol?: boolean;
}

export interface VirtualPayloadNode {
  id: string;
  rootPath: string;
  relativePath: string;
  scopedKey: ScopedPathKey;
  name: string;
  isDirectory: boolean;
  size: number;
  trueSize: number;
  tokens: number;
  status: 'included' | 'excluded' | 'tree-only';
  skipCount: number;
  skippedLines: number;
  includedFilesCount: number;
  totalFilesCount: number;
  children?: VirtualPayloadNode[];
}

export interface VirtualPayloadGraph {
  nodes: VirtualPayloadNode[];
  manifestFileName: string;
  treeMarkdown: string;
  totalFiles: number;
  totalSize: number;
  totalTrueSize: number;
  totalTokens: number;
  savedBytes: number;
  savedTokens: number;
  chunks: ExportChunk[];
}

export interface EditorTab {
  id: string;
  rootPath: string;
  relativePath: string;
  isPinned: boolean;
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
  openWorkspaceIds?: string[];
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
  inclusions: ScopedPathKey[] | string[];
  exclusions: ScopedPathKey[] | string[];
  treeOnly: ScopedPathKey[] | string[];
  compressions: Record<ScopedPathKey | string, CompressionRuleIPC[]>;
  history: ExportHistory[];
  isWhitelistMode?: boolean;
}

export interface WorkspacePayload {
  id: string;
  version: string;
  metadata: WorkspaceMetadata;
  settings: {
    maxFilesPerChunk: number;
    mergeToSingleFile?: boolean;
    respectGitignore?: boolean;
    embedProtocol?: boolean;
    isWhitelistMode?: boolean;
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
    hideExcluded?: boolean;
    hideTreeOnly?: boolean;
    openEditorTabs?: EditorTab[];
    activeEditorTabId?: string | null;
  };
}

export interface ElectronAPI {
  ping: () => Promise<string>;
  selectDirectory: () => Promise<string | null>;
  scanDirectory: (path: string, blacklist: string[], respectGitignore?: boolean) => Promise<ScanResult>;
  readFile: (path: string) => Promise<string>;
  readImageBase64: (path: string) => Promise<string>;
  calculateTokens: (filePaths: string[]) => Promise<number>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  setZoomFactor: (factor: number) => void;

  getVersion: () => Promise<string>;
  getGitStatus: (targetPath: string) => Promise<Record<string, string>>;

  stageExport: (payload: ExportPayload) => Promise<string[]>;
  stageEphemeralExport: (payload: EphemeralPayload) => Promise<string[]>;
  startDrag: (filePaths: string[]) => void;
  openPath: (path: string) => Promise<string>;
  openExternal: (url: string) => Promise<void>;
  showItemInFolder: (path: string) => void;

  loadAppConfig: () => Promise<AppConfig | null>;
  saveAppConfig: (config: AppConfig) => Promise<void>;
  loadAppState: () => Promise<AppStatePayload | null>;
  saveAppState: (payload: AppStatePayload) => Promise<void>;
  loadSession: (id: string) => Promise<WorkspacePayload | null>;
  saveSession: (id: string, payload: WorkspacePayload) => Promise<void>;
  getWorkspaceMetadata: () => Promise<WorkspaceMetadata[]>;
  renameWorkspace: (id: string, newName: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;

  onUpdateStatus: (callback: (status: 'update-available' | 'update-downloaded') => void) => () => void;
  onUpdateProgress: (callback: (percent: number) => void) => () => void;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;

  onFileChange: (callback: (event: 'add' | 'change' | 'unlink', path: string) => void) => () => void;
  saveWorkspace: (data: unknown) => void;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}