import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHelperStore } from "@/stores/helperStore";
import { HelperHeader } from "./HelperHeader";
import { HelperMessages } from "./HelperMessages";
import { HelperInput } from "./HelperInput";

interface HelperPanelProps {
  projectId: string;
  agentName?: string;
}

export function HelperPanel({ projectId, agentName }: HelperPanelProps) {
  const phase = useHelperStore((s) => s.phase);
  const currentProjectId = useHelperStore((s) => s.projectId);
  const init = useHelperStore((s) => s.init);
  const error = useHelperStore((s) => s.error);

  // Auto-init when projectId changes and we're idle
  useEffect(() => {
    if (phase === "idle" && projectId) {
      init(projectId, agentName);
    }
  }, [projectId, agentName, phase, init]);

  // Re-init if project changed
  useEffect(() => {
    if (currentProjectId && currentProjectId !== projectId && phase !== "idle") {
      init(projectId, agentName);
    }
  }, [projectId, agentName, currentProjectId, phase, init]);

  if (phase === "idle") {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <span className="text-sm">Helper not initialized</span>
        <Button size="sm" onClick={() => init(projectId, agentName)}>
          <Loader2 className="h-3.5 w-3.5 mr-1.5" />
          Load Context
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <HelperHeader />
      {error && (
        <div className="px-3 py-1.5 text-xs text-destructive bg-destructive/10 border-b border-destructive/20">
          {error}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-hidden">
        <HelperMessages />
      </div>
      <HelperInput />
    </div>
  );
}
