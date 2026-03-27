/**
 * AccountSwitcher — Dialog for viewing and switching Azure/PAC auth profiles.
 *
 * Triggered by clicking the auth status dots in the wizard BottomBar.
 * Shows current account, available PAC profiles, environments, and
 * provides switch actions + copy-paste commands for az login.
 */
import { useState, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  User,
  Building2,
  Globe,
  RefreshCw,
  Copy,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { CredentialCheck } from "@/lib/api";
import { switchPacProfile, switchPacEnvironment, checkCredentials } from "@/lib/api";

interface AccountSwitcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credCheck: CredentialCheck;
  onCredRefresh: (check: CredentialCheck) => void;
}

export default function AccountSwitcher({
  open,
  onOpenChange,
  credCheck,
  onCredRefresh,
}: AccountSwitcherProps) {
  const [switching, setSwitching] = useState<number | null>(null);
  const [switchingEnv, setSwitchingEnv] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleSwitchProfile = useCallback(async (index: number) => {
    setSwitching(index);
    try {
      const result = await switchPacProfile(index);
      toast.success(`Switched to ${result.activeUser}`);
      // Refresh credentials after switch
      const updated = await checkCredentials();
      onCredRefresh(updated);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSwitching(null);
    }
  }, [onCredRefresh]);

  const handleSwitchEnv = useCallback(async (envId: string) => {
    setSwitchingEnv(envId);
    try {
      await switchPacEnvironment(envId);
      toast.success("Environment switched");
      const updated = await checkCredentials();
      onCredRefresh(updated);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSwitchingEnv(null);
    }
  }, [onCredRefresh]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const updated = await checkCredentials();
      onCredRefresh(updated);
      toast.success("Credentials refreshed");
    } catch {
      toast.error("Failed to check credentials");
    } finally {
      setRefreshing(false);
    }
  }, [onCredRefresh]);

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Failed to copy — check clipboard permissions"),
    );
  };

  const { azAccount, pacProfiles, pacEnvironments } = credCheck;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Account & Environment
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 min-h-0">
          {/* Current Status */}
          <section className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current Status</h3>
            <div className="grid gap-1.5">
              <StatusRow
                label="Claude CLI"
                ok={credCheck.claude}
                detail={credCheck.details.claude}
              />
              <StatusRow
                label="Azure CLI"
                ok={credCheck.az}
                detail={credCheck.details.az}
                action={!credCheck.az ? (
                  <CopyButton command="az login" onCopy={copyCommand} />
                ) : undefined}
              />
              <StatusRow
                label="Dataverse"
                ok={credCheck.dataverse}
                detail={credCheck.details.dataverse}
              />
            </div>
          </section>

          {/* Azure Account */}
          {azAccount && (
            <section className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Azure Account</h3>
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{azAccount.user}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  <span>{azAccount.tenantName || azAccount.tenantDomain || azAccount.tenantId}</span>
                </div>
                {azAccount.tenantDomain && azAccount.tenantName && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Globe className="h-3 w-3" />
                    <span>{azAccount.tenantDomain}</span>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                To switch Azure tenant, run in terminal:
              </p>
              <div className="flex items-center gap-1">
                <code className="flex-1 text-[10px] bg-muted px-2 py-1 rounded font-mono">
                  az login --tenant &lt;tenant-id&gt;
                </code>
                <CopyButton command="az login --tenant " onCopy={copyCommand} />
              </div>
            </section>
          )}

          {/* PAC Profiles */}
          {pacProfiles.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Power Platform Profiles
              </h3>
              <div className="space-y-1">
                {pacProfiles.map((profile) => (
                  <button
                    key={profile.index}
                    type="button"
                    disabled={profile.active || switching !== null}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors w-full text-left",
                      profile.active
                        ? "border-primary/40 bg-primary/5"
                        : "border-border hover:bg-muted/50 cursor-pointer"
                    )}
                    onClick={() => handleSwitchProfile(profile.index)}
                  >
                    <div className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      profile.active ? "bg-primary" : "bg-muted-foreground/30"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">
                          {profile.name || `Profile ${profile.index}`}
                        </span>
                        {profile.active && (
                          <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                            active
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground truncate block">
                        {profile.user}
                      </span>
                      {profile.environment && (
                        <span className="text-muted-foreground/60 truncate block">
                          {profile.environment}
                        </span>
                      )}
                    </div>
                    {!profile.active && (
                      switching === profile.index ? (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                      )
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Environments for current profile */}
          {pacEnvironments.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Environments
              </h3>
              <div className="space-y-1">
                {pacEnvironments.map((env) => (
                  <button
                    key={env.id}
                    type="button"
                    disabled={env.active || switchingEnv !== null}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors w-full text-left",
                      env.active
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-border hover:bg-muted/50 cursor-pointer"
                    )}
                    onClick={() => handleSwitchEnv(env.id)}
                  >
                    <div className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      env.active ? "bg-emerald-500" : "bg-muted-foreground/30"
                    )} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{env.name}</span>
                      {env.active && (
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-medium ml-1.5">
                          active
                        </span>
                      )}
                      <span className="text-muted-foreground/60 truncate block">
                        {env.url}
                      </span>
                    </div>
                    {!env.active && (
                      switchingEnv === env.id ? (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                      )
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-border/40">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs"
          >
            {refreshing ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Re-check
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function StatusRow({
  label,
  ok,
  detail,
  action,
}: {
  label: string;
  ok: boolean | null;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok === true ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      ) : ok === false ? (
        <XCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      ) : (
        <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
      )}
      <span className="font-medium w-20">{label}</span>
      <span className="flex-1 text-muted-foreground truncate">{detail}</span>
      {action}
    </div>
  );
}

function CopyButton({ command, onCopy }: { command: string; onCopy: (cmd: string) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onCopy(command); }}
      className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
      title="Copy command"
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}
