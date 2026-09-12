// src/features/session/components/drawer/ReasoningDrawer.tsx
import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import type { MarkdownExplanationSection } from '../../types/session';

interface ReasoningDrawerProps {
  explanations: MarkdownExplanationSection[];
  activeActionId: string | null;
  overallIntent: string;
}

export function ReasoningDrawer({ explanations, activeActionId, overallIntent }: ReasoningDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const associatedExplanations = activeActionId 
    ? explanations.filter(e => e.associatedActionIds.includes(activeActionId))
    : [];

  const displaySections = associatedExplanations.length > 0 ? associatedExplanations : explanations;

  return (
    <div className="border-b border-border-subtle bg-bg-panel/90 transition-all shrink-0">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="h-9 px-4 flex items-center justify-between cursor-pointer hover:bg-bg-hover text-xs select-none"
      >
        <div className="flex items-center gap-2 truncate pr-4">
          <Lightbulb size={14} className="text-amber-400 shrink-0" />
          <span className="font-semibold text-text-primary uppercase tracking-wide text-[10px]">Architectural Intent:</span>
          <span className="text-text-muted truncate text-xs">{overallIntent}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {associatedExplanations.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-medium">
              {associatedExplanations.length} Section{associatedExplanations.length > 1 ? 's' : ''} Linked
            </span>
          )}
          <button className="p-1 text-text-muted hover:text-text-primary transition-colors">
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 max-h-60 overflow-y-auto border-t border-border-subtle bg-bg-base/70 font-sans text-xs text-text-primary leading-relaxed">
          {displaySections.length > 0 ? (
            <div className="space-y-4">
              {displaySections.map(sec => (
                <div key={sec.id} className="prose prose-invert prose-xs max-w-none prose-pre:bg-bg-panel prose-pre:border prose-pre:border-border-subtle">
                  <h4 className="text-xs font-semibold text-accent mb-1">{sec.title}</h4>
                  <Markdown remarkPlugins={[remarkGfm]}>{sec.content}</Markdown>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-text-muted italic">No specific architectural rationale captured for this file.</div>
          )}
        </div>
      )}
    </div>
  );
}