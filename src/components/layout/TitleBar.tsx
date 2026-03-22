// src/components/layout/TitleBar.tsx
import { Minus, Square, X, Plus, Home } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

export function TitleBar() {
  const { activeWorkspaceId, openTabs, setActiveWorkspace, removeWorkspaceTab, isBrowserOpen, setBrowserOpen } = useAppStore();

  const handleMinimize = () => window.api.minimizeWindow();
  const handleMaximize = () => window.api.maximizeWindow();
  const handleClose = () => window.api.closeWindow();

  return (
    <div 
      className="h-10 flex shrink-0 items-end bg-bg-base border-b border-border-subtle select-none pl-2 pt-2"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      
      {/* Locked Container for Header Tools when Browser is Open */}
      <div className={`flex items-end h-full flex-1 overflow-x-hidden ${isBrowserOpen ? 'opacity-30 pointer-events-none' : ''}`}>
        
        {/* Home / Browser Button */}
        <div 
          className="flex items-center h-full px-3 mb-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover cursor-pointer transition-colors"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={() => setBrowserOpen(true)}
          title="Workspace Browser"
        >
          <Home size={15} className="text-accent" />
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
          
          {/* Add/Browse Workspace Button */}
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
    
      {/* OS Window Controls (Never Locked) */}
      <div className="flex h-full pb-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button 
          onClick={handleMinimize} 
          className="px-3 hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors flex items-center justify-center rounded-md"
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button 
          onClick={handleMaximize} 
          className="px-3 hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors flex items-center justify-center rounded-md"
          title="Maximize"
        >
          <Square size={12} />
        </button>
        <button 
          onClick={handleClose} 
          className="px-3 hover:bg-red-500 hover:text-white text-text-muted transition-colors flex items-center justify-center rounded-md mr-1"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
      
    </div>
  );
}