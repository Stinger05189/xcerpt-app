// src/features/session/components/diff/SessionDiffEditor.tsx
import { useRef, useEffect } from 'react';
import { DiffEditor, type DiffOnMount } from '@monaco-editor/react';
import { useAppStore } from '../../../../store/appStore';
import { getLanguageFromFilename } from './languageHelper';
import { AlertCircle } from 'lucide-react';

interface SessionDiffEditorProps {
  originalContent: string | null;
  proposedContent: string;
  workingContent: string;
  filename: string;
  actionId: string;
  renderSideBySide?: boolean;
  onChangeWorkingContent: (val: string) => void;
}

export function SessionDiffEditor({
  originalContent,
  workingContent,
  filename,
  actionId,
  renderSideBySide = true,
  onChangeWorkingContent
}: SessionDiffEditorProps) {
  const config = useAppStore(s => s.config);
  const language = getLanguageFromFilename(filename);

  const isProgrammaticUpdateRef = useRef(false);
  const actionIdRef = useRef(actionId);

  useEffect(() => {
    actionIdRef.current = actionId;
  }, [actionId]);

  const handleDiffMount: DiffOnMount = (editor, monaco) => {
    const originalEditor = editor.getOriginalEditor();
    const modifiedEditor = editor.getModifiedEditor();

    const origModel = originalEditor.getModel();
    const modModel = modifiedEditor.getModel();

    // Explicitly bind syntax language to models
    if (origModel) {
      monaco.editor.setModelLanguage(origModel, language);
    }
    if (modModel) {
      monaco.editor.setModelLanguage(modModel, language);
    }

    modifiedEditor.onDidChangeModelContent(() => {
      if (isProgrammaticUpdateRef.current) return;
      // Guarantee edits are only credited to this specific mounted action
      if (actionIdRef.current === actionId) {
        const currentVal = modifiedEditor.getValue();
        onChangeWorkingContent(currentVal);
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-base overflow-hidden relative">
      <DiffEditor
        height="100%"
        language={language}
        theme="vs-dark"
        original={originalContent ?? ''}
        modified={workingContent}
        onMount={handleDiffMount}
        options={{
          readOnly: false,
          originalEditable: false,
          renderSideBySide,
          fontSize: config.theme.font.size,
          minimap: { enabled: true, scale: 0.75 },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          lineNumbersMinChars: 3,
          padding: { top: 12, bottom: 12 },
          diffWordWrap: 'on',
          enableSplitViewResizing: true,
          renderOverviewRuler: true
        }}
        loading={
          <div className="flex items-center justify-center h-full text-text-muted gap-2 text-xs">
            <AlertCircle size={14} className="animate-spin text-accent" /> Initializing Monaco Diff Engine...
          </div>
        }
      />
    </div>
  );
}