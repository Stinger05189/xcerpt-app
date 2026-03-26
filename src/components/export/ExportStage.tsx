// src/components/export/ExportStage.tsx
import { useMemo, useState } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useAppStore } from '../../store/appStore';
import { generateExportPayload } from '../../utils/exportEngine';
import type { ExportFile } from '../../types/ipc';
import { PackageOpen, Settings2, FileText, Database, Layers, Check, Infinity as InfinityIcon, ExternalLink, Ban, LayoutTemplate, ArrowUpDown, Zap } from 'lucide-react';

// Helper to wrap symbols in the brand accent color
function formatWithSymbols(text: string) {
  if (!text) return text;
  // Splits the string by common path/file symbols, keeping the delimiters in the array
  const parts = text.split(/([./_\\-])/g);
  return parts.map((part, i) => {
    if (/^[./_\\-]+$/.test(part)) {
      return <span key={i} className="text-accent">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

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
    chunkPaths,
    stats
  } = useWorkspaceStore();

  const extensionOverrides = useAppStore(s => s.config.extensionOverrides);

  const isUnlimited = maxFilesPerChunk >= 100000;

  const [sortConfig, setSortConfig] = useState<{ key: 'original' | 'exported' | 'size' | 'skips' | 'exports', direction: 'asc' | 'desc' }>({ key: 'original', direction: 'asc' });
  const [colWidths, setColWidths] = useState({ original: 200, exported: 250, size: 100, skips: 90, exports: 90 });

  // Compute the payload purely for UI rendering so the user sees exactly what the LLM sees
  const payload = useMemo(() => {
    return generateExportPayload(rootPaths, rawTrees, includes, excludes, treeOnly, compressions, maxFilesPerChunk, extensionOverrides);
  }, [rootPaths, rawTrees, includes, excludes, treeOnly, compressions, maxFilesPerChunk, extensionOverrides]);

  const totalFiles = payload.chunks.reduce((acc, c) => acc + c.files.length, 0);
  const filesWithCompressions = payload.chunks.flatMap(c => c.files).filter(f => f.compressions.length > 0).length;
  const isSingleChunk = payload.chunks.length === 1;

  const handleSort = (key: 'original' | 'exported' | 'size' | 'skips' | 'exports') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortFiles = (files: ExportFile[]) => {
    return [...files].sort((a, b) => {
      let valA: number | string = 0, valB: number | string = 0;
      
      if (sortConfig.key === 'original') {
         valA = a.relativePath.toLowerCase(); 
         valB = b.relativePath.toLowerCase();
      } else if (sortConfig.key === 'exported') {
         valA = a.flatFileName.toLowerCase(); 
         valB = b.flatFileName.toLowerCase();
      } else if (sortConfig.key === 'size') {
         valA = a.size; 
         valB = b.size;
      } else if (sortConfig.key === 'skips') {
         valA = a.compressions.length; 
         valB = b.compressions.length;
      } else if (sortConfig.key === 'exports') {
         valA = stats.fileFrequencies[a.flatFileName] || 0;
         valB = stats.fileFrequencies[b.flatFileName] || 0;
      }
    
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleResize = (e: React.PointerEvent, col: keyof typeof colWidths) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[col];
    
    const onMove = (moveEvent: PointerEvent) => {
      const newWidth = Math.max(60, startWidth + (moveEvent.clientX - startX));
      setColWidths(prev => ({ ...prev, [col]: newWidth }));
    };
    
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
    };
    
    document.body.style.cursor = 'col-resize';
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const totalTableWidth = colWidths.original + colWidths.exported + colWidths.size + colWidths.skips + colWidths.exports;

  return (
    <div className="h-full flex flex-col bg-bg-base overflow-hidden">
      {/* Header */}
      <div className="bg-bg-panel border-b border-border-subtle p-6 shrink-0 z-20">
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
              <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer hover:text-text-primary transition-colors pl-2">
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
          <div className="flex flex-wrap gap-3">
            <StatBadge icon={<FileText size={14}/>} label="Total Files" value={totalFiles} />
            <StatBadge icon={<Database size={14}/>} label="Size" value={`${((payload.metrics?.size || 0) / 1024).toFixed(1)} KB`} highlight />
            <StatBadge icon={<Zap size={14}/>} label="Tokens" value={(payload.metrics?.tokens || 0).toLocaleString()} highlight />
            <div className="w-px h-5 bg-border-subtle mx-1 self-center" />
            <StatBadge icon={<Layers size={14}/>} label="Chunks" value={payload.chunks.length} />
            <StatBadge icon={<Ban size={14}/>} label="Excluded" value={payload.metrics?.excluded || 0} />
            <StatBadge icon={<LayoutTemplate size={14}/>} label="Tree-Only" value={payload.metrics?.treeOnly || 0} />
            <StatBadge icon={<Database size={14}/>} label="Compressed" value={filesWithCompressions} highlight={filesWithCompressions > 0} />
          </div>
          
          {chunkPaths.length > 0 && (
            <button 
              onClick={() => window.api.openPath(chunkPaths[0])}
              className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors hover:underline whitespace-nowrap ml-4 shrink-0"
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
            <div key={index} className={`bg-bg-panel border border-border-subtle rounded-lg flex flex-col shadow-sm overflow-hidden ${isSingleChunk ? 'flex-1 min-h-0' : 'h-125'}`}>
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
              
              {/* Chunk File Table */}
              <div className="flex-1 overflow-auto">
                <table className="text-left border-collapse whitespace-nowrap table-fixed" style={{ width: totalTableWidth }}>
                  <colgroup>
                    <col style={{ width: colWidths.original }} />
                    <col style={{ width: colWidths.exported }} />
                    <col style={{ width: colWidths.size }} />
                    <col style={{ width: colWidths.skips }} />
                    <col style={{ width: colWidths.exports }} />
                  </colgroup>
                  <thead className="text-[10px] uppercase text-text-muted bg-bg-base/90 sticky top-0 z-10 backdrop-blur-md shadow-sm">
                    <tr>
                      <th className="relative px-4 py-2.5 font-semibold">
                        <div className="flex items-center gap-1.5 cursor-pointer hover:text-text-primary transition-colors select-none" onClick={() => handleSort('original')}>
                          File Name <ArrowUpDown size={10} className={sortConfig.key === 'original' ? 'text-accent' : 'opacity-50'} />
                        </div>
                        <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent transition-colors z-20" onPointerDown={(e) => handleResize(e, 'original')} />
                      </th>
                      <th className="relative px-4 py-2.5 font-semibold">
                        <div className="flex items-center gap-1.5 cursor-pointer hover:text-text-primary transition-colors select-none" onClick={() => handleSort('exported')}>
                          Exported As <ArrowUpDown size={10} className={sortConfig.key === 'exported' ? 'text-accent' : 'opacity-50'} />
                        </div>
                        <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent transition-colors z-20" onPointerDown={(e) => handleResize(e, 'exported')} />
                      </th>
                      <th className="relative px-4 py-2.5 font-semibold">
                        <div className="flex items-center gap-1.5 cursor-pointer hover:text-text-primary transition-colors select-none" onClick={() => handleSort('size')}>
                          Size <ArrowUpDown size={10} className={sortConfig.key === 'size' ? 'text-accent' : 'opacity-50'} />
                        </div>
                        <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent transition-colors z-20" onPointerDown={(e) => handleResize(e, 'size')} />
                      </th>
                      <th className="relative px-4 py-2.5 font-semibold">
                        <div className="flex items-center gap-1.5 cursor-pointer hover:text-text-primary transition-colors select-none" onClick={() => handleSort('skips')}>
                          Skips <ArrowUpDown size={10} className={sortConfig.key === 'skips' ? 'text-accent' : 'opacity-50'} />
                        </div>
                        <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent transition-colors z-20" onPointerDown={(e) => handleResize(e, 'skips')} />
                      </th>
                      <th className="relative px-4 py-2.5 font-semibold">
                        <div className="flex items-center gap-1.5 cursor-pointer hover:text-text-primary transition-colors select-none" onClick={() => handleSort('exports')}>
                          Exports <ArrowUpDown size={10} className={sortConfig.key === 'exports' ? 'text-accent' : 'opacity-50'} />
                        </div>
                        <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-accent transition-colors z-20" onPointerDown={(e) => handleResize(e, 'exports')} />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle text-xs text-text-muted font-mono">
                    {sortFiles(chunk.files).map(file => {
                      const exportCount = stats.fileFrequencies[file.flatFileName] || 0;
                      
                      // Size Formatting (Padded to 3 digits for average sizes ~0.6 -> 250.0)
                      const sizeKb = (file.size / 1024).toFixed(1);
                      const [whole, decimal] = sizeKb.split('.');
                      const paddedWhole = whole.padStart(3, '0');
                      const leadingZeros = paddedWhole.substring(0, paddedWhole.length - whole.length);

                      return (
                        <tr key={file.absolutePath} className="hover:bg-bg-hover transition-colors group">
                          <td className="px-4 py-2 group-hover:text-text-primary truncate" title={file.relativePath}>
                            {formatWithSymbols(file.relativePath.split(/[/\\]/).pop() || '')}
                          </td>
                          <td className="px-4 py-2 truncate text-text-muted/70 group-hover:text-text-muted" title={file.flatFileName}>
                            {formatWithSymbols(file.flatFileName)}
                          </td>
                          <td className="px-4 py-2">
                            <span className="opacity-0">{leadingZeros}</span>
                            <span>{whole}</span>
                            <span className="text-accent">.</span>
                            <span>{decimal}</span>
                            <span className="text-accent ml-1">KB</span>
                          </td>
                          <td className="px-4 py-2">
                            {file.compressions.length > 0 ? (
                              <span className="bg-accent/20 text-accent px-1.5 py-0.5 rounded shrink-0 text-[10px]">
                                {file.compressions.length}
                              </span>
                            ) : <span className="text-accent">-</span>}
                          </td>
                          <td className="px-4 py-2">
                            {exportCount > 0 ? <span className="text-accent">{exportCount}x</span> : <span className="text-accent">-</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          
          {payload.chunks.length === 0 && (
            <div className="text-center text-text-muted py-12 border border-dashed border-border-subtle rounded-lg bg-bg-panel h-full flex flex-col items-center justify-center col-span-full">
              No files match the current inclusion/exclusion rules.
            </div>
          )}
        </div>
      </div>
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