// src/components/layout/MainStage.tsx
import { useWorkspaceStore } from '../../store/workspaceStore';
import { FileTree } from '../tree/FileTree';
import { ContextEditor } from '../editor/ContextEditor';
import { ExportStage } from '../export/ExportStage';
import { Plus, FolderOpen, Send } from 'lucide-react';

export function MainStage() {
  const { rootPaths, activeTab, activeFile, isExportStaging, setExportStaging, addRootPath, setActiveTab, rawTrees } = useWorkspaceStore();

  const handleAddRoot = async () => {
    const dir = await window.api.selectDirectory();
    if (dir) addRootPath(dir);
  };

  const activeTree = activeTab ? rawTrees[activeTab] : null;

  return (
    <main className="flex-1 h-full flex flex-col min-w-0">
      {/* Top Tabs */}
      <div className="h-14 flex bg-bg-panel border-b border-border-subtle items-end px-2 gap-1 overflow-x-auto shrink-0 justify-between">
        <div className="flex items-end gap-1">
          {rootPaths.map((path) => (
            <button
              key={path}
              onClick={() => setActiveTab(path)}
              className={`px-4 py-2 text-sm rounded-t-md border border-b-0 max-w-50 truncate transition-colors
                ${activeTab === path 
                  ? 'bg-bg-base border-border-subtle text-text-primary' 
                  : 'bg-transparent border-transparent text-text-muted hover:bg-bg-hover'}`}
              title={path}
            >
              {path.split(/[/\\]/).pop()}
            </button>
          ))}
          <button 
            onClick={handleAddRoot}
            className="px-3 py-2 text-text-muted hover:text-text-primary mb-1 ml-1 rounded-md hover:bg-bg-hover transition-colors flex items-center gap-1 text-sm font-medium"
          >
            <Plus size={16} /> Add Root
          </button>
        </div>
        
        {/* Stage Export Button */}
        {rootPaths.length > 0 && (
          <button 
            onClick={() => setExportStaging(true)}
            className={`px-4 py-1.5 mb-2 mr-2 rounded text-sm font-medium flex items-center gap-2 transition-colors
              ${isExportStaging ? 'bg-accent text-white' : 'bg-bg-hover text-text-primary hover:bg-border-subtle'}`}
          >
            <Send size={14} /> Stage Export
          </button>
        )}
      </div>
    
      {/* Split Stage Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Tree */}
        {activeTree ? (
          <div className="w-1/3 min-w-62.5 max-w-100 h-full overflow-y-auto p-4 border-r border-border-subtle bg-bg-base shrink-0">
            <FileTree node={activeTree} rootPath={activeTab!} relativePath="" />
          </div>
        ) : (
          <div className="flex-1 h-full flex flex-col items-center justify-center text-text-muted">
            <FolderOpen size={48} className="mb-4 opacity-50" />
            <p>No workspace loaded.</p>
          </div>
        )}
        
        {/* Right Pane: Editor or Export Stage */}
        {activeTree && (
          <div className="flex-1 h-full bg-bg-panel overflow-hidden relative">
            {isExportStaging ? (
              <ExportStage />
            ) : activeFile ? (
              <ContextEditor key={activeFile} rootPath={activeTab!} relativePath={activeFile} />
            ) : (
              <div className="flex h-full items-center justify-center text-text-muted text-sm">
                Select a file to compress context.
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}