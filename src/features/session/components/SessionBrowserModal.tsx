// src/features/session/components/SessionBrowserModal.tsx
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { FileHistoryDiffStage } from './diff/FileHistoryDiffStage';
import { 
  X, 
  Trash2, 
  Play, 
  Plus, 
  FolderArchive,
  Sparkles,
  Search,
  FileText,
  Calendar,
  CheckSquare,
  Square,
  Edit3,
  GitPullRequest,
  Layers,
  History,
  FileCode2,
  HardDrive,
  Eye,
  Sliders,
  Check
} from 'lucide-react';
import type { DevSessionStatus, DevSession, DevSessionFileLedgerItem } from '../types/session';

interface SessionListItem {
  id: string;
  name: string;
  description?: string;
  status?: DevSessionStatus;
  createdAt: string;
  updatedAt: string;
  summary: { 
    architecturalIntent: string; 
    totalFiles: number; 
    actionsCount: Record<string, number>;
    filePaths?: string[];
  };
}

export function SessionBrowserModal() {
  const { 
    isBrowserModalOpen, 
    setBrowserModalOpen, 
    setIngestionModalOpen, 
    loadSession, 
    deleteSession, 
    batchDeleteSessions, 
    activeSession,
    browserViewMode,
    setBrowserViewMode,
    selectedLedgerPath,
    setSelectedLedgerPath,
    selectedLedgerSessionId,
    setSelectedLedgerSessionId,
    inspectorWidth,
    setInspectorWidth
  } = useSessionStore();

  const workspaceId = useWorkspaceStore(s => s.workspaceId);
  const workspaceName = useWorkspaceStore(s => s.workspaceName);
  const rootPaths = useWorkspaceStore(s => s.rootPaths);

  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [fullSessions, setFullSessions] = useState<DevSession[]>([]);
  const [fileLedger, setFileLedger] = useState<DevSessionFileLedgerItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInCodeContent, setSearchInCodeContent] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());

  // Inspector internal filtering
  const [inspectorSearchQuery, setInspectorSearchQuery] = useState('');
  const [inspectorActionFilter, setInspectorActionFilter] = useState<string>('ALL');

  // File Ledger Sorting
  const [ledgerSortBy, setLedgerSortBy] = useState<'revisions' | 'path' | 'recent'>('revisions');

  // Full Session Detail for the currently inspected session
  const [inspectedFullSession, setInspectedFullSession] = useState<DevSession | null>(null);

  // Quick Preview modal inside inspector
  const [previewActionContent, setPreviewActionContent] = useState<{ path: string; content: string } | null>(null);

  const resizerRef = useRef<HTMLDivElement>(null);

  const refreshCatalog = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [list, fullList, ledger] = await Promise.all([
        window.api.listDevSessions(workspaceId),
        window.api.getAllDevSessions(workspaceId),
        window.api.getDevSessionFileLedger(workspaceId)
      ]);

      setSessions(list as SessionListItem[]);
      setFullSessions(fullList);
      setFileLedger(ledger);

      if (list && list.length > 0 && !selectedSessionId) {
        setSelectedSessionId(list[0].id);
      }
      if (ledger && ledger.length > 0 && !selectedLedgerPath) {
        setSelectedLedgerPath(ledger[0].targetRelativePath);
      }
    } catch (err: unknown) {
      console.error('Failed to load session catalog:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, selectedSessionId, selectedLedgerPath, setSelectedLedgerPath]);

  useEffect(() => {
    if (isBrowserModalOpen) {
      refreshCatalog();
    }
  }, [isBrowserModalOpen, refreshCatalog]);

  // Load detailed session data whenever selectedSessionId changes
  useEffect(() => {
    if (!selectedSessionId || !workspaceId) return;
    const existing = fullSessions.find(s => s.id === selectedSessionId);
    if (existing) {
      setInspectedFullSession(existing);
    } else {
      window.api.loadDevSession(workspaceId, selectedSessionId).then(res => {
        setInspectedFullSession(res);
      });
    }
  }, [selectedSessionId, workspaceId, fullSessions]);

  // Filtered Sessions List
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (statusFilter === 'IN_PROGRESS' && s.status === 'COMPLETED') return false;
      if (statusFilter === 'COMPLETED' && s.status !== 'COMPLETED') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesDesc = (s.description || s.summary?.architecturalIntent || '').toLowerCase().includes(q);
        const matchesFiles = (s.summary?.filePaths || []).some(f => f.toLowerCase().includes(q));

        if (matchesName || matchesDesc || matchesFiles) return true;

        // Deep Content Search: Search through raw action code content
        if (searchInCodeContent) {
          const full = fullSessions.find(fs => fs.id === s.id);
          if (full && full.actions) {
            return full.actions.some(a => 
              (a.workingContent && a.workingContent.toLowerCase().includes(q)) ||
              (a.proposedContent && a.proposedContent.toLowerCase().includes(q)) ||
              (a.rawPayloadContent && a.rawPayloadContent.toLowerCase().includes(q))
            );
          }
        }
        return false;
      }
      return true;
    });
  }, [sessions, fullSessions, statusFilter, searchQuery, searchInCodeContent]);

  // Filtered File Ledger List
  const filteredFileLedger = useMemo(() => {
    let list = [...fileLedger];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item => 
        item.targetRelativePath.toLowerCase().includes(q) ||
        item.sessions.some(s => s.sessionName.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => {
      if (ledgerSortBy === 'revisions') return b.revisionCount - a.revisionCount;
      if (ledgerSortBy === 'path') return a.targetRelativePath.localeCompare(b.targetRelativePath);
      return new Date(b.latestUpdatedAt).getTime() - new Date(a.latestUpdatedAt).getTime();
    });
  }, [fileLedger, searchQuery, ledgerSortBy]);

  const activeLedgerItem = useMemo(() => {
    if (!selectedLedgerPath) return filteredFileLedger[0] || null;
    return fileLedger.find(f => f.targetRelativePath === selectedLedgerPath) || filteredFileLedger[0] || null;
  }, [fileLedger, filteredFileLedger, selectedLedgerPath]);

  // Filtered Actions inside the Inspector Pane
  const inspectedActions = useMemo(() => {
    if (!inspectedFullSession) return [];
    return inspectedFullSession.actions.filter(a => {
      if (inspectorActionFilter !== 'ALL' && a.actionType !== inspectorActionFilter) {
        return false;
      }
      if (inspectorSearchQuery.trim()) {
        const q = inspectorSearchQuery.toLowerCase();
        const matchesPath = a.targetRelativePath.toLowerCase().includes(q);
        const matchesCode = (a.workingContent || a.proposedContent || '').toLowerCase().includes(q);
        return matchesPath || matchesCode;
      }
      return true;
    });
  }, [inspectedFullSession, inspectorActionFilter, inspectorSearchQuery]);

  // Resizable Inspector Drag Handler
  const handleInspectorPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = inspectorWidth;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const delta = startX - moveEvent.clientX;
      setInspectorWidth(startWidth + delta);
    };

    const onPointerUp = () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.body.style.cursor = '';
    };

    document.body.style.cursor = 'col-resize';
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  };

  const handleToggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedSessionIds.size === filteredSessions.length) {
      setSelectedSessionIds(new Set());
    } else {
      setSelectedSessionIds(new Set(filteredSessions.map(s => s.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (!workspaceId || selectedSessionIds.size === 0) return;
    if (confirm(`Delete ${selectedSessionIds.size} selected session(s)?`)) {
      await batchDeleteSessions(workspaceId, Array.from(selectedSessionIds));
      setSelectedSessionIds(new Set());
      await refreshCatalog();
    }
  };

  const handleApplyLedgerRevisionToDisk = async (content: string, actionType: 'NEW' | 'MODIFIED' | 'DELETED') => {
    if (!activeLedgerItem) return;
    const targetRoot = activeLedgerItem.targetRootPath || rootPaths[0];
    const absPath = `${targetRoot}/${activeLedgerItem.targetRelativePath}`.replace(/\\/g, '/');
    await window.api.applyFileAction(absPath, content, actionType);
    await refreshCatalog();
  };

  if (!isBrowserModalOpen) return null;

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-base select-text overflow-hidden animate-in fade-in duration-150">
      {/* Top Header Bar with Dual-Mode Navigation */}
      <header className="h-12 bg-bg-panel border-b border-border-subtle px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-accent/20 text-accent rounded-md">
            <FolderArchive size={16} />
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-semibold text-text-primary flex items-center gap-2">
              Dev Session Management & File History
              <span className="text-[10px] font-mono font-normal text-text-muted">
                ({workspaceName || 'Workspace'})
              </span>
            </h2>

            {/* Mode Switcher: Sessions View vs File Ledger View */}
            <div className="flex bg-bg-base border border-border-subtle rounded-lg p-0.5 text-xs font-medium">
              <button
                onClick={() => setBrowserViewMode('sessions')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                  browserViewMode === 'sessions'
                    ? 'bg-accent/20 text-accent font-semibold shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Layers size={13} />
                <span>Sessions View ({sessions.length})</span>
              </button>
              <button
                onClick={() => setBrowserViewMode('files')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                  browserViewMode === 'files'
                    ? 'bg-accent/20 text-accent font-semibold shadow-sm'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <FileCode2 size={13} />
                <span>File Ledger View ({fileLedger.length})</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setBrowserModalOpen(false);
              setIngestionModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-accent hover:bg-accent/90 text-white rounded-md text-xs font-semibold shadow-sm transition-all"
          >
            <Plus size={13} />
            <span>New Dev Session</span>
          </button>

          <div className="w-px h-4 bg-border-subtle mx-1" />

          <button
            onClick={() => setBrowserModalOpen(false)}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-bg-hover transition-colors"
            title="Close Catalog (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Main Mode Viewport */}
      {browserViewMode === 'sessions' ? (
        /* ================= MODE 1: SESSIONS VIEW ================= */
        <div className="flex-1 flex overflow-hidden">
          {/* Main Sessions Table */}
          <main className="flex-1 flex flex-col border-r border-border-subtle bg-bg-base overflow-hidden">
            {/* Search Controls Bar */}
            <div className="h-11 px-4 border-b border-border-subtle bg-bg-panel/50 flex items-center justify-between shrink-0 gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-xl">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Search session title, description, or target files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-bg-base border border-border-subtle rounded-md pl-8 pr-3 py-1 text-xs text-text-primary outline-none focus:border-accent"
                  />
                </div>

                {/* Deep Content Search Toggle */}
                <button
                  type="button"
                  onClick={() => setSearchInCodeContent(!searchInCodeContent)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors shrink-0 ${
                    searchInCodeContent 
                      ? 'bg-accent/20 text-accent border-accent/40 font-semibold' 
                      : 'bg-bg-base text-text-muted border-border-subtle hover:text-text-primary'
                  }`}
                  title="Search inside file action code contents across all sessions"
                >
                  <FileText size={12} />
                  <span>Search Code</span>
                </button>

                {/* Status Filter */}
                <div className="flex bg-bg-base border border-border-subtle rounded-md p-0.5 text-xs font-medium shrink-0">
                  <button
                    onClick={() => setStatusFilter('ALL')}
                    className={`px-2 py-0.5 rounded transition-colors ${statusFilter === 'ALL' ? 'bg-accent/20 text-accent font-semibold' : 'text-text-muted hover:text-text-primary'}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setStatusFilter('IN_PROGRESS')}
                    className={`px-2 py-0.5 rounded transition-colors ${statusFilter === 'IN_PROGRESS' ? 'bg-accent/20 text-accent font-semibold' : 'text-text-muted hover:text-text-primary'}`}
                  >
                    Open
                  </button>
                  <button
                    onClick={() => setStatusFilter('COMPLETED')}
                    className={`px-2 py-0.5 rounded transition-colors ${statusFilter === 'COMPLETED' ? 'bg-accent/20 text-accent font-semibold' : 'text-text-muted hover:text-text-primary'}`}
                  >
                    Done
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedSessionIds.size > 0 && (
                  <button
                    onClick={handleBatchDelete}
                    className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs font-medium transition-colors"
                  >
                    <Trash2 size={12} />
                    <span>Delete Selected ({selectedSessionIds.size})</span>
                  </button>
                )}
                <span className="text-[11px] font-mono text-text-muted">
                  {filteredSessions.length} Session{filteredSessions.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 px-4 py-2 border-b border-border-subtle bg-bg-panel text-[10px] uppercase font-bold text-text-muted tracking-wider select-none shrink-0">
              <div className="col-span-1 flex items-center gap-2">
                <button onClick={handleToggleSelectAll} className="hover:text-text-primary">
                  {selectedSessionIds.size === filteredSessions.length && filteredSessions.length > 0 ? (
                    <CheckSquare size={13} className="text-accent" />
                  ) : (
                    <Square size={13} />
                  )}
                </button>
                <span>Status</span>
              </div>
              <div className="col-span-4 pl-2">Session Title & Intent</div>
              <div className="col-span-3">Target Files</div>
              <div className="col-span-2">Action Breakdown</div>
              <div className="col-span-2 text-right">Modified</div>
            </div>

            {/* Table Rows */}
            <div className="flex-1 overflow-y-auto divide-y divide-border-subtle/50">
              {loading ? (
                <div className="py-20 text-center text-xs text-text-muted animate-pulse">
                  Scanning workspace session catalog...
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="py-24 text-center text-xs text-text-muted flex flex-col items-center gap-2">
                  <FolderArchive size={32} className="opacity-30" />
                  <span>{searchQuery ? 'No sessions matched your search query.' : 'No sessions recorded for this workspace yet.'}</span>
                </div>
              ) : (
                filteredSessions.map((session) => {
                  const isSelected = selectedSessionId === session.id;
                  const isChecked = selectedSessionIds.has(session.id);
                  const isCurrentActive = activeSession?.id === session.id;
                  const isComplete = session.status === 'COMPLETED';

                  const newCount = session.summary?.actionsCount?.NEW || 0;
                  const modCount = session.summary?.actionsCount?.MODIFIED || 0;
                  const diffCount = session.summary?.actionsCount?.PARTIAL_DIFF || 0;
                  const delCount = session.summary?.actionsCount?.DELETED || 0;
                  const filePaths = session.summary?.filePaths || [];

                  return (
                    <div
                      key={session.id}
                      onClick={() => setSelectedSessionId(session.id)}
                      onDoubleClick={() => loadSession(workspaceId!, session.id)}
                      className={`grid grid-cols-12 px-4 py-3 items-center cursor-pointer transition-colors text-xs select-none ${
                        isSelected 
                          ? 'bg-accent/15 hover:bg-accent/20' 
                          : 'hover:bg-bg-hover/80 bg-bg-base/40'
                      }`}
                    >
                      {/* Checkbox & Status */}
                      <div className="col-span-1 flex items-center gap-2">
                        <button onClick={(e) => handleToggleSelectRow(session.id, e)} className="text-text-muted hover:text-text-primary">
                          {isChecked ? <CheckSquare size={13} className="text-accent" /> : <Square size={13} />}
                        </button>
                        {isCurrentActive ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-accent/20 text-accent border border-accent/40">
                            Active
                          </span>
                        ) : isComplete ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-green-500/20 text-green-400 border border-green-500/40">
                            Done
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-bg-panel text-text-muted border border-border-subtle">
                            Open
                          </span>
                        )}
                      </div>

                      {/* Title & Description */}
                      <div className="col-span-4 pl-2 pr-3 min-w-0">
                        <div className="font-semibold text-text-primary truncate text-xs" title={session.name}>
                          {session.name}
                        </div>
                        <div className="text-[11px] text-text-muted truncate mt-0.5" title={session.description || session.summary?.architecturalIntent}>
                          {session.description || session.summary?.architecturalIntent || 'LLM Work Packet Integration'}
                        </div>
                      </div>

                      {/* File Pills */}
                      <div className="col-span-3 flex items-center gap-1 overflow-hidden pr-2">
                        {filePaths.slice(0, 2).map((path, idx) => (
                          <span key={idx} className="font-mono text-[10px] bg-bg-panel border border-border-subtle px-1.5 py-0.5 rounded text-text-muted truncate max-w-28" title={path}>
                            {path.split('/').pop()}
                          </span>
                        ))}
                        {filePaths.length > 2 && (
                          <span className="text-[10px] font-mono text-text-muted/70 shrink-0">
                            +{filePaths.length - 2} more
                          </span>
                        )}
                      </div>

                      {/* Action Breakdown Badges */}
                      <div className="col-span-2 flex items-center gap-1 font-mono text-[10px]">
                        {newCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-green-500/15 text-green-400 border border-green-500/30 flex items-center gap-0.5">
                            <Plus size={9} /> {newCount}
                          </span>
                        )}
                        {modCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center gap-0.5">
                            <Edit3 size={9} /> {modCount}
                          </span>
                        )}
                        {diffCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center gap-0.5">
                            <GitPullRequest size={9} /> {diffCount}
                          </span>
                        )}
                        {delCount > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-0.5">
                            <Trash2 size={9} /> {delCount}
                          </span>
                        )}
                        {newCount === 0 && modCount === 0 && diffCount === 0 && delCount === 0 && (
                          <span className="text-text-muted">{session.summary?.totalFiles || 0} Files</span>
                        )}
                      </div>

                      {/* Modified Date */}
                      <div className="col-span-2 text-right font-mono text-[11px] text-text-muted">
                        {new Date(session.updatedAt || session.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </main>

          {/* Resizable Right Inspector Pane */}
          {selectedSessionId && (
            <aside 
              className="bg-bg-panel flex flex-col shrink-0 select-none overflow-hidden relative"
              style={{ width: inspectorWidth }}
            >
              {/* Drag Resize Handle on Left Border */}
              <div
                ref={resizerRef}
                onPointerDown={handleInspectorPointerDown}
                className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-20 group flex items-center justify-center hover:bg-accent/10"
              >
                <div className="w-0.5 h-full bg-border-subtle group-hover:bg-accent transition-colors" />
              </div>

              {/* Inspector Header */}
              <div className="p-3.5 border-b border-border-subtle bg-bg-base/70 flex items-center justify-between shrink-0 pl-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Session Inspector
                </span>
                <span className="text-[10px] font-mono text-text-muted">
                  ID: {selectedSessionId.slice(0, 14)}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 pl-4">
                {/* Session Title & Metadata */}
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-1">
                    {inspectedFullSession?.name || 'Selected Session'}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-text-muted mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} /> {inspectedFullSession ? new Date(inspectedFullSession.createdAt).toLocaleString() : ''}
                    </span>
                  </div>
                </div>

                {/* Architectural Intent */}
                <div className="p-3 bg-bg-base rounded-xl border border-border-subtle">
                  <div className="text-[10px] uppercase font-bold text-text-muted tracking-wider mb-1.5">
                    Architectural Intent
                  </div>
                  <p className="text-xs text-text-primary leading-relaxed">
                    {inspectedFullSession?.description || inspectedFullSession?.summary?.architecturalIntent || 'LLM Work Packet Integration'}
                  </p>
                </div>

                {/* Search & Filter File Actions within Inspector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">
                      Target Files ({inspectedActions.length}/{inspectedFullSession?.actions.length || 0})
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                      <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        type="text"
                        placeholder="Filter session files..."
                        value={inspectorSearchQuery}
                        onChange={(e) => setInspectorSearchQuery(e.target.value)}
                        className="w-full bg-bg-base border border-border-subtle rounded-md pl-7 pr-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
                      />
                    </div>

                    <select
                      value={inspectorActionFilter}
                      onChange={(e) => setInspectorActionFilter(e.target.value)}
                      className="bg-bg-base border border-border-subtle rounded-md px-2 py-1 text-[11px] font-mono text-text-muted outline-none focus:border-accent shrink-0"
                    >
                      <option value="ALL">All Actions</option>
                      <option value="NEW">NEW</option>
                      <option value="MODIFIED">MOD</option>
                      <option value="PARTIAL_DIFF">DIFF</option>
                      <option value="DELETED">DEL</option>
                    </select>
                  </div>

                  {/* Unclipped File Action Cards */}
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {inspectedActions.map((action) => {
                      const fileName = action.targetRelativePath.split('/').pop() || action.targetRelativePath;
                      const lineCount = (action.workingContent || action.proposedContent || '').split('\n').length;

                      return (
                        <div
                          key={action.id}
                          className="p-2.5 rounded-lg bg-bg-base border border-border-subtle flex flex-col gap-1.5 group hover:border-accent/30 transition-all text-xs"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {action.actionType === 'NEW' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-green-500/20 text-green-400 border border-green-500/30 shrink-0 flex items-center gap-0.5">
                                  <Plus size={8} /> NEW
                                </span>
                              )}
                              {action.actionType === 'MODIFIED' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 shrink-0 flex items-center gap-0.5">
                                  <Edit3 size={8} /> MOD
                                </span>
                              )}
                              {action.actionType === 'PARTIAL_DIFF' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0 flex items-center gap-0.5">
                                  <GitPullRequest size={8} /> DIFF
                                </span>
                              )}
                              {action.actionType === 'DELETED' && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 border border-red-500/30 shrink-0 flex items-center gap-0.5">
                                  <Trash2 size={8} /> DEL
                                </span>
                              )}
                              <span className="font-medium text-text-primary truncate" title={action.targetRelativePath}>
                                {fileName}
                              </span>
                            </div>

                            <button
                              onClick={() => setPreviewActionContent({
                                path: action.targetRelativePath,
                                content: action.workingContent || action.proposedContent || ''
                              })}
                              className="p-1 text-text-muted hover:text-accent hover:bg-bg-hover rounded transition-colors shrink-0"
                              title="Quick View Code Preview"
                            >
                              <Eye size={12} />
                            </button>
                          </div>

                          <div className="text-[10px] font-mono text-text-muted break-all pl-0.5">
                            {action.targetRelativePath}
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-mono text-text-muted pt-0.5">
                            <span>{lineCount} lines</span>
                            {action.hasSkipBlocks && (
                              <span className="text-amber-400 bg-amber-400/10 px-1 rounded">
                                {action.skipBlockCount} Skips
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Inspector Footer Actions */}
              <div className="p-4 border-t border-border-subtle bg-bg-base/90 flex items-center justify-between gap-2 shrink-0 pl-4">
                <button
                  onClick={async () => {
                    if (confirm(`Delete session "${inspectedFullSession?.name}"?`)) {
                      await deleteSession(workspaceId!, selectedSessionId);
                      await refreshCatalog();
                    }
                  }}
                  className="p-2 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Delete this session"
                >
                  <Trash2 size={15} />
                </button>

                <button
                  onClick={() => loadSession(workspaceId!, selectedSessionId)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-semibold shadow-md transition-all"
                >
                  {activeSession?.id === selectedSessionId ? <Sparkles size={13} /> : <Play size={13} />}
                  <span>{activeSession?.id === selectedSessionId ? 'Resume Active Session' : 'Open in Dev Studio'}</span>
                </button>
              </div>
            </aside>
          )}
        </div>
      ) : (
        /* ================= MODE 2: FILE LEDGER VIEW ================= */
        <div className="flex-1 flex overflow-hidden">
          {/* Left Pane: Historical Files Ledger */}
          <aside className="w-80 bg-bg-panel border-r border-border-subtle flex flex-col shrink-0 select-none overflow-hidden">
            {/* Search and Sort Filter */}
            <div className="p-3 border-b border-border-subtle bg-bg-base/70 space-y-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Filter modified files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-bg-base border border-border-subtle rounded-md pl-8 pr-3 py-1 text-xs text-text-primary outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-text-muted font-medium">Sort By:</span>
                <div className="flex bg-bg-base border border-border-subtle rounded-md p-0.5 text-[10px] font-mono">
                  <button
                    onClick={() => setLedgerSortBy('revisions')}
                    className={`px-2 py-0.5 rounded transition-colors ${ledgerSortBy === 'revisions' ? 'bg-accent/20 text-accent font-bold' : 'text-text-muted hover:text-text-primary'}`}
                  >
                    Revisions
                  </button>
                  <button
                    onClick={() => setLedgerSortBy('path')}
                    className={`px-2 py-0.5 rounded transition-colors ${ledgerSortBy === 'path' ? 'bg-accent/20 text-accent font-bold' : 'text-text-muted hover:text-text-primary'}`}
                  >
                    Path
                  </button>
                  <button
                    onClick={() => setLedgerSortBy('recent')}
                    className={`px-2 py-0.5 rounded transition-colors ${ledgerSortBy === 'recent' ? 'bg-accent/20 text-accent font-bold' : 'text-text-muted hover:text-text-primary'}`}
                  >
                    Recent
                  </button>
                </div>
              </div>
            </div>

            {/* File Ledger Item List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredFileLedger.length === 0 ? (
                <div className="py-16 text-center text-xs text-text-muted flex flex-col items-center gap-2">
                  <FileCode2 size={28} className="opacity-30" />
                  <span>No session files found.</span>
                </div>
              ) : (
                filteredFileLedger.map((item) => {
                  const isSelected = activeLedgerItem?.targetRelativePath === item.targetRelativePath;
                  const fileName = item.targetRelativePath.split('/').pop() || item.targetRelativePath;
                  const dirPath = item.targetRelativePath.substring(0, item.targetRelativePath.length - fileName.length);

                  return (
                    <div
                      key={item.targetRelativePath}
                      onClick={() => {
                        setSelectedLedgerPath(item.targetRelativePath);
                        setSelectedLedgerSessionId(null);
                      }}
                      className={`p-2.5 rounded-lg cursor-pointer transition-all border text-xs flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-accent/15 border-accent/40 text-text-primary shadow-sm'
                          : 'bg-bg-base/40 border-border-subtle/50 hover:bg-bg-hover text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 truncate">
                          {item.latestActionType === 'NEW' && <span className="text-[9px] font-bold text-green-400">[NEW]</span>}
                          {item.latestActionType === 'MODIFIED' && <span className="text-[9px] font-bold text-orange-400">[MOD]</span>}
                          {item.latestActionType === 'PARTIAL_DIFF' && <span className="text-[9px] font-bold text-purple-400">[DIFF]</span>}
                          {item.latestActionType === 'DELETED' && <span className="text-[9px] font-bold text-red-400">[DEL]</span>}
                          <span className="font-semibold text-text-primary truncate" title={item.targetRelativePath}>
                            {fileName}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-accent/10 text-accent border border-accent/20 shrink-0">
                          {item.revisionCount} rev{item.revisionCount !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {dirPath && (
                        <div className="text-[10px] font-mono text-text-muted/70 truncate pl-0.5" title={dirPath}>
                          {dirPath}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* Right Center Stage: Multi-Session File Diff Stage */}
          <main className="flex-1 flex flex-col bg-bg-base overflow-hidden">
            {activeLedgerItem ? (
              <FileHistoryDiffStage
                key={activeLedgerItem.targetRelativePath}
                ledgerItem={activeLedgerItem}
                workspaceRoots={rootPaths}
                selectedSessionId={selectedLedgerSessionId}
                onSelectSession={setSelectedLedgerSessionId}
                onApplyRevisionToDisk={handleApplyLedgerRevisionToDisk}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-xs text-text-muted">
                <FileCode2 size={36} className="opacity-30 mb-2" />
                <span>Select a file from the ledger to inspect its dev session revision history.</span>
              </div>
            )}
          </main>
        </div>
      )}

      {/* Quick View Code Modal inside Inspector */}
      {previewActionContent && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-8">
          <div className="bg-bg-panel border border-border-subtle rounded-2xl w-full max-w-3xl h-[75vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="h-11 px-4 bg-bg-base border-b border-border-subtle flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-2 truncate">
                <FileCode2 size={15} className="text-accent" />
                <span className="font-mono text-xs font-semibold text-text-primary truncate">
                  {previewActionContent.path}
                </span>
              </div>
              <button
                onClick={() => setPreviewActionContent(null)}
                className="p-1.5 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover"
              >
                <X size={15} />
              </button>
            </div>
            <pre className="flex-1 p-4 m-0 overflow-auto font-mono text-xs text-text-primary bg-bg-panel select-text leading-relaxed">
              <code>{previewActionContent.content}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}