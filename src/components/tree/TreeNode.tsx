// src/components/tree/TreeNode.tsx
import { useState, memo } from 'react';
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react';
import type { FileNode } from '../../types/ipc';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { getFileStatus } from '../../utils/filterEngine';
import { ContextMenu } from './ContextMenu';

interface TreeNodeProps {
  node: FileNode;
  rootPath: string;
  relativePath: string;
  depth?: number;
  style?: React.CSSProperties;
  onPointerDown?: (e: React.PointerEvent) => void;
}

const TreeNodeComponent = ({ node, rootPath, relativePath, depth = 0, style, onPointerDown }: TreeNodeProps) => {
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number, y: number } | null>(null);

  const isDirectory = node.type === 'directory';
  const pattern = isDirectory ? `${relativePath}/` : relativePath;

  const isExpanded = useWorkspaceStore(s => s.expandedFolders.has(relativePath));
  const isActiveFile = useWorkspaceStore(s => s.activeFile === relativePath && !isDirectory);
  const isSelected = useWorkspaceStore(s => s.selectedFiles.has(pattern));

  const includes = useWorkspaceStore(s => s.includes);
  const excludes = useWorkspaceStore(s => s.excludes);
  const treeOnly = useWorkspaceStore(s => s.treeOnly);

  const status = getFileStatus(relativePath, isDirectory, includes, excludes, treeOnly);
  const isExcluded = status === 'excluded';
  const isTreeOnly = status === 'tree-only';

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    useWorkspaceStore.getState().toggleFolderExpansion(relativePath);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDirectory) useWorkspaceStore.getState().toggleFolderExpansion(relativePath);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const store = useWorkspaceStore.getState();
    if (!store.selectedFiles.has(pattern)) {
      store.setSelectedFiles(new Set([pattern]));
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
          ${isTreeOnly ? 'text-accent bg-accent/10' : ''}
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
        
        <span className="mr-2 text-text-muted opacity-80">
          {isDirectory ? <Folder size={14} /> : <File size={14} />}
        </span>
        
        <span className={`truncate flex-1 pr-2 ${isTreeOnly ? 'italic font-medium' : ''}`} title={node.name}>
          {node.name}
        </span>
        
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
    prev.node === next.node &&
    prev.style?.transform === next.style?.transform
  );
});