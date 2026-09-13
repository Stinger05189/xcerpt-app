// src/features/session/components/ActionChecklist.tsx
import type { ParsedFileAction } from '../types/session';
import { Plus, Edit3, Trash2, CheckCircle2, XCircle, Clock, AlertTriangle, Sparkles } from 'lucide-react';

interface ActionChecklistProps {
  actions: ParsedFileAction[];
  activeActionId: string | null;
  onSelectAction: (id: string) => void;
}

export function ActionChecklist({ actions, activeActionId, onSelectAction }: ActionChecklistProps) {
  const getActionBadge = (type: ParsedFileAction['actionType']) => {
    switch (type) {
      case 'NEW':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1"><Plus size={10} /> NEW</span>;
      case 'MODIFIED':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1"><Edit3 size={10} /> MOD</span>;
      case 'DELETED':
        return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1"><Trash2 size={10} /> DEL</span>;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: ParsedFileAction['reviewStatus'], isIdentical?: boolean) => {
    if (isIdentical && status === 'MERGED') {
      return (
        <span title="Identical to disk (no changes needed)">
          <CheckCircle2 size={14} className="text-blue-400 shrink-0 opacity-80" />
        </span>
      );
    }
    switch (status) {
      case 'MERGED':
        return <CheckCircle2 size={14} className="text-green-400 shrink-0" />;
      case 'REJECTED':
        return <XCircle size={14} className="text-red-400 shrink-0" />;
      case 'PENDING':
      default:
        return <Clock size={14} className="text-text-muted shrink-0 opacity-50" />;
    }
  };

  const mergedCount = actions.filter(a => a.reviewStatus === 'MERGED').length;

  return (
    <div className="flex flex-col h-full bg-bg-panel border-r border-border-subtle w-72 shrink-0 select-none">
      <div className="h-10 px-4 border-b border-border-subtle flex items-center justify-between shrink-0 bg-bg-base">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Target Files ({actions.length})</span>
        <span className="text-[10px] font-mono text-accent">
          {mergedCount} / {actions.length} Merged
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {actions.map(action => {
          const isActive = action.id === activeActionId;
          const fileName = action.targetRelativePath.split('/').pop() || action.targetRelativePath;
          const dirPath = action.targetRelativePath.substring(0, action.targetRelativePath.length - fileName.length);
          const isDirty = action.workingContent !== action.proposedContent;

          return (
            <div
              key={action.id}
              onClick={() => onSelectAction(action.id)}
              className={`p-2 rounded-lg cursor-pointer transition-all border text-xs flex flex-col gap-1.5 ${
                isActive 
                  ? 'bg-accent/10 border-accent/40 text-text-primary shadow-sm' 
                  : 'bg-bg-base/40 border-border-subtle/50 hover:bg-bg-hover text-text-muted hover:text-text-primary'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  {getActionBadge(action.actionType)}
                  <span className="font-medium text-xs truncate text-text-primary" title={action.targetRelativePath}>
                    {fileName}
                  </span>
                </div>
                {getStatusIcon(action.reviewStatus, action.isIdenticalToDisk)}
              </div>

              {dirPath && (
                <div className="text-[10px] font-mono text-text-muted/70 truncate pl-0.5" title={dirPath}>
                  {dirPath}
                </div>
              )}

              <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                {action.isIdenticalToDisk && (
                  <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 rounded flex items-center gap-0.5">
                    <Sparkles size={8} /> No-Op (Same)
                  </span>
                )}
                {isDirty && (
                  <span className="text-[9px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-1 rounded flex items-center gap-0.5">
                    <Edit3 size={8} /> Modified
                  </span>
                )}
                {action.hasSkipBlocks && (
                  <span className="text-[9px] bg-amber-400/10 text-amber-400 px-1 rounded flex items-center gap-0.5">
                    <Edit3 size={8} /> {action.skipBlockCount} Skips
                  </span>
                )}
                {action.parseWarnings.length > 0 && !action.isIdenticalToDisk && (
                  <span className="text-[9px] bg-yellow-500/10 text-yellow-400 px-1 rounded flex items-center gap-0.5" title={action.parseWarnings.join(' ')}>
                    <AlertTriangle size={8} /> Warn
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}