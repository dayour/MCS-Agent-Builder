/**
 * AgentsGallery — Cross-project + platform agent view with search and filtering.
 *
 * Local agents load instantly via route loader. Platform agents lazy-load
 * with timeout/fallback so the page stays usable when PAC is slow.
 */
import { useState, useMemo, useEffect } from "react";
import { useLoaderData, Link, useNavigate } from "react-router";
import { Search, Filter, LayoutGrid, List, Loader2, Cloud, HardDrive, Download, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import Layout from "@/components/Layout";
import StatusBadge from "@/components/StatusBadge";
import ReadinessRing from "@/components/ReadinessRing";
import AgentIcon from "@/components/AgentIcon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ApiProject, ApiAgentSummary } from "@/types/api";
import { fetchPlatformAgents, importPlatformAgent, type PlatformAgent } from "@/lib/api";
import { toast } from "sonner";
import ActionToast from "@/components/ActionToast";

type Source = "local" | "platform";

interface FlatAgent {
  id: string;
  name: string;
  description: string;
  status: string;
  readiness: number;
  projectId: string;
  projectName: string;
  source: Source;
  /** Schema name for platform agents (for import) */
  schemaName?: string;
}

function deriveStatus(a: ApiAgentSummary): string {
  if (a.has_build_report) return "built";
  if (a.build_ready) return "ready";
  if (a.has_instructions) return "researched";
  return "draft";
}

const SOURCE_BADGE: Record<Source, { label: string; icon: typeof Cloud; className: string }> = {
  local: { label: "Local", icon: HardDrive, className: "bg-muted text-muted-foreground" },
  platform: { label: "Platform", icon: Cloud, className: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" },
};

export default function AgentsGallery() {
  const raw = useLoaderData();
  const navigate = useNavigate();
  const projects = Array.isArray(raw) ? (raw as ApiProject[]) : [];
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | Source>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [importing, setImporting] = useState<string | null>(null);

  // Platform agents — lazy loaded
  const [platformAgents, setPlatformAgents] = useState<PlatformAgent[]>([]);
  const [platformLoading, setPlatformLoading] = useState(true);
  const [platformError, setPlatformError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setPlatformLoading(false);
        setPlatformError("Platform agent fetch timed out");
      }
    }, 15000);

    fetchPlatformAgents()
      .then((result) => {
        if (cancelled) return;
        clearTimeout(timeout);
        setPlatformAgents(result.agents);
        setPlatformError(result.error || null);
        setPlatformLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        clearTimeout(timeout);
        setPlatformError(err.message);
        setPlatformLoading(false);
      });

    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  // Flatten local agents
  const localAgents = useMemo((): FlatAgent[] => {
    const agents: FlatAgent[] = [];
    for (const project of projects) {
      for (const agent of project.agents) {
        agents.push({
          id: agent.id,
          name: agent.name,
          description: agent.description || "",
          status: deriveStatus(agent),
          readiness: agent.readiness ?? 0,
          projectId: project.id,
          projectName: project.name,
          source: "local",
        });
      }
    }
    return agents;
  }, [projects]);

  // Convert platform agents
  const platformFlat = useMemo((): FlatAgent[] =>
    platformAgents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description || "",
      status: a.status || "published",
      readiness: 0,
      projectId: "",
      projectName: "Copilot Studio",
      source: "platform" as Source,
      schemaName: a.schemaName,
    })),
    [platformAgents],
  );

  const allAgents = useMemo(() => [...localAgents, ...platformFlat], [localAgents, platformFlat]);

  // Unique statuses for filter
  const statuses = useMemo(() => {
    const s = new Set(allAgents.map((a) => a.status));
    return ["all", ...Array.from(s).sort()];
  }, [allAgents]);

  // Filter + search
  const filtered = useMemo(() => {
    let result = allAgents;
    if (sourceFilter !== "all") {
      result = result.filter((a) => a.source === sourceFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.projectName.toLowerCase().includes(q),
      );
    }
    return result;
  }, [allAgents, sourceFilter, statusFilter, query]);

  const handleImport = async (agent: FlatAgent) => {
    if (importing) return;
    setImporting(agent.id);
    const toastId = toast.custom(() => (
      <ActionToast
        icon={<Loader2 className="h-4 w-4 text-primary animate-spin" />}
        title={`Importing "${agent.name}"`}
        subtitle="Creating local project from platform agent..."
      />
    ), { duration: Infinity });
    try {
      const result = await importPlatformAgent(agent.name, agent.schemaName);
      toast.dismiss(toastId);
      if (result.existed) {
        toast.custom((id) => (
          <ActionToast
            icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
            title="Project already exists"
            subtitle={result.message}
            action={{ label: "Open project", onClick: () => { toast.dismiss(id); navigate(`/project/${result.projectId}`); } }}
            onDismiss={() => toast.dismiss(id)}
          />
        ), { duration: 5000 });
      } else {
        toast.custom((id) => (
          <ActionToast
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            title="Agent imported"
            subtitle={result.message}
            action={{ label: "Open project", onClick: () => { toast.dismiss(id); navigate(`/project/${result.projectId}`); } }}
            onDismiss={() => toast.dismiss(id)}
          />
        ), { duration: 4000 });
      }
    } catch (err) {
      toast.dismiss(toastId);
      const msg = err instanceof Error ? err.message : String(err);
      toast.custom((id) => (
        <ActionToast
          icon={<XCircle className="h-4 w-4 text-destructive" />}
          title="Import failed"
          subtitle={msg}
          variant="error"
          onDismiss={() => toast.dismiss(id)}
        />
      ), { duration: 6000 });
    } finally {
      setImporting(null);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold">All Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {localAgents.length} local{platformFlat.length > 0 ? ` + ${platformFlat.length} platform` : ""} agent{allAgents.length !== 1 ? "s" : ""}
            {" "}across {projects.length} project{projects.length !== 1 ? "s" : ""}
            {platformLoading && (
              <span className="inline-flex items-center gap-1 ml-2 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading platform agents...
              </span>
            )}
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-sm min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search agents..."
              className="pl-9 h-9"
            />
          </div>

          {/* Source filter */}
          <div className="flex items-center gap-1.5">
            {(["all", "local", "platform"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSourceFilter(s)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium capitalize transition-colors ${
                  sourceFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {s === "local" && <HardDrive className="h-3 w-3" />}
                {s === "platform" && <Cloud className="h-3 w-3" />}
                {s === "all" ? "All Sources" : s}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium capitalize transition-colors ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {s === "all" ? "All" : s.replace(/-/g, " ")}
              </button>
            ))}
          </div>

          <div className="ml-auto flex gap-1">
            <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setViewMode("grid")}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setViewMode("list")}>
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Platform error banner */}
        {platformError && !platformLoading && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <Cloud className="h-3.5 w-3.5 shrink-0" />
            Platform agents unavailable: {platformError}
          </div>
        )}

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {allAgents.length === 0 ? "No agents found." : "No agents match your search."}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((agent) => (
              <AgentGridCard key={`${agent.source}-${agent.id}`} agent={agent} onImport={handleImport} importing={!!importing} importingThis={importing === agent.id} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Agent</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Source</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Readiness</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((agent) => (
                  <AgentListRow key={`${agent.source}-${agent.id}`} agent={agent} onImport={handleImport} importing={!!importing} importingThis={importing === agent.id} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SourceBadge({ source }: { source: Source }) {
  const cfg = SOURCE_BADGE[source];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.className}`}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  );
}

function AgentGridCard({ agent, onImport, importing, importingThis }: { agent: FlatAgent; onImport: (a: FlatAgent) => void; importing: boolean; importingThis: boolean }) {
  const isLocal = agent.source === "local";
  const inner = (
    <div className="group flex flex-col rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card-val)] transition-all hover:shadow-[var(--shadow-card-hover-val)] hover:border-primary/30 h-full">
      <div className="flex items-start gap-3 mb-3">
        <AgentIcon agent={agent} size={36} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
            {agent.name}
          </h3>
          <p className="text-[11px] text-muted-foreground truncate">{agent.projectName}</p>
        </div>
        {isLocal && <ReadinessRing value={agent.readiness} size={32} />}
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{agent.description}</p>
      <div className="mt-auto flex items-center gap-2">
        <SourceBadge source={agent.source} />
        <StatusBadge status={agent.status} />
        {!isLocal && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onImport(agent); }}
            disabled={importing}
            className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {importingThis ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            Import
          </button>
        )}
      </div>
    </div>
  );

  if (isLocal) {
    return (
      <Link to={`/project/${agent.projectId}/agent/${agent.id}`}>
        {inner}
      </Link>
    );
  }
  return inner;
}

function AgentListRow({ agent, onImport, importing, importingThis }: { agent: FlatAgent; onImport: (a: FlatAgent) => void; importing: boolean; importingThis: boolean }) {
  const isLocal = agent.source === "local";
  return (
    <tr className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
      <td className="px-4 py-2.5">
        {isLocal ? (
          <Link
            to={`/project/${agent.projectId}/agent/${agent.id}`}
            className="flex items-center gap-2.5 hover:text-primary transition-colors"
          >
            <AgentIcon agent={agent} size={24} />
            <div className="min-w-0">
              <span className="font-medium truncate block">{agent.name}</span>
              {agent.description && (
                <span className="text-xs text-muted-foreground truncate block max-w-[200px]">{agent.description}</span>
              )}
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-2.5">
            <AgentIcon agent={agent} size={24} />
            <div className="min-w-0">
              <span className="font-medium truncate block">{agent.name}</span>
              {agent.description && (
                <span className="text-xs text-muted-foreground truncate block max-w-[200px]">{agent.description}</span>
              )}
            </div>
          </div>
        )}
      </td>
      <td className="px-4 py-2.5"><SourceBadge source={agent.source} /></td>
      <td className="px-4 py-2.5"><StatusBadge status={agent.status} /></td>
      <td className="px-4 py-2.5 text-center">
        {isLocal ? (
          <ReadinessRing value={agent.readiness} size={28} />
        ) : (
          <button
            type="button"
            onClick={() => onImport(agent)}
            disabled={importing}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {importingThis ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            Import
          </button>
        )}
      </td>
    </tr>
  );
}

