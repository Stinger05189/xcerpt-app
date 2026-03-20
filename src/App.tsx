// src/App.tsx
import { Sidebar } from './components/layout/Sidebar';
import { MainStage } from './components/layout/MainStage';

function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-base">
      <Sidebar />
      <MainStage />
    </div>
  );
}

export default App;