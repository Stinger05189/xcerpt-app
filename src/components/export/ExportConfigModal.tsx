// src/components/export/ExportConfigModal.tsx
import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { 
  X, 
  Sliders, 
  FileText, 
  Layers, 
  BookOpen, 
  ExternalLink, 
  Copy, 
  Check, 
  GitFork, 
  Database,
  Zap
} from 'lucide-react';

interface ExportConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportConfigModal({ isOpen, onClose }: ExportConfigModalProps) {
  const { 
    virtualGraph, 
    mergeToSingleFile, 
    setMergeToSingleFile, 
    maxFilesPerChunk, 
    setMaxFilesPerChunk,
    respectGitignore, 
    setRespectGitignore,
    embedProtocol, 
    setEmbedProtocol,
    chunkPaths,
    refreshVirtualGraph 
  } = useWorkspaceStore();

  const [isPreviewManifestOpen, setIsPreviewManifestOpen] = useState(false);
  const [copiedManifest, setCopiedManifest] = useState(false);

  useEffect(() => {
    if (isOpen) {
      refreshVirtualGraph();
    }
  }, [isOpen, refreshVirtualGraph]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPreviewManifestOpen) {
          setIsPreviewManifestOpen(false);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPreviewManifestOpen, onClose]);

  if (!isOpen) return null;

  const graph = virtualGraph;
  const isUnlimited = maxFilesPerChunk >= 100000;

  const handleCopyManifest = () => {
    if (!graph?.treeMarkdown) return;
    navigator.clipboard.writeText(graph.treeMarkdown);
    setCopiedManifest(true);
    setTimeout(() => setCopiedManifest(false), 1800);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-bg-panel border border-border-subtle rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden ring-1 ring-border-subtle/50 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <header className="h-14 px-6 border-b border-border-subtle bg-bg-base/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/15 text-accent rounded-xl">
              <Sliders size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary tracking-tight">
                Export & Packaging Settings
              </h2>
              <p className="text-[11px] text-text-muted">
                Configure context serialization, batch chunking, and LLM extraction protocols.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
            title="Close Settings (Esc)"
          >
            <X size={18} />
          </button>
        </header>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Summary Metrics Bar */}
          <div className="grid grid-cols-4 gap-3 bg-bg-base p-3.5 rounded-xl border border-border-subtle font-mono text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase text-text-muted font-sans font-semibold">Included Files</span>
              <span className="text-text-primary font-bold">{graph?.totalFiles || 0}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase text-text-muted font-sans font-semibold">True Size</span>
              <span className="text-accent font-bold">{(((graph?.totalTrueSize || 0)) / 1024).toFixed(1)} KB</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase text-text-muted font-sans font-semibold">Tokens</span>
              <span className="text-accent font-bold">~{(graph?.totalTokens || 0).toLocaleString()}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase text-text-muted font-sans font-semibold">Saved Skips</span>
              <span className="text-green-400 font-bold">{(((graph?.savedBytes || 0)) / 1024).toFixed(1)} KB</span>
            </div>
          </div>

          {/* Section 1: Export Strategy */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={14} className="text-accent" /> Packaging Strategy
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMergeToSingleFile(false)}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  !mergeToSingleFile
                    ? 'bg-accent/15 border-accent text-text-primary shadow-sm ring-1 ring-accent/40'
                    : 'bg-bg-base border-border-subtle hover:bg-bg-hover text-text-muted hover:text-text-primary'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-text-primary">Multi-File Batch Chunks</span>
                  {!mergeToSingleFile && <Check size={14} className="text-accent" />}
                </div>
                <span className="text-[11px] text-text-muted">
                  Exports flat files alongside a canonical manifest mapping.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMergeToSingleFile(true)}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  mergeToSingleFile
                    ? 'bg-accent/15 border-accent text-text-primary shadow-sm ring-1 ring-accent/40'
                    : 'bg-bg-base border-border-subtle hover:bg-bg-hover text-text-muted hover:text-text-primary'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-text-primary">Unified context.md</span>
                  {mergeToSingleFile && <Check size={14} className="text-accent" />}
                </div>
                <span className="text-[11px] text-text-muted">
                  Merges manifest and all code blocks into a single monolithic document.
                </span>
              </button>
            </div>
          </div>

          {/* Section 2: Batch Slicing */}
          {!mergeToSingleFile && (
            <div className="bg-bg-base border border-border-subtle rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-text-primary flex items-center gap-1.5">
                  <GitFork size={13} className="text-accent" /> Batch Chunk Limit
                </span>
                <span className="font-mono text-accent bg-accent/15 px-2 py-0.5 rounded text-[11px]">
                  {isUnlimited ? 'Unlimited (1 Chunk)' : `${maxFilesPerChunk} files / chunk`}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <input 
                  type="range"
                  min="2"
                  max="50"
                  step="1"
                  disabled={isUnlimited}
                  value={isUnlimited ? 50 : maxFilesPerChunk}
                  onChange={(e) => setMaxFilesPerChunk(parseInt(e.target.value, 10))}
                  className="flex-1 accent-accent cursor-pointer disabled:opacity-30"
                />
                <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={isUnlimited}
                    onChange={(e) => setMaxFilesPerChunk(e.target.checked ? 100000 : 20)}
                    className="accent-accent rounded w-3.5 h-3.5"
                  />
                  <span>Unlimited</span>
                </label>
              </div>
              <p className="text-[10px] text-text-muted">
                Splits the payload to comply with chat file-count upload caps (ChatGPT, Claude).
              </p>
            </div>
          )}

          {/* Section 3: Protocol & Scanner Toggles */}
          <div className="bg-bg-base border border-border-subtle rounded-xl p-4 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={embedProtocol}
                onChange={(e) => setEmbedProtocol(e.target.checked)}
                className="accent-accent w-4 h-4 rounded mt-0.5"
              />
              <div className="flex flex-col">
                <span className="text-xs font-medium text-text-primary flex items-center gap-1.5">
                  <BookOpen size={13} className="text-accent" /> Embed Code Gen Protocol in Manifest (Default)
                </span>
                <span className="text-[11px] text-text-muted mt-0.5">
                  Injects deterministic extraction contracts into the manifest header to enforce clean Line 1 paths and zero interstitial chat during AI responses.
                </span>
              </div>
            </label>

            <div className="border-t border-border-subtle/60 pt-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={respectGitignore}
                  onChange={(e) => setRespectGitignore(e.target.checked)}
                  className="accent-accent w-4 h-4 rounded mt-0.5"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-text-primary">
                    Respect repository .gitignore rules
                  </span>
                  <span className="text-[11px] text-text-muted mt-0.5">
                    Automatically skips untracked artifacts, build directories, and environment variables.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <footer className="h-14 px-6 border-t border-border-subtle bg-bg-base/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPreviewManifestOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-panel hover:bg-bg-hover text-text-muted hover:text-text-primary border border-border-subtle rounded-lg text-xs font-medium transition-colors"
            >
              <FileText size={13} className="text-accent" />
              <span>Preview Manifest</span>
            </button>

            {chunkPaths.length > 0 && (
              <button
                onClick={() => window.api.openPath(chunkPaths[0])}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-panel hover:bg-bg-hover text-text-muted hover:text-text-primary border border-border-subtle rounded-lg text-xs font-medium transition-colors"
              >
                <ExternalLink size={13} />
                <span>Open Cache</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            Done
          </button>
        </footer>
      </div>

      {/* Embedded Manifest Preview Overlay */}
      {isPreviewManifestOpen && graph && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-md flex flex-col p-8 animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-3 shrink-0 max-w-4xl w-full mx-auto">
            <div>
              <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <FileText className="text-accent" size={18} /> {graph.manifestFileName}
              </h3>
              <span className="text-xs text-text-muted">Generated canonical tree injected into outbound packages.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyManifest}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-panel border border-border-subtle hover:bg-bg-hover text-text-muted hover:text-text-primary rounded-lg text-xs font-medium transition-colors"
              >
                {copiedManifest ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                <span>{copiedManifest ? 'Copied' : 'Copy Manifest'}</span>
              </button>
              <button
                onClick={() => setIsPreviewManifestOpen(false)}
                className="p-2 bg-bg-panel border border-border-subtle hover:bg-bg-hover text-text-muted hover:text-text-primary rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 max-w-4xl w-full mx-auto bg-bg-panel border border-border-subtle rounded-xl overflow-hidden flex flex-col shadow-2xl">
            <textarea
              readOnly
              value={graph.treeMarkdown}
              className="flex-1 w-full bg-transparent text-xs font-mono text-text-primary p-5 outline-none resize-none leading-relaxed select-text"
            />
          </div>
        </div>
      )}
    </div>
  );
}