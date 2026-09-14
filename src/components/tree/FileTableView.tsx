// src/components/tree/FileTableView.tsx
import { useState, useMemo, useEffect, useRef } from 'react';
import type { FileNode } from '../../types/ipc';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useAppStore } from '../../store/appStore';
import { toScopedPathKey, parseScopedPathKey, ScopedRuleIndex } from '../../utils/filterEngine';
import { calculateTrueSize } from '../../utils/exportEngine';
import { generateEphemeralPayload } from '../../utils/exportEngine';
import { ContextMenu } from './ContextMenu';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  Search, 
  FolderTree, 
  Plus, 
  LayoutTemplate, 
  EyeOff, 
  X, 
  Zap, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  File, 
  Folder, 
  Edit3, 
  Loader2, 
  GripVertical
} from 'lucide-react';

interface FileTableViewProps {
  rootPath: string;
  node: FileNode;
  onToggleView?: () => void;
}

type TableSubMode = 'files' | 'folders';
type SortColumn = 'name' | 'path' | 'size' | 'tokens' | 'skips' | 'type' | 'status';
type SortDirection = 'asc' | 'desc';

interface FlatFileRecord {
  kind: 'file';
  name: string;
  relativePath: string;
  extension: string;
  size: number;
  trueSize: number;
  tokens: number;
  skips: number;
  skippedLines: number;
  status: 'included' | 'tree-only' | 'excluded';
  scopedKey: string;
}

interface FlatFolderRecord {
  kind: 'folder';
  name: string;
  relativePath: string;
  totalFiles: number;
  includedFiles: number;
  totalSize: number;
  trueSize: number;
  tokens: number;
  skips: number;
  status: 'included' | 'tree-only' | 'excluded';
  scopedKey: string;
}

type FlatRecord = FlatFileRecord | FlatFolderRecord;

