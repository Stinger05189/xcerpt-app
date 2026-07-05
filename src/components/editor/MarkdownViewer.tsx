// src/components/editor/MarkdownViewer.tsx
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownViewer({ content }: { content: string }) {
  return (
    <div className="absolute inset-0 overflow-y-auto p-8 bg-bg-base select-text cursor-auto">
      <div className="max-w-4xl mx-auto prose prose-invert prose-pre:bg-bg-panel prose-pre:border prose-pre:border-border-subtle prose-a:text-accent">
        <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
      </div>
    </div>
  );
}