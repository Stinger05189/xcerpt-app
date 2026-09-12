// src/components/export/PayloadPreviewTree.tsx
import { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { VirtualPayloadNode } from '../../types/ipc';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { 
  Folder, 
  File, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  Plus, 
  LayoutTemplate, 
  EyeOff, 
  Edit3 
} from 'lucide-react';

interface FlatPayloadRow {
  node: VirtualPayloadNode;
  depth: number;
}

export function PayloadPreviewTree({ rootNodes }: { rootNodes: VirtualPayloadNode[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTreeOnly, setFilterTreeOnly] = useState(false);
  const [filterExcluded, setFilterExcluded] = useState(false);
  const [filterSkipped, setFilterSkipped] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const applyRuleToSelection = useWorkspaceStore(s => s.applyRuleToSelection);
  const parentRef = useRef<HTMLDivElement>(null);

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const flatRows = useMemo(() => {
    const rows: FlatPayloadRow[] = [];
    const term = searchQuery.toLowerCase().trim();

    const matchesFilter = (n: VirtualPayloadNode): boolean => {
      if (filterTreeOnly && n.status !== 'tree-only') return false;
      if (filterExcluded && n.status !== 'excluded') return false;
      if (filterSkipped && n.skipCount === 0) return false;
      if (term && !n.name.toLowerCase().includes(term) && !n.relativePath.toLowerCase().includes(term)) {
        return false;
      }
      return true;
    };

    const hasMatchingDescendant = (n: VirtualPayloadNode): boolean => {
      if (matchesFilter(n)) return true;
      if (n.children) {
        return n.children.some(c => hasMatchingDescendant(c));
      }
      return false;
    };

    const traverse = (node: VirtualPayloadNode, depth: number) => {
      if (!hasMatchingDescendant(node)) return;

      rows.push({ node, depth });
      const isExpanded = term !== '' || expandedNodes.has(node.id) || depth === 0;

      if (node.isDirectory && node.children && isExpanded) {
        node.children.forEach(c => traverse(c, depth + 1));
      }
    };

    rootNodes.forEach(r => traverse(r, 0));
    return rows;
  }, [rootNodes, searchQuery, filterTreeOnly, filterExcluded, filterSkipped, expandedNodes]);

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

  const handleApplySingleRule = (node: VirtualPayloadNode, rule: 'include' | 'tree-only' | 'exclude') => {
    useWorkspaceStore.getState().setSelectedFiles(new Set([node.scopedKey]));
    applyRuleToSelection(rule, node.rootPath);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-panel border border-border-subtle rounded-xl overflow-hidden shadow-sm">
      <div className="p-3 border-b border-border-subtle bg-bg-base/80 flex items-center justify-between gap-3 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input 
            type="text" 
            placeholder="Search payload nodes..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-bg-panel border border-border-subtle rounded-md pl-9 pr-3 py-1 text-xs text-text-primary outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-1 bg-bg-panel border border-border-subtle rounded-md p-0.5 text-xs">
          <button 
            onClick={() => setFilterTreeOnly(!filterTreeOnly)} 
            className={`px-2 py-1 rounded transition-colors ${filterTreeOnly ? 'bg-accent/20 text-accent font-medium' : 'text-text-muted hover:text-text-primary'}`}
          >
            Tree-Only
          </button>
          <button 
            onClick={() => setFilterExcluded(!filterExcluded)} 
            className={`px-2 py-1 rounded transition-colors ${filterExcluded ? 'bg-red-500/20 text-red-400 font-medium' : 'text-text-muted hover:text-text-primary'}`}
          >
            Excluded
          </button>
          <button 
            onClick={() => setFilterSkipped(!filterSkipped)} 
            className={`px-2 py-1 rounded transition-colors ${filterSkipped ? 'bg-amber-400/20 text-amber-400 font-medium' : 'text-text-muted hover:text-text-primary'}`}
          >
            Skipped
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 px-4 py-2 text-[10px] uppercase font-semibold text-text-muted border-b border-border-subtle bg-bg-base/50 shrink-0">
        <div className="col-span-6">Hierarchy & Name</div>
        <div className="col-span-2 text-right">Tokens</div>
        <div className="col-span-2 text-right">True Size</div>
        <div className="col-span-2 text-right pr-2">Actions</div>
      </div>

      <div ref={parentRef} className="flex-1 overflow-y-auto font-mono text-xs text-text-primary">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map(virtualRow => {
            const row = flatRows[virtualRow.index];
            const { node, depth } = row;
            const isExpanded = expandedNodes.has(node.id) || depth === 0;

            return (
              <div
                key={node.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className={`grid grid-cols-12 items-center px-4 hover:bg-bg-hover transition-colors border-b border-border-subtle/30 ${node.status === 'excluded' ? 'opacity-40' : ''}`}
              >
                <div 
                  className="col-span-6 flex items-center gap-1.5 truncate"
                  style={{ paddingLeft: `${depth * 16}px` }}
                >
                  {node.isDirectory ? (
                    <button onClick={() => toggleExpand(node.id)} className="p-0.5 text-text-muted hover:text-text-primary">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  ) : (
                    <span className="w-5" />
                  )}

                  <span className="text-text-muted opacity-70">
                    {node.isDirectory ? <Folder size={14} /> : <File size={14} />}
                  </span>

                  <span className={`truncate ${node.status === 'tree-only' ? 'italic text-accent' : ''}`} title={node.relativePath || node.name}>
                    {node.name}
                  </span>

                  {node.skipCount > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded shrink-0">
                      <Edit3 size={10} />
                      {node.skipCount}
                    </span>
                  )}
                </div>

                <div className="col-span-2 text-right text-text-muted text-[11px]">
                  ~{node.tokens.toLocaleString()}
                </div>

                <div className="col-span-2 text-right text-text-muted text-[11px]">
                  {(node.trueSize / 1024).toFixed(1)} KB
                </div>

                <div className="col-span-2 flex items-center justify-end gap-1 pr-2">
                  <button 
                    onClick={() => handleApplySingleRule(node, 'include')}
                    className="p-1 text-text-muted hover:text-green-400 rounded hover:bg-green-500/10"
                    title="Include [A]"
                  >
                    <Plus size={12} />
                  </button>
                  <button 
                    onClick={() => handleApplySingleRule(node, 'tree-only')}
                    className="p-1 text-text-muted hover:text-accent rounded hover:bg-accent/10"
                    title="Tree-Only [S]"
                  >
                    <LayoutTemplate size={12} />
                  </button>
                  <button 
                    onClick={() => handleApplySingleRule(node, 'exclude')}
                    className="p-1 text-text-muted hover:text-red-400 rounded hover:bg-red-500/10"
                    title="Exclude [D]"
                  >
                    <EyeOff size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}