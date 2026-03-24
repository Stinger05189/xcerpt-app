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

  activeWorkspaceId: string | null;
  openTabs: TabData[];
  isBrowserOpen: boolean;
  workspaceSnapshots: Record<string, Record<string, import('../types/ipc').Preset>>;

  loadConfig: () => Promise<void>;
  updateConfig: (newConfig: Partial<AppConfig> | ((prev: AppConfig) => AppConfig)) => void;
  setSettingsOpen: (isOpen: boolean) => void;

  setActiveWorkspace: (id: string | null) => void;
  addWorkspaceTab: (id: string, title?: string) => void;
  removeWorkspaceTab: (id: string) => void;
  updateTabTitle: (id: string, title: string) => void;
  setOpenTabs: (tabs: TabData[]) => void;
  setBrowserOpen: (isOpen: boolean) => void;

  setWorkspaceSnapshots: (workspaceId: string, snapshots: Record<string, import('../types/ipc').Preset>) => void;
  deleteWorkspaceSnapshot: (workspaceId: string, presetId: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  config: DEFAULT_CONFIG,
  isSettingsOpen: false,

  activeWorkspaceId: null,
  openTabs: [],
  isBrowserOpen: false,
  workspaceSnapshots: {},

  loadConfig: async () => {
    const loaded = await window.api.loadAppConfig();
    if (loaded) {
      // Deep merge to ensure missing keys from legacy configs are populated with defaults
      set({ config: { ...DEFAULT_CONFIG, ...loaded, theme: { ...DEFAULT_CONFIG.theme, ...loaded.theme, colors: { ...DEFAULT_CONFIG.theme.colors, ...(loaded.theme?.colors || {}) } } } });
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