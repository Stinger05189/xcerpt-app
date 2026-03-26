// src/components/layout/Bootstrapper.tsx
import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../../store/appStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { WorkspacePayload } from '../../types/ipc';

// Helper to generate blank payloads for brand new tabs
const generateFreshWorkspace = async (id: string) => {
  const defaultPreset = {
    id: 'default',
    name: 'Default Context',
    inclusions: [],
    exclusions: ['.git/', 'node_modules/', '__pycache__/', 'dist/', 'build/'],
    treeOnly: [],
    compressions: {},
    history: []
  };

  const freshPayload: WorkspacePayload = {
    id,
    version: "3.0",
    metadata: { 
      id, 
      name: null, 
      createdAt: new Date().toISOString(), 
      updatedAt: new Date().toISOString(), 
      totalIncludedFiles: 0, 
      rootPaths: [],
      stats: { totalExports: 0, ephemeralExports: 0, fileFrequencies: {} }
    },
    settings: { maxFilesPerChunk: 100000 },
    rules: { hardBlacklist: useWorkspaceStore.getState().hardBlacklist },
    activePresetId: defaultPreset.id,
    presets: [defaultPreset],
    uiState: { expandedFolders: [], activeTab: null, paneWidths: { sidebar: 320, tree: 320 } }
  };
  await window.api.saveSession(id, freshPayload);
};

// Helper to serialize current state
const getWorkspacePayload = (state: ReturnType<typeof useWorkspaceStore.getState>): WorkspacePayload => ({
  id: state.workspaceId!,
  version: "3.0",
  metadata: {
    id: state.workspaceId!,
    name: state.workspaceName,
    createdAt: state.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalIncludedFiles: 0,
    rootPaths: state.rootPaths,
    stats: state.stats
  },
  settings: { maxFilesPerChunk: state.maxFilesPerChunk },
  rules: { hardBlacklist: state.hardBlacklist },
  activePresetId: state.activePresetId!,
  presets: state.getPackedPresets(),
  uiState: { 
    expandedFolders: Array.from(state.expandedFolders), 
    activeTab: state.activeTab,
    paneWidths: state.paneWidths
  }
});

