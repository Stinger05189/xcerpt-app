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
  treeOnly: string[]; // Patterns matching files shown in tree but skipped during physical export

  compressions: Record<string, CompressionRule[]>;
  compressionHistory: Record<string, CompressionRule[][]>;

  maxFilesPerChunk: number;

  activeTab: string | null;
  activeFile: string | null;
  selectedFiles: Set<string>; // For multi-select and paint actions
  isExportStaging: boolean;
  expandedFolders: Set<string>;

  // Paint Selection State
  isPainting: boolean;
  paintMode: 'add' | 'remove' | null;

  // Export State
  isStale: boolean;
  isBuilding: boolean;
  chunkPaths: string[];

  // Actions
  setMaxFilesPerChunk: (val: number) => void;
  setExportState: (state: Partial<{ isStale: boolean; isBuilding: boolean; chunkPaths: string[] }>) => void;

  addRootPath: (path: string) => Promise<void>;
  removeRootPath: (path: string) => void;
  setActiveTab: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  setSelectedFiles: (files: Set<string>) => void;
  setExportStaging: (val: boolean) => void;
  toggleFolderExpansion: (relativePath: string) => void;

  // Paint Handlers
  startPainting: (pattern: string, mode: 'add' | 'remove') => void;
  continuePainting: (pattern: string) => void;
  stopPainting: () => void;

  // Rule Management
  addBlacklistRule: (pattern: string) => void;
  removeBlacklistRule: (pattern: string) => void;
  addExcludeRule: (pattern: string) => void;
  removeExcludeRule: (pattern: string) => void;
  addTreeOnlyRule: (pattern: string) => void;
  removeTreeOnlyRule: (pattern: string) => void;
  
  // Bulk Rule Updater (High Performance)
  applyRuleToSelection: (ruleType: 'include' | 'tree-only' | 'exclude') => void;

  // Compression Management
  addCompressions: (relativePath: string, rules: Omit<CompressionRule, 'id'>[]) => void;
  removeCompression: (relativePath: string, id: string) => void;
  setCompressions: (relativePath: string, rules: CompressionRule[]) => void;
  clearCompressions: (relativePath: string) => void;
  undoLastCompression: (relativePath: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  rootPaths: [],
  rawTrees: {},
  hardBlacklist: ['.git', 'node_modules', '__pycache__', 'dist', 'build', '.next', '.svelte-kit'],
  includes: [],
  excludes: ['.git/', 'node_modules/', '__pycache__/', 'dist/', 'build/'],
  treeOnly: [],
  compressions: {},
  compressionHistory: {},
  maxFilesPerChunk: 100000,

  activeTab: null,
  activeFile: null,
  selectedFiles: new Set<string>(),
  isExportStaging: false,
  expandedFolders: new Set<string>(),

  isPainting: false,
  paintMode: null,

  isStale: true,
  isBuilding: false,
  chunkPaths: [],

  setMaxFilesPerChunk: (val: number) => set({ maxFilesPerChunk: val }),
  
  setExportState: (newState) => set((state) => ({ ...state, ...newState })),

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

  // --- Paint Handlers ---
  startPainting: (pattern, mode) => set(state => {
    const newSet = new Set(state.selectedFiles);
    if (mode === 'add') {
      newSet.add(pattern);
    } else {
      newSet.delete(pattern);
    }
    return { isPainting: true, paintMode: mode, selectedFiles: newSet };
  }),
  
  continuePainting: (pattern) => set(state => {
    if (!state.isPainting || !state.paintMode) return state;
    const newSet = new Set(state.selectedFiles);
    if (state.paintMode === 'add') {
      newSet.add(pattern);
    } else {
      newSet.delete(pattern);
    }
    return { selectedFiles: newSet };
  }),

  stopPainting: () => set({ isPainting: false, paintMode: null }),

  // --- Rule Management ---
  addBlacklistRule: (pattern: string) => set((state) => ({ hardBlacklist: Array.from(new Set([...state.hardBlacklist, pattern])) })),
  removeBlacklistRule: (pattern: string) => set((state) => ({ hardBlacklist: state.hardBlacklist.filter(p => p !== pattern) })),

  addExcludeRule: (pattern: string) => set((state) => ({ excludes: Array.from(new Set([...state.excludes, pattern])) })),
  removeExcludeRule: (pattern: string) => set((state) => ({ excludes: state.excludes.filter((p) => p !== pattern) })),

  addTreeOnlyRule: (pattern: string) => set((state) => ({ treeOnly: Array.from(new Set([...state.treeOnly, pattern])) })),
  removeTreeOnlyRule: (pattern: string) => set((state) => ({ treeOnly: state.treeOnly.filter((p) => p !== pattern) })),

  // --- Bulk Updater ---
  applyRuleToSelection: (ruleType) => set(state => {
    if (state.selectedFiles.size === 0) return state;
    
    const newExcludes = new Set(state.excludes);
    const newTreeOnly = new Set(state.treeOnly);

    state.selectedFiles.forEach(path => {
      if (ruleType === 'include') {
        newExcludes.delete(path);
        newTreeOnly.delete(path);
      } else if (ruleType === 'tree-only') {
        newExcludes.delete(path);
        newTreeOnly.add(path);
      } else if (ruleType === 'exclude') {
        newTreeOnly.delete(path);
        newExcludes.add(path);
      }
    });

    return {
      excludes: Array.from(newExcludes),
      treeOnly: Array.from(newTreeOnly),
      isStale: true 
    };
  }),

  setActiveFile: (path: string | null) => set({ activeFile: path, isExportStaging: false }),
  setSelectedFiles: (files: Set<string>) => set({ selectedFiles: files }),
  setExportStaging: (val: boolean) => set({ isExportStaging: val }),

  // --- Compression Management ---
  addCompressions: (relativePath, rules) => {
    set((state) => {
      const existing = state.compressions[relativePath] || [];
      const history = state.compressionHistory[relativePath] || [];
      
      const newRules = rules.map(r => ({ ...r, id: Math.random().toString(36).substr(2, 9) }));
      const newState = [...existing, ...newRules];
    
      return {
        compressions: { ...state.compressions, [relativePath]: newState },
        compressionHistory: { ...state.compressionHistory, [relativePath]: [...history, existing] },
        isStale: true
      };
    });
  },

  setCompressions: (relativePath, rules) => {
    set((state) => ({ 
      compressions: { ...state.compressions, [relativePath]: rules },
      isStale: true 
    }));
  },

  removeCompression: (relativePath, id) => {
    set((state) => {
      const existing = state.compressions[relativePath] || [];
      const history = state.compressionHistory[relativePath] || [];
      return {
        compressions: { ...state.compressions, [relativePath]: existing.filter(c => c.id !== id) },
        compressionHistory: { ...state.compressionHistory, [relativePath]: [...history, existing] },
        isStale: true
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
        compressionHistory: { ...state.compressionHistory, [relativePath]: [...history, existing] },
        isStale: true
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
        compressionHistory: { ...state.compressionHistory, [relativePath]: newHistory },
        isStale: true
      };
    });
  }
}));