// src/components/editor/ContextEditor.tsx
import { useEffect, useState, useRef, useMemo } from 'react';
import Editor, { useMonaco, type OnMount } from '@monaco-editor/react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { FileCode2 } from 'lucide-react';

// Extract the exact type of the Monaco Editor instance
type MonacoEditor = Parameters<OnMount>[0];
type EditorDecorationsCollection = ReturnType<MonacoEditor['createDecorationsCollection']>;

interface ContextEditorProps {
  rootPath: string;
  relativePath: string;
}

export function ContextEditor({ rootPath, relativePath }: ContextEditorProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const editorRef = useRef<MonacoEditor | null>(null);
  const decorationsCollectionRef = useRef<EditorDecorationsCollection | null>(null);
  const monaco = useMonaco();

  const { addCompression, compressions } = useWorkspaceStore();

  // Memoize the array to prevent useEffect dependency infinite loops
  const rawCompressions = compressions[relativePath];
  const fileCompressions = useMemo(() => rawCompressions || [], [rawCompressions]);

  // Load File Content
  useEffect(() => {
    let isMounted = true;
    
    const loadFile = async () => {
      setLoading(true);
      const absolutePath = `${rootPath}/${relativePath}`.replace(/\\/g, '/');
      
      try {
        const text = await window.api.readFile(absolutePath);
        if (isMounted) {
          setContent(text);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          setContent(`Error reading file:\n${errorMessage}`);
          setLoading(false);
        }
      }
    };
    
    loadFile();
    
    return () => { isMounted = false; };
  }, [rootPath, relativePath]);

  // Setup Monaco Context Menu Action
  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
    
    editor.addAction({
      id: 'xcerpt-skip-block',
      label: 'Skip Block (Context Compression)',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: (ed: MonacoEditor) => {
        const selection = ed.getSelection();
        if (selection && !selection.isEmpty()) {
          addCompression(relativePath, {
            startLine: selection.startLineNumber,
            endLine: selection.endLineNumber,
            type: 'SKIP'
          });
          // Clear selection after skip
          ed.setSelection({ startLineNumber: 0, startColumn: 0, endLineNumber: 0, endColumn: 0 });
        }
      }
    });
  };

  // Apply Visual Decorations when compressions change
  useEffect(() => {
    if (!editorRef.current || !monaco) return;
    
    const editor = editorRef.current;
    
    const newDecorations = fileCompressions.map(comp => ({
      range: new monaco.Range(comp.startLine, 1, comp.endLine, 1),
      options: {
        isWholeLine: true,
        className: 'monaco-skip-block-line', // Changed from Tailwind
        glyphMarginClassName: 'monaco-skip-block-margin', // Changed from Tailwind
        hoverMessage: { value: 'This block will be skipped during export.' }
      }
    }));
    
    // Instead of editor.deltaDecorations, we use the decorations collection:
    if (!decorationsCollectionRef.current) {
      // Initialize the collection the first time
      decorationsCollectionRef.current = editor.createDecorationsCollection(newDecorations);
    } else {
      // Update the existing collection
      decorationsCollectionRef.current.set(newDecorations);
    }

  }, [fileCompressions, monaco]);

  const fileName = relativePath.split(/[/\\]/).pop();

  return (
    <div className="h-full flex flex-col">
      <div className="h-10 bg-bg-hover flex items-center px-4 border-b border-border-subtle shrink-0 gap-2">
        <FileCode2 size={16} className="text-accent" />
        <span className="text-sm font-medium">{fileName}</span>
        {fileCompressions.length > 0 && (
          <span className="ml-auto text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">
            {fileCompressions.length} Skips Applied
          </span>
        )}
      </div>
      
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg-panel z-10">
            <span className="text-text-muted animate-pulse">Loading {fileName}...</span>
          </div>
        )}
        <Editor
          height="100%"
          defaultLanguage="typescript"
          theme="vs-dark"
          value={content}
          onMount={handleEditorMount}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            glyphMargin: true,
            lineNumbersMinChars: 4,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 16 }
          }}
        />
      </div>
    </div>
  );
}