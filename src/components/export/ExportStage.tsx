// src/components/export/ExportStage.tsx
import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { PayloadPreviewTree } from './PayloadPreviewTree';
import { 
  PackageOpen, 
  FileText, 
  Database, 
  Check, 
  ExternalLink, 
  Zap, 
  X, 
  Loader2, 
  GripVertical, 
  BookOpen 
} from 'lucide-react';

export function ExportStage() {
  const { 
    virtualGraph, 
    stagingStatus, 
    stagePayloadJIT, 
    chunkPaths, 
    mergeToSingleFile, 
    setMergeToSingleFile, 
    embedProtocol, 
    setEmbedProtocol,
    refreshVirtualGraph,
    incrementStat 
  } = useWorkspaceStore();

  const [isPreviewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    refreshVirtualGraph();
  }, [refreshVirtualGraph]);

  const graph = virtualGraph;
  const isStaged = stagingStatus === 'DISK_READY' && chunkPaths.length > 0;
  const isLock = stagingStatus === 'STAGING_LOCK';

  return (
    <div className="h-full flex flex-col bg-bg-base overflow-hidden relative">
      <div className="bg-bg-panel border-b border-border-subtle p-6 shrink-0 z-20">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2 flex items-center gap-2 text-text-primary">
              <PackageOpen className="text-accent" /> Export Configuration
            </h2>
            <p className="text-text-muted text-sm max-w-lg">
              Virtual payload graph calculated 100% in RAM with zero background disk thrashing.
            </p>
          </div>
          
          <div className="bg-bg-base border border-border-subtle rounded-lg p-4 flex flex-col gap-3 min-w-72 shadow-sm">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-primary font-medium">Export Mode</span>
              <button 
                onClick={() => setPreviewOpen(true)}
                className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors"
              >
                <FileText size={14} /> Preview Manifest
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => setMergeToSingleFile(false)}
                className={`px-3 py-2 rounded-lg border transition-all ${!mergeToSingleFile ? 'bg-accent/20 text-accent border-accent font-medium' : 'bg-bg-panel border-border-subtle text-text-muted hover:text-text-primary'}`}
              >
                All Files Batch
              </button>
              <button
                onClick={() => setMergeToSingleFile(true)}
                className={`px-3 py-2 rounded-lg border transition-all ${mergeToSingleFile ? 'bg-accent/20 text-accent border-accent font-medium' : 'bg-bg-panel border-border-subtle text-text-muted hover:text-text-primary'}`}
              >
                Unified context.md
              </button>
            </div>

            <div className="border-t border-border-subtle pt-3 mt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-text-primary">
                <input
                  type="checkbox"
                  checked={embedProtocol}
                  onChange={(e) => setEmbedProtocol(e.target.checked)}
                  className="accent-accent w-4 h-4 rounded"
                />
                <span className="flex items-center gap-1">
                  <BookOpen size={13} className="text-accent" /> Embed Code Gen Protocol in Manifest
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mt-6 border-t border-border-subtle pt-4">
          <div className="flex flex-wrap gap-3">
            <StatBadge icon={<FileText size={14}/>} label="Total Files" value={graph?.totalFiles || 0} />
            <StatBadge icon={<Database size={14}/>} label="True Size" value={`${(((graph?.totalTrueSize || 0)) / 1024).toFixed(1)} KB`} highlight />
            <StatBadge icon={<Zap size={14}/>} label="Tokens" value={(graph?.totalTokens || 0).toLocaleString()} highlight />
            <div className="w-px h-5 bg-border-subtle mx-1 self-center" />
            <StatBadge icon={<Database size={14}/>} label="Saved via Skips" value={`${(((graph?.savedBytes || 0)) / 1024).toFixed(1)} KB`} highlight={(graph?.savedBytes || 0) > 0} />
          </div>

          <div className="flex items-center gap-3">
            {isStaged ? (
              <button
                draggable
                onDragStart={(e) => {
                  e.preventDefault();
                  const filesToDrag: string[] = [];
                  chunkPaths.forEach(cp => {
                    if (mergeToSingleFile) {
                      filesToDrag.push(`${cp}/context.md`);
                    } else {
                      const chunkFiles = graph?.chunks[0]?.files || [];
                      chunkFiles.forEach(f => filesToDrag.push(`${cp}/${f.flatFileName}`));
                      filesToDrag.push(`${cp}/${graph?.manifestFileName || 'ExportedFileTree.md'}`);
                    }
                  });
                  window.api.startDrag(filesToDrag);
                  incrementStat('totalExports', filesToDrag.map(f => f.split(/[/\\]/).pop() || f));
                }}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white font-medium rounded-full text-sm shadow-md hover:bg-green-600 cursor-grab active:cursor-grabbing transition-all animate-in fade-in"
              >
                <GripVertical size={16} /> Drag Context Package
              </button>
            ) : isLock ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-bg-panel border border-border-subtle text-accent rounded-full text-sm">
                <Loader2 size={16} className="animate-spin" /> Staging Payload...
              </div>
            ) : (
              <button
                onClick={() => stagePayloadJIT()}
                disabled={!graph || graph.totalFiles === 0}
                className="flex items-center gap-2 px-4 py-2 bg-accent text-white font-medium rounded-full text-sm shadow-md hover:bg-accent/90 disabled:opacity-40 transition-all"
              >
                <Check size={16} /> Stage Context Package
              </button>
            )}

            {chunkPaths.length > 0 && (
              <button 
                onClick={() => window.api.openPath(chunkPaths[0])}
                className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors hover:underline ml-2"
              >
                <ExternalLink size={14} /> Open Cache
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 flex-1 overflow-hidden flex flex-col">
        {graph && graph.nodes.length > 0 ? (
          <PayloadPreviewTree rootNodes={graph.nodes} />
        ) : (
          <div className="text-center text-text-muted py-12 border border-dashed border-border-subtle rounded-lg bg-bg-panel h-full flex flex-col items-center justify-center">
            No files match the active workspace inclusion and curation rules.
          </div>
        )}
      </div>

      {isPreviewOpen && graph && (
        <div className="absolute inset-0 z-50 bg-bg-base/95 backdrop-blur flex flex-col p-8 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div>
              <h2 className="text-2xl font-semibold flex items-center gap-2 text-text-primary mb-1">
                <FileText className="text-accent"/> {graph.manifestFileName}
              </h2>
              <p className="text-text-muted text-sm">Canonical manifest mapping injected into outbound AI context payloads.</p>
            </div>
            <button 
              onClick={() => setPreviewOpen(false)} 
              className="p-3 bg-bg-panel border border-border-subtle hover:bg-bg-hover rounded-full text-text-muted hover:text-red-400 transition-colors shadow-lg"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 bg-bg-panel border border-border-subtle rounded-xl overflow-hidden flex flex-col shadow-2xl">
            <div className="bg-bg-base px-4 py-3 border-b border-border-subtle text-xs font-mono text-text-muted flex justify-between items-center">
              <span className="flex items-center gap-2 text-text-primary"><FileText size={14} className="text-accent"/> Manifest Text</span>
              <span className="bg-accent/10 text-accent px-2 py-1 rounded">~{Math.round(new Blob([graph.treeMarkdown]).size / 4).toLocaleString()} Tokens</span>
            </div>
            <textarea 
              readOnly 
              value={graph.treeMarkdown}
              className="flex-1 w-full bg-transparent text-sm font-mono text-text-primary p-6 outline-none resize-none leading-relaxed"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatBadge({ icon, label, value, highlight = false }: { icon: React.ReactNode, label: string, value: number | string, highlight?: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm border 
      ${highlight ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-bg-hover border-border-subtle text-text-muted'}`}>
      {icon}
      <span>{label}: <strong className={highlight ? 'text-accent' : 'text-text-primary'}>{value}</strong></span>
    </div>
  );
}