// src/components/tree/FileTree.tsx
import { useState, useMemo, useEffect, useRef } from 'react';
import type { FileNode } from '../../types/ipc';
import { TreeNode } from './TreeNode';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useAppStore } from '../../store/appStore';
import { generateEphemeralPayload } from '../../utils/exportEngine';
import { Search, Plus, LayoutTemplate, EyeOff, X, Zap, Loader2, GripVertical, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useFlattenedTree } from './useFlattenedTree';

interface FileTreeProps {
  node: FileNode;
  rootPath: string;
  relativePath: string;
}

export function FileTree({ node, rootPath }: FileTreeProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [hasLoggedDrag, setHasLoggedDrag] = useState(false);

  const config = useAppStore(s => s.config);

  const isPainting = useWorkspaceStore(s => s.isPainting);
  const isEphemeralBuilding = useWorkspaceStore(s => s.isEphemeralBuilding);
  const ephemeralDragPaths = useWorkspaceStore(s => s.ephemeralDragPaths);

  const [stats, setStats] = useState({ fileCount: 0, kb: '0.0', tokens: '0', rawBytes: 0, rawTokens: 0 });
  const [hasSelection, setHasSelection] = useState(false);

  const [exactTokens, setExactTokens] = useState<number | null>(null);
  const [isCalculatingTokens, setIsCalculatingTokens] = useState(false);

  // --- Virtualization Architecture ---
  const expandedFolders = useWorkspaceStore(s => s.expandedFolders);
  const hideExcluded = useWorkspaceStore(s => s.hideExcluded);
  const hideTreeOnly = useWorkspaceStore(s => s.hideTreeOnly);
  const setHideExcluded = useWorkspaceStore(s => s.setHideExcluded);
  const setHideTreeOnly = useWorkspaceStore(s => s.setHideTreeOnly);
  const expandAllFolders = useWorkspaceStore(s => s.expandAllFolders);
  const collapseAllFolders = useWorkspaceStore(s => s.collapseAllFolders);
  const includes = useWorkspaceStore(s => s.includes);
  const excludes = useWorkspaceStore(s => s.excludes);
  const treeOnly = useWorkspaceStore(s => s.treeOnly);
  const parentRef = useRef<HTMLDivElement>(null);

  const bindScrollGetter = useWorkspaceStore(s => s.bindScrollGetter);
  const targetScrollY = useWorkspaceStore(s => s.targetScrollY);
  const setTargetScrollY = useWorkspaceStore(s => s.setTargetScrollY);

  useEffect(() => {
    bindScrollGetter(() => {
      return parentRef.current ? parentRef.current.scrollTop : 0;
    });
  }, [bindScrollGetter]);

  useEffect(() => {
    if (targetScrollY !== null && parentRef.current) {
      parentRef.current.scrollTop = targetScrollY;
      setTargetScrollY(null);
    }
  }, [targetScrollY, setTargetScrollY]);

  // --- Marquee & Drag Engine ---
  const [marquee, setMarquee] = useState<{ startIndex: number; currentIndex: number; mode: 'add' | 'remove' } | null>(null);

  const baseSelectionRef = useRef<Set<string>>(new Set());
  const dragStateRef = useRef<{ startIndex: number, mode: 'add' | 'remove' } | null>(null);
  const lastPointerYRef = useRef<number>(0);
  const autoScrollRafRef = useRef<number | null>(null);

  // Deferred Calculation Engine
  useEffect(() => {
    const calculateStats = (rootNode: FileNode, selFiles: Set<string>) => {
      let fileCount = 0;
      let totalBytes = 0;
    
      if (selFiles.size === 0) return { fileCount, kb: '0.0', tokens: '0', rawBytes: 0, rawTokens: 0 };
    
      const traverse = (n: FileNode, currentRelative: string, isParentSelected: boolean) => {
        const isDir = n.type === 'directory';
        const pattern = isDir ? (currentRelative ? `${currentRelative}/` : '') : currentRelative;
        const isSelected = selFiles.has(pattern) || isParentSelected;
        
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
    
      traverse(rootNode, '', false);
      const rawTokens = Math.round(totalBytes / 4);
    
      return {
        fileCount,
        kb: (totalBytes / 1024).toFixed(1),
        tokens: rawTokens.toLocaleString(),
        rawBytes: totalBytes,
        rawTokens: rawTokens
      };
    };
    
    const unsub = useWorkspaceStore.subscribe((state, prevState) => {
      const selectionChanged = state.selectedFiles !== prevState.selectedFiles;
      const justStoppedPainting = prevState.isPainting && !state.isPainting;
    
      if (selectionChanged) {
        setHasSelection(state.selectedFiles.size > 0);
      }
    
      // ONLY run the heavy O(N) calculation if we are NOT actively painting
      // This ensures 60fps marquee selections without blocking the UI thread
      if (!state.isPainting && (selectionChanged || justStoppedPainting)) {
        setStats(calculateStats(node, state.selectedFiles));
      }
    });
    
    // Initial calc on mount
    const initialStore = useWorkspaceStore.getState();
    setHasSelection(initialStore.selectedFiles.size > 0);
    setStats(calculateStats(node, initialStore.selectedFiles));
    
    return unsub;
  }, [node]);

  // Exact BPE Token Calculation Engine (Offline/Async)
  useEffect(() => {
    if (isPainting) {
      setExactTokens(null);
      setIsCalculatingTokens(false);
      return;
    }
    
    if (!hasSelection) {
      setExactTokens(0);
      setIsCalculatingTokens(false);
      return;
    }
    
    const calculateExactTokens = async () => {
      setIsCalculatingTokens(true);
      const state = useWorkspaceStore.getState();
      
      // Filter out directory stubs and map to absolute paths for Node.js
      const filePaths = Array.from(state.selectedFiles)
        .filter(p => !p.endsWith('/'))
        .map(p => `${rootPath}/${p}`.replace(/\\/g, '/'));
    
      if (filePaths.length === 0) {
        setExactTokens(0);
        setIsCalculatingTokens(false);
        return;
      }
    
      try {
        const tokens = await window.api.calculateTokens(filePaths);
        setExactTokens(tokens);
      } catch (e) {
        console.error('Failed to calculate exact tokens:', e);
      } finally {
        setIsCalculatingTokens(false);
      }
    };
    
    // Debounce to ensure it only runs once a rapid click/select event settles
    const timer = setTimeout(calculateExactTokens, 300);
    return () => clearTimeout(timer);
  }, [isPainting, hasSelection, stats.fileCount, rootPath]);

  const handleStageEphemeral = async () => {
    const state = useWorkspaceStore.getState();
    state.setExportState({ isEphemeralBuilding: true, ephemeralDragPaths: null });
    setHasLoggedDrag(false); 
    
    try {
      const payload = generateEphemeralPayload(rootPath, node, state.selectedFiles, state.compressions, config.extensionOverrides);
      const paths = await window.api.stageEphemeralExport(payload);
      state.setExportState({ isEphemeralBuilding: false, ephemeralDragPaths: paths });
    } catch (e) {
      console.error('Failed to generate ephemeral payload', e);
      state.setExportState({ isEphemeralBuilding: false, ephemeralDragPaths: null });
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

  const flatNodes = useFlattenedTree(node, expandedFolders, visiblePaths, includes, excludes, treeOnly, hideExcluded, hideTreeOnly);

  // ANTI-STALE CLOSURE REF: Guarantees the drag engine always sees the live tree
  const flatNodesRef = useRef(flatNodes);
  useEffect(() => {
    flatNodesRef.current = flatNodes;
  }, [flatNodes]);

  const ROW_HEIGHT = 28;

  const virtualizer = useVirtualizer({
    count: flatNodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15, 
  });

  // --- 1D Mathematical Marquee System ---

  const updateSelectionFromPointer = (clientY: number) => {
    if (!parentRef.current || !dragStateRef.current) return;
    const container = parentRef.current;
    const rect = container.getBoundingClientRect();
    
    const offsetY = container.scrollTop + (clientY - rect.top);
    let currentIndex = Math.floor(offsetY / ROW_HEIGHT);
    currentIndex = Math.max(0, Math.min(currentIndex, flatNodesRef.current.length - 1));
    
    setMarquee(prev => prev ? { ...prev, currentIndex } : null);
    
    const { startIndex, mode } = dragStateRef.current;
    const minIdx = Math.min(startIndex, currentIndex);
    const maxIdx = Math.max(startIndex, currentIndex);
    
    const newSelection = new Set(baseSelectionRef.current);
    for (let i = minIdx; i <= maxIdx; i++) {
      const flatNode = flatNodesRef.current[i];
      if (!flatNode) continue;
      const pattern = flatNode.node.type === 'directory' ? `${flatNode.relativePath}/` : flatNode.relativePath;
      
      if (mode === 'add') newSelection.add(pattern);
      else newSelection.delete(pattern);
    }
    
    useWorkspaceStore.getState().setSelectedFiles(newSelection);
  };

  const handlePointerMove = (e: PointerEvent) => {
    lastPointerYRef.current = e.clientY;
    updateSelectionFromPointer(e.clientY);
    
    if (!autoScrollRafRef.current) {
      startAutoScroll();
    }
  };

  const startAutoScroll = () => {
    const loop = () => {
      if (!parentRef.current || !dragStateRef.current) {
        autoScrollRafRef.current = null;
        return;
      }
      
      const container = parentRef.current;
      const rect = container.getBoundingClientRect();
      const y = lastPointerYRef.current;
    
      const SCROLL_SPEED = 15;
      const THRESHOLD = 40;
    
      let scrolled = false;
      if (y < rect.top + THRESHOLD) {
        container.scrollTop -= SCROLL_SPEED;
        scrolled = true;
      } else if (y > rect.bottom - THRESHOLD) {
        container.scrollTop += SCROLL_SPEED;
        scrolled = true;
      }
    
      if (scrolled) {
        updateSelectionFromPointer(y);
        autoScrollRafRef.current = requestAnimationFrame(loop);
      } else {
        autoScrollRafRef.current = null; 
      }
    };
    autoScrollRafRef.current = requestAnimationFrame(loop);
  };

  const handlePointerUp = () => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    if (autoScrollRafRef.current) cancelAnimationFrame(autoScrollRafRef.current);
    autoScrollRafRef.current = null;
    dragStateRef.current = null;
    setMarquee(null);
    useWorkspaceStore.getState().setIsPainting(false);
  };

  const handleRowPointerDown = (e: React.PointerEvent, index: number, pattern: string, isDirectory: boolean) => {
    if (e.button !== 0) return;
    
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX - rect.left <= 32) return; 
    
    e.stopPropagation();
    e.preventDefault(); 
    
    const store = useWorkspaceStore.getState();
    const hasPattern = store.selectedFiles.has(pattern);
    
    let mode: 'add' | 'remove' = 'add';
    let clearFirst = false;
    
    if (e.shiftKey) mode = 'add';
    else if (e.altKey) mode = 'remove';
    else if (e.ctrlKey || e.metaKey) mode = hasPattern ? 'remove' : 'add';
    else {
      mode = 'add';
      clearFirst = true;
      if (!isDirectory) store.setActiveFile(pattern);
    }
    
    const baseSelection = clearFirst ? new Set<string>() : new Set(store.selectedFiles);
    if (mode === 'add') baseSelection.add(pattern);
    else baseSelection.delete(pattern);
    
    store.setSelectedFiles(baseSelection);
    store.setIsPainting(true);
    
    setMarquee({ startIndex: index, currentIndex: index, mode });
    
    baseSelectionRef.current = baseSelection;
    dragStateRef.current = { startIndex: index, mode };
    lastPointerYRef.current = e.clientY;
    
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent keybinds from firing inside search bars or the Monaco Editor
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
      
      const state = useWorkspaceStore.getState();

      // Select All binding (Ctrl+A / Cmd+A)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const allVisiblePatterns = flatNodesRef.current.map(fn => 
          fn.node.type === 'directory' ? `${fn.relativePath}/` : fn.relativePath
        );
        state.setSelectedFiles(new Set(allVisiblePatterns));
        return;
      }
      
      // Stop execution for active-selection actions if nothing is selected
      if (state.selectedFiles.size === 0) return;

      // Reveal in OS binding
      if (e.shiftKey && e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        const firstSelected = Array.from(state.selectedFiles)[0];
        if (firstSelected) {
          const cleanPath = firstSelected.replace(/\/$/, '');
          const absPath = `${rootPath}/${cleanPath}`.replace(/\\/g, '/');
          window.api.showItemInFolder(absPath);
        }
        return;
      }

      // Ignore standard keybinds if the user is holding Ctrl/Cmd/Alt 
      // (prevents conflict with Ctrl+A, Cmd+S, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) return;
    
      switch(e.key.toLowerCase()) {
        case 'a': state.applyRuleToSelection('include'); break;
        case 's': state.applyRuleToSelection('tree-only'); break;
        case 'd': state.applyRuleToSelection('exclude'); break;
        case 'escape': state.setSelectedFiles(new Set()); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rootPath]);

  return (
    <div className="flex flex-col h-full relative @container">
      {/* Local Tree Search & Toggles */}
      <div className="mb-4 flex flex-col gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text" 
              placeholder="Filter tree visually..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-bg-panel border border-border-subtle rounded-md pl-9 pr-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="flex items-center bg-bg-panel border border-border-subtle rounded-md p-0.5 shrink-0">
            <button
              onClick={() => setHideExcluded(!hideExcluded)}
              className={`p-1.5 rounded transition-colors ${hideExcluded ? 'bg-bg-hover text-accent' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}`}
              title="Toggle Excluded Files"
            >
              <EyeOff size={14} />
            </button>
            <button
              onClick={() => setHideTreeOnly(!hideTreeOnly)}
              className={`p-1.5 rounded transition-colors ${hideTreeOnly ? 'bg-bg-hover text-accent' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}`}
              title="Toggle Tree-Only Files"
            >
              <LayoutTemplate size={14} />
            </button>
            <div className="w-px h-4 bg-border-subtle mx-0.5" />
            <button
              onClick={expandAllFolders}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
              title="Expand All Folders"
            >
              <ChevronsUpDown size={14} />
            </button>
            <button
              onClick={collapseAllFolders}
              className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
              title="Collapse All Folders"
            >
              <ChevronsDownUp size={14} />
            </button>
          </div>
        </div>
      </div>
    
      {/* Scrollable Virtualized Tree Container */}
      <div 
        ref={parentRef}
        className={`flex-1 overflow-y-auto font-mono text-text-primary relative pb-4 select-none ${isPainting ? 'is-painting' : ''}`}
        style={{ fontSize: config.theme.font.size }}
        onClick={(e) => {
          if (e.target === e.currentTarget) useWorkspaceStore.getState().setSelectedFiles(new Set());
        }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const flatNode = flatNodes[virtualRow.index];
            const isDirectory = flatNode.node.type === 'directory';
            const pattern = isDirectory ? `${flatNode.relativePath}/` : flatNode.relativePath;
            
            return (
              <TreeNode
                key={flatNode.relativePath}
                node={flatNode.node}
                rootPath={rootPath}
                relativePath={flatNode.relativePath}
                depth={flatNode.depth}
                onPointerDown={(e) => handleRowPointerDown(e, virtualRow.index, pattern, isDirectory)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              />
            );
          })}
          
          {/* Virtual Selection Brush */}
          {marquee && (
            <div
              style={{
                position: 'absolute',
                top: `${Math.min(marquee.startIndex, marquee.currentIndex) * ROW_HEIGHT}px`,
                height: `${(Math.abs(marquee.currentIndex - marquee.startIndex) + 1) * ROW_HEIGHT}px`,
                left: 0,
                right: 0,
                backgroundColor: marquee.mode === 'add' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${marquee.mode === 'add' ? 'rgba(139, 92, 246, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
                pointerEvents: 'none',
                zIndex: 10,
                borderRadius: '4px'
              }}
            />
          )}
        </div>
      </div>
       
      {/* Persistent Stats & Actions Bar */}
      <div className={`shrink-0 bg-bg-base border-t border-border-subtle p-3 flex flex-col gap-3 transition-all duration-200 z-20 ${hasSelection ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        <div className="flex items-center justify-between text-xs text-text-muted px-1">
          <span className="font-medium text-text-primary">{hasSelection ? stats.fileCount : 0} Files Selected</span>
          <div className="flex gap-4">
            <span className="hidden @[200px]:inline">{stats.kb} KB</span>
            <span className={`flex items-center gap-1.5 ${hasSelection ? 'text-accent' : ''}`}>
              {isCalculatingTokens ? (
                <Loader2 size={12} className="animate-spin" />
              ) : <Zap size={12} />}
              {exactTokens !== null ? exactTokens.toLocaleString() : `~${stats.tokens}`} Tokens
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => useWorkspaceStore.getState().applyRuleToSelection('include')} 
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-bg-hover hover:bg-green-500/20 rounded text-xs font-medium transition-colors text-green-400 border border-transparent hover:border-green-500/30 whitespace-nowrap"
            title="Include File & Export [A]"
          >
            <Plus size={14}/> <span className="hidden @[240px]:inline">Include</span>
          </button>
          <button 
            onClick={() => useWorkspaceStore.getState().applyRuleToSelection('tree-only')} 
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-bg-hover hover:bg-accent/20 rounded text-xs font-medium transition-colors text-accent border border-transparent hover:border-accent/30 whitespace-nowrap"
            title="Show in Tree, Skip Export [S]"
          >
            <LayoutTemplate size={14}/> <span className="hidden @[240px]:inline">Tree</span>
          </button>
          <button 
            onClick={() => useWorkspaceStore.getState().applyRuleToSelection('exclude')} 
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-bg-hover hover:bg-red-500/20 rounded text-xs font-medium transition-colors text-text-muted hover:text-red-400 border border-transparent hover:border-red-500/30 whitespace-nowrap"
            title="Exclude Entirely [D]"
          >
            <EyeOff size={14}/> <span className="hidden @[240px]:inline">Exclude</span>
          </button>
          
          <button 
            onClick={() => useWorkspaceStore.getState().setSelectedFiles(new Set())} 
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
              const state = useWorkspaceStore.getState();
              if (!hasLoggedDrag) {
                state.addHistoryEntry({
                  date: new Date().toISOString(),
                  fileCount: stats.fileCount,
                  totalSize: stats.rawBytes,
                  estimatedTokens: stats.rawTokens,
                  files: Array.from(state.selectedFiles)
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