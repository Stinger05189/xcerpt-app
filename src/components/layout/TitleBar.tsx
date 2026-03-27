// src/components/layout/TitleBar.tsx
import { useEffect, useState } from 'react';
import { Minus, Square, X, Plus, PanelLeft, Settings, DownloadCloud, RefreshCw, Coffee } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useWorkspaceStore } from '../../store/workspaceStore';

export function TitleBar() {
  const { activeWorkspaceId, openTabs, setActiveWorkspace, removeWorkspaceTab, isBrowserOpen, setBrowserOpen, isSettingsOpen, setSettingsOpen, updateProgress, appVersion, reorderWorkspaceTabs } = useAppStore();
  const { isSidebarOpen, setSidebarOpen } = useWorkspaceStore();

  const [updateStatus, setUpdateStatus] = useState<'none' | 'update-available' | 'update-downloaded'>('none');
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);

  useEffect(() => {
    if (!window.api?.onUpdateStatus) return;
    const cleanup = window.api.onUpdateStatus((status) => {
      setUpdateStatus(status);
    });
    
    // We bind the progress listener in the Store initialization (loadConfig/Bootstrapper)
    // but the actual progress bar UI renders here.
    const cleanupProg = window.api.onUpdateProgress((percent) => {
      useAppStore.getState().setUpdateProgress(percent);
    });

    return () => {
      cleanup();
      cleanupProg();
    };
  }, []);

  const handleMinimize = () => window.api.minimizeWindow();
  const handleMaximize = () => window.api.maximizeWindow();
  const handleClose = () => window.api.closeWindow();

  return (
    <div 
      className="h-10 flex shrink-0 items-end bg-bg-base/70 backdrop-blur-md border-b border-border-subtle select-none pl-2 pt-2 relative z-50"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      
      {/* Locked Container for Header Tools when Overlays are Open */}
      <div className={`flex items-end h-full flex-1 overflow-x-hidden ${(isBrowserOpen || isSettingsOpen) ? 'opacity-30 pointer-events-none' : ''}`}>
        
        {/* Sidebar Toggle */}
        <div 
          className={`flex items-center justify-center h-full px-2.5 mb-1 mr-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover cursor-pointer transition-colors ${isSidebarOpen ? 'text-accent' : ''}`}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          title="Toggle Rules Sidebar"
        >
          <PanelLeft size={16} />
        </div>
        
        {/* Xcerpt Logo / Browser Button */}
        <div 
          className={`flex items-center justify-center h-full px-3 mb-1 rounded-md cursor-pointer transition-all ${isBrowserOpen ? 'bg-accent/20 scale-105' : 'hover:bg-accent/10'}`}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => setBrowserOpen(!isBrowserOpen)}
          title="Workspace Browser"
        >
          <img src="./icon.svg" alt="Xcerpt" className="w-5 h-5 drop-shadow-sm" />
        </div>
        
        {/* Version & Updater Component */}
        <div className="flex items-center h-full px-2 mb-1 gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {appVersion && <span className="text-[10px] text-text-muted font-mono opacity-70 cursor-default">v{appVersion}</span>}
          <button 
            onClick={() => window.api.checkForUpdates()} 
            title="Check for Updates" 
            className="text-text-muted hover:text-accent p-1.5 rounded-md hover:bg-bg-hover transition-colors"
          >
            <RefreshCw size={12} />
          </button>
        </div>
        
        {/* Support / Buy Me A Coffee */}
        <div 
          className="flex items-center justify-center h-full px-2.5 mb-1 rounded-md cursor-pointer transition-colors text-text-muted hover:text-yellow-400 hover:bg-yellow-400/10"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => window.api.openExternal('https://buymeacoffee.com/philipquicz')}
          title="Support Xcerpt (Buy me a coffee)"
        >
          <Coffee size={16} />
        </div>
        
        {/* Global Settings Toggle */}
        <div 
          className={`flex items-center justify-center h-full px-2.5 mb-1 rounded-md cursor-pointer transition-colors ${isSettingsOpen ? 'text-accent' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}`}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => setSettingsOpen(!isSettingsOpen)}
          title="Global Settings"
        >
          <Settings size={16} />
        </div>
        
        <div className="w-px h-6 bg-border-subtle mx-2 mb-1.5 pointer-events-none" />
        
        {/* Global Workspace Tabs Container */}
        <div className="flex items-end h-full flex-1 overflow-x-hidden gap-0.5 pb-0">
          {openTabs.map(tab => {
            const isActive = activeWorkspaceId === tab.id;
            const isDragging = draggedTabId === tab.id;
            
            return (
              <div
                key={tab.id}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggedTabId(tab.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedTabId && draggedTabId !== tab.id) {
                    reorderWorkspaceTabs(draggedTabId, tab.id);
                  }
                  setDraggedTabId(null);
                }}
                onDragEnd={() => setDraggedTabId(null)}
                onClick={() => setActiveWorkspace(tab.id)}
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                className={`group flex items-center gap-2 px-3 py-1.5 text-xs rounded-t-md border border-b-0 cursor-pointer transition-colors max-w-48
                  ${isDragging ? 'opacity-40' : 'opacity-100'}
                  ${isActive 
                    ? 'bg-bg-panel border-border-subtle text-text-primary -mb-px pb-1.75 z-20' 
                    : 'bg-transparent border-transparent text-text-muted hover:bg-bg-hover mb-0 pb-1.5'}`}
              >
                <span className="truncate select-none font-medium pointer-events-none">{tab.title}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); removeWorkspaceTab(tab.id); }}
                  className="p-0.5 rounded hover:bg-red-400/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
          
          <button 
            onClick={() => setBrowserOpen(true)} 
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="mb-1 ml-1 p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors"
            title="Browse or Create Workspace"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    
      {/* OS Window Controls & Updater */}
      <div className="flex h-full pb-1 items-center relative" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        
        {/* Update Progress Indicator */}
        {updateProgress !== null && updateProgress < 100 && updateStatus !== 'update-downloaded' && (
          <div className="absolute -bottom-px left-0 right-0 h-0.5 bg-bg-hover overflow-hidden">
            <div 
              className="h-full bg-accent transition-all duration-300 ease-out" 
              style={{ width: `${updateProgress}%` }} 
            />
          </div>
        )}

        {updateStatus === 'update-downloaded' && (
          <button 
            onClick={() => window.api.installUpdate()}
            className="flex items-center gap-1.5 px-2.5 py-1 mr-2 bg-accent/20 text-accent hover:bg-accent hover:text-white rounded-full text-[10px] font-semibold transition-colors animate-in fade-in zoom-in"
            title="Update downloaded. Click to restart and install."
          >
            <DownloadCloud size={12} /> Update Ready
          </button>
        )}
        <button onClick={handleMinimize} className="px-3 hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors flex items-center justify-center rounded-md h-full" title="Minimize"><Minus size={14} /></button>
        <button onClick={handleMaximize} className="px-3 hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors flex items-center justify-center rounded-md h-full" title="Maximize"><Square size={12} /></button>
        <button onClick={handleClose} className="px-3 hover:bg-red-500 hover:text-white text-text-muted transition-colors flex items-center justify-center rounded-md h-full mr-1" title="Close"><X size={14} /></button>
      </div>
      
    </div>
  );
}