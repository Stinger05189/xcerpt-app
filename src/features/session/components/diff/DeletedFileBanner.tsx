// src/features/session/components/diff/DeletedFileBanner.tsx
import { Trash2, AlertTriangle, FileText, Check } from 'lucide-react';

interface DeletedFileBannerProps {
  relativePath: string;
  originalContent: string | null;
  onConfirmDelete: () => void;
  isApplying?: boolean;
}

export function DeletedFileBanner({ relativePath, originalContent, onConfirmDelete, isApplying }: DeletedFileBannerProps) {
  const lines = originalContent ? originalContent.split('\n').length : 0;
  const sizeKb = originalContent ? (new Blob([originalContent]).size / 1024).toFixed(1) : '0.0';

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-bg-base overflow-y-auto">
      <div className="max-w-xl w-full bg-red-500/5 border border-red-500/30 rounded-2xl p-8 flex flex-col items-center text-center shadow-2xl">
        <div className="p-4 bg-red-500/20 text-red-400 rounded-full mb-4">
          <Trash2 size={32} />
        </div>

        <h2 className="text-lg font-semibold text-text-primary mb-1">File Deletion Requested</h2>
        <p className="text-xs text-text-muted mb-6">
          The LLM work packet marked this file with a tombstone header (<code className="text-red-400 font-mono">[DELETED]</code>).
        </p>

        <div className="w-full bg-bg-panel border border-border-subtle rounded-xl p-4 mb-6 text-left">
          <div className="flex items-center gap-2 text-xs font-mono text-text-primary mb-2 truncate">
            <FileText size={14} className="text-red-400 shrink-0" />
            <span className="truncate">{relativePath}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-text-muted font-mono pt-2 border-t border-border-subtle">
            <div>Lines on disk: <span className="text-text-primary">{lines}</span></div>
            <div>File size: <span className="text-text-primary">{sizeKb} KB</span></div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-300 mb-6 text-left">
          <AlertTriangle size={16} className="shrink-0 text-red-400" />
          <span>Confirming deletion will remove the file from your local disk. You can restore it using Revert Session.</span>
        </div>

        <button
          onClick={onConfirmDelete}
          disabled={isApplying}
          className="flex items-center gap-2 px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold shadow-lg transition-all disabled:opacity-40"
        >
          <Check size={14} /> Confirm File Deletion
        </button>
      </div>
    </div>
  );
}