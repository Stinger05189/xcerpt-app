// src/components/layout/AgentForgeModal.tsx
import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import type { 
  AgentForgeProfile, 
  AgentForgeToolingMode, 
  AgentForgeCheckResult, 
  AgentForgeScaffoldResult 
} from '../../types/ipc';
import { 
  X, 
  Flame, 
  Folder, 
  FolderPlus, 
  Layers, 
  Sparkles, 
  Check, 
  AlertTriangle, 
  ExternalLink, 
  RefreshCw, 
  Code2, 
  Terminal, 
  Compass, 
  FolderSymlink, 
  FileCode2,
  BookOpen,
  FolderTree,
  ChevronDown
} from 'lucide-react';

export function AgentForgeModal() {
  const { isAgentForgeModalOpen, setAgentForgeModalOpen } = useAppStore();
  const rootPaths = useWorkspaceStore(s => s.rootPaths);
  const activeTab = useWorkspaceStore(s => s.activeTab);
  const addRootPath = useWorkspaceStore(s => s.addRootPath);
  const openEditorTab = useWorkspaceStore(s => s.openEditorTab);

  // 1. Directory Configuration State
  const defaultBaseRoot = activeTab || rootPaths[0] || '';
  const [selectedBaseRoot, setSelectedBaseRoot] = useState<string>(defaultBaseRoot);
  const [customRelativeSubdir, setCustomRelativeSubdir] = useState<string>('Docs/.agents');
  const [overrideAbsoluteDir, setOverrideAbsoluteDir] = useState<string | null>(null);

  // 2. Profile & Tooling Selection State
  const [profile, setProfile] = useState<AgentForgeProfile>('Standard');
  const [toolingMode, setToolingMode] = useState<AgentForgeToolingMode>('Xcerpt');
  const [scaffoldVault, setScaffoldVault] = useState<boolean>(true);
  const [forceRefresh, setForceRefresh] = useState<boolean>(false);

  // 3. Execution & Validation State
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [checkResult, setCheckResult] = useState<AgentForgeCheckResult | null>(null);
  const [isScaffolding, setIsScaffolding] = useState<boolean>(false);
  const [scaffoldResult, setScaffoldResult] = useState<AgentForgeScaffoldResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keep selected root in sync if active workspace changes
  useEffect(() => {
    if (defaultBaseRoot && !selectedBaseRoot) {
      setSelectedBaseRoot(defaultBaseRoot);
    }
  }, [defaultBaseRoot, selectedBaseRoot]);

  // Derive resolved target path live
  const resolvedTargetDirectory = useMemo(() => {
    if (overrideAbsoluteDir) {
      return overrideAbsoluteDir.replace(/\\/g, '/');
    }
    if (!selectedBaseRoot) return '';
    const cleanBase = selectedBaseRoot.replace(/\\/g, '/').replace(/\/+$/, '');
    const cleanSub = customRelativeSubdir.replace(/\\/g, '/').replace(/^\/+/, '');
    return cleanSub ? `${cleanBase}/${cleanSub}` : cleanBase;
  }, [selectedBaseRoot, customRelativeSubdir, overrideAbsoluteDir]);

  // Pre-flight check when resolved path changes
  useEffect(() => {
    if (!isAgentForgeModalOpen || !resolvedTargetDirectory) {
      setCheckResult(null);
      return;
    }

    let isMounted = true;
    setIsChecking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await window.api.agentForgeCheckDirectory(resolvedTargetDirectory);
        if (isMounted) {
          setCheckResult(res);
          setIsChecking(false);
        }
      } catch {
        if (isMounted) setIsChecking(false);
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [resolvedTargetDirectory, isAgentForgeModalOpen]);

  // Keyboard dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAgentForgeModalOpen) {
        setAgentForgeModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAgentForgeModalOpen, setAgentForgeModalOpen]);

  if (!isAgentForgeModalOpen) return null;

  const handleBrowseCustomLocation = async () => {
    const path = await window.api.selectDirectory();
    if (path) {
      setOverrideAbsoluteDir(path);
      setErrorMessage(null);
    }
  };

  const handleResetToWorkspaceDefault = () => {
    setOverrideAbsoluteDir(null);
    setCustomRelativeSubdir('Docs/.agents');
    setErrorMessage(null);
  };

  const handleSelectProfile = (newProfile: AgentForgeProfile) => {
    setProfile(newProfile);
    if (newProfile === 'SourceMiner') {
      setToolingMode('Xcerpt');
    }
  };

  const handleExecuteScaffold = async () => {
    if (!resolvedTargetDirectory || isScaffolding) return;
    setIsScaffolding(true);
    setErrorMessage(null);
    setScaffoldResult(null);

    try {
      const res = await window.api.agentForgeScaffold({
        targetDirectory: resolvedTargetDirectory,
        profile,
        toolingMode: profile === 'SourceMiner' ? 'Xcerpt' : toolingMode,
        scaffoldVault: profile === 'SourceMiner' ? scaffoldVault : false,
        forceRefresh
      });

      setScaffoldResult(res);

      // Auto-refresh matching workspace roots so new folder structure appears immediately in FileTree
      const matchedRoot = rootPaths.find(rp => resolvedTargetDirectory.startsWith(rp.replace(/\\/g, '/')));
      if (matchedRoot) {
        await addRootPath(matchedRoot, true);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsScaffolding(false);
    }
  };

  const handleOpenAgentFileInEditor = async () => {
    if (!scaffoldResult || scaffoldResult.writtenFiles.length === 0) return;
    const agentFilePath = scaffoldResult.writtenFiles.find(f => f.endsWith('agent.md'));
    if (!agentFilePath) return;

    const normalizedFile = agentFilePath.replace(/\\/g, '/');
    const matchedRoot = rootPaths.find(rp => normalizedFile.startsWith(rp.replace(/\\/g, '/')));

    if (matchedRoot) {
      const cleanRoot = matchedRoot.replace(/\\/g, '/');
      const relPath = normalizedFile.slice(cleanRoot.length).replace(/^\/+/, '');
      openEditorTab(matchedRoot, relPath, true);
      setAgentForgeModalOpen(false);
    } else {
      window.api.showItemInFolder(agentFilePath);
    }
  };

  return (
    <div 
      className="fixed top-10 inset-x-0 bottom-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 select-none animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) setAgentForgeModalOpen(false);
      }}
    >
      <div 
        className="bg-bg-panel border border-border-subtle rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden ring-1 ring-border-subtle/50 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <header className="h-14 px-6 border-b border-border-subtle bg-bg-base/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/15 text-orange-400 rounded-xl">
              <Flame size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary tracking-tight flex items-center gap-2">
                Agent Forge Workspace Initializer
                <span className="text-[10px] font-mono font-normal text-text-muted bg-bg-base px-2 py-0.5 rounded border border-border-subtle">
                  Live GitHub Template Engine
                </span>
              </h2>
              <p className="text-[11px] text-text-muted">
                Scaffold modular, subsystem-scoped AI documentation environments with zero hardcoded prompt lock-in.
              </p>
            </div>
          </div>

          <button
            onClick={() => setAgentForgeModalOpen(false)}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
            title="Close Dialog (Esc)"
          >
            <X size={18} />
          </button>
        </header>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 select-text">
          {/* Step 1: Target Location Configuration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                <FolderPlus size={14} className="text-orange-400" /> Target Workspace Directory
              </label>
              {overrideAbsoluteDir && (
                <button
                  type="button"
                  onClick={handleResetToWorkspaceDefault}
                  className="text-[11px] text-accent hover:underline flex items-center gap-1"
                >
                  <RefreshCw size={11} /> Reset to Root Default
                </button>
              )}
            </div>

            <div className="bg-bg-base border border-border-subtle rounded-xl p-4 space-y-3">
              {!overrideAbsoluteDir ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Active Root Picker */}
                  <div>
                    <label className="text-[10px] uppercase font-mono text-text-muted block mb-1">
                      Project Root Base
                    </label>
                    {rootPaths.length > 0 ? (
                      <div className="relative">
                        <select
                          value={selectedBaseRoot}
                          onChange={(e) => setSelectedBaseRoot(e.target.value)}
                          className="w-full bg-bg-panel border border-border-subtle rounded-lg px-3 py-1.5 text-xs font-mono text-text-primary outline-none focus:border-accent appearance-none pr-8"
                        >
                          {rootPaths.map(r => (
                            <option key={r} value={r}>
                              {r.split(/[/\\]/).pop() || r} ({r})
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                      </div>
                    ) : (
                      <div className="text-xs text-text-muted italic bg-bg-panel p-2 rounded-lg border border-border-subtle">
                        No workspace roots open. Please browse to target folder.
                      </div>
                    )}
                  </div>

                  {/* Relative Enclave Subdirectory */}
                  <div>
                    <label className="text-[10px] uppercase font-mono text-text-muted block mb-1">
                      Enclave Subdirectory
                    </label>
                    <input
                      type="text"
                      value={customRelativeSubdir}
                      onChange={(e) => setCustomRelativeSubdir(e.target.value)}
                      placeholder="e.g. Docs/.agents or Source/Subsystem/.agents"
                      className="w-full bg-bg-panel border border-border-subtle rounded-lg px-3 py-1.5 text-xs font-mono text-text-primary outline-none focus:border-orange-400"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-mono text-text-muted">
                    Custom Absolute Directory Target
                  </label>
                  <div className="font-mono text-xs text-text-primary p-2 bg-bg-panel rounded-lg border border-border-subtle truncate">
                    {overrideAbsoluteDir}
                  </div>
                </div>
              )}

              {/* Resolved Path & Pre-Flight Status */}
              <div className="pt-2 border-t border-border-subtle/60 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                  <span className="text-[11px] text-text-muted font-medium shrink-0">Resolved Path:</span>
                  <span className="font-mono text-[11px] text-text-primary truncate bg-bg-panel px-2 py-0.5 rounded border border-border-subtle" title={resolvedTargetDirectory}>
                    {resolvedTargetDirectory || 'None'}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleBrowseCustomLocation}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-bg-panel hover:bg-bg-hover text-text-muted hover:text-text-primary border border-border-subtle rounded-lg text-xs font-medium transition-colors"
                  >
                    <Folder size={12} />
                    <span>Browse...</span>
                  </button>

                  {isChecking ? (
                    <span className="text-[10px] font-mono text-text-muted animate-pulse">Inspecting...</span>
                  ) : checkResult?.hasAgentFiles ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1" title="Directory already contains agent files; will update or overwrite">
                      <AlertTriangle size={10} /> Existing Files Found
                    </span>
                  ) : checkResult?.exists ? (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/30 flex items-center gap-1">
                      <Check size={10} /> Directory Ready
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                      <FolderPlus size={10} /> Will Create Directory
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: Workspace Profile Selection */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={14} className="text-orange-400" /> Workspace Profile
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Profile 1: Standard Software Engineering */}
              <div
                onClick={() => handleSelectProfile('Standard')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  profile === 'Standard'
                    ? 'bg-orange-500/15 border-orange-500 text-text-primary shadow-sm ring-1 ring-orange-500/40'
                    : 'bg-bg-base border-border-subtle hover:bg-bg-hover text-text-muted hover:text-text-primary'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-text-primary">Standard SWE</span>
                    <Terminal size={14} className="text-orange-400" />
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    TypeScript, Python, Go, Rust, C#, web and cloud architectures.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-border-subtle/50 text-[10px] font-mono text-text-muted/70">
                  agent.md • conventions.md
                </div>
              </div>

              {/* Profile 2: Unreal Engine */}
              <div
                onClick={() => handleSelectProfile('Unreal')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  profile === 'Unreal'
                    ? 'bg-orange-500/15 border-orange-500 text-text-primary shadow-sm ring-1 ring-orange-500/40'
                    : 'bg-bg-base border-border-subtle hover:bg-bg-hover text-text-muted hover:text-text-primary'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-text-primary">Unreal Engine</span>
                    <Sparkles size={14} className="text-orange-400" />
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    C++20, Slate, UMG, LWC, GC Roots, Engine Macros, and mandatory Tabs.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-border-subtle/50 text-[10px] font-mono text-text-muted/70">
                  agent.unreal.md
                </div>
              </div>

              {/* Profile 3: Source Miner & Repo Archaeology */}
              <div
                onClick={() => handleSelectProfile('SourceMiner')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  profile === 'SourceMiner'
                    ? 'bg-orange-500/15 border-orange-500 text-text-primary shadow-sm ring-1 ring-orange-500/40'
                    : 'bg-bg-base border-border-subtle hover:bg-bg-hover text-text-muted hover:text-text-primary'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-text-primary">Source Miner</span>
                    <Compass size={14} className="text-orange-400" />
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">
                    Deep repo archaeology, skills suite, and composable architectural vault.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-border-subtle/50 text-[10px] font-mono text-text-muted/70">
                  skills/ • vault/ specs
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Tooling Mode & Extraction Protocol */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Code2 size={14} className="text-orange-400" /> Tooling Integration Mode
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setToolingMode('Xcerpt')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  toolingMode === 'Xcerpt'
                    ? 'bg-orange-500/15 border-orange-500 text-text-primary shadow-sm ring-1 ring-orange-500/40'
                    : 'bg-bg-base border-border-subtle hover:bg-bg-hover text-text-muted hover:text-text-primary'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-text-primary">Xcerpt-Optimized (Default)</span>
                  {toolingMode === 'Xcerpt' && <Check size={14} className="text-orange-400" />}
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Generates deterministic boundary tokens (<code className="text-orange-400">&lt;&lt;&lt;FILE_START&gt;&gt;&gt;</code>) and 4-backtick markdown blocks for 1-click batch ingestion into Xcerpt Dev Studio.
                </p>
              </button>

              <button
                type="button"
                disabled={profile === 'SourceMiner'}
                onClick={() => setToolingMode('NativeIDE')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  toolingMode === 'NativeIDE' && profile !== 'SourceMiner'
                    ? 'bg-orange-500/15 border-orange-500 text-text-primary shadow-sm ring-1 ring-orange-500/40'
                    : 'bg-bg-base border-border-subtle hover:bg-bg-hover text-text-muted hover:text-text-primary'
                } ${profile === 'SourceMiner' ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-text-primary">Native IDE Merge</span>
                  {toolingMode === 'NativeIDE' && profile !== 'SourceMiner' && <Check size={14} className="text-orange-400" />}
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Emits standard markdown code blocks with line 1 comment path headers, optimized for JetBrains Rider, VS Code, or Visual Studio merge diff tools.
                </p>
              </button>
            </div>
          </div>

          {/* Step 4: Auxiliary Options */}
          <div className="bg-bg-base border border-border-subtle rounded-xl p-4 space-y-3">
            {profile === 'SourceMiner' && (
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scaffoldVault}
                  onChange={(e) => setScaffoldVault(e.target.checked)}
                  className="accent-orange-400 w-4 h-4 rounded mt-0.5"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-text-primary flex items-center gap-1.5">
                    <FolderTree size={13} className="text-orange-400" /> Scaffold vault/ directory structure
                  </span>
                  <span className="text-[11px] text-text-muted mt-0.5">
                    Creates <code className="text-text-primary">vault/subsystems/</code>, <code className="text-text-primary">vault/primitives/</code>, and <code className="text-text-primary">vault/forensics/</code> alongside the agent enclave.
                  </span>
                </div>
              </label>
            )}

            <div className={profile === 'SourceMiner' ? "border-t border-border-subtle/60 pt-3" : ""}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceRefresh}
                  onChange={(e) => setForceRefresh(e.target.checked)}
                  className="accent-orange-400 w-4 h-4 rounded mt-0.5"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-text-primary flex items-center gap-1.5">
                    <RefreshCw size={13} className="text-orange-400" /> Force refresh templates from GitHub
                  </span>
                  <span className="text-[11px] text-text-muted mt-0.5">
                    Bypasses local cache in <code className="text-text-muted font-mono">&lt;userData&gt;/agent_forge_cache/</code> to fetch the absolute latest master commits.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Success Banner */}
          {scaffoldResult && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-green-400 font-semibold text-xs">
                <Check size={16} />
                <span>Agent Forge workspace successfully scaffolded!</span>
                {scaffoldResult.fromCache && (
                  <span className="text-[10px] font-mono font-normal bg-bg-base text-text-muted px-1.5 py-0.2 rounded border border-border-subtle ml-auto">
                    Resolved from Cache
                  </span>
                )}
              </div>
              <p className="text-[11px] text-text-muted">
                Created <strong className="text-text-primary">{scaffoldResult.writtenFiles.length} files</strong> in{' '}
                <span className="font-mono text-text-primary">{scaffoldResult.resolvedDirectory}</span>.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleOpenAgentFileInEditor}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                >
                  <FileCode2 size={13} />
                  <span>Open agent.md</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.api.openPath(scaffoldResult.resolvedDirectory)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-panel hover:bg-bg-hover text-text-muted hover:text-text-primary border border-border-subtle rounded-lg text-xs font-medium transition-colors"
                >
                  <FolderSymlink size={13} />
                  <span>Reveal in OS</span>
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="h-14 px-6 border-t border-border-subtle bg-bg-base/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.api.openExternal('https://github.com/Stinger05189/agent-forge')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-muted hover:text-text-primary hover:underline transition-colors"
            >
              <BookOpen size={13} />
              <span>Agent Forge Docs</span>
              <ExternalLink size={11} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAgentForgeModalOpen(false)}
              className="px-4 py-1.5 text-xs text-text-muted hover:text-text-primary"
            >
              {scaffoldResult ? 'Close' : 'Cancel'}
            </button>
            <button
              onClick={handleExecuteScaffold}
              disabled={isScaffolding || !resolvedTargetDirectory}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-40"
            >
              <Flame size={14} />
              <span>{isScaffolding ? 'Scaffolding Workspace...' : 'Initialize Agent Workspace'}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}