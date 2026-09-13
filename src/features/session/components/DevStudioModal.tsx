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
import { getLanguageFromFilename, formatLanguageName } from './diff/languageHelper';
import { 
  X, 
  Sparkles, 
  Check, 
  RotateCcw, 
  ArrowRight, 
  FileText, 
  CheckCheck, 
  AlertCircle,
  Columns,
  SquareSplitHorizontal,
  FileCode2,
  BookOpen,
  FolderArchive,
  Save,
  GitPullRequest,
  Edit3
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
    revertCurrentSession
  } = useSessionStore();

  const workspaceId = useWorkspaceStore(s => s.workspaceId);
  const rootPaths = useWorkspaceStore(s => s.rootPaths);

  const [rawText, setRawText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studioViewMode, setStudioViewMode] = useState<'diff' | 'plan'>('diff');
  const [renderSideBySide, setRenderSideBySide] = useState(true);

  // Global Keyboard listener: Ctrl+Enter to apply active action, Esc to exit view
  useEffect(() => {
    if (!isStudioOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        applyCurrentAction();
      }
      if (e.key === 'Escape' && !isIngestionModalOpen) {
        setStudioOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStudioOpen, isIngestionModalOpen, applyCurrentAction, setStudioOpen]);

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
  const isDirty = activeAction ? (activeAction.workingContent !== activeAction.proposedContent) : false;
  const activeLanguageId = activeAction ? getLanguageFromFilename(activeAction.targetRelativePath) : 'plaintext';
  const activeLanguageName = formatLanguageName(activeLanguageId);

  const lineCount = activeAction ? activeAction.workingContent.split('\n').length : 0;
  const sizeKb = activeAction ? (new Blob([activeAction.workingContent]).size / 1024).toFixed(1) : '0.0';
  const isDiffAction = activeAction?.actionType === 'MODIFIED' || activeAction?.actionType === 'PARTIAL_DIFF';

  return (
    <div className="fixed inset-0 z-50 bg-bg-base/90 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
      <SessionBrowserModal />

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
          {/* Frameless Window Header with Native Drag Support */}
          <header 
            className="h-12 bg-bg-panel border-b border-border-subtle px-4 flex items-center justify-between shrink-0 select-none"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          >
            <div className="flex items-center gap-2.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <div className="p-1.5 bg-accent/20 text-accent rounded-md">
                <GitPullRequest size={15} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-text-primary tracking-wide">
                  Dev Studio • Inbound Review
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">
                  {activeSession.name}
                </span>
                <span className="text-[10px] font-mono text-text-muted">
                  ({activeSession.summary.totalFiles} Files)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <button
                onClick={() => setBrowserModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors border border-border-subtle"
                title="Browse and Switch Dev Sessions"
              >
                <FolderArchive size={13} />
                <span>Sessions</span>
              </button>

              <div className="flex bg-bg-base border border-border-subtle rounded-lg p-0.5 text-xs">
                <button
                  onClick={() => setStudioViewMode('diff')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${studioViewMode === 'diff' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text-primary'}`}
                >
                  <FileCode2 size={13} /> Diff Studio
                </button>
                <button
                  onClick={() => setStudioViewMode('plan')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${studioViewMode === 'plan' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text-primary'}`}
                >
                  <BookOpen size={13} /> Full Plan
                </button>
              </div>

              <div className="w-px h-4 bg-border-subtle mx-1" />

              <button
                onClick={() => revertCurrentSession()}
                disabled={isApplying}
                className="flex items-center gap-1 px-2.5 py-1 bg-bg-hover hover:bg-red-500/10 text-text-muted hover:text-red-400 rounded-md text-xs font-medium border border-border-subtle transition-all"
                title="Rollback all files on disk to pre-session state"
              >
                <RotateCcw size={12} /> Revert Session
              </button>

              <button
                onClick={() => applyAllPendingActions()}
                disabled={isApplying}
                className="flex items-center gap-1 px-3 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 rounded-md text-xs font-medium transition-all"
              >
                <CheckCheck size={13} /> Merge All
              </button>

              <div className="w-px h-4 bg-border-subtle mx-1" />

              <button
                onClick={() => setStudioOpen(false)}
                className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-bg-hover transition-colors"
                title="Close Studio (Esc) - Session remains active"
              >
                <X size={16} />
              </button>
            </div>
          </header>

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
                      <div className="h-11 px-4 bg-bg-panel border-b border-border-subtle flex items-center justify-between shrink-0 text-xs select-none">
                        <div className="flex items-center gap-2.5 truncate pr-3">
                          <FileText size={15} className="text-accent shrink-0" />
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
                          {/* Inline Diff Toggle (Only rendered for diff actions) */}
                          {isDiffAction && (
                            <button
                              onClick={() => setRenderSideBySide(!renderSideBySide)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors ${
                                renderSideBySide 
                                  ? 'bg-bg-hover text-accent border-border-subtle' 
                                  : 'bg-bg-base text-text-muted border-border-subtle hover:text-text-primary'
                              }`}
                              title={renderSideBySide ? "Switch to Inline Unified Diff" : "Switch to Side-by-Side Diff"}
                            >
                              {renderSideBySide ? <Columns size={13} /> : <SquareSplitHorizontal size={13} />}
                              <span>{renderSideBySide ? 'Side-by-Side' : 'Inline'}</span>
                            </button>
                          )}

                          {isDirty && (
                            <button
                              onClick={() => resetActionWorkingContent(activeAction.id)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-bg-hover hover:bg-bg-hover/80 text-text-muted hover:text-text-primary rounded text-[11px] font-medium transition-colors"
                              title="Discard unsaved manual edits and reset to incoming proposal"
                            >
                              <RotateCcw size={11} /> Reset to Incoming
                            </button>
                          )}

                          {activeAction.reviewStatus === 'MERGED' ? (
                            <>
                              <button
                                onClick={() => revertAction(activeAction.id)}
                                disabled={isApplying}
                                className="flex items-center gap-1 px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs font-medium transition-colors"
                                title="Revert physical file on disk to pre-session state"
                              >
                                <RotateCcw size={12} /> Revert Action to Disk
                              </button>

                              {isDirty && (
                                <button
                                  onClick={() => saveActionEdits(activeAction.id)}
                                  disabled={isApplying}
                                  className="flex items-center gap-1.5 px-3.5 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-semibold shadow-sm transition-all"
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
                              <RotateCcw size={12} /> Restore to Pending
                            </button>
                          ) : (
                            <>
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
                                title="Accept changes, write to disk, and advance (Ctrl+Enter)"
                              >
                                <Check size={13} />
                                {activeAction.actionType === 'NEW' 
                                  ? 'Create File on Disk' 
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
    </div>
  );
}