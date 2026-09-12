// src/features/session/components/diff/NewFilePreview.tsx
import Editor from '@monaco-editor/react';
import { useAppStore } from '../../../../store/appStore';
import { getLanguageFromFilename } from './languageHelper';
import { Plus, Check } from 'lucide-react';

interface NewFilePreviewProps {
  content: string;
  filename: string;
  onAccept: () => void;
  isApplying?: boolean;
}

export function NewFilePreview({ content, filename, onAccept, isApplying }: NewFilePreviewProps) {
  const config = useAppStore(s => s.config);
  const language = getLanguageFromFilename(filename);
  const lines = content.split('\n').length;
  const sizeKb = (new Blob([content]).size / 1024).toFixed(1);

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-base overflow-hidden">
      <div className="bg-green-500/10 border-b border-green-500/20 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/20 text-green-400 rounded-lg">
            <Plus size={16} />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-green-300 flex items-center gap-2">
              New File Allocation
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                {language.toUpperCase()}
              </span>
            </h3>
            <p className="text-[11px] text-text-muted">
              This file does not currently exist on disk. Accepting will create and write the full source code.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right text-[11px] font-mono text-text-muted">
            <div>{lines} Lines</div>
            <div>{sizeKb} KB</div>
          </div>
          <button
            onClick={onAccept}
            disabled={isApplying}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-semibold shadow-md transition-all disabled:opacity-40"
          >
            <Check size={14} /> Create File on Disk
          </button>
        </div>
      </div>

      <div className="flex-1 relative">
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          value={content}
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
    </div>
  );
}