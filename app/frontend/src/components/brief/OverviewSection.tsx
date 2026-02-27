import { useState } from "react";
import { Plus, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props { data: any; onChange?: (data: any) => void; }

const OverviewSection = ({ data, onChange }: Props) => {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [editListItem, setEditListItem] = useState<{ key: string; idx: number; value: string } | null>(null);

  const update = (partial: any) => onChange?.({ ...data, ...partial });

  const startFieldEdit = (field: string, value: string) => { setEditingField(field); setDraft(value); };
  const saveField = () => { if (editingField) { update({ [editingField]: draft }); setEditingField(null); } };
  const cancelField = () => setEditingField(null);

  const startListEdit = (key: string, idx: number, value: string) => setEditListItem({ key, idx, value });
  const saveListItem = () => {
    if (!editListItem) return;
    const { key, idx, value } = editListItem;
    if (!value.trim()) { update({ [key]: data[key].filter((_: any, i: number) => i !== idx) }); }
    else { const items = [...data[key]]; items[idx] = value; update({ [key]: items }); }
    setEditListItem(null);
  };
  const addListItem = (key: string) => {
    const items = [...data[key], ""];
    update({ [key]: items });
    setEditListItem({ key, idx: items.length - 1, value: "" });
  };
  const removeListItem = (key: string, idx: number) => {
    update({ [key]: data[key].filter((_: any, i: number) => i !== idx) });
    if (editListItem?.key === key && editListItem.idx === idx) setEditListItem(null);
  };

  const renderEditable = (field: string, value: string, isTextarea = false) => {
    if (editingField === field) {
      const InputComp = isTextarea ? Textarea : Input;
      return (
        <div className="space-y-2">
          <InputComp value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus rows={isTextarea ? 3 : undefined} />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelField}><X className="h-3.5 w-3.5" /></Button>
            <Button size="icon" className="h-7 w-7" onClick={saveField}><Check className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderList = (key: string, label: string, dot: string) => (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</h3>
        <Button variant="ghost" size="sm" onClick={() => addListItem(key)} className="h-7 gap-1 text-xs">
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      <ul className="space-y-2">
        {data[key].map((item: string, i: number) => (
          <li key={i} className="flex items-center gap-2 text-sm text-foreground group">
            {editListItem?.key === key && editListItem.idx === i ? (
              <div className="flex-1 flex gap-2">
                <Input
                  value={editListItem.value}
                  onChange={(e) => setEditListItem({ ...editListItem, value: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && saveListItem()}
                  autoFocus
                  className="h-8 text-sm"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditListItem(null)}><X className="h-3.5 w-3.5" /></Button>
                <Button size="icon" className="h-8 w-8" onClick={saveListItem}><Check className="h-3.5 w-3.5" /></Button>
              </div>
            ) : (
              <>
                <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                <span
                  className="flex-1 cursor-pointer hover:text-primary transition-colors"
                  onClick={() => startListEdit(key, i, item)}
                >{item}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => removeListItem(key, i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Overview</h2>
        <p className="text-xs text-muted-foreground">Agent identity, problem statement, and target users</p>
      </div>

      {/* Name & Description */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Agent Name</h3>
          {editingField === "name" ? renderEditable("name", data.name) : (
            <p
              className="text-xl font-bold text-foreground cursor-pointer hover:text-primary transition-colors"
              onClick={() => startFieldEdit("name", data.name)}
            >{data.name}</p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</h3>
          {editingField === "description" ? renderEditable("description", data.description, true) : (
            <p
              className="text-sm text-foreground leading-relaxed cursor-pointer hover:text-primary transition-colors"
              onClick={() => startFieldEdit("description", data.description)}
            >{data.description}</p>
          )}
        </div>
      </div>

      {/* Problem Statement */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Problem Statement</h3>
        {editingField === "problemStatement" ? (
          <div className="space-y-2">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} autoFocus />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelField}><X className="h-3.5 w-3.5" /></Button>
              <Button size="icon" className="h-7 w-7" onClick={saveField}><Check className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ) : (
          <p
            className="text-sm leading-relaxed text-foreground cursor-pointer hover:text-primary transition-colors"
            onClick={() => startFieldEdit("problemStatement", data.problemStatement)}
          >{data.problemStatement}</p>
        )}
      </div>

      {/* Target Users */}
      {renderList("targetUsers", "Target Users", "bg-primary")}

      {/* Challenges & Benefits */}
      <div className="grid gap-4 md:grid-cols-2">
        {renderList("challenges", "Challenges", "bg-destructive")}
        {renderList("benefits", "Benefits", "bg-success")}
      </div>
    </div>
  );
};

export default OverviewSection;
