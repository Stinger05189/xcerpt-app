// src/components/layout/Sidebar.tsx
import { useWorkspaceStore } from '../../store/workspaceStore';
import { Settings, History, BarChart2 } from 'lucide-react';

export function Sidebar() {
  const { excludes, removeExcludeRule } = useWorkspaceStore();

  return (
    <aside className="w-80 h-full bg-bg-panel border-r border-border-subtle flex flex-col">
      {/* Header */}
      <div className="h-14 flex items-center px-4 border-b border-border-subtle">
        <h1 className="font-semibold tracking-wide text-sm text-text-primary uppercase">Xcerpt</h1>
      </div>

      {/* Tabs (Placeholder styling) */}
      <div className="flex border-b border-border-subtle text-xs font-medium text-text-muted">
        <button className="flex-1 py-3 hover:text-text-primary border-b-2 border-accent text-accent">Rules</button>
        <button className="flex-1 py-3 hover:text-text-primary border-b-2 border-transparent flex items-center justify-center gap-1"><BarChart2 size={14} /> Stats</button>
        <button className="flex-1 py-3 hover:text-text-primary border-b-2 border-transparent flex items-center justify-center gap-1"><History size={14} /> History</button>
      </div>

      {/* Rules Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div>
          <h2 className="text-xs uppercase font-semibold text-text-muted mb-3 flex items-center gap-2">
            <Settings size={14} /> Exclusions
          </h2>
          <ul className="space-y-1">
            {excludes.map((rule) => (
              <li key={rule} className="flex items-center justify-between group px-2 py-1.5 hover:bg-bg-hover rounded-md cursor-default text-sm">
                <span className="truncate">{rule}</span>
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
    </aside>
  );
}