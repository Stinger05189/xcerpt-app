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
  rules: string[]; // Aggregated .gitignore rules
}

export interface ElectronAPI {
  ping: () => Promise<string>;
  selectDirectory: () => Promise<string | null>;
  scanDirectory: (path: string) => Promise<ScanResult>;
  readFile: (path: string) => Promise<string>;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}