import { Component, type ReactNode, type ErrorInfo, useEffect } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  useRouteError,
  useLocation,
  useNavigation,
  useRevalidator,
  isRouteErrorResponse,
  Link,
} from "react-router";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import RightPanel from "./components/terminal/RightPanel";
import NavigationRail from "./components/nav/NavigationRail";
import { useTerminalStore } from "./stores/terminalStore";
import { fetchProjects, fetchProject, fetchAgent, fetchSolutions } from "@/lib/api";

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
// Route error element — catches loader/action errors
// ---------------------------------------------------------------------------

function RouteError() {
  const error = useRouteError();
  const is404 = isRouteErrorResponse(error) && error.status === 404;

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h2 className="text-lg font-semibold mb-2">
          {is404 ? "Page not found" : "Something went wrong"}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {is404
            ? "The page you're looking for doesn't exist."
            : error instanceof Error
              ? error.message
              : "An unexpected error occurred."}
        </p>
        <Link
          to="/"
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 inline-block"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App Shell — layout wrapper with right panel
// ---------------------------------------------------------------------------

function NavigationProgress() {
  const navigation = useNavigation();
  if (navigation.state === "idle") return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-primary/20">
      <div className="h-full bg-primary animate-progress-bar" />
    </div>
  );
}

function AppShell() {
  const panelOpen = useTerminalStore((s) => s.panelOpen);
  const panelWidth = useTerminalStore((s) => s.panelWidth);
  const location = useLocation();
  const revalidator = useRevalidator();

  // Re-run route loaders when the tab regains focus (stale-while-revalidate)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && revalidator.state === "idle") {
        revalidator.revalidate();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [revalidator]);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <NavigationProgress />
      {/* Left: Navigation rail */}
      <NavigationRail />
      {/* Center: Main content area */}
      <div
        className="flex-1 min-w-0 flex flex-col overflow-hidden"
        style={{ marginRight: panelOpen ? panelWidth : 0, transition: "margin-right 200ms ease" }}
      >
        {/* Key by pathname resets ErrorBoundary on navigation */}
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </div>
      {/* Right: Terminal / Meeting panel */}
      <ErrorBoundary>
        <RightPanel />
      </ErrorBoundary>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Router with data loaders — fetches start before component code downloads
// ---------------------------------------------------------------------------

const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        lazy: async () => {
          const { default: Component } = await import("./pages/Index");
          return { Component };
        },
        loader: () => fetchProjects(),
      },
      {
        path: "create",
        lazy: async () => {
          const { default: Component } = await import("./pages/WizardPage");
          return { Component };
        },
      },
      {
        path: "agents",
        lazy: async () => {
          const { default: Component } = await import("./pages/AgentsGallery");
          return { Component };
        },
        loader: () => fetchProjects(),
      },
      {
        path: "discover",
        lazy: async () => {
          const { default: Component } = await import("./pages/DiscoverPage");
          return { Component };
        },
        loader: () => fetchSolutions(),
      },
      {
        path: "project/:id",
        lazy: async () => {
          const { default: Component } = await import("./pages/ProjectPage");
          return { Component };
        },
        loader: ({ params }) => fetchProject(params.id!),
      },
      {
        path: "project/:projectId/agent/:agentId",
        lazy: async () => {
          const { default: Component } = await import("./pages/BriefEditor");
          return { Component };
        },
        loader: ({ params }) =>
          Promise.all([
            fetchProject(params.projectId!),
            fetchAgent(params.projectId!, params.agentId!),
          ]),
      },
      {
        path: "project/:projectId/doc/:docId",
        lazy: async () => {
          const { default: Component } = await import("./pages/DocumentViewer");
          return { Component };
        },
        loader: ({ params }) => fetchProject(params.projectId!),
      },
      {
        path: "*",
        lazy: async () => {
          const { default: Component } = await import("./pages/NotFound");
          return { Component };
        },
      },
    ],
  },
]);

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <TooltipProvider>
      <Sonner />
      <RouterProvider router={router} fallbackElement={<LoadingFallback />} />
    </TooltipProvider>
  );
}
