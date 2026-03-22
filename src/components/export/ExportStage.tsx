// src/components/export/ExportStage.tsx
import { useMemo } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { generateExportPayload } from '../../utils/exportEngine';
import { PackageOpen, Settings2, FileText, Database, Layers, Check, Infinity as InfinityIcon, ExternalLink } from 'lucide-react';

export function ExportStage() {
  const { 
    rootPaths, 
    rawTrees, 
    includes, 
    excludes, 
    treeOnly, 
    maxFilesPerChunk, 
    setMaxFilesPerChunk, 
    compressions, 
    chunkPaths 
  } = useWorkspaceStore();

  const isUnlimited = maxFilesPerChunk >= 100000;

  // Compute the payload purely for UI rendering so the user sees exactly what the LLM sees
  const payload = useMemo(() => {
    return generateExportPayload(rootPaths, rawTrees, includes, excludes, treeOnly, compressions, maxFilesPerChunk);
  }, [rootPaths, rawTrees, includes, excludes, treeOnly, compressions, maxFilesPerChunk]);

  const totalFiles = payload.chunks.reduce((acc, c) => acc + c.files.length, 0);
  const filesWithCompressions = payload.chunks.flatMap(c => c.files).filter(f => f.compressions.length > 0).length;
  const isSingleChunk = payload.chunks.length === 1;

  return (
    <div className="h-full flex flex-col bg-bg-base overflow-hidden">
      {/* Header */}
      <div className="bg-bg-panel border-b border-border-subtle p-6 shrink-0">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2 text-text-primary">
              <PackageOpen className="text-accent" /> Export Configuration
            </h2>
            <p className="text-text-muted text-sm max-w-lg">
              Adjust how your payload is chunked to bypass AI chat limits. The global build engine updates automatically in the background.
            </p>
          </div>
          
          {/* Modern Chunk Limits Slider */}
          <div className="bg-bg-base border border-border-subtle rounded-lg p-4 flex flex-col gap-3 min-w-64 shadow-sm">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-text-primary font-medium"><Settings2 size={16} className="text-accent"/> Batch Size Limit</span>
              <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer hover:text-text-primary transition-colors">
                <input 
                  type="checkbox" 
                  checked={isUnlimited}
                  onChange={(e) => setMaxFilesPerChunk(e.target.checked ? 100000 : 20)}
                  className="accent-accent w-3.5 h-3.5"
                />
                Unlimited
              </label>
            </div>
            
            <div className="flex items-center gap-3">
              <input 
                type="range" 
                min="2" 
                max="50" 
                disabled={isUnlimited}
                value={isUnlimited ? 50 : maxFilesPerChunk}
                onChange={(e) => setMaxFilesPerChunk(parseInt(e.target.value))}
                className="flex-1 accent-accent disabled:opacity-30 cursor-pointer"
              />
              <span className="w-8 text-right font-mono text-sm text-text-primary">
                {isUnlimited ? <InfinityIcon size={16} className="inline opacity-50"/> : maxFilesPerChunk}
              </span>
            </div>
          </div>
        </div>
        
        {/* Global Stats & Actions */}
        <div className="flex justify-between items-center mt-6 border-t border-border-subtle pt-4">
          <div className="flex gap-4">
            <StatBadge icon={<FileText size={14}/>} label="Total Files" value={totalFiles} />
            <StatBadge icon={<Layers size={14}/>} label="Total Chunks" value={payload.chunks.length} />
            <StatBadge icon={<Database size={14}/>} label="Compressed Files" value={filesWithCompressions} highlight={filesWithCompressions > 0} />
          </div>
          
          {chunkPaths.length > 0 && (
            <button 
              onClick={() => window.api.openPath(chunkPaths[0])}
              className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors hover:underline"
            >
              <ExternalLink size={14} /> Open Cache Directory
            </button>
          )}
        </div>
      </div>
    
      {/* Visual Chunk Overview */}
      <div className="p-6 flex-1 overflow-y-auto">
        <h3 className="text-xs uppercase font-semibold text-text-muted mb-4 px-1">Compiled Payload Overview</h3>
        <div className={isSingleChunk ? "flex flex-col h-full" : "grid grid-cols-1 xl:grid-cols-2 gap-6 items-start"}>
          {payload.chunks.map((chunk, index) => (
            <div key={index} className={`bg-bg-panel border border-border-subtle rounded-lg flex flex-col shadow-sm ${isSingleChunk ? 'flex-1 min-h-0' : 'h-80'}`}>
              {/* Chunk Header */}
              <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-bg-base/50 shrink-0">
                <div>
                  <h3 className="font-semibold text-text-primary">Payload Chunk {payload.chunks.length > 1 ? index + 1 : ''}</h3>
                  <div className="text-xs text-text-muted mt-0.5 flex items-center gap-2">
                    <span>{chunk.files.length} files</span>
                    <span>•</span>
                    {index === 0 && <span className="text-accent">Includes FileTree.md</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-green-400 text-sm font-medium bg-green-400/10 px-3 py-1.5 rounded-full">
                  <Check size={14} /> Ready
                </div>
              </div>
              
              {/* Chunk File List (Flat Names) */}
              <div className="flex-1 overflow-y-auto p-4">
                <ul className="text-xs text-text-muted font-mono space-y-2">
                  {chunk.files.map(file => (
                    <li key={file.absolutePath} className="flex items-center justify-between group hover:text-text-primary transition-colors cursor-default">
                      <span className="truncate">{file.flatFileName}</span>
                      {file.compressions.length > 0 && (
                        <span className="ml-2 text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full shrink-0">
                          {file.compressions.length} skips
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
          
          {payload.chunks.length === 0 && (
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