/**
 * DiscoverPage — Template browser from solution library.
 *
 * Displays pre-built agent solution templates with category detection,
 * search, and metadata cards.
 */
import { useState, useMemo } from "react";
import { useLoaderData, useNavigate, useRevalidator } from "react-router";
import { Search, Package, FileText, Presentation, Bot, Sparkles, Loader2, Rocket, RefreshCw, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import Layout from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { SolutionTemplate } from "@/lib/api";
import { deploySolutionTemplate } from "@/lib/api";
import { toast } from "sonner";
import ActionToast from "@/components/ActionToast";
import { detectAgentDomain, domainIconMap, getGradientForAgent } from "@/lib/agentIcons";

// Derive a category from the solution name using the same domain detection
function categorize(name: string): { domain: string; label: string } {
  const domain = detectAgentDomain({ name, description: name });
  const entry = domainIconMap[domain];
  return { domain, label: entry?.label || "Agent" };
}

export default function DiscoverPage() {
  const raw = useLoaderData();
  const navigate = useNavigate();
  const solutions = Array.isArray(raw) ? (raw as SolutionTemplate[]) : [];
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [deploying, setDeploying] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const revalidator = useRevalidator();

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    toast.custom((id) => (
      <ActionToast icon={<RefreshCw className="h-4 w-4 text-primary animate-spin" />} title="Refreshing templates" subtitle="Reloading solution library..." onDismiss={() => toast.dismiss(id)} />
    ), { duration: 2000 });
    try {
      revalidator.revalidate();
      // Give the revalidation a moment to settle
      await new Promise((r) => setTimeout(r, 800));
      toast.custom((id) => (
        <ActionToast icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} title="Templates refreshed" subtitle={`${solutions.length} template${solutions.length !== 1 ? "s" : ""} loaded`} onDismiss={() => toast.dismiss(id)} />
      ), { duration: 3000 });
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeploy = async (sol: SolutionTemplate) => {
    if (deploying) return;
    setDeploying(sol.id);
    const toastId = toast.custom(() => (
      <ActionToast icon={<Loader2 className="h-4 w-4 text-primary animate-spin" />} title={`Deploying "${sol.name}"`} subtitle="Creating project from template..." />
    ), { duration: Infinity });
    try {
      const result = await deploySolutionTemplate(sol.id, sol.name);
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
            title="Template deployed"
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
          title="Deploy failed"
          subtitle={msg}
          variant="error"
          onDismiss={() => toast.dismiss(id)}
        />
      ), { duration: 6000 });
    } finally {
      setDeploying(null);
    }
  };

  // Enrich solutions with category
  const enriched = useMemo(
    () =>
      solutions.map((s) => {
        const cat = categorize(s.name);
        return { ...s, domain: cat.domain, categoryLabel: cat.label };
      }),
    [solutions],
  );

  // Unique categories
  const categories = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const s of enriched) {
      const existing = counts.get(s.domain);
      if (existing) existing.count++;
      else counts.set(s.domain, { label: s.categoryLabel, count: 1 });
    }
    return [{ domain: "all", label: "All", count: enriched.length }, ...Array.from(counts.entries()).map(([domain, v]) => ({ domain, ...v })).sort((a, b) => b.count - a.count)];
  }, [enriched]);

  // Filter + search
  const filtered = useMemo(() => {
    let result = enriched;
    if (categoryFilter !== "all") {
      result = result.filter((s) => s.domain === categoryFilter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(q));
    }
    return result;
  }, [enriched, categoryFilter, query]);

  return (
    <Layout>
      <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Discover Templates</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {solutions.length} pre-built agent solution{solutions.length !== 1 ? "s" : ""} ready to use as starting points.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh templates from solution library"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates..."
              className="pl-9 h-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat.domain}
                onClick={() => setCategoryFilter(cat.domain)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  categoryFilter === cat.domain
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat.label} ({cat.count})
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {solutions.length === 0 ? "No templates available yet." : "No templates match your search."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((sol) => {
              const Icon = domainIconMap[sol.domain]?.icon || Bot;
              const gradient = getGradientForAgent(sol.id);

              return (
                <div
                  key={sol.id}
                  className="group flex flex-col rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card-val)] transition-all hover:shadow-[var(--shadow-card-hover-val)] hover:border-primary/30"
                >
                  {/* Icon + Name */}
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
                      style={{ background: gradient }}
                    >
                      <Icon className="h-5 w-5 text-white" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                        {sol.name}
                      </h3>
                      <span className="text-[11px] text-muted-foreground">{sol.categoryLabel}</span>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
                    {sol.hasSolution && (
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" /> Solution
                      </span>
                    )}
                    {sol.hasPresentation && (
                      <span className="flex items-center gap-1">
                        <Presentation className="h-3 w-3" /> Deck
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" /> {sol.files} file{sol.files !== 1 ? "s" : ""}
                    </span>
                    {sol.agents > 0 && (
                      <span className="flex items-center gap-1">
                        <Bot className="h-3 w-3" /> {sol.agents}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeploy(sol)}
                      disabled={!!deploying}
                      className="ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {deploying === sol.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
                      Use Template
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

