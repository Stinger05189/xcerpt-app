// src/components/layout/WorkspaceBrowser.tsx
import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import type { WorkspaceMetadata } from '../../types/ipc';
import { Search, Folder, Clock, FileJson, X, Edit2, Trash2, Check, ExternalLink, Plus, Database, Zap } from 'lucide-react';

// Relative time formatter moved outside to satisfy React Strict Mode purity rules
const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export function WorkspaceBrowser() {
  const { setBrowserOpen, addWorkspaceTab, setActiveWorkspace, removeWorkspaceTab } = useAppStore();
  const [metadata, setMetadata] = useState<WorkspaceMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'exports'>('recent');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Data Loading
  useEffect(() => {
    const loadMetadata = async () => {
      setLoading(true);
      const data = await window.api.getWorkspaceMetadata();
      setMetadata(data);
      setLoading(false);
    };
    loadMetadata();
  }, []);

  // Global Escape Key Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBrowserOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setBrowserOpen]);

  const handleOpen = (meta: WorkspaceMetadata) => {
    const title = meta.name || meta.rootPaths[0]?.split(/[/\\]/).pop() || "Untitled Workspace";
    addWorkspaceTab(meta.id, title);
    setActiveWorkspace(meta.id);
    setBrowserOpen(false);
  };

  const handleCreateNew = () => {
    const newId = crypto.randomUUID();
    addWorkspaceTab(newId, "Untitled Workspace");
    setActiveWorkspace(newId);
    setBrowserOpen(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this workspace history?')) {
      await window.api.deleteWorkspace(id);
      removeWorkspaceTab(id); // Safely remove if it happens to be open
      setMetadata(prev => prev.filter(m => m.id !== id));
    }
  };

  const startEdit = (e: React.MouseEvent, meta: WorkspaceMetadata) => {
    e.stopPropagation();
    setEditingId(meta.id);
    setEditValue(meta.name || '');
  };

  const saveEdit = async (e: React.MouseEvent | React.KeyboardEvent, id: string) => {
    e.stopPropagation();
    const newName = editValue.trim() || "Untitled Workspace";
    await window.api.renameWorkspace(id, newName);
    
    // Update local list & global tab if open
    setMetadata(prev => prev.map(m => m.id === id ? { ...m, name: newName, updatedAt: new Date().toISOString() } : m));
    useAppStore.getState().updateTabTitle(id, newName);
    setEditingId(null);
  };

  const filteredMetadata = useMemo(() => {
    let result = metadata;
    
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      result = result.filter(m => {
        const nameMatch = (m.name || 'untitled workspace').toLowerCase().includes(term);
        const pathMatch = m.rootPaths.some(p => p.toLowerCase().includes(term));
        return nameMatch || pathMatch;
      });
    }
    
    return result.sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'exports') {
        const aExports = (a.stats?.totalExports || 0) + (a.stats?.ephemeralExports || 0);
        const bExports = (b.stats?.totalExports || 0) + (b.stats?.ephemeralExports || 0);
        return bExports - aExports;
      }
      return 0;
    });
  }, [metadata, searchQuery, sortBy]);

  return (
    <div className="absolute inset-0 z-50 bg-bg-base/80 backdrop-blur flex flex-col items-center pt-16 pb-8 px-8 animate-in fade-in duration-200 overflow-hidden">
      
      {/* Background Brand SVG */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center overflow-hidden">
        <svg width="120%" height="120%" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          <circle cx="500" cy="500" r="300" fill="none" stroke="var(--theme-accent)" strokeWidth="2" strokeDasharray="10 20" />
          <circle cx="500" cy="500" r="450" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="5 10" />
          <path d="M 200 200 L 800 800 M 200 800 L 800 200" stroke="var(--theme-accent)" strokeWidth="2" strokeDasharray="20 40" />
        </svg>
      </div>
    
      {/* Prominent Absolute Close Button */}
      <button 
        onClick={() => setBrowserOpen(false)}
        className="absolute top-8 right-8 p-3 bg-bg-panel hover:bg-bg-hover hover:text-red-400 border border-border-subtle hover:border-red-400/50 rounded-full text-text-muted transition-all shadow-lg"
        title="Close Browser (Esc)"
      >
        <X size={24} />
      </button>
    
      {/* Header & Search */}
      <div className="w-full max-w-6xl flex items-center justify-between mb-8 shrink-0 relative z-10">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary tracking-tight mb-2 flex items-center gap-3">
            <img src="./icon.svg" className="w-8 h-8 opacity-80" alt="logo" /> Workspace Browser
          </h1>
          <p className="text-text-muted text-sm">Access and manage your previously saved context environments.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent/90 transition-colors shadow-sm"
          >
            <Plus size={16} /> New Workspace
          </button>
          
          <div className="flex bg-bg-panel border border-border-subtle rounded-full overflow-hidden p-0.5 text-xs font-medium shadow-sm">
            <button 
              onClick={() => setSortBy('recent')} 
              className={`px-4 py-1.5 rounded-full transition-colors ${sortBy === 'recent' ? 'bg-bg-hover text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
            >
              Recent
            </button>
            <button 
              onClick={() => setSortBy('name')} 
              className={`px-4 py-1.5 rounded-full transition-colors ${sortBy === 'name' ? 'bg-bg-hover text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
            >
              Name
            </button>
            <button 
              onClick={() => setSortBy('exports')} 
              className={`px-4 py-1.5 rounded-full transition-colors ${sortBy === 'exports' ? 'bg-bg-hover text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'}`}
            >
              Most Exports
            </button>
          </div>
        
          <div className="relative w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              autoFocus
              type="text" 
              placeholder="Search by name or root path..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-bg-panel border border-border-subtle rounded-full pl-9 pr-4 py-2 text-sm text-text-primary outline-none focus:border-accent transition-colors shadow-sm"
            />
          </div>
        </div>
      </div>
    
      {/* Grid */}
      <div className="w-full max-w-6xl flex-1 overflow-y-auto pr-2 pb-4 relative z-10">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-text-muted animate-pulse">Scanning Disk...</div>
        ) : filteredMetadata.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-text-muted border border-dashed border-border-subtle rounded-xl bg-bg-panel/50">
            <Folder size={48} className="mb-4 opacity-30" />
            <p>No workspaces found matching "{searchQuery}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredMetadata.map((meta) => {
              const displayName = meta.name || meta.rootPaths[0]?.split(/[/\\]/).pop() || "Untitled Workspace";
              const isEditing = editingId === meta.id;
              
              const totalExp = meta.stats?.totalExports || 0;
              const ephExp = meta.stats?.ephemeralExports || 0;
            
              return (
                <div 
                  key={meta.id}
                  onClick={() => !isEditing && handleOpen(meta)}
                  className="group relative bg-bg-panel border border-border-subtle rounded-xl p-5 hover:border-accent/50 hover:shadow-lg transition-all cursor-pointer flex flex-col h-56"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-3">
                    {isEditing ? (
                      <div className="flex items-center gap-2 w-full pr-2" onClick={e => e.stopPropagation()}>
                        <input 
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveEdit(e, meta.id)}
                          className="flex-1 bg-bg-base border border-accent rounded px-2 py-1 text-sm text-text-primary outline-none"
                        />
                        <button onClick={(e) => saveEdit(e, meta.id)} className="text-green-400 p-1 hover:bg-green-400/10 rounded">
                          <Check size={16} />
                        </button>
                      </div>
                    ) : (
                      <h2 className="text-base font-semibold text-text-primary truncate pr-16" title={displayName}>
                        {displayName}
                      </h2>
                    )}
                    
                    {/* Hover Actions */}
                    {!isEditing && (
                      <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => startEdit(e, meta)} className="p-1.5 text-text-muted hover:text-accent hover:bg-bg-hover rounded transition-colors" title="Rename">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={(e) => handleDelete(e, meta.id)} className="p-1.5 text-text-muted hover:text-red-400 hover:bg-bg-hover rounded transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                
                  {/* Card Body: Paths */}
                  <div className="flex-1 overflow-hidden mt-1">
                    <div className="text-xs uppercase tracking-wider text-text-muted/60 font-semibold mb-2">Root Paths</div>
                    {meta.rootPaths.length > 0 ? (
                      <ul className="space-y-1.5">
                        {meta.rootPaths.slice(0, 2).map((path, idx) => (
                          <li key={idx} className="text-xs font-mono text-text-muted truncate flex items-center gap-2">
                            <Folder size={12} className="shrink-0 opacity-50" />
                            <span className="truncate" title={path}>{path}</span>
                          </li>
                        ))}
                        {meta.rootPaths.length > 2 && (
                          <li className="text-[10px] text-text-muted italic px-5">+{meta.rootPaths.length - 2} more paths</li>
                        )}
                      </ul>
                    ) : (
                      <div className="text-xs text-text-muted italic opacity-50">Empty Workspace</div>
                    )}
                  </div>
                  
                  {/* Card Metrics Badge */}
                  <div className="grid grid-cols-2 gap-2 mt-2 mb-3">
                    <div className="bg-bg-base border border-border-subtle rounded-lg px-3 py-2 flex flex-col items-start justify-center">
                      <span className="text-[9px] uppercase tracking-widest text-text-muted flex items-center gap-1.5"><Database size={10}/> Full Exports</span>
                      <span className="font-semibold text-text-primary text-sm mt-0.5">{totalExp}</span>
                    </div>
                    <div className="bg-bg-base border border-border-subtle rounded-lg px-3 py-2 flex flex-col items-start justify-center">
                      <span className="text-[9px] uppercase tracking-widest text-text-muted flex items-center gap-1.5"><Zap size={10}/> Eph. Exports</span>
                      <span className="font-semibold text-accent text-sm mt-0.5">{ephExp}</span>
                    </div>
                  </div>
                
                  {/* Card Footer: Meta Stats */}
                  <div className="flex items-center justify-between border-t border-border-subtle pt-3 mt-auto shrink-0">
                    <div className="flex items-center gap-4 text-xs text-text-muted">
                      <span className="flex items-center gap-1.5" title="Last Modified">
                        <Clock size={12} /> {timeAgo(meta.updatedAt)}
                      </span>
                      {meta.totalIncludedFiles > 0 && (
                        <span className="flex items-center gap-1.5" title="Included Files">
                          <FileJson size={12} /> {meta.totalIncludedFiles}
                        </span>
                      )}
                    </div>
                    <ExternalLink size={14} className="text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}