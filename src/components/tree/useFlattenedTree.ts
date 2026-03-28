// src/components/tree/useFlattenedTree.ts
import { useMemo } from 'react';
import ignore from 'ignore';
import type { FileNode } from '../../types/ipc';

export interface FlatNode {
  node: FileNode;
  relativePath: string;
  depth: number;
}

export function useFlattenedTree(
  rootNode: FileNode,
  expandedFolders: Set<string>,
  visiblePaths: Set<string> | null,
  includes: string[],
  excludes: string[],
  treeOnly: string[],
  hideExcluded: boolean,
  hideTreeOnly: boolean
): FlatNode[] {
  return useMemo(() => {
    const flat: FlatNode[] = [];
    
    // Pre-compile ignore instances once per render pass to guarantee performance
    const igExclude = excludes.length > 0 ? ignore().add(excludes) : null;
    const igTree = treeOnly.length > 0 ? ignore().add(treeOnly) : null;
    const igInclude = includes.length > 0 ? ignore().add(includes) : null;
    
    const checkStatus = (relPath: string, isDir: boolean) => {
      const cleanPath = relPath.replace(/\\/g, '/').replace(/^\//, '');
      if (cleanPath === '') return 'included';
      
      const pathToCheck = isDir && !cleanPath.endsWith('/') ? `${cleanPath}/` : cleanPath;
      
      if (igExclude && igExclude.ignores(pathToCheck)) return 'excluded';
      if (igTree && igTree.ignores(pathToCheck)) return 'tree-only';
      if (igInclude && !isDir && !igInclude.ignores(pathToCheck)) return 'excluded';
      return 'included';
    };
    
    const traverse = (node: FileNode, currentRelative: string, depth: number) => {
      const isDir = node.type === 'directory';
    
      // Drop nodes immediately based on visibility toggles
      if (hideExcluded || hideTreeOnly) {
        const status = checkStatus(currentRelative, isDir);
        if (hideExcluded && status === 'excluded') return;
        if (hideTreeOnly && status === 'tree-only') return;
      }
    
      // If a search query is active, mathematically drop any branch not matching the query
      if (visiblePaths && depth > 0 && !visiblePaths.has(currentRelative)) {
        return;
      }
    
      // Depth 0 is the root invisible workspace wrapper; we don't render it in the UI list
      if (depth > 0) {
        flat.push({ node, relativePath: currentRelative, depth });
      }
      
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
  }, [rootNode, expandedFolders, visiblePaths, includes, excludes, treeOnly, hideExcluded, hideTreeOnly]);
}