// src/App.tsx
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar } from './components/layout/Sidebar';
import { MainStage } from './components/layout/MainStage';
import { Bootstrapper } from './components/layout/Bootstrapper';
import { WorkspaceBrowser } from './components/layout/WorkspaceBrowser';
import { useAppStore } from './store/appStore';

function App() {
  const isBrowserOpen = useAppStore(s => s.isBrowserOpen);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg-base border border-border-subtle">
      <TitleBar />
      <Bootstrapper>
        <div className="flex-1 flex overflow-hidden relative">
          <Sidebar />
          <MainStage />
          {isBrowserOpen && <WorkspaceBrowser />}
        </div>
      </Bootstrapper>
    </div>
  );
}

export default App;