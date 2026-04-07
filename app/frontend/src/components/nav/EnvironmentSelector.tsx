/**
 * EnvironmentSelector — Shows current account + environment in the nav rail.
 *
 * Compact view when collapsed (icon only), expanded shows account name + env.
 * Click opens a popover with profile/environment switching and deletion.
 */
import { useEffect, useState } from "react";
import { Server, ChevronDown, RefreshCw, Check, Loader2, Trash2 } from "lucide-react";
import { useEnvStore } from "@/stores/envStore";
import { cn } from "@/lib/utils";

interface EnvironmentSelectorProps {
  expanded: boolean;
}

export default function EnvironmentSelector({ expanded }: EnvironmentSelectorProps) {
  const credentials = useEnvStore((s) => s.credentials);
  const loading = useEnvStore((s) => s.loading);
  const switching = useEnvStore((s) => s.switching);
  const activeProfile = useEnvStore((s) => s.activeProfile);
  const activeEnvironment = useEnvStore((s) => s.activeEnvironment);
  const loadCredentials = useEnvStore((s) => s.loadCredentials);
  const switchProfile = useEnvStore((s) => s.switchProfile);
  const switchEnvironment = useEnvStore((s) => s.switchEnvironment);
  const deleteProfile = useEnvStore((s) => s.deleteProfile);

  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // Load credentials on mount
  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  if (!credentials && !loading) return null;

  const accountLabel = activeProfile?.user?.split("@")[0] || credentials?.azAccount?.user?.split("@")[0] || "Not connected";
  const envLabel = activeEnvironment?.name || activeProfile?.environment || "No environment";

  return (
    <div className="relative px-2">
      <button
        type="button"
        onClick={() => { setOpen(!open); setConfirmDelete(null); }}
        disabled={loading}
        className={cn(
          "flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm transition-colors",
          "hover:bg-[hsl(var(--nav-background-hover))]",
          "text-[hsl(var(--nav-text-secondary))] hover:text-[hsl(var(--nav-text-primary))]",
        )}
        title={expanded ? undefined : `${accountLabel} · ${envLabel}`}
      >
        <Server className="h-4 w-4 shrink-0" />
        {expanded && (
          <>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-medium truncate text-[hsl(var(--nav-text-primary))]">
                {loading ? "Loading..." : accountLabel}
              </p>
              <p className="text-[10px] truncate text-[hsl(var(--nav-text-secondary))]">
                {loading ? "" : envLabel}
              </p>
            </div>
            <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-180")} />
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setConfirmDelete(null); }} />

          <div className="absolute bottom-full left-2 right-2 mb-1 z-50 rounded-xl border border-border bg-card shadow-lg p-2 max-h-80 overflow-y-auto animate-scale-in origin-bottom-left">
            {/* Refresh button */}
            <div className="flex items-center justify-between px-2 py-1 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Environment
              </span>
              <button
                type="button"
                onClick={() => loadCredentials()}
                disabled={loading || switching}
                className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Refresh"
              >
                <RefreshCw className={cn("h-3 w-3", (loading || switching) && "animate-spin")} />
              </button>
            </div>

            {/* Profiles */}
            {credentials && credentials.pacProfiles.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-medium text-muted-foreground px-2 mb-1">Account</p>
                {credentials.pacProfiles.map((profile) => (
                  <div
                    key={profile.index}
                    className={cn(
                      "flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-xs transition-colors group",
                      profile.active
                        ? "bg-[hsl(var(--brand-background))] text-primary font-medium"
                        : "hover:bg-muted text-foreground",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!profile.active) switchProfile(profile.index);
                      }}
                      disabled={switching}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    >
                      {profile.active ? (
                        <Check className="h-3 w-3 shrink-0" />
                      ) : (
                        <span className="w-3" />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="block truncate">{profile.user}</span>
                        <span className="block text-[10px] text-muted-foreground truncate">
                          {[profile.name, profile.environment].filter(Boolean).join(" · ") || "No environment"}
                        </span>
                      </div>
                    </button>
                    {/* Delete button */}
                    {confirmDelete === profile.index ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => { deleteProfile(profile.index); setConfirmDelete(null); }}
                          disabled={switching}
                          className="text-[10px] text-destructive hover:text-destructive/80 font-medium px-1"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(null)}
                          className="text-[10px] text-muted-foreground hover:text-foreground px-1"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(profile.index); }}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0"
                        title="Delete profile"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Environments */}
            {credentials && credentials.pacEnvironments.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground px-2 mb-1">Environment</p>
                {credentials.pacEnvironments.map((env) => (
                  <button
                    key={env.id}
                    type="button"
                    onClick={() => {
                      if (!env.active && env.id !== "profile-default") switchEnvironment(env.id);
                    }}
                    disabled={switching || env.id === "profile-default"}
                    className={cn(
                      "flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-xs transition-colors",
                      env.active
                        ? "bg-[hsl(var(--brand-background))] text-primary font-medium"
                        : "hover:bg-muted text-foreground",
                      env.id === "profile-default" && !env.active && "opacity-60",
                    )}
                  >
                    {env.active ? (
                      <Check className="h-3 w-3 shrink-0" />
                    ) : (
                      <span className="w-3" />
                    )}
                    <span className="truncate flex-1 text-left">{env.name}</span>
                    {env.id === "profile-default" && (
                      <span className="text-[9px] text-muted-foreground shrink-0">(from profile)</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Not connected state */}
            {credentials && credentials.pacProfiles.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-2">
                No PAC profiles found. Run <code className="text-[10px] bg-muted px-1 rounded">pac auth create</code> in the terminal.
              </p>
            )}

            {switching && (
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Switching...
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