export function FileTableView({ rootPath, node, onToggleView }: FileTableViewProps) {
  const [subMode, setSubMode] = useState<TableSubMode>('files');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterExported, setFilterExported] = useState(false);
  const [filterTreeOnly, setFilterTreeOnly] = useState(false);
  const [filterExcluded, setFilterExcluded] = useState(false);
  const [filterHasSkips, setFilterHasSkips] = useState(false);
  const [selectedExtension, setSelectedExtension] = useState<string>('ALL');

  const [sortColumn, setSortColumn] = useState<SortColumn>('size');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [hasLoggedDrag, setHasLoggedDrag] = useState(false);
  const [contextMenuState, setContextMenuState] = useState<{ x: number; y: number; relativePath: string } | null>(null);

  const config = useAppStore(s => s.config);

  const includes = useWorkspaceStore(s => s.includes);
  const excludes = useWorkspaceStore(s => s.excludes);
  const treeOnly = useWorkspaceStore(s => s.treeOnly);
  const isWhitelistMode = useWorkspaceStore(s => s.isWhitelistMode);
  const compressions = useWorkspaceStore(s => s.compressions);
  const selectedFiles = useWorkspaceStore(s => s.selectedFiles);
  const isPainting = useWorkspaceStore(s => s.isPainting);
  const rawTrees = useWorkspaceStore(s => s.rawTrees);
  const rootPaths = useWorkspaceStore(s => s.rootPaths);
  const isEphemeralBuilding = useWorkspaceStore(s => s.isEphemeralBuilding);
  const ephemeralDragPaths = useWorkspaceStore(s => s.ephemeralDragPaths);
  const setLeftPaneMode = useWorkspaceStore(s => s.setLeftPaneMode);

  const [stats, setStats] = useState({ fileCount: 0, kb: '0.0', tokens: '0', rawBytes: 0, rawTokens: 0 });
  const [hasSelection, setHasSelection] = useState(false);
  const [exactTokens, setExactTokens] = useState<number | null>(null);
  const [isCalculatingTokens, setIsCalculatingTokens] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [marquee, setMarquee] = useState<{ startIndex: number; currentIndex: number; mode: 'add' | 'remove' } | null>(null);
  const baseSelectionRef = useRef<Set<string>>(new Set());
  const dragStateRef = useRef<{ startIndex: number; mode: 'add' | 'remove' } | null>(null);
  const lastPointerYRef = useRef<number>(0);
  const startPointerYRef = useRef<number>(0);
  const hasDraggedRef = useRef<boolean>(false);
  const clickTargetRef = useRef<{ rootPath: string; relativePath: string; isDir: boolean } | null>(null);

  // 1. Build Index & Extract Flat File & Folder Records
  const { allFileRecords, allFolderRecords, availableExtensions } = useMemo(() => {
    const index = new ScopedRuleIndex(includes, excludes, treeOnly, isWhitelistMode);
    const files: FlatFileRecord[] = [];
    const folders: FlatFolderRecord[] = [];
    const extCountMap: Record<string, number> = {};

    const walk = (n: FileNode, currentRel: string) => {
      const isDir = n.type === 'directory';
      const cleanRel = isDir 
        ? (currentRel ? `${currentRel}/` : '')
        : currentRel;

      const status = index.getStatus(rootPath, cleanRel, isDir);
      const scopedKey = toScopedPathKey(rootPath, cleanRel, isDir);

      if (!isDir) {
        const fileComps = compressions[scopedKey] || compressions[cleanRel] || [];
        const skippedLines = fileComps.reduce((sum, c) => sum + (c.lineCount || 0), 0);
        const estimatedTotalLines = Math.max(1, Math.round(n.size / 40));
        const trueSize = calculateTrueSize(n.size, estimatedTotalLines, skippedLines);
        const tokens = Math.round(trueSize / 4);

        const parts = n.name.split('.');
        const ext = parts.length > 1 ? `.${parts.pop()!.toLowerCase()}` : 'no-ext';
        extCountMap[ext] = (extCountMap[ext] || 0) + 1;

        files.push({
          kind: 'file',
          name: n.name,
          relativePath: cleanRel,
          extension: ext,
          size: n.size,
          trueSize,
          tokens,
          skips: fileComps.length,
          skippedLines,
          status,
          scopedKey
        });
      } else {
        if (currentRel !== '') {
          // Compute aggregated statistics for folder
          let totalFiles = 0;
          let includedFiles = 0;
          let totalSize = 0;
          let trueSize = 0;
          let skips = 0;

          const aggregate = (childNode: FileNode, cRel: string) => {
            if (childNode.type === 'file') {
              totalFiles++;
              totalSize += childNode.size;
              const cStatus = index.getStatus(rootPath, cRel, false);
              const cScoped = toScopedPathKey(rootPath, cRel, false);
              const cComps = compressions[cScoped] || compressions[cRel] || [];
              const sLines = cComps.reduce((sum, c) => sum + (c.lineCount || 0), 0);
              const estLines = Math.max(1, Math.round(childNode.size / 40));
              const tSize = calculateTrueSize(childNode.size, estLines, sLines);
              skips += cComps.length;
              if (cStatus === 'included') {
                includedFiles++;
                trueSize += tSize;
              }
            } else if (childNode.children) {
              childNode.children.forEach(c => aggregate(c, `${cRel}/${c.name}`));
            }
          };

          if (n.children) {
            n.children.forEach(c => aggregate(c, `${currentRel}/${c.name}`));
          }

          folders.push({
            kind: 'folder',
            name: n.name,
            relativePath: cleanRel,
            totalFiles,
            includedFiles,
            totalSize,
            trueSize,
            tokens: Math.round(trueSize / 4),
            skips,
            status,
            scopedKey
          });
        }

        if (n.children) {
          n.children.forEach(c => {
            const nextRel = currentRel ? `${currentRel}/${c.name}` : c.name;
            walk(c, nextRel);
          });
        }
      }
    };

    walk(node, '');

    const sortedExtensions = Object.entries(extCountMap)
      .sort((a, b) => b[1] - a[1])
      .map(([ext, count]) => ({ ext, count }));

    return { allFileRecords: files, allFolderRecords: folders, availableExtensions: sortedExtensions };
  }, [node, rootPath, includes, excludes, treeOnly, isWhitelistMode, compressions]);

  // 2. Filter & Sort Records
  const filteredRecords = useMemo(() => {
    const rawList: FlatRecord[] = subMode === 'files' ? allFileRecords : allFolderRecords;
    const term = searchQuery.toLowerCase().trim();

    return rawList.filter(rec => {
      // Search match
      if (term) {
        const matchesName = rec.name.toLowerCase().includes(term);
        const matchesPath = rec.relativePath.toLowerCase().includes(term);
        if (!matchesName && !matchesPath) return false;
      }

      // Status filters
      if (filterExported && rec.status !== 'included') return false;
      if (filterTreeOnly && rec.status !== 'tree-only') return false;
      if (filterExcluded && rec.status !== 'excluded') return false;
      if (filterHasSkips && rec.skips === 0) return false;

      // Extension filter (in files mode)
      if (subMode === 'files' && selectedExtension !== 'ALL') {
        const fileRec = rec as FlatFileRecord;
        if (fileRec.extension !== selectedExtension) return false;
      }

      return true;
    }).sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'size': {
          const aSize = a.kind === 'file' ? a.size : a.totalSize;
          const bSize = b.kind === 'file' ? b.size : b.totalSize;
          cmp = aSize - bSize;
          break;
        }
        case 'tokens':
          cmp = a.tokens - b.tokens;
          break;
        case 'skips':
          cmp = a.skips - b.skips;
          break;
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'path':
          cmp = a.relativePath.localeCompare(b.relativePath);
          break;
        case 'type':
          cmp = (a.kind === 'file' ? (a as FlatFileRecord).extension : 'dir')
            .localeCompare(b.kind === 'file' ? (b as FlatFileRecord).extension : 'dir');
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [
    subMode, 
    allFileRecords, 
    allFolderRecords, 
    searchQuery, 
    filterExported, 
    filterTreeOnly, 
    filterExcluded, 
    filterHasSkips, 
    selectedExtension, 
    sortColumn, 
    sortDirection
  ]);

  const filteredRecordsRef = useRef(filteredRecords);
  useEffect(() => {
    filteredRecordsRef.current = filteredRecords;
  }, [filteredRecords]);

  // 3. Selection Stats Synchronization
  useEffect(() => {
    const calculateStats = (selFiles: Set<string>) => {
      let fileCount = 0;
      let totalBytes = 0;

      if (selFiles.size === 0) return { fileCount, kb: '0.0', tokens: '0', rawBytes: 0, rawTokens: 0 };

      selFiles.forEach(key => {
        const { rootId, relativePath } = parseScopedPathKey(key);
        if (relativePath.endsWith('/')) return;
        const targetTree = rawTrees[rootId] || node;
        
        const findSize = (n: FileNode, curRel: string): number => {
          if (curRel === relativePath && n.type === 'file') return n.size;
          if (n.children) {
            for (const c of n.children) {
              const nextRel = curRel ? `${curRel}/${c.name}` : c.name;
              const res = findSize(c, nextRel);
              if (res > 0) return res;
            }
          }
          return 0;
        };

        const sz = findSize(targetTree, '');
        if (sz > 0) {
          fileCount++;
          totalBytes += sz;
        }
      });

      const rawTokens = Math.round(totalBytes / 4);
      return {
        fileCount,
        kb: (totalBytes / 1024).toFixed(1),
        tokens: rawTokens.toLocaleString(),
        rawBytes: totalBytes,
        rawTokens
      };
    };

    const unsub = useWorkspaceStore.subscribe((state, prevState) => {
      const selectionChanged = state.selectedFiles !== prevState.selectedFiles;
      const justStoppedPainting = prevState.isPainting && !state.isPainting;

      if (selectionChanged) {
        setHasSelection(state.selectedFiles.size > 0);
        setContextMenuState(null);
      }

      if (!state.isPainting && (selectionChanged || justStoppedPainting)) {
        setStats(calculateStats(state.selectedFiles));
      }
    });

    const initStore = useWorkspaceStore.getState();
    setHasSelection(initStore.selectedFiles.size > 0);
    setStats(calculateStats(initStore.selectedFiles));

    return unsub;
  }, [node, rawTrees]);

  // 4. Exact BPE Tokenization
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

    const calculateExact = async () => {
      setIsCalculatingTokens(true);
      const state = useWorkspaceStore.getState();

      const filePaths: string[] = [];
      state.selectedFiles.forEach(k => {
        const { rootId, relativePath } = parseScopedPathKey(k);
        if (!relativePath.endsWith('/')) {
          const r = rootId || rootPath;
          filePaths.push(`${r}/${relativePath}`.replace(/\\/g, '/'));
        }
      });

      if (filePaths.length === 0) {
        setExactTokens(0);
        setIsCalculatingTokens(false);
        return;
      }

      try {
        const tokens = await window.api.calculateTokens(filePaths);
        setExactTokens(tokens);
      } catch {
        // Ignore fallback
      } finally {
        setIsCalculatingTokens(false);
      }
    };

    const timer = setTimeout(calculateExact, 300);
    return () => clearTimeout(timer);
  }, [isPainting, hasSelection, stats.fileCount, rootPath]);

  // 5. Virtualizer Setup
  const ROW_HEIGHT = 30;
  const virtualizer = useVirtualizer({
    count: filteredRecords.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  // 6. Pointer & Marquee Handlers with Auto-Blur
  const handleSortClick = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDirection(col === 'size' || col === 'tokens' || col === 'skips' ? 'desc' : 'asc');
    }
  };

  const updateSelectionFromPointer = (clientY: number) => {
    if (!parentRef.current || !dragStateRef.current) return;
    const container = parentRef.current;
    const rect = container.getBoundingClientRect();

    const offsetY = container.scrollTop + (clientY - rect.top);
    let currentIndex = Math.floor(offsetY / ROW_HEIGHT);
    currentIndex = Math.max(0, Math.min(currentIndex, filteredRecordsRef.current.length - 1));

    setMarquee(prev => prev ? { ...prev, currentIndex } : null);

    const { startIndex, mode } = dragStateRef.current;
    const minIdx = Math.min(startIndex, currentIndex);
    const maxIdx = Math.max(startIndex, currentIndex);

    const newSelection = new Set(baseSelectionRef.current);
    for (let i = minIdx; i <= maxIdx; i++) {
      const rec = filteredRecordsRef.current[i];
      if (!rec) continue;
      if (mode === 'add') newSelection.add(rec.scopedKey);
      else newSelection.delete(rec.scopedKey);
    }

    useWorkspaceStore.getState().setSelectedFiles(newSelection);
  };

  const handlePointerMove = (e: PointerEvent) => {
    lastPointerYRef.current = e.clientY;
    if (Math.abs(e.clientY - startPointerYRef.current) > 5) {
      hasDraggedRef.current = true;
    }
    updateSelectionFromPointer(e.clientY);
  };

  const handlePointerUp = () => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    dragStateRef.current = null;
    setMarquee(null);
    useWorkspaceStore.getState().setIsPainting(false);

    if (clickTargetRef.current && !hasDraggedRef.current) {
      if (!clickTargetRef.current.isDir) {
        useWorkspaceStore.getState().openEditorTab(clickTargetRef.current.rootPath, clickTargetRef.current.relativePath, false);
      }
    }
  };

  const handleRowPointerDown = (e: React.PointerEvent, index: number, record: FlatRecord) => {
    if (e.button !== 0) return;

    // Defensively blur any active search input immediately so shortcut keys work
    if (document.activeElement instanceof HTMLElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      document.activeElement.blur();
    }
    setContextMenuState(null);

    e.stopPropagation();
    e.preventDefault();

    const store = useWorkspaceStore.getState();
    const hasPattern = store.selectedFiles.has(record.scopedKey) || store.selectedFiles.has(record.relativePath);

    hasDraggedRef.current = false;
    startPointerYRef.current = e.clientY;
    clickTargetRef.current = { rootPath, relativePath: record.relativePath, isDir: record.kind === 'folder' };

    let mode: 'add' | 'remove' = 'add';
    let clearFirst = false;

    if (e.shiftKey) mode = 'add';
    else if (e.altKey) mode = 'remove';
    else if (e.ctrlKey || e.metaKey) mode = hasPattern ? 'remove' : 'add';
    else {
      mode = 'add';
      clearFirst = true;
    }

    const baseSelection = clearFirst ? new Set<string>() : new Set(store.selectedFiles);
    if (mode === 'add') baseSelection.add(record.scopedKey);
    else {
      baseSelection.delete(record.scopedKey);
      baseSelection.delete(record.relativePath);
    }

    store.setSelectedFiles(baseSelection);
    store.setIsPainting(true);

    setMarquee({ startIndex: index, currentIndex: index, mode });
    baseSelectionRef.current = baseSelection;
    dragStateRef.current = { startIndex: index, mode };
    lastPointerYRef.current = e.clientY;

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // 7. Global Keyboard Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      const state = useWorkspaceStore.getState();

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setContextMenuState(null);
        const allVisible = filteredRecordsRef.current.map(r => r.scopedKey);
        state.setSelectedFiles(new Set(allVisible));
        return;
      }

      if (state.selectedFiles.size === 0) return;

      if (e.shiftKey && e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        const firstSelected = Array.from(state.selectedFiles)[0];
        if (firstSelected) {
          const { rootId, relativePath } = parseScopedPathKey(firstSelected);
          const cleanPath = relativePath.replace(/\/$/, '');
          const r = rootId || rootPath;
          window.api.showItemInFolder(`${r}/${cleanPath}`.replace(/\\/g, '/'));
        }
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch(e.key.toLowerCase()) {
        case 'a': 
          setContextMenuState(null);
          state.applyRuleToSelection('include', rootPath); 
          break;
        case 's': 
          setContextMenuState(null);
          state.applyRuleToSelection('tree-only', rootPath); 
          break;
        case 'd': 
          setContextMenuState(null);
          state.applyRuleToSelection('exclude', rootPath); 
          break;
        case 'escape': 
          setContextMenuState(null);
          state.setSelectedFiles(new Set()); 
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rootPath]);

  const handleStageEphemeral = async () => {
    const state = useWorkspaceStore.getState();
    state.setExportState({ isEphemeralBuilding: true, ephemeralDragPaths: null });
    setHasLoggedDrag(false);

    try {
      const multiRoots = rootPaths.map(rp => ({ rootPath: rp, tree: rawTrees[rp] })).filter(r => Boolean(r.tree));
      const payload = generateEphemeralPayload(
        rootPath,
        node,
        state.selectedFiles,
        state.compressions,
        config.extensionOverrides,
        state.mergeToSingleFile,
        state.embedProtocol,
        multiRoots
      );
      const paths = await window.api.stageEphemeralExport(payload);
      state.setExportState({ isEphemeralBuilding: false, ephemeralDragPaths: paths });
    } catch {
      state.setExportState({ isEphemeralBuilding: false, ephemeralDragPaths: null });
    }
  };

  const handleSingleRuleClick = (rec: FlatRecord, rule: 'include' | 'tree-only' | 'exclude', e: React.MouseEvent) => {
    e.stopPropagation();
    useWorkspaceStore.getState().setSelectedFiles(new Set([rec.scopedKey]));
    useWorkspaceStore.getState().applyRuleToSelection(rule, rootPath);
  };

  return (
    <div className="flex flex-col h-full relative select-none">
      {/* Top Filter and Search Bar */}
      <div className="p-3 border-b border-border-subtle bg-bg-base/90 space-y-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              ref={searchInputRef}
              type="text" 
              placeholder="Search table files or directories..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  searchInputRef.current?.blur();
                }
              }}
              className="w-full bg-bg-panel border border-border-subtle rounded-md pl-9 pr-3 py-1.5 text-xs text-text-primary outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Sub-Mode Toggle: Files vs Folders */}
          <div className="flex bg-bg-panel border border-border-subtle rounded-md p-0.5 text-xs shrink-0 font-medium">
            <button
              onClick={() => setSubMode('files')}
              className={`px-2.5 py-1 rounded transition-colors ${subMode === 'files' ? 'bg-accent/20 text-accent font-semibold' : 'text-text-muted hover:text-text-primary'}`}
            >
              Files ({allFileRecords.length})
            </button>
            <button
              onClick={() => setSubMode('folders')}
              className={`px-2.5 py-1 rounded transition-colors ${subMode === 'folders' ? 'bg-accent/20 text-accent font-semibold' : 'text-text-muted hover:text-text-primary'}`}
            >
              Folders ({allFolderRecords.length})
            </button>
          </div>

          {/* Switch to Hierarchical Tree View Toggle */}
          <button
            onClick={() => onToggleView ? onToggleView() : setLeftPaneMode('tree')}
            className="p-1.5 bg-bg-panel border border-border-subtle text-text-muted hover:text-accent hover:border-accent/40 rounded-md transition-all shrink-0"
            title="Switch to Hierarchical Tree View"
          >
            <FolderTree size={15} />
          </button>
        </div>

        {/* Filter Badges & Quick Extension Dropdown */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterExported(!filterExported)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                filterExported 
                  ? 'bg-green-500/20 text-green-400 border-green-500/40' 
                  : 'bg-bg-panel border-border-subtle text-text-muted hover:text-text-primary'
              }`}
              title="Show only files included in outbound context"
            >
              Exported ({allFileRecords.filter(f => f.status === 'included').length})
            </button>

            <button
              onClick={() => setFilterTreeOnly(!filterTreeOnly)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                filterTreeOnly 
                  ? 'bg-accent/20 text-accent border-accent/40' 
                  : 'bg-bg-panel border-border-subtle text-text-muted hover:text-text-primary'
              }`}
            >
              Tree-Only ({allFileRecords.filter(f => f.status === 'tree-only').length})
            </button>

            <button
              onClick={() => setFilterExcluded(!filterExcluded)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                filterExcluded 
                  ? 'bg-red-500/20 text-red-400 border-red-500/40' 
                  : 'bg-bg-panel border-border-subtle text-text-muted hover:text-text-primary'
              }`}
            >
              Excluded ({allFileRecords.filter(f => f.status === 'excluded').length})
            </button>

            <button
              onClick={() => setFilterHasSkips(!filterHasSkips)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                filterHasSkips 
                  ? 'bg-amber-400/20 text-amber-400 border-amber-400/40' 
                  : 'bg-bg-panel border-border-subtle text-text-muted hover:text-text-primary'
              }`}
            >
              Has Skips ({allFileRecords.filter(f => f.skips > 0).length})
            </button>
          </div>

          {subMode === 'files' && availableExtensions.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-text-muted">Ext:</span>
              <select
                value={selectedExtension}
                onChange={(e) => setSelectedExtension(e.target.value)}
                className="bg-bg-panel border border-border-subtle rounded px-2 py-0.5 text-[11px] font-mono text-text-primary outline-none focus:border-accent"
              >
                <option value="ALL">All Types ({allFileRecords.length})</option>
                {availableExtensions.map(({ ext, count }) => (
                  <option key={ext} value={ext}>{ext} ({count})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Sortable Column Header Bar */}
      <div className="grid grid-cols-12 px-4 py-2 border-b border-border-subtle bg-bg-panel text-[10px] uppercase font-bold text-text-muted tracking-wider select-none shrink-0 font-mono">
        <div 
          onClick={() => handleSortClick('path')}
          className="col-span-5 flex items-center gap-1 cursor-pointer hover:text-text-primary"
        >
          <span>{subMode === 'files' ? 'File Name & Relative Path' : 'Directory Path'}</span>
          {sortColumn === 'path' ? (sortDirection === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={10} className="opacity-40" />}
        </div>

        {subMode === 'files' && (
          <div 
            onClick={() => handleSortClick('type')}
            className="col-span-1 flex items-center justify-center gap-1 cursor-pointer hover:text-text-primary"
          >
            <span>Type</span>
            {sortColumn === 'type' ? (sortDirection === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : null}
          </div>
        )}

        <div 
          onClick={() => handleSortClick('size')}
          className={`${subMode === 'files' ? 'col-span-2' : 'col-span-3'} flex items-center justify-end gap-1 cursor-pointer hover:text-text-primary pr-2`}
        >
          <span>Size</span>
          {sortColumn === 'size' ? (sortDirection === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={10} className="opacity-40" />}
        </div>

        <div 
          onClick={() => handleSortClick('tokens')}
          className="col-span-2 flex items-center justify-end gap-1 cursor-pointer hover:text-text-primary pr-2"
        >
          <span>Tokens</span>
          {sortColumn === 'tokens' ? (sortDirection === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={10} className="opacity-40" />}
        </div>

        <div className="col-span-2 flex items-center justify-end pr-1 text-right">
          <span>Actions</span>
        </div>
      </div>

      {/* Virtual Table Body */}
      <div 
        ref={parentRef}
        className={`flex-1 overflow-y-auto font-mono text-text-primary relative pb-4 select-none ${isPainting ? 'is-painting' : ''}`}
        style={{ fontSize: config.theme.font.size }}
        onClick={(e) => {
          if (document.activeElement instanceof HTMLElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            document.activeElement.blur();
          }
          if (e.target === e.currentTarget) {
            useWorkspaceStore.getState().setSelectedFiles(new Set());
            setContextMenuState(null);
          }
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
            const record = filteredRecords[virtualRow.index];
            const isSelected = selectedFiles.has(record.scopedKey) || selectedFiles.has(record.relativePath);
            const isExcluded = record.status === 'excluded';
            const isTreeOnly = record.status === 'tree-only';

            return (
              <div
                key={record.scopedKey}
                onPointerDown={(e) => handleRowPointerDown(e, virtualRow.index, record)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenuState({ x: e.clientX, y: e.clientY, relativePath: record.relativePath });
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className={`grid grid-cols-12 items-center px-4 hover:bg-bg-hover transition-colors border-b border-border-subtle/30 text-xs cursor-pointer ${
                  isSelected ? 'bg-bg-hover ring-1 ring-border-subtle' : ''
                } ${isExcluded ? 'opacity-40' : ''}`}
              >
                {/* Name & Path */}
                <div className={`${subMode === 'files' ? 'col-span-5' : 'col-span-5'} flex items-center gap-2 truncate pr-2`}>
                  <span className="text-text-muted opacity-70 shrink-0">
                    {record.kind === 'folder' ? <Folder size={14} /> : <File size={14} />}
                  </span>
                  <span 
                    className={`truncate ${isTreeOnly ? 'italic text-accent' : 'text-text-primary'}`}
                    title={record.relativePath}
                  >
                    {record.relativePath}
                  </span>
                  {record.skips > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded shrink-0 font-mono">
                      <Edit3 size={10} /> {record.skips}
                    </span>
                  )}
                </div>

                {/* File Extension (Files Mode) */}
                {subMode === 'files' && (
                  <div className="col-span-1 text-center font-mono text-[11px] text-text-muted truncate">
                    {(record as FlatFileRecord).extension}
                  </div>
                )}

                {/* Size */}
                <div className={`${subMode === 'files' ? 'col-span-2' : 'col-span-3'} text-right text-[11px] font-mono pr-2 truncate`}>
                  {record.kind === 'file' ? (
                    <span className="text-text-primary">{(record.size / 1024).toFixed(1)} KB</span>
                  ) : (
                    <span className="text-text-muted">{(record.totalSize / 1024).toFixed(1)} KB ({record.includedFiles}/{record.totalFiles})</span>
                  )}
                </div>

                {/* Tokens */}
                <div className="col-span-2 text-right text-[11px] font-mono text-text-muted pr-2 truncate">
                  {record.tokens > 0 ? (
                    <span className={record.status === 'included' ? 'text-accent' : ''}>
                      ~{record.tokens.toLocaleString()}
                    </span>
                  ) : '—'}
                </div>

                {/* Quick 1-Click Rule Buttons */}
                <div className="col-span-2 flex items-center justify-end gap-1 pr-1">
                  <button 
                    onClick={(e) => handleSingleRuleClick(record, 'include', e)}
                    className="p-1 text-text-muted hover:text-green-400 rounded hover:bg-green-500/10"
                    title="Include [A]"
                  >
                    <Plus size={12} />
                  </button>
                  <button 
                    onClick={(e) => handleSingleRuleClick(record, 'tree-only', e)}
                    className="p-1 text-text-muted hover:text-accent rounded hover:bg-accent/10"
                    title="Tree-Only [S]"
                  >
                    <LayoutTemplate size={12} />
                  </button>
                  <button 
                    onClick={(e) => handleSingleRuleClick(record, 'exclude', e)}
                    className="p-1 text-text-muted hover:text-red-400 rounded hover:bg-red-500/10"
                    title="Exclude [D]"
                  >
                    <EyeOff size={12} />
                  </button>
                </div>
              </div>
            );
          })}

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

      {contextMenuState && (
        <ContextMenu
          x={contextMenuState.x}
          y={contextMenuState.y}
          targetRelativePath={contextMenuState.relativePath}
          rootPath={rootPath}
          onClose={() => setContextMenuState(null)}
        />
      )}

      {/* Selection Bottom Action Bar */}
      <div className={`shrink-0 bg-bg-base border-t border-border-subtle p-3 flex flex-col gap-3 transition-all duration-200 z-20 ${hasSelection ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        <div className="flex items-center justify-between text-xs text-text-muted px-1">
          <span className="font-medium text-text-primary">{hasSelection ? stats.fileCount : 0} Files Selected</span>
          <div className="flex gap-4">
            <span>{stats.kb} KB</span>
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
            onClick={() => useWorkspaceStore.getState().applyRuleToSelection('include', rootPath)} 
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-bg-hover hover:bg-green-500/20 rounded text-xs font-medium transition-colors text-green-400 border border-transparent hover:border-green-500/30 whitespace-nowrap"
            title="Include File & Export [A]"
          >
            <Plus size={14}/> <span>Include</span>
          </button>
          <button 
            onClick={() => useWorkspaceStore.getState().applyRuleToSelection('tree-only', rootPath)} 
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-bg-hover hover:bg-accent/20 rounded text-xs font-medium transition-colors text-accent border border-transparent hover:border-accent/30 whitespace-nowrap"
            title="Show in Tree, Skip Export [S]"
          >
            <LayoutTemplate size={14}/> <span>Tree</span>
          </button>
          <button 
            onClick={() => useWorkspaceStore.getState().applyRuleToSelection('exclude', rootPath)} 
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 bg-bg-hover hover:bg-red-500/20 rounded text-xs font-medium transition-colors text-text-muted hover:text-red-400 border border-transparent hover:border-red-500/30 whitespace-nowrap"
            title="Exclude Entirely [D]"
          >
            <EyeOff size={14}/> <span>Exclude</span>
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