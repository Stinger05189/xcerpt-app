// src/components/editor/ContextEditor.tsx
import { useEffect, useState, useRef, useMemo } from 'react';
import Editor, { useMonaco, type OnMount } from '@monaco-editor/react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { FileCode2, Undo2, Trash2, Eye, Code2 } from 'lucide-react';

type MonacoEditor = Parameters<OnMount>[0];
type EditorDecorationsCollection = ReturnType<MonacoEditor['createDecorationsCollection']>;

interface ContextEditorProps {
  rootPath: string;
  relativePath: string;
}

export function ContextEditor({ rootPath, relativePath }: ContextEditorProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const editorRef = useRef<MonacoEditor | null>(null);
  const decorationsCollectionRef = useRef<EditorDecorationsCollection | null>(null);
  const monaco = useMonaco();

  const { 
    addCompressions, 
    removeCompression, 
    clearCompressions, 
    undoLastCompression, 
    compressions, 
    compressionHistory
  } = useWorkspaceStore();

  const rawCompressions = compressions[relativePath];
  const fileCompressions = useMemo(() => rawCompressions || [], [rawCompressions]);
  const hasHistory = (compressionHistory[relativePath]?.length || 0) > 0;

  // Load File, Auto-Heal Drift, and Watch for Live External Edits
  useEffect(() => {
    let isMounted = true;
    const absolutePath = `${rootPath}/${relativePath}`.replace(/\\/g, '/');
    
    const loadFile = async () => {
      setLoading(true);
      try {
        const text = await window.api.readFile(absolutePath);
        if (!isMounted) return;
        
        setContent(text);
        setLoading(false);
        
        // Use getState() to avoid stale closures when this is triggered by the external watcher
        const currentStore = useWorkspaceStore.getState();
        const currentCompressions = currentStore.compressions[relativePath] || [];
        
        // Drift Reconciliation: Check if external edits shifted our skip markers
        if (currentCompressions.length > 0) {
          const lines = text.split('\n');
          let needsUpdate = false;
          
          const healedCompressions = currentCompressions.map(comp => {
            const expectedLine = lines[comp.startLine - 1];
            if (expectedLine === comp.signature) return comp; // Perfect match
          
            // Drift detected, search +/- 50 lines for the exact signature
            let foundOffset = 0;
            for (let i = 1; i <= 50; i++) {
              if (lines[comp.startLine - 1 + i] === comp.signature) { foundOffset = i; break; }
              if (lines[comp.startLine - 1 - i] === comp.signature) { foundOffset = -i; break; }
            }
          
            if (foundOffset !== 0) {
              needsUpdate = true;
              return { 
                ...comp, 
                startLine: comp.startLine + foundOffset, 
                endLine: comp.endLine + foundOffset 
              };
            }
            return comp; // Signature lost (block was likely deleted entirely)
          });
          
          if (needsUpdate) {
            currentStore.setCompressions(relativePath, healedCompressions);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setContent(`Error reading file:\n${err instanceof Error ? err.message : String(err)}`);
          setLoading(false);
        }
      }
    };
    
    // 1. Initial Load
    loadFile();
    
    // 2. Attach live watcher for this specific file
    const cleanupWatcher = window.api.onFileChange((event, changedPath) => {
      const normalizedChanged = changedPath.replace(/\\/g, '/');
      if (['change', 'add'].includes(event) && normalizedChanged === absolutePath) {
        loadFile();
      }
    });

    return () => { 
      isMounted = false; 
      cleanupWatcher();
    };
  }, [rootPath, relativePath]);

  // Compute the compressed text for preview mode
  const previewContent = useMemo(() => {
    if (!isPreviewMode) return content;
    const lines = content.split('\n');
    const sortedComps = [...fileCompressions].sort((a, b) => b.startLine - a.startLine);
    
    const resultLines = [...lines];
    sortedComps.forEach(comp => {
      const skipCount = comp.endLine - comp.startLine + 1;
      const marker = `// ... [Skipped ${skipCount} lines] ...`;
      resultLines.splice(comp.startLine - 1, skipCount, marker);
    });
    
    return resultLines.join('\n');
  }, [content, fileCompressions, isPreviewMode]);

  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;
    
    // Turn off Typescript Diagnostics (No Red Squiggles)
    monacoInstance.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });
    
    editor.addAction({
      id: 'xcerpt-skip-block',
      label: 'Skip Block (Context Compression)',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Backspace],
      run: (ed: MonacoEditor) => {
        const selections = ed.getSelections();
        const model = ed.getModel();
        if (selections && selections.length > 0 && model) {
          const rules = selections
            .filter(sel => !sel.isEmpty())
            .map(sel => ({
              startLine: sel.startLineNumber,
              endLine: sel.endLineNumber,
              type: 'SKIP' as const,
              signature: model.getLineContent(sel.startLineNumber),
              lineCount: sel.endLineNumber - sel.startLineNumber + 1
            }));
            
          if (rules.length > 0) {
            addCompressions(relativePath, rules);
            ed.setSelection({ startLineNumber: 0, startColumn: 0, endLineNumber: 0, endColumn: 0 });
          }
        }
      }
    });
    
    editor.addAction({
      id: 'xcerpt-unskip-block',
      label: 'Un-Skip Block',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.6,
      run: (ed: MonacoEditor) => {
        const position = ed.getPosition();
        if (position) {
          const target = useWorkspaceStore.getState().compressions[relativePath]?.find(
            c => position.lineNumber >= c.startLine && position.lineNumber <= c.endLine
          );
          if (target) removeCompression(relativePath, target.id);
        }
      }
    });
  };

  // Apply Visual Decorations safely when content and rules are synced
  useEffect(() => {
    if (!editorRef.current || !monaco || isPreviewMode || !content) return;
    const editor = editorRef.current;
    
    // Safety check: ensure Monaco has actually loaded the string content
    if (editor.getModel()?.getValue() !== content) return;
    
    const newDecorations = fileCompressions.map(comp => ({
      range: new monaco.Range(comp.startLine, 1, comp.endLine, 1),
      options: {
        isWholeLine: true,
        className: 'monaco-skip-block-line',
        glyphMarginClassName: 'monaco-skip-block-margin',
      }
    }));
    
    if (!decorationsCollectionRef.current) {
      decorationsCollectionRef.current = editor.createDecorationsCollection(newDecorations);
    } else {
      decorationsCollectionRef.current.set(newDecorations);
    }
    
    return () => {
      if (decorationsCollectionRef.current) decorationsCollectionRef.current.clear();
    };
  }, [fileCompressions, monaco, isPreviewMode, content]);

  const fileName = relativePath.split(/[/\\]/).pop();

  return (
    <div className="h-full flex flex-col">
      <div className="h-10 bg-bg-hover flex items-center px-4 border-b border-border-subtle shrink-0 gap-2">
        <FileCode2 size={16} className="text-accent" />
        <span className="text-sm font-medium">{fileName}</span>
        {fileCompressions.length > 0 && (
          <span className="ml-2 text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">
            {fileCompressions.length} Skips Applied
          </span>
        )}
      </div>
    
      <div className="h-9 bg-bg-panel flex items-center px-4 border-b border-border-subtle shrink-0 gap-3 text-xs text-text-muted">
        <button 
          onClick={() => undoLastCompression(relativePath)}
          disabled={!hasHistory || isPreviewMode}
          className="flex items-center gap-1.5 hover:text-text-primary disabled:opacity-30 disabled:hover:text-text-muted transition-colors"
          title="Undo last skip action"
        >
          <Undo2 size={14} /> Undo Skip
        </button>
        <button 
          onClick={() => clearCompressions(relativePath)}
          disabled={fileCompressions.length === 0 || isPreviewMode}
          className="flex items-center gap-1.5 hover:text-red-400 disabled:opacity-30 disabled:hover:text-text-muted transition-colors"
        >
          <Trash2 size={14} /> Clear All
        </button>
        <div className="w-px h-4 bg-border-subtle mx-1" />
        <button 
          onClick={() => setIsPreviewMode(!isPreviewMode)}
          className={`flex items-center gap-1.5 transition-colors px-2 py-1 rounded ${isPreviewMode ? 'bg-accent/20 text-accent' : 'hover:text-text-primary'}`}
        >
          {isPreviewMode ? <Code2 size={14} /> : <Eye size={14} />}
          {isPreviewMode ? 'Exit Preview' : 'Preview Output'}
        </button>
        <span className="ml-auto opacity-50 text-[10px]">Ctrl/Cmd + Backspace to Skip</span>
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
          value={isPreviewMode ? previewContent : content}
          onMount={handleEditorMount}
          options={{
            readOnly: true, // App operates assuming external edits only
            minimap: { enabled: true, scale: 0.75, renderCharacters: false },
            glyphMargin: !isPreviewMode,
            lineNumbersMinChars: 4,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 16 },
            hover: { enabled: false },
            matchBrackets: 'never'
          }}
        />
      </div>
    </div>
  );
}