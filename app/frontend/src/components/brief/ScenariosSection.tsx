import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import SectionGuidelines from "./SectionGuidelines";

interface Props { data: any; onChange?: (data: any) => void; }

const emptyItem = { userMessage: "", expectedResponse: "" };

const ScenariosSection = ({ data, onChange }: Props) => {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<any>(null);

  const update = (items: any[]) => onChange?.({ ...data, items });
  const startEdit = (i: number) => { setEditIdx(i); setDraft({ ...data.items[i] }); };
  const saveEdit = () => { if (editIdx === null || !draft.userMessage.trim()) return; const items = [...data.items]; items[editIdx] = draft; update(items); setEditIdx(null); setDraft(null); };
  const cancelEdit = () => { setEditIdx(null); setDraft(null); };
  const remove = (i: number) => { update(data.items.filter((_: any, idx: number) => idx !== i)); if (editIdx === i) cancelEdit(); };
  const add = () => { update([...data.items, { ...emptyItem }]); setEditIdx(data.items.length); setDraft({ ...emptyItem }); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Scenarios</h2>
          <p className="text-xs text-muted-foreground">Example user interactions by category</p>
          <SectionGuidelines sectionId="scenarios" />
        </div>
        <Button variant="outline" size="sm" onClick={add} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add</Button>
      </div>
      <div className="space-y-4">
        {data.items.map((item: any, i: number) => (
          <div key={i} className="rounded-lg border border-border bg-card overflow-hidden">
            {editIdx === i && draft ? (
              <div className="p-4 space-y-3">
                <Textarea placeholder="User message" value={draft.userMessage} onChange={(e) => setDraft({ ...draft, userMessage: e.target.value })} className="min-h-[60px]" />
                <Textarea placeholder="Expected response" value={draft.expectedResponse} onChange={(e) => setDraft({ ...draft, expectedResponse: e.target.value })} className="min-h-[60px]" />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={cancelEdit}><X className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" onClick={saveEdit}><Check className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">User</p>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(i)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => remove(i)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <p className="text-sm text-foreground bg-surface-2 rounded-md p-2.5">"{item.userMessage}"</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Expected Response</p>
                  <p className="text-sm text-foreground bg-surface-2 rounded-md p-2.5 italic">"{item.expectedResponse}"</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScenariosSection;
