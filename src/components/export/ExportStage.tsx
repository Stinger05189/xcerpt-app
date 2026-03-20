// src/components/export/ExportStage.tsx
import type { FileNode } from '../../types/ipc';
import { useMemo, useState, useEffect } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { getFileStatus } from '../../utils/filterEngine';
import { PackageOpen, Download, Settings2, FileText, Database, Layers } from 'lucide-react';

export function ExportStage() {
  const { rootPaths, rawTrees, includes, excludes, maxFilesPerChunk, setMaxFilesPerChunk, compressions } = useWorkspaceStore();

  // Local State for Debouncing
  const isCurrentlyUnlimited = maxFilesPerChunk >= 100000;
  const [localBatchSize, setLocalBatchSize] = useState(isCurrentlyUnlimited ? '' : maxFilesPerChunk.toString());
  const [isUnlimited, setIsUnlimited] = useState(isCurrentlyUnlimited);

  // Debounce Effect
  useEffect(() => {
    if (isUnlimited) {
      setMaxFilesPerChunk(100000); // Practical unlimited
      return;
    }
    
    const num = parseInt(localBatchSize);
    if (num > 0) {
      const timer = setTimeout(() => setMaxFilesPerChunk(num), 500);
      return () => clearTimeout(timer);
    }
  }, [localBatchSize, isUnlimited, setMaxFilesPerChunk]);

  const includedFiles = useMemo(() => {
    const list: string[] = [];
    rootPaths.forEach(root => {
      const tree = rawTrees[root];
      if (!tree) return;
      
      const traverse = (node: FileNode, currentRelative: string) => {
        const isDir = node.type === 'directory';
        const status = getFileStatus(currentRelative, isDir, includes, excludes);
        
        if (status === 'excluded') return;
        if (!isDir && currentRelative !== '') {
          list.push(`${root.split(/[/\\]/).pop()}/${currentRelative}`);
        }
        
        node.children?.forEach((child: FileNode) => {
          const childPath = currentRelative ? `${currentRelative}/${child.name}` : child.name;
          traverse(child, childPath);
        });
      };
      traverse(tree, '');
    });
    return list;
  }, [rootPaths, rawTrees, includes, excludes]);

  const chunks = [];
  const limit = isUnlimited ? includedFiles.length || 1 : maxFilesPerChunk;
  for (let i = 0; i < includedFiles.length; i += limit) {
    chunks.push(includedFiles.slice(i, i + limit));
  }

  const totalFiles = includedFiles.length;
  const filesWithCompressions = includedFiles.filter(f => {
    const relativePath = f.split('/').slice(1).join('/');
    return (compressions[relativePath]?.length || 0) > 0;
  }).length;

  const isSingleChunk = chunks.length === 1;

  return (
    <div className="h-full flex flex-col bg-bg-base overflow-hidden">
      {/* Header */}
      <div className="bg-bg-panel border-b border-border-subtle p-6 shrink-0">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2 text-text-primary">
              <PackageOpen className="text-accent" /> Export Staging
            </h2>
            <p className="text-text-muted text-sm">
              Ready to generate physical files. Review chunks and drag payloads to your AI chat.
            </p>
          </div>
          
          {/* Settings Box */}
          <div className="bg-bg-base border border-border-subtle rounded p-3 flex flex-col gap-2 min-w-48">
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Settings2 size={16} /> Batch Size Limit:
            </div>
            <div className="flex items-center gap-3">
              <input 
                type="number" 
                min="1" 
                disabled={isUnlimited}
                value={localBatchSize}
                onChange={(e) => setLocalBatchSize(e.target.value)}
                className="bg-bg-hover border border-border-subtle rounded px-2 py-1 w-20 text-center text-text-primary outline-none focus:border-accent disabled:opacity-30 transition-opacity"
              />
              <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isUnlimited}
                  onChange={(e) => setIsUnlimited(e.target.checked)}
                  className="accent-accent"
                />
                Unlimited
              </label>
            </div>
          </div>
        </div>
        
        {/* Global Stats */}
        <div className="flex gap-4">
          <StatBadge icon={<FileText size={14}/>} label="Total Files" value={totalFiles} />
          <StatBadge icon={<Layers size={14}/>} label="Total Chunks" value={chunks.length} />
          <StatBadge icon={<Database size={14}/>} label="Compressed Files" value={filesWithCompressions} highlight={filesWithCompressions > 0} />
        </div>
      </div>
    
      {/* Chunk Container */}
      <div className="p-6 flex-1 overflow-y-auto">
        <div className={isSingleChunk ? "flex flex-col h-full" : "grid grid-cols-1 xl:grid-cols-2 gap-6 items-start"}>
          {chunks.map((chunk, index) => (
            <div key={index} className={`bg-bg-panel border border-border-subtle rounded-lg flex flex-col shadow-sm ${isSingleChunk ? 'flex-1 min-h-0' : 'h-[320px]'}`}>
              {/* Chunk Header */}
              <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-bg-base/50 shrink-0">
                <div>
                  <h3 className="font-semibold text-text-primary">Payload Chunk {chunks.length > 1 ? index + 1 : ''}</h3>
                  <div className="text-xs text-text-muted mt-0.5 flex items-center gap-2">
                    <span>{chunk.length} files</span>
                    <span>•</span>
                    <span>~{Math.round(chunk.length * 1.5)}k Tokens (Est)</span>
                  </div>
                </div>
                <button className="flex items-center gap-2 bg-accent text-white px-4 py-2 rounded shadow-sm hover:bg-accent/90 transition-colors text-sm font-medium cursor-grab active:cursor-grabbing">
                  <Download size={16} /> Drag to Chat
                </button>
              </div>
              
              {/* Chunk File List */}
              <div className="flex-1 overflow-y-auto p-4">
                <ul className="text-xs text-text-muted font-mono space-y-2">
                  {chunk.map(file => {
                    const parts = file.split('/');
                    const root = parts[0];
                    const name = parts.pop();
                    const path = parts.join('/') + '/';
                    
                    return (
                      <li key={file} className="flex items-center truncate hover:text-text-primary transition-colors cursor-default">
                        <span className="text-accent/70 mr-2 shrink-0">{root}/</span>
                        <span className="opacity-50 truncate">{path}</span>
                        <span className="text-text-primary ml-1 shrink-0">{name}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ))}
          
          {chunks.length === 0 && (
            <div className="text-center text-text-muted py-12 border border-dashed border-border-subtle rounded-lg bg-bg-panel h-full flex flex-col items-center justify-center">
              No files match the current inclusion/exclusion rules.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBadge({ icon, label, value, highlight = false }: { icon: React.ReactNode, label: string, value: number, highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm border 
      ${highlight ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-bg-hover border-border-subtle text-text-muted'}`}>
      {icon}
      <span>{label}: <strong className={highlight ? 'text-accent' : 'text-text-primary'}>{value}</strong></span>
    </div>
  );
}