// src/components/tree/TreeNode.tsx
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react';
import type { FileNode } from '../../types/ipc';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { getFileStatus } from '../../utils/filterEngine';

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
    includes, 
    excludes, 
    addExcludeRule, 
    removeExcludeRule 
  } = useWorkspaceStore();

  // Search filter bailout
  if (visiblePaths && depth > 0 && !visiblePaths.has(relativePath)) {
    return null;
  }

  const isExpanded = expandedFolders.has(relativePath) || (visiblePaths !== null && visiblePaths !== undefined);
  const isDirectory = node.type === 'directory';
  const isSelected = activeFile === relativePath && !isDirectory;

  const status = getFileStatus(relativePath, isDirectory, includes, excludes);
  const isExcluded = status === 'excluded';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDirectory) {
      toggleFolderExpansion(relativePath);
    } else {
      setActiveFile(relativePath);
    }
  };

  const handleCheckboxChange = () => {
    const pattern = isDirectory ? `${relativePath}/` : relativePath;
    if (isExcluded) removeExcludeRule(pattern);
    else addExcludeRule(pattern);
  };

  // Prevent rendering the root node itself as a foldable item, just render its children
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
        className={`flex items-center py-1 hover:bg-bg-hover rounded cursor-pointer group pr-2
          ${isExcluded ? 'opacity-40' : 'opacity-100'} 
          ${isSelected ? 'bg-bg-hover ring-1 ring-border-subtle' : ''} 
          transition-all`}
        onClick={handleClick}
        style={{ paddingLeft: `${(depth - 1) * 16 + 4}px` }}
      >
        {/* Expand/Collapse Icon */}
        <span className="w-5 flex justify-center text-text-muted">
          {isDirectory && (
            isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          )}
        </span>

        {/* Checkbox for quick-exclude */}
        <input 
          type="checkbox" 
          checked={!isExcluded}
          onChange={handleCheckboxChange}
          onClick={(e) => e.stopPropagation()}
          className="w-3.5 h-3.5 mr-2 accent-accent bg-bg-base border-border-subtle rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
          title={isExcluded ? 'Un-exclude this item' : 'Exclude this item'}
        />

        {/* File/Folder Icon */}
        <span className="mr-2 text-text-muted">
          {isDirectory ? <Folder size={14} /> : <File size={14} />}
        </span>

        {/* Name */}
        <span className="truncate flex-1 select-none">{node.name}</span>
        
        {/* Size Badge (Optional, files only) */}
        {!isDirectory && !isExcluded && (
          <span className="text-[10px] text-text-muted opacity-0 group-hover:opacity-100">
            {(node.size / 1024).toFixed(1)}kb
          </span>
        )}
      </div>

      {/* Children */}
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
    </div>
  );
}