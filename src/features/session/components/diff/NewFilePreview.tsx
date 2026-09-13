// src/features/session/components/diff/NewFilePreview.tsx
import { useRef, useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useAppStore } from '../../../../store/appStore';
import { getLanguageFromFilename } from './languageHelper';

interface NewFilePreviewProps {
  workingContent: string;
  filename: string;
  actionId: string;
  onChangeContent: (val: string) => void;
}

export function NewFilePreview({ 
  workingContent, 
  filename, 
  actionId,
  onChangeContent
}: NewFilePreviewProps) {
  const config = useAppStore(s => s.config);
  const language = getLanguageFromFilename(filename);

  const isProgrammaticUpdateRef = useRef(false);
  const actionIdRef = useRef(actionId);

  useEffect(() => {
    actionIdRef.current = actionId;
  }, [actionId]);

  const handleMount: OnMount = (editor, monaco) => {
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, language);
    }

    editor.onDidChangeModelContent(() => {
      if (isProgrammaticUpdateRef.current) return;
      if (actionIdRef.current === actionId) {
        onChangeContent(editor.getValue());
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-bg-base overflow-hidden">
      <Editor
        height="100%"
        language={language}
        theme="vs-dark"
        value={workingContent}
        onMount={handleMount}
        options={{
          readOnly: false,
          fontSize: config.theme.font.size,
          minimap: { enabled: true, scale: 0.75 },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          lineNumbersMinChars: 3,
          padding: { top: 12, bottom: 12 }
        }}
      />
    </div>
  );
}