// src/store/workspaceStore.ts
import { create } from 'zustand';
import type { FileNode, Preset, ExportHistory } from '../types/ipc';
import { useAppStore } from './appStore';
import { useHistoryStore, compressHistoryPayload, decompressHistoryPayload } from './historyStore';

export interface CompressionRule {
  id: string;
  startLine: number;
  endLine: number;
  type: 'SKIP' | 'GHOST';
  signature: string; 
  lineCount: number; 
}

interface WorkspaceState {
  workspaceId: string | null;
  workspaceName: string | null;
  createdAt: string | null;

  stats: {
    totalExports: number;
    ephemeralExports: number;
    fileFrequencies: Record<string, number>;
  };
  paneWidths: { sidebar: number; tree: number };
  gitStatus: Record<string, string>;

  rootPaths: string[];
  rawTrees: Record<string, FileNode>;

  hardBlacklist: string[];
  pendingBlacklist: string[]; 
  includes: string[];
  excludes: string[];
  treeOnly: string[]; 

  activePresetId: string | null;
  presets: Preset[];
  presetSnapshots: Record<string, Preset>;

  compressions: Record<string, CompressionRule[]>;

  maxFilesPerChunk: number;

  activeTab: string | null;
  activeFile: string | null;
  selectedFiles: Set<string>; 
  isExportStaging: boolean;
  expandedFolders: Set<string>;

  // UI States
  isSidebarOpen: boolean;
  isPainting: boolean;
  hideExcluded: boolean;
  hideTreeOnly: boolean;

  isEphemeralBuilding: boolean;
  ephemeralDragPaths: string[] | null;

  isStale: boolean;
  isBuilding: boolean;
  chunkPaths: string[];

  // Scroll Tracking
  targetScrollY: number | null;
  getScrollOffset: (() => number) | null;
  setTargetScrollY: (y: number | null) => void;
  bindScrollGetter: (getter: () => number) => void;

  // Actions
  hydrateWorkspace: (payload: import('../types/ipc').WorkspacePayload) => void;
  setMaxFilesPerChunk: (val: number) => void;
  setPaneWidth: (pane: 'sidebar' | 'tree', width: number) => void;
  incrementStat: (type: 'totalExports' | 'ephemeralExports', files?: string[]) => void;
  fetchGitStatus: () => Promise<void>;

  setExportState: (state: Partial<{ isStale: boolean; isBuilding: boolean; chunkPaths: string[]; isEphemeralBuilding: boolean; ephemeralDragPaths: string[] | null; }>) => void;
  setSidebarOpen: (val: boolean) => void;
  setIsPainting: (val: boolean) => void;
  setHideExcluded: (val: boolean) => void;
  setHideTreeOnly: (val: boolean) => void;

  getPackedPresets: () => Preset[];
  createPreset: (name: string) => void;
  switchPreset: (id: string) => void;
  renamePreset: (id: string, newName: string) => void;
  deletePreset: (id: string) => void;
  revertPreset: () => void;
  addHistoryEntry: (entry: Omit<ExportHistory, 'id'>) => void;

  addRootPath: (path: string, forceRescan?: boolean) => Promise<void>;
  removeRootPath: (path: string) => void;
  reorderRootPaths: (draggedPath: string, targetPath: string) => void;
  setActiveTab: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  setSelectedFiles: (files: Set<string>) => void;
  setExportStaging: (val: boolean) => void;
  toggleFolderExpansion: (relativePath: string) => void;
  setFoldersExpanded: (relativePaths: string[], expanded: boolean) => void;
  expandAllFolders: () => void;
  collapseAllFolders: () => void;

  addBlacklistRule: (pattern: string) => void;
  removeBlacklistRule: (pattern: string) => void;
  addPendingBlacklistRule: (pattern: string) => void;
  removePendingBlacklistRule: (pattern: string) => void;
  commitBlacklist: () => Promise<void>;

  addExcludeRule: (pattern: string) => void;
  removeExcludeRule: (pattern: string) => void;
  addTreeOnlyRule: (pattern: string) => void;
  removeTreeOnlyRule: (pattern: string) => void;

  applyRuleToSelection: (ruleType: 'include' | 'tree-only' | 'exclude') => void;

