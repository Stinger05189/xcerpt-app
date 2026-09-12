// src/features/session/components/DevStudioModal.tsx
import { useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { ActionChecklist } from './ActionChecklist';
import { 
  X, 
  Sparkles, 
  Check, 
  RotateCcw, 
  ArrowRight, 
  FileText, 
  CheckCheck, 
  Code2, 
  AlertCircle 
} from 'lucide-react';

export function DevStudioModal() {
  const { 
    activeSession, 
    activeActionId, 
    isStudioOpen, 
    isIngestionModalOpen,
    isApplying,
    error,
    setIngestionModalOpen, 
    setStudioOpen, 
    setActiveActionId,
    initSessionFromMarkdown,
    applyCurrentAction,
    rejectCurrentAction,
    applyAllPendingActions,
    revertCurrentSession
  } = useSessionStore();

  const workspaceId = useWorkspaceStore(s => s.workspaceId);
  const rootPaths = useWorkspaceStore(s => s.rootPaths);

  const [rawText, setRawText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isIngestionModalOpen && !isStudioOpen) return null;

  const handleIngest = async () => {
    if (!rawText.trim() || !workspaceId) return;
    setIsSubmitting(true);
    try {
      await initSessionFromMarkdown(rawText, workspaceId, rootPaths);
      setRawText('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeAction = activeSession?.actions.find(a => a.id === activeActionId) || null;

  return (
    <div className="fixed inset-0 z-50 bg-bg-base/90 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
      {isIngestionModalOpen && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-bg-panel border border-border-subtle rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
            <div className="p-5 border-b border-border-subtle flex items-center justify-between bg-bg-base">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-accent/10 text-accent rounded-lg">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Inbound LLM Dev Session</h2>
                  <p className="text-xs text-text-muted">Paste your LLM Work Packet response to extract file diffs and review changes.</p>
                </div>
              </div>
              <button 
                onClick={() => setIngestionModalOpen(false)}
                className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-bg-hover transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 flex-1 flex flex-col gap-3 overflow-hidden">
              <textarea
                autoFocus
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste LLM Markdown response here (including ### Pre-Code Summary and code blocks)..."
                className="flex-1 w-full bg-bg-base border border-border-subtle rounded-xl p-4 text-xs font-mono text-text-primary outline-none focus:border-accent resize-none leading-relaxed"
                rows={16}
              />

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border-subtle bg-bg-base flex items-center justify-between">
              <span className="text-[11px] text-text-muted">
                Adheres to <strong className="text-text-primary">Skill_code_generation_protocol</strong> & standard Markdown code blocks.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIngestionModalOpen(false)}
                  className="px-4 py-2 text-xs text-text-muted hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleIngest}
                  disabled={!rawText.trim() || isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-semibold shadow-md transition-all disabled:opacity-40"
                >
                  <Sparkles size={14} />
                  {isSubmitting ? 'Parsing Packets...' : 'Initialize Dev Session'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isStudioOpen && activeSession && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <header className="h-14 bg-bg-panel border-b border-border-subtle px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-accent/20 text-accent rounded-md">
                <Code2 size={16} />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  {activeSession.name}
                  <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-accent/10 text-accent font-mono">
                    {activeSession.summary.totalFiles} Files
                  </span>
                </h1>
                <p className="text-[11px] text-text-muted truncate max-w-xl" title={activeSession.summary.architecturalIntent}>
                  {activeSession.summary.architecturalIntent}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => revertCurrentSession()}
                disabled={isApplying}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-hover hover:bg-red-500/10 text-text-muted hover:text-red-400 rounded-lg text-xs font-medium border border-border-subtle transition-all"
                title="Rollback all files to pre-session state"
              >
                <RotateCcw size={13} /> Revert Session
              </button>

              <button
                onClick={() => applyAllPendingActions()}
                disabled={isApplying}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-xs font-medium transition-all"
              >
                <CheckCheck size={14} /> Merge All
              </button>

              <div className="w-px h-5 bg-border-subtle mx-1" />

              <button
                onClick={() => setStudioOpen(false)}
                className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-bg-hover transition-colors"
                title="Close Studio"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden">
            <ActionChecklist
              actions={activeSession.actions}
              activeActionId={activeActionId}
              onSelectAction={setActiveActionId}
            />

            <main className="flex-1 flex flex-col bg-bg-base overflow-hidden">
              {activeAction ? (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  <div className="h-10 px-4 bg-bg-panel border-b border-border-subtle flex items-center justify-between shrink-0 text-xs">
                    <span className="font-mono text-text-primary flex items-center gap-2">
                      <FileText size={14} className="text-accent" />
                      {activeAction.targetRelativePath}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={rejectCurrentAction}
                        className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-xs font-medium transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        onClick={applyCurrentAction}
                        disabled={isApplying}
                        className="flex items-center gap-1.5 px-4 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-semibold shadow-sm transition-all"
                      >
                        <Check size={13} />
                        {activeAction.actionType === 'NEW' ? 'Create File' : activeAction.actionType === 'DELETED' ? 'Confirm Deletion' : 'Accept & Next'}
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-2 divide-x divide-border-subtle overflow-hidden">
                    <div className="flex flex-col h-full overflow-hidden">
                      <div className="px-3 py-1.5 bg-bg-panel/50 border-b border-border-subtle text-[11px] font-semibold text-text-muted flex justify-between">
                        <span>Incoming Proposed Code</span>
                        <span className="text-[10px] text-accent font-mono">{activeAction.proposedContent.split('\n').length} Lines</span>
                      </div>
                      <textarea
                        readOnly
                        value={activeAction.proposedContent}
                        className="flex-1 w-full bg-transparent p-4 font-mono text-xs text-text-primary outline-none resize-none overflow-auto"
                      />
                    </div>

                    <div className="flex flex-col h-full overflow-hidden">
                      <div className="px-3 py-1.5 bg-bg-panel/50 border-b border-border-subtle text-[11px] font-semibold text-text-muted flex justify-between">
                        <span>Original Disk File</span>
                        <span className="text-[10px] text-text-muted font-mono">{activeAction.originalContent ? `${activeAction.originalContent.split('\n').length} Lines` : 'Non-existent'}</span>
                      </div>
                      <textarea
                        readOnly
                        value={activeAction.originalContent || '/* File does not currently exist on disk */'}
                        className="flex-1 w-full bg-transparent p-4 font-mono text-xs text-text-muted outline-none resize-none overflow-auto"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
                  No active file action selected.
                </div>
              )}
            </main>
          </div>
        </div>
      )}
    </div>
  );
}