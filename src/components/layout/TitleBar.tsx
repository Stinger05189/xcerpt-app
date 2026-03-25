// src/components/layout/TitleBar.tsx
import { useEffect, useState } from 'react';
import { Minus, Square, X, Plus, PanelLeft, Settings, DownloadCloud } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useWorkspaceStore } from '../../store/workspaceStore';

export function TitleBar() {
  const { activeWorkspaceId, openTabs, setActiveWorkspace, removeWorkspaceTab, isBrowserOpen, setBrowserOpen, isSettingsOpen, setSettingsOpen } = useAppStore();
  const { isSidebarOpen, setSidebarOpen } = useWorkspaceStore();

  const [updateStatus, setUpdateStatus] = useState<'none' | 'update-available' | 'update-downloaded'>('none');

  useEffect(() => {
    if (!window.api?.onUpdateStatus) return;
    const cleanup = window.api.onUpdateStatus((status) => {
      setUpdateStatus(status);
    });
    return cleanup;
  }, []);

  const handleMinimize = () => window.api.minimizeWindow();
  const handleMaximize = () => window.api.maximizeWindow();
  const handleClose = () => window.api.closeWindow();

  return (
    <div 
      className="h-10 flex shrink-0 items-end bg-bg-base border-b border-border-subtle select-none pl-2 pt-2"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      
      {/* <div className={`flex items-end h-full flex-1 overflow-x-hidden ${isBrowserOpen ? 'opacity-30 pointer-events-none' : ''}`}> */}
      {/* Locked Container for Header Tools when Overlays are Open */}
      <div className={`flex items-end h-full flex-1 overflow-x-hidden ${(isBrowserOpen || isSettingsOpen) ? 'opacity-30 pointer-events-none' : ''}`}>
        
        {/* Sidebar Toggle */}
        <div 
          className={`flex items-center h-full px-2 mb-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover cursor-pointer transition-colors ${isSidebarOpen ? 'text-accent' : ''}`}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          title="Toggle Rules Sidebar"
        >
          <PanelLeft size={15} />
        </div>
        
        {/* Xcerpt Logo / Browser Button */}
        <div 
          className={`flex items-center h-full px-2 mb-1 rounded-md cursor-pointer transition-all ${isBrowserOpen ? 'opacity-100 scale-105' : 'opacity-70 hover:opacity-100 hover:bg-bg-hover'}`}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => setBrowserOpen(!isBrowserOpen)}
          title="Workspace Browser"
        >
          <img src="./icon.svg" alt="Xcerpt" className="w-4 h-4" />
        </div>
        
        {/* Global Settings Toggle */}
        <div 
          className={`flex items-center h-full px-2 mb-1 rounded-md cursor-pointer transition-colors ${isSettingsOpen ? 'text-accent' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}`}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => setSettingsOpen(!isSettingsOpen)}
          title="Global Settings"
        >
          <Settings size={15} />
        </div>
        
        <div className="w-px h-5 bg-border-subtle mx-2 mb-2 pointer-events-none" />
        
        {/* Global Workspace Tabs Container */}
        <div className="flex items-end h-full flex-1 overflow-x-hidden gap-0.5">
          {openTabs.map(tab => {
            const isActive = activeWorkspaceId === tab.id;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveWorkspace(tab.id)}
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                className={`group flex items-center gap-2 px-3 py-1.5 text-xs rounded-t-md border border-b-0 cursor-pointer transition-colors max-w-48
                  ${isActive 
                    ? 'bg-bg-panel border-border-subtle text-text-primary -mb-px pb-1.75 z-20' 
                    : 'bg-transparent border-transparent text-text-muted hover:bg-bg-hover mb-0 pb-1.5'}`}
              >
                <span className="truncate select-none font-medium">{tab.title}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); removeWorkspaceTab(tab.id); }}
                  className="p-0.5 rounded hover:bg-border-subtle opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
          
          <button 
            onClick={() => setBrowserOpen(true)} 
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="mb-1 ml-1 p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
            title="Browse or Create Workspace"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    
      {/* OS Window Controls & Updater */}
      <div className="flex h-full pb-1 items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
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