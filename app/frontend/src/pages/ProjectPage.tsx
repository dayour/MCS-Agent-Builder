import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import {
  Loader2, Trash2, ChevronRight, Microscope, Hammer,
  FlaskConical, Wrench, Package, MoreHorizontal, Eye,
} from "lucide-react";
import Layout from "@/components/Layout";
import AgentIconBadge from "@/components/AgentIcon";
import StatusBadge from "@/components/StatusBadge";
import ReadinessRing from "@/components/ReadinessRing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import type { Agent } from "@/types";
import type { SkillType } from "@/lib/api";
import { useProjectStore } from "@/stores/projectStore";
import { usePanelStore } from "@/components/terminal/RightPanel";
import { useSkillJobStore } from "@/stores/skillJobStore";
import DocumentDropZone from "@/components/DocumentDropZone";
import SkillProgressPanel from "@/components/build/SkillProgressPanel";
import { useHelperStore } from "@/stores/helperStore";
import { toast } from "sonner";

// ─── Status text for each agent state ────────────────────────────

function getAgentStatusText(agent: Agent): string {
  const wf = agent.workflowPhase;

  if (agent.evalPassRate !== null && agent.evalPassRate >= 85)
    return `All tests passing (${agent.evalPassRate}%)`;
  if (agent.evalPassRate !== null)
    return `${agent.evalPassRate}% pass rate — needs fixes`;
  if (agent.status === "built")
    return "Agent is live — needs evaluation";
  if (wf === "ready_to_build" || (wf === "decisions" && agent.status === "ready"))
    return "Analysis complete — ready to build";
  if (wf === "decisions")
    return "Ready for review — confirm decisions";
  if (agent.status === "researched")
    return "Research complete — review and build";
  if (wf === "research")
    return "Analysis in progress...";
  if (wf === "preview")
    return "Preview complete — run deep research";
  return "Not yet analyzed";
}

// ─── Analyze button state ────────────────────────────────────────

type AnalyzeState = "no-docs" | "ready" | "analyzing" | "done" | "update";

function getAnalyzeState(
  documents: { changeStatus: string }[],
  agents: Agent[],
  skillJobs: Record<string, { projectId: string; skillType: string; phase: string }>,
  projectId: string,
): AnalyzeState {
  const anyAnalyzing = Object.values(skillJobs).some(
    (j) =>
      j.projectId === projectId &&
      (j.skillType === "preview" || j.skillType === "research") &&
      (j.phase === "starting" || j.phase === "running"),
  );
  if (anyAnalyzing) return "analyzing";

  const hasNewOrModified = documents.some(
    (d) => d.changeStatus === "new" || d.changeStatus === "modified",
  );
  if (hasNewOrModified && agents.length > 0) return "update";
  if (documents.length === 0) return "no-docs";
  if (agents.length === 0 && documents.length > 0) return "ready";
  return "done";
}

// ─── Active Skill Jobs ───────────────────────────────────────────

