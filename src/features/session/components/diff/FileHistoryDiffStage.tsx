// src/features/session/components/diff/FileHistoryDiffStage.tsx
import { useState, useEffect, useMemo } from 'react';
import type { DevSessionFileLedgerItem, FileSessionOccurrence } from '../../types/session';
import { SessionDiffEditor } from './SessionDiffEditor';
import { getLanguageFromFilename, formatLanguageName } from './languageHelper';
import Editor from '@monaco-editor/react';
import { useAppStore } from '../../../../store/appStore';
import { 
  FileCode2, 
  GitBranch, 
  Plus, 
  Edit3, 
  GitPullRequest, 
  Trash2, 
  HardDrive, 
  RotateCcw, 
  Check, 
  Columns, 
  SquareSplitHorizontal, 
  History, 
  Sparkles,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';

interface FileHistoryDiffStageProps {
  ledgerItem: DevSessionFileLedgerItem;
  workspaceRoots: string[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onApplyRevisionToDisk?: (content: string, actionType: 'NEW' | 'MODIFIED' | 'DELETED') => Promise<void>;
}

type ComparisonMode = 'SESSION_VS_DISK' | 'SESSION_VS_PREVIOUS' | 'SESSION_VS_CHECKPOINT';

export function FileHistoryDiffStage({
  ledgerItem,
  workspaceRoots,
  selectedSessionId,
  onSelectSession,
  onApplyRevisionToDisk
}: FileHistoryDiffStageProps) {
  const config = useAppStore(s => s.config);

  const [diskContent, setDiskContent] = useState<string | null>(null);
  const [diskError, setDiskError] = useState<string | null>(null);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('SESSION_VS_DISK');
  const [renderSideBySide, setRenderSideBySide] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  // Chronologically ordered session revisions (Newest first for timeline)
  const occurrences = useMemo(() => {
    return [...ledgerItem.sessions].sort(
      (a, b) => new Date(b.sessionCreatedAt).getTime() - new Date(a.sessionCreatedAt).getTime()
    );
  }, [ledgerItem.sessions]);

  const activeOccurrence: FileSessionOccurrence = useMemo(() => {
    if (selectedSessionId) {
      const found = occurrences.find(o => o.sessionId === selectedSessionId);
      if (found) return found;
    }
    return occurrences[0];
  }, [occurrences, selectedSessionId]);

  // Read current physical disk content live
  useEffect(() => {
    let isMounted = true;
    const fetchDiskContent = async () => {
      const relPath = ledgerItem.targetRelativePath;
      for (const root of workspaceRoots) {
        const cleanRoot = root.replace(/\\/g, '/').replace(/\/+$/, '');
        const directAbs = `${cleanRoot}/${relPath}`.replace(/\\/g, '/');
        try {
          const text = await window.api.readFile(directAbs);
          if (isMounted) {
            setDiskContent(text);
            setDiskError(null);
          }
          return;
        } catch {
          // continue checking other roots
        }
      }
      if (isMounted) {
        setDiskContent(null);
        setDiskError('File does not exist on disk in any workspace root.');
      }
    };

    fetchDiskContent();
    return () => {
      isMounted = false;
    };
  }, [ledgerItem.targetRelativePath, workspaceRoots]);

  const previousOccurrence = useMemo(() => {
    const idx = occurrences.findIndex(o => o.sessionId === activeOccurrence.sessionId);
    if (idx !== -1 && idx < occurrences.length - 1) {
      return occurrences[idx + 1];
    }
    return null;
  }, [occurrences, activeOccurrence]);

  const { originalCompareText, modifiedCompareText, compareTitleLeft, compareTitleRight } = useMemo(() => {
    const targetSessionContent = activeOccurrence.workingContent || activeOccurrence.proposedContent || '';

    if (comparisonMode === 'SESSION_VS_DISK') {
      return {
        originalCompareText: diskContent ?? '',
        modifiedCompareText: targetSessionContent,
        compareTitleLeft: diskContent !== null ? 'Current State on Disk' : 'Physical Disk (Non-Existent)',
        compareTitleRight: `Session: ${activeOccurrence.sessionName}`
      };
    }

    if (comparisonMode === 'SESSION_VS_PREVIOUS') {
      const prevContent = previousOccurrence
        ? (previousOccurrence.workingContent || previousOccurrence.proposedContent || '')
        : (activeOccurrence.originalContent ?? '');

      return {
        originalCompareText: prevContent,
        modifiedCompareText: targetSessionContent,
        compareTitleLeft: previousOccurrence ? `Previous Session: ${previousOccurrence.sessionName}` : 'Initial Pre-Session Checkpoint',
        compareTitleRight: `Session: ${activeOccurrence.sessionName}`
      };
    }

    // SESSION_VS_CHECKPOINT
    return {
      originalCompareText: activeOccurrence.originalContent ?? '',
      modifiedCompareText: targetSessionContent,
      compareTitleLeft: 'Pre-Session Checkpoint (Before LLM Modification)',
      compareTitleRight: `Session: ${activeOccurrence.sessionName}`
    };
  }, [comparisonMode, activeOccurrence, diskContent, previousOccurrence]);

  const isIdentical = originalCompareText === modifiedCompareText;
  const language = getLanguageFromFilename(ledgerItem.targetRelativePath);
  const languageName = formatLanguageName(language);

  const handleApplyToDisk = async () => {
    if (!onApplyRevisionToDisk || isApplying) return;
    const targetContent = activeOccurrence.workingContent || activeOccurrence.proposedContent;
    const targetAction = activeOccurrence.actionType === 'DELETED' ? 'DELETED' : (diskContent === null ? 'NEW' : 'MODIFIED');
    
    if (confirm(`Apply revision from "${activeOccurrence.sessionName}" to physical disk?`)) {
      setIsApplying(true);
      try {
        await onApplyRevisionToDisk(targetContent, targetAction);
        setDiskContent(targetContent);
        setAppliedNotice(`Applied revision from "${activeOccurrence.sessionName}" to disk successfully!`);
        setTimeout(() => setAppliedNotice(null), 3000);
      } catch (err: unknown) {
        alert(`Failed to apply revision: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsApplying(false);
      }
    }
  };

  const getActionPill = (type: string) => {
    switch (type) {
      case 'NEW':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1"><Plus size={10} /> NEW</span>;
      case 'MODIFIED':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1"><Edit3 size={10} /> MOD</span>;
      case 'PARTIAL_DIFF':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1"><GitPullRequest size={10} /> DIFF</span>;
      case 'DELETED':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1"><Trash2 size={10} /> DEL</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-base overflow-hidden select-text">
      {/* Top Header: File Meta & Global Controls */}
      <header className="h-12 px-4 bg-bg-panel border-b border-border-subtle flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2.5 truncate pr-3">
          <FileCode2 size={16} className="text-accent shrink-0" />
          <span className="font-mono text-xs font-semibold text-text-primary truncate" title={ledgerItem.targetRelativePath}>
            {ledgerItem.targetRelativePath}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/15 text-accent border border-accent/25 shrink-0">
            {languageName}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-bg-base border border-border-subtle text-text-muted shrink-0 flex items-center gap-1">
            <History size={11} /> {ledgerItem.revisionCount} Revision{ledgerItem.revisionCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Comparison Mode Selector */}
          <div className="flex bg-bg-base border border-border-subtle rounded-md p-0.5 text-xs font-medium">
            <button
              onClick={() => setComparisonMode('SESSION_VS_DISK')}
              className={`px-2.5 py-1 rounded transition-colors ${comparisonMode === 'SESSION_VS_DISK' ? 'bg-accent/20 text-accent font-semibold' : 'text-text-muted hover:text-text-primary'}`}
              title="Compare selected session revision against current disk file"
            >
              Session vs Disk
            </button>
            <button
              onClick={() => setComparisonMode('SESSION_VS_PREVIOUS')}
              className={`px-2.5 py-1 rounded transition-colors ${comparisonMode === 'SESSION_VS_PREVIOUS' ? 'bg-accent/20 text-accent font-semibold' : 'text-text-muted hover:text-text-primary'}`}
              title="Compare against the prior session revision"
            >
              Session vs Prior Revision
            </button>
            <button
              onClick={() => setComparisonMode('SESSION_VS_CHECKPOINT')}
              className={`px-2.5 py-1 rounded transition-colors ${comparisonMode === 'SESSION_VS_CHECKPOINT' ? 'bg-accent/20 text-accent font-semibold' : 'text-text-muted hover:text-text-primary'}`}
              title="Compare against file state before LLM session started"
            >
              Session vs Checkpoint
            </button>
          </div>

          <div className="w-px h-4 bg-border-subtle mx-0.5" />

          {/* Side-by-side vs Inline toggle */}
          <button
            onClick={() => setRenderSideBySide(!renderSideBySide)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
              renderSideBySide 
                ? 'bg-bg-hover text-accent border-border-subtle' 
                : 'bg-bg-base text-text-muted border-border-subtle hover:text-text-primary'
            }`}
            title={renderSideBySide ? "Switch to Inline Diff" : "Switch to Side-by-Side Diff"}
          >
            {renderSideBySide ? <Columns size={13} /> : <SquareSplitHorizontal size={13} />}
            <span>{renderSideBySide ? 'Side-by-Side' : 'Inline'}</span>
          </button>

          {/* Apply Revision to Disk Action */}
          {onApplyRevisionToDisk && (
            <button
              onClick={handleApplyToDisk}
              disabled={isApplying || isIdentical}
              className="flex items-center gap-1.5 px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-semibold shadow-sm transition-all disabled:opacity-40"
              title="Apply this exact historical revision to physical disk"
            >
              <RotateCcw size={12} />
              <span>{isApplying ? 'Applying...' : 'Apply Revision to Disk'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Applied Success Toast */}
      {appliedNotice && (
        <div className="h-8 px-4 bg-green-500/15 border-b border-green-500/30 flex items-center gap-2 text-xs text-green-300 font-mono animate-in fade-in">
          <Check size={14} className="text-green-400" />
          <span>{appliedNotice}</span>
        </div>
      )}

      {/* Horizontal Chronological Revision Timeline */}
      <div className="h-12 bg-bg-panel/60 border-b border-border-subtle px-4 flex items-center gap-2 overflow-x-auto shrink-0 select-none">
        <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider shrink-0 flex items-center gap-1 mr-1">
          <History size={12} /> Revision Timeline:
        </span>

        {/* Disk Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border-subtle bg-bg-base text-xs font-mono shrink-0">
          <HardDrive size={12} className={diskContent !== null ? "text-green-400" : "text-text-muted"} />
          <span className="text-text-primary font-medium">Disk</span>
          {diskContent !== null ? (
            <span className="text-[10px] text-text-muted">({diskContent.split('\n').length} L)</span>
          ) : (
            <span className="text-[10px] text-red-400">Absent</span>
          )}
        </div>

        <ArrowRight size={12} className="text-text-muted shrink-0 opacity-40" />

        {/* Session Revision Pills */}
        {occurrences.map((occ, idx) => {
          const isSelected = activeOccurrence.sessionId === occ.sessionId;
          const lines = (occ.workingContent || occ.proposedContent || '').split('\n').length;

          return (
            <button
              key={occ.sessionId}
              onClick={() => onSelectSession(occ.sessionId)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-mono shrink-0 transition-all ${
                isSelected
                  ? 'bg-accent/20 border-accent/50 text-text-primary shadow-sm ring-1 ring-accent/30'
                  : 'bg-bg-base/70 border-border-subtle text-text-muted hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              {getActionPill(occ.actionType)}
              <span className="font-semibold text-text-primary truncate max-w-40" title={occ.sessionName}>
                {occ.sessionName}
              </span>
              <span className="text-[10px] opacity-75">#{occurrences.length - idx}</span>
              <span className="text-[10px] text-text-muted">({lines} L)</span>
            </button>
          );
        })}
      </div>

      {/* Comparison Metadata Ribbon */}
      <div className="h-8 px-4 bg-bg-base border-b border-border-subtle flex items-center justify-between text-xs font-mono text-text-muted shrink-0 select-none">
        <div className="flex items-center gap-2 truncate">
          <span className="text-text-primary font-medium">{compareTitleLeft}</span>
          <span>⇄</span>
          <span className="text-accent font-semibold">{compareTitleRight}</span>
        </div>

        <div className="flex items-center gap-3">
          {isIdentical ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1">
              <Sparkles size={11} /> Identical (No Differences)
            </span>
          ) : (
            <span className="text-[10px] text-orange-400 font-mono">
              Diff Detected
            </span>
          )}
          <span className="text-[11px] text-text-muted">
            <Calendar size={11} className="inline mr-1" />
            {new Date(activeOccurrence.sessionCreatedAt).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Center Stage: Diff Editor vs Unified Unchanged View */}
      <div className="flex-1 relative overflow-hidden bg-bg-base">
        {isIdentical ? (
          <div className="h-full flex flex-col">
            <Editor
              height="100%"
              language={language}
              theme="vs-dark"
              value={modifiedCompareText}
              options={{
                readOnly: true,
                fontSize: config.theme.font.size,
                minimap: { enabled: true, scale: 0.75 },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                lineNumbersMinChars: 3,
                padding: { top: 12, bottom: 12 }
              }}
            />
          </div>
        ) : (
          <SessionDiffEditor
            key={`${activeOccurrence.sessionId}::${comparisonMode}`}
            originalContent={originalCompareText}
            proposedContent={modifiedCompareText}
            workingContent={modifiedCompareText}
            filename={ledgerItem.targetRelativePath}
            actionId={activeOccurrence.actionId}
            renderSideBySide={renderSideBySide}
            onChangeWorkingContent={() => {}}
          />
        )}
      </div>
    </div>
  );
}