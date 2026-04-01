/**
 * AuthGateModal — Pre-build credential check.
 *
 * Opens before build starts. Shows checklist of required credentials
 * (Claude CLI, Azure CLI, Dataverse), fix suggestions, re-check button,
 * and environment selector. "Start Build" enables when all required checks pass.
 */
import { useTransition } from "react";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Rocket,
  Copy,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useBuildJobStore } from "@/stores/buildJobStore";

interface AuthGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AuthGateModal({ open, onOpenChange }: AuthGateModalProps) {
  const credCheck = useBuildJobStore((s) => s.credCheck);
  const refreshCredentials = useBuildJobStore((s) => s.refreshCredentials);
  const launchBuild = useBuildJobStore((s) => s.launchBuild);
  const closeAuthGate = useBuildJobStore((s) => s.closeAuthGate);

  const [refreshing, startRefresh] = useTransition();
  const [launching, startLaunch] = useTransition();

  const handleRefresh = () => {
    startRefresh(async () => {
      try {
        await refreshCredentials();
        toast.success("Credentials refreshed");
      } catch {
        toast.error("Failed to check credentials");
      }
    });
  };

  const handleLaunch = () => {
    startLaunch(async () => {
      try {
        await launchBuild();
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to start build");
      }
    });
  };

  const handleClose = () => {
    closeAuthGate();
    onOpenChange(false);
  };

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Failed to copy"),
    );
  };

  // Build the checklist
  const items = credCheck
    ? [
        {
          key: "claude",
          label: "Claude CLI",
          ok: credCheck.claude,
          required: true,
          fix: "Run: claude --version",
          detail: credCheck.details.claude,
        },
        {
          key: "az",
          label: "Azure CLI",
          ok: credCheck.az,
          required: true,
          fix: "az login",
          detail: credCheck.details.az,
        },
        ...(credCheck.dataverse !== null
          ? [{
              key: "dataverse",
              label: "Dataverse",
              ok: credCheck.dataverse,
              required: false,
              fix: "pac auth create --environment <url>",
              detail: credCheck.details.dataverse,
            }]
          : []),
      ]
    : [];

  const allRequiredPassing = items
    .filter((i) => i.required)
    .every((i) => i.ok);

  const isLoading = !credCheck;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Pre-Build Check
          </DialogTitle>
          <DialogDescription className="text-xs">
            Verify your credentials before starting the build.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Checking credentials...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.key}
                className={`flex items-start gap-3 rounded-md border px-3 py-2.5 ${
                  item.ok
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : item.required
                    ? "border-destructive/20 bg-destructive/5"
                    : "border-amber-500/20 bg-amber-500/5"
                }`}
              >
                <div className="mt-0.5">
                  {item.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className={`h-4 w-4 ${item.required ? "text-destructive" : "text-amber-500"}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.required && (
                      <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded">required</span>
                    )}
                  </div>
                  {item.detail && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                  )}
                  {!item.ok && item.fix && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono flex-1 truncate">
                        {item.fix}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyCommand(item.fix)}
                        className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                        title="Copy fix command"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Active environment display */}
            {credCheck?.azAccount && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 pl-1">
                Target: <span className="font-medium text-foreground">
                  {credCheck.azAccount.tenantName || credCheck.azAccount.tenantDomain || credCheck.azAccount.user}
                </span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || isLoading}
            className="text-xs"
          >
            {refreshing ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Re-check
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleLaunch}
            disabled={!allRequiredPassing || launching || isLoading}
            className="text-xs"
          >
            {launching ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Starting...</>
            ) : (
              <><Rocket className="h-3 w-3 mr-1" /> Start Build</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
