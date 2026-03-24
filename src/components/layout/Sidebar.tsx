// src/components/layout/Sidebar.tsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { generateEphemeralPayload } from '../../utils/exportEngine';
import { Settings, History, BarChart2, Zap, FileJson, Clock, FolderLock, RefreshCw, ChevronDown, Edit2, Trash2, Plus, RotateCcw, Check, Loader2, GripVertical, MousePointer } from 'lucide-react';
import type { ExportHistory } from '../../types/ipc';

type Tab = 'RULES' | 'STATS' | 'HISTORY';

// Pure time formatter helper
const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export function Sidebar() {
  const { 
    excludes, removeExcludeRule, includes, treeOnly, compressions,
    hardBlacklist, removeBlacklistRule, addBlacklistRule,
    pendingBlacklist, removePendingBlacklistRule, commitBlacklist,
    isSidebarOpen, setSidebarOpen,
    activePresetId, presets, presetSnapshots, switchPreset, createPreset, renamePreset, deletePreset, revertPreset,
    setSelectedFiles, activeTab, rootPaths, rawTrees
  } = useWorkspaceStore();

  const [activeTabState, setActiveTabState] = useState<Tab>('RULES');
  const [newBlacklist, setNewBlacklist] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);

  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editPresetName, setEditPresetName] = useState('');

  const [hoveredHistoryId, setHoveredHistoryId] = useState<string | null>(null);

  // Local state to track payload generation per history item
  const [historyStates, setHistoryStates] = useState<Record<string, { loading: boolean, paths: string[] | null }>>({});

  const dropdownRef = useRef<HTMLDivElement>(null);
  const activePreset = presets.find(p => p.id === activePresetId);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsPresetDropdownOpen(false);
      }
    };
    if (isPresetDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPresetDropdownOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      
      if (e.key === 'Tab') {
        e.preventDefault(); 
        setSidebarOpen(!isSidebarOpen);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen, setSidebarOpen]);

  const handleAddBlacklist = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newBlacklist.trim()) {
      addBlacklistRule(newBlacklist.trim());
      setNewBlacklist('');
    }
  };

  const handleCommit = async () => {
    setIsCommitting(true);
    await commitBlacklist();
    setIsCommitting(false);
  };

  const handleCreatePreset = () => {
    createPreset("New Context");
    setIsPresetDropdownOpen(false);
  };

  const startRename = (id: string, currentName: string) => {
    setEditingPresetId(id);
    setEditPresetName(currentName);
    setIsPresetDropdownOpen(false);
  };

  const saveRename = () => {
    if (editingPresetId && editPresetName.trim()) {
      renamePreset(editingPresetId, editPresetName.trim());
    }
    setEditingPresetId(null);
  };

  // Determine if Revert button should be active
  const isDirty = useMemo(() => {
    if (!activePresetId || !presetSnapshots[activePresetId]) return false;
    const snap = presetSnapshots[activePresetId];
    
    // Fast JSON compare for structural equivalence
    if (JSON.stringify(snap.exclusions) !== JSON.stringify(excludes)) return true;
    if (JSON.stringify(snap.inclusions) !== JSON.stringify(includes)) return true;
    if (JSON.stringify(snap.treeOnly) !== JSON.stringify(treeOnly)) return true;
    if (JSON.stringify(snap.compressions) !== JSON.stringify(compressions)) return true;
    
    return false;
  }, [activePresetId, presetSnapshots, excludes, includes, treeOnly, compressions]);


  const handlePackageHistory = async (h: ExportHistory) => {
    const root = activeTab || rootPaths[0];
    const tree = root ? rawTrees[root] : null;
    if (!root || !tree || !h.files || h.files.length === 0) return;
    
    setHistoryStates(prev => ({ ...prev, [h.id]: { loading: true, paths: null } }));
    
    try {
      const payload = generateEphemeralPayload(root, tree, new Set(h.files), compressions);
      const paths = await window.api.stageEphemeralExport(payload);
      setHistoryStates(prev => ({ ...prev, [h.id]: { loading: false, paths } }));
    } catch (error) {
      console.error('Failed to package historical context', error);
      setHistoryStates(prev => ({ ...prev, [h.id]: { loading: false, paths: null } }));
    }
  };

  return (
    <>
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/10 backdrop-blur-[1px] transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Unified Sliding Container */}
      <div className={`fixed top-10 bottom-0 left-0 z-40 flex transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <aside className="w-80 h-full bg-bg-panel border-r border-border-subtle flex flex-col shadow-2xl shrink-0">
          
          {/* Workspace Title Header */}
        <div className="h-10 flex items-center px-4 border-b border-border-subtle shrink-0 bg-bg-base">
          <h1 className="font-semibold tracking-wide text-xs text-text-primary uppercase opacity-80 flex items-center gap-2">
            <FolderLock size={14} /> Workspace Inspector
          </h1>
        </div>
        
        {/* Preset Manager Block */}
        <div className="p-4 border-b border-border-subtle bg-bg-panel shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] uppercase font-semibold text-text-muted tracking-widest">Active Preset</h2>
            {presets.length > 1 && activePresetId && (
              <button 
                onClick={() => deletePreset(activePresetId)}
                className="text-text-muted hover:text-red-400 transition-colors p-1 rounded hover:bg-red-400/10"
                title="Delete Current Preset"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        
          <div className="relative" ref={dropdownRef}>
            {editingPresetId === activePresetId ? (
              <div className="flex items-center gap-2 w-full">
                <input 
                  autoFocus
                  value={editPresetName}
                  onChange={e => setEditPresetName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveRename()}
                  className="flex-1 bg-bg-base border border-accent rounded px-2 py-1.5 text-sm text-text-primary outline-none"
                />
                <button onClick={saveRename} className="text-green-400 p-1.5 bg-green-400/10 hover:bg-green-400/20 rounded transition-colors">
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsPresetDropdownOpen(!isPresetDropdownOpen)}
                  className="flex-1 flex items-center justify-between bg-bg-base border border-border-subtle hover:border-accent/50 rounded-lg px-3 py-2 text-sm text-text-primary transition-all text-left group"
                >
                  <span className="truncate pr-2 font-medium">{activePreset?.name || 'Unknown Preset'}</span>
                  <ChevronDown size={14} className="text-text-muted group-hover:text-text-primary transition-colors shrink-0" />
                </button>
                <button 
                  onClick={() => startRename(activePresetId!, activePreset?.name || '')}
                  className="p-2 text-text-muted hover:text-accent hover:bg-bg-hover rounded-lg transition-colors border border-transparent"
                  title="Rename Preset"
                >
                  <Edit2 size={14} />
                </button>
              </div>
            )}
            
            {/* Preset Dropdown Overlay */}
            {isPresetDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-bg-base border border-border-subtle rounded-lg shadow-xl z-50 overflow-hidden flex flex-col max-h-48">
                <div className="flex-1 overflow-y-auto py-1">
                  {presets.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { switchPreset(p.id); setIsPresetDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-bg-hover transition-colors flex items-center justify-between ${p.id === activePresetId ? 'text-accent font-medium bg-accent/5' : 'text-text-primary'}`}
                    >
                      <span className="truncate">{p.name}</span>
                      {p.id === activePresetId && <Check size={14} />}
                    </button>
                  ))}
                </div>
                <div className="border-t border-border-subtle p-1 shrink-0 bg-bg-panel">
                  <button 
                    onClick={handleCreatePreset}
                    className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-medium text-text-primary hover:text-accent hover:bg-bg-hover rounded transition-colors"
                  >
                    <Plus size={14} /> Create New Preset
                  </button>
                </div>
              </div>
            )}
          </div>
        
          <button
            onClick={revertPreset}
            disabled={!isDirty}
            className={`flex items-center justify-center gap-2 w-full py-1.5 rounded-lg text-xs font-semibold transition-all border
              ${isDirty 
                ? 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20' 
                : 'bg-bg-base text-text-muted/50 border-border-subtle cursor-not-allowed'}`}
            title={isDirty ? "Revert uncommitted session changes" : "Preset is identical to original state"}
          >
            <RotateCcw size={12} className={isDirty ? '' : 'opacity-50'} /> 
            {isDirty ? 'Revert Session Changes' : 'Up to Date'}
          </button>
        </div>
      
        {/* Tabs */}
        <div className="flex border-b border-border-subtle text-xs font-medium text-text-muted shrink-0 bg-bg-base">
          <button onClick={() => setActiveTabState('RULES')} className={`flex-1 py-2.5 transition-colors border-b-2 flex items-center justify-center gap-1.5 ${activeTabState === 'RULES' ? 'border-accent text-accent bg-bg-panel' : 'border-transparent hover:text-text-primary'}`}>
            <Settings size={14} /> Rules
          </button>
          <button onClick={() => setActiveTabState('STATS')} className={`flex-1 py-2.5 transition-colors border-b-2 flex items-center justify-center gap-1.5 ${activeTabState === 'STATS' ? 'border-accent text-accent bg-bg-panel' : 'border-transparent hover:text-text-primary'}`}>
            <BarChart2 size={14} /> Stats
          </button>
          <button onClick={() => setActiveTabState('HISTORY')} className={`flex-1 py-2.5 transition-colors border-b-2 flex items-center justify-center gap-1.5 ${activeTabState === 'HISTORY' ? 'border-accent text-accent bg-bg-panel' : 'border-transparent hover:text-text-primary'}`}>
            <History size={14} /> History
          </button>
        </div>
      
        <div className="flex-1 overflow-y-auto p-4 bg-bg-panel">
          {activeTabState === 'RULES' && (
            <div className="space-y-8">
              {/* Workspace Globals */}
              <div>
                <div className="mb-3">
                  <h2 className="text-[10px] uppercase font-semibold text-text-muted tracking-widest flex items-center gap-2">
                    Global Workspace Rules
                  </h2>
                  <p className="text-[10px] text-text-muted mt-1 leading-tight">
                    Scanner blacklists apply across ALL presets.
                  </p>
                </div>
                
                <input 
                  type="text" 
                  value={newBlacklist}
                  onChange={(e) => setNewBlacklist(e.target.value)}
                  onKeyDown={handleAddBlacklist}
                  placeholder="Type folder name and press Enter..."
                  className="w-full bg-bg-base border border-border-subtle rounded px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent mb-2"
                />
                
                <ul className="space-y-1 mb-2">
                  {pendingBlacklist.map((rule) => (
                    <li key={`pending-${rule}`} className="flex items-center justify-between group px-2 py-1.5 bg-orange-500/10 border border-orange-500/30 border-dashed rounded-md text-sm">
                      <span className="truncate font-mono text-xs text-orange-400">{rule} (Pending)</span>
                      <button onClick={() => removePendingBlacklistRule(rule)} className="text-text-muted hover:text-orange-400 transition-opacity">&times;</button>
                    </li>
                  ))}
                  
                  {hardBlacklist.map((rule) => (
                    <li key={`hard-${rule}`} className="flex items-center justify-between group px-2 py-1.5 bg-bg-base border border-border-subtle rounded-md text-sm">
                      <span className="truncate font-mono text-xs text-red-400">{rule}</span>
                      <button onClick={() => removeBlacklistRule(rule)} className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-opacity">&times;</button>
                    </li>
                  ))}
                </ul>
                
                {pendingBlacklist.length > 0 && (
                  <button 
                    onClick={handleCommit}
                    disabled={isCommitting}
                    className="w-full flex items-center justify-center gap-2 py-1.5 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/50 rounded text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={isCommitting ? 'animate-spin' : ''} />
                    {isCommitting ? 'Rescanning Roots...' : 'Apply & Rescan Workspace'}
                  </button>
                )}
              </div>
            
              {/* Preset Specifics */}
              <div className="pt-4 border-t border-border-subtle">
                <div className="mb-3">
                  <h2 className="text-[10px] uppercase font-semibold text-text-muted tracking-widest flex items-center gap-2">
                    Preset Specific Rules
                  </h2>
                  <p className="text-[10px] text-text-muted mt-1 leading-tight">
                    Visual exclusions explicitly mapped to <span className="text-accent">{activePreset?.name}</span>.
                  </p>
                </div>
                <ul className="space-y-1">
                  {excludes.map((rule) => (
                    <li key={rule} className="flex items-center justify-between group px-2 py-1.5 hover:bg-bg-hover rounded-md cursor-default text-sm border border-transparent hover:border-border-subtle">
                      <span className="truncate font-mono text-xs">{rule}</span>
                      <button onClick={() => removeExcludeRule(rule)} className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-opacity">&times;</button>
                    </li>
                  ))}
                  {excludes.length === 0 && (
                    <li className="text-xs text-text-muted italic px-2">No active exclusions.</li>
                  )}
                </ul>
              </div>
            </div>
          )}
          
          {activeTabState === 'STATS' && (
            <div className="space-y-4">
              <h2 className="text-xs uppercase font-semibold text-text-muted mb-3 tracking-widest">Live Estimations</h2>
              <div className="bg-bg-base border border-border-subtle rounded-lg p-3 flex flex-col gap-1">
                <span className="text-xs text-text-muted flex items-center gap-1"><Zap size={12}/> Estimated Tokens</span>
                <span className="text-xl font-semibold text-text-primary">124,500</span>
                <span className="text-xs text-accent mt-1">-12,000 via Skips</span>
              </div>
              <div className="bg-bg-base border border-border-subtle rounded-lg p-3 flex flex-col gap-1">
                <span className="text-xs text-text-muted flex items-center gap-1"><FileJson size={12}/> Included Files</span>
                <span className="text-xl font-semibold text-text-primary">42 / 1,204</span>
              </div>
            </div>
          )}
          
          {activeTabState === 'HISTORY' && (
            <div className="space-y-4">
              <div className="mb-3">
                <h2 className="text-[10px] uppercase font-semibold text-text-muted tracking-widest flex items-center gap-2">
                  Session Exports
                </h2>
                <p className="text-[10px] text-text-muted mt-1 leading-tight">
                  Drag-and-drop context packages generated in <span className="text-accent">{activePreset?.name}</span>.
                </p>
              </div>
              
              <div className="border-l-2 border-border-subtle pl-3 space-y-4 pb-4">
                {activePreset?.history && activePreset.history.length > 0 ? (
                  activePreset.history.map((h) => {
                    const hasFiles = h.files && h.files.length > 0;
                    const bState = historyStates[h.id] || { loading: false, paths: null };
                    
                    return (
                      <div 
                        key={h.id} 
                        className={`group relative -ml-3 pl-3 py-2 rounded transition-colors ${hasFiles ? 'hover:bg-bg-hover' : 'opacity-70 cursor-default'}`}
                        onMouseEnter={() => setHoveredHistoryId(h.id)}
                      >
                        <div className={`absolute left-0.75 top-3.5 w-2 h-2 rounded-full transition-colors ${hasFiles ? 'bg-border-subtle group-hover:bg-accent' : 'bg-border-subtle/50'}`} />
                        <div className={`text-sm font-medium transition-colors ${hasFiles ? 'text-text-primary group-hover:text-accent' : 'text-text-muted'}`}>
                          Context Package
                        </div>
                        <div className="text-xs text-text-muted flex items-center gap-1 mt-1">
                          <Clock size={10} /> {timeAgo(h.date)}
                        </div>
                        <div className="text-[10px] text-text-muted/70 mt-1 font-mono flex gap-2">
                          <span>{h.fileCount} files</span>
                          <span>•</span>
                          <span>{(h.totalSize / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span className="text-accent/80">~{h.estimatedTokens.toLocaleString()} tkns</span>
                        </div>
                        
                        {hasFiles && (
                          <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            {bState.loading ? (
                              <div className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-bg-base border border-border-subtle text-accent rounded text-[10px] font-medium">
                                <Loader2 size={12} className="animate-spin" /> Packaging...
                              </div>
                            ) : bState.paths ? (
                              <button
                                draggable
                                onDragStart={(e) => {
                                  e.preventDefault();
                                  window.api.startDrag(bState.paths!);
                                }}
                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-accent text-white border border-accent rounded text-[10px] font-semibold hover:bg-accent/90 cursor-grab active:cursor-grabbing transition-colors shadow-sm"
                              >
                                <GripVertical size={12} className="opacity-70" /> Drag Package
                              </button>
                            ) : (
                              <button 
                                onClick={() => handlePackageHistory(h)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-bg-base border border-border-subtle hover:border-accent/50 text-text-primary hover:text-accent rounded text-[10px] font-medium transition-colors"
                              >
                                <Zap size={12} /> Package Context
                              </button>
                            )}
                            
                            <button 
                              onClick={() => {
                                setSelectedFiles(new Set(h.files));
                                setSidebarOpen(false);
                              }}
                              className="px-2.5 py-1.5 bg-bg-base border border-border-subtle hover:border-accent/50 text-text-muted hover:text-accent rounded transition-colors"
                              title="Select files in tree"
                            >
                              <MousePointer size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-text-muted italic opacity-50">No context packages generated yet.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    
      {/* Hover Flyout for History Items */}
      {hoveredHistoryId && activePreset && activeTabState === 'HISTORY' && (
        <div className="w-72 h-full bg-bg-panel border-r border-border-subtle shadow-2xl flex flex-col animate-in fade-in slide-in-from-left-2 duration-200 pointer-events-none shrink-0">
          <div className="p-4 border-b border-border-subtle shrink-0 bg-bg-base">
            <h3 className="font-semibold text-text-primary text-xs uppercase tracking-widest">Package Contents</h3>
            <p className="text-[10px] text-text-muted mt-1">Click to restore this selection to the tree.</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {(() => {
              const hoveredItem = activePreset.history.find(h => h.id === hoveredHistoryId);
              const files = hoveredItem?.files || [];
              
              if (files.length === 0) {
                return <div className="text-[11px] text-text-muted italic opacity-50">Legacy export: File list unavailable.</div>;
              }

              return files.map(f => (
                <div key={f} className="text-[11px] font-mono text-text-muted truncate transition-colors" title={f}>
                  {f}
                </div>
              ));
              })()}
            </div>
          </div>
        )}
      </div>
    </>
  );
}