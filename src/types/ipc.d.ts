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

export interface ElectronAPI {
  ping: () => Promise<string>;
  selectDirectory: () => Promise<string | null>;
  scanDirectory: (path: string, blacklist: string[]) => Promise<ScanResult>;
  readFile: (path: string) => Promise<string>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}