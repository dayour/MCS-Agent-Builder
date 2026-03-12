import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { editKeyHandler } from "@/lib/editKeys";
import StatusBadge from "@/components/StatusBadge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SectionGuidelines from "./SectionGuidelines";

interface Props { data: any; onChange?: (data: any) => void; }

const KNOWLEDGE_TYPES = [
  { value: "SharePoint", label: "SharePoint", desc: "SharePoint site or library — agent searches pages and documents" },
  { value: "Uploaded files", label: "Uploaded Files", desc: "PDF, DOCX, XLSX uploaded directly — good for policies, manuals" },
  { value: "Dataverse", label: "Dataverse", desc: "Structured data tables — good for records, lookups, CRM data" },
  { value: "Public websites", label: "Public Websites", desc: "Public URLs the agent can crawl — FAQs, product pages, docs" },
  { value: "Graph connectors", label: "Graph Connectors", desc: "Enterprise search via Microsoft Graph — spans multiple sources" },
];

const TYPE_STYLES: Record<string, string> = {
  SharePoint: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "Uploaded files": "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  Dataverse: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "Public websites": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "Graph connectors": "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
};

const STATUS_OPTIONS = [
  { value: "available", label: "Available", desc: "URL/files ready — can be configured now" },
  { value: "needs-setup", label: "Needs Setup", desc: "Source exists but needs permissions or preparation" },
  { value: "blocked", label: "Blocked", desc: "Can't access — waiting on approval or doesn't exist yet" },
];

const emptyItem = { name: "", type: "", purpose: "", location: "", phase: "MVP", status: "needs-setup" };

const KnowledgeSourcesSection = ({ data, onChange }: Props) => {
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
          <h2 className="text-lg font-semibold text-foreground mb-1">Knowledge</h2>
          <p className="text-xs text-muted-foreground">Data sources the agent searches to answer questions — the agent's memory</p>
          <SectionGuidelines sectionId="knowledge-sources" />
        </div>
        <Button variant="outline" size="sm" onClick={add} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add</Button>
      </div>
      <div className="space-y-2">
        {data.items.map((item: any, i: number) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            {editIdx === i && draft ? (
              <div className="space-y-3" onKeyDown={editKeyHandler({ onSave: saveEdit, onCancel: cancelEdit })}>
                <Input placeholder="Name (e.g., HR Policy Library, Product Catalog)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus />
                <div>
                  <Input placeholder="Purpose — what questions does this source answer?" value={draft.purpose || ""} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })} />
                  <p className="text-[10px] text-muted-foreground mt-1">Be specific — "US employee benefits policies" is better than "HR docs". The agent uses this to pick the right source.</p>
                </div>
                <div>
                  <Input placeholder="Source location (URL, SharePoint path, or table name)" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
                  <p className="text-[10px] text-muted-foreground mt-1">Provide the actual URL or path — we need this to configure the agent during build</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Select value={draft.type || ""} onValueChange={(v) => setDraft({ ...draft, type: v })}>
                    <SelectTrigger><SelectValue placeholder="Source type" /></SelectTrigger>
                    <SelectContent>
                      {KNOWLEDGE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <div>
                            <span>{t.label}</span>
                            <span className="text-[10px] text-muted-foreground block">{t.desc}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((t) => (
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
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={cancelEdit}><X className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" onClick={saveEdit}><Check className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    {item.type && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_STYLES[item.type] || "bg-muted text-muted-foreground"}`}>
                        {item.type}
                      </span>
                    )}
                    <StatusBadge status={item.status} />
                    <StatusBadge status={item.phase || "MVP"} />
                  </div>
                  {item.purpose && <p className="text-xs text-muted-foreground">{item.purpose}</p>}
                  {item.location && <p className="text-xs text-muted-foreground/70 mt-0.5">{item.location}</p>}
                </div>
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

export default KnowledgeSourcesSection;
