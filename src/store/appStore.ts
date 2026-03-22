// src/store/appStore.ts
import { create } from 'zustand';

export interface TabData {
  id: string;
  title: string;
}

interface AppState {
  activeWorkspaceId: string | null;
  openTabs: TabData[];
  isBrowserOpen: boolean;

  setActiveWorkspace: (id: string | null) => void;
  addWorkspaceTab: (id: string, title?: string) => void;
  removeWorkspaceTab: (id: string) => void;
  updateTabTitle: (id: string, title: string) => void;
  setOpenTabs: (tabs: TabData[]) => void;
  setBrowserOpen: (isOpen: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeWorkspaceId: null,
  openTabs: [],
  isBrowserOpen: false,

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

  setBrowserOpen: (isOpen) => set({ isBrowserOpen: isOpen })
}));