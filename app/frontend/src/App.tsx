import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import RightPanel from "./components/terminal/RightPanel";
import { useTerminalStore } from "./stores/terminalStore";

// Lazy-loaded route components for code splitting
const Index = lazy(() => import("./pages/Index"));
const ProjectPage = lazy(() => import("./pages/ProjectPage"));
const BriefEditor = lazy(() => import("./pages/BriefEditor"));
const DocumentViewer = lazy(() => import("./pages/DocumentViewer"));
const WizardPage = lazy(() => import("./pages/WizardPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const App = () => {
  const panelOpen = useTerminalStore((s) => s.panelOpen);
  const panelWidth = useTerminalStore((s) => s.panelWidth);

  return (
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <div className="flex h-screen w-screen overflow-hidden">
          {/* Main content area — shrinks when right panel is open */}
          <div
            className="flex-1 min-w-0 flex flex-col overflow-hidden"
            style={{ marginRight: panelOpen ? panelWidth : 0, transition: "margin-right 200ms ease" }}
          >
            <Suspense fallback={<div className="flex h-full items-center justify-center text-muted-foreground text-sm">Loading...</div>}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/create" element={<WizardPage />} />
                <Route path="/project/:id" element={<ProjectPage />} />
                <Route path="/project/:projectId/agent/:agentId" element={<BriefEditor />} />
                <Route path="/project/:projectId/doc/:docId" element={<DocumentViewer />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </div>

          {/* Right panel — Console / Meeting */}
          <RightPanel />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  );
};

export default App;
