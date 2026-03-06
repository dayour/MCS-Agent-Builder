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

const TOOL_TYPES = [
  { value: "connector", label: "Connector" },
  { value: "mcp", label: "MCP Server" },
  { value: "flow", label: "Flow (Power Automate)" },
  { value: "ai-tool", label: "AI Tool (Computer Use)" },
  { value: "custom-connector", label: "Custom Connector" },
  { value: "http", label: "REST API (HTTP)" },
];

const AUTH_TYPES = [
  { value: "none", label: "None" },
  { value: "oauth2", label: "OAuth 2.0" },
  { value: "api_key", label: "API Key" },
  { value: "obo", label: "OAuth 2.0 (OBO)" },
  { value: "service_principal", label: "Service Principal" },
  { value: "basic", label: "Basic Auth" },
];

const CREDENTIAL_MODES = [
  { value: "end_user", label: "End-user credentials" },
  { value: "maker", label: "Maker-provided" },
];

const TOOL_STATUSES = [
  { value: "available", label: "Available" },
  { value: "needs-setup", label: "Needs Setup" },
  { value: "needs-custom", label: "Needs Custom" },
  { value: "blocked", label: "Blocked" },
];

const TYPE_STYLES: Record<string, string> = {
  connector: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  mcp: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  flow: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "ai-tool": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "custom-connector": "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  http: "bg-muted text-muted-foreground",
};

const emptyItem = {
  name: "", type: "", auth: "none", credentialMode: "end_user",
  purpose: "", notes: "", phase: "MVP", status: "available",
};

const IntegrationsSection = ({ data, onChange }: Props) => {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<any>(null);

  const update = (items: any[]) => onChange?.({ ...data, items });
  const startEdit = (i: number) => { setEditIdx(i); setDraft({ ...data.items[i] }); };
  const saveEdit = () => { if (editIdx === null || !draft.name.trim()) return; const items = [...data.items]; items[editIdx] = draft; update(items); setEditIdx(null); setDraft(null); };
  const cancelEdit = () => { setEditIdx(null); setDraft(null); };
  const remove = (i: number) => { update(data.items.filter((_: any, idx: number) => idx !== i)); if (editIdx === i) cancelEdit(); };
  const add = () => { update([...data.items, { ...emptyItem }]); setEditIdx(data.items.length); setDraft({ ...emptyItem }); };

  const typeLabel = (v: string) => TOOL_TYPES.find((t) => t.value === v)?.label ?? v;
  const authLabel = (v: string) => AUTH_TYPES.find((t) => t.value === v)?.label ?? v;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Tools</h2>
          <p className="text-xs text-muted-foreground">Connected systems, actions, and services</p>
          <SectionGuidelines sectionId="tools" />
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
                <Input placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                <Input placeholder="Purpose — what data/actions does this provide?" value={draft.purpose || ""} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <Select value={draft.type || ""} onValueChange={(v) => setDraft({ ...draft, type: v })}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {TOOL_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={draft.auth || "none"} onValueChange={(v) => setDraft({ ...draft, auth: v })}>
                    <SelectTrigger><SelectValue placeholder="Auth type" /></SelectTrigger>
                    <SelectContent>
                      {AUTH_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Select value={draft.credentialMode || "end_user"} onValueChange={(v) => setDraft({ ...draft, credentialMode: v })}>
                    <SelectTrigger><SelectValue placeholder="Credentials" /></SelectTrigger>
                    <SelectContent>
                      {CREDENTIAL_MODES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={draft.status || "available"} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      {TOOL_STATUSES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
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
                <Input placeholder="Notes" value={draft.notes || ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
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
                        {typeLabel(item.type)}
                      </span>
                    )}
                    {item.auth && item.auth !== "none" && (
                      <span className="text-[10px] text-muted-foreground">{authLabel(item.auth)}</span>
                    )}
                    <StatusBadge status={item.status || "available"} />
                  </div>
                  {item.purpose && <p className="text-xs text-muted-foreground">{item.purpose}</p>}
                  {item.notes && <p className="text-xs text-muted-foreground/70 mt-0.5">{item.notes}</p>}
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

export default IntegrationsSection;
