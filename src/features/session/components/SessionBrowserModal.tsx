// src/features/session/components/SessionBrowserModal.tsx
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useWorkspaceStore } from '../../../store/workspaceStore';
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
  Square
} from 'lucide-react';
import type { DevSessionStatus } from '../types/session';

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
    activeSession 
  } = useSessionStore();

  const workspaceId = useWorkspaceStore(s => s.workspaceId);
  const workspaceName = useWorkspaceStore(s => s.workspaceName);

  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());

  const refreshSessions = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const list = await window.api.listDevSessions(workspaceId);
      setSessions(list as SessionListItem[]);
      if (list && list.length > 0 && !selectedSessionId) {
        setSelectedSessionId(list[0].id);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, selectedSessionId]);

  useEffect(() => {
    if (isBrowserModalOpen) {
      refreshSessions();
    }
  }, [isBrowserModalOpen, refreshSessions]);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (statusFilter === 'IN_PROGRESS' && s.status === 'COMPLETED') return false;
      if (statusFilter === 'COMPLETED' && s.status !== 'COMPLETED') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesDesc = (s.description || s.summary?.architecturalIntent || '').toLowerCase().includes(q);
        const matchesFiles = (s.summary?.filePaths || []).some(f => f.toLowerCase().includes(q));
        return matchesName || matchesDesc || matchesFiles;
      }
      return true;
    });
  }, [sessions, statusFilter, searchQuery]);

  const inspectedSession = useMemo(() => {
    return sessions.find(s => s.id === selectedSessionId) || filteredSessions[0] || null;
  }, [sessions, selectedSessionId, filteredSessions]);

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
      await refreshSessions();
    }
  };

  if (!isBrowserModalOpen) return null;

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-base select-text overflow-hidden animate-in fade-in duration-150">
      {/* Top Header */}
      <header className="h-12 bg-bg-panel border-b border-border-subtle px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-accent/20 text-accent rounded-md">
            <FolderArchive size={16} />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-text-primary flex items-center gap-2">
              Dev Session Management Suite
              <span className="text-[10px] font-mono font-normal text-text-muted">
                (Archive for {workspaceName || 'Workspace'})
              </span>
            </h2>
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
            title="Close Suite (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Main Suite Viewport: Master Table + Detail Inspector */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left/Center Master Table View */}
        <main className="flex-1 flex flex-col border-r border-border-subtle bg-bg-base overflow-hidden">
          {/* Controls Bar: Search & Status Filters */}
          <div className="h-11 px-4 border-b border-border-subtle bg-bg-panel/50 flex items-center justify-between shrink-0 gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search session title, description, or edited files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-bg-base border border-border-subtle rounded-md pl-8 pr-3 py-1 text-xs text-text-primary outline-none focus:border-accent"
                />
              </div>

              <div className="flex bg-bg-base border border-border-subtle rounded-md p-0.5 text-xs font-medium">
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
                  In Progress
                </button>
                <button
                  onClick={() => setStatusFilter('COMPLETED')}
                  className={`px-2 py-0.5 rounded transition-colors ${statusFilter === 'COMPLETED' ? 'bg-accent/20 text-accent font-semibold' : 'text-text-muted hover:text-text-primary'}`}
                >
                  Completed
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
            <div className="col-span-2">Actions Breakdown</div>
            <div className="col-span-2 text-right">Last Modified</div>
          </div>

          {/* Table Rows Container */}
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
                const isSelected = inspectedSession?.id === session.id;
                const isChecked = selectedSessionIds.has(session.id);
                const isCurrentActive = activeSession?.id === session.id;
                const isComplete = session.status === 'COMPLETED';

                const newCount = session.summary?.actionsCount?.NEW || 0;
                const modCount = session.summary?.actionsCount?.MODIFIED || 0;
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

                    {/* Actions Breakdown */}
                    <div className="col-span-2 font-mono text-[11px] text-text-muted">
                      {newCount > 0 && <span className="text-green-400 mr-1.5">+{newCount}</span>}
                      {modCount > 0 && <span className="text-orange-400 mr-1.5">~{modCount}</span>}
                      {delCount > 0 && <span className="text-red-400">-{delCount}</span>}
                      {newCount === 0 && modCount === 0 && delCount === 0 && <span>{session.summary?.totalFiles || 0} Files</span>}
                    </div>

                    {/* Date */}
                    <div className="col-span-2 text-right font-mono text-[11px] text-text-muted">
                      {new Date(session.updatedAt || session.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>

        {/* Right Detail Inspection Pane */}
        {inspectedSession && (
          <aside className="w-96 bg-bg-panel flex flex-col shrink-0 select-none overflow-hidden animate-in slide-in-from-right-2 duration-150">
            <div className="p-4 border-b border-border-subtle bg-bg-base/70 flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Session Inspector
              </span>
              <span className="text-[10px] font-mono text-text-muted">
                ID: {inspectedSession.id.slice(0, 16)}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">
                  {inspectedSession.name}
                </h3>
                <div className="flex items-center gap-2 text-[10px] font-mono text-text-muted mt-1">
                  <span className="flex items-center gap-1"><Calendar size={11} /> {new Date(inspectedSession.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Description / Intent Box */}
              <div className="p-3 bg-bg-base rounded-xl border border-border-subtle">
                <div className="text-[10px] uppercase font-bold text-text-muted tracking-wider mb-1.5">
                  Architectural Intent
                </div>
                <p className="text-xs text-text-primary leading-relaxed">
                  {inspectedSession.description || inspectedSession.summary?.architecturalIntent || 'LLM Work Packet Integration'}
                </p>
              </div>

              {/* Target Files Manifest */}
              <div>
                <div className="text-[10px] uppercase font-bold text-text-muted tracking-wider mb-2 flex items-center justify-between">
                  <span>Target Files ({inspectedSession.summary?.totalFiles || 0})</span>
                  <span className="text-accent font-mono text-[10px]">
                    {inspectedSession.summary?.filePaths?.length || 0} files
                  </span>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {(inspectedSession.summary?.filePaths || []).map((path, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-bg-base border border-border-subtle font-mono text-xs text-text-muted flex items-center gap-2 truncate">
                      <FileText size={12} className="text-accent shrink-0" />
                      <span className="truncate text-text-primary" title={path}>{path}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="p-4 border-t border-border-subtle bg-bg-base/90 flex items-center justify-between gap-2 shrink-0">
              <button
                onClick={async () => {
                  if (confirm(`Delete session "${inspectedSession.name}"?`)) {
                    await deleteSession(workspaceId!, inspectedSession.id);
                    await refreshSessions();
                  }
                }}
                className="p-2 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Delete this session"
              >
                <Trash2 size={15} />
              </button>

              <button
                onClick={() => loadSession(workspaceId!, inspectedSession.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-semibold shadow-md transition-all"
              >
                {activeSession?.id === inspectedSession.id ? <Sparkles size={13} /> : <Play size={13} />}
                <span>{activeSession?.id === inspectedSession.id ? 'Resume Active Session' : 'Open in Dev Studio'}</span>
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}