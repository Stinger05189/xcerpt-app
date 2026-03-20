// src/components/layout/MainStage.tsx
import { useWorkspaceStore } from '../../store/workspaceStore';
import { FileTree } from '../tree/FileTree';
import { Plus, FolderOpen } from 'lucide-react';

export function MainStage() {
  const { rootPaths, activeTab, addRootPath, setActiveTab, rawTrees } = useWorkspaceStore();

  const handleAddRoot = async () => {
    const dir = await window.api.selectDirectory();
    if (dir) {
      await addRootPath(dir);
    }
  };

  const activeTree = activeTab ? rawTrees[activeTab] : null;

  return (
    <main className="flex-1 h-full flex flex-col">
      {/* Top Tabs */}
      <div className="h-14 flex bg-bg-panel border-b border-border-subtle items-end px-2 gap-1 overflow-x-auto">
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

      {/* Stage Content */}
      <div className="flex-1 overflow-hidden relative">
        {activeTree ? (
          <div className="h-full overflow-y-auto p-4">
            <FileTree node={activeTree} rootPath={activeTab!} relativePath="" />
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-text-muted">
            <FolderOpen size={48} className="mb-4 opacity-50" />
            <p>No workspace loaded.</p>
            <p className="text-sm mt-2">Click "Add Root" to select a project directory.</p>
          </div>
        )}
      </div>
    </main>
  );
}