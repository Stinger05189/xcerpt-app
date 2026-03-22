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

  // Event Listeners
  onFileChange: (callback: (event: 'add' | 'change' | 'unlink', path: string) => void) => () => void;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}