function ActiveSkillJobs({ projectId, agents }: { projectId: string; agents: Agent[] }) {
  const jobs = useSkillJobStore((s) => s.jobs);
  const clearJob = useSkillJobStore((s) => s.clearJob);

  const projectJobs = Object.entries(jobs).filter(
    ([, job]) => job.projectId === projectId,
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
                {job.autoChained && (
                  <span className="ml-1.5 text-[10px] text-blue-500 font-medium">auto</span>
                )}
              </p>
              <SkillProgressPanel jobKey={key} onClose={() => clearJob(key)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Overflow Menu ───────────────────────────────────────────────

function AgentOverflowMenu({
  projectId,
  agent,
}: {
  projectId: string;
  agent: Agent;
}) {
  const [open, setOpen] = useState(false);
  const launchSkill = useSkillJobStore((s) => s.launchSkill);

  const actions: { label: string; icon: React.ReactNode; skill: SkillType; disabled?: boolean }[] = [
    { label: "Re-analyze", icon: <Microscope className="h-3 w-3" />, skill: "research" },
    { label: "Build", icon: <Hammer className="h-3 w-3" />, skill: "build", disabled: agent.status !== "ready" && agent.workflowPhase !== "ready_to_build" },
    { label: "Evaluate", icon: <FlaskConical className="h-3 w-3" />, skill: "eval", disabled: agent.status !== "built" && agent.status !== "ready" },
    { label: "Fix", icon: <Wrench className="h-3 w-3" />, skill: "fix", disabled: agent.evalPassRate === null || agent.evalPassRate >= 85 },
    { label: "Package", icon: <Package className="h-3 w-3" />, skill: "package", disabled: agent.evalPassRate === null || agent.evalPassRate < 85 },
  ];

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-44 rounded-lg border border-border bg-card shadow-lg py-1">
            {actions.map((a) => (
              <button
                key={a.skill}
                type="button"
                disabled={a.disabled}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  if (a.skill === "package") {
                    // Package uses dedicated API, not skill runner
                    import("@/lib/api").then(({ startPackage }) =>
                      startPackage(projectId, agent.id)
                        .then(() => toast.success("Packaging started"))
                        .catch((err: Error) => toast.error(`Package failed: ${err.message}`)),
                    ).catch((err: Error) => toast.error(`Failed to load package API: ${err.message}`));
                  } else {
                    launchSkill(a.skill, projectId, agent.id);
                  }
                }}
              >
                {a.icon}
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────

const ProjectPage = () => {
  const { id } = useParams<{ id: string }>();
  const { projectName, agents, documents, loading, error, loadProject, removeAgent } = useProjectStore();
  const skillJobs = useSkillJobStore((s) => s.jobs);
  const launchSkill = useSkillJobStore((s) => s.launchSkill);
  const handleAutoChain = useSkillJobStore((s) => s.handleAutoChain);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [agentDesc, setAgentDesc] = useState("");
  const panelOpen = usePanelStore((s) => s.panelOpen);
  const helperPhase = useHelperStore((s) => s.phase);
  const helperInit = useHelperStore((s) => s.init);

  // Auto-refresh project data on interval
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

  // Subscribe to pipeline events (docs-settled → auto-trigger, auto-chain)
  // Reset transient state on project switch to prevent cross-project leaks
  useEffect(() => {
    if (!id) return;
    useProjectStore.getState().clearDocSettled();
    useProjectStore.setState({ lastPipelineEvent: null });
    return useProjectStore.getState().subscribeToPipeline(id);
  }, [id]);

  // Auto-trigger analyze when docs settle
  const docSettled = useProjectStore((s) => s.docSettled);
  const lastPipelineEvent = useProjectStore((s) => s.lastPipelineEvent);

  useEffect(() => {
    if (!docSettled || !id) return;
    useProjectStore.getState().clearDocSettled();

    const state = getAnalyzeState(documents, agents, skillJobs, id);
    if (state === "ready" || state === "update") {
      toast.info("Documents settled — starting analysis...");
      launchSkill("research", id, "");
    }
  }, [docSettled, id, documents, agents, skillJobs, launchSkill]);

  // Handle auto-chain events (build→eval) — validate project scope
  useEffect(() => {
    if (!lastPipelineEvent || lastPipelineEvent.type !== "auto-chain" || !id) return;
    const e = lastPipelineEvent as { type: "auto-chain"; to: SkillType; agentId: string; jobId: string; from: string };
    // Only handle if the agent belongs to this project
    if (!agents.some((a) => a.id === e.agentId)) return;
    handleAutoChain(id, e.agentId, e.to, e.jobId);
    toast.info(`${e.from} complete — auto-starting ${e.to}...`);
  }, [lastPipelineEvent, id, agents, handleAutoChain]);

  // Analyze button
  const analyzeState = id ? getAnalyzeState(documents, agents, skillJobs, id) : "no-docs";

  const handleAnalyze = () => {
    if (!id) return;
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
      <div className="px-6 py-8 @container/project">
        {error && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{projectName}</h1>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={panelOpen ? "default" : "outline"}
              className={helperPhase === "ready" ? "gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" : helperPhase === "streaming" ? "gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" : "gap-1.5"}
              onClick={() => {
                if (id && helperPhase === "idle") helperInit(id, agents[0]?.name);
                usePanelStore.getState().setPanelOpen(true);
              }}
            >
              {helperPhase === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {helperPhase === "ready" && <span className="w-2 h-2 rounded-full bg-white" />}
              {helperPhase === "streaming" && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
              Helper
            </Button>
            {analyzeState === "ready" && (
              <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white" onClick={handleAnalyze}>
                <Eye className="h-3.5 w-3.5" /> Analyze Docs
              </Button>
            )}
            {analyzeState === "analyzing" && (
              <Button size="sm" disabled className="gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing...
              </Button>
            )}
            {analyzeState === "update" && (
              <Button size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white" onClick={handleAnalyze}>
                <Microscope className="h-3.5 w-3.5" /> Update Analysis
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-8">
          {/* Agents */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Agents ({agents.length})</h2>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => setShowAgentForm(true)}>
                + Add Agent
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
                {documents.length > 0
                  ? "No agents yet. Click Analyze Docs above to discover agents from your documents."
                  : "No agents yet. Upload documents below to get started."}
              </div>
            ) : (
              <div className="space-y-2">
                {(() => {
                  const childSet = new Set<string>();
                  const orchestrators = agents.filter((a) =>
                    a.architectureType?.includes("multi") && a.childAgentIds && a.childAgentIds.length > 0,
                  );
                  orchestrators.forEach((o) => o.childAgentIds?.forEach((cid) => childSet.add(cid)));

                  const renderAgentCard = (agent: Agent, indent: boolean, badge?: string) => {
                    const isOrch = badge === "Orchestrator";
                    const statusText = getAgentStatusText(agent);

                    return (
                      <div
                        key={agent.id}
                        className={`group rounded-lg border border-border bg-card transition-all hover:border-primary/30 hover:bg-surface-2 ${
                          indent ? "ml-8 border-l-2 border-l-primary/20" : ""
                        } ${badge === "Specialist" ? "bg-surface-1" : ""}`}
                      >
                        <div className="flex items-center gap-4 p-4">
                          <Link
                            to={`/project/${id}/agent/${agent.id}`}
                            className="flex items-center gap-4 flex-1 min-w-0"
                          >
                            <AgentIconBadge agent={agent} size={40} className={isOrch ? "ring-2 ring-primary/30" : ""} />
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
                                {agent.evalPassRate !== null && (
                                  <span className={`text-[10px] font-medium ${agent.evalPassRate >= 85 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                    {agent.evalPassRate}%
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground truncate">{statusText}</p>
                            </div>
                          </Link>
                          <ReadinessRing value={agent.readiness} size={36} />
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div><AgentOverflowMenu projectId={id!} agent={agent} /></div>
                              </TooltipTrigger>
                              <TooltipContent>Pipeline actions</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive shrink-0"
                            onClick={(e) => { e.preventDefault(); removeAgent(agent.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <Link
                            to={`/project/${id}/agent/${agent.id}`}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
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
