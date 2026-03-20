// src/store/workspaceStore.ts
import { create } from 'zustand';
import type { FileNode } from '../types/ipc';

export interface CompressionRule {
  id: string;
  startLine: number;
  endLine: number;
  type: 'SKIP' | 'GHOST';
  signature: string; // The exact text of the first line skipped (for drift healing)
  lineCount: number; // Total lines skipped
}

interface WorkspaceState {
  rootPaths: string[];
  rawTrees: Record<string, FileNode>; 

  hardBlacklist: string[];
  includes: string[];
  excludes: string[];

  compressions: Record<string, CompressionRule[]>;
  compressionHistory: Record<string, CompressionRule[][]>; 

  maxFilesPerChunk: number;

  activeTab: string | null;
  activeFile: string | null;
  isExportStaging: boolean;
  expandedFolders: Set<string>;

  setMaxFilesPerChunk: (val: number) => void;
  addRootPath: (path: string) => Promise<void>;
  removeRootPath: (path: string) => void;
  setActiveTab: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  setExportStaging: (val: boolean) => void;
  toggleFolderExpansion: (relativePath: string) => void;

  addBlacklistRule: (pattern: string) => void;
  removeBlacklistRule: (pattern: string) => void;
  addExcludeRule: (pattern: string) => void;
  removeExcludeRule: (pattern: string) => void;

  addCompressions: (relativePath: string, rules: Omit<CompressionRule, 'id'>[]) => void;
  removeCompression: (relativePath: string, id: string) => void;
  setCompressions: (relativePath: string, rules: CompressionRule[]) => void; // Used for auto-healing drift
  clearCompressions: (relativePath: string) => void;
  undoLastCompression: (relativePath: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  rootPaths: [],
  rawTrees: {},
  hardBlacklist: ['.git', 'node_modules', '__pycache__', 'dist', 'build', '.next', '.svelte-kit'],
  includes: [],
  excludes: ['.git/', 'node_modules/', '__pycache__/', 'dist/', 'build/'],
  compressions: {},
  compressionHistory: {},
  maxFilesPerChunk: 10,

  activeTab: null,
  activeFile: null,
  isExportStaging: false,
  expandedFolders: new Set<string>(),

  setMaxFilesPerChunk: (val: number) => set({ maxFilesPerChunk: val }),

  addRootPath: async (rootPath: string) => {
    if (get().rootPaths.includes(rootPath)) return;
    const { node, rules } = await window.api.scanDirectory(rootPath, get().hardBlacklist);
    set((state) => ({
      rootPaths: [...state.rootPaths, rootPath],
      rawTrees: { ...state.rawTrees, [rootPath]: node },
      activeTab: rootPath,
      excludes: Array.from(new Set([...state.excludes, ...rules]))
    }));
  },

  removeRootPath: (pathToRemove: string) => {
    set((state) => {
      const newPaths = state.rootPaths.filter(p => p !== pathToRemove);
      const newRawTrees = { ...state.rawTrees };
      delete newRawTrees[pathToRemove];
    
      return {
        rootPaths: newPaths,
        rawTrees: newRawTrees,
        activeTab: state.activeTab === pathToRemove ? (newPaths[0] || null) : state.activeTab
      };
    });
  },

  setActiveTab: (path: string) => set({ activeTab: path }),

  toggleFolderExpansion: (relativePath: string) => {
    set((state) => {
      const newSet = new Set(state.expandedFolders);
      if (newSet.has(relativePath)) newSet.delete(relativePath);
      else newSet.add(relativePath);
      return { expandedFolders: newSet };
    });
  },

  addBlacklistRule: (pattern: string) => set((state) => ({ hardBlacklist: Array.from(new Set([...state.hardBlacklist, pattern])) })),
  removeBlacklistRule: (pattern: string) => set((state) => ({ hardBlacklist: state.hardBlacklist.filter(p => p !== pattern) })),

  addExcludeRule: (pattern: string) => set((state) => ({ excludes: Array.from(new Set([...state.excludes, pattern])) })),
  removeExcludeRule: (pattern: string) => set((state) => ({ excludes: state.excludes.filter((p) => p !== pattern) })),

  setActiveFile: (path: string | null) => set({ activeFile: path, isExportStaging: false }),
  setExportStaging: (val: boolean) => set({ isExportStaging: val }),

  addCompressions: (relativePath, rules) => {
    set((state) => {
      const existing = state.compressions[relativePath] || [];
      const history = state.compressionHistory[relativePath] || [];
      
      const newRules = rules.map(r => ({ ...r, id: Math.random().toString(36).substr(2, 9) }));
      const newState = [...existing, ...newRules];
    
      return {
        compressions: { ...state.compressions, [relativePath]: newState },
        compressionHistory: { ...state.compressionHistory, [relativePath]: [...history, existing] }
      };
    });
  },

  setCompressions: (relativePath, rules) => {
    set((state) => ({ compressions: { ...state.compressions, [relativePath]: rules } }));
  },

  removeCompression: (relativePath, id) => {
    set((state) => {
      const existing = state.compressions[relativePath] || [];
      const history = state.compressionHistory[relativePath] || [];
      return {
        compressions: { ...state.compressions, [relativePath]: existing.filter(c => c.id !== id) },
        compressionHistory: { ...state.compressionHistory, [relativePath]: [...history, existing] }
      };
    });
  },

  clearCompressions: (relativePath) => {
    set((state) => {
      const existing = state.compressions[relativePath] || [];
      if (existing.length === 0) return state;
      const history = state.compressionHistory[relativePath] || [];
      return {
        compressions: { ...state.compressions, [relativePath]: [] },
        compressionHistory: { ...state.compressionHistory, [relativePath]: [...history, existing] }
      };
    });
  },

  undoLastCompression: (relativePath) => {
    set((state) => {
      const history = state.compressionHistory[relativePath] || [];
      if (history.length === 0) return state;
      
      const newHistory = [...history];
      const previousState = newHistory.pop()!;
      return {
        compressions: { ...state.compressions, [relativePath]: previousState },
        compressionHistory: { ...state.compressionHistory, [relativePath]: newHistory }
      };
    });
  }
}));