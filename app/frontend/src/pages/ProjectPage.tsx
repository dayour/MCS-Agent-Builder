import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Bot, Plus, Eye, Microscope, Hammer, FlaskConical,
  Wrench, Trash2, Loader2, Network, BookOpen, Check,
} from "lucide-react";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import ReadinessRing from "@/components/ReadinessRing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Agent, TerminalSession } from "@/types";
import type { SkillType } from "@/lib/api";
import { useProjectStore } from "@/stores/projectStore";
import { useTerminalStore } from "@/stores/terminalStore";
import { useSkillJobStore, getSkillJobKey } from "@/stores/skillJobStore";
import { getTerminalWsUrl } from "@/lib/api";
import DocumentDropZone from "@/components/DocumentDropZone";
import SkillProgressPanel from "@/components/build/SkillProgressPanel";

// ─── Pipeline color system ────────────────────────────────────────
// Each step has a consistent color used everywhere (buttons, badges, banners).

const PIPELINE_COLORS = {
  preview:  { active: "bg-violet-500/15 border-violet-500/40 text-violet-600 dark:text-violet-400", done: "text-violet-500 dark:text-violet-400" },
  research: { active: "bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400", done: "text-blue-500 dark:text-blue-400" },
  build:    { active: "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400", done: "text-amber-500 dark:text-amber-400" },
  evaluate: { active: "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400", done: "text-emerald-500 dark:text-emerald-400" },
  learning: { active: "bg-cyan-500/15 border-cyan-500/40 text-cyan-600 dark:text-cyan-400", done: "text-cyan-500 dark:text-cyan-400" },
} as const;

type PipelineStep = keyof typeof PIPELINE_COLORS;

// ─── Next action logic ────────────────────────────────────────────

function getNextAction(agent: Agent): PipelineStep {
  const wf = agent.workflowPhase;
  if (agent.evalPassRate !== null) return "learning";
  if (agent.status === "built") return "evaluate";
  if (wf === "ready_to_build" || wf === "decisions" || agent.status === "ready") return "build";
  if (agent.status === "researched") return "build";
  if (wf === "research") return "research";
  return "preview";
}

function isStepDone(step: PipelineStep, nextAction: PipelineStep): boolean {
  const order: PipelineStep[] = ["preview", "research", "build", "evaluate", "learning"];
  return order.indexOf(step) < order.indexOf(nextAction);
}

/** Check if a step can be run. Returns error message or null if OK. */
function validateStep(step: PipelineStep, agent: Agent): string | null {
  switch (step) {
    case "research":
      if (!agent.workflowPhase && agent.status === "draft") return "Run Preview first to scan documents.";
      return null;
    case "build":
      if (!agent.workflowPhase && agent.status === "draft") return "Run Preview and Research first.";
      if (agent.status === "draft" && agent.workflowPhase === "preview") return "Run Research first — preview needs to be confirmed and deep research completed.";
      return null;
    case "evaluate":
      if (agent.status !== "built" && agent.status !== "ready") return "Build the agent first before running evaluation.";
      return null;
    case "learning":
      if (agent.status !== "built" && agent.status !== "ready") return "Build the agent before capturing learnings.";
      return null;
    default:
      return null;
  }
}

// ─── Active Skill Jobs ────────────────────────────────────────────

