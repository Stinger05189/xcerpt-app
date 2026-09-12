// src/store/workspaceStore.ts
import { create } from 'zustand';
import type { 
  FileNode, 
  Preset, 
  ExportHistory, 
  StagingStatus, 
  VirtualPayloadGraph, 
  EditorTab 
} from '../types/ipc';
import { useAppStore } from './appStore';
import { toScopedPathKey, isScopedKey, compactRules, ScopedRuleIndex } from '../utils/filterEngine';
import { generateVirtualPayloadGraph, generateExportPayload } from '../utils/exportEngine';

export interface CompressionRule {
  id: string;
  startLine: number;
  endLine: number;
  type: 'SKIP' | 'GHOST';
  signature: string; 
  lineCount: number; 
}

export interface WorkspaceProfileReport {
  timestamp: string;
  rootCount: number;
  totalFilesCount: number;
  ruleCounts: {
    includes: number;
    excludes: number;
    treeOnly: number;
    compressions: number;
  };
  timings: {
    indexBuildMs: number;
    traversalCheckMs: number;
    virtualGraphMs: number;
  };
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
  missingRoots: Set<string>;
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
  mergeToSingleFile: boolean;
  respectGitignore: boolean;
  embedProtocol: boolean;

  // Staging State Machine & Virtual Graph
  stagingStatus: StagingStatus;
  virtualGraph: VirtualPayloadGraph | null;

  activeTab: string | null;
  activeFile: string | null;
  selectedFiles: Set<string>; 
  isExportStaging: boolean;
  expandedFolders: Set<string>;

  // Tab Lifecycle: Transient vs Pinned
  editorTabs: EditorTab[];
  activeEditorTabId: string | null;

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
  setWorkspaceName: (name: string) => void;
  setMaxFilesPerChunk: (val: number) => void;
  setMergeToSingleFile: (val: boolean) => void;
  setRespectGitignore: (val: boolean) => Promise<void>;
  setEmbedProtocol: (val: boolean) => void;
  setPaneWidth: (pane: 'sidebar' | 'tree', width: number) => void;
  incrementStat: (type: 'totalExports' | 'ephemeralExports', files?: string[]) => void;
  fetchGitStatus: () => Promise<void>;

  refreshVirtualGraph: () => void;
  stagePayloadJIT: () => Promise<string[]>;
  profileActiveWorkspace: () => WorkspaceProfileReport;

  setExportState: (state: Partial<{ isStale: boolean; isBuilding: boolean; chunkPaths: string[]; isEphemeralBuilding: boolean; ephemeralDragPaths: string[] | null; }>) => void;
  setSidebarOpen: (val: boolean) => void;
  setIsPainting: (val: boolean) => void;
  setHideExcluded: (val: boolean) => void;
  setHideTreeOnly: (val: boolean) => void;

  // Tab Actions
  openEditorTab: (rootPath: string, relativePath: string, pin?: boolean) => void;
  closeEditorTab: (id: string) => void;
  closeOtherEditorTabs: (id: string) => void;
  closeEditorTabsToTheRight: (id: string) => void;
  closeAllEditorTabs: () => void;
  pinEditorTab: (id: string) => void;

  getPackedPresets: () => Preset[];
  createPreset: (name: string) => void;
  duplicatePreset: (id: string, newName?: string) => void;
  createPresetFromSelection: (name: string) => void;
  switchPreset: (id: string) => void;
  renamePreset: (id: string, newName: string) => void;
  deletePreset: (id: string) => void;
  revertPreset: () => void;
  addHistoryEntry: (entry: Omit<ExportHistory, 'id'>) => void;

  addRootPath: (path: string, forceRescan?: boolean) => Promise<void>;
  removeRootPath: (path: string) => void;
  relocateRootPath: (oldPath: string, newPath: string) => Promise<void>;
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

  applyRuleToSelection: (ruleType: 'include' | 'tree-only' | 'exclude', overrideRoot?: string) => void;
  compactAllRules: () => void;

