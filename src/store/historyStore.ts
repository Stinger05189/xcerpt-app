// src/store/historyStore.ts
import { create } from 'zustand';
import LZString from 'lz-string';
import { useAppStore } from './appStore';
import { useWorkspaceStore } from './workspaceStore';

export interface HistoryContext {
  workspaceId: string | null;
  activeTab: string | null;
  activePresetId: string | null;
  scrollOffsetY: number;
}

export interface HistoryCommand {
  id: string;
  label: string;
  context: HistoryContext;
  undo: () => Promise<void> | void;
  redo: () => Promise<void> | void;
}

interface HistoryState {
  undoStack: HistoryCommand[];
  redoStack: HistoryCommand[];
  isProcessing: boolean;
  lastAction: { type: 'undo' | 'redo' | 'push', label: string, timestamp: number } | null;

  push: (label: string, undoFn: () => Promise<void> | void, redoFn: () => Promise<void> | void) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  clear: () => void;
}

// Micro-tick to allow React to flush DOM updates during async environment switches
const tick = () => new Promise(resolve => setTimeout(resolve, 50));

export const useHistoryStore = create<HistoryState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  isProcessing: false,
  lastAction: null,

  push: (label, undoFn, redoFn) => {
    const app = useAppStore.getState();
    const ws = useWorkspaceStore.getState();
    
    // Prevent pushing history artifacts while an undo/redo is physically executing
    if (get().isProcessing) return;
    
    const cmd: HistoryCommand = {
      id: crypto.randomUUID(),
      label,
      context: {
        workspaceId: app.activeWorkspaceId,
        activeTab: ws.activeTab,
        activePresetId: ws.activePresetId,
        scrollOffsetY: ws.getScrollOffset ? ws.getScrollOffset() : 0
      },
      undo: undoFn,
      redo: redoFn
    };
    
    set(state => {
      const newUndo = [...state.undoStack, cmd];
      if (newUndo.length > 1000) newUndo.shift(); // Cap at 1000 operations
      return {
        undoStack: newUndo,
        redoStack: [], // Wipes redo stack instantly on any new physical user action
        lastAction: { type: 'push', label, timestamp: Date.now() }
      };
    });
  },

  undo: async () => {
    const state = get();
    if (state.isProcessing || state.undoStack.length === 0) return;
    
    set({ isProcessing: true });
    
    const cmd = state.undoStack[state.undoStack.length - 1];
    try {
      await resolveContext(cmd.context);
      await cmd.undo();
      
      set(s => ({
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, cmd],
        lastAction: { type: 'undo', label: cmd.label, timestamp: Date.now() }
      }));
    } catch (e) {
      console.error("History Engine: Undo failed", e);
    } finally {
      set({ isProcessing: false });
    }
  },

  redo: async () => {
    const state = get();
    if (state.isProcessing || state.redoStack.length === 0) return;
    
    set({ isProcessing: true });
    
    const cmd = state.redoStack[state.redoStack.length - 1];
    try {
      await resolveContext(cmd.context);
      await cmd.redo();
      
      set(s => ({
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [...s.undoStack, cmd],
        lastAction: { type: 'redo', label: cmd.label, timestamp: Date.now() }
      }));
    } catch (e) {
      console.error("History Engine: Redo failed", e);
    } finally {
      set({ isProcessing: false });
    }
  },

  clear: () => set({ undoStack: [], redoStack: [], lastAction: null })
}));

async function resolveContext(context: HistoryContext) {
  const app = useAppStore.getState();

  // 1. Resolve Workspace Tab Environment
  if (context.workspaceId && app.activeWorkspaceId !== context.workspaceId) {
    app.setActiveWorkspace(context.workspaceId);
    // Lock and await Bootstrapper disk hydration
    await new Promise<void>(resolve => {
      const unsub = useWorkspaceStore.subscribe((wsState) => {
        if (wsState.workspaceId === context.workspaceId) {
          unsub();
          resolve();
        }
      });
    });
    await tick(); 
  }

  const ws = useWorkspaceStore.getState();

  // 2. Resolve Active Preset Context
  if (context.activePresetId && ws.activePresetId !== context.activePresetId) {
    ws.switchPreset(context.activePresetId);
    await tick();
  }

  // 3. Resolve Active Root Path
  if (context.activeTab && ws.activeTab !== context.activeTab) {
    ws.setActiveTab(context.activeTab);
    await tick();
  }

  // 4. Resolve Vertical Scroll Coordinate
  if (context.scrollOffsetY !== undefined) {
    ws.setTargetScrollY(context.scrollOffsetY);
    await tick();
  }
}

// Exported LZ-String utilities for zero-memory bulk array closures
export const compressHistoryPayload = (data: unknown): string => {
  return LZString.compressToBase64(JSON.stringify(data));
};

export const decompressHistoryPayload = <T>(base64: string): T => {
  return JSON.parse(LZString.decompressFromBase64(base64) || 'null');
};