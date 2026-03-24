// src/components/layout/SettingsModal.tsx
import { useEffect, useState } from 'react';
import { useAppStore, DEFAULT_CONFIG } from '../../store/appStore';
import { X, Palette, Type, RotateCcw, FileCode, Plus, Trash2 } from 'lucide-react';

export function SettingsModal() {
const { config, updateConfig, setSettingsOpen } = useAppStore();

  // 1. Store both the current local value AND the "previous" global config value
  const [localScale, setLocalScale] = useState(config.theme.scale);
  const [prevGlobalScale, setPrevGlobalScale] = useState(config.theme.scale);

  const [localFontSize, setLocalFontSize] = useState(config.theme.font.size);
  const [prevGlobalFontSize, setPrevGlobalFontSize] = useState(config.theme.font.size);

  const [newExtOriginal, setNewExtOriginal] = useState('');
  const [newExtTarget, setNewExtTarget] = useState('');

  // 2. Update state directly during render if the global config changed externally
  if (config.theme.scale !== prevGlobalScale) {
    setPrevGlobalScale(config.theme.scale);
    setLocalScale(config.theme.scale);
  }

  if (config.theme.font.size !== prevGlobalFontSize) {
    setPrevGlobalFontSize(config.theme.font.size);
    setLocalFontSize(config.theme.font.size);
  }

  // Global Escape Key Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSettingsOpen]);

  const handleColorChange = (key: keyof typeof config.theme.colors, value: string) => {
    updateConfig({
      theme: { ...config.theme, colors: { ...config.theme.colors, [key]: value } }
    });
  };

  const resetToDefaults = () => {
    if (confirm('Reset all settings to default values?')) {
      updateConfig(DEFAULT_CONFIG);
    }
  };

  const handleAddOverride = () => {
    if (!newExtOriginal.trim() || !newExtTarget.trim()) return;
    const normalize = (ext: string) => ext.startsWith('.') ? ext : `.${ext}`;
    const orig = normalize(newExtOriginal.trim());
    const target = normalize(newExtTarget.trim());
    
    updateConfig({
      extensionOverrides: { ...config.extensionOverrides, [orig]: target }
    });
    setNewExtOriginal('');
    setNewExtTarget('');
  };

  const handleRemoveOverride = (key: string) => {
    const newOverrides = { ...config.extensionOverrides };
    delete newOverrides[key];
    updateConfig({ extensionOverrides: newOverrides });
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center pt-16 pb-8 px-8 animate-in fade-in duration-200 pointer-events-auto">
      <button 
        onClick={() => setSettingsOpen(false)}
        className="absolute top-8 right-8 p-3 bg-bg-panel hover:bg-bg-hover hover:text-red-400 border border-border-subtle hover:border-red-400/50 rounded-full text-text-muted transition-all shadow-lg"
        title="Close Settings (Esc)"
      >
        <X size={24} />
      </button>
    
      <div className="w-full max-w-4xl flex items-center justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary tracking-tight mb-2">Global Preferences</h1>
          <p className="text-text-muted text-sm">Application-wide settings. Changes are saved automatically and applied instantly.</p>
        </div>
        
        <button 
          onClick={resetToDefaults}
          className="flex items-center gap-2 px-4 py-2 bg-bg-panel border border-border-subtle text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-full text-sm font-medium transition-colors shadow-sm"
        >
          <RotateCcw size={14} /> Reset Defaults
        </button>
      </div>
    
      <div className="w-full max-w-4xl flex-1 overflow-y-auto pr-2 pb-4 space-y-8">
        
        {/* Colors & Theming */}
        <section className="bg-bg-panel border border-border-subtle rounded-xl p-6 shadow-sm">
          <h2 className="text-sm uppercase font-semibold text-text-muted mb-4 flex items-center gap-2">
            <Palette size={16} className="text-accent" /> Colors & Theming
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(config.theme.colors).map(([key, value]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-xs text-text-muted font-medium">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                <div className="flex items-center gap-2 bg-bg-base border border-border-subtle rounded-lg p-1.5 pr-3">
                  <input 
                    type="color" 
                    value={value}
                    onChange={(e) => handleColorChange(key as keyof typeof config.theme.colors, e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  <input 
                    type="text"
                    value={value}
                    onChange={(e) => handleColorChange(key as keyof typeof config.theme.colors, e.target.value)}
                    className="flex-1 bg-transparent border-none text-sm text-text-primary font-mono outline-none uppercase"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
        
        {/* Typography & Scale */}
        <section className="bg-bg-panel border border-border-subtle rounded-xl p-6 shadow-sm">
          <h2 className="text-sm uppercase font-semibold text-text-muted mb-4 flex items-center gap-2">
            <Type size={16} className="text-blue-400" /> Typography & Scale
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs text-text-muted font-medium flex items-center justify-between">
                <span>UI Scale Factor</span>
                <span className="text-text-primary font-mono">{localScale.toFixed(2)}x</span>
              </label>
              <input 
                type="range" 
                min="0.75" max="1.5" step="0.05"
                value={localScale}
                onChange={(e) => setLocalScale(parseFloat(e.target.value))}
                onMouseUp={() => updateConfig({ theme: { ...config.theme, scale: localScale } })}
                onTouchEnd={() => updateConfig({ theme: { ...config.theme, scale: localScale } })}
                onKeyUp={() => updateConfig({ theme: { ...config.theme, scale: localScale } })}
                className="w-full accent-accent cursor-pointer"
              />
              <p className="text-[10px] text-text-muted mt-1">Adjusts the overall zoom level of the application.</p>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-xs text-text-muted font-medium flex items-center justify-between">
                <span>Base Font Size</span>
                <span className="text-text-primary font-mono">{localFontSize}px</span>
              </label>
              <input 
                type="range" 
                min="10" max="18" step="1"
                value={localFontSize}
                onChange={(e) => setLocalFontSize(parseInt(e.target.value))}
                onMouseUp={() => updateConfig({ theme: { ...config.theme, font: { ...config.theme.font, size: localFontSize } } })}
                onTouchEnd={() => updateConfig({ theme: { ...config.theme, font: { ...config.theme.font, size: localFontSize } } })}
                onKeyUp={() => updateConfig({ theme: { ...config.theme, font: { ...config.theme.font, size: localFontSize } } })}
                className="w-full accent-blue-400 cursor-pointer"
              />
              <p className="text-[10px] text-text-muted mt-1">Affects tree rendering, editor base text, and UI elements.</p>
            </div>
            
            <div className="col-span-1 md:col-span-2 flex flex-col gap-2 mt-2">
              <label className="text-xs text-text-muted font-medium">Font Family</label>
              <input 
                type="text"
                value={config.theme.font.family}
                onChange={(e) => updateConfig({ theme: { ...config.theme, font: { ...config.theme.font, family: e.target.value } } })}
                className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary font-mono outline-none focus:border-accent transition-colors"
                placeholder="e.g. ui-monospace, SFMono-Regular..."
              />
            </div>
          </div>
        </section>
        
        {/* Extension Overrides */}
        <section className="bg-bg-panel border border-border-subtle rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm uppercase font-semibold text-text-muted flex items-center gap-2 mb-1">
                <FileCode size={16} className="text-orange-400" /> Extension Overrides
              </h2>
              <p className="text-xs text-text-muted">Map file extensions to bypass AI upload filters. The generated Markdown will explicitly state the original file type to maintain LLM context integrity.</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                placeholder="Original (e.g. .uproject)"
                value={newExtOriginal}
                onChange={(e) => setNewExtOriginal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddOverride()}
                className="flex-1 bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary font-mono outline-none focus:border-orange-400 transition-colors"
              />
              <span className="text-text-muted">→</span>
              <input 
                type="text" 
                placeholder="Export As (e.g. .json)"
                value={newExtTarget}
                onChange={(e) => setNewExtTarget(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddOverride()}
                className="flex-1 bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary font-mono outline-none focus:border-orange-400 transition-colors"
              />
              <button 
                onClick={handleAddOverride}
                disabled={!newExtOriginal.trim() || !newExtTarget.trim()}
                className="px-4 py-2 bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Plus size={16} /> Add
              </button>
            </div>
            
            {Object.keys(config.extensionOverrides).length > 0 && (
              <ul className="mt-4 border border-border-subtle rounded-lg overflow-hidden bg-bg-base divide-y divide-border-subtle">
                {Object.entries(config.extensionOverrides).map(([orig, target]) => (
                  <li key={orig} className="flex items-center justify-between px-3 py-2 group hover:bg-bg-hover transition-colors">
                    <div className="flex items-center gap-3 font-mono text-sm">
                      <span className="text-red-400">{orig}</span>
                      <span className="text-text-muted text-xs">mapped to</span>
                      <span className="text-green-400">{target}</span>
                    </div>
                    <button 
                      onClick={() => handleRemoveOverride(orig)}
                      className="p-1.5 text-text-muted hover:text-red-400 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-400/10"
                      title="Remove Override"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
    
      </div>
    </div>
  );
}