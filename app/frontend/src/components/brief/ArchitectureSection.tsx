import { useState } from "react";
import { Pencil, Check, X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

interface Props { data: any; onChange?: (data: any) => void; }

const emptyAgent = { name: "", role: "" };
const emptyTrigger = { type: "user-initiated", description: "" };
const TRIGGER_TYPES = ["User-initiated", "Scheduled", "Event-driven"];

const ArchitectureSection = ({ data, onChange }: Props) => {
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaDraft, setMetaDraft] = useState<any>(null);
  const [editAgentIdx, setEditAgentIdx] = useState<number | null>(null);
  const [agentDraft, setAgentDraft] = useState<any>(null);
  const [editScoreIdx, setEditScoreIdx] = useState<number | null>(null);
  const [scoreDraft, setScoreDraft] = useState<any>(null);

  const update = (partial: any) => onChange?.({ ...data, ...partial });

  const startMetaEdit = () => {
    setMetaDraft({
      pattern: data.pattern,
      patternReasoning: data.patternReasoning || "",
      model: data.model,
      modelRationale: data.modelRationale || "",
    });
    setEditingMeta(true);
  };

  const saveMeta = () => {
    update(metaDraft);
    setEditingMeta(false);
    setMetaDraft(null);
  };

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

  const startScoreEdit = (i: number) => { setEditScoreIdx(i); setScoreDraft({ ...data.scoring[i] }); };
  const saveScore = () => {
    if (editScoreIdx === null) return;
    const scoring = [...data.scoring];
    scoring[editScoreIdx] = scoreDraft;
    update({ scoring });
    setEditScoreIdx(null);
  };

  const isMultiAgent = data.pattern === "multi-agent";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Architecture</h2>
        <p className="text-xs text-muted-foreground">How the agent is structured — type, model, triggers, and specialist agents</p>
      </div>

      {/* Type & Model */}
      {editingMeta && metaDraft ? (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Architecture Type</label>
              <Select value={metaDraft.pattern} onValueChange={(v) => setMetaDraft({ ...metaDraft, pattern: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single-agent">Single Agent</SelectItem>
                  <SelectItem value="multi-agent">Multi-Agent</SelectItem>
                  <SelectItem value="connected-agent">Connected Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Recommended Model</label>
              <Input value={metaDraft.model} onChange={(e) => setMetaDraft({ ...metaDraft, model: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Type Reasoning</label>
            <Textarea rows={2} placeholder="Why this architecture type?" value={metaDraft.patternReasoning} onChange={(e) => setMetaDraft({ ...metaDraft, patternReasoning: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Model Rationale</label>
            <Textarea rows={2} placeholder="Why this model?" value={metaDraft.modelRationale} onChange={(e) => setMetaDraft({ ...metaDraft, modelRationale: e.target.value })} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setEditingMeta(false); setMetaDraft(null); }}><X className="h-3.5 w-3.5" /></Button>
            <Button size="sm" onClick={saveMeta}><Check className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 cursor-pointer" onClick={startMetaEdit}>
          <div className="rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Architecture Type</h3>
            <p className="text-lg font-bold text-primary capitalize">{data.pattern?.replace("-", " ")}</p>
            {data.patternReasoning && <p className="text-xs text-muted-foreground mt-1">{data.patternReasoning}</p>}
          </div>
          <div className="rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Recommended Model</h3>
            <p className="text-lg font-bold text-foreground">{data.model}</p>
            {data.modelRationale && <p className="text-xs text-muted-foreground mt-1">{data.modelRationale}</p>}
          </div>
        </div>
      )}

      {/* Triggers */}
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

      {/* Child Agents (multi-agent only) */}
      {isMultiAgent && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Specialist Agents</h3>
            <Button variant="outline" size="sm" onClick={addChildAgent} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add</Button>
          </div>
          <div className="space-y-2">
            {childAgents.map((agent: any, i: number) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4">
                {editAgentIdx === i && agentDraft ? (
                  <div className="space-y-3">
                    <Input placeholder="Agent name" value={agentDraft.name} onChange={(e) => setAgentDraft({ ...agentDraft, name: e.target.value })} />
                    <Input placeholder="Role / responsibility" value={agentDraft.role} onChange={(e) => setAgentDraft({ ...agentDraft, role: e.target.value })} />
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => { setEditAgentIdx(null); setAgentDraft(null); }}><X className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" onClick={saveChildAgent}><Check className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">{agent.role}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditAgentIdx(i); setAgentDraft({ ...agent }); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeChildAgent(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Complexity Scoring */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Complexity Scoring</h3>
        <div className="space-y-3">
          {data.scoring.map((s: any, i: number) => (
            <div key={i}>
              {editScoreIdx === i && scoreDraft ? (
                <div className="flex items-center gap-3">
                  <Input className="w-36 h-8 text-xs" value={scoreDraft.factor} onChange={(e) => setScoreDraft({ ...scoreDraft, factor: e.target.value })} />
                  <div className="flex-1">
                    <Slider value={[scoreDraft.score]} min={1} max={10} step={1} onValueChange={([v]) => setScoreDraft({ ...scoreDraft, score: v })} />
                  </div>
                  <span className="text-xs font-mono text-foreground w-6 text-right">{scoreDraft.score}</span>
                  <Input className="w-40 h-8 text-[11px]" value={scoreDraft.notes} onChange={(e) => setScoreDraft({ ...scoreDraft, notes: e.target.value })} />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditScoreIdx(null)}><X className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" className="h-7 w-7" onClick={saveScore}><Check className="h-3.5 w-3.5" /></Button>
                </div>
              ) : (
                <div className="flex items-center gap-3 cursor-pointer hover:bg-surface-2 rounded-md px-1 -mx-1 py-0.5 transition-colors" onClick={() => startScoreEdit(i)}>
                  <span className="w-36 text-xs text-muted-foreground shrink-0">{s.factor}</span>
                  <div className="flex-1 h-2 rounded-full bg-surface-3 overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${s.score * 10}%` }} />
                  </div>
                  <span className="text-xs font-mono text-foreground w-6 text-right">{s.score}</span>
                  <span className="text-[11px] text-muted-foreground w-40 truncate">{s.notes}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ArchitectureSection;
