import { useMemo } from 'react';
import type { FileNode } from '../../types/ipc';

export interface FlatNode {
  node: FileNode;
  relativePath: string;
  depth: number;
}

export function useFlattenedTree(
  rootNode: FileNode,
  expandedFolders: Set<string>,
  visiblePaths: Set<string> | null
): FlatNode[] {
  return useMemo(() => {
    const flat: FlatNode[] = [];
    
    const traverse = (node: FileNode, currentRelative: string, depth: number) => {
      // If a search query is active, mathematically drop any branch not matching the query
      if (visiblePaths && depth > 0 && !visiblePaths.has(currentRelative)) {
        return;
      }
    
      // Depth 0 is the root invisible workspace wrapper; we don't render it in the UI list
      if (depth > 0) {
        flat.push({ node, relativePath: currentRelative, depth });
      }
    
      const isDir = node.type === 'directory';
      
      // Auto-expand everything if searching, otherwise honor the explicit Zustand set
      const isExpanded = depth === 0 || visiblePaths !== null || expandedFolders.has(currentRelative);
    
      if (isDir && isExpanded && node.children) {
        for (const child of node.children) {
          const childRelative = currentRelative ? `${currentRelative}/${child.name}` : child.name;
          traverse(child, childRelative, depth + 1);
        }
      }
    };
    
    traverse(rootNode, '', 0);
    return flat;
  }, [rootNode, expandedFolders, visiblePaths]);
}