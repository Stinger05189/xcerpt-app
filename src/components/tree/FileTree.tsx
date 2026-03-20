// src/components/tree/FileTree.tsx
import type { FileNode } from '../../types/ipc';
import { TreeNode } from './TreeNode';

interface FileTreeProps {
  node: FileNode;
  rootPath: string;
  relativePath: string;
}

export function FileTree({ node, rootPath, relativePath }: FileTreeProps) {
  return (
    <div className="font-mono text-[13px] text-text-primary">
      <TreeNode node={node} rootPath={rootPath} relativePath={relativePath} />
    </div>
  );
}