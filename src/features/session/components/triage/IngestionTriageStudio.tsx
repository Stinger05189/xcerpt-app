// src/features/session/components/triage/IngestionTriageStudio.tsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { parseSessionMarkdown, inferSessionTitle, inferSessionDescription } from '../../engine/sessionParser';
import { getLanguageFromFilename, formatLanguageName } from '../diff/languageHelper';
import { LLMService } from '../../../llm/engine/llmService';
import { useAppStore } from '../../../../store/appStore';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  ClipboardPaste, 
  Sparkles, 
  X, 
  AlertTriangle, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  RefreshCw, 
  Layers,
  ArrowRight,
  RotateCcw,
  Code2,
  ChevronDown,
  ChevronUp,
  LayoutTemplate,
  Loader2,
  Settings
} from 'lucide-react';

interface IngestionTriageStudioProps {
  workspaceId: string;
  rootPaths: string[];
  initialText?: string;
  onCommitSession: (rawMarkdown: string, title?: string, description?: string) => Promise<void>;
  onClose: () => void;
}

export function IngestionTriageStudio({
  workspaceId,
  rootPaths,
  initialText = '',
  onCommitSession,
  onClose
}: IngestionTriageStudioProps) {
  const [rawText, setRawText] = useState(initialText);
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [viewMode, setViewMode] = useState<'boundaries' | 'editor'>('boundaries');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const boundaryScrollRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setSettingsOpen = useAppStore(s => s.setSettingsOpen);
  const activeLlmConfig = useAppStore(s => s.config.llm);

  // Parse actions reactively
  const parsedPreview = useMemo(() => {
    if (!rawText.trim()) return null;
    try {
      return parseSessionMarkdown(rawText, workspaceId, rootPaths);
    } catch {
      return null;
    }
  }, [rawText, workspaceId, rootPaths]);

  const actions = useMemo(() => parsedPreview?.actions || [], [parsedPreview]);
  const explanations = useMemo(() => parsedPreview?.explanations || [], [parsedPreview]);

  const inferredTitle = useMemo(() => {
    if (!parsedPreview) return '';
    return inferSessionTitle(rawText, actions, explanations);
  }, [rawText, parsedPreview, actions, explanations]);

  const inferredDesc = useMemo(() => {
    if (!parsedPreview) return '';
    return inferSessionDescription(rawText, explanations);
  }, [rawText, parsedPreview, explanations]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [viewMode]);

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim() || !rawText) return [];
    const q = searchQuery.toLowerCase();
    const matches: number[] = [];
    let pos = 0;
    const lower = rawText.toLowerCase();
    while ((pos = lower.indexOf(q, pos)) !== -1) {
      matches.push(pos);
      pos += q.length;
    }
    return matches;
  }, [searchQuery, rawText]);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText(text);
      }
    } catch {
      setErrorMessage('Clipboard read access was blocked. You can paste directly using Ctrl+V / Cmd+V.');
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRawText(val);
    setErrorMessage(null);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setIsParsing(true);
    debounceTimerRef.current = setTimeout(() => {
      setIsParsing(false);
    }, 200);
  };

  const handleManualReParse = () => {
    setIsParsing(true);
    setTimeout(() => {
      setIsParsing(false);
    }, 100);
  };

  const handleGenerateAiMetadata = async () => {
    if (actions.length === 0 || isGeneratingAi) return;
    setIsGeneratingAi(true);
    setErrorMessage(null);

    try {
      // Strict Zero-Code Rule: Send only parsed reasoning traces and target paths
      const intentContext = inferredDesc || parsedPreview?.summary?.architecturalIntent || 'Batch work packet';
      const actionManifest = actions.map(a => ({
        type: a.actionType,
        path: a.targetRelativePath
      }));

      const generated = await LLMService.generateSessionIdentity({
        intent: intentContext,
        actions: actionManifest
      });

      if (generated.title) setCustomTitle(generated.title);
      if (generated.description) setCustomDescription(generated.description);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleCommit = async () => {
    if (!rawText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const finalTitle = customTitle.trim() || inferredTitle;
      const finalDesc = customDescription.trim() || inferredDesc;
      await onCommitSession(rawText, finalTitle, finalDesc);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setIsSubmitting(false);
    }
  };

  const totalFiles = actions.length;
  const newCount = actions.filter(a => a.actionType === 'NEW').length;
  const modCount = actions.filter(a => a.actionType === 'MODIFIED').length;
  const delCount = actions.filter(a => a.actionType === 'DELETED').length;
  const allWarnings = actions.flatMap(a => a.parseWarnings);

  const jumpToLineInEditor = (targetLine?: number) => {
    if (targetLine === undefined || !textareaRef.current) return;
    const lines = rawText.split('\n');
    let charOffset = 0;
    for (let i = 0; i < targetLine && i < lines.length; i++) {
      charOffset += lines[i].length + 1;
    }
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(charOffset, charOffset);
    const lineHeight = 20;
    textareaRef.current.scrollTop = Math.max(0, (targetLine - 5) * lineHeight);
  };

  const jumpToBoundaryCard = (actionId: string) => {
    if (viewMode !== 'boundaries') {
      setViewMode('boundaries');
    }
    setTimeout(() => {
      if (!boundaryScrollRef.current) return;
      const el = boundaryScrollRef.current.querySelector(`[data-action-id="${actionId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  const scrollToChar = (charOffset: number) => {
    if (viewMode === 'editor' && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(charOffset, charOffset + searchQuery.length);
      const linesBefore = rawText.slice(0, charOffset).split('\n').length;
      textareaRef.current.scrollTop = Math.max(0, (linesBefore - 6) * 20);
    }
  };

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIdx);
    scrollToChar(searchMatches[nextIdx]);
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIdx);
    scrollToChar(searchMatches[prevIdx]);
  };

  const filteredActions = useMemo(() => {
    if (!searchQuery.trim()) return actions;
    const q = searchQuery.toLowerCase();
    return actions.filter(a => 
      a.targetRelativePath.toLowerCase().includes(q) ||
      a.actionType.toLowerCase().includes(q)
    );
  }, [actions, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-base select-text overflow-hidden animate-in fade-in duration-150">
      {/* Top Studio Ingestion Bar */}
      <header className="h-12 bg-bg-panel border-b border-border-subtle px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-accent/20 text-accent rounded-md">
            <Sparkles size={16} />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-text-primary flex items-center gap-2">
              Inbound Response Triage Studio
              <span className="text-[10px] font-mono font-normal text-text-muted">
                (Visual Boundaries, Metadata & Action Verification)
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePasteFromClipboard}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/20 hover:bg-accent text-accent hover:text-white rounded-md text-xs font-semibold transition-all shadow-sm"
            title="Read raw markdown directly from OS clipboard"
          >
            <ClipboardPaste size={13} />
            <span>Paste from Clipboard</span>
          </button>

          {rawText && (
            <button
              onClick={() => { setRawText(''); setErrorMessage(null); }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
              title="Clear raw input"
            >
              <RotateCcw size={12} />
              <span>Clear</span>
            </button>
          )}

          <div className="w-px h-4 bg-border-subtle mx-1" />

          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary rounded-md hover:bg-bg-hover transition-colors"
            title="Cancel Ingestion (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Two-Pane Triage Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Action Manifest & Custom Metadata */}
        <aside className="w-96 bg-bg-panel border-r border-border-subtle flex flex-col shrink-0 select-none">
          {/* Custom Identification Inputs + AI Copilot */}
          <div className="p-3 border-b border-border-subtle bg-bg-base/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">
                Session Metadata
              </span>
              <button
                type="button"
                onClick={handleGenerateAiMetadata}
                disabled={actions.length === 0 || isGeneratingAi}
                className="flex items-center gap-1 text-[11px] font-semibold text-accent hover:text-accent/80 transition-colors disabled:opacity-40"
                title="Use configured LLM to generate concise Title and Description from intent & file targets"
              >
                {isGeneratingAi ? (
                  <>
                    <Loader2 size={11} className="animate-spin" />
                    <span>Analyzing Intent...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={11} />
                    <span>AI Copilot ({activeLlmConfig?.providers[activeLlmConfig.activeProvider]?.name || 'Gemini'})</span>
                  </>
                )}
              </button>
            </div>

            <div>
              <label className="text-[10px] uppercase font-medium text-text-muted block mb-1">
                Session Title (Optional)
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={inferredTitle || "e.g. Auth Token RS256 Migration"}
                className="w-full bg-bg-panel border border-border-subtle rounded-md px-2.5 py-1 text-xs text-text-primary outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-medium text-text-muted block mb-1">
                Description / Intent (Optional)
              </label>
              <input
                type="text"
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder={inferredDesc || "e.g. Architectural rationale summary"}
                className="w-full bg-bg-panel border border-border-subtle rounded-md px-2.5 py-1 text-xs text-text-primary outline-none focus:border-accent truncate"
              />
            </div>
          </div>

          <div className="p-2.5 border-b border-border-subtle bg-bg-base/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Extracted Actions ({totalFiles})
              </span>
              {allWarnings.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 flex items-center gap-1">
                  <AlertTriangle size={10} /> {allWarnings.length}
                </span>
              )}
            </div>
            {isParsing && (
              <span className="text-[10px] text-accent animate-pulse flex items-center gap-1">
                <RefreshCw size={10} className="animate-spin" /> Updating...
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredActions.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted flex flex-col items-center gap-2">
                <Layers size={28} className="opacity-30" />
                <span>{rawText.trim() ? 'No file actions matched your filter.' : 'Awaiting LLM response input...'}</span>
              </div>
            ) : (
              filteredActions.map((action, idx) => {
                const lang = formatLanguageName(getLanguageFromFilename(action.targetRelativePath));
                const lines = action.proposedContent.split('\n').length;
                const fileName = action.targetRelativePath.split('/').pop() || action.targetRelativePath;

                return (
                  <div
                    key={action.id}
                    onClick={() => {
                      if (viewMode === 'editor') {
                        jumpToLineInEditor(action.fenceLineStart);
                      } else {
                        jumpToBoundaryCard(action.id);
                      }
                    }}
                    className="p-2.5 rounded-lg border border-border-subtle/80 bg-bg-base/40 hover:bg-bg-hover hover:border-accent/30 cursor-pointer transition-all text-xs flex flex-col gap-1.5 group"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 truncate">
                        {action.actionType === 'NEW' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1 shrink-0">
                            <Plus size={9} /> NEW
                          </span>
                        )}
                        {action.actionType === 'MODIFIED' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1 shrink-0">
                            <Edit3 size={9} /> MOD
                          </span>
                        )}
                        {action.actionType === 'DELETED' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1 shrink-0">
                            <Trash2 size={9} /> DEL
                          </span>
                        )}
                        <span className="font-medium text-text-primary truncate" title={action.targetRelativePath}>
                          {fileName}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-text-muted opacity-60 group-hover:opacity-100">
                        #{idx + 1}
                      </span>
                    </div>

                    <div className="text-[10px] font-mono text-text-muted truncate pl-0.5" title={action.targetRelativePath}>
                      {action.targetRelativePath}
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-text-muted pt-0.5">
                      <span>{lang} • {lines} L</span>
                      {action.hasSkipBlocks && (
                        <span className="text-amber-400 bg-amber-400/10 px-1 rounded">
                          {action.skipBlockCount} Skips
                        </span>
                      )}
                    </div>

                    {action.parseWarnings.length > 0 && (
                      <div className="p-1.5 bg-yellow-500/10 border border-yellow-500/25 rounded text-[10px] text-yellow-300 flex items-center gap-1.5">
                        <AlertTriangle size={11} className="shrink-0 text-yellow-400" />
                        <span className="truncate">{action.parseWarnings[0]}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Summary & Primary Ingestion Button */}
          <div className="p-3 border-t border-border-subtle bg-bg-base/80 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-text-muted">
              <span>Summary:</span>
              <span className="text-text-primary">
                {newCount > 0 && <span className="text-green-400 mr-2">+{newCount} New</span>}
                {modCount > 0 && <span className="text-orange-400 mr-2">~{modCount} Mod</span>}
                {delCount > 0 && <span className="text-red-400">-{delCount} Del</span>}
              </span>
            </div>

            {errorMessage && (
              <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-[11px] text-red-400 flex flex-col gap-1.5">
                <span>{errorMessage}</span>
                {errorMessage.toLowerCase().includes('api key') && (
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="self-start flex items-center gap-1 text-[10px] font-semibold text-accent hover:underline"
                  >
                    <Settings size={11} /> Open Settings to add API Key
                  </button>
                )}
              </div>
            )}

            <button
              onClick={handleCommit}
              disabled={totalFiles === 0 || isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-semibold shadow-md transition-all disabled:opacity-40"
            >
              <Sparkles size={14} />
              <span>{isSubmitting ? 'Initializing Studio...' : `Initialize Studio (${totalFiles} Files)`}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </aside>

        {/* Right Pane: Annotated Boundary View vs Searchable Raw Editor */}
        <main className="flex-1 flex flex-col bg-bg-base overflow-hidden">
          {/* Top Inspector Controls */}
          <div className="h-10 px-4 border-b border-border-subtle bg-bg-panel/50 flex items-center justify-between shrink-0 gap-3">
            <div className="flex items-center gap-2">
              <div className="flex bg-bg-base border border-border-subtle rounded-md p-0.5 text-xs">
                <button
                  onClick={() => setViewMode('boundaries')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${viewMode === 'boundaries' ? 'bg-accent/20 text-accent font-medium' : 'text-text-muted hover:text-text-primary'}`}
                >
                  <LayoutTemplate size={12} /> Boundary Map
                </button>
                <button
                  onClick={() => setViewMode('editor')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${viewMode === 'editor' ? 'bg-accent/20 text-accent font-medium' : 'text-text-muted hover:text-text-primary'}`}
                >
                  <Code2 size={12} /> Raw Editor
                </button>
              </div>

              {/* In-Text Search */}
              <div className="relative flex items-center">
                <Search size={12} className="absolute left-2.5 text-text-muted" />
                <input
                  type="text"
                  placeholder="Find in response..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-bg-base border border-border-subtle rounded-md pl-7 pr-16 py-1 text-xs text-text-primary outline-none focus:border-accent w-52"
                />
                {searchMatches.length > 0 && (
                  <div className="absolute right-1 flex items-center gap-0.5 text-[10px] font-mono text-text-muted">
                    <span>{currentMatchIndex + 1}/{searchMatches.length}</span>
                    <button onClick={handlePrevMatch} className="p-0.5 hover:text-text-primary"><ChevronUp size={10} /></button>
                    <button onClick={handleNextMatch} className="p-0.5 hover:text-text-primary"><ChevronDown size={10} /></button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono text-[11px] text-text-muted">
              <span>{rawText.split('\n').length} Lines</span>
              <span>•</span>
              <span>{(new Blob([rawText]).size / 1024).toFixed(1)} KB</span>
              <button
                onClick={handleManualReParse}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-bg-hover hover:text-text-primary rounded border border-border-subtle transition-colors"
                title="Force re-parsing of raw markdown"
              >
                <RefreshCw size={11} className={isParsing ? 'animate-spin' : ''} />
                <span>Re-Parse</span>
              </button>
            </div>
          </div>

          {/* Body: Boundary View vs Editor View */}
          <div className="flex-1 relative overflow-hidden flex flex-col p-4">
            {!rawText.trim() ? (
              <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-border-subtle rounded-xl p-8 text-center bg-bg-panel/30">
                <div className="p-3 bg-accent/10 text-accent rounded-full mb-3">
                  <ClipboardPaste size={28} />
                </div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">Awaiting LLM Work Packet</h3>
                <p className="text-xs text-text-muted max-w-md mb-4">
                  Click the button below or paste using <kbd className="px-1.5 py-0.5 bg-bg-hover rounded border border-border-subtle text-text-primary font-mono text-[10px]">Ctrl+V</kbd> to inspect the extracted file actions.
                </p>
                <button
                  onClick={handlePasteFromClipboard}
                  className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-semibold shadow-lg transition-all"
                >
                  <ClipboardPaste size={14} /> Paste from Clipboard
                </button>
              </div>
            ) : viewMode === 'boundaries' ? (
              <div ref={boundaryScrollRef} className="flex-1 overflow-y-auto space-y-4 pr-2">
                {/* Visual Reasoning Sections & File Boundaries */}
                {explanations.map((sec) => (
                  <div 
                    key={sec.id}
                    className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-text-primary"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold">
                        {sec.kind || 'Reasoning'}
                      </span>
                      <h4 className="font-semibold text-xs text-text-primary m-0">{sec.title}</h4>
                    </div>
                    <div className="prose prose-invert prose-xs max-w-none text-text-muted">
                      <Markdown remarkPlugins={[remarkGfm]}>{sec.content}</Markdown>
                    </div>
                  </div>
                ))}

                {actions.map((act, index) => {
                  const lang = formatLanguageName(getLanguageFromFilename(act.targetRelativePath));
                  const lines = act.proposedContent.split('\n').length;

                  return (
                    <div 
                      key={act.id} 
                      data-action-id={act.id}
                      className="rounded-xl border border-border-subtle bg-bg-panel overflow-hidden shadow-lg"
                    >
                      {/* Boundary Header Ruler */}
                      <div className="h-9 px-3.5 bg-bg-base border-b border-border-subtle flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-accent font-bold">╭── BOUNDARY {index + 1}:</span>
                          {act.actionType === 'NEW' && <span className="text-green-400 font-bold">[NEW]</span>}
                          {act.actionType === 'MODIFIED' && <span className="text-orange-400 font-bold">[MODIFIED]</span>}
                          {act.actionType === 'DELETED' && <span className="text-red-400 font-bold">[DELETED]</span>}
                          <span className="text-text-primary font-semibold">{act.targetRelativePath}</span>
                        </div>
                        <div className="flex items-center gap-2 text-text-muted text-[11px]">
                          <span className="bg-accent/15 text-accent px-2 py-0.2 rounded">{lang}</span>
                          <span>{lines} L</span>
                        </div>
                      </div>

                      {/* Code Preview Box */}
                      <pre className="p-4 m-0 overflow-x-auto font-mono text-xs text-text-primary bg-bg-panel leading-normal max-h-72">
                        <code>{act.proposedContent}</code>
                      </pre>

                      {/* Boundary Footer Ruler */}
                      <div className="h-7 px-3.5 bg-bg-base border-t border-border-subtle flex items-center justify-between text-[11px] font-mono text-text-muted">
                        <span className="text-accent/60">╰── END FILE BOUNDARY: {act.targetRelativePath}</span>
                        {act.hasSkipBlocks && (
                          <span className="text-amber-400">Contains {act.skipBlockCount} skip markers</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={rawText}
                onChange={handleTextChange}
                placeholder="Paste LLM Markdown response here..."
                className="flex-1 w-full bg-bg-panel/60 border border-border-subtle rounded-xl p-4 text-xs font-mono text-text-primary outline-none focus:border-accent resize-none leading-relaxed select-text cursor-text"
                spellCheck={false}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}