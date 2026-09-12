// src/components/layout/MainStage.tsx
import { useEffect, useState, useRef } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { FileTree } from '../tree/FileTree';
import { ContextEditor } from '../editor/ContextEditor';
import { ExportStage } from '../export/ExportStage';
import { 
  Plus, 
  FolderOpen, 
  X, 
  GripVertical, 
  Settings2, 
  Loader2, 
  FolderSearch, 
  AlertTriangle,
  FileCode,
  Copy,
  FolderSymlink
} from 'lucide-react';
import { createPortal } from 'react-dom';

export function MainStage() {
  const { 
    rootPaths, 
    missingRoots,
    activeTab, 
    activeFile, 
    isExportStaging, 
    setExportStaging, 
    addRootPath, 
    removeRootPath,
    relocateRootPath,
    reorderRootPaths,
    setActiveTab, 
    rawTrees,
    stagingStatus,
    virtualGraph,
    stagePayloadJIT,
    chunkPaths,
    paneWidths,
    setPaneWidth,
    fetchGitStatus,
    incrementStat,
    editorTabs,
    activeEditorTabId,
    openEditorTab,
    closeEditorTab,
    closeOtherEditorTabs,
    closeEditorTabsToTheRight,
    closeAllEditorTabs,
    pinEditorTab,
    refreshVirtualGraph
  } = useWorkspaceStore();

  const [draggedRootPath, setDraggedRootPath] = useState<string | null>(null);
  const [tabContextMenu, setTabContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const rootTabsRef = useRef<HTMLDivElement>(null);
  const editorTabsRef = useRef<HTMLDivElement>(null);
  const tabMenuRef = useRef<HTMLDivElement>(null);
  const isRightDragRef = useRef(false);
  const dragStartXRef = useRef(0);
  const scrollStartLeftRef = useRef(0);

  const handleAddRoot = async () => {
    const path = await window.api.selectDirectory();
    if (path) await addRootPath(path);
  };

  const handleRelocateRoot = async (oldPath: string) => {
    const newPath = await window.api.selectDirectory();
    if (newPath) await relocateRootPath(oldPath, newPath);
  };

  useEffect(() => {
    const cleanup = window.api.onFileChange((event, changedPath) => {
      fetchGitStatus();
      if (event === 'add' || event === 'unlink') {
        const normalizedChanged = changedPath.replace(/\\/g, '/');
        const affectedRoot = rootPaths.find(root => normalizedChanged.startsWith(root.replace(/\\/g, '/')));
        if (affectedRoot) {
          addRootPath(affectedRoot, true);
        }
      }
      refreshVirtualGraph();
    });
    return cleanup;
  }, [rootPaths, addRootPath, fetchGitStatus, refreshVirtualGraph]);

  useEffect(() => {
    if (activeTab) fetchGitStatus();
  }, [activeTab, fetchGitStatus]);

  // Tab Context Menu Focus Management & Click-Outside Dismissal
  useEffect(() => {
    if (!tabContextMenu) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (tabMenuRef.current && !tabMenuRef.current.contains(e.target as Node)) {
        setTabContextMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTabContextMenu(null);
    };

    const handleWindowContextMenu = (e: MouseEvent) => {
      if (tabMenuRef.current && !tabMenuRef.current.contains(e.target as Node)) {
        setTabContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleWindowContextMenu);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleWindowContextMenu);
    };
  }, [tabContextMenu]);

  const handleHorizontalWheel = (e: React.WheelEvent) => {
    if (editorTabsRef.current) {
      editorTabsRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleEditorTabMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) {
      isRightDragRef.current = true;
      dragStartXRef.current = e.clientX;
      scrollStartLeftRef.current = editorTabsRef.current?.scrollLeft || 0;
    }
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isRightDragRef.current && editorTabsRef.current) {
        const delta = e.clientX - dragStartXRef.current;
        editorTabsRef.current.scrollLeft = scrollStartLeftRef.current - delta;
      }
    };
    const onUp = (e: MouseEvent) => {
      if (e.button === 2) isRightDragRef.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

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
  const isActiveMissing = activeTab ? missingRoots.has(activeTab) : false;

  return (
    <main className="flex-1 h-full flex flex-col min-w-0">
      <div className="h-14 flex bg-bg-panel border-b border-border-subtle items-end px-2 gap-1 overflow-x-auto shrink-0 justify-between">
        <div ref={rootTabsRef} className="flex items-end gap-1">
          {rootPaths.map((path) => {
            const isDragging = draggedRootPath === path;
            const isMissing = missingRoots.has(path);

            return (
              <div
                key={path}
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggedRootPath(path);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedRootPath && draggedRootPath !== path) {
                    reorderRootPaths(draggedRootPath, path);
                  }
                  setDraggedRootPath(null);
                }}
                onDragEnd={() => setDraggedRootPath(null)}
                onClick={() => setActiveTab(path)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  window.api.showItemInFolder(path);
                }}
                className={`group flex items-center gap-2 px-3 py-2 text-sm rounded-t-md border border-b-0 max-w-64 cursor-pointer transition-colors
                  ${isDragging ? 'opacity-40' : 'opacity-100'}
                  ${activeTab === path 
                    ? 'bg-bg-base border-border-subtle text-text-primary' 
                    : 'bg-transparent border-transparent text-text-muted hover:bg-bg-hover'}
                  ${isMissing ? 'text-red-400 border-red-500/30' : ''}`}
                title={path}
              >
                {isMissing && <AlertTriangle size={14} className="text-red-400 shrink-0 animate-pulse" />}
                <span className="truncate flex-1 pointer-events-none">{path.split(/[/\\]/).pop()}</span>
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
            );
          })}
          <button 
            onClick={handleAddRoot}
            className="px-3 py-2 text-text-muted hover:text-text-primary mb-1 ml-1 rounded-md hover:bg-bg-hover transition-colors flex items-center gap-1 text-sm font-medium"
          >
            <Plus size={16} /> Add Root
          </button>
        </div>

        {rootPaths.length > 0 && (
          <div className="flex items-center gap-2 mb-2 mr-2 shrink-0 z-30 backdrop-blur-md">
            <div className="flex items-center gap-2 mr-4">
              {stagingStatus === 'STAGING_LOCK' ? (
                <div className="flex items-center gap-2 text-sm text-accent px-3 py-1.5 bg-accent/10 rounded-full">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Staging Payload...</span>
                </div>
              ) : stagingStatus === 'DISK_READY' && chunkPaths.length > 0 ? (
                chunkPaths.map((chunkDir, idx) => {
                  const chunkFiles = virtualGraph?.chunks[idx]?.files || [];
                  const dragFiles = chunkFiles.map(f => `${chunkDir}/${f.flatFileName}`);
                  if (idx === 0 && virtualGraph?.manifestFileName) {
                    dragFiles.push(`${chunkDir}/${virtualGraph.manifestFileName}`);
                  }

                  return (
                    <button
                      key={chunkDir}
                      draggable
                      onDragStart={(e) => {
                        e.preventDefault();
                        window.api.startDrag(dragFiles);
                        incrementStat('totalExports', dragFiles.map(f => f.split(/[/\\]/).pop() || f));
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-500 text-white hover:bg-green-600 cursor-grab active:cursor-grabbing shadow-sm transition-all"
                      title={`Drag ${dragFiles.length} files to browser`}
                    >
                      <GripVertical size={14} className="opacity-70" />
                      Ready: Drag Chunk {idx + 1}
                    </button>
                  );
                })
              ) : (
                <button
                  onClick={() => stagePayloadJIT()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-accent/20 text-accent hover:bg-accent hover:text-white transition-all"
                  title="Stage physical payload in RAM to temporary disk"
                >
                  Stage Context
                </button>
              )}
            </div>

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

      <div className="flex-1 flex overflow-hidden relative z-10">
        {isActiveMissing ? (
          <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center bg-bg-panel/40">
            <AlertTriangle size={48} className="text-red-400 mb-4 animate-bounce" />
            <h2 className="text-xl font-semibold text-text-primary mb-2">Directory Not Found</h2>
            <p className="text-sm text-text-muted max-w-md mb-6 font-mono bg-bg-base p-3 rounded-lg border border-border-subtle">
              {activeTab}
            </p>
            <button
              onClick={() => handleRelocateRoot(activeTab!)}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors shadow-lg"
            >
              <FolderSearch size={16} /> Locate Directory
            </button>
          </div>
        ) : activeTree ? (
          <>
            <div 
              className="h-full overflow-y-auto p-4 bg-bg-base/60 backdrop-blur-md border-r border-border-subtle shrink-0 relative"
              style={{ width: paneWidths.tree }}
            >
              <FileTree node={activeTree} rootPath={activeTab!} relativePath="" />
              <div 
                className="absolute top-0 bottom-0 right-0 w-2 cursor-col-resize z-10 group flex justify-end"
                onPointerDown={handleTreeDragResize}
              >
                <div className="w-px h-full bg-border-subtle group-hover:bg-accent transition-colors" />
              </div>
            </div>

            <div className="flex-1 h-full bg-bg-panel/40 backdrop-blur-md overflow-hidden relative flex flex-col">
              {editorTabs.length > 0 && !isExportStaging && (
                <div 
                  ref={editorTabsRef}
                  onWheel={handleHorizontalWheel}
                  onMouseDown={handleEditorTabMouseDown}
                  className="h-9 flex items-end bg-bg-panel border-b border-border-subtle px-2 gap-1 overflow-x-auto select-none shrink-0"
                >
                  {editorTabs.map(tab => {
                    const isActive = activeEditorTabId === tab.id;
                    const fileName = tab.relativePath.split(/[/\\]/).pop() || tab.relativePath;

                    return (
                      <div
                        key={tab.id}
                        onClick={() => openEditorTab(tab.rootPath, tab.relativePath, false)}
                        onDoubleClick={() => pinEditorTab(tab.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setTabContextMenu({ id: tab.id, x: e.clientX, y: e.clientY });
                        }}
                        className={`group flex items-center gap-2 px-3 py-1.5 text-xs rounded-t-md border border-b-0 cursor-pointer transition-colors max-w-48
                          ${isActive 
                            ? 'bg-bg-base border-border-subtle text-text-primary' 
                            : 'bg-transparent border-transparent text-text-muted hover:bg-bg-hover'}
                          ${!tab.isPinned ? 'italic opacity-85' : 'font-normal'}`}
                        title={`${tab.rootPath}/${tab.relativePath}`}
                      >
                        <FileCode size={12} className={isActive ? 'text-accent' : 'opacity-60'} />
                        <span className="truncate select-none pointer-events-none">{fileName}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeEditorTab(tab.id);
                          }}
                          className="p-0.5 rounded hover:bg-red-400/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex-1 overflow-hidden relative">
                {isExportStaging ? (
                  <ExportStage />
                ) : activeFile && activeTab ? (
                  <ContextEditor key={`${activeTab}::${activeFile}`} rootPath={activeTab} relativePath={activeFile} />
                ) : (
                  <div className="flex h-full items-center justify-center text-text-muted text-sm bg-transparent">
                    <div className="flex flex-col items-center gap-3 opacity-50">
                      <span className="tracking-widest uppercase text-xs">Awaiting File Selection</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 h-full flex flex-col items-center justify-center text-text-muted bg-transparent">
            <FolderOpen size={48} className="mb-4 opacity-50" />
            <p>No workspace loaded.</p>
          </div>
        )}
      </div>

      {tabContextMenu && createPortal(
        <div 
          ref={tabMenuRef}
          className="fixed z-50 w-56 bg-bg-panel border border-border-subtle rounded-lg shadow-2xl py-1 text-xs text-text-primary animate-in fade-in zoom-in-95 duration-100"
          style={{ top: tabContextMenu.y, left: tabContextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button 
            onClick={() => { closeEditorTab(tabContextMenu.id); setTabContextMenu(null); }}
            className="w-full px-3 py-1.5 text-left hover:bg-bg-hover flex items-center justify-between"
          >
            <span>Close</span>
          </button>
          <button 
            onClick={() => { closeOtherEditorTabs(tabContextMenu.id); setTabContextMenu(null); }}
            className="w-full px-3 py-1.5 text-left hover:bg-bg-hover flex items-center justify-between"
          >
            <span>Close Others</span>
          </button>
          <button 
            onClick={() => { closeEditorTabsToTheRight(tabContextMenu.id); setTabContextMenu(null); }}
            className="w-full px-3 py-1.5 text-left hover:bg-bg-hover flex items-center justify-between"
          >
            <span>Close to the Right</span>
          </button>
          <button 
            onClick={() => { closeAllEditorTabs(); setTabContextMenu(null); }}
            className="w-full px-3 py-1.5 text-left hover:bg-bg-hover flex items-center justify-between text-red-400"
          >
            <span>Close All</span>
          </button>
          <div className="h-px bg-border-subtle my-1" />
          <button 
            onClick={() => {
              const tab = editorTabs.find(t => t.id === tabContextMenu.id);
              if (tab) navigator.clipboard.writeText(tab.relativePath);
              setTabContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-bg-hover flex items-center gap-2 text-text-muted hover:text-text-primary"
          >
            <Copy size={12} /> Copy Relative Path
          </button>
          <button 
            onClick={() => {
              const tab = editorTabs.find(t => t.id === tabContextMenu.id);
              if (tab) window.api.showItemInFolder(`${tab.rootPath}/${tab.relativePath}`);
              setTabContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-bg-hover flex items-center gap-2 text-text-muted hover:text-text-primary"
          >
            <FolderSymlink size={12} /> Reveal in OS
          </button>
        </div>,
        document.body
      )}
    </main>
  );
}