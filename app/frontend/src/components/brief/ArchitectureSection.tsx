import { useState } from "react";
import {
  Pencil, Check, X, Plus, Trash2, Bot, Network, Link, FolderTree,
  Zap, AlertTriangle, GitBranch,
} from "lucide-react";
import SectionGuidelines from "./SectionGuidelines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
const emptyTrigger = { type: "user-initiated", description: "" };
const emptyChannel = { name: "", reason: "" };

const TRIGGER_TYPES = ["User-initiated", "Scheduled", "Event-driven"];
const CHANNEL_OPTIONS = [
  "Microsoft Teams", "M365 Copilot", "Web chat", "Direct Line", "Slack", "Mobile app",
];
const MODEL_OPTIONS = [
  "gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano",
  "o1", "o1-mini", "o3-mini", "DeepSeek-R1",
];

const ARCH_TYPES = [
  { value: "single-agent", label: "Single Agent", icon: Bot, desc: "One agent handles everything" },
  { value: "multi-agent", label: "Multi-Agent", icon: Network, desc: "Orchestrator routes to specialists" },
  { value: "connected-agent", label: "Connected Agent", icon: Link, desc: "Agents linked across solutions" },
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

const ArchitectureSection = ({ data, onChange, context }: Props) => {
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaDraft, setMetaDraft] = useState<any>(null);
  const [editAgentIdx, setEditAgentIdx] = useState<number | null>(null);
  const [agentDraft, setAgentDraft] = useState<any>(null);

  const [scaffolding, setScaffolding] = useState(false);

  const update = (partial: any) => onChange?.({ ...data, ...partial });

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
  const solutionTypeFactors = data.solutionTypeFactors ?? [];

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
            <Textarea rows={2} placeholder="Reasoning for solution type choice" value={solTypeDraft.solutionTypeReason} onChange={(e) => setSolTypeDraft({ ...solTypeDraft, solutionTypeReason: e.target.value })} />
          </div>
          {(solTypeDraft.solutionType === "flow" || solTypeDraft.solutionType === "not-recommended") && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Alternative recommendation</label>
              <Textarea rows={2} placeholder="What to build instead (Power Automate flow, SharePoint views, etc.)" value={solTypeDraft.alternativeRecommendation} onChange={(e) => setSolTypeDraft({ ...solTypeDraft, alternativeRecommendation: e.target.value })} />
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

          {/* Factor table */}
          {solutionTypeFactors.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left font-medium pb-1">Factor</th>
                    <th className="text-center font-medium pb-1 w-12">Score</th>
                    <th className="text-left font-medium pb-1">Reasoning</th>
                  </tr>
                </thead>
                <tbody>
                  {solutionTypeFactors.map((f: any, i: number) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="py-1 font-medium text-foreground">{f.factor}</td>
                      <td className="py-1 text-center">{f.score ? "Yes" : "No"}</td>
                      <td className="py-1 text-muted-foreground">{f.notes || "\u2014"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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
            <Textarea rows={2} placeholder="Reasoning for architecture choice" value={metaDraft.patternReasoning} onChange={(e) => setMetaDraft({ ...metaDraft, patternReasoning: e.target.value })} />
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
                        <SelectItem key={tt} value={tt}>{tt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Description (e.g. which events, schedule details)" value={triggerDraft.description} onChange={(e) => setTriggerDraft({ ...triggerDraft, description: e.target.value })} />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => { setEditTriggerIdx(null); setTriggerDraft(null); }}><X className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" onClick={saveTrigger}><Check className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{typeof t === "string" ? t : t.type}</p>
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
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Why this channel? (e.g. primary workspace for users)" value={channelDraft.reason} onChange={(e) => setChannelDraft({ ...channelDraft, reason: e.target.value })} />
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
                    <Input placeholder="Agent name" value={agentDraft.name} onChange={(e) => setAgentDraft({ ...agentDraft, name: e.target.value })} />
                    <Input placeholder="Role / responsibility" value={agentDraft.role} onChange={(e) => setAgentDraft({ ...agentDraft, role: e.target.value })} />
                    <Textarea rows={2} placeholder="Routing rule — when should the orchestrator route to this agent?" value={agentDraft.routingRule} onChange={(e) => setAgentDraft({ ...agentDraft, routingRule: e.target.value })} />
                    <Select value={agentDraft.model || ""} onValueChange={(v) => setAgentDraft({ ...agentDraft, model: v })}>
                      <SelectTrigger><SelectValue placeholder="Model preference" /></SelectTrigger>
                      <SelectContent>
                        {MODEL_OPTIONS.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
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