  addCompressions: (relativePath: string, rules: Omit<CompressionRule, 'id'>[]) => void;
  removeCompression: (relativePath: string, id: string) => void;
  setCompressions: (relativePath: string, rules: CompressionRule[]) => void;
  clearCompressions: (relativePath: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaceId: null,
  workspaceName: null,
  createdAt: null,

  stats: { totalExports: 0, ephemeralExports: 0, fileFrequencies: {} },
  paneWidths: { sidebar: 320, tree: 400 },
  gitStatus: {},

  rootPaths: [],
  rawTrees: {},
  hardBlacklist: [
    '.git', 'node_modules', '__pycache__', 'dist', 'build', '.next', '.svelte-kit',
    '.obsidian', 'Library', 'Intermediate', 'Saved', 'Pods', '.idea', '.vscode'
  ],
  pendingBlacklist: [],
  includes: [],
  excludes: ['.git/', 'node_modules/', '__pycache__/', 'dist/', 'build/'],
  treeOnly: [],

  activePresetId: null,
  presets: [],
  presetSnapshots: {},

  compressions: {},
  maxFilesPerChunk: 100000,

  activeTab: null,
  activeFile: null,
  selectedFiles: new Set<string>(),
  isExportStaging: false,
  expandedFolders: new Set<string>(),

  isSidebarOpen: false,
  isPainting: false,
  hideExcluded: true,
  hideTreeOnly: true,

  isEphemeralBuilding: false,
  ephemeralDragPaths: null,

  isStale: true,
  isBuilding: false,
  chunkPaths: [],

  targetScrollY: null,
  getScrollOffset: null,

  setTargetScrollY: (y) => set({ targetScrollY: y }),
  bindScrollGetter: (getter) => set({ getScrollOffset: getter }),

  hydrateWorkspace: (payload) => set(() => {
    let activePresetId = payload.activePresetId;
    let presets = payload.presets || [];
    
    // Migration for v2.0 Payloads
    if (payload.version !== "3.0" || !presets.length) {
      const legacyRules = payload.rules as unknown as { inclusions?: string[]; exclusions?: string[]; treeOnly?: string[] };
      const legacyPayload = payload as unknown as { compressions?: Record<string, import('../types/ipc').CompressionRuleIPC[]> };
    
      const defaultPreset: import('../types/ipc').Preset = {
        id: 'default-' + Date.now(),
        name: 'Default Context',
        inclusions: legacyRules.inclusions || [],
        exclusions: legacyRules.exclusions || ['.git/', 'node_modules/', '__pycache__/', 'dist/', 'build/'],
        treeOnly: legacyRules.treeOnly || [],
        compressions: legacyPayload.compressions || {},
        history: []
      };
      presets = [defaultPreset];
      activePresetId = defaultPreset.id;
    }
    
    const activePreset = presets.find(p => p.id === activePresetId) || presets[0];
    
    // AppStore Integration: Pull existing session snapshots or generate new ones
    let snapshots = useAppStore.getState().workspaceSnapshots[payload.id];
    if (!snapshots) {
      snapshots = presets.reduce((acc, p) => ({ ...acc, [p.id]: JSON.parse(JSON.stringify(p)) }), {});
      useAppStore.getState().setWorkspaceSnapshots(payload.id, snapshots);
    }
    
    return {
      workspaceId: payload.id,
      workspaceName: payload.metadata.name,
      createdAt: payload.metadata.createdAt,
      stats: payload.metadata.stats || { totalExports: 0, ephemeralExports: 0, fileFrequencies: {} },
      paneWidths: payload.uiState.paneWidths || { sidebar: 320, tree: 400 },
      gitStatus: {},
      rootPaths: [], 
      rawTrees: {},
      hardBlacklist: payload.rules.hardBlacklist,
      pendingBlacklist: [],
      
      activePresetId: activePreset.id,
      presets,
      presetSnapshots: snapshots,
    
      includes: activePreset.inclusions,
      excludes: activePreset.exclusions,
      treeOnly: activePreset.treeOnly,
      compressions: activePreset.compressions,

      maxFilesPerChunk: payload.settings.maxFilesPerChunk,
      activeTab: payload.uiState.activeTab,
      expandedFolders: new Set(payload.uiState.expandedFolders),
      hideExcluded: payload.uiState.hideExcluded ?? true,
      hideTreeOnly: payload.uiState.hideTreeOnly ?? true,
      selectedFiles: new Set(),
      isSidebarOpen: false, 
      isPainting: false,
      isEphemeralBuilding: false,
      ephemeralDragPaths: null,
      activeFile: null,
      isExportStaging: false,
      isStale: true,
      isBuilding: false,
      chunkPaths: []
    };
  }),

  setMaxFilesPerChunk: (val: number) => set({ maxFilesPerChunk: val }),
  setPaneWidth: (pane, width) => set(state => ({ paneWidths: { ...state.paneWidths, [pane]: width } })),

  incrementStat: (type, files = []) => set(state => {
    const newStats = { ...state.stats, fileFrequencies: { ...state.stats.fileFrequencies } };
    if (type === 'totalExports') newStats.totalExports++;
    if (type === 'ephemeralExports') newStats.ephemeralExports++;
    files.forEach(f => {
      newStats.fileFrequencies[f] = (newStats.fileFrequencies[f] || 0) + 1;
    });
    return { stats: newStats };
  }),

  fetchGitStatus: async () => {
    const state = get();
    if (!state.activeTab) return;
    try {
      const status = await window.api.getGitStatus(state.activeTab);
      set({ gitStatus: status });
    } catch (e) {
      console.error('Failed to fetch git status:', e);
    }
  },

  setExportState: (newState) => set((state) => ({ ...state, ...newState })),
  setSidebarOpen: (val: boolean) => set({ isSidebarOpen: val }),
  setHideExcluded: (val: boolean) => set({ hideExcluded: val }),
  setHideTreeOnly: (val: boolean) => set({ hideTreeOnly: val }),

  getPackedPresets: () => {
    const state = get();
    return state.presets.map(p => {
      if (p.id === state.activePresetId) {
        return {
          ...p,
          inclusions: state.includes,
          exclusions: state.excludes,
          treeOnly: state.treeOnly,
          compressions: state.compressions
        };
      }
      return p;
    });
  },

  createPreset: (name: string) => {
    const prevState = {
      presets: get().presets,
      snapshots: get().presetSnapshots,
      activeId: get().activePresetId,
      includes: get().includes,
      excludes: get().excludes,
      treeOnly: get().treeOnly,
      compressions: get().compressions
    };
    
    set(state => {
      const newPreset: Preset = {
        id: 'preset-' + Date.now() + Math.random().toString(36).substring(2, 7),
        name,
        inclusions: [],
        exclusions: ['.git/', 'node_modules/', '__pycache__/', 'dist/', 'build/'],
        treeOnly: [],
        compressions: {},
        history: []
      };
      
      const packedPresets = state.getPackedPresets();
      packedPresets.push(newPreset);
      
      const newSnapshots = { ...state.presetSnapshots, [newPreset.id]: JSON.parse(JSON.stringify(newPreset)) };
      useAppStore.getState().setWorkspaceSnapshots(state.workspaceId!, newSnapshots);
      
      return {
        activePresetId: newPreset.id,
        presets: packedPresets,
        presetSnapshots: newSnapshots,
        includes: newPreset.inclusions,
        excludes: newPreset.exclusions,
        treeOnly: newPreset.treeOnly,
        compressions: newPreset.compressions,
        isStale: true
      };
    });
    
    const nextState = {
      presets: get().presets,
      snapshots: get().presetSnapshots,
      activeId: get().activePresetId,
      includes: get().includes,
      excludes: get().excludes,
      treeOnly: get().treeOnly,
      compressions: get().compressions
    };
    
    useHistoryStore.getState().push(`Create Preset '${name}'`, 
      () => set({ ...prevState, activePresetId: prevState.activeId, presetSnapshots: prevState.snapshots, isStale: true }),
      () => set({ ...nextState, activePresetId: nextState.activeId, presetSnapshots: nextState.snapshots, isStale: true })
    );
  },

  switchPreset: (id: string) => set(state => {
    if (id === state.activePresetId) return state;
    
    const packedPresets = state.getPackedPresets();
    const target = packedPresets.find(p => p.id === id);
    if (!target) return state;
    
    return {
      activePresetId: id,
      presets: packedPresets,
      includes: target.inclusions,
      excludes: target.exclusions,
      treeOnly: target.treeOnly,
      compressions: target.compressions,
      compressionHistory: {},
      isStale: true
    };
  }),

  renamePreset: (id: string, newName: string) => set(state => {
    const updatedPresets = state.presets.map(p => p.id === id ? { ...p, name: newName } : p);
    return { presets: updatedPresets };
  }),

  deletePreset: (id: string) => {
    const prevPresets = get().presets;
    const prevSnapshots = get().presetSnapshots;
    const prevActiveId = get().activePresetId;
    const prevIncludes = get().includes;
    const prevExcludes = get().excludes;
    const prevTreeOnly = get().treeOnly;
    const prevCompressions = get().compressions;
    
    set(state => {
      const newPresets = state.presets.filter(p => p.id !== id);
      if (newPresets.length === 0) return state; 
      
      const newSnapshots = { ...state.presetSnapshots };
      delete newSnapshots[id];
      useAppStore.getState().deleteWorkspaceSnapshot(state.workspaceId!, id);
      
      let newState: Partial<WorkspaceState> = {
        presets: newPresets,
        presetSnapshots: newSnapshots
      };
      
      if (id === state.activePresetId) {
        const fallback = newPresets[0];
        newState = {
          ...newState,
          activePresetId: fallback.id,
          includes: fallback.inclusions,
          excludes: fallback.exclusions,
          treeOnly: fallback.treeOnly,
          compressions: fallback.compressions,
          isStale: true
        };
      }
      return newState;
    });
    
    const nextPresets = get().presets;
    const nextSnapshots = get().presetSnapshots;
    const nextActiveId = get().activePresetId;
    
    useHistoryStore.getState().push(`Delete Preset`, 
      () => set({ presets: prevPresets, presetSnapshots: prevSnapshots, activePresetId: prevActiveId, includes: prevIncludes, excludes: prevExcludes, treeOnly: prevTreeOnly, compressions: prevCompressions, isStale: true }),
      () => set({ presets: nextPresets, presetSnapshots: nextSnapshots, activePresetId: nextActiveId, isStale: true })
    );
  },

  revertPreset: () => set(state => {
    if (!state.activePresetId) return state;
    const snapshot = state.presetSnapshots[state.activePresetId];
    if (!snapshot) return state;
    
    const revertedPresets = state.presets.map(p => 
      p.id === state.activePresetId ? JSON.parse(JSON.stringify(snapshot)) : p
    );
    
    return {
      presets: revertedPresets,
      includes: snapshot.inclusions,
      excludes: snapshot.exclusions,
      treeOnly: snapshot.treeOnly,
      compressions: snapshot.compressions,
      compressionHistory: {},
      isStale: true
    };
  }),

  addHistoryEntry: (entry) => set(state => {
    if (!state.activePresetId) return state;
    const newEntry = { ...entry, id: crypto.randomUUID() };
    
    const updatedPresets = state.presets.map(p => 
      p.id === state.activePresetId 
        ? { ...p, history: [newEntry, ...p.history] }
        : p
    );
    
    return { presets: updatedPresets };
  }),

  addRootPath: async (rootPath: string, forceRescan = false) => {
    if (!forceRescan && get().rootPaths.includes(rootPath)) return;
    
    const { node, rules, treeOnly } = await window.api.scanDirectory(rootPath, get().hardBlacklist);
    
    set((state) => ({
      rootPaths: Array.from(new Set([...state.rootPaths, rootPath])),
      rawTrees: { ...state.rawTrees, [rootPath]: node },
      activeTab: state.activeTab || rootPath,
      excludes: Array.from(new Set([...state.excludes, ...rules])),
      treeOnly: Array.from(new Set([...state.treeOnly, ...(treeOnly || [])]))
    }));
    
    if (!forceRescan) {
      useHistoryStore.getState().push(`Add Root '${rootPath.split(/[/\\]/).pop()}'`, 
        () => get().removeRootPath(rootPath),
        () => get().addRootPath(rootPath, true)
      );
    }
  },

  removeRootPath: (pathToRemove: string) => {
    const prevRoots = get().rootPaths;
    const prevTrees = { ...get().rawTrees };
    const prevActiveTab = get().activeTab;
    
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
        
    useHistoryStore.getState().push(`Remove Root '${pathToRemove.split(/[/\\]/).pop()}'`, 
      () => set({ rootPaths: prevRoots, rawTrees: prevTrees, activeTab: prevActiveTab }),
      () => get().removeRootPath(pathToRemove)
    );
  },

  reorderRootPaths: (draggedPath, targetPath) => {
    const prevRoots = get().rootPaths;
    set(state => {
      const draggedIndex = state.rootPaths.indexOf(draggedPath);
      const targetIndex = state.rootPaths.indexOf(targetPath);
      if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return state;
      
      const newPaths = [...state.rootPaths];
      const [draggedItem] = newPaths.splice(draggedIndex, 1);
      newPaths.splice(targetIndex, 0, draggedItem);
      
      return { rootPaths: newPaths };
    });
    const nextRoots = get().rootPaths;
    useHistoryStore.getState().push(`Reorder Roots`, 
      () => set({ rootPaths: prevRoots }),
      () => set({ rootPaths: nextRoots })
    );
  },

  setActiveTab: (path: string) => set({ activeTab: path }),

  toggleFolderExpansion: (relativePath: string) => {
    const prevSet = new Set(get().expandedFolders);
    set((state) => {
      const newSet = new Set(state.expandedFolders);
      if (newSet.has(relativePath)) newSet.delete(relativePath);
      else newSet.add(relativePath);
      return { expandedFolders: newSet };
    });
    const nextSet = new Set(get().expandedFolders);
    
    useHistoryStore.getState().push(
      `${prevSet.has(relativePath) ? 'Collapse' : 'Expand'} Folder`, 
      () => set({ expandedFolders: prevSet }),
      () => set({ expandedFolders: nextSet })
    );
  },

  setFoldersExpanded: (paths: string[], expanded: boolean) => set(state => {
    const newSet = new Set(state.expandedFolders);
    paths.forEach(p => expanded ? newSet.add(p) : newSet.delete(p));
    return { expandedFolders: newSet };
  }),

  expandAllFolders: () => {
    const prevCompressed = compressHistoryPayload(Array.from(get().expandedFolders));
    set(state => {
      if (!state.activeTab) return state;
      const tree = state.rawTrees[state.activeTab];
      if (!tree) return state;
      
      const newExpanded = new Set(state.expandedFolders);
      const traverse = (node: import('../types/ipc').FileNode, currentRelative: string) => {
        if (node.type === 'directory') {
          if (currentRelative) newExpanded.add(currentRelative);
          if (node.children) {
            node.children.forEach(c => {
              const childRel = currentRelative ? `${currentRelative}/${c.name}` : c.name;
              traverse(c, childRel);
            });
          }
        }
      };
      
      traverse(tree, '');
      return { expandedFolders: newExpanded };
    });
    
    const nextCompressed = compressHistoryPayload(Array.from(get().expandedFolders));
    useHistoryStore.getState().push('Expand All Folders', 
      () => set({ expandedFolders: new Set(decompressHistoryPayload<string[]>(prevCompressed)) }),
      () => set({ expandedFolders: new Set(decompressHistoryPayload<string[]>(nextCompressed)) })
    );
  },

  collapseAllFolders: () => {
    const prevCompressed = compressHistoryPayload(Array.from(get().expandedFolders));
    set({ expandedFolders: new Set() });
    
    useHistoryStore.getState().push('Collapse All Folders', 
      () => set({ expandedFolders: new Set(decompressHistoryPayload<string[]>(prevCompressed)) }),
      () => set({ expandedFolders: new Set() })
    );
  },

  setIsPainting: (val: boolean) => set({ isPainting: val }),

  addBlacklistRule: (pattern: string) => set((state) => ({ hardBlacklist: Array.from(new Set([...state.hardBlacklist, pattern])) })),
  removeBlacklistRule: (pattern: string) => set((state) => ({ hardBlacklist: state.hardBlacklist.filter(p => p !== pattern) })),

  addPendingBlacklistRule: (pattern: string) => set((state) => ({ pendingBlacklist: Array.from(new Set([...state.pendingBlacklist, pattern])) })),
  removePendingBlacklistRule: (pattern: string) => set((state) => ({ pendingBlacklist: state.pendingBlacklist.filter(p => p !== pattern) })),

  commitBlacklist: async () => {
    const state = get();
    if (state.pendingBlacklist.length === 0) return;
    
    const merged = Array.from(new Set([...state.hardBlacklist, ...state.pendingBlacklist]));
    set({ hardBlacklist: merged, pendingBlacklist: [], isStale: true });
    
    for (const root of state.rootPaths) {
      await get().addRootPath(root, true);
    }
  },

  addExcludeRule: (pattern: string) => set((state) => ({ excludes: Array.from(new Set([...state.excludes, pattern])) })),
  removeExcludeRule: (pattern: string) => set((state) => ({ excludes: state.excludes.filter((p) => p !== pattern) })),

  addTreeOnlyRule: (pattern: string) => set((state) => ({ treeOnly: Array.from(new Set([...state.treeOnly, pattern])) })),
  removeTreeOnlyRule: (pattern: string) => set((state) => ({ treeOnly: state.treeOnly.filter((p) => p !== pattern) })),

  applyRuleToSelection: (ruleType) => {
    const prevExcludes = compressHistoryPayload(get().excludes);
    const prevTreeOnly = compressHistoryPayload(get().treeOnly);
    
    set(state => {
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
    });
    
    const nextExcludes = compressHistoryPayload(get().excludes);
    const nextTreeOnly = compressHistoryPayload(get().treeOnly);
    
    const labels = { 'include': 'Included', 'tree-only': 'Tree-Only', 'exclude': 'Excluded' };
    useHistoryStore.getState().push(`Marked ${labels[ruleType]}`, 
      () => set({ excludes: decompressHistoryPayload<string[]>(prevExcludes), treeOnly: decompressHistoryPayload<string[]>(prevTreeOnly), isStale: true }),
      () => set({ excludes: decompressHistoryPayload<string[]>(nextExcludes), treeOnly: decompressHistoryPayload<string[]>(nextTreeOnly), isStale: true })
    );
  },

  setActiveFile: (path: string | null) => set({ activeFile: path, isExportStaging: false }),
  setSelectedFiles: (files: Set<string>) => set({ selectedFiles: files, ephemeralDragPaths: null }),
  setExportStaging: (val: boolean) => set({ isExportStaging: val }),

  addCompressions: (relativePath, rules) => {
    const prevComp = get().compressions[relativePath] || [];
    set((state) => {
      const existing = state.compressions[relativePath] || [];
      const newRules = rules.map(r => ({ ...r, id: Math.random().toString(36).substr(2, 9) }));
      return {
        compressions: { ...state.compressions, [relativePath]: [...existing, ...newRules] },
        isStale: true
      };
    });
    const nextComp = get().compressions[relativePath] || [];
    useHistoryStore.getState().push(`Skip Block`, 
      () => set(s => ({ compressions: { ...s.compressions, [relativePath]: prevComp }, isStale: true })),
      () => set(s => ({ compressions: { ...s.compressions, [relativePath]: nextComp }, isStale: true }))
    );
  },

  setCompressions: (relativePath, rules) => set(state => ({ compressions: { ...state.compressions, [relativePath]: rules }, isStale: true })),

  removeCompression: (relativePath, id) => {
    const prevComp = get().compressions[relativePath] || [];
    set((state) => {
      const existing = state.compressions[relativePath] || [];
      return {
        compressions: { ...state.compressions, [relativePath]: existing.filter(c => c.id !== id) },
        isStale: true
      };
    });
    const nextComp = get().compressions[relativePath] || [];
    useHistoryStore.getState().push(`Un-Skip Block`, 
      () => set(s => ({ compressions: { ...s.compressions, [relativePath]: prevComp }, isStale: true })),
      () => set(s => ({ compressions: { ...s.compressions, [relativePath]: nextComp }, isStale: true }))
    );
  },

  clearCompressions: (relativePath) => {
    const prevComp = get().compressions[relativePath] || [];
    set((state) => {
      const existing = state.compressions[relativePath] || [];
      if (existing.length === 0) return state;
      return {
        compressions: { ...state.compressions, [relativePath]: [] },
        isStale: true
      };
    });
    useHistoryStore.getState().push(`Clear Skips`, 
      () => set(s => ({ compressions: { ...s.compressions, [relativePath]: prevComp }, isStale: true })),
      () => set(s => ({ compressions: { ...s.compressions, [relativePath]: [] }, isStale: true }))
    );
  }
}));