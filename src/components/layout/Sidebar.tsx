// src/components/layout/Sidebar.tsx
import { useState } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { Settings, History, BarChart2, Zap, FileJson, Clock, FolderLock, RefreshCw } from 'lucide-react';

type Tab = 'RULES' | 'STATS' | 'HISTORY';

export function Sidebar() {
  const { 
    excludes, removeExcludeRule, 
    hardBlacklist, removeBlacklistRule, addBlacklistRule,
    pendingBlacklist, removePendingBlacklistRule, commitBlacklist 
  } = useWorkspaceStore();

  const [activeTab, setActiveTab] = useState<Tab>('RULES');
  const [newBlacklist, setNewBlacklist] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);

  const handleAddBlacklist = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newBlacklist.trim()) {
      addBlacklistRule(newBlacklist.trim());
      setNewBlacklist('');
    }
  };

  const handleCommit = async () => {
    setIsCommitting(true);
    await commitBlacklist();
    setIsCommitting(false);
  };

  return (
    <aside className="w-80 h-full bg-bg-panel border-r border-border-subtle flex flex-col">
      <div className="h-14 flex items-center px-4 border-b border-border-subtle shrink-0">
        <h1 className="font-semibold tracking-wide text-sm text-text-primary uppercase opacity-80">Workspace</h1>
      </div>
    
      <div className="flex border-b border-border-subtle text-xs font-medium text-text-muted shrink-0">
        <button onClick={() => setActiveTab('RULES')} className={`flex-1 py-3 transition-colors border-b-2 flex items-center justify-center gap-1.5 ${activeTab === 'RULES' ? 'border-accent text-accent' : 'border-transparent hover:text-text-primary'}`}>
          <Settings size={14} /> Rules
        </button>
        <button onClick={() => setActiveTab('STATS')} className={`flex-1 py-3 transition-colors border-b-2 flex items-center justify-center gap-1.5 ${activeTab === 'STATS' ? 'border-accent text-accent' : 'border-transparent hover:text-text-primary'}`}>
          <BarChart2 size={14} /> Stats
        </button>
        <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 py-3 transition-colors border-b-2 flex items-center justify-center gap-1.5 ${activeTab === 'HISTORY' ? 'border-accent text-accent' : 'border-transparent hover:text-text-primary'}`}>
          <History size={14} /> History
        </button>
      </div>
    
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'RULES' && (
          <div className="space-y-8">
            {/* Hard Blacklist */}
            <div>
              <div className="mb-3">
                <h2 className="text-xs uppercase font-semibold text-text-muted flex items-center gap-2">
                  <FolderLock size={14} /> Scanner Blacklist
                </h2>
                <p className="text-[10px] text-text-muted mt-1 leading-tight">
                  Directories fully ignored by OS scanner to massively improve performance.
                </p>
              </div>
              
              <input 
                type="text" 
                value={newBlacklist}
                onChange={(e) => setNewBlacklist(e.target.value)}
                onKeyDown={handleAddBlacklist}
                placeholder="Type folder name and press Enter..."
                className="w-full bg-bg-base border border-border-subtle rounded px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent mb-2"
              />
              
              <ul className="space-y-1 mb-2">
                {pendingBlacklist.map((rule) => (
                  <li key={`pending-${rule}`} className="flex items-center justify-between group px-2 py-1.5 bg-orange-500/10 border border-orange-500/30 border-dashed rounded-md text-sm">
                    <span className="truncate font-mono text-xs text-orange-400">{rule} (Pending)</span>
                    <button 
                      onClick={() => removePendingBlacklistRule(rule)}
                      className="text-text-muted hover:text-orange-400 transition-opacity"
                    >
                      &times;
                    </button>
                  </li>
                ))}
                
                {hardBlacklist.map((rule) => (
                  <li key={`hard-${rule}`} className="flex items-center justify-between group px-2 py-1.5 bg-bg-base border border-border-subtle rounded-md text-sm">
                    <span className="truncate font-mono text-xs text-red-400">{rule}</span>
                    <button 
                      onClick={() => removeBlacklistRule(rule)}
                      className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-opacity"
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
              
              {pendingBlacklist.length > 0 && (
                <button 
                  onClick={handleCommit}
                  disabled={isCommitting}
                  className="w-full flex items-center justify-center gap-2 py-1.5 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/50 rounded text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={12} className={isCommitting ? 'animate-spin' : ''} />
                  {isCommitting ? 'Rescanning Roots...' : 'Apply & Rescan Workspace'}
                </button>
              )}
            </div>

            {/* Visual Exclusions */}
            <div>
              <h2 className="text-xs uppercase font-semibold text-text-muted mb-3 flex items-center gap-2">
                <Settings size={14} /> Tree Exclusions
              </h2>
              <ul className="space-y-1">
                {excludes.map((rule) => (
                  <li key={rule} className="flex items-center justify-between group px-2 py-1.5 hover:bg-bg-hover rounded-md cursor-default text-sm">
                    <span className="truncate font-mono text-xs">{rule}</span>
                    <button 
                      onClick={() => removeExcludeRule(rule)}
                      className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-opacity"
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        
        {/* Mockups */}
        {activeTab === 'STATS' && (
          <div className="space-y-4">
            <h2 className="text-xs uppercase font-semibold text-text-muted mb-3">Live Estimations</h2>
            <div className="bg-bg-base border border-border-subtle rounded-lg p-3 flex flex-col gap-1">
              <span className="text-xs text-text-muted flex items-center gap-1"><Zap size={12}/> Estimated Tokens</span>
              <span className="text-xl font-semibold text-text-primary">124,500</span>
              <span className="text-xs text-accent mt-1">-12,000 via Skips</span>
            </div>
            <div className="bg-bg-base border border-border-subtle rounded-lg p-3 flex flex-col gap-1">
              <span className="text-xs text-text-muted flex items-center gap-1"><FileJson size={12}/> Included Files</span>
              <span className="text-xl font-semibold text-text-primary">42 / 1,204</span>
            </div>
          </div>
        )}
        
        {activeTab === 'HISTORY' && (
          <div className="space-y-4">
            <h2 className="text-xs uppercase font-semibold text-text-muted mb-3">Recent Exports</h2>
            <div className="border-l-2 border-border-subtle pl-3 py-1 space-y-4">
              <div>
                <div className="text-sm font-medium text-text-primary">frontend_auth_payload</div>
                <div className="text-xs text-text-muted flex items-center gap-1 mt-1">
                  <Clock size={10} /> 10 mins ago • 3 Chunks
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}