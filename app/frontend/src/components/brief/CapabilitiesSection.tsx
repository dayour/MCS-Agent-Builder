import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/StatusBadge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SectionGuidelines from "./SectionGuidelines";

interface Props { data: any; onChange?: (data: any) => void; }

const IMPL_TYPES = [
  { value: "prompt", label: "Prompt", desc: "Handled by instructions alone — no extra config needed" },
  { value: "topic", label: "Topic", desc: "Needs a custom conversation flow with specific steps" },
  { value: "tool", label: "Tool", desc: "Needs a connector, MCP server, or API to fetch/send data" },
  { value: "knowledge", label: "Knowledge", desc: "Answered from a knowledge source (SharePoint, files, etc.)" },
  { value: "flow", label: "Flow", desc: "Needs a Power Automate flow for automation/triggers" },
];

const IMPL_STYLES: Record<string, string> = {
  prompt: "bg-muted text-muted-foreground",
  topic: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  tool: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  knowledge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  flow: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

const emptyItem = { name: "", description: "", phase: "MVP", implementationType: "prompt" };

const CapabilitiesSection = ({ data, onChange }: Props) => {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<any>(null);

  const update = (items: any[]) => onChange?.({ ...data, items });
  const startEdit = (i: number) => { setEditIdx(i); setDraft({ ...data.items[i] }); };
  const saveEdit = () => { if (editIdx === null || !draft.name.trim()) return; const items = [...data.items]; items[editIdx] = draft; update(items); setEditIdx(null); setDraft(null); };
  const cancelEdit = () => { setEditIdx(null); setDraft(null); };
  const remove = (i: number) => { update(data.items.filter((_: any, idx: number) => idx !== i)); if (editIdx === i) cancelEdit(); };
  const add = () => { update([...data.items, { ...emptyItem }]); setEditIdx(data.items.length); setDraft({ ...emptyItem }); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Capabilities</h2>
          <p className="text-xs text-muted-foreground">Features this agent can perform — each one becomes something we test and verify works</p>
          <SectionGuidelines sectionId="capabilities" />
        </div>
        <Button variant="outline" size="sm" onClick={add} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      <div className="space-y-2">
        {data.items.map((item: any, i: number) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            {editIdx === i && draft ? (
              <div className="space-y-3">
                <div>
                  <Input placeholder="Capability name (e.g., Check order status)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  <p className="text-[10px] text-muted-foreground mt-1">Write as a user-facing action — how would a customer describe what this does?</p>
                </div>
                <Input placeholder="Description — what this does and what data it needs" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Select value={draft.implementationType || "prompt"} onValueChange={(v) => setDraft({ ...draft, implementationType: v })}>
                      <SelectTrigger><SelectValue placeholder="How to implement" /></SelectTrigger>
                      <SelectContent>
                        {IMPL_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            <div>
                              <span>{t.label}</span>
                              <span className="text-[10px] text-muted-foreground block">{t.desc}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-1">Determines what we build — "Prompt" = free (just instructions), others need configuration</p>
                  </div>
                  <Select value={draft.phase || "MVP"} onValueChange={(v) => setDraft({ ...draft, phase: v })}>
                    <SelectTrigger><SelectValue placeholder="Phase" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MVP">
                        <div>
                          <span>MVP</span>
                          <span className="text-[10px] text-muted-foreground block">Build now — included in this sprint</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Future">
                        <div>
                          <span>Future</span>
                          <span className="text-[10px] text-muted-foreground block">Deferred — documented but not built yet</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={cancelEdit}><X className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" onClick={saveEdit}><Check className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    {item.implementationType && item.implementationType !== "prompt" && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${IMPL_STYLES[item.implementationType] || IMPL_STYLES.prompt}`}>
                        {item.implementationType}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <StatusBadge status={item.phase || "MVP"} />
                <div className="flex gap-1">
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

export default CapabilitiesSection;
