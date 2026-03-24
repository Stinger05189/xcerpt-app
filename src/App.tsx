// src/App.tsx
import { useEffect } from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar } from './components/layout/Sidebar';
import { MainStage } from './components/layout/MainStage';
import { Bootstrapper } from './components/layout/Bootstrapper';
import { WorkspaceBrowser } from './components/layout/WorkspaceBrowser';
import { SettingsModal } from './components/layout/SettingsModal';
import { useAppStore } from './store/appStore';

function App() {
  const isBrowserOpen = useAppStore(s => s.isBrowserOpen);
  const isSettingsOpen = useAppStore(s => s.isSettingsOpen);
  const config = useAppStore(s => s.config);

  // Dynamic Theme Engine: Inject CSS Variables to :root
  useEffect(() => {
    const root = document.documentElement;
    const { colors, font, scale } = config.theme;
    
    root.style.setProperty('--theme-bg-base', colors.bgBase);
    root.style.setProperty('--theme-bg-panel', colors.bgPanel);
    root.style.setProperty('--theme-bg-hover', colors.bgHover);
    root.style.setProperty('--theme-text-primary', colors.textPrimary);
    root.style.setProperty('--theme-text-muted', colors.textMuted);
    root.style.setProperty('--theme-border-subtle', colors.borderSubtle);
    root.style.setProperty('--theme-accent', colors.accent);
    
    root.style.setProperty('--theme-font-size', `${font.size}px`);
    root.style.setProperty('--theme-font-family', font.family);
    
    // Natively scale the Chromium web contents
    if (window.api && window.api.setZoomFactor) {
      window.api.setZoomFactor(scale);
    }
  }, [config.theme]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg-base border border-border-subtle relative">
      <TitleBar />
      <Bootstrapper>
        {/* Dim the main UI when modals are open to preserve TitleBar drag integrity */}
        <div className={`flex-1 flex overflow-hidden relative transition-opacity duration-200 ${(isBrowserOpen || isSettingsOpen) ? 'opacity-30 pointer-events-none' : ''}`}>
          <Sidebar />
          <MainStage />
        </div>
        {isBrowserOpen && <WorkspaceBrowser />}
        {isSettingsOpen && <SettingsModal />}
      </Bootstrapper>
    </div>
  );
}

export default App;