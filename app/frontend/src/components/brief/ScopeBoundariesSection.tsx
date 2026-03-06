import { useState } from "react";
import { Shield, AlertTriangle, XCircle, Plus, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SectionGuidelines from "./SectionGuidelines";

interface Props { data: any; onChange?: (data: any) => void; }

const ScopeBoundariesSection = ({ data, onChange }: Props) => {
  const [editHandle, setEditHandle] = useState<{ idx: number; value: string } | null>(null);
  const [editDecline, setEditDecline] = useState<{ idx: number; topic: string; redirect: string } | null>(null);
  const [editRefuse, setEditRefuse] = useState<{ idx: number; topic: string; reason: string } | null>(null);

  // Handles — flat strings
  const updateHandles = (items: string[]) => onChange?.({ ...data, handles: items });
  const addHandle = () => { updateHandles([...data.handles, ""]); setEditHandle({ idx: data.handles.length, value: "" }); };
  const saveHandle = () => {
    if (!editHandle) return;
    if (!editHandle.value.trim()) { updateHandles(data.handles.filter((_: any, i: number) => i !== editHandle.idx)); }
    else { const h = [...data.handles]; h[editHandle.idx] = editHandle.value; updateHandles(h); }
    setEditHandle(null);
  };

  // Declines — { topic, redirect }
  const updateDeclines = (items: any[]) => onChange?.({ ...data, politelyDeclines: items });
  const addDecline = () => { updateDeclines([...data.politelyDeclines, { topic: "", redirect: "" }]); setEditDecline({ idx: data.politelyDeclines.length, topic: "", redirect: "" }); };
  const saveDecline = () => {
    if (!editDecline) return;
    if (!editDecline.topic.trim()) { updateDeclines(data.politelyDeclines.filter((_: any, i: number) => i !== editDecline.idx)); }
    else { const d = [...data.politelyDeclines]; d[editDecline.idx] = { topic: editDecline.topic, redirect: editDecline.redirect }; updateDeclines(d); }
    setEditDecline(null);
  };

  // Refuses — { topic, reason }
  const updateRefuses = (items: any[]) => onChange?.({ ...data, hardRefuses: items });
  const addRefuse = () => { updateRefuses([...data.hardRefuses, { topic: "", reason: "" }]); setEditRefuse({ idx: data.hardRefuses.length, topic: "", reason: "" }); };
  const saveRefuse = () => {
    if (!editRefuse) return;
    if (!editRefuse.topic.trim()) { updateRefuses(data.hardRefuses.filter((_: any, i: number) => i !== editRefuse.idx)); }
    else { const r = [...data.hardRefuses]; r[editRefuse.idx] = { topic: editRefuse.topic, reason: editRefuse.reason }; updateRefuses(r); }
    setEditRefuse(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Scope & Boundaries</h2>
        <p className="text-xs text-muted-foreground">What the agent handles, declines, and refuses — feeds into instruction constraints and safety eval tests</p>
        <SectionGuidelines sectionId="scope-boundaries" />
      </div>

      {/* Handles — flat strings */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-success" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Handles</h3>
            <span className="text-[10px] text-muted-foreground">Topics the agent answers confidently</span>
          </div>
          <Button variant="ghost" size="sm" onClick={addHandle} className="h-7 gap-1 text-xs"><Plus className="h-3 w-3" /> Add</Button>
        </div>
        <ul className="space-y-1.5">
          {(data.handles as string[]).map((item: string, i: number) => (
            <li key={i} className="text-sm text-foreground flex items-center gap-2 group">
              {editHandle?.idx === i ? (
                <div className="flex-1 flex gap-2">
                  <Input value={editHandle.value} onChange={(e) => setEditHandle({ ...editHandle, value: e.target.value })} onKeyDown={(e) => e.key === "Enter" && saveHandle()} autoFocus className="h-8 text-sm" />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditHandle(null)}><X className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" className="h-8 w-8" onClick={saveHandle}><Check className="h-3.5 w-3.5" /></Button>
                </div>
              ) : (
                <>
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                  <span className="flex-1 cursor-pointer hover:text-primary transition-colors" onClick={() => setEditHandle({ idx: i, value: item })}>{item}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => updateHandles(data.handles.filter((_: any, j: number) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Politely Declines — { topic, redirect } */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Politely Declines</h3>
            <span className="text-[10px] text-muted-foreground">Redirects user elsewhere</span>
          </div>
          <Button variant="ghost" size="sm" onClick={addDecline} className="h-7 gap-1 text-xs"><Plus className="h-3 w-3" /> Add</Button>
        </div>
        <ul className="space-y-2">
          {(data.politelyDeclines as any[]).map((item: any, i: number) => (
            <li key={i} className="text-sm text-foreground group">
              {editDecline?.idx === i ? (
                <div className="space-y-2">
                  <Input placeholder="Topic to decline" value={editDecline.topic} onChange={(e) => setEditDecline({ ...editDecline, topic: e.target.value })} onKeyDown={(e) => e.key === "Enter" && saveDecline()} autoFocus className="h-8 text-sm" />
                  <Input placeholder="Redirect to (e.g., Transfer to billing team)" value={editDecline.redirect} onChange={(e) => setEditDecline({ ...editDecline, redirect: e.target.value })} className="h-8 text-sm" />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditDecline(null)}><X className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" className="h-7 w-7" onClick={saveDecline}><Check className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                  <div className="flex-1 cursor-pointer hover:text-primary transition-colors" onClick={() => setEditDecline({ idx: i, topic: item.topic, redirect: item.redirect })}>
                    <span>{item.topic}</span>
                    {item.redirect && <span className="text-xs text-muted-foreground ml-2">→ {item.redirect}</span>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => updateDeclines(data.politelyDeclines.filter((_: any, j: number) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Hard Refuses — { topic, reason } */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hard Refuses</h3>
            <span className="text-[10px] text-muted-foreground">Agent must never do this</span>
          </div>
          <Button variant="ghost" size="sm" onClick={addRefuse} className="h-7 gap-1 text-xs"><Plus className="h-3 w-3" /> Add</Button>
        </div>
        <ul className="space-y-2">
          {(data.hardRefuses as any[]).map((item: any, i: number) => (
            <li key={i} className="text-sm text-foreground group">
              {editRefuse?.idx === i ? (
                <div className="space-y-2">
                  <Input placeholder="Hard stop — agent must never do this" value={editRefuse.topic} onChange={(e) => setEditRefuse({ ...editRefuse, topic: e.target.value })} onKeyDown={(e) => e.key === "Enter" && saveRefuse()} autoFocus className="h-8 text-sm" />
                  <Input placeholder="Reason (e.g., GDPR compliance)" value={editRefuse.reason} onChange={(e) => setEditRefuse({ ...editRefuse, reason: e.target.value })} className="h-8 text-sm" />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditRefuse(null)}><X className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" className="h-7 w-7" onClick={saveRefuse}><Check className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                  <div className="flex-1 cursor-pointer hover:text-primary transition-colors" onClick={() => setEditRefuse({ idx: i, topic: item.topic, reason: item.reason })}>
                    <span>{item.topic}</span>
                    {item.reason && <span className="text-xs text-muted-foreground ml-2">({item.reason})</span>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => updateRefuses(data.hardRefuses.filter((_: any, j: number) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ScopeBoundariesSection;
