// src/store/appStore.ts
import { create } from 'zustand';
import type { AppConfig } from '../types/ipc';

export interface TabData {
  id: string;
  title: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  theme: {
    scale: 1.0,
    font: {
      size: 13,
      family: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
    },
    colors: {
      bgBase: '#0f0f11',
      bgPanel: '#18181b',
      bgHover: '#27272a',
      textPrimary: '#f4f4f5',
      textMuted: '#a1a1aa',
      borderSubtle: '#27272a',
      accent: '#8b5cf6'
    }
  },
  shortcuts: {},
  extensionOverrides: {}
};

interface AppState {
  config: AppConfig;
  isSettingsOpen: boolean;
  appVersion: string | null;
  updateProgress: number | null;

  activeWorkspaceId: string | null;
  openTabs: TabData[];
  isBrowserOpen: boolean;
  workspaceSnapshots: Record<string, Record<string, import('../types/ipc').Preset>>;

  loadConfig: () => Promise<void>;
  updateConfig: (newConfig: Partial<AppConfig> | ((prev: AppConfig) => AppConfig)) => void;
  setSettingsOpen: (isOpen: boolean) => void;
  setUpdateProgress: (progress: number | null) => void;

  setActiveWorkspace: (id: string | null) => void;
  addWorkspaceTab: (id: string, title?: string) => void;
  removeWorkspaceTab: (id: string) => void;
  updateTabTitle: (id: string, title: string) => void;
  setOpenTabs: (tabs: TabData[]) => void;
  setBrowserOpen: (isOpen: boolean) => void;
  reorderWorkspaceTabs: (draggedId: string, targetId: string) => void;

  setWorkspaceSnapshots: (workspaceId: string, snapshots: Record<string, import('../types/ipc').Preset>) => void;
  deleteWorkspaceSnapshot: (workspaceId: string, presetId: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  config: DEFAULT_CONFIG,
  isSettingsOpen: false,
  appVersion: null,
  updateProgress: null,

  activeWorkspaceId: null,
  openTabs: [],
  isBrowserOpen: false,
  workspaceSnapshots: {},

  loadConfig: async () => {
    const loaded = await window.api.loadAppConfig();
    const version = await window.api.getVersion().catch(() => null);
    
    if (loaded) {
      // Deep merge to ensure missing keys from legacy configs are populated with defaults
      set({ 
        appVersion: version,
        config: { ...DEFAULT_CONFIG, ...loaded, theme: { ...DEFAULT_CONFIG.theme, ...loaded.theme, colors: { ...DEFAULT_CONFIG.theme.colors, ...(loaded.theme?.colors || {}) } } } 
      });
    } else {
      set({ appVersion: version });
    }
  },

  updateConfig: (updater) => {
    set((state) => {
      const nextConfig = typeof updater === 'function' ? updater(state.config) : { ...state.config, ...updater };
      window.api.saveAppConfig(nextConfig);
      return { config: nextConfig };
    });
  },

  setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
  setUpdateProgress: (progress) => set({ updateProgress: progress }),

  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

  addWorkspaceTab: (id, title = "Untitled Workspace") => set((state) => {
    if (state.openTabs.some(t => t.id === id)) return state;
    return { openTabs: [...state.openTabs, { id, title }] };
  }),

  removeWorkspaceTab: (id) => set((state) => {
    const newTabs = state.openTabs.filter(t => t.id !== id);
    let nextActive = state.activeWorkspaceId;
    
    // If we closed the active tab, fallback to the right-most adjacent tab
    if (state.activeWorkspaceId === id) {
      nextActive = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
    }
    
    return { openTabs: newTabs, activeWorkspaceId: nextActive };
  }),

  updateTabTitle: (id, title) => set((state) => ({
    openTabs: state.openTabs.map(t => t.id === id ? { ...t, title } : t)
  })),

  setOpenTabs: (tabs) => set({ openTabs: tabs }),

  reorderWorkspaceTabs: (draggedId, targetId) => set(state => {
    const draggedIndex = state.openTabs.findIndex(t => t.id === draggedId);
    const targetIndex = state.openTabs.findIndex(t => t.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return state;
    
    const newTabs = [...state.openTabs];
    const [draggedItem] = newTabs.splice(draggedIndex, 1);
    newTabs.splice(targetIndex, 0, draggedItem);
    
    return { openTabs: newTabs };
  }),

  setBrowserOpen: (isOpen) => set({ isBrowserOpen: isOpen }),

  setWorkspaceSnapshots: (workspaceId, snapshots) => set((state) => ({
    workspaceSnapshots: { ...state.workspaceSnapshots, [workspaceId]: snapshots }
  })),

  deleteWorkspaceSnapshot: (workspaceId, presetId) => set((state) => {
    const workspaceData = { ...state.workspaceSnapshots[workspaceId] };
    delete workspaceData[presetId];
    return {
      workspaceSnapshots: { ...state.workspaceSnapshots, [workspaceId]: workspaceData }
    };
  })
}));