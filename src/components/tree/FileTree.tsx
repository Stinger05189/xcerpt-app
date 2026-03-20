// src/components/tree/FileTree.tsx
import { useState, useMemo } from 'react';
import type { FileNode } from '../../types/ipc';
import { TreeNode } from './TreeNode';
import { Search } from 'lucide-react';

interface FileTreeProps {
  node: FileNode;
  rootPath: string;
  relativePath: string;
}

export function FileTree({ node, rootPath, relativePath }: FileTreeProps) {
  const [searchQuery, setSearchQuery] = useState('');

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

  return (
    <div className="flex flex-col h-full">
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
    
      <div className="flex-1 overflow-y-auto font-mono text-[13px] text-text-primary">
        <TreeNode 
          node={node} 
          rootPath={rootPath} 
          relativePath={relativePath} 
          visiblePaths={visiblePaths}
        />
      </div>
    </div>
  );
}