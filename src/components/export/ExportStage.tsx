// src/components/export/ExportStage.tsx
import type { FileNode } from '../../types/ipc';
import { useMemo } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { getFileStatus } from '../../utils/filterEngine';
import { PackageOpen, Download } from 'lucide-react';

export function ExportStage() {
  const { rootPaths, rawTrees, includes, excludes } = useWorkspaceStore();

  // Utility to flatten the active trees into a single array of included files
  const includedFiles = useMemo(() => {
    const list: string[] = [];
    
    rootPaths.forEach(root => {
      const tree = rawTrees[root];
      if (!tree) return;
    
      // Change `node: any` to `node: FileNode`
      const traverse = (node: FileNode, currentRelative: string) => {
        const isDir = node.type === 'directory';
        const status = getFileStatus(currentRelative, isDir, includes, excludes);
        
        if (status === 'excluded') return;
        
        if (!isDir && currentRelative !== '') {
          list.push(`${root.split(/[/\\]/).pop()}/${currentRelative}`);
        }
        
        // Change `child: any` to `child: FileNode`
        node.children?.forEach((child: FileNode) => {
          const childPath = currentRelative ? `${currentRelative}/${child.name}` : child.name;
          traverse(child, childPath);
        });
      };
    
      traverse(tree, '');
    });
    
    return list;
  }, [rootPaths, rawTrees, includes, excludes]);

  // Chunking logic (Hardcoded to 10 for UI testing, will bind to state later)
  const chunkSize = 10;
  const chunks = [];
  for (let i = 0; i < includedFiles.length; i += chunkSize) {
    chunks.push(includedFiles.slice(i, i + chunkSize));
  }

  return (
    <div className="h-full flex flex-col bg-bg-base p-6 overflow-y-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2">
          <PackageOpen className="text-accent" /> Export Staging
        </h2>
        <p className="text-text-muted text-sm">
          {includedFiles.length} files staged across {chunks.length} chunks.
        </p>
      </div>
    
      <div className="space-y-6">
        {chunks.map((chunk, index) => (
          <div key={index} className="bg-bg-panel border border-border-subtle rounded-lg p-4">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border-subtle">
              <h3 className="font-medium text-text-primary">Payload Chunk {index + 1}</h3>
              <button className="flex items-center gap-2 bg-accent/10 text-accent px-3 py-1.5 rounded hover:bg-accent/20 transition-colors text-sm">
                <Download size={14} /> Drag to Chat
              </button>
            </div>
            <ul className="text-xs text-text-muted font-mono space-y-1 max-h-40 overflow-y-auto">
              {chunk.map(file => (
                <li key={file} className="truncate">{file}</li>
              ))}
            </ul>
          </div>
        ))}
        {chunks.length === 0 && (
          <div className="text-center text-text-muted py-10 border border-dashed border-border-subtle rounded-lg">
            No files match the current inclusion/exclusion rules.
          </div>
        )}
      </div>
    </div>
  );
}