// src/components/tree/FileTree.tsx
import { useState, useMemo, useEffect } from 'react';
import type { FileNode } from '../../types/ipc';
import { TreeNode } from './TreeNode';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { Search, Plus, LayoutTemplate, EyeOff, X } from 'lucide-react';

interface FileTreeProps {
  node: FileNode;
  rootPath: string;
  relativePath: string;
}

export function FileTree({ node, rootPath, relativePath }: FileTreeProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { selectedFiles, setSelectedFiles, stopPainting, applyRuleToSelection } = useWorkspaceStore();

  // Pre-calculate visible paths based on search
  const visiblePaths = useMemo(() => {
    if (!searchQuery.trim()) return null; // Null means everything is visible
    
    const term = searchQuery.toLowerCase();
    const visible = new Set<string>();
    
    const checkNode = (n: FileNode, currentRelative: string): boolean => {
      const isMatch = n.name.toLowerCase().includes(term);
      let hasMatchingChild = false;
    
      if (n.children) {
        for (const child of n.children) {
          const childRelative = currentRelative ? `${currentRelative}/${child.name}` : child.name;
          if (checkNode(child, childRelative)) {
            hasMatchingChild = true;
          }
        }
      }
    
      if (isMatch || hasMatchingChild) {
        visible.add(currentRelative);
        return true;
      }
      return false;
    };
    
    checkNode(node, '');
    return visible;
  }, [node, searchQuery]);

  // Global Keyboard Listener for Selections
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (selectedFiles.size === 0) return;
    
      switch(e.key.toLowerCase()) {
        case 'a': applyRuleToSelection('include'); break;
        case 's': applyRuleToSelection('tree-only'); break;
        case 'd': applyRuleToSelection('exclude'); break;
        case 'escape': setSelectedFiles(new Set()); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFiles.size, applyRuleToSelection, setSelectedFiles]);

  return (
    <div className="flex flex-col h-full relative">
      {/* Local Tree Search */}
      <div className="mb-4 relative shrink-0">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input 
          type="text" 
          placeholder="Filter tree visually..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-bg-panel border border-border-subtle rounded-md pl-9 pr-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent transition-colors"
        />
      </div>
    
      {/* Scrollable Tree Container */}
      <div 
        className="flex-1 overflow-y-auto font-mono text-[13px] text-text-primary relative pb-16"
        onMouseUp={stopPainting}
        onMouseLeave={stopPainting}
        onClick={(e) => {
          // Click in empty background clears selection
          if (e.target === e.currentTarget) setSelectedFiles(new Set());
        }}
      >
        <TreeNode 
          node={node} 
          rootPath={rootPath} 
          relativePath={relativePath} 
          visiblePaths={visiblePaths}
        />
      </div>
    
      {/* Floating Action Bar */}
      {selectedFiles.size > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-bg-panel border border-border-subtle rounded-full shadow-2xl px-3 py-2 flex items-center gap-1 z-20 whitespace-nowrap">
          <button 
            onClick={() => applyRuleToSelection('include')} 
            className="flex items-center gap-1.5 px-3 py-1 hover:bg-bg-hover rounded text-xs font-medium transition-colors text-green-400"
            title="Include File & Export [A]"
          >
            <Plus size={14}/> Include [A]
          </button>
          <button 
            onClick={() => applyRuleToSelection('tree-only')} 
            className="flex items-center gap-1.5 px-3 py-1 hover:bg-bg-hover rounded text-xs font-medium transition-colors text-accent"
            title="Show in Tree, Skip Export [S]"
          >
            <LayoutTemplate size={14}/> Tree [S]
          </button>
          <button 
            onClick={() => applyRuleToSelection('exclude')} 
            className="flex items-center gap-1.5 px-3 py-1 hover:bg-bg-hover rounded text-xs font-medium transition-colors text-text-muted"
            title="Exclude Entirely [D]"
          >
            <EyeOff size={14}/> Exclude [D]
          </button>
          
          <div className="w-px h-4 bg-border-subtle mx-1" />
          
          <button 
            onClick={() => setSelectedFiles(new Set())} 
            className="p-1.5 hover:bg-bg-hover hover:text-red-400 rounded transition-colors text-text-muted"
            title="Clear Selection [Esc]"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}