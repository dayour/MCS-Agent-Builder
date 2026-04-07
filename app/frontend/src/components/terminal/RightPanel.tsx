/**
 * RightPanel — VS Code-style right sidebar for Console + Meeting.
 *
 * Fixed to the right edge of the viewport. Resizable via left-edge drag handle.
 * Contains two tabs: Console (terminal sessions) and Meeting (co-pilot).
 */
import { useRef, useCallback, useState } from "react";
import { X, Plus, Circle, Terminal, Headphones } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTerminalStore, type TerminalSession } from "@/stores/terminalStore";
import { useMeetingStore } from "@/stores/meetingStore";
import { getTerminalWsUrl } from "@/lib/api";
import XTerminal from "./XTerminal";
import { MeetingPanel } from "@/components/meeting";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  connecting: "text-warning animate-pulse",
  running: "text-success",
  stopped: "text-muted-foreground",
  error: "text-destructive",
};

const statusLabels: Record<string, string> = {
  connecting: "Connecting...",
  running: "Running",
  stopped: "Stopped",
  error: "Error",
};

const typeColors: Record<string, string> = {
  research: "bg-info/15 text-info",
  build: "bg-warning/15 text-warning",
  evaluate: "bg-success/15 text-success",
};

const RightPanel = () => {
  const {
    sessions, activeSessionId, panelOpen, panelWidth, activeTab,
    setActiveSession, removeSession, setPanelOpen, setPanelWidth, setActiveTab, addSession,
  } = useTerminalStore();
  const meetingPhase = useMeetingStore((s) => s.phase);
  const meetingProjectId = useMeetingStore((s) => s.projectId);
  const [isResizing, setIsResizing] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      startX.current = e.clientX;
      startWidth.current = panelWidth;

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = startX.current - ev.clientX;
        setPanelWidth(startWidth.current + delta);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [panelWidth, setPanelWidth]
  );

  const hasMeeting = meetingPhase !== "idle" || activeTab === "meeting";
  if (sessions.length === 0 && !hasMeeting && !panelOpen) return null;

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div
      className={`fixed top-14 right-0 bottom-0 z-30 flex flex-col border-l border-border bg-[#0a0e14] shadow-2xl ${isResizing ? '' : 'transition-[width] duration-200'} overflow-hidden`}
      style={{
        width: panelOpen ? panelWidth : 0,
      }}
    >
      {/* Resize handle — left edge */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 transition-colors z-50"
        onMouseDown={handleMouseDown}
      />

      {/* Tab bar — top row */}
      <div className="flex items-center border-b border-border/50 bg-[#0d1117] shrink-0">
        {/* Top-level tab selectors */}
        <button
          onClick={() => setActiveTab("console")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-r border-border/30 transition-colors",
            activeTab === "console"
              ? "bg-[#0a0e14] text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-[#0a0e14]/50"
          )}
        >
          <Terminal className="h-3 w-3" />
          Console
        </button>
        <button
          onClick={() => setActiveTab("meeting")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-r border-border/30 transition-colors",
            activeTab === "meeting"
              ? "bg-[#0a0e14] text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-[#0a0e14]/50"
          )}
        >
          <Headphones className="h-3 w-3" />
          Meeting
          {meetingPhase === "active" && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-1 px-2 shrink-0">
          {activeTab === "console" && activeSession && (
            <span className={cn("text-[10px] mr-2", statusColors[activeSession.status])}>
              {statusLabels[activeSession.status]}
            </span>
          )}
          {activeTab === "console" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={async () => {
                try {
                  const wsUrl = await getTerminalWsUrl();
                  const newSession: TerminalSession = {
                    id: crypto.randomUUID(),
                    label: "Terminal",
                    type: "system",
                    projectId: "system",
                    agentName: "Terminal",
                    status: "connecting",
                    wsUrl,
                  };
                  addSession(newSession);
                } catch {
                  const port = parseInt(window.location.port || "8000", 10);
                  const newSession: TerminalSession = {
                    id: crypto.randomUUID(),
                    label: "Terminal",
                    type: "system",
                    projectId: "system",
                    agentName: "Terminal",
                    status: "connecting",
                    wsUrl: `ws://localhost:${port}/ws`,
                  };
                  addSession(newSession);
                }
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => setPanelOpen(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Session sub-tabs (console only) */}
      {activeTab === "console" && sessions.length > 1 && (
        <div className="flex items-center border-b border-border/30 bg-[#0d1117]/50 shrink-0 overflow-x-auto scrollbar-none">
          {sessions.map((session) => (
            <div
              key={session.id}
              role="tab"
              tabIndex={0}
              aria-selected={session.id === activeSessionId}
              onClick={() => setActiveSession(session.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveSession(session.id); } }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] border-r border-border/20 shrink-0 transition-colors cursor-pointer",
                session.id === activeSessionId
                  ? "bg-[#0a0e14] text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-[#0a0e14]/50"
              )}
            >
              <Circle className={cn("h-1.5 w-1.5 fill-current", statusColors[session.status])} />
              {session.type !== "system" && (
                <span className={cn("inline-flex items-center rounded px-1 py-0.5 text-[9px] font-medium", typeColors[session.type])}>
                  {session.type}
                </span>
              )}
              <span className="max-w-[80px] truncate">{session.agentName}</span>
              <button
                onClick={(e) => { e.stopPropagation(); removeSession(session.id); }}
                className="ml-0.5 rounded p-0.5 hover:bg-muted/20"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-hidden p-1">
        {activeTab === "console" ? (
          sessions.map((session) => (
            <XTerminal
              key={session.id}
              session={session}
              visible={session.id === activeSessionId}
            />
          ))
        ) : (
          <div className="h-full overflow-auto p-2 bg-background rounded">
            {meetingProjectId ? (
              <MeetingPanel projectId={meetingProjectId} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Open a project and click "Meeting Mode" to start
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RightPanel;
