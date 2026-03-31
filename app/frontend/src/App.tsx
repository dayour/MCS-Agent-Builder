import { lazy, Suspense, Component, type ReactNode, type ErrorInfo } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router";
import RightPanel from "./components/terminal/RightPanel";
import { useTerminalStore } from "./stores/terminalStore";

// Lazy-loaded route components for code splitting
const Index = lazy(() => import("./pages/Index"));
const ProjectPage = lazy(() => import("./pages/ProjectPage"));
const BriefEditor = lazy(() => import("./pages/BriefEditor"));
const DocumentViewer = lazy(() => import("./pages/DocumentViewer"));
const WizardPage = lazy(() => import("./pages/WizardPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// ---------------------------------------------------------------------------
// Error Boundary — catches render errors with retry support
// ---------------------------------------------------------------------------

class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback || (
          <div className="flex h-full items-center justify-center p-8">
            <div className="text-center max-w-md">
              <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
              <p className="text-sm text-muted-foreground mb-4">{this.state.error.message}</p>
              <button
                onClick={() => this.setState({ error: null })}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90"
              >
                Try again
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Loading fallback
// ---------------------------------------------------------------------------

function LoadingFallback() {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        Loading...
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
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
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/create" element={<WizardPage />} />
                  <Route path="/project/:id" element={<ProjectPage />} />
                  <Route path="/project/:projectId/agent/:agentId" element={<BriefEditor />} />
                  <Route path="/project/:projectId/doc/:docId" element={<DocumentViewer />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </div>

          {/* Right panel — Console / Meeting */}
          <RightPanel />
        </div>
      </BrowserRouter>
    </TooltipProvider>
  );
}
