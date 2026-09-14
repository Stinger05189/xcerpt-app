// src/features/session/components/drawer/ReasoningDrawer.tsx
import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronUp, Lightbulb, BookOpen, Layers } from 'lucide-react';
import type { MarkdownExplanationSection } from '../../types/session';

interface ReasoningDrawerProps {
  explanations: MarkdownExplanationSection[];
  activeActionId: string | null;
  overallIntent: string;
}

export function ReasoningDrawer({ explanations, activeActionId }: ReasoningDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  const associatedSection = activeActionId 
    ? explanations.find(e => e.associatedActionIds.includes(activeActionId))
    : null;

  const currentSection = selectedSectionId
    ? explanations.find(e => e.id === selectedSectionId) || explanations[0]
    : associatedSection || explanations[0];

  const totalSections = explanations.length;

  return (
    <div className="border-b border-border-subtle bg-bg-panel/90 transition-all shrink-0">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="h-9 px-4 flex items-center justify-between cursor-pointer hover:bg-bg-hover text-xs select-none"
      >
        <div className="flex items-center gap-2.5 truncate pr-4">
          <div className="p-1 bg-amber-400/10 text-amber-400 rounded">
            <Lightbulb size={13} />
          </div>

          <span className="font-semibold text-text-primary tracking-wide text-xs flex items-center gap-1.5">
            Architectural Reasoning Trace
          </span>

          <span className="text-[10px] bg-bg-base border border-border-subtle px-2 py-0.5 rounded text-text-muted font-mono flex items-center gap-1">
            <Layers size={10} /> {totalSections} Section{totalSections > 1 ? 's' : ''}
          </span>

          {associatedSection && (
            <span className="text-[10px] bg-accent/10 border border-accent/30 px-2 py-0.5 rounded text-accent font-medium truncate max-w-xs">
              Linked: {associatedSection.title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-text-muted font-mono">
            {isExpanded ? 'Hide Trace' : 'View Markdown Rationale'}
          </span>
          <button className="p-1 text-text-muted hover:text-text-primary transition-colors">
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border-subtle bg-bg-base/90 p-4 max-h-72 flex flex-col gap-3 font-sans text-xs">
          {explanations.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border-subtle shrink-0">
              {explanations.map((sec) => {
                const isSelected = (currentSection?.id === sec.id);
                const isLinked = activeActionId && sec.associatedActionIds.includes(activeActionId);

                let badgeKind = 'Section';
                if (sec.kind === 'preamble') badgeKind = 'Preamble';
                else if (sec.kind === 'epilogue') badgeKind = 'Epilogue';
                else if (sec.kind === 'interstitial') badgeKind = 'File Note';

                return (
                  <button
                    key={sec.id}
                    onClick={() => setSelectedSectionId(sec.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-accent/20 text-accent border-accent/40 shadow-sm'
                        : isLinked
                        ? 'bg-bg-panel text-text-primary border-accent/30'
                        : 'bg-bg-panel text-text-muted border-border-subtle hover:text-text-primary hover:bg-bg-hover'
                    }`}
                  >
                    <BookOpen size={11} />
                    <span>[{badgeKind}] {sec.title}</span>
                    {isLinked && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex-1 overflow-y-auto pr-2 prose prose-invert prose-xs max-w-none prose-pre:bg-bg-panel prose-pre:border prose-pre:border-border-subtle">
            {currentSection ? (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-xs font-semibold text-accent m-0">{currentSection.title}</h4>
                  {currentSection.kind && (
                    <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-accent/15 text-accent font-mono">
                      {currentSection.kind}
                    </span>
                  )}
                </div>
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const isInline = !className && !String(children).includes('\n');
                      if (isInline) {
                        return (
                          <code className="bg-bg-hover text-accent font-mono text-[10px] px-1 py-0.2 rounded border border-border-subtle" {...props}>
                            {children}
                          </code>
                        );
                      }
                      return (
                        <pre className="p-3 bg-bg-panel rounded-lg border border-border-subtle font-mono text-[11px] overflow-x-auto text-text-primary leading-normal">
                          <code>{children}</code>
                        </pre>
                      );
                    }
                  }}
                >
                  {currentSection.content}
                </Markdown>
              </div>
            ) : (
              <div className="text-text-muted italic">No specific architectural rationale captured.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}