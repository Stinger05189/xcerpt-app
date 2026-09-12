// src/features/session/components/diff/SessionDiffEditor.tsx
import { DiffEditor } from '@monaco-editor/react';
import { useAppStore } from '../../../../store/appStore';
import { getLanguageFromFilename } from './languageHelper';
import { AlertCircle, Edit3 } from 'lucide-react';

interface SessionDiffEditorProps {
  originalContent: string | null;
  proposedContent: string;
  filename: string;
  renderSideBySide?: boolean;
  hasSkipBlocks?: boolean;
  skipBlockCount?: number;
}

export function SessionDiffEditor({
  originalContent,
  proposedContent,
  filename,
  renderSideBySide = true,
  hasSkipBlocks = false,
  skipBlockCount = 0
}: SessionDiffEditorProps) {
  const config = useAppStore(s => s.config);
  const language = getLanguageFromFilename(filename);

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-base overflow-hidden relative">
      {hasSkipBlocks && (
        <div className="bg-amber-400/10 border-b border-amber-400/20 px-4 py-1.5 flex items-center justify-between text-xs text-amber-300 shrink-0">
          <span className="flex items-center gap-1.5 font-medium">
            <Edit3 size={13} className="text-amber-400" />
            Contains {skipBlockCount} Skip Block{skipBlockCount > 1 ? 's' : ''} (Unchanged sections omitted by LLM)
          </span>
          <span className="text-[10px] opacity-80 font-mono">Skip markers preserved transparently</span>
        </div>
      )}

      <div className="flex-1 relative">
        <DiffEditor
          height="100%"
          language={language}
          theme="vs-dark"
          original={originalContent ?? ''}
          modified={proposedContent}
          options={{
            readOnly: true,
            originalEditable: false,
            renderSideBySide,
            fontSize: config.theme.font.size,
            minimap: { enabled: true, scale: 0.75 },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbersMinChars: 3,
            padding: { top: 12, bottom: 12 },
            diffWordWrap: 'on',
            enableSplitViewResizing: true
          }}
          loading={
            <div className="flex items-center justify-center h-full text-text-muted gap-2 text-xs">
              <AlertCircle size={14} className="animate-spin text-accent" /> Initializing Monaco Diff Engine...
            </div>
          }
        />
      </div>
    </div>
  );
}