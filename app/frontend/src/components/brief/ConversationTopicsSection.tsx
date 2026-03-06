import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import StatusBadge from "@/components/StatusBadge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SectionGuidelines from "./SectionGuidelines";
import AdaptiveCardPreview from "./AdaptiveCardPreview";

interface Props { data: any; onChange?: (data: any) => void; }

const emptyItem = {
  name: "", description: "", type: "generative", phase: "MVP",
  flowDescription: "", outputFormat: "text", triggerType: "agent-chooses",
  implements: [] as string[], connectedIntegrations: [] as string[],
};

const emptyStarter = { title: "", text: "" };

const OUTPUT_FORMAT_STYLES: Record<string, string> = {
  "adaptive-card": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "text": "bg-muted text-muted-foreground",
  "knowledge": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "redirect": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "escalate": "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const TRIGGER_STYLES = "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300";

const ConversationTopicsSection = ({ data, onChange }: Props) => {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const [editStarterIdx, setEditStarterIdx] = useState<number | null>(null);
  const [starterDraft, setStarterDraft] = useState<any>(null);

  const starters: any[] = data.starters ?? [];
  const cardDesign = data.cardDesign ?? null;

  // Topic CRUD
  const update = (items: any[]) => onChange?.({ ...data, items });
  const startEdit = (i: number) => { setEditIdx(i); setDraft({ ...data.items[i] }); };
  const saveEdit = () => {
    if (editIdx === null || !draft.name.trim()) return;
    const items = [...data.items]; items[editIdx] = draft;
    update(items); setEditIdx(null); setDraft(null);
  };
  const cancelEdit = () => { setEditIdx(null); setDraft(null); };
  const remove = (i: number) => { update(data.items.filter((_: any, idx: number) => idx !== i)); if (editIdx === i) cancelEdit(); };
  const add = () => { update([...data.items, { ...emptyItem }]); setEditIdx(data.items.length); setDraft({ ...emptyItem }); };

  // Starter CRUD
  const updateStarters = (newStarters: any[]) => onChange?.({ ...data, starters: newStarters });
  const startEditStarter = (i: number) => { setEditStarterIdx(i); setStarterDraft({ ...starters[i] }); };
  const saveStarter = () => {
    if (editStarterIdx === null || !starterDraft.title.trim()) return;
    const s = [...starters]; s[editStarterIdx] = starterDraft;
    updateStarters(s); setEditStarterIdx(null); setStarterDraft(null);
  };
  const cancelStarter = () => { setEditStarterIdx(null); setStarterDraft(null); };
  const removeStarter = (i: number) => { updateStarters(starters.filter((_: any, idx: number) => idx !== i)); if (editStarterIdx === i) cancelStarter(); };
  const addStarter = () => { updateStarters([...starters, { ...emptyStarter }]); setEditStarterIdx(starters.length); setStarterDraft({ ...emptyStarter }); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Topics</h2>
          <p className="text-xs text-muted-foreground">Conversation flows the agent can run</p>
          <SectionGuidelines sectionId="conversation-topics" />
        </div>
        <Button variant="outline" size="sm" onClick={add} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Topic</Button>
      </div>

      {/* ── A. Adaptive Card Preview ──────────────────────────── */}
      {cardDesign && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Card Preview</h3>
          <AdaptiveCardPreview cardDesign={cardDesign} agentName={data.items?.[0]?.name} />
        </div>
      )}

      {/* ── B. Conversation Starters ─────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conversation Starters</h3>
          <Button variant="ghost" size="sm" onClick={addStarter} className="gap-1 h-7 text-xs">
            <Plus className="h-3 w-3" /> Add
          </Button>
        </div>
        {starters.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic">No conversation starters defined</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {starters.map((s: any, i: number) => (
              editStarterIdx === i && starterDraft ? (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-primary/30 bg-card p-2 w-full">
                  <Input
                    placeholder="Title (chip label)"
                    value={starterDraft.title}
                    onChange={(e) => setStarterDraft({ ...starterDraft, title: e.target.value })}
                    className="h-7 text-xs flex-1"
                  />
                  <Input
                    placeholder="Message text"
                    value={starterDraft.text}
                    onChange={(e) => setStarterDraft({ ...starterDraft, text: e.target.value })}
                    className="h-7 text-xs flex-[2]"
                  />
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelStarter}><X className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={saveStarter}><Check className="h-3 w-3" /></Button>
                </div>
              ) : (
                <div
                  key={i}
                  className="group flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 hover:border-primary/30 transition-colors cursor-default"
                >
                  <MessageCircle className="h-3 w-3 text-muted-foreground" />
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-foreground">{s.title}</span>
                    {s.text && s.text !== s.title && (
                      <span className="text-[10px] text-muted-foreground ml-1.5 truncate">{s.text.length > 40 ? s.text.slice(0, 40) + "..." : s.text}</span>
                    )}
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => startEditStarter(i)}><Pencil className="h-2.5 w-2.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => removeStarter(i)}><Trash2 className="h-2.5 w-2.5" /></Button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>

      {/* ── C. Topic List (enriched) ──────────────────────────── */}
      <div className="space-y-2">
        {data.items.map((item: any, i: number) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            {editIdx === i && draft ? (
              <div className="space-y-3">
                <Input placeholder="Topic name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                <Input placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v })}>
                    <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="generative">Generative</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={draft.phase || "MVP"} onValueChange={(v) => setDraft({ ...draft, phase: v })}>
                    <SelectTrigger><SelectValue placeholder="Phase" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MVP">MVP</SelectItem>
                      <SelectItem value="Future">Future</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={draft.outputFormat || "text"} onValueChange={(v) => setDraft({ ...draft, outputFormat: v })}>
                    <SelectTrigger><SelectValue placeholder="Output Format" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="adaptive-card">Adaptive Card</SelectItem>
                      <SelectItem value="knowledge">Knowledge</SelectItem>
                      <SelectItem value="redirect">Redirect</SelectItem>
                      <SelectItem value="escalate">Escalate</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={draft.triggerType || "agent-chooses"} onValueChange={(v) => setDraft({ ...draft, triggerType: v })}>
                    <SelectTrigger><SelectValue placeholder="Trigger Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agent-chooses">Agent Chooses</SelectItem>
                      <SelectItem value="phrases">Phrases</SelectItem>
                      <SelectItem value="auto-start">Auto Start</SelectItem>
                      <SelectItem value="on-event">On Event</SelectItem>
                      <SelectItem value="on-redirect">On Redirect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {draft.type === "custom" && (
                  <Textarea
                    placeholder="Flow description — describe the full conversation design: inputs, logic, outputs, error handling. The Topic Engineer AI uses this to generate the implementation."
                    value={draft.flowDescription || ""}
                    onChange={(e) => setDraft({ ...draft, flowDescription: e.target.value })}
                    rows={5}
                  />
                )}
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={cancelEdit}><X className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" onClick={saveEdit}><Check className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    <span className="text-[11px] font-medium capitalize text-primary">{item.type || "generative"}</span>
                    <StatusBadge status={item.phase || "MVP"} />
                    {item.outputFormat && item.outputFormat !== "text" && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${OUTPUT_FORMAT_STYLES[item.outputFormat] || OUTPUT_FORMAT_STYLES["text"]}`}>
                        {item.outputFormat}
                      </span>
                    )}
                    {item.triggerType && item.triggerType !== "agent-chooses" && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${TRIGGER_STYLES}`}>
                        {item.triggerType}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                  {item.type === "custom" && item.flowDescription && (
                    <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{item.flowDescription}</p>
                  )}
                  {/* Linked capabilities */}
                  {item.implements?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {item.implements.map((cap: string, j: number) => (
                        <span key={j} className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary">
                          {cap}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Connected integrations */}
                  {item.connectedIntegrations?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.connectedIntegrations.map((tool: string, j: number) => (
                        <span key={j} className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 ml-3 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(i)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConversationTopicsSection;
