// src/components/layout/ToastContainer.tsx
import { useEffect, useState } from 'react';
import { useHistoryStore } from '../../store/historyStore';
import { Undo2, Redo2 } from 'lucide-react';

export function ToastContainer() {
  const lastAction = useHistoryStore(s => s.lastAction);
  const undo = useHistoryStore(s => s.undo);
  const redo = useHistoryStore(s => s.redo);

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!lastAction) return;
    
    // Defer the state update to the next macro-task to bypass React strict-mode cascading render warnings
    const showTimer = setTimeout(() => setVisible(true), 0);
    const hideTimer = setTimeout(() => setVisible(false), 4000);
    
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [lastAction]);

  if (!lastAction || !visible) return null;

  const isUndo = lastAction.type === 'undo';
  const isRedo = lastAction.type === 'redo';

  // Format the display text contextually
  let actionText = `Applied: ${lastAction.label}`;
  if (isUndo) actionText = `Undid: ${lastAction.label}`;
  if (isRedo) actionText = `Redid: ${lastAction.label}`;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto">
      <div className="bg-bg-panel border border-accent/30 shadow-2xl shadow-accent/5 rounded-lg flex items-center gap-3 py-2.5 px-4 max-w-sm">
        
        {/* State Icon */}
        <div className="text-accent shrink-0">
          {isUndo ? <Undo2 size={16} /> : <Redo2 size={16} />}
        </div>
        
        {/* Action Description */}
        <div className="flex-1 truncate text-sm font-medium text-text-primary mr-2" title={actionText}>
          {actionText}
        </div>
        
        {/* Quick Recovery Button */}
        <div className="flex items-center border-l border-border-subtle pl-3 shrink-0">
          {isUndo ? (
            <button 
              onClick={redo}
              className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-accent transition-colors"
            >
              <Redo2 size={12} /> Redo
            </button>
          ) : (
            <button 
              onClick={undo}
              className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-accent transition-colors"
            >
              <Undo2 size={12} /> Undo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}