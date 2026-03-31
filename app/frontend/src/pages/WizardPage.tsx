import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useWizardStore } from "@/stores/wizardStore";
import { useBuildJobStore } from "@/stores/buildJobStore";
import WizardLayout from "@/components/wizard/WizardLayout";
import BuildProgressPanel from "@/components/build/BuildProgressPanel";
import AuthGateModal from "@/components/build/AuthGateModal";
import OAuthPromptModal from "@/components/build/OAuthPromptModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  RotateCcw,
  History,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Rocket,
  ExternalLink,
  Loader2,
  FileEdit,
  Hammer,
} from "lucide-react";
import { checkCredentials, type CredentialCheck } from "@/lib/api";
import AccountSwitcher from "@/components/wizard/AccountSwitcher";

/** Start the guided interview with an opening greeting + example chips. */
function startInterview() {
  useWizardStore.setState({
    mode: "interview",
    phase: "chatting",
    messages: [
      {
        id: `msg-${Date.now()}-0`,
        role: "assistant",
        content:
          "Hi! I'm here to help you design your agent. Let's start with the basics — **what problem are you trying to solve, and who experiences it?**",
        timestamp: new Date().toISOString(),
        wizardState: {
          ...useWizardStore.getState().currentState,
          suggestions: [
            {
              label: "Customer support",
              value:
                "I want to build an agent that handles customer support questions",
              type: "example" as const,
            },
            {
              label: "HR assistant",
              value:
                "I need an HR assistant that helps employees with policy questions",
              type: "example" as const,
            },
            {
              label: "IT helpdesk",
              value:
                "I want an IT helpdesk agent that troubleshoots common issues",
              type: "example" as const,
            },
          ],
          activeSection: "business",
        },
      },
    ],
  });
}

