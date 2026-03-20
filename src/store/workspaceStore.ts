// src/store/workspaceStore.ts
import { create } from 'zustand';
import type { FileNode } from '../types/ipc';

export interface CompressionRule {
  id: string;
  startLine: number;
  endLine: number;
  type: 'SKIP' | 'GHOST';
}

interface WorkspaceState {
  // Data
  rootPaths: string[];
  rawTrees: Record<string, FileNode>; 

  // Rules
  includes: string[];
  excludes: string[];

  // Compressions Map: Record<RelativePath, CompressionRule[]>
  compressions: Record<string, CompressionRule[]>;

  // UI State
  activeTab: string | null;
  activeFile: string | null; // The relative path of the selected file
  isExportStaging: boolean;  // Toggles right pane between Editor and Export Preview
  expandedFolders: Set<string>;

  // Actions
  addRootPath: (path: string) => Promise<void>;
  setActiveTab: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  setExportStaging: (val: boolean) => void;
  toggleFolderExpansion: (relativePath: string) => void;
  addExcludeRule: (pattern: string) => void;
  removeExcludeRule: (pattern: string) => void;
  addCompression: (relativePath: string, rule: Omit<CompressionRule, 'id'>) => void;
  removeCompression: (relativePath: string, id: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  rootPaths: [],
  rawTrees: {},
  includes: [],
  excludes: ['.git/', 'node_modules/', '__pycache__/', 'dist/', 'build/'],
  compressions: {},
  activeTab: null,
  activeFile: null,
  isExportStaging: false,
  expandedFolders: new Set<string>(),

  addRootPath: async (rootPath: string) => {
    // Prevent duplicates
    if (get().rootPaths.includes(rootPath)) return;

    // Scan the directory via IPC
    const { node, rules } = await window.api.scanDirectory(rootPath);

    set((state) => ({
      rootPaths: [...state.rootPaths, rootPath],
      rawTrees: { ...state.rawTrees, [rootPath]: node },
      activeTab: rootPath,
      // Automatically add discovered .gitignore rules to our exclusions
      excludes: Array.from(new Set([...state.excludes, ...rules]))
    }));
  },

  setActiveTab: (path: string) => set({ activeTab: path }),

  toggleFolderExpansion: (relativePath: string) => {
    set((state) => {
      const newSet = new Set(state.expandedFolders);
      if (newSet.has(relativePath)) {
        newSet.delete(relativePath);
      } else {
        newSet.add(relativePath);
      }
      return { expandedFolders: newSet };
    });
  },

  addExcludeRule: (pattern: string) => {
    set((state) => ({
      excludes: Array.from(new Set([...state.excludes, pattern]))
    }));
  },

  removeExcludeRule: (pattern: string) => {
    set((state) => ({
      excludes: state.excludes.filter((p) => p !== pattern)
    }));
  },

  setActiveFile: (path: string | null) => set({ activeFile: path, isExportStaging: false }),
  setExportStaging: (val: boolean) => set({ isExportStaging: val }),

  addCompression: (relativePath, rule) => {
    const id = Math.random().toString(36).substr(2, 9);
    set((state) => {
      const existing = state.compressions[relativePath] || [];
      return {
        compressions: {
          ...state.compressions,
          [relativePath]: [...existing, { ...rule, id }]
        }
      };
    });
  },

  removeCompression: (relativePath, id) => {
    set((state) => {
      const existing = state.compressions[relativePath] || [];
      return {
        compressions: {
          ...state.compressions,
          [relativePath]: existing.filter(c => c.id !== id)
        }
      };
    });
  }
}));