// src/components/layout/TitleBar.tsx
import { Minus, Square, X } from 'lucide-react';

export function TitleBar() {
  const handleMinimize = () => window.api.minimizeWindow();
  const handleMaximize = () => window.api.maximizeWindow();
  const handleClose = () => window.api.closeWindow();

  return (
    <div 
      className="h-8 flex shrink-0 justify-between items-center bg-bg-base border-b border-border-subtle select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 px-3 text-text-muted">
        {/* Brand Logo: Document with an 'X' representing excerpt/skipping */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M9.5 12.5l5 5" />
          <path d="M14.5 12.5l-5 5" />
        </svg>
        <span className="text-xs font-bold tracking-widest uppercase text-text-primary opacity-90">Xcerpt</span>
      </div>
    
      {/* Window Controls (No Drag Region to allow clicking) */}
      <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button 
          onClick={handleMinimize} 
          className="px-3 hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors flex items-center justify-center"
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button 
          onClick={handleMaximize} 
          className="px-3 hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors flex items-center justify-center"
          title="Maximize"
        >
          <Square size={12} />
        </button>
        <button 
          onClick={handleClose} 
          className="px-3 hover:bg-red-500 hover:text-white text-text-muted transition-colors flex items-center justify-center"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}