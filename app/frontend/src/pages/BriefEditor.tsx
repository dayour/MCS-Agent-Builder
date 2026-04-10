import { useParams, useNavigate, useSearchParams, useBlocker } from "react-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Briefcase, Bot, FileText, Zap, Plug, Database,
  MessageSquare, Shield, Network, TestTube, HelpCircle,
  GitPullRequestDraft, AlertTriangle,
  Check, Circle, Download, FileDown, Loader2, Hammer,
} from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import ReadinessRing from "@/components/ReadinessRing";
import { BRIEF_SECTIONS } from "@/config/briefSections";
import { useBriefStore } from "@/stores/briefStore";
import { useProjectStore } from "@/stores/projectStore";
import { useSkillJobStore, getSkillJobKey } from "@/stores/skillJobStore";
import SkillProgressPanel from "@/components/build/SkillProgressPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import OverviewSection from "@/components/brief/OverviewSection";
import WorkflowPhaseBanner from "@/components/brief/WorkflowPhaseBanner";
import InstructionsSection from "@/components/brief/InstructionsSection";
import CapabilitiesSection from "@/components/brief/CapabilitiesSection";
import IntegrationsSection from "@/components/brief/IntegrationsSection";
import KnowledgeSourcesSection from "@/components/brief/KnowledgeSourcesSection";
import ConversationTopicsSection from "@/components/brief/ConversationTopicsSection";
import ScopeBoundariesSection from "@/components/brief/ScopeBoundariesSection";
import ArchitectureSection from "@/components/brief/ArchitectureSection";
import EvalSetsSection from "@/components/brief/EvalSetsSection";
import OpenQuestionsSection from "@/components/brief/OpenQuestionsSection";
import DecisionsSection from "@/components/brief/DecisionsSection";
import { generateBriefReport, downloadFile } from "@/lib/reportGenerator";
import { computeDecisionImpact } from "@/lib/briefTransforms";
import EnrichmentBanner from "@/components/brief/EnrichmentBanner";

const iconMap: Record<string, React.ElementType> = {
  Briefcase, FileText, Zap, Plug, Database,
  MessageSquare, Shield, Network, TestTube, HelpCircle,
  GitPullRequestDraft,
};

const sectionComponents: Record<string, React.ComponentType<{ data: any; onChange?: (data: any) => void; context?: any }>> = {
  overview: OverviewSection,
  instructions: InstructionsSection,
  capabilities: CapabilitiesSection,
  tools: IntegrationsSection,
  "knowledge-sources": KnowledgeSourcesSection,
  "conversation-topics": ConversationTopicsSection,
  "scope-boundaries": ScopeBoundariesSection,
  architecture: ArchitectureSection,
  decisions: DecisionsSection,
  "eval-sets": EvalSetsSection,
  "open-questions": OpenQuestionsSection,
};