  addCompressions: (targetKey: string, rules: Omit<CompressionRule, 'id'>[]) => void;
  removeCompression: (targetKey: string, id: string) => void;
  setCompressions: (targetKey: string, rules: CompressionRule[]) => void;
  clearCompressions: (targetKey: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaceId: null,
  workspaceName: null,
  createdAt: null,

  stats: { totalExports: 0, ephemeralExports: 0, fileFrequencies: {} },
  paneWidths: { sidebar: 320, tree: 400 },
  gitStatus: {},

  rootPaths: [],
  missingRoots: new Set<string>(),
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
  mergeToSingleFile: false,
  respectGitignore: true,
  embedProtocol: false,

  stagingStatus: 'VIRTUAL_READY',
  virtualGraph: null,

  activeTab: null,
  activeFile: null,
  selectedFiles: new Set<string>(),
  isExportStaging: false,
  expandedFolders: new Set<string>(),

  editorTabs: [],
  activeEditorTabId: null,

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

  setWorkspaceName: (name: string) => set({ workspaceName: name.trim() || null, isStale: true }),

  refreshVirtualGraph: () => {
    const s = get();
    if (s.rootPaths.length === 0) {
      set({ virtualGraph: null, stagingStatus: 'VIRTUAL_READY' });
      return;
    }
    const extOverrides = useAppStore.getState().config.extensionOverrides;
    const graph = generateVirtualPayloadGraph(
      s.rootPaths,
      s.rawTrees,
      s.includes,
      s.excludes,
      s.treeOnly,
      s.compressions,
      extOverrides,
      s.mergeToSingleFile,
      s.embedProtocol
    );
    set({ virtualGraph: graph, stagingStatus: 'VIRTUAL_READY' });
  },

  profileActiveWorkspace: () => {
    const s = get();
    const t0 = performance.now();
    const index = new ScopedRuleIndex(s.includes, s.excludes, s.treeOnly);
    const tIndex = performance.now() - t0;

    let totalFiles = 0;
    const t1 = performance.now();
    for (const root of s.rootPaths) {
      const tree = s.rawTrees[root];
      if (!tree) continue;
      const walk = (node: FileNode, curRel: string) => {
        totalFiles++;
        index.getStatus(root, curRel, node.type === 'directory');
        if (node.children) {
          for (const c of node.children) {
            walk(c, curRel ? `${curRel}/${c.name}` : c.name);
          }
        }
      };
      walk(tree, '');
    }
    const tWalk = performance.now() - t1;

    const t2 = performance.now();
    const extOverrides = useAppStore.getState().config.extensionOverrides;
    generateVirtualPayloadGraph(
      s.rootPaths,
      s.rawTrees,
      s.includes,
      s.excludes,
      s.treeOnly,
      s.compressions,
      extOverrides,
      s.mergeToSingleFile,
      s.embedProtocol
    );
    const tGraph = performance.now() - t2;

    return {
      timestamp: new Date().toISOString(),
      rootCount: s.rootPaths.length,
      totalFilesCount: totalFiles,
      ruleCounts: {
        includes: s.includes.length,
        excludes: s.excludes.length,
        treeOnly: s.treeOnly.length,
        compressions: Object.keys(s.compressions).length,
      },
      timings: {
        indexBuildMs: Number(tIndex.toFixed(2)),
        traversalCheckMs: Number(tWalk.toFixed(2)),
        virtualGraphMs: Number(tGraph.toFixed(2)),
      }
    };
  },

  stagePayloadJIT: async () => {
    const s = get();
    if (s.rootPaths.length === 0) return [];

    set({ stagingStatus: 'STAGING_LOCK', isBuilding: true });
    try {
      const extOverrides = useAppStore.getState().config.extensionOverrides;
      const payload = generateExportPayload(
        s.rootPaths,
        s.rawTrees,
        s.includes,
        s.excludes,
        s.treeOnly,
        s.compressions,
        s.maxFilesPerChunk,
        extOverrides,
        s.mergeToSingleFile,
        s.embedProtocol
      );

      const stagedPaths = await window.api.stageExport(payload);
      set({
        stagingStatus: 'DISK_READY',
        isBuilding: false,
        chunkPaths: stagedPaths,
        isStale: false
      });
      return stagedPaths;
    } catch (err) {
      console.error('JIT Physical Staging Failed:', err);
      set({ stagingStatus: 'VIRTUAL_READY', isBuilding: false });
      throw err;
    }
  },

  hydrateWorkspace: (payload) => set(() => {
    let activePresetId = payload.activePresetId;
    let presets = payload.presets || [];

    if (!presets.length) {
      const defaultPreset: Preset = {
        id: 'default-' + Date.now(),
        name: 'Default Context',
        inclusions: [],
        exclusions: ['.git/', 'node_modules/', '__pycache__/', 'dist/', 'build/'],
        treeOnly: [],
        compressions: {},
        history: []
      };
      presets = [defaultPreset];
      activePresetId = defaultPreset.id;
    }

    const activePreset = presets.find(p => p.id === activePresetId) || presets[0];

    let snapshots = useAppStore.getState().workspaceSnapshots[payload.id];
    if (!snapshots) {
      snapshots = presets.reduce((acc, p) => ({ ...acc, [p.id]: JSON.parse(JSON.stringify(p)) }), {});
      useAppStore.getState().setWorkspaceSnapshots(payload.id, snapshots);
    }

    const editorTabs: EditorTab[] = payload.uiState.openEditorTabs || [];
    const activeEditorTabId = payload.uiState.activeEditorTabId || (editorTabs[0]?.id ?? null);
    const activeFile = editorTabs.find(t => t.id === activeEditorTabId)?.relativePath || null;

    return {
      workspaceId: payload.id,
      workspaceName: payload.metadata.name,
      createdAt: payload.metadata.createdAt,
      stats: payload.metadata.stats || { totalExports: 0, ephemeralExports: 0, fileFrequencies: {} },
      paneWidths: payload.uiState.paneWidths || { sidebar: 320, tree: 400 },
      gitStatus: {},
      rootPaths: [],
      missingRoots: new Set<string>(),
      rawTrees: {},
      hardBlacklist: payload.rules.hardBlacklist,
      pendingBlacklist: [],

      activePresetId: activePreset.id,
      presets,
      presetSnapshots: snapshots,

      includes: compactRules(activePreset.inclusions),
      excludes: compactRules(activePreset.exclusions),
      treeOnly: compactRules(activePreset.treeOnly),
      compressions: activePreset.compressions as Record<string, CompressionRule[]>,

      maxFilesPerChunk: payload.settings.maxFilesPerChunk,
      mergeToSingleFile: payload.settings.mergeToSingleFile ?? false,
      respectGitignore: payload.settings.respectGitignore ?? true,
      embedProtocol: payload.settings.embedProtocol ?? false,
      stagingStatus: 'VIRTUAL_READY',
      virtualGraph: null,

      activeTab: payload.uiState.activeTab,
      expandedFolders: new Set(payload.uiState.expandedFolders),
      hideExcluded: payload.uiState.hideExcluded ?? true,
      hideTreeOnly: payload.uiState.hideTreeOnly ?? true,

      editorTabs,
      activeEditorTabId,
      activeFile,

      selectedFiles: new Set(),
      isSidebarOpen: false,
      isPainting: false,
      isEphemeralBuilding: false,
      ephemeralDragPaths: null,
      isExportStaging: false,
      isStale: true,
      isBuilding: false,
      chunkPaths: []
    };
  }),

  setMaxFilesPerChunk: (val: number) => {
    set({ maxFilesPerChunk: val, stagingStatus: 'VIRTUAL_READY', isStale: true });
    get().refreshVirtualGraph();
  },
  setMergeToSingleFile: (val: boolean) => {
    set({ mergeToSingleFile: val, stagingStatus: 'VIRTUAL_READY', isStale: true });
    get().refreshVirtualGraph();
  },
  setEmbedProtocol: (val: boolean) => {
    set({ embedProtocol: val, stagingStatus: 'VIRTUAL_READY', isStale: true });
    get().refreshVirtualGraph();
  },
  setRespectGitignore: async (val: boolean) => {
    set({ respectGitignore: val, stagingStatus: 'VIRTUAL_READY', isStale: true });
    for (const root of get().rootPaths) {
      await get().addRootPath(root, true);
    }
  },
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
    if (!state.activeTab || state.missingRoots.has(state.activeTab)) return;
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

  openEditorTab: (rootPath, relativePath, pin = false) => set(state => {
    const tabId = toScopedPathKey(rootPath, relativePath);
    const existing = state.editorTabs.find(t => t.id === tabId);

    if (existing) {
      return {
        editorTabs: pin ? state.editorTabs.map(t => t.id === tabId ? { ...t, isPinned: true } : t) : state.editorTabs,
        activeEditorTabId: tabId,
        activeFile: relativePath,
        activeTab: rootPath,
        isExportStaging: false
      };
    }

    const nextTabs = [...state.editorTabs];
    if (!pin) {
      const transientIdx = nextTabs.findIndex(t => !t.isPinned);
      if (transientIdx !== -1) {
        nextTabs[transientIdx] = { id: tabId, rootPath, relativePath, isPinned: false };
        return {
          editorTabs: nextTabs,
          activeEditorTabId: tabId,
          activeFile: relativePath,
          activeTab: rootPath,
          isExportStaging: false
        };
      }
    }

    nextTabs.push({ id: tabId, rootPath, relativePath, isPinned: pin });
    return {
      editorTabs: nextTabs,
      activeEditorTabId: tabId,
      activeFile: relativePath,
      activeTab: rootPath,
      isExportStaging: false
    };
  }),

  closeEditorTab: (id) => set(state => {
    const nextTabs = state.editorTabs.filter(t => t.id !== id);
    let nextActiveId = state.activeEditorTabId;
    if (state.activeEditorTabId === id) {
      nextActiveId = nextTabs.length > 0 ? nextTabs[nextTabs.length - 1].id : null;
    }
    const nextActiveTab = nextTabs.find(t => t.id === nextActiveId);
    return {
      editorTabs: nextTabs,
      activeEditorTabId: nextActiveId,
      activeFile: nextActiveTab ? nextActiveTab.relativePath : null,
      activeTab: nextActiveTab ? nextActiveTab.rootPath : state.activeTab
    };
  }),

  closeOtherEditorTabs: (id) => set(state => {
    const kept = state.editorTabs.filter(t => t.id === id);
    const target = kept[0];
    return {
      editorTabs: kept,
      activeEditorTabId: id,
      activeFile: target ? target.relativePath : null,
      activeTab: target ? target.rootPath : state.activeTab
    };
  }),

  closeEditorTabsToTheRight: (id) => set(state => {
    const idx = state.editorTabs.findIndex(t => t.id === id);
    if (idx === -1) return state;
    const kept = state.editorTabs.slice(0, idx + 1);
    const activeStillOpen = kept.some(t => t.id === state.activeEditorTabId);
    const target = activeStillOpen ? kept.find(t => t.id === state.activeEditorTabId) : kept[kept.length - 1];
    return {
      editorTabs: kept,
      activeEditorTabId: target ? target.id : null,
      activeFile: target ? target.relativePath : null,
      activeTab: target ? target.rootPath : state.activeTab
    };
  }),

  closeAllEditorTabs: () => set({
    editorTabs: [],
    activeEditorTabId: null,
    activeFile: null
  }),

  pinEditorTab: (id) => set(state => ({
    editorTabs: state.editorTabs.map(t => t.id === id ? { ...t, isPinned: true } : t)
  })),

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

      const packed = state.getPackedPresets();
      packed.push(newPreset);
      const newSnapshots = { ...state.presetSnapshots, [newPreset.id]: JSON.parse(JSON.stringify(newPreset)) };
      useAppStore.getState().setWorkspaceSnapshots(state.workspaceId!, newSnapshots);

      return {
        activePresetId: newPreset.id,
        presets: packed,
        presetSnapshots: newSnapshots,
        includes: newPreset.inclusions,
        excludes: newPreset.exclusions,
        treeOnly: newPreset.treeOnly,
        compressions: newPreset.compressions,
        stagingStatus: 'VIRTUAL_READY',
        isStale: true
      };
    });

    get().refreshVirtualGraph();
  },

  duplicatePreset: (id: string, newName?: string) => {
    const s = get();
    const source = s.presets.find(p => p.id === id) || s.presets.find(p => p.id === s.activePresetId);
    if (!source) return;

    const sourceCurrent = id === s.activePresetId ? {
      ...source,
      inclusions: [...s.includes],
      exclusions: [...s.excludes],
      treeOnly: [...s.treeOnly],
      compressions: JSON.parse(JSON.stringify(s.compressions))
    } : source;

    const name = newName || `${sourceCurrent.name} (Copy)`;
    const newId = 'preset-' + Date.now() + Math.random().toString(36).substring(2, 7);
    const duplicated: Preset = {
      ...JSON.parse(JSON.stringify(sourceCurrent)),
      id: newId,
      name,
      history: []
    };

    const packed = s.getPackedPresets();
    packed.push(duplicated);
    const newSnapshots = { ...s.presetSnapshots, [newId]: JSON.parse(JSON.stringify(duplicated)) };
    useAppStore.getState().setWorkspaceSnapshots(s.workspaceId!, newSnapshots);

    set({
      activePresetId: newId,
      presets: packed,
      presetSnapshots: newSnapshots,
      includes: duplicated.inclusions,
      excludes: duplicated.exclusions,
      treeOnly: duplicated.treeOnly,
      compressions: duplicated.compressions,
      stagingStatus: 'VIRTUAL_READY',
      isStale: true
    });

    get().refreshVirtualGraph();
  },

  createPresetFromSelection: (name: string) => {
    const s = get();
    if (s.selectedFiles.size === 0) return;

    const newId = 'preset-' + Date.now() + Math.random().toString(36).substring(2, 7);
    const newInclusions = compactRules(Array.from(s.selectedFiles));
    const newPreset: Preset = {
      id: newId,
      name,
      inclusions: newInclusions,
      exclusions: ['.git/', 'node_modules/', '__pycache__/', 'dist/', 'build/'],
      treeOnly: [],
      compressions: JSON.parse(JSON.stringify(s.compressions)),
      history: []
    };

    const packed = s.getPackedPresets();
    packed.push(newPreset);
    const newSnapshots = { ...s.presetSnapshots, [newId]: JSON.parse(JSON.stringify(newPreset)) };
    useAppStore.getState().setWorkspaceSnapshots(s.workspaceId!, newSnapshots);

    set({
      activePresetId: newId,
      presets: packed,
      presetSnapshots: newSnapshots,
      includes: newPreset.inclusions,
      excludes: newPreset.exclusions,
      treeOnly: newPreset.treeOnly,
      compressions: newPreset.compressions,
      stagingStatus: 'VIRTUAL_READY',
      isStale: true
    });

    get().refreshVirtualGraph();
  },

  switchPreset: (id: string) => {
    set(state => {
      if (id === state.activePresetId) return state;
      const packed = state.getPackedPresets();
      const target = packed.find(p => p.id === id);
      if (!target) return state;

      return {
        activePresetId: id,
        presets: packed,
        includes: compactRules(target.inclusions),
        excludes: compactRules(target.exclusions),
        treeOnly: compactRules(target.treeOnly),
        compressions: target.compressions as Record<string, CompressionRule[]>,
        stagingStatus: 'VIRTUAL_READY',
        isStale: true
      };
    });
    get().refreshVirtualGraph();
  },

  renamePreset: (id: string, newName: string) => set(state => {
    const updated = state.presets.map(p => p.id === id ? { ...p, name: newName } : p);
    return { presets: updated };
  }),

  deletePreset: (id: string) => {
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
          compressions: fallback.compressions as Record<string, CompressionRule[]>,
          stagingStatus: 'VIRTUAL_READY',
          isStale: true
        };
      }
      return newState;
    });

    get().refreshVirtualGraph();
  },

  revertPreset: () => {
    set(state => {
      if (!state.activePresetId) return state;
      const snap = state.presetSnapshots[state.activePresetId];
      if (!snap) return state;

      const reverted = state.presets.map(p => 
        p.id === state.activePresetId ? JSON.parse(JSON.stringify(snap)) : p
      );

      return {
        presets: reverted,
        includes: compactRules(snap.inclusions),
        excludes: compactRules(snap.exclusions),
        treeOnly: compactRules(snap.treeOnly),
        compressions: snap.compressions as Record<string, CompressionRule[]>,
        stagingStatus: 'VIRTUAL_READY',
        isStale: true
      };
    });
    get().refreshVirtualGraph();
  },

  addHistoryEntry: (entry) => set(state => {
    if (!state.activePresetId) return state;
    const newEntry = { ...entry, id: crypto.randomUUID() };
    const updated = state.presets.map(p => 
      p.id === state.activePresetId ? { ...p, history: [newEntry, ...p.history] } : p
    );
    return { presets: updated };
  }),

  addRootPath: async (rootPath: string, forceRescan = false) => {
    if (!forceRescan && get().rootPaths.includes(rootPath)) return;

    const { node, rules, treeOnly, isMissing } = await window.api.scanDirectory(
      rootPath, 
      get().hardBlacklist,
      get().respectGitignore
    );

    const scopedRules = (rules || []).map(r => toScopedPathKey(rootPath, r));
    const scopedTreeOnly = (treeOnly || []).map(t => toScopedPathKey(rootPath, t));

    set((state) => {
      const newMissing = new Set(state.missingRoots);
      if (isMissing) newMissing.add(rootPath);
      else newMissing.delete(rootPath);

      return {
        rootPaths: Array.from(new Set([...state.rootPaths, rootPath])),
        rawTrees: { ...state.rawTrees, [rootPath]: node },
        missingRoots: newMissing,
        activeTab: state.activeTab || rootPath,
        excludes: isMissing ? state.excludes : compactRules(Array.from(new Set([...state.excludes, ...scopedRules]))),
        treeOnly: isMissing ? state.treeOnly : compactRules(Array.from(new Set([...state.treeOnly, ...scopedTreeOnly]))),
        stagingStatus: 'VIRTUAL_READY',
        isStale: true
      };
    });

    get().refreshVirtualGraph();
  },

  removeRootPath: (pathToRemove: string) => {
    set((state) => {
      const newPaths = state.rootPaths.filter(p => p !== pathToRemove);
      const newRawTrees = { ...state.rawTrees };
      delete newRawTrees[pathToRemove];

      const newMissing = new Set(state.missingRoots);
      newMissing.delete(pathToRemove);

      return {
        rootPaths: newPaths,
        missingRoots: newMissing,
        rawTrees: newRawTrees,
        activeTab: state.activeTab === pathToRemove ? (newPaths[0] || null) : state.activeTab,
        stagingStatus: 'VIRTUAL_READY',
        isStale: true
      };
    });

    get().refreshVirtualGraph();
  },

  relocateRootPath: async (oldPath: string, newPath: string) => {
    const { node, rules, treeOnly, isMissing } = await window.api.scanDirectory(
      newPath,
      get().hardBlacklist,
      get().respectGitignore
    );

    const scopedRules = (rules || []).map(r => toScopedPathKey(newPath, r));
    const scopedTreeOnly = (treeOnly || []).map(t => toScopedPathKey(newPath, t));

    set((state) => {
      const newRoots = state.rootPaths.map(p => p === oldPath ? newPath : p);
      const newTrees = { ...state.rawTrees };
      delete newTrees[oldPath];
      newTrees[newPath] = node;

      const newMissing = new Set(state.missingRoots);
      newMissing.delete(oldPath);
      if (isMissing) newMissing.add(newPath);

      const migrateKey = (k: string) => k.startsWith(`${oldPath}::`) ? `${newPath}::${k.slice(oldPath.length + 2)}` : k;
      const migratedIncludes = state.includes.map(migrateKey);
      const migratedExcludes = state.excludes.map(migrateKey);
      const migratedTreeOnly = state.treeOnly.map(migrateKey);

      const migratedCompressions: Record<string, CompressionRule[]> = {};
      Object.entries(state.compressions).forEach(([k, v]) => {
        migratedCompressions[migrateKey(k)] = v;
      });

      return {
        rootPaths: newRoots,
        rawTrees: newTrees,
        missingRoots: newMissing,
        activeTab: state.activeTab === oldPath ? newPath : state.activeTab,
        includes: compactRules(migratedIncludes),
        excludes: isMissing ? migratedExcludes : compactRules(Array.from(new Set([...migratedExcludes, ...scopedRules]))),
        treeOnly: isMissing ? migratedTreeOnly : compactRules(Array.from(new Set([...migratedTreeOnly, ...scopedTreeOnly]))),
        compressions: migratedCompressions,
        stagingStatus: 'VIRTUAL_READY',
        isStale: true
      };
    });

    get().refreshVirtualGraph();
  },

  reorderRootPaths: (draggedPath, targetPath) => {
    set(state => {
      const dIdx = state.rootPaths.indexOf(draggedPath);
      const tIdx = state.rootPaths.indexOf(targetPath);
      if (dIdx === -1 || tIdx === -1 || dIdx === tIdx) return state;
      const next = [...state.rootPaths];
      const [item] = next.splice(dIdx, 1);
      next.splice(tIdx, 0, item);
      return { rootPaths: next, stagingStatus: 'VIRTUAL_READY', isStale: true };
    });
    get().refreshVirtualGraph();
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

  setFoldersExpanded: (paths: string[], expanded: boolean) => set(state => {
    const newSet = new Set(state.expandedFolders);
    paths.forEach(p => expanded ? newSet.add(p) : newSet.delete(p));
    return { expandedFolders: newSet };
  }),

  expandAllFolders: () => {
    set(state => {
      if (!state.activeTab) return state;
      const tree = state.rawTrees[state.activeTab];
      if (!tree) return state;

      const newExpanded = new Set(state.expandedFolders);
      const traverse = (node: FileNode, currentRel: string) => {
        if (node.type === 'directory') {
          if (currentRel) newExpanded.add(currentRel);
          if (node.children) {
            node.children.forEach(c => {
              const cRel = currentRel ? `${currentRel}/${c.name}` : c.name;
              traverse(c, cRel);
            });
          }
        }
      };
      traverse(tree, '');
      return { expandedFolders: newExpanded };
    });
  },

  collapseAllFolders: () => set({ expandedFolders: new Set() }),

  setIsPainting: (val: boolean) => set({ isPainting: val }),

  addBlacklistRule: (pattern: string) => set((state) => ({ hardBlacklist: Array.from(new Set([...state.hardBlacklist, pattern])) })),
  removeBlacklistRule: (pattern: string) => set((state) => ({ hardBlacklist: state.hardBlacklist.filter(p => p !== pattern) })),
  addPendingBlacklistRule: (pattern: string) => set((state) => ({ pendingBlacklist: Array.from(new Set([...state.pendingBlacklist, pattern])) })),
  removePendingBlacklistRule: (pattern: string) => set((state) => ({ pendingBlacklist: state.pendingBlacklist.filter(p => p !== pattern) })),

  commitBlacklist: async () => {
    const state = get();
    if (state.pendingBlacklist.length === 0) return;

    const merged = Array.from(new Set([...state.hardBlacklist, ...state.pendingBlacklist]));
    set({ hardBlacklist: merged, pendingBlacklist: [], stagingStatus: 'VIRTUAL_READY', isStale: true });

    for (const root of state.rootPaths) {
      await get().addRootPath(root, true);
    }
  },

  addExcludeRule: (pattern: string) => {
    set((state) => ({ excludes: compactRules(Array.from(new Set([...state.excludes, pattern]))), stagingStatus: 'VIRTUAL_READY', isStale: true }));
    get().refreshVirtualGraph();
  },
  removeExcludeRule: (pattern: string) => {
    set((state) => ({ excludes: state.excludes.filter((p) => p !== pattern), stagingStatus: 'VIRTUAL_READY', isStale: true }));
    get().refreshVirtualGraph();
  },
  addTreeOnlyRule: (pattern: string) => {
    set((state) => ({ treeOnly: compactRules(Array.from(new Set([...state.treeOnly, pattern]))), stagingStatus: 'VIRTUAL_READY', isStale: true }));
    get().refreshVirtualGraph();
  },
  removeTreeOnlyRule: (pattern: string) => {
    set((state) => ({ treeOnly: state.treeOnly.filter((p) => p !== pattern), stagingStatus: 'VIRTUAL_READY', isStale: true }));
    get().refreshVirtualGraph();
  },

  applyRuleToSelection: (ruleType, overrideRoot) => {
    const rootId = overrideRoot || get().activeTab || get().rootPaths[0] || '';
    set(state => {
      if (state.selectedFiles.size === 0) return state;

      const newExcludes = new Set(state.excludes);
      const newTreeOnly = new Set(state.treeOnly);
      const newIncludes = new Set(state.includes);

      state.selectedFiles.forEach(rawPath => {
        const scopedKey = isScopedKey(rawPath) ? rawPath : toScopedPathKey(rootId, rawPath);
        if (ruleType === 'include') {
          newExcludes.delete(scopedKey);
          newTreeOnly.delete(scopedKey);
          newIncludes.add(scopedKey);
        } else if (ruleType === 'tree-only') {
          newExcludes.delete(scopedKey);
          newTreeOnly.add(scopedKey);
          newIncludes.delete(scopedKey);
        } else if (ruleType === 'exclude') {
          newTreeOnly.delete(scopedKey);
          newExcludes.add(scopedKey);
          newIncludes.delete(scopedKey);
        }
      });

      return {
        includes: compactRules(Array.from(newIncludes)),
        excludes: compactRules(Array.from(newExcludes)),
        treeOnly: compactRules(Array.from(newTreeOnly)),
        stagingStatus: 'VIRTUAL_READY',
        isStale: true
      };
    });

    get().refreshVirtualGraph();
  },

  compactAllRules: () => {
    set(state => ({
      includes: compactRules(state.includes),
      excludes: compactRules(state.excludes),
      treeOnly: compactRules(state.treeOnly),
      stagingStatus: 'VIRTUAL_READY',
      isStale: true
    }));
    get().refreshVirtualGraph();
  },

  setActiveFile: (path: string | null) => {
    if (path && get().activeTab) {
      get().openEditorTab(get().activeTab!, path, false);
    } else {
      set({ activeFile: path, isExportStaging: false });
    }
  },

  setSelectedFiles: (files: Set<string>) => set({ selectedFiles: files, ephemeralDragPaths: null }),
  setExportStaging: (val: boolean) => set({ isExportStaging: val }),

  addCompressions: (targetKey, rules) => {
    set((state) => {
      const existing = state.compressions[targetKey] || [];
      const newRules = rules.map(r => ({ ...r, id: Math.random().toString(36).substr(2, 9) }));
      return {
        compressions: { ...state.compressions, [targetKey]: [...existing, ...newRules] },
        stagingStatus: 'VIRTUAL_READY',
        isStale: true
      };
    });
    get().refreshVirtualGraph();
  },

  setCompressions: (targetKey, rules) => {
    set(state => ({
      compressions: { ...state.compressions, [targetKey]: rules },
      stagingStatus: 'VIRTUAL_READY',
      isStale: true
    }));
    get().refreshVirtualGraph();
  },

  removeCompression: (targetKey, id) => {
    set((state) => {
      const existing = state.compressions[targetKey] || [];
      return {
        compressions: { ...state.compressions, [targetKey]: existing.filter(c => c.id !== id) },
        stagingStatus: 'VIRTUAL_READY',
        isStale: true
      };
    });
    get().refreshVirtualGraph();
  },

  clearCompressions: (targetKey) => {
    set((state) => {
      const next = { ...state.compressions };
      delete next[targetKey];
      return {
        compressions: next,
        stagingStatus: 'VIRTUAL_READY',
        isStale: true
      };
    });
    get().refreshVirtualGraph();
  }
}));