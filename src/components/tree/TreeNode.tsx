// src/components/tree/TreeNode.tsx
import { useState, memo } from 'react';
import { ChevronRight, ChevronDown, File, Folder, Edit3 } from 'lucide-react';
import type { FileNode } from '../../types/ipc';
import type { FileStatus } from '../../utils/filterEngine';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { toScopedPathKey } from '../../utils/filterEngine';
import { ContextMenu } from './ContextMenu';

interface TreeNodeProps {
  node: FileNode;
  rootPath: string;
  relativePath: string;
  depth?: number;
  status: FileStatus;
  style?: React.CSSProperties;
  onPointerDown?: (e: React.PointerEvent) => void;
}

const TreeNodeComponent = ({ node, rootPath, relativePath, depth = 0, status, style, onPointerDown }: TreeNodeProps) => {
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number, y: number } | null>(null);

  const isDirectory = node.type === 'directory';
  const pattern = isDirectory ? `${relativePath}/` : relativePath;
  const scopedPattern = toScopedPathKey(rootPath, pattern);

  // Granular selectors: strictly boolean returns so unselected rows never re-render during drag painting
  const isExpanded = useWorkspaceStore(s => s.expandedFolders.has(relativePath));
  const isActiveFile = useWorkspaceStore(s => s.activeTab === rootPath && s.activeFile === relativePath && !isDirectory);
  const isSelected = useWorkspaceStore(s => s.selectedFiles.has(scopedPattern) || s.selectedFiles.has(pattern));
  const gitStatusRaw = useWorkspaceStore(s => s.gitStatus[relativePath]);

  let gitColorClass = '';
  if (gitStatusRaw && !isDirectory) {
    if (gitStatusRaw.includes('M')) gitColorClass = 'text-orange-400';
    else if (gitStatusRaw.includes('A') || gitStatusRaw.includes('?')) gitColorClass = 'text-green-400';
    else if (gitStatusRaw.includes('D')) gitColorClass = 'text-red-400 line-through opacity-70';
  }

  // Pure prop-derived status: ZERO rule indexing performed on render
  const isExcluded = status === 'excluded';
  const isTreeOnly = status === 'tree-only';

  const compressions = useWorkspaceStore(s => s.compressions[scopedPattern] || s.compressions[relativePath]);
  const skipCount = compressions?.length || 0;
  const skippedLines = compressions?.reduce((acc, c) => acc + (c.lineCount || 0), 0) || 0;

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    useWorkspaceStore.getState().toggleFolderExpansion(relativePath);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDirectory) {
      useWorkspaceStore.getState().toggleFolderExpansion(relativePath);
    } else {
      useWorkspaceStore.getState().openEditorTab(rootPath, relativePath, true);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const store = useWorkspaceStore.getState();
    if (!store.selectedFiles.has(scopedPattern) && !store.selectedFiles.has(pattern)) {
      store.setSelectedFiles(new Set([scopedPattern]));
    }
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div style={style}>
      <div 
        className={`relative flex items-center py-1 rounded cursor-pointer group select-none transition-all
          ${isExcluded ? 'opacity-40' : 'opacity-100'} 
          ${isActiveFile ? 'border-l-2 border-accent bg-accent/5' : 'border-l-2 border-transparent'}
          ${isSelected ? 'bg-bg-hover ring-1 ring-border-subtle' : 'hover:bg-bg-hover'}
          ${isTreeOnly ? 'bg-accent/10' : ''}
        `}
        onPointerDown={onPointerDown}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        style={{ paddingLeft: `${(depth - 1) * 16 + 32}px` }}
      >
        <div 
          onClick={handleChevronClick}
          className="absolute left-0 top-0 bottom-0 w-8 flex justify-center items-center text-text-muted hover:text-text-primary hover:bg-bg-hover/80 z-10 transition-colors"
        >
          {isDirectory && (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          )}
        </div>
        
        <span className={`mr-2 opacity-80 ${gitColorClass ? gitColorClass : 'text-text-muted'}`}>
          {isDirectory ? <Folder size={14} /> : <File size={14} />}
        </span>
        
        <span className={`truncate flex-1 pr-2 ${isTreeOnly ? 'italic font-medium text-accent' : (gitColorClass ? gitColorClass : '')}`} title={node.name}>
          {node.name}
        </span>

        {!isDirectory && skipCount > 0 && (
          <span 
            className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded mr-2 font-mono"
            title={`${skipCount} skip block${skipCount > 1 ? 's' : ''} active (-${skippedLines} lines)`}
          >
            <Edit3 size={10} className="shrink-0" />
            <span>{skipCount}</span>
          </span>
        )}
        
        {!isDirectory && !isExcluded && !isTreeOnly && (
          <span className="text-[10px] text-accent font-medium pr-3 whitespace-nowrap hidden @[200px]:inline">
            {(node.size / 1024).toFixed(1)} kb
          </span>
        )}
      </div>
    
      {contextMenuPos && (
        <ContextMenu 
          x={contextMenuPos.x} 
          y={contextMenuPos.y} 
          targetRelativePath={relativePath}
          rootPath={rootPath}
          onClose={() => setContextMenuPos(null)} 
        />
      )}
    </div>
  );
};

export const TreeNode = memo(TreeNodeComponent, (prev, next) => {
  return (
    prev.relativePath === next.relativePath &&
    prev.rootPath === next.rootPath &&
    prev.node === next.node &&
    prev.status === next.status &&
    prev.style?.transform === next.style?.transform
  );
});