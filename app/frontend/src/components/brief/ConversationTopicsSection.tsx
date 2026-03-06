import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import StatusBadge from "@/components/StatusBadge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SectionGuidelines from "./SectionGuidelines";

interface Props { data: any; onChange?: (data: any) => void; }

const emptyItem = {
  name: "", description: "", type: "generative", phase: "MVP",
  flowDescription: "", outputFormat: "text", triggerType: "agent-chooses",
  triggerPhrases: [] as string[],
  implements: [] as string[], connectedIntegrations: [] as string[],
};

const OUTPUT_FORMAT_STYLES: Record<string, string> = {
  "adaptive-card": "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "text": "bg-muted text-muted-foreground",
  "knowledge": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "redirect": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "escalate": "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const TRIGGER_STYLES = "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300";

const TRIGGER_TYPES = [
  { value: "agent-chooses", label: "Agent Chooses", desc: "AI matches based on topic description — most common" },
  { value: "phrases", label: "Phrases", desc: "Fires when user says specific trigger phrases" },
  { value: "conversation-start", label: "Conversation Start", desc: "Runs automatically when user first opens the chat" },
  { value: "fallback", label: "Fallback", desc: "Catches messages when no other topic matches" },
  { value: "on-redirect", label: "Redirected To", desc: "Called from another topic via redirect action" },
  { value: "on-event", label: "On Event", desc: "Triggered by a system event (SharePoint, Dataverse, etc.)" },
  { value: "escalation", label: "Escalation", desc: "User says 'talk to a person' or agent escalates" },
  { value: "inactivity", label: "Inactivity", desc: "User hasn't responded for a while" },
  { value: "on-error", label: "On Error", desc: "Handles errors during conversation" },
  { value: "on-sign-in", label: "Sign In", desc: "Triggered when authentication is required" },
];

const ConversationTopicsSection = ({ data, onChange }: Props) => {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<any>(null);

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

  /** Parse comma-separated string to array */
  const csvToArray = (s: string) => s.split(",").map((v) => v.trim()).filter(Boolean);

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

      <div className="space-y-2">
        {data.items.map((item: any, i: number) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            {editIdx === i && draft ? (
              <div className="space-y-3">
                <Input placeholder="Topic name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                <Textarea
                  placeholder="Description — what this topic does (also used for AI routing: say when to use AND when NOT to use)"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className="min-h-[50px] text-sm"
                />
                <div className="grid grid-cols-3 gap-3">
                  <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v })}>
                    <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="generative">Generative</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={draft.triggerType || "agent-chooses"} onValueChange={(v) => setDraft({ ...draft, triggerType: v })}>
                    <SelectTrigger><SelectValue placeholder="Trigger" /></SelectTrigger>
                    <SelectContent>
                      {TRIGGER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <div>
                            <span>{t.label}</span>
                            <span className="text-[10px] text-muted-foreground block">{t.desc}</span>
                          </div>
                        </SelectItem>
                      ))}
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
                  <Input
                    placeholder="Implements (capability names, comma-separated)"
                    value={(draft.implements ?? []).join(", ")}
                    onChange={(e) => setDraft({ ...draft, implements: csvToArray(e.target.value || "") })}
                  />
                </div>
                {draft.triggerType === "phrases" && (
                  <Input
                    placeholder="Trigger phrases (comma-separated)"
                    value={(draft.triggerPhrases ?? []).join(", ")}
                    onChange={(e) => setDraft({ ...draft, triggerPhrases: csvToArray(e.target.value || "") })}
                  />
                )}
                <Input
                  placeholder="Connected integrations (tool names, comma-separated)"
                  value={(draft.connectedIntegrations ?? []).join(", ")}
                  onChange={(e) => setDraft({ ...draft, connectedIntegrations: csvToArray(e.target.value || "") })}
                />
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
                        {TRIGGER_TYPES.find(t => t.value === item.triggerType)?.label || item.triggerType}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                  {item.type === "custom" && item.flowDescription && (
                    <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{item.flowDescription}</p>
                  )}
                  {item.implements?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {item.implements.map((cap: string, j: number) => (
                        <span key={j} className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary">{cap}</span>
                      ))}
                    </div>
                  )}
                  {item.connectedIntegrations?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.connectedIntegrations.map((tool: string, j: number) => (
                        <span key={j} className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">{tool}</span>
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
