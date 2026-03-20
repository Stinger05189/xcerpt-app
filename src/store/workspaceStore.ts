// src/store/workspaceStore.ts
import { create } from 'zustand';
import type { FileNode } from '../types/ipc';

interface WorkspaceState {
  // Data
  rootPaths: string[];
  rawTrees: Record<string, FileNode>; // Map of rootPath to its scanned tree
  
  // Rules
  includes: string[];
  excludes: string[];
  
  // UI State (Using stable relative paths)
  activeTab: string | null;
  expandedFolders: Set<string>;
  
  // Actions
  addRootPath: (path: string) => Promise<void>;
  setActiveTab: (path: string) => void;
  toggleFolderExpansion: (relativePath: string) => void;
  addExcludeRule: (pattern: string) => void;
  removeExcludeRule: (pattern: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  rootPaths: [],
  rawTrees: {},
  includes: [],
  excludes: ['.git/', 'node_modules/', '__pycache__/', 'dist/', 'build/'], // Sensible defaults
  activeTab: null,
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
  }
}));