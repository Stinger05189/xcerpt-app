// src/components/layout/Sidebar.tsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { useWorkspaceStore, type WorkspaceProfileReport } from '../../store/workspaceStore';
import { useAppStore } from '../../store/appStore';
import { generateEphemeralPayload } from '../../utils/exportEngine';
import { parseScopedPathKey, isScopedKey } from '../../utils/filterEngine';
import { 
  Settings, 
  History, 
  BarChart2, 
  Zap, 
  FileJson, 
  Clock, 
  FolderLock, 
  RefreshCw, 
  ChevronDown, 
  Edit2, 
  Trash2, 
  Plus, 
  RotateCcw, 
  Check, 
  Loader2, 
  GripVertical, 
  MousePointer, 
  Activity, 
  X, 
  Copy,
  Gauge,
  Sparkles
} from 'lucide-react';
import type { ExportHistory } from '../../types/ipc';

type Tab = 'RULES' | 'STATS' | 'HISTORY';

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
  // Granular store subscriptions: strictly decoupled from selectedFiles & isPainting
  const workspaceId = useWorkspaceStore(s => s.workspaceId);
  const workspaceName = useWorkspaceStore(s => s.workspaceName);
  const setWorkspaceName = useWorkspaceStore(s => s.setWorkspaceName);

  const excludes = useWorkspaceStore(s => s.excludes);
  const removeExcludeRule = useWorkspaceStore(s => s.removeExcludeRule);
  const includes = useWorkspaceStore(s => s.includes);
  const treeOnly = useWorkspaceStore(s => s.treeOnly);
  const compressions = useWorkspaceStore(s => s.compressions);

  const hardBlacklist = useWorkspaceStore(s => s.hardBlacklist);
  const removeBlacklistRule = useWorkspaceStore(s => s.removeBlacklistRule);
  const addBlacklistRule = useWorkspaceStore(s => s.addBlacklistRule);
  const pendingBlacklist = useWorkspaceStore(s => s.pendingBlacklist);
  const removePendingBlacklistRule = useWorkspaceStore(s => s.removePendingBlacklistRule);
  const commitBlacklist = useWorkspaceStore(s => s.commitBlacklist);

  const respectGitignore = useWorkspaceStore(s => s.respectGitignore);
  const setRespectGitignore = useWorkspaceStore(s => s.setRespectGitignore);

  const isSidebarOpen = useWorkspaceStore(s => s.isSidebarOpen);
  const setSidebarOpen = useWorkspaceStore(s => s.setSidebarOpen);

  const activePresetId = useWorkspaceStore(s => s.activePresetId);
  const presets = useWorkspaceStore(s => s.presets);
  const presetSnapshots = useWorkspaceStore(s => s.presetSnapshots);
  const switchPreset = useWorkspaceStore(s => s.switchPreset);
  const createPreset = useWorkspaceStore(s => s.createPreset);
  const duplicatePreset = useWorkspaceStore(s => s.duplicatePreset);
  const createPresetFromSelection = useWorkspaceStore(s => s.createPresetFromSelection);
  const renamePreset = useWorkspaceStore(s => s.renamePreset);
  const deletePreset = useWorkspaceStore(s => s.deletePreset);
  const revertPreset = useWorkspaceStore(s => s.revertPreset);

  const activeTab = useWorkspaceStore(s => s.activeTab);
  const rootPaths = useWorkspaceStore(s => s.rootPaths);
  const rawTrees = useWorkspaceStore(s => s.rawTrees);
  const paneWidths = useWorkspaceStore(s => s.paneWidths);
  const setPaneWidth = useWorkspaceStore(s => s.setPaneWidth);
  const stats = useWorkspaceStore(s => s.stats);
  const virtualGraph = useWorkspaceStore(s => s.virtualGraph);

  const compactAllRules = useWorkspaceStore(s => s.compactAllRules);
  const profileActiveWorkspace = useWorkspaceStore(s => s.profileActiveWorkspace);
  const setSelectedFiles = useWorkspaceStore(s => s.setSelectedFiles);

  const extensionOverrides = useAppStore(s => s.config.extensionOverrides);

  const [activeTabState, setActiveTabState] = useState<Tab>('RULES');
  const [newBlacklist, setNewBlacklist] = useState('');
  const [ruleSearchQuery, setRuleSearchQuery] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editPresetName, setEditPresetName] = useState('');

  const [hoveredHistoryId, setHoveredHistoryId] = useState<string | null>(null);
  const [historyStates, setHistoryStates] = useState<Record<string, { loading: boolean, paths: string[] | null }>>({});

  const [profileReport, setProfileReport] = useState<WorkspaceProfileReport | null>(null);
  const [copiedProfile, setCopiedProfile] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const activePreset = presets.find(p => p.id === activePresetId);

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
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
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

  const handleDuplicatePreset = () => {
    if (activePresetId) {
      duplicatePreset(activePresetId);
      setIsPresetDropdownOpen(false);
    }
  };

  const handleCreateFromSelection = () => {
    createPresetFromSelection("Curated Selection Context");
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

  const isDirty = useMemo(() => {
    if (!activePresetId || !presetSnapshots[activePresetId]) return false;
    const snap = presetSnapshots[activePresetId];
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
      const payload = generateEphemeralPayload(
        root, 
        tree, 
        new Set(h.files), 
        useWorkspaceStore.getState().compressions, 
        extensionOverrides, 
        useWorkspaceStore.getState().mergeToSingleFile,
        useWorkspaceStore.getState().embedProtocol
      );
      const paths = await window.api.stageEphemeralExport(payload);
      setHistoryStates(prev => ({ ...prev, [h.id]: { loading: false, paths } }));
      useWorkspaceStore.getState().incrementStat('ephemeralExports', h.files);
    } catch (error) {
      console.error('Failed to package historical context', error);
      setHistoryStates(prev => ({ ...prev, [h.id]: { loading: false, paths: null } }));
    }
  };

  const handleDragResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = paneWidths.sidebar;

    const onMove = (moveEvent: PointerEvent) => {
      const newWidth = Math.max(240, Math.min(600, startWidth + (moveEvent.clientX - startX)));
      setPaneWidth('sidebar', newWidth);
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

  const handleSaveWorkspaceName = async () => {
    const trimmed = tempName.trim();
    setWorkspaceName(trimmed);
    if (workspaceId) {
      await window.api.renameWorkspace(workspaceId, trimmed);
    }
    setIsEditingName(false);
  };

  const runProfile = () => {
    const rep = profileActiveWorkspace();
    setProfileReport(rep);
  };

  const copyProfileReport = () => {
    if (!profileReport) return;
    const text = [
      `--- XCERT LIVE WORKSPACE PROFILE ---`,
      `Timestamp: ${profileReport.timestamp}`,
      `Total Indexed Files: ${profileReport.totalFilesCount.toLocaleString()}`,
      `Active Roots: ${profileReport.rootCount}`,
      `Active Excludes: ${profileReport.ruleCounts.excludes}`,
      `Active Tree-Only: ${profileReport.ruleCounts.treeOnly}`,
      `Active Inclusions: ${profileReport.ruleCounts.includes}`,
      `Scoped Index Build: ${profileReport.timings.indexBuildMs} ms`,
      `Tree Traversal Check: ${profileReport.timings.traversalCheckMs} ms`,
      `Virtual Graph Build: ${profileReport.timings.virtualGraphMs} ms`,
      `------------------------------------`
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopiedProfile(true);
    setTimeout(() => setCopiedProfile(false), 2000);
  };

  const filteredExcludes = useMemo(() => {
    const term = ruleSearchQuery.toLowerCase().trim();
    if (!term) return excludes;
    return excludes.filter(r => r.toLowerCase().includes(term));
  }, [excludes, ruleSearchQuery]);

  const formatDisplayRule = (rule: string) => {
    if (isScopedKey(rule)) {
      const { rootId, relativePath } = parseScopedPathKey(rule);
      const rootLeaf = rootId.split(/[/\\]/).pop() || 'Root';
      return { rootLeaf, path: relativePath };
    }
    return { rootLeaf: 'Global', path: rule };
  };

  return (
    <>
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/10 backdrop-blur-[1px] transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`fixed top-10 bottom-0 left-0 z-40 flex transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <aside 
          className="h-full bg-bg-panel/60 backdrop-blur-xl border-r border-border-subtle flex flex-col shadow-2xl shrink-0 relative"
          style={{ width: paneWidths.sidebar }}
        >
          <div 
            className="absolute top-0 bottom-0 -right-1.5 w-3 cursor-col-resize z-50 group"
            onPointerDown={handleDragResize}
          >
            <div className="w-0.5 h-full mx-auto bg-transparent group-hover:bg-accent/50 transition-colors" />
          </div>

          <div className="h-10 flex items-center justify-between px-4 border-b border-border-subtle shrink-0 bg-bg-base">
            {isEditingName ? (
              <div className="flex items-center gap-1.5 w-full">
                <input 
                  autoFocus
                  value={tempName}
                  onChange={e => setTempName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveWorkspaceName()}
                  className="flex-1 bg-bg-panel border border-accent rounded px-2 py-0.5 text-xs text-text-primary outline-none"
                  placeholder="Workspace Name"
                />
                <button onClick={handleSaveWorkspaceName} className="text-green-400 p-1 hover:bg-green-400/20 rounded transition-colors" title="Save Name">
                  <Check size={14} />
                </button>
                <button onClick={() => setIsEditingName(false)} className="text-text-muted p-1 hover:bg-bg-hover rounded transition-colors" title="Cancel">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <h1 className="font-semibold tracking-wide text-xs text-text-primary uppercase opacity-80 flex items-center gap-2 truncate pr-2" title={workspaceName || "Workspace Inspector"}>
                  <FolderLock size={14} className="shrink-0" /> {workspaceName || "Workspace Inspector"}
                </h1>
                <button 
                  onClick={() => { setTempName(workspaceName || ''); setIsEditingName(true); }}
                  className="text-text-muted hover:text-accent p-1 rounded hover:bg-bg-hover transition-colors shrink-0"
                  title="Rename Workspace"
                >
                  <Edit2 size={12} />
                </button>
              </>
            )}
          </div>

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

              {isPresetDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-bg-base border border-border-subtle rounded-lg shadow-xl z-50 overflow-hidden flex flex-col max-h-64">
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
                  <div className="border-t border-border-subtle p-1 shrink-0 bg-bg-panel space-y-1">
                    <button 
                      onClick={handleCreatePreset}
                      className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-medium text-text-primary hover:text-accent hover:bg-bg-hover rounded transition-colors"
                    >
                      <Plus size={14} /> Create Blank Preset
                    </button>
                    <button 
                      onClick={handleDuplicatePreset}
                      className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-medium text-text-primary hover:text-accent hover:bg-bg-hover rounded transition-colors"
                    >
                      <Copy size={14} /> Duplicate Preset (Clone)
                    </button>
                    <button 
                      onClick={handleCreateFromSelection}
                      className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-medium text-text-primary hover:text-accent hover:bg-bg-hover rounded transition-colors"
                    >
                      <Zap size={14} /> Create from Selection
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

          <div className="flex border-b border-border-subtle text-xs font-medium text-text-muted shrink-0 bg-bg-base">
            <button onClick={() => setActiveTabState('RULES')} className={`flex-1 py-2.5 transition-colors border-b-2 flex items-center justify-center gap-1.5 ${activeTabState === 'RULES' ? 'border-accent text-accent bg-bg-panel' : 'border-transparent hover:text-text-primary'}`}>
              <Settings size={14} /> Rules ({excludes.length})
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
              <div className="space-y-6">
                <div>
                  <div className="mb-2">
                    <h2 className="text-[10px] uppercase font-semibold text-text-muted tracking-widest flex items-center gap-2">
                      Global Blacklists
                    </h2>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-text-primary mb-3 bg-bg-base border border-border-subtle p-2 rounded-md">
                    <input 
                      type="checkbox"
                      checked={respectGitignore}
                      onChange={(e) => setRespectGitignore(e.target.checked)}
                      className="accent-accent w-3.5 h-3.5"
                    />
                    <span>Respect .gitignore rules</span>
                  </label>

                  <input 
                    type="text" 
                    value={newBlacklist}
                    onChange={(e) => setNewBlacklist(e.target.value)}
                    onKeyDown={handleAddBlacklist}
                    placeholder="Blacklist folder name across all roots..."
                    className="w-full bg-bg-base border border-border-subtle rounded px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent mb-2"
                  />

                  <ul className="space-y-1 mb-2 max-h-32 overflow-y-auto pr-1">
                    {pendingBlacklist.map((rule) => (
                      <li key={`pending-${rule}`} className="flex items-center justify-between group px-2 py-1 bg-orange-500/10 border border-orange-500/30 border-dashed rounded text-xs">
                        <span className="truncate font-mono text-orange-400">{rule} (Pending)</span>
                        <button onClick={() => removePendingBlacklistRule(rule)} className="text-text-muted hover:text-orange-400">&times;</button>
                      </li>
                    ))}
                    {hardBlacklist.map((rule) => (
                      <li key={`hard-${rule}`} className="flex items-center justify-between group px-2 py-1 bg-bg-base border border-border-subtle rounded text-xs">
                        <span className="truncate font-mono text-red-400">{rule}</span>
                        <button onClick={() => removeBlacklistRule(rule)} className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400">&times;</button>
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

                <div className="pt-4 border-t border-border-subtle flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-[10px] uppercase font-semibold text-text-muted tracking-widest">
                      Active Exclusions ({excludes.length})
                    </h2>
                    {excludes.length > 0 && (
                      <button
                        onClick={() => compactAllRules()}
                        className="text-[10px] text-accent hover:underline flex items-center gap-1"
                        title="Prune redundant child file rules"
                      >
                        <Sparkles size={10} /> Compact
                      </button>
                    )}
                  </div>

                  {excludes.length > 10 && (
                    <input 
                      type="text" 
                      value={ruleSearchQuery}
                      onChange={(e) => setRuleSearchQuery(e.target.value)}
                      placeholder="Filter exclusions..."
                      className="w-full bg-bg-base border border-border-subtle rounded px-2 py-1 text-xs text-text-primary outline-none mb-2"
                    />
                  )}

                  <ul className="space-y-1 max-h-80 overflow-y-auto pr-1">
                    {filteredExcludes.map((rule) => {
                      const { rootLeaf, path } = formatDisplayRule(rule);
                      return (
                        <li key={rule} className="flex items-center justify-between group px-2 py-1 hover:bg-bg-hover rounded cursor-default text-xs border border-transparent hover:border-border-subtle">
                          <span className="truncate font-mono flex items-center gap-1.5 pr-2" title={rule}>
                            <span className="text-[9px] uppercase px-1 py-0.2 bg-bg-base border border-border-subtle rounded text-text-muted shrink-0">{rootLeaf}</span>
                            <span className="truncate text-text-primary">{path}</span>
                          </span>
                          <button onClick={() => removeExcludeRule(rule)} className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 shrink-0">&times;</button>
                        </li>
                      );
                    })}
                    {filteredExcludes.length === 0 && (
                      <li className="text-xs text-text-muted italic px-2">No exclusions matching.</li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {activeTabState === 'STATS' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xs uppercase font-semibold text-text-muted mb-3 tracking-widest flex items-center gap-2"><Activity size={14} /> Workspace Metrics</h2>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-bg-base border border-border-subtle rounded-lg p-3 flex flex-col gap-1">
                      <span className="text-[10px] uppercase text-text-muted tracking-wide">Full Exports</span>
                      <span className="text-2xl font-semibold text-text-primary">{stats.totalExports}</span>
                    </div>
                    <div className="bg-bg-base border border-border-subtle rounded-lg p-3 flex flex-col gap-1">
                      <span className="text-[10px] uppercase text-text-muted tracking-wide">Ephemeral Exports</span>
                      <span className="text-2xl font-semibold text-accent">{stats.ephemeralExports}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-xs uppercase font-semibold text-text-muted mb-3 tracking-widest">Live Virtual Graph</h2>
                  <div className="bg-bg-base border border-border-subtle rounded-lg p-3 flex flex-col gap-1 mb-2">
                    <span className="text-xs text-text-muted flex items-center gap-1"><Zap size={12}/> True Context Tokens</span>
                    <span className="text-xl font-semibold text-text-primary">{(virtualGraph?.totalTokens || 0).toLocaleString()}</span>
                    <span className="text-xs text-accent mt-1">-{((virtualGraph?.savedBytes || 0) / 1024).toFixed(1)} KB saved via skips</span>
                  </div>
                  <div className="bg-bg-base border border-border-subtle rounded-lg p-3 flex flex-col gap-1">
                    <span className="text-xs text-text-muted flex items-center gap-1"><FileJson size={12}/> Included Files</span>
                    <span className="text-xl font-semibold text-text-primary">{virtualGraph?.totalFiles || 0} Files</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border-subtle">
                  <h2 className="text-xs uppercase font-semibold text-text-muted mb-3 tracking-widest flex items-center gap-2">
                    <Gauge size={14} /> Diagnostic Profiler
                  </h2>
                  <button
                    onClick={runProfile}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-accent/20 hover:bg-accent text-accent hover:text-white rounded-lg text-xs font-semibold transition-all shadow-sm mb-3"
                  >
                    <Gauge size={13} /> Profile Active Workspace
                  </button>

                  {profileReport && (
                    <div className="bg-bg-base border border-border-subtle rounded-lg p-3 text-[11px] font-mono space-y-1 text-text-muted">
                      <div className="flex justify-between text-text-primary font-semibold border-b border-border-subtle pb-1 mb-1">
                        <span>Live Profile Result</span>
                        <button onClick={copyProfileReport} className="text-accent hover:underline text-[10px] flex items-center gap-1">
                          {copiedProfile ? <Check size={10} /> : <Copy size={10} />}
                          {copiedProfile ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Files Checked:</span>
                        <span className="text-text-primary">{profileReport.totalFilesCount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rule Index Build:</span>
                        <span className="text-green-400">{profileReport.timings.indexBuildMs} ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tree Traversal:</span>
                        <span className="text-green-400">{profileReport.timings.traversalCheckMs} ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Virtual Graph Build:</span>
                        <span className="text-green-400">{profileReport.timings.virtualGraphMs} ms</span>
                      </div>
                    </div>
                  )}
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
                    Packages generated in <span className="text-accent">{activePreset?.name}</span>.
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

        {hoveredHistoryId && activePreset && activeTabState === 'HISTORY' && (
          <div className="w-72 h-full bg-bg-panel border-r border-border-subtle shadow-2xl flex flex-col animate-in fade-in slide-in-from-left-2 duration-200 pointer-events-none shrink-0">
            <div className="p-4 border-b border-border-subtle shrink-0 bg-bg-base">
              <h3 className="font-semibold text-text-primary text-xs uppercase tracking-widest">Package Contents</h3>
              <p className="text-[10px] text-text-muted mt-1">Click cursor icon to restore selection.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {(() => {
                const hoveredItem = activePreset.history.find(h => h.id === hoveredHistoryId);
                const files = hoveredItem?.files || [];
                if (files.length === 0) {
                  return <div className="text-[11px] text-text-muted italic opacity-50">File list unavailable.</div>;
                }
                return files.map(f => (
                  <div key={f} className="text-[11px] font-mono text-text-muted truncate" title={f}>
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