const BriefEditor = () => {
  const { projectId, agentId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const enrichJobId = searchParams.get("enrich");
  const agents = useProjectStore((s) => s.agents);
  const projectName = useProjectStore((s) => s.projectName);
  const loadProject = useProjectStore((s) => s.loadProject);
  const {
    data, rawBrief, agentName, completion, loading, saving, dirty, error,
    load: loadBrief, updateSection, save, poll, confirmPreview, confirmDecisions,
  } = useBriefStore();

  const [activeSection, setActiveSection] = useState(BRIEF_SECTIONS[0].id);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportType, setReportType] = useState("brief");

  // Track active skill jobs for this agent
  const skillJobs = useSkillJobStore((s) => s.jobs);
  const clearJob = useSkillJobStore((s) => s.clearJob);
  const previewKey = projectId && agentId ? getSkillJobKey(projectId, agentId, "preview") : "";
  const researchKey = projectId && agentId ? getSkillJobKey(projectId, agentId, "research") : "";
  const buildKey = projectId && agentId ? getSkillJobKey(projectId, agentId, "build") : "";
  const evalKey = projectId && agentId ? getSkillJobKey(projectId, agentId, "eval") : "";
  const fixKey = projectId && agentId ? getSkillJobKey(projectId, agentId, "fix") : "";
  const isGenerating = !!(previewKey && skillJobs[previewKey] && (skillJobs[previewKey].phase === "starting" || skillJobs[previewKey].phase === "running"));
  const isResearching = !!(researchKey && skillJobs[researchKey] && (skillJobs[researchKey].phase === "starting" || skillJobs[researchKey].phase === "running"));
  const isBuilding = !!(buildKey && skillJobs[buildKey] && (skillJobs[buildKey].phase === "starting" || skillJobs[buildKey].phase === "running"));
  const isEvaluating = !!(evalKey && skillJobs[evalKey] && (skillJobs[evalKey].phase === "starting" || skillJobs[evalKey].phase === "running"));
  const isFixing = !!(fixKey && skillJobs[fixKey] && (skillJobs[fixKey].phase === "starting" || skillJobs[fixKey].phase === "running"));
  const activeJobKeys = [previewKey, researchKey, buildKey, evalKey, fixKey].filter((k) => k && skillJobs[k]);

  // Derive agent status from the agents list
  const currentAgent = agents.find((a) => a.id === agentId);
  const agentStatus = currentAgent?.status ?? "draft";
  const evalPassRate = currentAgent?.evalPassRate ?? null;
  const docsChanged = useProjectStore((s) => s.documents).some(
    (d) => d.changeStatus === "new" || d.changeStatus === "modified",
  );

  // Warn before navigating away with unsaved changes
  const blocker = useBlocker(dirty && !saving);

  // Load project + brief on mount
  useEffect(() => {
    if (projectId) loadProject(projectId);
  }, [projectId, loadProject]);

  useEffect(() => {
    if (projectId && agentId) loadBrief(projectId, agentId);
  }, [projectId, agentId, loadBrief]);

  // Poll for server changes every 5s (paused when tab is hidden)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") poll();
    }, 5000);
    return () => clearInterval(interval);
  }, [poll]);

  const handleSectionChange = (sectionId: string, newData: any) => {
    updateSection(sectionId, newData);
  };

  const launchSkill = useSkillJobStore((s) => s.launchSkill);

  const handleGeneratePreview = () => {
    if (!projectId || !agentId) return;
    launchSkill("preview", projectId, agentId);
  };

  const handleNavigateToDecisions = () => {
    setActiveSection("decisions");
  };

  const handleApproveAndBuild = () => {
    confirmDecisions();
  };

  const handleRunResearch = () => {
    if (!projectId || !agentId) return;
    confirmPreview();
    launchSkill("research", projectId, agentId);
  };

  const handleNavigateToSection = (sectionId: string) => {
    setActiveSection(sectionId);
  };

  const handleBuild = () => {
    if (!projectId || !agentId) return;
    launchSkill("build", projectId, agentId);
  };

  const handleEvaluate = () => {
    if (!projectId || !agentId) return;
    launchSkill("eval", projectId, agentId);
  };

  const handleFix = () => {
    if (!projectId || !agentId) return;
    launchSkill("fix", projectId, agentId);
  };

  const handlePackage = async () => {
    if (!projectId || !agentId) return;
    const { startPackage } = await import("@/lib/api");
    startPackage(projectId, agentId);
  };

  const handleBackToProject = () => {
    navigate(`/project/${projectId}`);
  };

  const handleEnrichmentComplete = useCallback(() => {
    // Reload brief to pick up enrichment changes
    if (projectId && agentId) loadBrief(projectId, agentId);
    // Remove enrich param from URL
    setSearchParams((prev) => { prev.delete("enrich"); return prev; }, { replace: true });
  }, [projectId, agentId, loadBrief, setSearchParams]);

  const completedCount = Object.values(completion).filter(Boolean).length;
  const readiness = BRIEF_SECTIONS.length > 0
    ? Math.round((completedCount / BRIEF_SECTIONS.length) * 100)
    : 0;

  const ActiveComponent = sectionComponents[activeSection];
  const sectionData = data?.[activeSection as keyof typeof data];

  // Build a fake Agent object for the report generators
  const agentForReport = {
    id: agentId ?? "",
    name: agentName,
    description: "",
    status: "draft" as const,
    readiness,
    sectionCompletion: completion,
  };

  const decisionImpact = useMemo(() => {
    if (!data || !rawBrief) return { needsReResearch: false, affectedSections: [] };
    return computeDecisionImpact(
      data.decisions?.items ?? [],
      rawBrief.decisions ?? []
    );
  }, [data, rawBrief]);

  if (loading) {
    return (
      <Layout breadcrumbs={[
        { label: projectName || projectId || "", href: `/project/${projectId}` },
        { label: "Loading..." },
      ]}>
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading brief...
        </div>
      </Layout>
    );
  }

  return (
    <Layout breadcrumbs={[
      { label: projectName || projectId || "", href: `/project/${projectId}` },
      { label: agentName || agentId || "" },
    ]}>
      <title>{agentName || "Brief"} — MCS Builder</title>
      <div className="flex h-full min-w-0">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-border bg-surface-1 overflow-y-auto">
          <div className="p-4 border-b border-border">
            <Select value={agentId} onValueChange={(val) => navigate(`/project/${projectId}/agent/${val}`)}>
              <SelectTrigger className="h-8 text-xs mb-3">
                <Bot className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-3">
              <ReadinessRing value={readiness} size={44} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{completedCount}/{BRIEF_SECTIONS.length} complete</p>
                <p className="text-[11px] text-muted-foreground">
                  {saving ? "Saving..." : dirty ? "Unsaved changes" : "Brief readiness"}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs mt-3"
              onClick={handleBuild}
              title="Launch /mcs-build in the terminal"
            >
              <Hammer className="h-3.5 w-3.5" />
              Build
            </Button>
          </div>
          <nav className="p-2">
            {BRIEF_SECTIONS.map((section) => {
              const Icon = iconMap[section.icon];
              const isActive = activeSection === section.id;
              const isComplete = completion[section.id] ?? false;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  {isComplete ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="flex-1 truncate">{section.title}</span>
                  {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-50" />}
                </button>
              );
            })}
          </nav>
          <div className="p-3 border-t border-border space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs"
              onClick={() => {
                if (!data) return;
                const md = generateBriefReport(agentForReport, data as unknown as Record<string, any>);
                const filename = `${agentName.replace(/\s+/g, "_")}_Brief.md`;
                downloadFile(md, filename);
              }}
            >
              <Download className="h-3.5 w-3.5" />
              Export Markdown
            </Button>
            <div className="flex gap-1.5">
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="brief">Brief</SelectItem>
                  <SelectItem value="build">Build</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="deployment">Deployment</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs whitespace-nowrap"
                disabled={reportLoading}
                onClick={async () => {
                  if (!data || reportLoading) return;
                  setReportLoading(true);
                  setReportError(null);
                  try {
                    const res = await fetch(
                      `/api/projects/${projectId}/agents/${agentId}/report?type=${reportType}`
                    );
                    if (!res.ok) {
                      const errText = await res.text();
                      throw new Error(errText);
                    }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${agentName.replace(/\s+/g, "_")}_${reportType}.html`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    console.error("Report export failed:", err);
                    setReportError(`Report export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
                  } finally {
                    setReportLoading(false);
                  }
                }}
              >
                {reportLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                {reportLoading ? "..." : "HTML"}
              </Button>
            </div>
          </div>
        </aside>

        {/* Content — container query context for responsive brief sections */}
        <div className="flex-1 overflow-y-auto p-6 @container/brief">
          <div className="mx-auto max-w-4xl @[80rem]/brief:max-w-none animate-fade-in">
            {(error || reportError) && (
              <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error || reportError}
              </div>
            )}
            {/* Enrichment Progress */}
            {enrichJobId && (
              <EnrichmentBanner jobId={enrichJobId} onComplete={handleEnrichmentComplete} />
            )}
            {/* Workflow Phase Banner */}
            {data?.workflow && (
              <WorkflowPhaseBanner
                phase={data.workflow.phase}
                agentStatus={agentStatus}
                evalPassRate={evalPassRate}
                docsChanged={docsChanged}
                pendingDecisionCount={(data.decisions?.items ?? []).filter((d) => d.status === "pending").length}
                previewGeneratedAt={data.workflow.previewGeneratedAt}
                researchCompletedAt={data.workflow.researchCompletedAt}
                isGenerating={isGenerating}
                isResearching={isResearching}
                isAnalyzing={isGenerating || isResearching}
                isBuilding={isBuilding}
                isEvaluating={isEvaluating}
                isFixing={isFixing}
                onAnalyze={handleRunResearch}
                onGeneratePreview={handleGeneratePreview}
                onRunResearch={handleRunResearch}
                onReviewDecisions={handleNavigateToDecisions}
                onApproveAndBuild={handleApproveAndBuild}
                onBuild={handleBuild}
                onEvaluate={handleEvaluate}
                onFix={handleFix}
                onPackage={handlePackage}
                onBackToProject={handleBackToProject}
              />
            )}
            {/* Active skill jobs */}
            {activeJobKeys.length > 0 && (
              <div className="mb-4 space-y-3">
                {activeJobKeys.map((key) => (
                  <SkillProgressPanel
                    key={key}
                    jobKey={key}
                    onClose={() => clearJob(key)}
                  />
                ))}
              </div>
            )}
            {decisionImpact.needsReResearch && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Decisions changed &mdash; re-run Research to update
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    Overridden decisions affect {decisionImpact.affectedSections.join(", ")}.
                    Instructions and eval sets may need regeneration.
                    Run <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">/mcs-research</code> to apply.
                  </p>
                </div>
              </div>
            )}
            {ActiveComponent && sectionData && (
              <ActiveComponent
                data={sectionData}
                onChange={(d: any) => handleSectionChange(activeSection, d)}
                {...(activeSection === "overview" ? {
                  context: {
                    briefData: data,
                    onGeneratePreview: handleGeneratePreview,
                    onUpdateSection: updateSection,
                    onNavigateToSection: handleNavigateToSection,
                  },
                } : activeSection === "architecture" ? {
                  context: {
                    projectId,
                    agents: agents.map((a) => ({ id: a.id, name: a.name })),
                  },
                } : activeSection === "eval-sets" ? {
                  context: { agentName: agentName || agentId || "" },
                } : {})}
              />
            )}
            {!data && !loading && (
              <div className="text-center py-20 text-muted-foreground text-sm">
                No brief data yet. Run <code>/mcs-research</code> to generate the brief.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unsaved changes blocker dialog */}
      <Dialog open={blocker.state === "blocked"} onOpenChange={() => blocker.reset?.()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes that will be lost if you leave this page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => blocker.reset?.()}>
              Stay
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await save();
                blocker.proceed?.();
              }}
            >
              Save & Leave
            </Button>
            <Button variant="destructive" onClick={() => blocker.proceed?.()}>
              Discard & Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default BriefEditor;
