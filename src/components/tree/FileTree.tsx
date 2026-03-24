// src/components/tree/FileTree.tsx
import { useState, useMemo, useEffect } from 'react';
import type { FileNode } from '../../types/ipc';
import { TreeNode } from './TreeNode';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useAppStore } from '../../store/appStore';
import { generateEphemeralPayload } from '../../utils/exportEngine';
import { Search, Plus, LayoutTemplate, EyeOff, X, Zap, Loader2, GripVertical } from 'lucide-react';

interface FileTreeProps {
  node: FileNode;
  rootPath: string;
  relativePath: string;
}

export function FileTree({ node, rootPath, relativePath }: FileTreeProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [hasLoggedDrag, setHasLoggedDrag] = useState(false);

  const config = useAppStore(s => s.config);

  const { 
    selectedFiles, setSelectedFiles, stopPainting, applyRuleToSelection, 
    compressions, isEphemeralBuilding, ephemeralDragPaths, setExportState,
    addHistoryEntry
  } = useWorkspaceStore();

  const isPainting = useWorkspaceStore(s => s.isPainting);
  const hasSelection = selectedFiles.size > 0;

  const selectionStats = useMemo(() => {
    let fileCount = 0;
    let totalBytes = 0;
    
    if (selectedFiles.size === 0) return { fileCount, kb: '0.0', tokens: '0', rawBytes: 0, rawTokens: 0 };
    
    const traverse = (n: FileNode, currentRelative: string, isParentSelected: boolean) => {
      const isDir = n.type === 'directory';
      const pattern = isDir ? (currentRelative ? `${currentRelative}/` : '') : currentRelative;
      const isSelected = selectedFiles.has(pattern) || isParentSelected;
    
      if (!isDir && isSelected) {
        fileCount++;
        totalBytes += n.size;
      }
    
      if (n.children) {
        n.children.forEach(child => {
          const childRelative = currentRelative ? `${currentRelative}/${child.name}` : child.name;
          traverse(child, childRelative, isSelected);
        });
      }
    };
    
    traverse(node, '', false);
    
    const rawTokens = Math.round(totalBytes / 4);
    
    return {
      fileCount,
      kb: (totalBytes / 1024).toFixed(1),
      tokens: rawTokens.toLocaleString(),
      rawBytes: totalBytes,
      rawTokens: rawTokens
    };
  }, [node, selectedFiles]);

  const handleStageEphemeral = async () => {
    setExportState({ isEphemeralBuilding: true, ephemeralDragPaths: null });
    setHasLoggedDrag(false); // Reset logging flag for the new payload
    
    try {
      const payload = generateEphemeralPayload(rootPath, node, selectedFiles, compressions, config.extensionOverrides);
      const paths = await window.api.stageEphemeralExport(payload);
      setExportState({ isEphemeralBuilding: false, ephemeralDragPaths: paths });
    } catch (e) {
      console.error('Failed to generate ephemeral payload', e);
      setExportState({ isEphemeralBuilding: false, ephemeralDragPaths: null });
    }
  };

  const visiblePaths = useMemo(() => {
    if (!searchQuery.trim()) return null; 
    
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
    <div className="flex flex-col h-full relative @container">
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
        className={`flex-1 overflow-y-auto font-mono text-text-primary relative pb-4 ${isPainting ? 'is-painting' : ''}`}
        style={{ fontSize: config.theme.font.size }}
        onMouseUp={stopPainting}
        onMouseLeave={stopPainting}
        onClick={(e) => {
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
       
      {/* Persistent Stats & Actions Bar */}
      <div className={`shrink-0 bg-bg-base border-t border-border-subtle p-3 flex flex-col gap-3 transition-all duration-200 z-20 ${hasSelection ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        <div className="flex items-center justify-between text-xs text-text-muted px-1">
          <span className="font-medium text-text-primary">{hasSelection ? selectionStats.fileCount : 0} Files Selected</span>
          <div className="flex gap-4">
            <span className="hidden @[200px]:inline">{selectionStats.kb} KB</span>
            <span className={hasSelection ? 'text-accent' : ''}>~{selectionStats.tokens} Tokens</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => applyRuleToSelection('include')} 
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-bg-hover hover:bg-green-500/20 rounded text-xs font-medium transition-colors text-green-400 border border-transparent hover:border-green-500/30 whitespace-nowrap"
            title="Include File & Export [A]"
          >
            <Plus size={14}/> <span className="hidden @[240px]:inline">Include</span>
          </button>
          <button 
            onClick={() => applyRuleToSelection('tree-only')} 
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-bg-hover hover:bg-accent/20 rounded text-xs font-medium transition-colors text-accent border border-transparent hover:border-accent/30 whitespace-nowrap"
            title="Show in Tree, Skip Export [S]"
          >
            <LayoutTemplate size={14}/> <span className="hidden @[240px]:inline">Tree</span>
          </button>
          <button 
            onClick={() => applyRuleToSelection('exclude')} 
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-bg-hover hover:bg-red-500/20 rounded text-xs font-medium transition-colors text-text-muted hover:text-red-400 border border-transparent hover:border-red-500/30 whitespace-nowrap"
            title="Exclude Entirely [D]"
          >
            <EyeOff size={14}/> <span className="hidden @[240px]:inline">Exclude</span>
          </button>
          
          <button 
            onClick={() => setSelectedFiles(new Set())} 
            className="px-2 py-1.5 bg-bg-hover hover:bg-red-500/20 rounded transition-colors text-text-muted hover:text-red-400 border border-transparent hover:border-red-500/30 shrink-0"
            title="Clear Selection [Esc]"
          >
            <X size={14} />
          </button>
        </div>
        
        <div className="h-px bg-border-subtle my-0.5" />
      
        {isEphemeralBuilding ? (
          <div className="w-full flex items-center justify-center gap-2 py-1.5 text-accent text-xs font-medium">
            <Loader2 size={14} className="animate-spin" /> Packaging Context...
          </div>
        ) : ephemeralDragPaths ? (
          <button
            draggable
            onDragStart={(e) => {
              e.preventDefault();
              if (!hasLoggedDrag) {
                addHistoryEntry({
                  date: new Date().toISOString(),
                  fileCount: selectionStats.fileCount,
                  totalSize: selectionStats.rawBytes,
                  estimatedTokens: selectionStats.rawTokens,
                  files: Array.from(selectedFiles)
                });
                setHasLoggedDrag(true);
              }
              window.api.startDrag(ephemeralDragPaths);
            }}
            className="w-full flex items-center justify-center gap-2 py-1.5 bg-accent text-white rounded text-xs font-semibold hover:bg-accent/90 cursor-grab active:cursor-grabbing shadow-sm transition-all"
          >
            <GripVertical size={14} className="opacity-70" /> Drag Context Package
          </button>
        ) : (
          <button
            onClick={handleStageEphemeral}
            className="w-full flex items-center justify-center gap-2 py-1.5 bg-bg-hover text-text-primary rounded text-xs font-medium hover:bg-accent/20 hover:text-accent border border-transparent hover:border-accent/30 transition-all"
          >
            <Zap size={14} /> Package Context
          </button>
        )}
      </div>
    </div>
  );
}