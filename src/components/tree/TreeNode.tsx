// src/components/tree/TreeNode.tsx
import { useState } from 'react';
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
  visiblePaths?: Set<string> | null;
}

export function TreeNode({ node, rootPath, relativePath, depth = 0, visiblePaths }: TreeNodeProps) {
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number, y: number } | null>(null);

  const isDirectory = node.type === 'directory';
  const pattern = isDirectory ? `${relativePath}/` : relativePath;

  // Granular Subscriptions for Performance
  const isExpanded = useWorkspaceStore(s => s.expandedFolders.has(relativePath)) || (visiblePaths !== null && visiblePaths !== undefined);
  const isActiveFile = useWorkspaceStore(s => s.activeFile === relativePath && !isDirectory);
  const isSelected = useWorkspaceStore(s => s.selectedFiles.has(pattern));

  const includes = useWorkspaceStore(s => s.includes);
  const excludes = useWorkspaceStore(s => s.excludes);
  const treeOnly = useWorkspaceStore(s => s.treeOnly);

  if (visiblePaths && depth > 0 && !visiblePaths.has(relativePath)) {
    return null;
  }

  const status = getFileStatus(relativePath, isDirectory, includes, excludes, treeOnly);
  const isExcluded = status === 'excluded';
  const isTreeOnly = status === 'tree-only';

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left clicks only
    
    // Prevent selection logic from triggering if they click inside the exact gutter area (width 32px)
    // The gutter has its own independent onClick handler.
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX - rect.left <= 32) return; 
    
    e.stopPropagation();
    
    const store = useWorkspaceStore.getState();
    const hasPattern = store.selectedFiles.has(pattern);
    
    let mode: 'add' | 'remove' = 'add';
    let clearFirst = false;
    
    if (e.shiftKey) {
      mode = 'add';
    } else if (e.altKey) {
      mode = 'remove';
    } else if (e.ctrlKey || e.metaKey) {
      mode = hasPattern ? 'remove' : 'add';
    } else {
      // Standard click: Clear selection, select this item, set as active file
      mode = 'add';
      clearFirst = true;
      if (!isDirectory) store.setActiveFile(relativePath);
    }
    
    store.startPainting(pattern, mode, clearFirst);
  };

  const handleMouseEnter = () => {
    // Read directly from state to avoid subscribing the entire tree to the painting boolean
    const state = useWorkspaceStore.getState();
    if (state.isPainting) state.continuePainting(pattern);
  };

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

  if (depth === 0) {
    return (
      <div className="pl-1 pb-4">
        {node.children.map(child => (
          <TreeNode 
            key={child.path} 
            node={child} 
            rootPath={rootPath} 
            relativePath={child.path.replace(`${rootPath}\\`, '').replace(`${rootPath}/`, '')}
            depth={depth + 1} 
            visiblePaths={visiblePaths}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div 
        className={`relative flex items-center py-1 rounded cursor-pointer group select-none transition-all
          ${isExcluded ? 'opacity-40' : 'opacity-100'} 
          ${isActiveFile ? 'border-l-2 border-accent bg-accent/5' : 'border-l-2 border-transparent'}
          ${isSelected ? 'bg-bg-hover ring-1 ring-border-subtle' : 'hover:bg-bg-hover'}
          ${isTreeOnly ? 'text-accent bg-accent/10' : ''}
        `}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        style={{ paddingLeft: `${(depth - 1) * 16 + 32}px` }}
      >
        {/* Absolute Left Gutter for perfectly aligned Chevron Toggles */}
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
        
        <span className={`truncate flex-1 pr-2 ${isTreeOnly ? 'italic font-medium' : ''}`}>
          {node.name}
        </span>
        
        {!isDirectory && !isExcluded && !isTreeOnly && (
          <span className="text-[10px] text-accent font-medium pr-3 whitespace-nowrap">
            {(node.size / 1024).toFixed(1)} kb
          </span>
        )}
      </div>
    
      {isDirectory && isExpanded && (
        <div>
          {node.children.map(child => {
            const childRelative = relativePath ? `${relativePath}/${child.name}` : child.name;
            return (
              <TreeNode 
                key={child.path} 
                node={child} 
                rootPath={rootPath} 
                relativePath={childRelative}
                depth={depth + 1}
                visiblePaths={visiblePaths} 
              />
            );
          })}
        </div>
      )}
    
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
}