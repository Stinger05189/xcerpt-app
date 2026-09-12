// src/features/session/components/drawer/FullPlanViewer.tsx
import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';

interface FullPlanViewerProps {
  rawMarkdown: string;
}

export function FullPlanViewer({ rawMarkdown }: FullPlanViewerProps) {
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(rawMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-base overflow-hidden">
      <div className="h-10 px-6 border-b border-border-subtle bg-bg-panel flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('rendered')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'rendered' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text-primary'}`}
          >
            Rendered Markdown
          </button>
          <button
            onClick={() => setViewMode('raw')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'raw' ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text-primary'}`}
          >
            Raw Markdown Source
          </button>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
        >
          {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
          <span>{copied ? 'Copied' : 'Copy Raw Text'}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 select-text">
        {viewMode === 'rendered' ? (
          <div className="max-w-4xl mx-auto prose prose-invert prose-pre:bg-bg-panel prose-pre:border prose-pre:border-border-subtle prose-a:text-accent">
            <Markdown remarkPlugins={[remarkGfm]}>{rawMarkdown}</Markdown>
          </div>
        ) : (
          <pre className="max-w-4xl mx-auto font-mono text-xs text-text-primary whitespace-pre-wrap leading-relaxed">
            {rawMarkdown}
          </pre>
        )}
      </div>
    </div>
  );
}