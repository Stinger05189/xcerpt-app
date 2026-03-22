// src/components/tree/ContextMenu.tsx
import { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { X, EyeOff, LayoutTemplate, Plus } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

export function ContextMenu({ x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { selectedFiles, applyRuleToSelection } = useWorkspaceStore();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [onClose]);

  if (selectedFiles.size === 0) return null;

  return (
    <div 
      ref={menuRef}
      className="fixed z-50 w-56 bg-bg-panel border border-border-subtle rounded-lg shadow-xl overflow-hidden py-1 text-sm text-text-primary"
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
        onClick={onClose}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover text-left transition-colors text-text-muted"
      >
        <X size={14} /> Cancel
      </button>
    </div>
  );
}