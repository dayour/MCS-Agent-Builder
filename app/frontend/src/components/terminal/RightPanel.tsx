/**
 * RightPanel — Helper chatbot sidebar.
 *
 * Fixed to the right edge of the viewport. Resizable via left-edge drag handle.
 * Content: Helper (context-loaded AI chatbot via API-direct).
 */
import { useRef, useCallback, useState } from "react";
import { X, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHelperStore } from "@/stores/helperStore";
import { HelperPanel } from "@/components/helper";

/** Panel state — stored locally since terminal store is gone. */
import { create } from "zustand";

interface PanelState {
  panelOpen: boolean;
  panelWidth: number;
  setPanelOpen: (open: boolean) => void;
  setPanelWidth: (w: number) => void;
  togglePanel: () => void;
}

export const usePanelStore = create<PanelState>((set) => ({
  panelOpen: false,
  panelWidth: 480,
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setPanelWidth: (w) => set({ panelWidth: Math.max(320, Math.min(900, w)) }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
}));

const RightPanel = () => {
  const { panelOpen, panelWidth, setPanelOpen, setPanelWidth } = usePanelStore();
  const helperPhase = useHelperStore((s) => s.phase);
  const helperProjectId = useHelperStore((s) => s.projectId);
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

  if (!panelOpen) return null;

  return (
    <div
      className={`fixed top-14 right-0 bottom-0 z-30 flex flex-col border-l border-border bg-[#0a0e14] shadow-2xl ${isResizing ? '' : 'transition-[width] duration-200'} overflow-hidden`}
      style={{ width: panelOpen ? panelWidth : 0 }}
    >
      {/* Resize handle — left edge */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30 transition-colors z-50"
        onMouseDown={handleMouseDown}
      />

      {/* Header bar */}
      <div className="flex items-center border-b border-border/50 bg-[#0d1117] shrink-0">
        <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-foreground">
          <MessageCircle className="h-3 w-3" />
          Helper
          {helperPhase === "streaming" && (
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          )}
          {helperPhase === "ready" && (
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          )}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1 px-2 shrink-0">
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

      {/* Content area */}
      <div className="flex-1 overflow-hidden p-1">
        <div className="h-full overflow-auto bg-background rounded">
          {helperProjectId ? (
            <HelperPanel projectId={helperProjectId} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Open a project to start the Helper
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RightPanel;
