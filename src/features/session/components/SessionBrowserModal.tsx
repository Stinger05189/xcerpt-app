// src/features/session/components/SessionBrowserModal.tsx
import { useEffect, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { 
  X, 
  Clock, 
  Trash2, 
  Play, 
  Plus, 
  GitPullRequest, 
  FolderArchive,
  Layers,
  Sparkles
} from 'lucide-react';

export function SessionBrowserModal() {
  const { 
    isBrowserModalOpen, 
    setBrowserModalOpen, 
    setIngestionModalOpen,
    loadSession, 
    deleteSession,
    activeSession 
  } = useSessionStore();

  const workspaceId = useWorkspaceStore(s => s.workspaceId);
  const [sessions, setSessions] = useState<Array<{
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    summary: { architecturalIntent: string; totalFiles: number; actionsCount: Record<string, number> };
  }>>([]);
  const [loading, setLoading] = useState(true);

  const refreshSessions = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const list = await window.api.listDevSessions(workspaceId);
      setSessions(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isBrowserModalOpen) {
      refreshSessions();
    }
  }, [isBrowserModalOpen, workspaceId]);

  if (!isBrowserModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-bg-base/80 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-200">
      <div className="bg-bg-panel border border-border-subtle rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh]">
        <div className="p-5 border-b border-border-subtle flex items-center justify-between bg-bg-base">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-accent/10 text-accent rounded-lg">
              <FolderArchive size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Dev Session Archive</h2>
              <p className="text-xs text-text-muted">Manage ongoing and past LLM response integration sessions for this workspace.</p>
            </div>
          </div>
          <button 
            onClick={() => setBrowserModalOpen(false)}
            className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-bg-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 border-b border-border-subtle bg-bg-panel/50 flex items-center justify-between">
          <span className="text-xs font-medium text-text-muted">
            {sessions.length} Saved Session{sessions.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => {
              setBrowserModalOpen(false);
              setIngestionModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <Plus size={13} /> Start New Session
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading ? (
            <div className="py-12 text-center text-xs text-text-muted animate-pulse">
              Scanning session catalog...
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-16 text-center text-xs text-text-muted flex flex-col items-center gap-2">
              <GitPullRequest size={32} className="opacity-30" />
              <span>No dev sessions recorded yet for this workspace.</span>
            </div>
          ) : (
            sessions.map(s => {
              const isCurrent = activeSession && activeSession.id === s.id;
              const dateStr = new Date(s.updatedAt || s.createdAt).toLocaleString();

              return (
                <div
                  key={s.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                    isCurrent
                      ? 'bg-accent/10 border-accent/40 shadow-sm'
                      : 'bg-bg-base/60 border-border-subtle/70 hover:bg-bg-hover'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-xs text-text-primary truncate">{s.name}</span>
                      {isCurrent && (
                        <span className="text-[9px] bg-accent/20 text-accent border border-accent/30 px-1.5 py-0.2 rounded font-mono">
                          Active
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-text-muted bg-bg-panel px-1.5 py-0.2 rounded">
                        {s.summary?.totalFiles || 0} Files
                      </span>
                    </div>

                    <p className="text-[11px] text-text-muted truncate mb-1.5" title={s.summary?.architecturalIntent}>
                      {s.summary?.architecturalIntent || 'LLM Work Packet Integration'}
                    </p>

                    <div className="flex items-center gap-3 text-[10px] text-text-muted font-mono">
                      <span className="flex items-center gap-1"><Clock size={11} /> {dateStr}</span>
                      <span className="flex items-center gap-1"><Layers size={11} /> ID: {s.id.slice(0, 16)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={async () => {
                        await loadSession(workspaceId!, s.id);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-accent/20 hover:bg-accent text-accent hover:text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                      title={isCurrent ? "Resume Session" : "Load Session"}
                    >
                      {isCurrent ? <Sparkles size={12} /> : <Play size={12} />}
                      {isCurrent ? 'Resume' : 'Open'}
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Delete dev session "${s.name}"?`)) {
                          await deleteSession(workspaceId!, s.id);
                          refreshSessions();
                        }
                      }}
                      className="p-1.5 text-text-muted hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Delete Session"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}