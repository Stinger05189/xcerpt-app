// src/components/tree/useFlattenedTree.ts
import { useMemo } from 'react';
import type { FileNode } from '../../types/ipc';
import { ScopedRuleIndex, type FileStatus } from '../../utils/filterEngine';

export interface FlatNode {
  node: FileNode;
  relativePath: string;
  depth: number;
  status: FileStatus;
}

export function useFlattenedTree(
  rootPath: string,
  rootNode: FileNode,
  expandedFolders: Set<string>,
  visiblePaths: Set<string> | null,
  includes: string[],
  excludes: string[],
  treeOnly: string[],
  hideExcluded: boolean,
  hideTreeOnly: boolean,
  isWhitelistMode: boolean = false
): FlatNode[] {
  const ruleIndex = useMemo(() => {
    return new ScopedRuleIndex(includes, excludes, treeOnly, isWhitelistMode);
  }, [includes, excludes, treeOnly, isWhitelistMode]);

  return useMemo(() => {
    const flat: FlatNode[] = [];

    const traverse = (node: FileNode, currentRelative: string, depth: number) => {
      const isDir = node.type === 'directory';
      const status = ruleIndex.getStatus(rootPath, currentRelative, isDir);

      if (hideExcluded && status === 'excluded') return;
      if (hideTreeOnly && status === 'tree-only') return;

      if (visiblePaths && depth > 0 && !visiblePaths.has(currentRelative)) {
        return;
      }

      if (depth > 0) {
        flat.push({ node, relativePath: currentRelative, depth, status });
      }

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
  }, [rootPath, rootNode, expandedFolders, visiblePaths, hideExcluded, hideTreeOnly, ruleIndex]);
}