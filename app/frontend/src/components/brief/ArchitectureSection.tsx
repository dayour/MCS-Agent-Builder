import { useState } from "react";
import {
  Pencil, Check, X, Plus, Trash2, Bot, Network, Link, FolderTree,
  Zap, AlertTriangle, GitBranch,
} from "lucide-react";
import SectionGuidelines from "./SectionGuidelines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { editKeyHandler } from "@/lib/editKeys";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import { scaffoldChildren } from "@/lib/api";

interface ArchitectureContext {
  projectId?: string;
  agents?: Array<{ id: string; name: string }>;
}

interface Props {
  data: any;
  onChange?: (data: any) => void;
  context?: ArchitectureContext;
}

const emptyAgent = { name: "", role: "", routingRule: "", model: "", agentFolderId: "" };
const emptyTrigger = { type: "conversational", description: "" };
const emptyChannel = { name: "", reason: "" };

const TRIGGER_TYPES = [
  { value: "conversational", label: "Conversational", desc: "Users chat directly — Teams, web chat, M365 Copilot" },
  { value: "event-driven", label: "Event-driven", desc: "System event activates the agent — SharePoint, Dataverse, email" },
  { value: "scheduled", label: "Scheduled", desc: "Runs on a recurring time interval" },
  { value: "autonomous", label: "Autonomous", desc: "Agent acts proactively without user prompting" },
];

const CHANNEL_OPTIONS = [
  { value: "Microsoft Teams", label: "Microsoft Teams", desc: "Primary workspace for most enterprise users" },
  { value: "M365 Copilot", label: "M365 Copilot", desc: "Appears as a plugin inside Microsoft 365 Copilot" },
  { value: "Web chat", label: "Web chat", desc: "Embed in any website or internal portal" },
  { value: "Direct Line", label: "Direct Line", desc: "API-based channel for custom apps and testing" },
  { value: "Slack", label: "Slack", desc: "For organizations using Slack as primary messaging" },
  { value: "Mobile app", label: "Mobile app", desc: "Custom mobile app integration via Direct Line" },
];

