// src/App.tsx
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar } from './components/layout/Sidebar';
import { MainStage } from './components/layout/MainStage';
import { Bootstrapper } from './components/layout/Bootstrapper';

function App() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg-base border border-border-subtle">
      <TitleBar />
      <Bootstrapper>
        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <MainStage />
        </div>
      </Bootstrapper>
    </div>
  );
}

export default App;