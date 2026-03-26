// src/components/layout/MainStage.tsx
import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useAppStore } from '../../store/appStore';
import { generateExportPayload } from '../../utils/exportEngine';
import { FileTree } from '../tree/FileTree';
import { ContextEditor } from '../editor/ContextEditor';
import { ExportStage } from '../export/ExportStage';
import { Plus, FolderOpen, X, GripVertical, Settings2, Loader2 } from 'lucide-react';

export function MainStage() {
  const { 
    rootPaths, 
    activeTab, 
    activeFile, 
    isExportStaging, 
    setExportStaging, 
    addRootPath, 
    removeRootPath,
    setActiveTab, 
    rawTrees,
    includes,
    excludes,
    treeOnly,
    compressions,
    maxFilesPerChunk,
    isStale,
    isBuilding,
    chunkPaths,
    setExportState,
    paneWidths,
    setPaneWidth,
    fetchGitStatus,
    incrementStat
  } = useWorkspaceStore();

  const [activePayload, setActivePayload] = useState<ReturnType<typeof generateExportPayload> | null>(null);

  const extensionOverrides = useAppStore(s => s.config.extensionOverrides);

  const handleAddRoot = async () => {
    const path = await window.api.selectDirectory();
    if (path) {
      await addRootPath(path);
    }
  };

  // --- External Edit Watcher ---
  useEffect(() => {
    const cleanup = window.api.onFileChange((event, changedPath) => {
      console.log(`External edit detected [${event}]: ${changedPath}`);
      
      // Refresh git status implicitly in background
      fetchGitStatus();
    
      // If a file was added or deleted, we need to rescan the affected root before rebuilding
      if (event === 'add' || event === 'unlink') {
        const normalizedChanged = changedPath.replace(/\\/g, '/');
        const affectedRoot = rootPaths.find(root => normalizedChanged.startsWith(root.replace(/\\/g, '/')));
        
        if (affectedRoot) {
          addRootPath(affectedRoot); // This inherently rescans and updates rawTrees
        }
      }
      
      setExportState({ isStale: true });
    });
    return cleanup;
  }, [rootPaths, addRootPath, setExportState, fetchGitStatus]);

  // --- Auto-Build Pipeline: Mark Stale on Config Change ---
  useEffect(() => {
    if (rootPaths.length > 0) {
      setExportState({ isStale: true });
    } else {
      setExportState({ isStale: false, isBuilding: false, chunkPaths: [] });
      setTimeout(() => setActivePayload(null), 0);
    }
  }, [rootPaths, rawTrees, includes, excludes, treeOnly, compressions, maxFilesPerChunk, setExportState]);

  // --- Auto-Build Pipeline: Debounce and Execute ---
  useEffect(() => {
    if (!isStale || rootPaths.length === 0) return;
    
    const timer = setTimeout(async () => {
      setExportState({ isBuilding: true });
      try {
        const payload = generateExportPayload(rootPaths, rawTrees, includes, excludes, treeOnly, compressions, maxFilesPerChunk, extensionOverrides);
        setActivePayload(payload);
        
        if (payload.chunks.length > 0 && payload.chunks[0].files.length > 0) {
          const generatedPaths = await window.api.stageExport(payload);
          setExportState({ isStale: false, isBuilding: false, chunkPaths: generatedPaths });
        } else {
          setExportState({ isStale: false, isBuilding: false, chunkPaths: [] });
        }
      } catch (e) {
        console.error('Background build failed:', e);
        setExportState({ isBuilding: false, isStale: false });
      }
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [isStale, rootPaths, rawTrees, includes, excludes, treeOnly, compressions, maxFilesPerChunk, extensionOverrides, setExportState]);

  // --- Fetch Git Status on Tab Switch ---
  useEffect(() => {
    if (activeTab) {
      fetchGitStatus();
    }
  }, [activeTab, fetchGitStatus]);

  const handleTreeDragResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = paneWidths.tree;
    
    const onMove = (moveEvent: PointerEvent) => {
      const newWidth = Math.max(200, Math.min(800, startWidth + (moveEvent.clientX - startX)));
      setPaneWidth('tree', newWidth);
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

  const activeTree = activeTab ? rawTrees[activeTab] : null;
  const hasFiles = chunkPaths.length > 0;

  return (
    <main className="flex-1 h-full flex flex-col min-w-0">
      {/* Top Tabs & Global Actions */}
      <div className="h-14 flex bg-bg-panel border-b border-border-subtle items-end px-2 gap-1 overflow-x-auto shrink-0 justify-between">
        <div className="flex items-end gap-1">
          {rootPaths.map((path) => (
            <div
              key={path}
              onClick={() => setActiveTab(path)}
              onContextMenu={(e) => {
                e.preventDefault();
                window.api.showItemInFolder(path);
              }}
              className={`group flex items-center gap-2 px-3 py-2 text-sm rounded-t-md border border-b-0 max-w-64 cursor-pointer transition-colors
                ${activeTab === path 
                  ? 'bg-bg-base border-border-subtle text-text-primary' 
                  : 'bg-transparent border-transparent text-text-muted hover:bg-bg-hover'}`}
              title={path}
            >
              <span className="truncate flex-1">{path.split(/[/\\]/).pop()}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeRootPath(path);
                }}
                className="p-0.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-border-subtle text-text-muted hover:text-red-400 transition-all"
                title="Remove Root"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button 
            onClick={handleAddRoot}
            className="px-3 py-2 text-text-muted hover:text-text-primary mb-1 ml-1 rounded-md hover:bg-bg-hover transition-colors flex items-center gap-1 text-sm font-medium"
          >
            <Plus size={16} /> Add Root
          </button>
        </div>
        
        {/* Global Export Interactions */}
        {rootPaths.length > 0 && (
          <div className="flex items-center gap-2 mb-2 mr-2">
            
            <div className="flex items-center gap-2 mr-4">
              {(isStale || isBuilding) ? (
                <div className="flex items-center gap-2 text-sm text-accent px-3 py-1.5 bg-accent/10 rounded-full">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Syncing Payload...</span>
                </div>
              ) : hasFiles ? (
                chunkPaths.map((chunkDir, idx) => {
                  const chunkData = activePayload?.chunks[idx];
                  const dragFiles = chunkData?.files.map(f => `${chunkDir}/${f.flatFileName}`) || [];
                  if (idx === 0) dragFiles.push(`${chunkDir}/ExportedFileTree.md`);
                
                  return (
                    <button
                      key={chunkDir}
                      draggable
                      onDragStart={(e) => {
                        e.preventDefault();
                        window.api.startDrag(dragFiles);
                        // Log full workspace export stats
                        incrementStat('totalExports', dragFiles.map(f => f.split(/[/\\]/).pop() || f));
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-accent text-white hover:bg-accent/90 cursor-grab active:cursor-grabbing shadow-sm transition-all"
                      title={`Drag ${dragFiles.length} files to your browser`}
                    >
                      <GripVertical size={14} className="opacity-70" />
                      Drag {chunkPaths.length > 1 ? `Chunk ${idx + 1}` : 'Payload'}
                    </button>
                  );
                })
              ) : (
                <span className="text-sm text-text-muted italic px-2">No files included</span>
              )}
            </div>
            
            {/* Config Toggle */}
            <button 
              onClick={() => setExportStaging(!isExportStaging)}
              className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-colors
                ${isExportStaging ? 'bg-bg-hover text-text-primary border border-border-subtle' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}`}
            >
              <Settings2 size={14} /> {isExportStaging ? 'Close Config' : 'Configure'}
            </button>
          </div>
        )}
      </div>
    
      {/* Split Stage Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Tree */}
        {activeTree ? (
          <div 
            className="h-full overflow-y-auto p-4 bg-bg-base shrink-0 relative"
            style={{ width: paneWidths.tree }}
          >
            <FileTree node={activeTree} rootPath={activeTab!} relativePath="" />
            
            {/* Tree Drag Handle */}
            <div 
              className="absolute top-0 bottom-0 right-0 w-2 cursor-col-resize z-10 group flex justify-end"
              onPointerDown={handleTreeDragResize}
            >
              <div className="w-px h-full bg-border-subtle group-hover:bg-accent transition-colors" />
            </div>
          </div>
        ) : (
          <div className="flex-1 h-full flex flex-col items-center justify-center text-text-muted">
            <FolderOpen size={48} className="mb-4 opacity-50" />
            <p>No workspace loaded.</p>
          </div>
        )}
        
        {/* Right Pane: Editor or Export Stage */}
        {activeTree && (
          <div className="flex-1 h-full bg-bg-panel overflow-hidden relative">
            {isExportStaging ? (
              <ExportStage />
            ) : activeFile ? (
              <ContextEditor key={activeFile} rootPath={activeTab!} relativePath={activeFile} />
            ) : (
              <div className="flex h-full items-center justify-center text-text-muted text-sm">
                Select a file to compress context.
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}