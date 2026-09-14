// src/store/appStore.ts
import { create } from 'zustand';
import type { AppConfig } from '../types/ipc';
import { useHistoryStore } from './historyStore';
import type { LLMSettingsConfig } from '../features/llm/types/llm';

export interface TabData {
  id: string;
  title: string;
}

export const DEFAULT_LLM_CONFIG: LLMSettingsConfig = {
  activeProvider: 'openrouter',
  providers: {
    openrouter: {
      id: 'openrouter',
      name: 'OpenRouter',
      apiKey: '',
      baseUrl: 'https://openrouter.ai/api/v1',
      defaultModel: 'google/gemini-3.5-flash-lite',
      availableModels: [
        'google/gemini-3.5-flash-lite',
        'anthropic/claude-3.7-sonnet',
        'openai/gpt-4o-mini',
        'deepseek/deepseek-chat'
      ],
      customModels: []
    },
    gemini: {
      id: 'gemini',
      name: 'Google Gemini API',
      apiKey: '',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      defaultModel: 'gemini-2.5-flash',
      availableModels: [
        'gemini-2.5-flash',
        'gemini-2.5-pro'
      ],
      customModels: []
    },
    openai: {
      id: 'openai',
      name: 'OpenAI',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      availableModels: [
        'gpt-4o-mini',
        'gpt-4o'
      ],
      customModels: []
    },
    anthropic: {
      id: 'anthropic',
      name: 'Anthropic',
      apiKey: '',
      baseUrl: 'https://api.anthropic.com/v1',
      defaultModel: 'claude-3-7-sonnet-20250219',
      availableModels: [
        'claude-3-7-sonnet-20250219',
        'claude-3-5-haiku-20241022'
      ],
      customModels: []
    }
  }
};

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
  extensionOverrides: {},
  llm: DEFAULT_LLM_CONFIG
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

export const useAppStore = create<AppState>((set, get) => ({
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
      set({ 
        appVersion: version,
        config: { 
          ...DEFAULT_CONFIG, 
          ...loaded, 
          theme: { 
            ...DEFAULT_CONFIG.theme, 
            ...loaded.theme, 
            colors: { ...DEFAULT_CONFIG.theme.colors, ...(loaded.theme?.colors || {}) } 
          },
          llm: {
            ...DEFAULT_LLM_CONFIG,
            ...(loaded.llm || {}),
            providers: {
              ...DEFAULT_LLM_CONFIG.providers,
              ...(loaded.llm?.providers || {})
            }
          }
        } 
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

  addWorkspaceTab: (id, title = "Untitled Workspace") => {
    const prevTabs = get().openTabs;
    set((state) => {
      if (state.openTabs.some(t => t.id === id)) return state;
      return { openTabs: [...state.openTabs, { id, title }] };
    });
    const nextTabs = get().openTabs;
    
    if (prevTabs.length !== nextTabs.length) {
      useHistoryStore.getState().push(`Open Tab '${title}'`, 
        () => set({ openTabs: prevTabs }),
        () => set({ openTabs: nextTabs })
      );
    }
  },

  removeWorkspaceTab: (id) => {
    const prevTabs = get().openTabs;
    const prevActiveId = get().activeWorkspaceId;
    const targetTab = prevTabs.find((t: TabData) => t.id === id);
    
    set((state) => {
      const newTabs = state.openTabs.filter(t => t.id !== id);
      let nextActive = state.activeWorkspaceId;
      if (state.activeWorkspaceId === id) {
        nextActive = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
      }
      return { openTabs: newTabs, activeWorkspaceId: nextActive };
    });
    
    const nextTabs = get().openTabs;
    const nextActiveId = get().activeWorkspaceId;
    
    if (targetTab) {
      useHistoryStore.getState().push(`Close Tab '${targetTab.title}'`, 
        () => set({ openTabs: prevTabs, activeWorkspaceId: prevActiveId }),
        () => set({ openTabs: nextTabs, activeWorkspaceId: nextActiveId })
      );
    }
  },

  updateTabTitle: (id, title) => set((state) => ({
    openTabs: state.openTabs.map(t => t.id === id ? { ...t, title } : t)
  })),

  setOpenTabs: (tabs) => set({ openTabs: tabs }),

  reorderWorkspaceTabs: (draggedId, targetId) => {
    const prevTabs = get().openTabs;
    set(state => {
      const draggedIndex = state.openTabs.findIndex(t => t.id === draggedId);
      const targetIndex = state.openTabs.findIndex(t => t.id === targetId);
      if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) return state;
      
      const newTabs = [...state.openTabs];
      const [draggedItem] = newTabs.splice(draggedIndex, 1);
      newTabs.splice(targetIndex, 0, draggedItem);
      
      return { openTabs: newTabs };
    });
    const nextTabs = get().openTabs;
    useHistoryStore.getState().push(`Reorder Tabs`, 
      () => set({ openTabs: prevTabs }),
      () => set({ openTabs: nextTabs })
    );
  },

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