export function Bootstrapper({ children }: { children: React.ReactNode }) {
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const [isSwitching, setIsSwitching] = useState(true);

  const activeWorkspaceId = useAppStore(s => s.activeWorkspaceId);
  const initRef = useRef(false);
  const currentHydratedIdRef = useRef<string | null>(null);

  // --- 1. Initial Boot (Runs strictly once) ---
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    
    async function init() {
      await useAppStore.getState().loadConfig();
      const appState = await window.api.loadAppState();
      const store = useAppStore.getState();
      
      let targetWorkspaceId = appState?.activeWorkspaceId ?? null;
      let tabsToRestore = appState?.openTabs || [];
    
      // Legacy fallback or brand new installation
      if (!appState || tabsToRestore.length === 0) {
        if (appState?.openWorkspaceIds && appState.openWorkspaceIds.length > 0) {
          tabsToRestore = appState.openWorkspaceIds.map(id => ({ id, title: "Workspace" }));
        }
      }
    
      if (tabsToRestore.length > 0 && (!targetWorkspaceId || !tabsToRestore.some(t => t.id === targetWorkspaceId))) {
        targetWorkspaceId = tabsToRestore[0].id;
      } else if (tabsToRestore.length === 0) {
        targetWorkspaceId = null;
      }
    
      store.setOpenTabs(tabsToRestore);
      store.setActiveWorkspace(targetWorkspaceId);
      
      // If no tabs exist on boot, open the browser instead of creating a dummy workspace
      if (tabsToRestore.length === 0) {
        store.setBrowserOpen(true);
      }
      
      setIsBootstrapped(true);
    }
    init();
  }, []);

  // --- 2. Reactive Context Switcher ---
  useEffect(() => {
    if (!isBootstrapped) return;
    let isCancelled = false;
    
    // Auto-open browser if user closed the very last tab
    if (!activeWorkspaceId) {
      useAppStore.getState().setBrowserOpen(true);
      currentHydratedIdRef.current = null;
      // Push state update to the end of the event loop to prevent cascading render warnings
      setTimeout(() => {
        if (!isCancelled) setIsSwitching(false);
      }, 0);
      return;
    }
    
    async function switchWorkspace() {
      // Fast-return moved inside async function to prevent cascading render warnings
      if (activeWorkspaceId === currentHydratedIdRef.current) {
        setIsSwitching(false);
        return;
      }
    
      setIsSwitching(true);
    
      // Force synchronous save of the OUTGOING workspace state
      const prevId = currentHydratedIdRef.current;
      if (prevId) {
        const state = useWorkspaceStore.getState();
        if (state.workspaceId === prevId) {
          await window.api.saveSession(prevId, getWorkspacePayload(state));
        }
      }
    
      if (isCancelled) return;
    
      // Hydrate the INCOMING workspace state
      const sessionData = await window.api.loadSession(activeWorkspaceId!);
      if (sessionData) {
        useWorkspaceStore.getState().hydrateWorkspace(sessionData);
        if (sessionData.metadata.rootPaths && sessionData.metadata.rootPaths.length > 0) {
          await Promise.all(
            sessionData.metadata.rootPaths.map(path => 
              useWorkspaceStore.getState().addRootPath(path, true)
            )
          );
        }
      } else {
        // Fallback: If title bar requested an ID that doesn't exist on disk, create it now
        await generateFreshWorkspace(activeWorkspaceId!);
        const fresh = await window.api.loadSession(activeWorkspaceId!);
        useWorkspaceStore.getState().hydrateWorkspace(fresh!);
      }
    
      if (isCancelled) return;
      currentHydratedIdRef.current = activeWorkspaceId;
      setIsSwitching(false);
    }
    
    switchWorkspace();
    return () => { isCancelled = true; };
  }, [activeWorkspaceId, isBootstrapped]);

  // --- 3. Live Tab Title Synchronization ---
  useEffect(() => {
    if (isSwitching || !activeWorkspaceId) return;
    const unsub = useWorkspaceStore.subscribe((state) => {
      let title = "Untitled Workspace";
      if (state.workspaceName) {
        title = state.workspaceName;
      } else if (state.rootPaths.length > 0) {
        title = state.rootPaths[0].split(/[/\\]/).pop() || "Untitled Workspace";
      }
      useAppStore.getState().updateTabTitle(activeWorkspaceId, title);
    });
    return unsub;
  }, [activeWorkspaceId, isSwitching]);

  // --- 4. Auto-Save Phase (Continuous Disk Flushing) ---
  useEffect(() => {
    if (!isBootstrapped || isSwitching) return;
    
    let wsTimeoutId: ReturnType<typeof setTimeout>;
    let appTimeoutId: ReturnType<typeof setTimeout>;
    
    const unsubWs = useWorkspaceStore.subscribe((state) => {
      if (!state.workspaceId) return;
      clearTimeout(wsTimeoutId);
      wsTimeoutId = setTimeout(() => {
        window.api.saveSession(state.workspaceId!, getWorkspacePayload(state));
      }, 300);
    });
    
    const unsubApp = useAppStore.subscribe((state) => {
      clearTimeout(appTimeoutId);
      appTimeoutId = setTimeout(() => {
        window.api.saveAppState({
          activeWorkspaceId: state.activeWorkspaceId,
          openTabs: state.openTabs
        });
      }, 300); 
    });
    
    return () => {
      unsubWs();
      unsubApp();
      clearTimeout(wsTimeoutId);
      clearTimeout(appTimeoutId);
    };
  }, [isBootstrapped, isSwitching]);

  if (!isBootstrapped || isSwitching) {
    return (
      <div className="h-full w-full bg-bg-panel flex flex-col items-center justify-center gap-4 text-text-muted flex-1">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent animate-pulse">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span className="text-xs font-medium tracking-widest uppercase opacity-70">Loading Environment...</span>
      </div>
    );
  }

  return <>{children}</>;
}