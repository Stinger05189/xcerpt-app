// src/components/layout/SettingsModal.tsx
import { useEffect, useState } from 'react';
import { useAppStore, DEFAULT_CONFIG } from '../../store/appStore';
import type { LLMProviderId } from '../../features/llm/types/llm';
import { 
  X, 
  Palette, 
  Type, 
  RotateCcw, 
  FileCode, 
  Plus, 
  Trash2, 
  Sparkles, 
  Key, 
  Check, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ExternalLink,
  Sliders,
  Info,
  ShieldAlert
} from 'lucide-react';

type SettingsCategory = 'appearance' | 'llm' | 'overrides' | 'system';

export function SettingsModal() {
  const { config, updateConfig, setSettingsOpen, appVersion } = useAppStore();

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('appearance');

  const [localScale, setLocalScale] = useState(config.theme.scale);
  const [prevGlobalScale, setPrevGlobalScale] = useState(config.theme.scale);

  const [localFontSize, setLocalFontSize] = useState(config.theme.font.size);
  const [prevGlobalFontSize, setPrevGlobalFontSize] = useState(config.theme.font.size);

  const [newExtOriginal, setNewExtOriginal] = useState('');
  const [newExtTarget, setNewExtTarget] = useState('');

  // LLM Settings State
  const activeProviderId = config.llm?.activeProvider || 'openrouter';
  const activeProvider = config.llm?.providers[activeProviderId] || config.llm?.providers.openrouter;
  const [showApiKey, setShowApiKey] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message?: string } | null>(null);

  if (config.theme.scale !== prevGlobalScale) {
    setPrevGlobalScale(config.theme.scale);
    setLocalScale(config.theme.scale);
  }

  if (config.theme.font.size !== prevGlobalFontSize) {
    setPrevGlobalFontSize(config.theme.font.size);
    setLocalFontSize(config.theme.font.size);
  }

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
    if (confirm('Are you sure you want to reset all preferences to default values? This will restore the theme, font sizing, and extension overrides.')) {
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

  const handleSelectProvider = (provId: LLMProviderId) => {
    updateConfig({
      llm: {
        ...config.llm,
        activeProvider: provId
      }
    });
    setConnectionStatus(null);
  };

  const handleUpdateApiKey = (key: string) => {
    const prov = config.llm?.providers[activeProviderId];
    if (!prov) return;
    updateConfig({
      llm: {
        ...config.llm,
        providers: {
          ...config.llm.providers,
          [activeProviderId]: {
            ...prov,
            apiKey: key
          }
        }
      }
    });
  };

  const handleSelectModel = (modelName: string) => {
    const prov = config.llm?.providers[activeProviderId];
    if (!prov) return;
    updateConfig({
      llm: {
        ...config.llm,
        providers: {
          ...config.llm.providers,
          [activeProviderId]: {
            ...prov,
            defaultModel: modelName
          }
        }
      }
    });
  };

  const handleAddCustomModel = () => {
    if (!customModelInput.trim()) return;
    const prov = config.llm?.providers[activeProviderId];
    if (!prov) return;
    const model = customModelInput.trim();
    const customList = Array.from(new Set([...(prov.customModels || []), model]));
    updateConfig({
      llm: {
        ...config.llm,
        providers: {
          ...config.llm.providers,
          [activeProviderId]: {
            ...prov,
            defaultModel: model,
            customModels: customList
          }
        }
      }
    });
    setCustomModelInput('');
  };

  const handleTestConnection = async () => {
    if (!activeProvider?.apiKey?.trim()) {
      setConnectionStatus({ success: false, message: 'Please enter an API key to test connection.' });
      return;
    }
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await window.api.llmTestConnection(
        activeProviderId,
        activeProvider.apiKey,
        activeProvider.defaultModel,
        activeProvider.baseUrl
      );
      setConnectionStatus({
        success: res.success,
        message: res.message || (res.success ? 'Connected successfully.' : 'Connection failed.')
      });
    } catch (err: unknown) {
      setConnectionStatus({ success: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setTestingConnection(false);
    }
  };

  const allAvailableModels = [
    ...(activeProvider?.availableModels || []),
    ...(activeProvider?.customModels || [])
  ];

  return (
    <div 
      className="fixed top-10 inset-x-0 bottom-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) setSettingsOpen(false);
      }}
    >
      <div 
        className="bg-bg-panel border border-border-subtle rounded-2xl w-full max-w-5xl h-[85vh] max-h-200 shadow-2xl flex flex-col overflow-hidden ring-1 ring-border-subtle/50 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Window Header */}
        <header className="h-14 px-6 border-b border-border-subtle bg-bg-base/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/15 text-accent rounded-xl">
              <Sliders size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary tracking-tight">
                Global Preferences
              </h2>
              <p className="text-[11px] text-text-muted">
                Configure IDE appearance, AI integrations, file mappings, and system settings.
              </p>
            </div>
          </div>

          <button
            onClick={() => setSettingsOpen(false)}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
            title="Close Preferences (Esc)"
          >
            <X size={18} />
          </button>
        </header>

        {/* Master-Detail Split Stage */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Category Navigation Rail */}
          <aside className="w-64 bg-bg-panel border-r border-border-subtle p-3 flex flex-col justify-between shrink-0 select-none">
            <nav className="space-y-1">
              <button
                onClick={() => setActiveCategory('appearance')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  activeCategory === 'appearance'
                    ? 'bg-accent/15 text-accent font-semibold shadow-sm'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                }`}
              >
                <Palette size={16} />
                <span>Appearance & Theming</span>
              </button>

              <button
                onClick={() => setActiveCategory('llm')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  activeCategory === 'llm'
                    ? 'bg-accent/15 text-accent font-semibold shadow-sm'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles size={16} className="text-accent" />
                  <span>AI & Copilot</span>
                </div>
                {activeProvider?.apiKey ? (
                  <span className="w-2 h-2 rounded-full bg-green-400" title="API Key Configured" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-amber-400" title="API Key Required" />
                )}
              </button>

              <button
                onClick={() => setActiveCategory('overrides')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  activeCategory === 'overrides'
                    ? 'bg-accent/15 text-accent font-semibold shadow-sm'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileCode size={16} />
                  <span>File Overrides</span>
                </div>
                {Object.keys(config.extensionOverrides).length > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-bg-base text-text-muted border border-border-subtle">
                    {Object.keys(config.extensionOverrides).length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveCategory('system')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  activeCategory === 'system'
                    ? 'bg-accent/15 text-accent font-semibold shadow-sm'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'
                }`}
              >
                <Info size={16} />
                <span>System & Maintenance</span>
              </button>
            </nav>

            {/* Sidebar Footer */}
            <div className="p-3 border-t border-border-subtle/60 text-[11px] font-mono text-text-muted/70 flex items-center justify-between">
              <span>Xcerpt IDE</span>
              <span>v{appVersion || '1.6.1'}</span>
            </div>
          </aside>

          {/* Right Content Viewport */}
          <main className="flex-1 overflow-y-auto p-8 bg-bg-base select-text">
            {/* Category: Appearance & Theming */}
            {activeCategory === 'appearance' && (
              <div className="max-w-3xl space-y-8 animate-in fade-in duration-100">
                <div>
                  <h3 className="text-base font-semibold text-text-primary mb-1 flex items-center gap-2">
                    <Palette size={16} className="text-accent" /> Interface Palette & Theming
                  </h3>
                  <p className="text-xs text-text-muted">
                    Custom CSS variables are injected directly into the active Chromium document root.
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(config.theme.colors).map(([key, value]) => (
                    <div key={key} className="bg-bg-panel border border-border-subtle rounded-xl p-3 flex flex-col gap-2 shadow-sm">
                      <label className="text-[11px] text-text-muted font-medium capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <div className="flex items-center gap-2.5 bg-bg-base border border-border-subtle rounded-lg p-1.5 pr-2.5">
                        <input 
                          type="color" 
                          value={value}
                          onChange={(e) => handleColorChange(key as keyof typeof config.theme.colors, e.target.value)}
                          className="w-7 h-7 rounded-md cursor-pointer border-0 bg-transparent p-0 shrink-0"
                        />
                        <input 
                          type="text"
                          value={value}
                          onChange={(e) => handleColorChange(key as keyof typeof config.theme.colors, e.target.value)}
                          className="w-full bg-transparent border-none text-xs text-text-primary font-mono outline-none uppercase"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-6 border-t border-border-subtle">
                  <h3 className="text-base font-semibold text-text-primary mb-1 flex items-center gap-2">
                    <Type size={16} className="text-blue-400" /> Typography & Window Scale
                  </h3>
                  <p className="text-xs text-text-muted mb-5">
                    Fine-tune hardware-accelerated zoom scaling and editor base fonts.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-bg-panel border border-border-subtle rounded-xl p-5 shadow-sm">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-text-primary">UI Scale Factor</span>
                        <span className="font-mono text-accent bg-accent/15 px-2 py-0.5 rounded">
                          {localScale.toFixed(2)}x
                        </span>
                      </div>
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
                      <span className="text-[10px] text-text-muted">Directly scales window contents via Chromium webFrame.</span>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-text-primary">Base Font Size</span>
                        <span className="font-mono text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded">
                          {localFontSize}px
                        </span>
                      </div>
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
                      <span className="text-[10px] text-text-muted">Affects tree rendering and Monaco editor line heights.</span>
                    </div>

                    <div className="col-span-1 md:col-span-2 pt-3 border-t border-border-subtle">
                      <label className="text-xs text-text-muted font-medium block mb-2">Monospace Font Family</label>
                      <input 
                        type="text"
                        value={config.theme.font.family}
                        onChange={(e) => updateConfig({ theme: { ...config.theme, font: { ...config.theme.font, family: e.target.value } } })}
                        className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-mono outline-none focus:border-accent"
                        placeholder="e.g. ui-monospace, SFMono-Regular, Menlo..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Category: AI & Copilot */}
            {activeCategory === 'llm' && (
              <div className="max-w-3xl space-y-6 animate-in fade-in duration-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-text-primary mb-1 flex items-center gap-2">
                      <Sparkles size={16} className="text-accent" /> AI Models & Copilot Automation
                    </h3>
                    <p className="text-xs text-text-muted">
                      Configures the provider used for Session Naming, Description Inference, and Commit Synthesis.
                    </p>
                  </div>
                  {activeProviderId === 'openrouter' && (
                    <a
                      href="https://openrouter.ai/keys"
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => { e.preventDefault(); window.api.openExternal('https://openrouter.ai/keys'); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/15 hover:bg-accent text-accent hover:text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                    >
                      <span>Get OpenRouter Key</span> <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                {/* Provider Selector Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'openrouter', name: 'OpenRouter', badge: 'Default', desc: 'Multi-model gateway' },
                    { id: 'gemini', name: 'Gemini API', badge: 'Google', desc: 'Direct Google AI' },
                    { id: 'openai', name: 'OpenAI', badge: 'GPT', desc: 'Direct OpenAI' },
                    { id: 'anthropic', name: 'Anthropic', badge: 'Claude', desc: 'Direct Claude' },
                  ].map(p => {
                    const isSelected = activeProviderId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProvider(p.id as LLMProviderId)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between select-none ${
                          isSelected
                            ? 'bg-accent/15 border-accent text-text-primary shadow-sm ring-1 ring-accent/40'
                            : 'bg-bg-panel border-border-subtle hover:bg-bg-hover text-text-muted hover:text-text-primary'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs text-text-primary">{p.name}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-bg-base border border-border-subtle text-text-muted">
                            {p.badge}
                          </span>
                        </div>
                        <span className="text-[10px] text-text-muted/80">{p.desc}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Configuration Card */}
                <div className="bg-bg-panel border border-border-subtle rounded-xl p-5 space-y-4 shadow-sm">
                  {/* Model Selector */}
                  <div>
                    <label className="text-xs text-text-muted font-medium block mb-1.5">Selected Model</label>
                    <select
                      value={activeProvider?.defaultModel || ''}
                      onChange={(e) => handleSelectModel(e.target.value)}
                      className="w-full bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-accent"
                    >
                      {allAvailableModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* API Key Input */}
                  <div>
                    <label className="text-xs text-text-muted font-medium flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-1.5"><Key size={13} /> {activeProvider?.name} API Key</span>
                      <span className="text-[10px] text-text-muted">Saved to local user config</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={activeProvider?.apiKey || ''}
                          onChange={(e) => handleUpdateApiKey(e.target.value)}
                          placeholder={`Enter your ${activeProvider?.name} key...`}
                          className="w-full bg-bg-base border border-border-subtle rounded-lg pl-3 pr-10 py-2 text-xs font-mono text-text-primary outline-none focus:border-accent"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                        >
                          {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testingConnection || !activeProvider?.apiKey?.trim()}
                        className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-40 shadow-sm shrink-0"
                      >
                        {testingConnection ? 'Testing...' : 'Test Connection'}
                      </button>
                    </div>
                  </div>

                  {/* Connection Test Result */}
                  {connectionStatus && (
                    <div className={`p-3 rounded-lg text-xs font-mono flex items-center gap-2 ${connectionStatus.success ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                      {connectionStatus.success ? <Check size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
                      <span className="truncate">{connectionStatus.message}</span>
                    </div>
                  )}

                  {/* Custom Model Addition */}
                  <div className="pt-3 border-t border-border-subtle">
                    <label className="text-xs text-text-muted font-medium block mb-1.5">Add Custom Model Identifier</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="e.g. meta-llama/llama-3.3-70b-instruct"
                        value={customModelInput}
                        onChange={(e) => setCustomModelInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddCustomModel()}
                        className="flex-1 bg-bg-base border border-border-subtle rounded-lg px-3 py-1.5 text-xs font-mono text-text-primary outline-none focus:border-accent"
                      />
                      <button
                        onClick={handleAddCustomModel}
                        disabled={!customModelInput.trim()}
                        className="px-3.5 py-1.5 bg-bg-base border border-border-subtle hover:border-accent text-text-muted hover:text-text-primary rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                      >
                        Add Model
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Category: File Overrides */}
            {activeCategory === 'overrides' && (
              <div className="max-w-3xl space-y-6 animate-in fade-in duration-100">
                <div>
                  <h3 className="text-base font-semibold text-text-primary mb-1 flex items-center gap-2">
                    <FileCode size={16} className="text-orange-400" /> Extension Overrides (File Spoofing)
                  </h3>
                  <p className="text-xs text-text-muted">
                    Map arbitrary extensions to bypass strict LLM upload filters. Output manifests explicitly record the physical renaming to preserve model understanding.
                  </p>
                </div>

                <div className="bg-bg-panel border border-border-subtle rounded-xl p-5 space-y-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <input 
                      type="text" 
                      placeholder="Original (e.g. .uproject)"
                      value={newExtOriginal}
                      onChange={(e) => setNewExtOriginal(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddOverride()}
                      className="flex-1 bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-mono outline-none focus:border-orange-400"
                    />
                    <span className="text-text-muted font-bold">→</span>
                    <input 
                      type="text" 
                      placeholder="Export As (e.g. .json)"
                      value={newExtTarget}
                      onChange={(e) => setNewExtTarget(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddOverride()}
                      className="flex-1 bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-mono outline-none focus:border-orange-400"
                    />
                    <button 
                      onClick={handleAddOverride}
                      disabled={!newExtOriginal.trim() || !newExtTarget.trim()}
                      className="px-4 py-2 bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                    >
                      <Plus size={14} /> Add Override
                    </button>
                  </div>

                  {Object.keys(config.extensionOverrides).length > 0 ? (
                    <div className="divide-y divide-border-subtle border border-border-subtle rounded-xl bg-bg-base overflow-hidden">
                      {Object.entries(config.extensionOverrides).map(([orig, target]) => (
                        <div key={orig} className="flex items-center justify-between px-4 py-2.5 hover:bg-bg-hover/80 transition-colors">
                          <div className="flex items-center gap-3 font-mono text-xs">
                            <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-bold">{orig}</span>
                            <span className="text-text-muted text-[10px]">renamed to</span>
                            <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 font-bold">{target}</span>
                          </div>
                          <button 
                            onClick={() => handleRemoveOverride(orig)}
                            className="p-1.5 text-text-muted hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                            title="Remove Override"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-text-muted italic border border-dashed border-border-subtle rounded-xl bg-bg-base/40">
                      No active extension overrides configured.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Category: System & Maintenance */}
            {activeCategory === 'system' && (
              <div className="max-w-3xl space-y-6 animate-in fade-in duration-100">
                <div>
                  <h3 className="text-base font-semibold text-text-primary mb-1 flex items-center gap-2">
                    <Info size={16} className="text-accent" /> System & Environment Info
                  </h3>
                  <p className="text-xs text-text-muted">
                    Runtime diagnostic data, updates, and maintenance controls.
                  </p>
                </div>

                <div className="bg-bg-panel border border-border-subtle rounded-xl p-5 space-y-3 font-mono text-xs shadow-sm">
                  <div className="flex items-center justify-between py-1 border-b border-border-subtle/50">
                    <span className="text-text-muted">Xcerpt Version</span>
                    <span className="text-text-primary font-bold">v{appVersion || '1.6.1'}</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border-subtle/50">
                    <span className="text-text-muted">Platform Runtime</span>
                    <span className="text-text-primary">Electron Shell</span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border-subtle/50">
                    <span className="text-text-muted">UI Architecture</span>
                    <span className="text-text-primary">React 19 + Zustand + Monaco</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-text-muted">Repository</span>
                    <button
                      onClick={() => window.api.openExternal('https://github.com/Stinger05189/xcerpt-app')}
                      className="text-accent hover:underline flex items-center gap-1 text-xs"
                    >
                      <span>GitHub Releases</span> <ExternalLink size={12} />
                    </button>
                  </div>
                </div>

                {/* Reset Defaults Area (Danger Zone) */}
                <div className="pt-4 border-t border-border-subtle">
                  <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-red-400 mb-0.5 flex items-center gap-1.5">
                        <ShieldAlert size={14} /> Reset Configuration
                      </h4>
                      <p className="text-[11px] text-text-muted">
                        Restore all IDE themes, font sizes, UI zoom, and extension overrides to factory defaults.
                      </p>
                    </div>
                    <button
                      onClick={resetToDefaults}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-red-500/15 hover:bg-red-500 text-red-400 hover:text-white rounded-lg text-xs font-semibold transition-all border border-red-500/30 shrink-0"
                    >
                      <RotateCcw size={13} />
                      <span>Reset to Defaults</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}