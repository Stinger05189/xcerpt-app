// src/components/tree/ContextMenu.tsx
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { X, EyeOff, LayoutTemplate, Plus, FolderSearch, ShieldBan, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  targetRelativePath: string;
  rootPath: string;
  onClose: () => void;
}

// Custom Hold-to-Confirm Button Component
function HoldToConfirmButton({ onConfirm, children, className }: { onConfirm: () => void, children: React.ReactNode, className?: string }) {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setProgress(100);
    timerRef.current = setTimeout(() => {
      onConfirm();
      setProgress(0);
    }, 500); // 500ms required hold
  };

  const cancel = () => {
    setProgress(0);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  return (
    <button 
      onMouseDown={start} 
      onMouseUp={cancel} 
      onMouseLeave={cancel} 
      className={`relative overflow-hidden w-full flex items-center justify-between px-3 py-1.5 hover:bg-bg-hover text-left transition-colors ${className || ''}`}
    >
      <div 
        className="absolute inset-y-0 left-0 bg-red-500/20 transition-[width] ease-linear" 
        style={{ width: `${progress}%`, transitionDuration: progress > 0 ? '500ms' : '0ms' }} 
      />
      <div className="relative z-10 w-full flex items-center justify-between">{children}</div>
    </button>
  );
}

export function ContextMenu({ x, y, targetRelativePath, rootPath, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { selectedFiles, applyRuleToSelection, setFoldersExpanded, addPendingBlacklistRule } = useWorkspaceStore();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [onClose]);

  const handleRevealInExplorer = () => {
    // Reveal in OS binding from ElectronAPI
    const cleanPath = targetRelativePath.replace(/\/$/, '');
    const absPath = `${rootPath}/${cleanPath}`.replace(/\\/g, '/');
    window.api.showItemInFolder(absPath);
    onClose();
  };

  const handleExpandCollapseSelected = (expand: boolean) => {
    const dirs = Array.from(selectedFiles)
      .filter(p => p.endsWith('/'))
      .map(p => p.slice(0, -1)); 
    setFoldersExpanded(dirs, expand);
    onClose();
  };

  const handleBlacklistDirectory = () => {
    Array.from(selectedFiles).forEach(p => {
      if (p.endsWith('/')) {
        const folderName = p.slice(0, -1).split('/').pop();
        if (folderName) addPendingBlacklistRule(folderName);
      }
    });
    onClose();
  };

  const hasDirectories = Array.from(selectedFiles).some(p => p.endsWith('/'));

  if (selectedFiles.size === 0) return null;

  return createPortal(
    <div 
      ref={menuRef}
      className="fixed z-50 w-64 bg-bg-panel border border-border-subtle rounded-lg shadow-xl overflow-hidden py-1 text-sm text-text-primary"
      style={{ top: y, left: x }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-3 py-1.5 text-xs font-semibold text-text-muted border-b border-border-subtle mb-1">
        {selectedFiles.size} Item{selectedFiles.size > 1 ? 's' : ''} Selected
      </div>
      
      <button 
        onClick={() => { applyRuleToSelection('include'); onClose(); }}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-bg-hover text-left transition-colors"
      >
        <span className="flex items-center gap-2"><Plus size={14} className="text-green-400" /> Include</span>
        <span className="text-[10px] text-text-muted font-mono">A</span>
      </button>

      <button 
        onClick={() => { applyRuleToSelection('tree-only'); onClose(); }}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-bg-hover text-left transition-colors"
      >
        <span className="flex items-center gap-2"><LayoutTemplate size={14} className="text-accent" /> Set as Tree-Only</span>
        <span className="text-[10px] text-text-muted font-mono">S</span>
      </button>
      
      <button 
        onClick={() => { applyRuleToSelection('exclude'); onClose(); }}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-bg-hover text-left transition-colors"
      >
        <span className="flex items-center gap-2"><EyeOff size={14} className="text-text-muted" /> Exclude Entirely</span>
        <span className="text-[10px] text-text-muted font-mono">D</span>
      </button>

      <div className="h-px bg-border-subtle my-1" />
      
      <button 
        onClick={handleRevealInExplorer}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-bg-hover text-left transition-colors"
      >
        <span className="flex items-center gap-2"><FolderSearch size={14} className="text-blue-400" /> Reveal in OS</span>
        <span className="text-[10px] text-text-muted font-mono">Shift+Alt+R</span>
      </button>
    
      {hasDirectories && (
        <>
          <button 
            onClick={() => handleExpandCollapseSelected(true)}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-bg-hover text-left transition-colors"
          >
            <span className="flex items-center gap-2"><ChevronsUpDown size={14} className="text-text-muted" /> Expand Selected</span>
          </button>
          <button 
            onClick={() => handleExpandCollapseSelected(false)}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-bg-hover text-left transition-colors"
          >
            <span className="flex items-center gap-2"><ChevronsDownUp size={14} className="text-text-muted" /> Collapse Selected</span>
          </button>

          <div className="h-px bg-border-subtle my-1" />

          {/* Pending Blacklist Engine Integration */}
          <HoldToConfirmButton onConfirm={handleBlacklistDirectory}>
            <span className="flex items-center gap-2 text-orange-400"><ShieldBan size={14} /> Blacklist Folder Name</span>
            <span className="text-[10px] text-orange-400/50 uppercase tracking-widest">Hold</span>
          </HoldToConfirmButton>
        </>
      )}
    
      <div className="h-px bg-border-subtle my-1" />
      
      <button 
        onClick={onClose}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover text-left transition-colors text-text-muted"
      >
        <X size={14} /> Cancel
      </button>
    </div>,
    document.body
  );
}