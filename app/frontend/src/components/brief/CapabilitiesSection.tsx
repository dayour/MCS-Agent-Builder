import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import StatusBadge from "@/components/StatusBadge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import SectionGuidelines from "./SectionGuidelines";

interface Props { data: any; onChange?: (data: any) => void; }

const emptyItem = { name: "", description: "", enabled: true, tag: "MVP" };

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
          <p className="text-xs text-muted-foreground">Features this agent can perform</p>
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
                <Input placeholder="Capability name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                <Input placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={draft.enabled} onCheckedChange={(v) => setDraft({ ...draft, enabled: v })} />
                    <span className="text-xs text-muted-foreground">{draft.enabled ? "Enabled" : "Disabled"}</span>
                  </div>
                  <Select value={draft.tag} onValueChange={(v) => setDraft({ ...draft, tag: v })}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
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
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${item.enabled ? "bg-success" : "bg-muted-foreground/30"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <StatusBadge status={item.tag} />
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