const MODEL_OPTIONS = [
  { value: "gpt-4o", label: "GPT-4o", desc: "Best balance of speed and quality" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini", desc: "Fast and cost-effective for simple tasks" },
  { value: "gpt-4.1", label: "GPT-4.1", desc: "Latest GPT model — improved instruction following" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini", desc: "Compact GPT-4.1 for routine tasks" },
  { value: "gpt-4.1-nano", label: "GPT-4.1 Nano", desc: "Smallest GPT model — fastest, lowest cost" },
  { value: "o1", label: "o1", desc: "Reasoning model for complex multi-step problems" },
  { value: "o1-mini", label: "o1 Mini", desc: "Compact reasoning model" },
  { value: "o3-mini", label: "o3 Mini", desc: "Latest compact reasoning model" },
  { value: "DeepSeek-R1", label: "DeepSeek-R1", desc: "Open-source reasoning model" },
  { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", desc: "Anthropic — balanced reasoning and speed" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6", desc: "Anthropic — most capable, complex analysis" },
];

const ARCH_TYPES = [
  { value: "single-agent", label: "Single-Agent", icon: Bot, desc: "One agent handles everything" },
  { value: "multi-agent", label: "Multi-Agent", icon: Network, desc: "Orchestrator routes to specialists" },
  { value: "connected-agent", label: "Connected-Agent", icon: Link, desc: "Agents linked across solutions" },
] as const;

const SOLUTION_TYPES = [
  { value: "agent", label: "Agent", icon: Bot, desc: "Copilot Studio agent",
    color: "border-primary bg-primary/5 text-primary" },
  { value: "hybrid", label: "Hybrid", icon: GitBranch, desc: "Agent + Power Automate flows",
    color: "border-amber-500 bg-amber-500/5 text-amber-600" },
  { value: "flow", label: "Power Automate Flow", icon: Zap, desc: "Automation only — no agent needed",
    color: "border-purple-500 bg-purple-500/5 text-purple-600" },
  { value: "not-recommended", label: "Not Recommended", icon: AlertTriangle, desc: "Beyond MCS capabilities",
    color: "border-destructive bg-destructive/5 text-destructive" },
] as const;

const SOL_TYPE_FACTOR_META = [
  { name: "Conversational Need", desc: "Do users need dialogue — back-and-forth, follow-ups, explanations?" },
  { name: "Interaction Pattern", desc: "Are most capabilities reactive (user asks, agent responds) vs procedural (event → pipeline)?" },
  { name: "Capability Distribution", desc: "Are 50%+ capabilities prompt/topic/knowledge (agent) vs flow/tool (automation)?" },
  { name: "User Value of NL", desc: "Do users gain value from natural language vs a structured UI (form, button, filter)?" },
  { name: "MCS Feasibility", desc: "Are response times, data volumes, and connectors compatible with MCS?" },
];

const ARCH_SCORING_FACTOR_META = [
  { name: "Domain Separation", desc: "Do capabilities span truly separate business domains?" },
  { name: "Data Isolation", desc: "Does each capability need different backend systems?" },
  { name: "Team Ownership", desc: "Would different teams own different parts of the agent?" },
  { name: "Reusability", desc: "Could specialist agents be reused by other orchestrators?" },
  { name: "Instruction Size", desc: "Would a single agent's instructions exceed 8,000 characters?" },
  { name: "Knowledge Isolation", desc: "Does each domain need its own deep, isolated knowledge base?" },
];

const ArchitectureSection = ({ data, onChange, context }: Props) => {
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaDraft, setMetaDraft] = useState<any>(null);
  const [editAgentIdx, setEditAgentIdx] = useState<number | null>(null);
  const [agentDraft, setAgentDraft] = useState<any>(null);

  const [scaffolding, setScaffolding] = useState(false);

  const update = (partial: any) => onChange?.({ ...data, ...partial });

  const getFactors = (key: string, meta: typeof SOL_TYPE_FACTOR_META) => {
    const existing: any[] = data[key] || [];
    return meta.map(m => {
      const found = existing.find((f: any) => f.factor === m.name);
      return found || { factor: m.name, score: false, notes: "" };
    });
  };

  const toggleFactor = (key: string, factorName: string, meta: typeof SOL_TYPE_FACTOR_META, scoreKey: string) => {
    const factors = getFactors(key, meta);
    const updated = factors.map((f: any) =>
      f.factor === factorName ? { ...f, score: !f.score } : f
    );
    const score = updated.filter((f: any) => f.score).length;
    update({ [key]: updated, [scoreKey]: score });
  };

  const updateFactorNotes = (key: string, factorName: string, notes: string, meta: typeof SOL_TYPE_FACTOR_META) => {
    const factors = getFactors(key, meta);
    const updated = factors.map((f: any) =>
      f.factor === factorName ? { ...f, notes } : f
    );
    update({ [key]: updated });
  };

  const renderFactorTable = (factorKey: string, meta: typeof SOL_TYPE_FACTOR_META, scoreKey: string, title: string) => {
    const factors = getFactors(factorKey, meta);
    const yesCount = factors.filter((f: any) => f.score).length;
    return (
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
          <span className="text-sm font-bold text-foreground">{yesCount}/{meta.length}</span>
        </div>
        {factors.map((f: any, idx: number) => {
          const m = meta[idx];
          return (
            <div key={m.name} className="flex items-start gap-3 py-2 border-t border-border/50">
              <button
                type="button"
                onClick={() => toggleFactor(factorKey, m.name, meta, scoreKey)}
                className={`shrink-0 mt-0.5 flex items-center w-9 h-5 rounded-full px-0.5 transition-colors ${
                  f.score ? "bg-primary justify-end" : "bg-muted border border-border justify-start"
                }`}
              >
                <span className="block w-4 h-4 rounded-full bg-white shadow-sm" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{m.name}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{m.desc}</p>
                <input
                  type="text"
                  className="mt-1 w-full text-[11px] bg-transparent border-b border-border/50 focus:border-primary outline-none py-0.5 text-muted-foreground placeholder:text-muted-foreground/50"
                  placeholder="Reasoning..."
                  value={f.notes || ""}
                  onChange={(e) => updateFactorNotes(factorKey, m.name, e.target.value, meta)}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const startMetaEdit = () => {
    setMetaDraft({
      pattern: data.pattern,
      patternReasoning: data.patternReasoning || "",
    });
    setEditingMeta(true);
  };

  const saveMeta = () => {
    update(metaDraft);
    setEditingMeta(false);
    setMetaDraft(null);
  };

  // --- Triggers ---
  const triggers = data.triggers || [];
  const [editTriggerIdx, setEditTriggerIdx] = useState<number | null>(null);
  const [triggerDraft, setTriggerDraft] = useState<any>(null);

  const addTrigger = () => {
    update({ triggers: [...triggers, { ...emptyTrigger }] });
    setEditTriggerIdx(triggers.length);
    setTriggerDraft({ ...emptyTrigger });
  };
  const saveTrigger = () => {
    if (editTriggerIdx === null) return;
    const items = [...triggers];
    items[editTriggerIdx] = triggerDraft;
    update({ triggers: items });
    setEditTriggerIdx(null);
    setTriggerDraft(null);
  };
  const removeTrigger = (i: number) => {
    update({ triggers: triggers.filter((_: any, idx: number) => idx !== i) });
    if (editTriggerIdx === i) { setEditTriggerIdx(null); setTriggerDraft(null); }
  };

  // --- Channels ---
  const channels = data.channels || [];
  const [editChannelIdx, setEditChannelIdx] = useState<number | null>(null);
  const [channelDraft, setChannelDraft] = useState<any>(null);

  const addChannel = () => {
    update({ channels: [...channels, { ...emptyChannel }] });
    setEditChannelIdx(channels.length);
    setChannelDraft({ ...emptyChannel });
  };
  const saveChannel = () => {
    if (editChannelIdx === null) return;
    const items = [...channels];
    items[editChannelIdx] = channelDraft;
    update({ channels: items });
    setEditChannelIdx(null);
    setChannelDraft(null);
  };
  const removeChannel = (i: number) => {
    update({ channels: channels.filter((_: any, idx: number) => idx !== i) });
    if (editChannelIdx === i) { setEditChannelIdx(null); setChannelDraft(null); }
  };

  // --- Child Agents ---
  const childAgents = data.childAgents || [];

  const addChildAgent = () => {
    update({ childAgents: [...childAgents, { ...emptyAgent }] });
    setEditAgentIdx(childAgents.length);
    setAgentDraft({ ...emptyAgent });
  };
  const saveChildAgent = () => {
    if (editAgentIdx === null || !agentDraft.name.trim()) return;
    const items = [...childAgents];
    items[editAgentIdx] = agentDraft;
    update({ childAgents: items });
    setEditAgentIdx(null);
    setAgentDraft(null);
  };
  const removeChildAgent = (i: number) => {
    update({ childAgents: childAgents.filter((_: any, idx: number) => idx !== i) });
    if (editAgentIdx === i) { setEditAgentIdx(null); setAgentDraft(null); }
  };

  // --- Scaffold ---
  const unlinkedCount = childAgents.filter((c: any) => !c.agentFolderId).length;

  const handleScaffold = async () => {
    if (!context?.projectId) return;
    // Find the parent agent id from the URL — we need the current agent's ID
    const pathParts = window.location.pathname.split("/");
    const agentIdx = pathParts.indexOf("agent");
    const agentId = agentIdx >= 0 ? pathParts[agentIdx + 1] : undefined;
    if (!agentId) return;

    setScaffolding(true);
    try {
      const result = await scaffoldChildren(context.projectId, agentId);
      if (result.created?.length) {
        // Reload the page to pick up new agents and updated brief
        window.location.reload();
      }
    } catch (e) {
      console.error("Scaffold failed:", e);
    } finally {
      setScaffolding(false);
    }
  };


  const isMultiAgent = data.pattern === "multi-agent";
  const selectedType = ARCH_TYPES.find((t) => t.value === data.pattern);

  const solutionType = data.solutionType ?? "agent";
  const solType = SOLUTION_TYPES.find((t) => t.value === solutionType);
  const isNonAgent = (solutionType === "flow" || solutionType === "not-recommended") && !data.solutionTypeOverride;

  const [editingSolutionType, setEditingSolutionType] = useState(false);
  const [solTypeDraft, setSolTypeDraft] = useState<any>(null);

  const startSolTypeEdit = () => {
    setSolTypeDraft({
      solutionType: data.solutionType ?? "agent",
      solutionTypeReason: data.solutionTypeReason ?? "",
      alternativeRecommendation: data.alternativeRecommendation ?? "",
    });
    setEditingSolutionType(true);
  };
  const saveSolType = () => {
    update(solTypeDraft);
    setEditingSolutionType(false);
    setSolTypeDraft(null);
  };

  const handleOverride = () => {
    update({ solutionType: "agent", solutionTypeOverride: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Architecture</h2>
        <p className="text-xs text-muted-foreground">Solution type assessment and agent structure — type, channels, triggers, and specialist agents</p>
        <SectionGuidelines sectionId="architecture" />
      </div>

      {/* Solution Type Assessment */}
      {editingSolutionType && solTypeDraft ? (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Solution Type</h3>
          <div className="grid grid-cols-2 gap-3">
            {SOLUTION_TYPES.map((t) => {
              const Icon = t.icon;
              const selected = solTypeDraft.solutionType === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setSolTypeDraft({ ...solTypeDraft, solutionType: t.value })}
                  className={`rounded-lg border-2 p-3 text-left transition-all ${
                    selected ? t.color : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${selected ? "" : "text-muted-foreground"}`} />
                    <p className={`text-sm font-medium ${selected ? "" : "text-foreground"}`}>{t.label}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 ml-6">{t.desc}</p>
                </button>
              );
            })}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Why this solution type?</label>
            <Textarea rows={2} placeholder="Reasoning for solution type choice" value={solTypeDraft.solutionTypeReason} onChange={(e) => setSolTypeDraft({ ...solTypeDraft, solutionTypeReason: e.target.value })} onKeyDown={editKeyHandler({ onSave: saveSolType, onCancel: () => { setEditingSolutionType(false); setSolTypeDraft(null); }, multiline: true })} />
          </div>
          {(solTypeDraft.solutionType === "flow" || solTypeDraft.solutionType === "not-recommended") && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Alternative recommendation</label>
              <Textarea rows={2} placeholder="What to build instead (Power Automate flow, SharePoint views, etc.)" value={solTypeDraft.alternativeRecommendation} onChange={(e) => setSolTypeDraft({ ...solTypeDraft, alternativeRecommendation: e.target.value })} onKeyDown={editKeyHandler({ onSave: saveSolType, onCancel: () => { setEditingSolutionType(false); setSolTypeDraft(null); }, multiline: true })} />
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setEditingSolutionType(false); setSolTypeDraft(null); }}><X className="h-3.5 w-3.5" /></Button>
            <Button size="sm" onClick={saveSolType}><Check className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Solution Type Assessment</h3>
          </div>
          <div className="cursor-pointer" onClick={startSolTypeEdit}>
            {solType ? (
              <div className={`rounded-lg border-2 p-4 transition-colors hover:opacity-90 ${solType.color}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <solType.icon className="h-5 w-5" />
                    <div>
                      <p className="text-sm font-semibold">{solType.label}</p>
                      <p className="text-xs opacity-70">{solType.desc}</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold">{data.solutionTypeScore ?? 0}/5</span>
                </div>
                {data.solutionTypeReason && <p className="text-xs mt-2 opacity-80">{data.solutionTypeReason}</p>}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-card p-4 hover:border-primary/40 transition-colors text-center">
                <p className="text-sm text-muted-foreground">Click to set solution type</p>
              </div>
            )}
          </div>

          {renderFactorTable("solutionTypeFactors", SOL_TYPE_FACTOR_META, "solutionTypeScore", "Scoring Factors")}
          {(() => {
            const s = getFactors("solutionTypeFactors", SOL_TYPE_FACTOR_META).filter(f => f.score).length;
            if (s >= 4) return <p className="text-xs font-medium text-primary mt-1.5">Score {s}/5 — Agent</p>;
            if (s === 3) return <p className="text-xs font-medium text-amber-600 mt-1.5">Score {s}/5 — Borderline: consider Hybrid (agent + flows)</p>;
            if (s >= 1) return <p className="text-xs font-medium text-purple-600 mt-1.5">Score {s}/5 — Power Automate Flow recommended instead</p>;
            return <p className="text-xs font-medium text-destructive mt-1.5">Score {s}/5 — Not recommended for MCS</p>;
          })()}

          {/* Alternative recommendation callout */}
          {data.alternativeRecommendation && isNonAgent && (
            <div className="rounded-lg border-2 border-amber-500/50 bg-amber-500/5 p-3">
              <p className="text-xs font-semibold text-amber-600 mb-1">Recommended Alternative</p>
              <p className="text-xs text-foreground">{data.alternativeRecommendation}</p>
            </div>
          )}

          {/* Override button */}
          {isNonAgent && (
            <Button variant="outline" size="sm" onClick={handleOverride} className="gap-1.5 text-xs">
              <Bot className="h-3.5 w-3.5" /> Build as Agent Anyway
            </Button>
          )}

          {data.solutionTypeOverride && (
            <p className="text-xs text-amber-600">Override active — building as agent despite solution type assessment.</p>
          )}
        </div>
      )}

      {/* Architecture Type — visual card selector */}
      {isNonAgent && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">Architecture details not applicable for {solutionType === "flow" ? "Power Automate flow" : "not-recommended"} solutions</p>
        </div>
      )}
      {!isNonAgent && editingMeta && metaDraft ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {ARCH_TYPES.map((t) => {
              const Icon = t.icon;
              const selected = metaDraft.pattern === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setMetaDraft({ ...metaDraft, pattern: t.value })}
                  className={`rounded-lg border-2 p-4 text-center transition-all ${
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/40"
                  }`}
                >
                  <Icon className={`h-6 w-6 mx-auto mb-2 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                  <p className={`text-sm font-medium ${selected ? "text-primary" : "text-foreground"}`}>{t.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</p>
                </button>
              );
            })}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Why this type?</label>
            <Textarea rows={2} placeholder="Reasoning for architecture choice" value={metaDraft.patternReasoning} onChange={(e) => setMetaDraft({ ...metaDraft, patternReasoning: e.target.value })} onKeyDown={editKeyHandler({ onSave: saveMeta, onCancel: () => { setEditingMeta(false); setMetaDraft(null); }, multiline: true })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setEditingMeta(false); setMetaDraft(null); }}><X className="h-3.5 w-3.5" /></Button>
            <Button size="sm" onClick={saveMeta}><Check className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      ) : !isNonAgent ? (
        <div className="cursor-pointer" onClick={startMetaEdit}>
          {selectedType ? (
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-3">
                <selectedType.icon className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-base font-semibold text-primary">{selectedType.label}</p>
                  <p className="text-xs text-muted-foreground">{selectedType.desc}</p>
                </div>
              </div>
              {data.patternReasoning && <p className="text-xs text-muted-foreground mt-2 pl-9">{data.patternReasoning}</p>}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card p-4 hover:border-primary/40 transition-colors text-center">
              <p className="text-sm text-muted-foreground">Click to select architecture type</p>
            </div>
          )}
        </div>
      ) : null}

      {/* Architecture Scoring Factors — informs single vs multi-agent decision */}
      {!isNonAgent && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Architecture Scoring</h3>
          <p className="text-[10px] text-muted-foreground">Score 3+ suggests multi-agent. These factors determine whether a single agent can handle all capabilities or specialists are needed.</p>
          {renderFactorTable("scoring", ARCH_SCORING_FACTOR_META, "archScoreCache", "Scoring Factors")}
          {(() => {
            const s = getFactors("scoring", ARCH_SCORING_FACTOR_META).filter(f => f.score).length;
            if (s >= 3) return <p className="text-xs font-medium text-amber-600 mt-1.5">Score {s}/6 — Multi-Agent recommended</p>;
            return <p className="text-xs font-medium text-primary mt-1.5">Score {s}/6 — Single Agent</p>;
          })()}
        </div>
      )}

      {/* Triggers + Channels — hidden when non-agent */}
      {!isNonAgent && (
      <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Triggers</h3>
          <Button variant="outline" size="sm" onClick={addTrigger} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add</Button>
        </div>
        <div className="space-y-2">
          {triggers.map((t: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4">
              {editTriggerIdx === i && triggerDraft ? (
                <div className="space-y-3">
                  <Select value={triggerDraft.type} onValueChange={(v) => setTriggerDraft({ ...triggerDraft, type: v })}>
                    <SelectTrigger><SelectValue placeholder="Trigger type" /></SelectTrigger>
                    <SelectContent>
                      {TRIGGER_TYPES.map((tt) => (
                        <SelectItem key={tt.value} value={tt.value}>
                          <div>
                            <span>{tt.label}</span>
                            <span className="text-[10px] text-muted-foreground block">{tt.desc}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Description (e.g. which events, schedule details)" value={triggerDraft.description} onChange={(e) => setTriggerDraft({ ...triggerDraft, description: e.target.value })} onKeyDown={editKeyHandler({ onSave: saveTrigger, onCancel: () => { setEditTriggerIdx(null); setTriggerDraft(null); } })} autoFocus />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => { setEditTriggerIdx(null); setTriggerDraft(null); }}><X className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" onClick={saveTrigger}><Check className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{TRIGGER_TYPES.find(tt => tt.value === (typeof t === "string" ? t : t.type))?.label || (typeof t === "string" ? t : t.type)}</p>
                    {typeof t !== "string" && t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditTriggerIdx(i); setTriggerDraft(typeof t === "string" ? { type: t, description: "" } : { ...t }); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeTrigger(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Channels */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Channels</h3>
          <Button variant="outline" size="sm" onClick={addChannel} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add</Button>
        </div>
        <div className="space-y-2">
          {channels.map((ch: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-card p-4">
              {editChannelIdx === i && channelDraft ? (
                <div className="space-y-3">
                  <Select value={channelDraft.name} onValueChange={(v) => setChannelDraft({ ...channelDraft, name: v })}>
                    <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
                    <SelectContent>
                      {CHANNEL_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          <div>
                            <span>{c.label}</span>
                            <span className="text-[10px] text-muted-foreground block">{c.desc}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Why this channel? (e.g. primary workspace for users)" value={channelDraft.reason} onChange={(e) => setChannelDraft({ ...channelDraft, reason: e.target.value })} onKeyDown={editKeyHandler({ onSave: saveChannel, onCancel: () => { setEditChannelIdx(null); setChannelDraft(null); } })} autoFocus />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => { setEditChannelIdx(null); setChannelDraft(null); }}><X className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" onClick={saveChannel}><Check className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{typeof ch === "string" ? ch : ch.name}</p>
                    {typeof ch !== "string" && ch.reason && <p className="text-xs text-muted-foreground">{ch.reason}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditChannelIdx(i); setChannelDraft(typeof ch === "string" ? { name: ch, reason: "" } : { ...ch }); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeChannel(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {channels.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">No channels defined. Add where this agent will be deployed.</p>
          )}
        </div>
      </div>
      </>
      )}

      {/* Child Agents (multi-agent only) */}
      {isMultiAgent && !isNonAgent && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Specialist Agents</h3>
            <div className="flex gap-2">
              {unlinkedCount > 0 && context?.projectId && (
                <Button variant="outline" size="sm" onClick={handleScaffold} disabled={scaffolding} className="gap-1.5">
                  <FolderTree className="h-3.5 w-3.5" />
                  {scaffolding ? "Scaffolding..." : `Scaffold Folders (${unlinkedCount})`}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={addChildAgent} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add</Button>
            </div>
          </div>
          <div className="space-y-2">
            {childAgents.map((agent: any, i: number) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4">
                {editAgentIdx === i && agentDraft ? (
                  <div className="space-y-3">
                    <Input placeholder="Agent name" value={agentDraft.name} onChange={(e) => setAgentDraft({ ...agentDraft, name: e.target.value })} onKeyDown={editKeyHandler({ onSave: saveChildAgent, onCancel: () => { setEditAgentIdx(null); setAgentDraft(null); } })} autoFocus />
                    <Input placeholder="Role / responsibility" value={agentDraft.role} onChange={(e) => setAgentDraft({ ...agentDraft, role: e.target.value })} onKeyDown={editKeyHandler({ onSave: saveChildAgent, onCancel: () => { setEditAgentIdx(null); setAgentDraft(null); } })} />
                    <Textarea rows={2} placeholder="Routing rule — when should the orchestrator route to this agent?" value={agentDraft.routingRule} onChange={(e) => setAgentDraft({ ...agentDraft, routingRule: e.target.value })} onKeyDown={editKeyHandler({ onSave: saveChildAgent, onCancel: () => { setEditAgentIdx(null); setAgentDraft(null); }, multiline: true })} />
                    <Select value={agentDraft.model || ""} onValueChange={(v) => setAgentDraft({ ...agentDraft, model: v })}>
                      <SelectTrigger><SelectValue placeholder="Model preference" /></SelectTrigger>
                      <SelectContent>
                        {MODEL_OPTIONS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            <div>
                              <span>{m.label}</span>
                              <span className="text-[10px] text-muted-foreground block">{m.desc}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => { setEditAgentIdx(null); setAgentDraft(null); }}><X className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" onClick={saveChildAgent}><Check className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-primary shrink-0" />
                        <p className="text-sm font-medium text-foreground">{agent.name}</p>
                        {agent.agentFolderId ? (
                          <span className="text-[10px] font-medium bg-success/15 text-success border border-success/30 rounded px-1.5 py-0.5">linked</span>
                        ) : (
                          <span className="text-[10px] font-medium bg-muted text-muted-foreground border border-border rounded px-1.5 py-0.5">unlinked</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 pl-6">{agent.role}</p>
                      {agent.routingRule && (
                        <p className="text-[11px] text-muted-foreground mt-1 pl-6">
                          <span className="font-medium">Route:</span> {agent.routingRule}
                        </p>
                      )}
                      {agent.model && (
                        <p className="text-[11px] text-muted-foreground pl-6">
                          <span className="font-medium">Model:</span> {agent.model}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditAgentIdx(i); setAgentDraft({ ...emptyAgent, ...agent }); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeChildAgent(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}


    </div>
  );
};

export default ArchitectureSection;