function ActiveSkillJobs({ projectId, agents }: { projectId: string; agents: Agent[] }) {
  const jobs = useSkillJobStore((s) => s.jobs);
  const clearJob = useSkillJobStore((s) => s.clearJob);

  // Find all jobs for this project
  const projectJobs = Object.entries(jobs).filter(
    ([, job]) => job.projectId === projectId
  );

  if (projectJobs.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-foreground">Active Tasks</h2>
      <div className="space-y-3">
        {projectJobs.map(([key, job]) => {
          const agentName = agents.find((a) => a.id === job.agentId)?.name || job.agentId || "Project";
          return (
            <div key={key}>
              <p className="text-xs text-muted-foreground mb-1">
                {job.skillType} — {agentName}
              </p>
              <SkillProgressPanel
                jobKey={key}
                onClose={() => clearJob(key)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────

const ProjectPage = () => {
  const { id } = useParams<{ id: string }>();
  const {
    projectName, agents, loading, error, loadProject, removeAgent,
  } = useProjectStore();
  const { addSession: addTerminalSession } = useTerminalStore();
  const skillJobs = useSkillJobStore((s) => s.jobs);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentDesc, setAgentDesc] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  // Auto-clear action errors after 4s
  useEffect(() => {
    if (!actionError) return;
    const t = setTimeout(() => setActionError(null), 4000);
    return () => clearTimeout(t);
  }, [actionError]);

  useEffect(() => {
    if (id) loadProject(id);
  }, [id, loadProject]);

  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        useProjectStore.getState().refresh();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [id]);

  /** Map pipeline steps to skill types for the headless runner. */
  const HEADLESS_SKILLS: Partial<Record<PipelineStep | "fix", SkillType>> = {
    research: "research",
    build: "build",
    evaluate: "eval",
    fix: "fix",
  };

  /** Terminal commands for steps that don't have headless runners yet. */
  const TERMINAL_COMMANDS: Record<string, (projectId: string, agentId: string) => string> = {
    preview: (pid, aid) => `/mcs-research ${pid} ${aid} --fast`,
    learning: () => `/mcs-retro`,
  };

  const launchTerminal = async (type: string, agent: { id: string; name: string }) => {
    if (!id) return;
    const store = useTerminalStore.getState();
    const command = TERMINAL_COMMANDS[type]?.(id, agent.id);
    if (!command) return;

    const existingId = store.findSession(id);
    if (existingId) {
      store.setActiveSession(existingId);
      store.setPanelOpen(true);
      store.sendCommand(existingId, command);
      return;
    }

    const wsUrl = await getTerminalWsUrl();
    const session: TerminalSession = {
      id: `${id}-${Date.now()}`,
      label: projectName || id,
      type: "research" as TerminalSession["type"],
      projectId: id,
      agentName: agent.name,
      status: "connecting",
      wsUrl,
      command,
    };
    addTerminalSession(session);
  };

  const launchSkill = useSkillJobStore((s) => s.launchSkill);

  /** Try to launch a pipeline step. Validates prerequisites, then uses headless runner or terminal. */
  const handlePipelineClick = (step: PipelineStep, agent: Agent) => {
    if (!id) return;
    const err = validateStep(step, agent);
    if (err) {
      setActionError(err);
      return;
    }

    const skillType = HEADLESS_SKILLS[step];
    if (skillType) {
      launchSkill(skillType, id, agent.id);
    } else {
      launchTerminal(step, agent);
    }
  };

  /** Launch fix via headless runner. */
  const handleFixClick = (agent: Agent) => {
    if (!id) return;
    launchSkill("fix", id, agent.id);
  };

  const launchProjectPreview = () => {
    if (!id) return;
    // Preview uses research skill at project level (no agentId)
    launchSkill("research", id, "");
  };

  if (loading && agents.length === 0) {
    return (
      <Layout breadcrumbs={[{ label: "Loading..." }]}>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading project...
        </div>
      </Layout>
    );
  }

  return (
    <Layout breadcrumbs={[{ label: projectName || id || "" }]}>
      <div className="px-6 py-8">
        {error && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {actionError && (
          <div className="mb-4 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 animate-in fade-in">
            {actionError}
          </div>
        )}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{projectName}</h1>
          <Button size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white" onClick={launchProjectPreview}>
            <Eye className="h-3.5 w-3.5" /> Preview
          </Button>
        </div>

        <div className="space-y-8">
          {/* Agents */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Agents ({agents.length})</h2>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => setShowAgentForm(true)}>
                <Plus className="h-3 w-3" /> Add Agent
              </Button>
            </div>

            {showAgentForm && (
              <div className="mb-3 rounded-lg border border-border bg-card p-4 space-y-3">
                <Input placeholder="Agent name" value={agentName} onChange={(e) => setAgentName(e.target.value)} />
                <Input placeholder="Description" value={agentDesc} onChange={(e) => setAgentDesc(e.target.value)} />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => { setShowAgentForm(false); setAgentName(""); setAgentDesc(""); }}>Cancel</Button>
                  <Button size="sm" onClick={() => { setShowAgentForm(false); setAgentName(""); setAgentDesc(""); }}>Add</Button>
                </div>
              </div>
            )}

            {agents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                No agents yet. Upload documents and click Preview above.
              </div>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const childSet = new Set<string>();
                  const orchestrators = agents.filter((a) =>
                    a.architectureType?.includes("multi") && a.childAgentIds && a.childAgentIds.length > 0
                  );
                  orchestrators.forEach((o) => o.childAgentIds?.forEach((cid) => childSet.add(cid)));

                  const renderAgentCard = (agent: typeof agents[0], indent: boolean, badge?: string) => {
                    const isOrch = badge === "Orchestrator";
                    const AgentIcon = isOrch ? Network : Bot;
                    const nextAction = getNextAction(agent);
                    const hasFailures = agent.evalPassRate !== null && agent.evalPassRate < 70;

                    const STEPS: { key: PipelineStep; icon: React.ReactNode; label: string }[] = [
                      { key: "preview", icon: <Eye className="h-3 w-3" />, label: "Preview" },
                      { key: "research", icon: <Microscope className="h-3 w-3" />, label: "Research" },
                      { key: "build", icon: <Hammer className="h-3 w-3" />, label: "Build" },
                      { key: "evaluate", icon: <FlaskConical className="h-3 w-3" />, label: "Evaluate" },
                      { key: "learning", icon: <BookOpen className="h-3 w-3" />, label: "Learning" },
                    ];

                    return (
                      <div
                        key={agent.id}
                        className={`group rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/30 hover:bg-surface-2 ${
                          indent ? "ml-8 border-l-2 border-l-primary/20" : ""
                        } ${badge === "Specialist" ? "bg-surface-1" : ""}`}
                      >
                        <div className="flex items-center gap-4">
                          <Link
                            to={`/project/${id}/agent/${agent.id}`}
                            className="flex items-center gap-4 flex-1 min-w-0"
                          >
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isOrch ? "bg-primary/10" : "bg-surface-3"}`}>
                              <AgentIcon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                  {agent.name}
                                </h3>
                                <StatusBadge status={agent.status} />
                                {badge && (
                                  <span className={`text-[10px] font-medium rounded px-1.5 py-0.5 ${
                                    badge === "Orchestrator"
                                      ? "bg-primary/15 text-primary border border-primary/30"
                                      : "bg-muted text-muted-foreground border border-border"
                                  }`}>
                                    {badge}
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground truncate">{agent.description}</p>
                            </div>
                          </Link>
                          <ReadinessRing value={agent.readiness} size={36} />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive shrink-0"
                            onClick={(e) => { e.preventDefault(); removeAgent(agent.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {/* Pipeline buttons — ALL always visible */}
                        <div className="mt-3 flex items-center gap-1.5 pl-14">
                          {STEPS.map((step) => {
                            const isActive = nextAction === step.key;
                            const isDone = isStepDone(step.key, nextAction);
                            const colors = PIPELINE_COLORS[step.key];
                            // Check if a headless skill is running for this step
                            const skillType = HEADLESS_SKILLS[step.key];
                            const skillKey = skillType && id ? getSkillJobKey(id, agent.id, skillType) : null;
                            const skillRunning = skillKey ? !!(skillJobs[skillKey] && (skillJobs[skillKey].phase === "starting" || skillJobs[skillKey].phase === "running")) : false;
                            return (
                              <Button
                                key={step.key}
                                variant="outline"
                                size="sm"
                                disabled={skillRunning}
                                className={`h-6 gap-1 text-[11px] transition-all ${
                                  skillRunning
                                    ? `${colors.active} font-medium opacity-80`
                                    : isActive
                                    ? `${colors.active} font-medium`
                                    : isDone
                                    ? `border-transparent bg-transparent ${colors.done}`
                                    : "border-border text-muted-foreground/40"
                                }`}
                                onClick={() => handlePipelineClick(step.key, agent)}
                              >
                                {skillRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : isDone ? <Check className="h-3 w-3" /> : step.icon}
                                {step.label}
                              </Button>
                            );
                          })}
                          {agent.evalPassRate !== null && (
                            <span className={`text-[10px] font-medium ml-1 ${agent.evalPassRate >= 70 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                              {agent.evalPassRate}%
                            </span>
                          )}
                          {hasFailures && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 gap-1 text-[11px] bg-red-500/15 border-red-500/40 text-red-600 dark:text-red-400"
                              onClick={() => handleFixClick(agent)}
                            >
                              <Wrench className="h-3 w-3" /> Fix
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  };

                  const rendered: React.ReactNode[] = [];
                  for (const orch of orchestrators) {
                    rendered.push(renderAgentCard(orch, false, "Orchestrator"));
                    for (const cid of orch.childAgentIds ?? []) {
                      const child = agents.find((a) => a.id === cid);
                      if (child) rendered.push(renderAgentCard(child, true, "Specialist"));
                    }
                  }
                  for (const agent of agents) {
                    if (orchestrators.includes(agent) || childSet.has(agent.id)) continue;
                    rendered.push(renderAgentCard(agent, false));
                  }
                  return rendered;
                })()}
              </div>
            )}
          </div>

          {/* Active Skill Jobs */}
          {id && <ActiveSkillJobs projectId={id} agents={agents} />}

          {/* Documents */}
          {id && <DocumentDropZone projectId={id} />}
        </div>
      </div>
    </Layout>
  );
};

export default ProjectPage;
