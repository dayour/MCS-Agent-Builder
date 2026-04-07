import { useState } from "react";
import { Link } from "react-router";
import { ChevronRight, Bug, Lightbulb, Terminal, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTerminalStore } from "@/stores/terminalStore";
import { useMeetingStore } from "@/stores/meetingStore";
import FeedbackDialog from "@/components/FeedbackDialog";
import ThemeToggle from "@/components/ThemeToggle";

interface LayoutProps {
  children: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

const Layout = ({ children, breadcrumbs }: LayoutProps) => {
  const { panelOpen, setPanelOpen, setActiveTab, activeTab, sessions } = useTerminalStore();
  const meetingPhase = useMeetingStore((s) => s.phase);
  const [feedbackType, setFeedbackType] = useState<"bug" | "suggestion">("bug");
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="shrink-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="flex h-12 items-center px-5">
          {/* Breadcrumbs (site nav moved to NavigationRail) */}
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="flex items-center gap-1.5 text-sm">
              {breadcrumbs.map((crumb) => (
                <span key={crumb.href ?? crumb.label} className="flex items-center gap-1.5">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  {crumb.href ? (
                    <Link to={crumb.href} className="text-muted-foreground transition-colors hover:text-foreground">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-foreground font-medium">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => { setFeedbackType("bug"); setFeedbackOpen(true); }}
            >
              <Bug className="h-3.5 w-3.5" /> Bug
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-warning"
              onClick={() => { setFeedbackType("suggestion"); setFeedbackOpen(true); }}
            >
              <Lightbulb className="h-3.5 w-3.5" /> Suggest
            </Button>
            <Button
              variant={panelOpen && activeTab === "console" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                if (panelOpen && activeTab === "console") { setPanelOpen(false); }
                else { setActiveTab("console"); }
              }}
            >
              <Terminal className="h-3.5 w-3.5" />
              Console
              {sessions.length > 0 && (
                <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-[10px] font-medium text-primary">
                  {sessions.length}
                </span>
              )}
            </Button>
            <Button
              variant={panelOpen && activeTab === "meeting" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                if (panelOpen && activeTab === "meeting") { setPanelOpen(false); }
                else { setActiveTab("meeting"); }
              }}
            >
              <Headphones className="h-3.5 w-3.5" />
              Meeting
              {meetingPhase === "active" && (
                <span className="ml-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </Button>
            <div className="mx-1 h-4 w-px bg-border" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto animate-fade-in">
        {children}
      </main>

      <FeedbackDialog type={feedbackType} open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  );
};

export default Layout;
