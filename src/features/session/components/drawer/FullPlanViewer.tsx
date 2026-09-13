// src/features/session/components/drawer/FullPlanViewer.tsx
import { useState, useRef, useEffect, useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Editor from '@monaco-editor/react';
import { useSessionStore } from '../../store/sessionStore';
import { useAppStore } from '../../../../store/appStore';
import { getLanguageFromFilename, formatLanguageName } from '../diff/languageHelper';
import { 
  Copy, 
  Check, 
  FileCode2, 
  Layers, 
  ExternalLink, 
  X, 
  Code2, 
  FileText, 
  Sparkles,
  ChevronRight,
  Maximize2
} from 'lucide-react';

interface FullPlanViewerProps {
  rawMarkdown: string;
}

interface CodeArtifactItem {
  id: string;
  language: string;
  filename: string;
  content: string;
  lineCount: number;
}

export function FullPlanViewer({ rawMarkdown }: FullPlanViewerProps) {
  const config = useAppStore(s => s.config);
  const planScrollTop = useSessionStore(s => s.planScrollTop);
  const setPlanScrollTop = useSessionStore(s => s.setPlanScrollTop);

  const [activeArtifact, setActiveArtifact] = useState<CodeArtifactItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Restore scroll position
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = planScrollTop;
    }
  }, [planScrollTop]);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setPlanScrollTop(scrollContainerRef.current.scrollTop);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(rawMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Parse sections and code artifacts from the raw markdown
  const { sections, artifacts, stats } = useMemo(() => {
    const lines = rawMarkdown.replace(/\r\n/g, '\n').split('\n');
    const secList: Array<{ id: string; title: string; level: number; lineIndex: number }> = [];
    const artList: CodeArtifactItem[] = [];

    let inFence = false;
    let fenceLang = '';
    let currentFenceBuffer: string[] = [];

    lines.forEach((line, idx) => {
      const fenceMatch = line.match(/^([`~]{3,})(.*)$/);
      if (!inFence) {
        if (fenceMatch) {
          inFence = true;
          fenceLang = fenceMatch[2].trim() || 'plaintext';
          currentFenceBuffer = [];
        } else {
          const headerMatch = line.match(/^(#{1,4})\s+(.*)$/);
          if (headerMatch) {
            secList.push({
              id: `sec-${idx}`,
              title: headerMatch[2].trim(),
              level: headerMatch[1].length,
              lineIndex: idx
            });
          }
        }
      } else {
        if (fenceMatch && fenceMatch[2].trim().length === 0) {
          inFence = false;
          const codeText = currentFenceBuffer.join('\n');
          const firstLine = currentFenceBuffer.find(l => l.trim().length > 0) || '';
          
          let inferredName = `snippet_${artList.length + 1}.${fenceLang || 'txt'}`;
          const pathMatch = firstLine.match(/(\/\/|#|<!--|--)\s*(?:\[.*?\]\s*)?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9_-]+)/);
          if (pathMatch) {
            inferredName = pathMatch[2].trim();
          }

          artList.push({
            id: `art-${artList.length + 1}`,
            language: fenceLang,
            filename: inferredName,
            content: codeText,
            lineCount: currentFenceBuffer.length
          });
          currentFenceBuffer = [];
        } else {
          currentFenceBuffer.push(line);
        }
      }
    });

    const words = rawMarkdown.trim().split(/\s+/).length;
    const sizeKb = (new Blob([rawMarkdown]).size / 1024).toFixed(1);
    const estimatedTokens = Math.round(words * 1.3);

    return {
      sections: secList,
      artifacts: artList,
      stats: { words, sizeKb, estimatedTokens, artifactCount: artList.length }
    };
  }, [rawMarkdown]);

  const scrollToLine = (lineIdx: number) => {
    if (!scrollContainerRef.current) return;
    const lineElements = scrollContainerRef.current.querySelectorAll('[data-line-idx]');
    for (const el of Array.from(lineElements)) {
      if (el.getAttribute('data-line-idx') === String(lineIdx)) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
    }
  };

  const isArtifactMarkdown = activeArtifact && /\.(md|mdx)$/i.test(activeArtifact.filename);

  return (
    <div className="flex-1 flex h-full bg-bg-base overflow-hidden relative select-text">
      {/* Categorized Plan Navigation Sidebar */}
      <aside className="w-72 bg-bg-panel border-r border-border-subtle flex flex-col shrink-0 select-none">
        <div className="p-3.5 border-b border-border-subtle bg-bg-base shrink-0 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-xs text-text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={13} className="text-accent" /> Plan Structure
            </h3>
            <span className="text-[10px] text-text-muted font-mono">
              {stats.sizeKb} KB • ~{stats.estimatedTokens.toLocaleString()} tkns
            </span>
          </div>
          <button
            onClick={handleCopy}
            className="p-1.5 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover transition-colors"
            title="Copy Raw Markdown Plan"
          >
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Outline Sections */}
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-text-muted mb-2 px-1">
              Document Outline ({sections.length})
            </div>
            <div className="space-y-0.5">
              {sections.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => {
                    setSelectedSection(sec.id);
                    scrollToLine(sec.lineIndex);
                  }}
                  className={`w-full text-left px-2 py-1 rounded text-xs truncate transition-colors flex items-center gap-1.5 ${
                    selectedSection === sec.id
                      ? 'bg-accent/20 text-accent font-medium'
                      : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                  }`}
                  style={{ paddingLeft: `${Math.max(8, (sec.level - 1) * 12)}px` }}
                  title={sec.title}
                >
                  <ChevronRight size={10} className="shrink-0 opacity-60" />
                  <span className="truncate">{sec.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Extracted Code Artifacts */}
          {artifacts.length > 0 && (
            <div className="pt-2 border-t border-border-subtle">
              <div className="text-[10px] uppercase font-bold tracking-wider text-text-muted mb-2 px-1 flex items-center justify-between">
                <span>Code Artifacts</span>
                <span className="bg-accent/10 text-accent px-1.5 py-0.2 rounded font-mono text-[9px]">
                  {artifacts.length}
                </span>
              </div>
              <div className="space-y-1">
                {artifacts.map((art) => {
                  const langName = formatLanguageName(getLanguageFromFilename(art.filename));
                  return (
                    <div
                      key={art.id}
                      onClick={() => setActiveArtifact(art)}
                      className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex flex-col gap-1 ${
                        activeArtifact?.id === art.id
                          ? 'bg-accent/15 border-accent/40 text-text-primary shadow-sm'
                          : 'bg-bg-base/60 border-border-subtle hover:bg-bg-hover text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <FileCode2 size={12} className="text-accent shrink-0" />
                          <span className="font-mono text-[11px] truncate font-medium text-text-primary" title={art.filename}>
                            {art.filename.split('/').pop() || art.filename}
                          </span>
                        </div>
                        <Maximize2 size={10} className="shrink-0 opacity-60 hover:opacity-100" />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                        <span>{langName}</span>
                        <span>{art.lineCount} lines</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Rendered Plan Reading Stage */}
      <main 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-8 bg-bg-base leading-relaxed"
      >
        <div className="max-w-4xl mx-auto prose prose-invert prose-slate prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-base prose-pre:p-0 prose-pre:bg-transparent prose-pre:border-0">
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const codeString = String(children).replace(/\n$/, '');
                const isInline = !match && !codeString.includes('\n');

                if (isInline) {
                  return (
                    <code className="bg-bg-hover/80 text-accent font-mono text-[11px] px-1.5 py-0.5 rounded border border-border-subtle" {...props}>
                      {children}
                    </code>
                  );
                }

                const lang = match ? match[1] : 'plaintext';
                const firstLine = codeString.split('\n')[0] || '';
                let pathHeader = '';
                const pathMatch = firstLine.match(/(\/\/|#|<!--|--)\s*(?:\[.*?\]\s*)?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9_-]+)/);
                if (pathMatch) {
                  pathHeader = pathMatch[2].trim();
                }

                return (
                  <div className="my-4 rounded-xl border border-border-subtle bg-bg-panel overflow-hidden shadow-lg">
                    <div className="h-8 bg-bg-base/80 px-3 border-b border-border-subtle flex items-center justify-between text-xs font-mono text-text-muted">
                      <div className="flex items-center gap-1.5 truncate">
                        <Code2 size={13} className="text-accent" />
                        <span className="text-text-primary font-medium">{pathHeader || `${lang} snippet`}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] opacity-70">{codeString.split('\n').length} lines</span>
                        <button
                          onClick={() => {
                            setActiveArtifact({
                              id: `art-view-${Date.now()}`,
                              filename: pathHeader || `snippet.${lang}`,
                              language: lang,
                              content: codeString,
                              lineCount: codeString.split('\n').length
                            });
                          }}
                          className="flex items-center gap-1 text-[11px] text-accent hover:underline hover:text-accent/80 transition-colors"
                        >
                          <ExternalLink size={11} /> Open in Studio
                        </button>
                      </div>
                    </div>
                    <pre className="p-4 m-0 overflow-x-auto font-mono text-xs text-text-primary bg-bg-panel leading-normal">
                      <code>{codeString}</code>
                    </pre>
                  </div>
                );
              }
            }}
          >
            {rawMarkdown}
          </Markdown>
        </div>
      </main>

      {/* Popout / Side Artifact Viewer */}
      {activeArtifact && (
        <div className="w-1/2 h-full bg-bg-panel border-l border-border-subtle flex flex-col shadow-2xl animate-in slide-in-from-right-4 duration-200 z-20">
          <div className="h-11 px-4 bg-bg-base border-b border-border-subtle flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 truncate">
              <FileCode2 size={14} className="text-accent shrink-0" />
              <span className="font-mono text-xs font-medium text-text-primary truncate">
                {activeArtifact.filename}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/20 text-accent">
                {formatLanguageName(getLanguageFromFilename(activeArtifact.filename))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(activeArtifact.content)}
                className="p-1.5 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover transition-colors"
                title="Copy Artifact Source"
              >
                <Copy size={13} />
              </button>
              <button
                onClick={() => setActiveArtifact(null)}
                className="p-1.5 text-text-muted hover:text-text-primary rounded hover:bg-bg-hover transition-colors"
                title="Close Artifact View"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden">
            {isArtifactMarkdown ? (
              <div className="p-6 overflow-y-auto h-full prose prose-invert prose-xs max-w-none">
                <Markdown remarkPlugins={[remarkGfm]}>{activeArtifact.content}</Markdown>
              </div>
            ) : (
              <Editor
                height="100%"
                language={getLanguageFromFilename(activeArtifact.filename)}
                theme="vs-dark"
                value={activeArtifact.content}
                options={{
                  readOnly: true,
                  fontSize: config.theme.font.size,
                  minimap: { enabled: true, scale: 0.75 },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  padding: { top: 12, bottom: 12 }
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}