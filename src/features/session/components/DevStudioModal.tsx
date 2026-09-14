// src/features/session/components/DevStudioModal.tsx
import { useState, useEffect } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useWorkspaceStore } from '../../../store/workspaceStore';
import { ActionChecklist } from './ActionChecklist';
import { SessionDiffEditor } from './diff/SessionDiffEditor';
import { NewFilePreview } from './diff/NewFilePreview';
import { DeletedFileBanner } from './diff/DeletedFileBanner';
import { ReasoningDrawer } from './drawer/ReasoningDrawer';
import { FullPlanViewer } from './drawer/FullPlanViewer';
import { SessionBrowserModal } from './SessionBrowserModal';
import { IngestionTriageStudio } from './triage/IngestionTriageStudio';
import { getLanguageFromFilename, formatLanguageName } from './diff/languageHelper';
import { 
  X, 
  Check, 
  RotateCcw, 
  ArrowRight, 
  FileText, 
  CheckCheck, 
  Columns,
  SquareSplitHorizontal,
  FileCode2,
  BookOpen,
  FolderArchive,
  Save,
  GitPullRequest,
  Edit3,
  GitBranch,
  GitCommit,
  CheckCircle2,
  LogOut
} from 'lucide-react';

export function DevStudioModal() {
  const { 
    activeSession, 
    activeActionId, 
    isStudioOpen, 
    isIngestionModalOpen,
    isBrowserModalOpen,
    isApplying,
    setIngestionModalOpen, 
    setStudioOpen, 
    setBrowserModalOpen,
    setActiveActionId,
    initSessionFromMarkdown,
    updateWorkingContent,
    saveActionEdits,
    resetActionWorkingContent,
    applyCurrentAction,
    revertAction,
    rejectCurrentAction,
    restoreActionToPending,
    applyAllPendingActions,
    revertCurrentSession,
    completeCurrentSession,
    exitCurrentSession
  } = useSessionStore();

  const workspaceId = useWorkspaceStore(s => s.workspaceId);
  const rootPaths = useWorkspaceStore(s => s.rootPaths);

  const [studioViewMode, setStudioViewMode] = useState<'diff' | 'plan'>('diff');
  const [renderSideBySide, setRenderSideBySide] = useState(true);
  const [gitBranch, setGitBranch] = useState<string | null>(null);

  // Commit Modal State
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommittingGit, setIsCommittingGit] = useState(false);
  const [commitResult, setCommitResult] = useState<{ success: boolean; hash?: string; error?: string } | null>(null);

  // Fetch Git branch for active root
  useEffect(() => {
    const fetchBranch = async () => {
      const activeRoot = rootPaths[0];
      if (activeRoot && window.api?.getGitBranch) {
        try {
          const branch = await window.api.getGitBranch(activeRoot);
          setGitBranch(branch);
        } catch {
          setGitBranch(null);
        }
      }
    };
    if (isStudioOpen) {
      fetchBranch();
    }
  }, [isStudioOpen, rootPaths]);

  // Global Keyboard listener: Ctrl+Enter to apply active action, Esc to exit view
  useEffect(() => {
    if (!isStudioOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        applyCurrentAction();
      }
      if (e.key === 'Escape' && !isIngestionModalOpen && !isCommitModalOpen && !isBrowserModalOpen) {
        setStudioOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStudioOpen, isIngestionModalOpen, isCommitModalOpen, isBrowserModalOpen, applyCurrentAction, setStudioOpen]);

  // Strict Mutual Exclusivity: if neither is active, render nothing
  if (!isIngestionModalOpen && !isStudioOpen && !isBrowserModalOpen) return null;

  const handleCommitGit = async () => {
    const activeRoot = rootPaths[0];
    if (!activeRoot || !commitMessage.trim()) return;
    setIsCommittingGit(true);
    setCommitResult(null);

    try {
      const result = await window.api.commitGit(activeRoot, commitMessage.trim());
      setCommitResult(result);
      if (result.success) {
        setTimeout(() => {
          setIsCommitModalOpen(false);
          setCommitResult(null);
        }, 1800);
      }
    } catch (e: unknown) {
      setCommitResult({ success: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setIsCommittingGit(false);
    }
  };

  const activeAction = activeSession?.actions.find(a => a.id === activeActionId) || null;
  const isDirty = activeAction ? (activeAction.workingContent !== activeAction.proposedContent) : false;
  const activeLanguageId = activeAction ? getLanguageFromFilename(activeAction.targetRelativePath) : 'plaintext';
  const activeLanguageName = formatLanguageName(activeLanguageId);

  const lineCount = activeAction ? activeAction.workingContent.split('\n').length : 0;
  const sizeKb = activeAction ? (new Blob([activeAction.workingContent]).size / 1024).toFixed(1) : '0.0';
  const isDiffAction = activeAction?.actionType === 'MODIFIED' || activeAction?.actionType === 'PARTIAL_DIFF';

  const allActionsReviewed = activeSession
    ? activeSession.actions.length > 0 && activeSession.actions.every(a => a.reviewStatus === 'MERGED' || a.reviewStatus === 'REJECTED')
    : false;

  return (
    <div className="fixed top-10 inset-x-0 bottom-0 z-40 bg-bg-base/95 backdrop-blur-md flex flex-col animate-in fade-in duration-150">
      {/* Session Browser Management Suite (Full Viewport) */}
      {isBrowserModalOpen && <SessionBrowserModal />}

      {/* Inbound Interactive Ingestion Triage Studio (Full Viewport) */}
      {isIngestionModalOpen && !isBrowserModalOpen && workspaceId && (
        <IngestionTriageStudio
          workspaceId={workspaceId}
          rootPaths={rootPaths}
          onCommitSession={async (rawMarkdown, title, description) => {
            await initSessionFromMarkdown(rawMarkdown, workspaceId, rootPaths, title, description);
          }}
          onClose={() => setIngestionModalOpen(false)}
        />
      )}

      {/* Active Dev Studio Review View (Exclusively rendered when ingestion and browser are closed) */}
      {isStudioOpen && !isIngestionModalOpen && !isBrowserModalOpen && activeSession && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Frameless Studio Sub-Header */}
          <header className="h-11 bg-bg-panel border-b border-border-subtle px-4 flex items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-2.5">
              <div className="p-1 bg-accent/20 text-accent rounded">
                <GitPullRequest size={14} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text-primary tracking-wide">
                  Dev Studio
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 max-w-xs truncate" title={activeSession.name}>
                  {activeSession.name}
                </span>
                {gitBranch && (
                  <span className="text-[10px] font-mono text-text-muted flex items-center gap-1 bg-bg-base px-2 py-0.5 rounded border border-border-subtle">
                    <GitBranch size={10} className="text-accent" />
                    <span>{gitBranch}</span>
                  </span>
                )}
                <span className="text-[10px] font-mono text-text-muted">
                  ({activeSession.summary.totalFiles} Files)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setBrowserModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors border border-border-subtle"
                title="Browse and Switch Dev Sessions"
              >
                <FolderArchive size={12} />
                <span>Sessions</span>
              </button>

              <div className="flex bg-bg-base border border-border-subtle rounded-lg p-0.5 text-xs">
                <button
                  onClick={() => setStudioViewMode('diff')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${studioViewMode === 'diff' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text-primary'}`}
                >
                  <FileCode2 size={12} /> Diff Studio
                </button>
                <button
                  onClick={() => setStudioViewMode('plan')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${studioViewMode === 'plan' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text-primary'}`}
                >
                  <BookOpen size={12} /> Full Plan
                </button>
              </div>

              <div className="w-px h-4 bg-border-subtle mx-1" />

              <button
                onClick={() => {
                  setCommitMessage(activeSession.summary.architecturalIntent || activeSession.name);
                  setIsCommitModalOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded-md text-xs font-medium transition-all"
                title="Create Git commit from merged session"
              >
                <GitCommit size={12} /> Commit Git
              </button>

              <button
                onClick={() => revertCurrentSession()}
                disabled={isApplying}
                className="flex items-center gap-1 px-2.5 py-1 bg-bg-hover hover:bg-red-500/10 text-text-muted hover:text-red-400 rounded-md text-xs font-medium border border-border-subtle transition-all"
                title="Rollback all files on disk to pre-session state"
              >
                <RotateCcw size={11} /> Revert All
              </button>

              <button
                onClick={() => applyAllPendingActions()}
                disabled={isApplying}
                className="flex items-center gap-1 px-3 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 rounded-md text-xs font-medium transition-all"
              >
                <CheckCheck size={12} /> Merge All
              </button>

              <div className="w-px h-4 bg-border-subtle mx-1" />

              <button
                onClick={exitCurrentSession}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors"
                title="Exit and unload active session to catalog"
              >
                <LogOut size={12} />
                <span>Exit Session</span>
              </button>

              <button
                onClick={() => setStudioOpen(false)}
                className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-bg-hover transition-colors"
                title="Close Studio (Esc)"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          {/* Session Complete Banner */}
          {allActionsReviewed && (
            <div className="h-10 px-4 bg-green-500/15 border-b border-green-500/30 flex items-center justify-between shrink-0 text-xs text-green-300 animate-in fade-in select-none">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 size={15} className="text-green-400 shrink-0" />
                <span>All file actions have been reviewed and merged!</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setCommitMessage(activeSession.summary.architecturalIntent || activeSession.name);
                    setIsCommitModalOpen(true);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded border border-green-500/40 text-[11px] font-semibold transition-colors"
                >
                  <GitCommit size={12} /> Create Git Commit
                </button>
                <button
                  onClick={completeCurrentSession}
                  className="flex items-center gap-1 px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-[11px] font-semibold shadow-sm transition-all"
                >
                  <Check size={12} /> Complete & Archive Session
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 flex overflow-hidden">
            {studioViewMode === 'diff' ? (
              <>
                <ActionChecklist
                  actions={activeSession.actions}
                  activeActionId={activeActionId}
                  onSelectAction={setActiveActionId}
                />

                <main className="flex-1 flex flex-col bg-bg-base overflow-hidden">
                  <ReasoningDrawer
                    explanations={activeSession.explanations}
                    activeActionId={activeActionId}
                    overallIntent={activeSession.summary.architecturalIntent}
                  />

                  {activeAction ? (
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                      {/* Unified Single Action Toolbar */}
                      <div className="h-10 px-4 bg-bg-panel border-b border-border-subtle flex items-center justify-between shrink-0 text-xs select-none">
                        <div className="flex items-center gap-2.5 truncate pr-3">
                          <FileText size={14} className="text-accent shrink-0" />
                          <span className="font-mono text-text-primary truncate font-medium text-xs">
                            {activeAction.targetRelativePath}
                          </span>

                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/15 text-accent border border-accent/25 shrink-0">
                            {activeLanguageName}
                          </span>

                          <span className="text-[10px] text-text-muted font-mono shrink-0">
                            {lineCount} L • {sizeKb} KB
                          </span>

                          {activeAction.hasSkipBlocks && (
                            <span className="text-[10px] bg-amber-400/10 text-amber-400 border border-amber-400/30 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 font-mono">
                              <Edit3 size={10} /> {activeAction.skipBlockCount} Skips
                            </span>
                          )}

                          {activeAction.isIdenticalToDisk && (
                            <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-mono shrink-0">
                              No Changes (Identical to Disk)
                            </span>
                          )}

                          {isDirty && (
                            <span className="text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded font-mono shrink-0 animate-pulse">
                              ● Unsaved Manual Edits
                            </span>
                          )}

                          {activeAction.reviewStatus === 'MERGED' && !isDirty && (
                            <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/30 px-2 py-0.5 rounded font-mono shrink-0">
                              ✓ Merged to Disk
                            </span>
                          )}
                          {activeAction.reviewStatus === 'REJECTED' && (
                            <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/30 px-2 py-0.5 rounded font-mono shrink-0">
                              ✕ Rejected
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isDiffAction && (
                            <button
                              onClick={() => setRenderSideBySide(!renderSideBySide)}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                                renderSideBySide 
                                  ? 'bg-bg-hover text-accent border-border-subtle' 
                                  : 'bg-bg-base text-text-muted border-border-subtle hover:text-text-primary'
                              }`}
                              title={renderSideBySide ? "Switch to Inline Unified Diff" : "Switch to Side-by-Side Diff"}
                            >
                              {renderSideBySide ? <Columns size={12} /> : <SquareSplitHorizontal size={12} />}
                              <span>{renderSideBySide ? 'Side-by-Side' : 'Inline'}</span>
                            </button>
                          )}

                          {isDirty && (
                            <button
                              onClick={() => resetActionWorkingContent(activeAction.id)}
                              className="flex items-center gap-1 px-2 py-1 bg-bg-hover hover:bg-bg-hover/80 text-text-muted hover:text-text-primary rounded text-[11px] font-medium transition-colors"
                              title="Discard unsaved manual edits and reset to incoming proposal"
                            >
                              <RotateCcw size={11} /> Reset Edits
                            </button>
                          )}

                          {activeAction.reviewStatus === 'MERGED' ? (
                            <>
                              <button
                                onClick={() => revertAction(activeAction.id)}
                                disabled={isApplying}
                                className="flex items-center gap-1 px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs font-medium transition-colors"
                                title="Revert physical file on disk to pre-session state"
                              >
                                <RotateCcw size={11} /> Revert File
                              </button>

                              {isDirty && (
                                <button
                                  onClick={() => saveActionEdits(activeAction.id)}
                                  disabled={isApplying}
                                  className="flex items-center gap-1.5 px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-semibold shadow-sm transition-all"
                                  title="Write manual studio modifications to disk"
                                >
                                  <Save size={12} /> Save Additional Edits
                                </button>
                              )}
                            </>
                          ) : activeAction.reviewStatus === 'REJECTED' ? (
                            <button
                              onClick={() => restoreActionToPending(activeAction.id)}
                              className="flex items-center gap-1 px-3 py-1 bg-bg-hover hover:bg-bg-hover/80 text-text-primary rounded text-xs font-medium transition-colors"
                            >
                              <RotateCcw size={12} /> Restore
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={rejectCurrentAction}
                                className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-xs font-medium transition-colors"
                              >
                                Reject
                              </button>

                              <button
                                onClick={applyCurrentAction}
                                disabled={isApplying}
                                className="flex items-center gap-1.5 px-3.5 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-semibold shadow-sm transition-all"
                                title="Accept changes, write to disk, and advance (Ctrl+Enter)"
                              >
                                <Check size={13} />
                                {activeAction.actionType === 'NEW' 
                                  ? 'Create File' 
                                  : activeAction.actionType === 'DELETED' 
                                  ? 'Confirm Deletion' 
                                  : 'Accept & Next'}
                                <ArrowRight size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Content Stage with Isolated React Keys */}
                      <div className="flex-1 overflow-hidden">
                        {activeAction.actionType === 'NEW' ? (
                          <NewFilePreview
                            key={activeAction.id}
                            workingContent={activeAction.workingContent}
                            filename={activeAction.targetRelativePath}
                            actionId={activeAction.id}
                            onChangeContent={(val) => updateWorkingContent(activeAction.id, val)}
                          />
                        ) : activeAction.actionType === 'DELETED' ? (
                          <DeletedFileBanner
                            key={activeAction.id}
                            relativePath={activeAction.targetRelativePath}
                            originalContent={activeAction.originalContent}
                            onConfirmDelete={applyCurrentAction}
                            isApplying={isApplying}
                          />
                        ) : (
                          <SessionDiffEditor
                            key={activeAction.id}
                            originalContent={activeAction.originalContent}
                            proposedContent={activeAction.proposedContent}
                            workingContent={activeAction.workingContent}
                            filename={activeAction.targetRelativePath}
                            actionId={activeAction.id}
                            renderSideBySide={renderSideBySide}
                            onChangeWorkingContent={(val) => updateWorkingContent(activeAction.id, val)}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
                      No active file action selected.
                    </div>
                  )}
                </main>
              </>
            ) : (
              <FullPlanViewer rawMarkdown={activeSession.rawMarkdown} />
            )}
          </div>
        </div>
      )}

      {/* Post-Session Git Commit Dialog */}
      {isCommitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-8">
          <div className="bg-bg-panel border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl p-5 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2 text-text-primary font-semibold text-sm">
                <GitCommit size={16} className="text-accent" />
                <span>Create Git Commit</span>
              </div>
              <button 
                onClick={() => setIsCommitModalOpen(false)}
                className="p-1 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-text-muted font-medium">Commit Message:</label>
              <textarea
                autoFocus
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                rows={4}
                className="w-full bg-bg-base border border-border-subtle rounded-xl p-3 text-xs font-mono text-text-primary outline-none focus:border-accent resize-none leading-relaxed"
                placeholder="Commit message..."
              />
            </div>

            {commitResult && (
              <div className={`p-2.5 rounded-lg text-xs font-mono ${commitResult.success ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                {commitResult.success ? `✓ Committed successfully (${commitResult.hash || 'HEAD'})` : `Error: ${commitResult.error}`}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
              <button
                onClick={() => setIsCommitModalOpen(false)}
                className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleCommitGit}
                disabled={!commitMessage.trim() || isCommittingGit}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-40"
              >
                <GitCommit size={14} />
                <span>{isCommittingGit ? 'Committing...' : 'Commit Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}