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
  const { 
    expandedFolders, 
    toggleFolderExpansion, 
    setActiveFile,
    activeFile,
    selectedFiles,
    setSelectedFiles,
    includes, 
    excludes, 
    treeOnly,
    isPainting,
    startPainting,
    continuePainting
  } = useWorkspaceStore();

  const [contextMenuPos, setContextMenuPos] = useState<{ x: number, y: number } | null>(null);

  if (visiblePaths && depth > 0 && !visiblePaths.has(relativePath)) {
    return null;
  }

  const isExpanded = expandedFolders.has(relativePath) || (visiblePaths !== null && visiblePaths !== undefined);
  const isDirectory = node.type === 'directory';
  const pattern = isDirectory ? `${relativePath}/` : relativePath;

  const isPrimarySelected = activeFile === relativePath && !isDirectory;
  const isMultiSelected = selectedFiles.has(pattern);
  const isSelected = isPrimarySelected || isMultiSelected;

  const status = getFileStatus(relativePath, isDirectory, includes, excludes, treeOnly);
  const isExcluded = status === 'excluded';
  const isTreeOnly = status === 'tree-only';

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left clicks only
    e.stopPropagation();
    
    // Start painting selection
    const mode = selectedFiles.has(pattern) ? 'remove' : 'add';
    startPainting(pattern, mode);
    
    if (!isDirectory) setActiveFile(relativePath);
  };

  const handleMouseEnter = () => {
    if (isPainting) continuePainting(pattern);
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFolderExpansion(relativePath);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDirectory) toggleFolderExpansion(relativePath);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // If right-clicking an unselected item, make it the only selection
    if (!selectedFiles.has(pattern)) {
      setSelectedFiles(new Set([pattern]));
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
        className={`flex items-center py-1 rounded cursor-pointer group pr-2 border-l-2 select-none
          ${isExcluded ? 'opacity-40 border-transparent hover:bg-bg-hover' : 'opacity-100'} 
          ${isTreeOnly ? 'border-accent bg-accent/10 text-accent hover:bg-accent/20' : 'border-transparent hover:bg-bg-hover'}
          ${isSelected ? 'bg-bg-hover ring-1 ring-border-subtle border-border-subtle' : ''} 
          transition-all`}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        style={{ paddingLeft: `${(depth - 1) * 16 + 4}px` }}
      >
        <div 
          onClick={handleChevronClick}
          className="w-5 h-full flex justify-center items-center text-text-muted hover:text-text-primary"
        >
          {isDirectory && (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          )}
        </div>
        
        <span className="mr-2 text-text-muted opacity-80">
          {isDirectory ? <Folder size={14} /> : <File size={14} />}
        </span>
        
        <span className={`truncate flex-1 ${isTreeOnly ? 'italic font-medium' : ''}`}>
          {node.name}
        </span>
        
        {!isDirectory && !isExcluded && !isTreeOnly && (
          <span className="text-[10px] text-text-muted opacity-0 group-hover:opacity-100">
            {(node.size / 1024).toFixed(1)}kb
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
          onClose={() => setContextMenuPos(null)} 
        />
      )}
    </div>
  );
}