/**
 * OAuthPromptModal — Mid-build OAuth authorization prompt.
 *
 * Shown when the build runner detects ##AUTH_REQUIRED## from the PTY output.
 * Displays the system name and instructions, with a "Done" button that
 * calls POST /api/build/:jobId/auth-complete to resume the build.
 */
import { useState, useCallback } from "react";
import { KeyRound, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useBuildJobStore } from "@/stores/buildJobStore";

interface OAuthPromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function OAuthPromptModal({ open, onOpenChange }: OAuthPromptModalProps) {
  const job = useBuildJobStore((s) => s.job);
  const resumeAfterAuth = useBuildJobStore((s) => s.resumeAfterAuth);
  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const system = job?.authPrompt?.system || "External Service";
  const instructions = job?.authPrompt?.instructions || "Complete the authorization in your browser, then click Done.";

  const handleDone = useCallback(async () => {
    setResuming(true);
    setResumeError(null);
    try {
      await resumeAfterAuth();
      onOpenChange(false);
    } catch (err) {
      // Keep modal open and show inline error
      setResumeError(err instanceof Error ? err.message : "Failed to resume build");
    } finally {
      setResuming(false);
    }
  }, [resumeAfterAuth, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-500" />
            Authorization Required
          </DialogTitle>
          <DialogDescription className="text-xs">
            The build needs access to <span className="font-medium text-foreground">{system}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-sm leading-relaxed">{instructions}</p>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          <span>Complete the authorization in your browser, then click Done below.</span>
        </div>

        {resumeError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{resumeError}</span>
          </div>
        )}

        <DialogFooter>
          <Button
            size="sm"
            onClick={handleDone}
            disabled={resuming}
            className="text-xs w-full"
          >
            {resuming ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Resuming build...</>
            ) : (
              "I've completed authorization — Resume Build"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
