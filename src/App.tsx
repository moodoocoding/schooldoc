import { useState } from 'react';
import { KanbanSidebar } from './components/KanbanSidebar';
import { KanbanWorkspace } from './components/KanbanWorkspace';

function App() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeToolId, setActiveToolId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#faf9f5] font-sans text-slate-800 antialiased flex selection:bg-amber-100 selection:text-amber-800">
      {/* Left Clean Kanban Sidebar */}
      <KanbanSidebar 
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        setActiveToolId={setActiveToolId}
      />

      {/* Main Right Workspace Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <KanbanWorkspace 
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          activeToolId={activeToolId}
          setActiveToolId={setActiveToolId}
        />
      </main>
    </div>
  );
}

export default App;