export default function WizardPage() {
  const phase = useWizardStore((s) => s.phase);
  const hasSavedSession = useWizardStore((s) => s.hasSavedSession);
  const restoreSession = useWizardStore((s) => s.restoreSession);
  const [credCheck, setCredCheck] = useState<CredentialCheck | null>(null);

  // Check credentials on mount — non-blocking, fire-and-forget
  useEffect(() => {
    checkCredentials().then(setCredCheck).catch(() => {});
  }, []);

  // Auto-start the interview when idle and no saved session.
  // Deps include phase and hasSavedSession so this also works after reset().
  useEffect(() => {
    if (phase === "idle" && !hasSavedSession) {
      startInterview();
    }
  }, [phase, hasSavedSession]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <WizardHeader />

      {/* Credential banner — warn early about missing auth */}
      {credCheck && !credCheck.ready && phase !== "complete" && (
        <CredentialBanner check={credCheck} />
      )}

      {/* Main content */}
      {phase === "idle" && hasSavedSession ? (
        <ResumePrompt onResume={restoreSession} onStartFresh={() => {
          useWizardStore.getState().reset();
          startInterview();
        }} />
      ) : phase === "complete" ? (
        <CompletionScreen />
      ) : (
        <WizardLayout />
      )}

      {/* Bottom bar — auth status + save controls */}
      {phase !== "idle" && phase !== "complete" && <BottomBar credCheck={credCheck} onCredRefresh={setCredCheck} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Credential Banner — shows missing auth early
// ---------------------------------------------------------------------------

function CredentialBanner({ check }: { check: CredentialCheck }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const items = [
    { key: "claude", label: "Claude CLI", ok: check.claude },
    { key: "az", label: "Azure CLI", ok: check.az },
    ...(check.dataverse !== null
      ? [{ key: "dataverse", label: "Dataverse", ok: check.dataverse }]
      : []),
  ];

  const missing = items.filter((i) => !i.ok);
  if (missing.length === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-sm shrink-0">
      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
      <div className="flex-1 flex items-center gap-4">
        <span className="text-amber-700 dark:text-amber-400 font-medium">
          Build credentials needed:
        </span>
        {items.map((item) => (
          <span key={item.key} className="flex items-center gap-1 text-xs">
            {item.ok ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            ) : (
              <XCircle className="h-3 w-3 text-amber-500" />
            )}
            <span className={item.ok ? "text-muted-foreground" : "text-foreground"}>
              {item.label}
            </span>
            {!item.ok && check.details[item.key] && (
              <code className="text-[10px] bg-muted px-1 rounded">
                {check.details[item.key]}
              </code>
            )}
          </span>
        ))}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        dismiss
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function WizardHeader() {
  const phase = useWizardStore((s) => s.phase);
  const reset = useWizardStore((s) => s.reset);

  return (
    <header className="flex items-center gap-3 px-4 h-14 border-b border-border/40 bg-background/95 backdrop-blur-sm shrink-0">
      <Link
        to="/"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Projects</span>
      </Link>

      <div className="h-4 w-px bg-border/60" />

      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-semibold">Agent Wizard</h1>
      </div>

      <div className="flex-1" />

      {phase !== "idle" && phase !== "complete" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          className="text-xs text-muted-foreground"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Start Over
        </Button>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Resume Prompt — shown only when a saved session exists
// ---------------------------------------------------------------------------

function ResumePrompt({
  onResume,
  onStartFresh,
}: {
  onResume: () => void;
  onStartFresh: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <History className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold mb-1">Welcome back</h2>
          <p className="text-sm text-muted-foreground">
            You have an unfinished session. Would you like to pick up where you
            left off?
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={onResume}>Resume Session</Button>
          <Button variant="outline" onClick={onStartFresh}>
            Start Fresh
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bottom Bar — Save controls
// ---------------------------------------------------------------------------

function BottomBar({ credCheck, onCredRefresh }: { credCheck: CredentialCheck | null; onCredRefresh: (check: CredentialCheck) => void }) {
  const phase = useWizardStore((s) => s.phase);
  const currentState = useWizardStore((s) => s.currentState);
  const saveBrief = useWizardStore((s) => s.saveBrief);
  const error = useWizardStore((s) => s.error);

  const [projectName, setProjectName] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);

  const agentName = currentState.draft.identity?.name || "New Agent";
  const canSave = currentState.readyToSave;

  const handleSave = useCallback(async () => {
    const name = projectName.trim() || agentName;
    setSaving(true);
    try {
      await saveBrief(name);
      // Stay on page — pagePhase transitions to "enriching" via store
    } finally {
      setSaving(false);
    }
  }, [projectName, agentName, saveBrief]);

  // Auth status dots
  const authItems = credCheck
    ? [
        { key: "claude", label: "Claude", ok: credCheck.claude },
        { key: "az", label: "Azure", ok: credCheck.az },
        ...(credCheck.dataverse !== null
          ? [{ key: "dv", label: "Dataverse", ok: credCheck.dataverse }]
          : []),
      ]
    : [];

  // Summary label for the active account (shown next to dots)
  const activeLabel = credCheck?.azAccount
    ? credCheck.azAccount.tenantName || credCheck.azAccount.tenantDomain || credCheck.azAccount.user
    : null;

  return (
    <>
      <div className="flex items-center gap-3 px-4 h-14 border-t border-border/40 bg-muted/20 shrink-0">
        {/* Auth status dots — clickable to open AccountSwitcher */}
        {authItems.length > 0 && (
          <button
            onClick={() => setShowAccountSwitcher(true)}
            className="flex items-center gap-3 hover:bg-muted/50 rounded-md px-2 py-1 -ml-2 transition-colors"
            title="Account & environment settings"
          >
            {authItems.map((item) => (
              <span key={item.key} className="flex items-center gap-1 text-[11px]">
                {item.ok ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                ) : (
                  <XCircle className="h-3 w-3 text-amber-500" />
                )}
                <span className={item.ok ? "text-muted-foreground" : "text-foreground"}>
                  {item.label}
                </span>
              </span>
            ))}
            {activeLabel && (
              <span className="text-[10px] text-muted-foreground/60 ml-1 hidden sm:inline">
                {activeLabel}
              </span>
            )}
          </button>
        )}

        {error && (
          <p className="text-xs text-destructive truncate max-w-[300px]">{error}</p>
        )}

        <div className="flex-1" />

        {showSave ? (
          <div className="flex items-center gap-2">
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project name"
              className="h-8 w-48 text-xs"
            />
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="text-xs"
            >
              {saving ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving...</>
              ) : (
                <><Rocket className="h-3 w-3 mr-1" /> Save & Build</>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowSave(false)}
              className="text-xs"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={() => setShowSave(true)}
            disabled={!canSave}
            className="text-xs"
          >
            <Rocket className="h-3 w-3 mr-1" />
            Save & Build
          </Button>
        )}
      </div>

      {/* Account Switcher Dialog */}
      {credCheck && (
        <AccountSwitcher
          open={showAccountSwitcher}
          onOpenChange={setShowAccountSwitcher}
          credCheck={credCheck}
          onCredRefresh={onCredRefresh}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Completion Screen — save → enrich → auth gate → build → done
// ---------------------------------------------------------------------------

function CompletionScreen() {
  const projectId = useWizardStore((s) => s.projectId);
  const agentId = useWizardStore((s) => s.agentId);
  const enrichJobId = useWizardStore((s) => s.enrichJobId);
  const navigate = useNavigate();

  // Build job store
  const buildPhase = useBuildJobStore((s) => s.phase);
  const openAuthGate = useBuildJobStore((s) => s.openAuthGate);
  const resetBuild = useBuildJobStore((s) => s.reset);

  // Auth gate modal state
  const [showAuthGate, setShowAuthGate] = useState(false);

  // OAuth prompt — shown when build pauses for mid-build auth
  const showOAuth = buildPhase === "paused_auth";

  // Determine if build is active or completed
  const buildActive = buildPhase === "starting" || buildPhase === "running" || buildPhase === "paused_auth";
  const buildDone = buildPhase === "completed" || buildPhase === "failed";

  // Handle "Start Build" button
  const handleStartBuild = useCallback(async () => {
    if (!projectId || !agentId) return;
    await openAuthGate(projectId, agentId);
    setShowAuthGate(true);
  }, [projectId, agentId, openAuthGate]);

  // Clean up build store on unmount
  useEffect(() => {
    return () => { resetBuild(); };
  }, [resetBuild]);

  // Status icon helper — uses same status strings as BuildProgressPanel
  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "running": return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <div className="h-4 w-4 rounded-full border-2 border-border" />;
    }
  };

  // Top-level steps (save/enrich are always visible; build shown when active)
  const topSteps = [
    { id: "save", label: "Brief saved", status: "completed" },
    { id: "enrich", label: "Enriching brief", status: enrichJobId ? "running" : "pending" },
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="h-7 w-7 text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold">
            {buildDone
              ? buildPhase === "completed" ? "Agent Built!" : "Build Failed"
              : "Agent brief created!"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {buildActive
              ? "Building your agent in the background..."
              : buildDone
              ? buildPhase === "completed"
                ? "Your agent has been built and published."
                : "The build encountered errors. Check the details below."
              : "Ready to build your agent."}
          </p>
        </div>

        {/* Top-level steps (save + enrich) — shown when no build active */}
        {!buildActive && !buildDone && (
          <div className="space-y-3 py-2">
            {topSteps.map((step) => (
              <div key={step.id} className="flex items-center gap-3">
                {statusIcon(step.status)}
                <span className={`text-sm ${step.status === "pending" ? "text-muted-foreground" : "text-foreground"}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Build Progress Panel — shown when build is active or done */}
        {(buildActive || buildDone) && (
          <div className="rounded-lg border border-border bg-card">
            <BuildProgressPanel />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 justify-center pt-2">
          {/* Start Build button — shown before build starts */}
          {!buildActive && !buildDone && (
            <Button
              onClick={handleStartBuild}
              disabled={!projectId || !agentId}
              size="sm"
            >
              <Hammer className="h-3 w-3 mr-1" />
              Start Build
            </Button>
          )}

          <Button
            onClick={() => {
              if (projectId && agentId) navigate(`/project/${projectId}/agent/${agentId}`);
            }}
            disabled={!projectId || !agentId}
            variant="outline"
            size="sm"
          >
            <FileEdit className="h-3 w-3 mr-1" />
            Edit in Brief Editor
          </Button>
          <Button
            onClick={() => {
              if (projectId) navigate(`/project/${projectId}`);
            }}
            disabled={!projectId}
            variant="outline"
            size="sm"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View Project
          </Button>
        </div>
      </div>

      {/* Auth Gate Modal */}
      <AuthGateModal
        open={showAuthGate}
        onOpenChange={setShowAuthGate}
      />

      {/* OAuth Prompt Modal — mid-build auth */}
      <OAuthPromptModal
        open={showOAuth}
        onOpenChange={() => {}} // Can't dismiss — must complete auth
      />
    </div>
  );
}
