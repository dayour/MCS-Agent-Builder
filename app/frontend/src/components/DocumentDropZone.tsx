import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, PenLine, FileText, Trash2, Loader2, Image, File as FileIcon, FileSpreadsheet, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DocChangeStatus, Document } from "@/types";
import type { PullM365Progress } from "@/lib/api";
import { useProjectStore } from "@/stores/projectStore";
import { fetchDocContent } from "@/lib/api";
import { cn } from "@/lib/utils";
import { marked } from "marked";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface DocumentDropZoneProps {
  projectId: string;
}

const STATUS_CONFIG: Record<DocChangeStatus, { label: string; className: string }> = {
  new: { label: "New", className: "bg-info/15 text-info border-info/40" },
  modified: { label: "Modified", className: "bg-warning/15 text-warning border-warning/40" },
  processed: { label: "Processed", className: "bg-success/15 text-success border-success/40" },
};

const ACCEPTED_EXTENSIONS = ".md,.csv,.txt,.json,.png,.jpg,.jpeg,.gif,.webp,.docx,.pdf,.pptx,.xlsx,.xls";

marked.setOptions({ breaks: true, gfm: true });

function iconForType(type: Document["type"]) {
  if (type === "image") return Image;
  if (type === "csv") return FileSpreadsheet;
  if (type === "document") return FileIcon;
  return FileText;
}

// ---------------------------------------------------------------------------
// Preview component — renders per file type
// ---------------------------------------------------------------------------

function DocumentPreview({ doc, projectId, content }: { doc: Document; projectId: string; content: string }) {
  const rawUrl = `/api/projects/${projectId}/docs/${encodeURIComponent(doc.name)}/raw`;

  // Lazy-load content for binary docs via /content endpoint
  const [lazyContent, setLazyContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (doc.type !== "document" || content) return;
    let cancelled = false;
    setLoading(true);
    fetchDocContent(projectId, doc.name)
      .then((res) => { if (!cancelled) setLazyContent(res.content); })
      .catch(() => { if (!cancelled) setLazyContent(""); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [doc.name, doc.type, projectId, content]);

  // Images
  if (doc.type === "image") {
    return (
      <div className="flex justify-center">
        <img src={rawUrl} alt={doc.name} className="max-w-full max-h-[70vh] rounded object-contain" />
      </div>
    );
  }

  // PDF — native browser viewer
  if (doc.type === "pdf") {
    return <iframe src={rawUrl} title={doc.name} className="w-full h-[70vh] rounded border border-border" />;
  }

  // CSV — table
  if (doc.type === "csv" && content) {
    const lines = content.trim().split("\n");
    const headers = lines[0]?.split(",") ?? [];
    const rows = lines.slice(1).map((l) => l.split(","));
    return (
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface-3">
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left font-semibold text-foreground border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={cn("border-b border-border/50", i % 2 === 1 && "bg-surface-2/50")}>
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-1.5 text-foreground">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // JSON — formatted
  if (doc.type === "json" && content) {
    let formatted = content;
    try { formatted = JSON.stringify(JSON.parse(content), null, 2); } catch { /* as-is */ }
    return (
      <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono rounded border border-border bg-surface-3 p-4 overflow-x-auto">
        <code className="text-foreground">{formatted}</code>
      </pre>
    );
  }

  // Markdown — rendered
  if (doc.type === "markdown" && content) {
    const html = marked.parse(content);
    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-code:text-primary prose-code:bg-surface-3 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-surface-3 prose-pre:border prose-pre:border-border prose-a:text-primary prose-table:text-xs"
        dangerouslySetInnerHTML={{ __html: typeof html === "string" ? html : "" }}
      />
    );
  }

  // Binary docs (docx/pptx/xlsx) — lazy-loaded extracted content
  if (doc.type === "document") {
    const text = content || lazyContent;
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Extracting text preview...</span>
        </div>
      );
    }
    if (text) {
      const html = marked.parse(text);
      return (
        <div
          className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground"
          dangerouslySetInnerHTML={{ __html: typeof html === "string" ? html : "" }}
        />
      );
    }
    const ext = doc.name.split(".").pop()?.toUpperCase() ?? "FILE";
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
        <FileIcon className="h-10 w-10" />
        <p className="text-sm font-medium">{ext} Document</p>
        <p className="text-xs text-center max-w-md">
          Preview not available. This file is readable by Claude Code during research.
        </p>
      </div>
    );
  }

  // Plain text fallback
  if (content) {
    return (
      <pre className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap font-mono rounded border border-border bg-surface-3 p-4">
        {content}
      </pre>
    );
  }

  return <p className="text-xs text-muted-foreground italic py-8 text-center">No preview available.</p>;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const DocumentDropZone = ({ projectId }: DocumentDropZoneProps) => {
  const { documents, docContent, loadDocContent, uploadFile, pasteText, removeDocument, pullFromM365 } = useProjectStore();
  const [dragOver, setDragOver] = useState(false);
  const [showTextForm, setShowTextForm] = useState(false);
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedDocName, setSelectedDocName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pull from M365 state
  const [showPullForm, setShowPullForm] = useState(false);
  const [pullCustomer, setPullCustomer] = useState("");
  const [pullTimeRange, setPullTimeRange] = useState("90d");
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<{
    completed: number;
    total: number;
    currentLabel: string;
    errors: string[];
    phase: "queries" | "downloads";
    downloadIndex?: number;
    downloadTotal?: number;
  } | null>(null);

  // Derive selectedDoc from documents list by name — always fresh after state changes
  const selectedDoc = selectedDocName ? documents.find((d) => d.name === selectedDocName) ?? null : null;

  // Lazy-load doc content when a doc is selected for preview
  useEffect(() => {
    if (selectedDocName && !docContent[selectedDocName]) {
      loadDocContent(selectedDocName);
    }
  }, [selectedDocName, docContent, loadDocContent]);

  // --- Upload ---
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const result = await uploadFile(file);
        if (result?.conversionError) {
          toast.warning(`${file.name}: ${result.conversionError}`, { duration: 8000 });
        }
      } catch (e: any) {
        const msg = e?.message || "";
        if (msg.includes("encrypted") || msg.includes("protected")) {
          toast.error(msg, { duration: 10000 });
        } else {
          toast.error(`Failed to upload ${file.name}`);
        }
      }
    }
    setUploading(false);
  }, [uploadFile]);

  // --- Clipboard paste ---
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const files: File[] = [];
      if (e.clipboardData?.items) {
        for (const item of Array.from(e.clipboardData.items)) {
          if (item.kind === "file") {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        handleFiles(files);
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handleFiles]);

  // --- Drag & drop ---
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); }, []);

  // --- File input ---
  const handleUploadClick = () => fileInputRef.current?.click();
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) { handleFiles(e.target.files); e.target.value = ""; }
  };

  // --- Paste text ---
  const addTextDoc = async () => {
    if (!textTitle.trim() || !textContent.trim()) return;
    setUploading(true);
    try {
      await pasteText(textTitle.trim(), textContent.trim());
      setTextTitle("");
      setTextContent("");
      setShowTextForm(false);
    } catch {
      toast.error("Failed to save text document");
    }
    setUploading(false);
  };

  // --- Delete ---
  const handleDelete = async (filename: string) => {
    if (selectedDocName === filename) setSelectedDocName(null);
    try {
      await removeDocument(filename);
    } catch {
      toast.error(`Failed to delete ${filename}`);
    }
  };

  // --- Pull from M365 ---
  const handlePullFromM365 = async () => {
    if (!pullCustomer.trim()) return;
    setPulling(true);
    setPullProgress({ completed: 0, total: 9, currentLabel: "Starting...", errors: [], phase: "queries" });

    try {
      await pullFromM365(pullCustomer.trim(), pullTimeRange, (event: PullM365Progress) => {
        if (event.type === "started") {
          setPullProgress((p) => p ? { ...p, total: event.total ?? 9 } : p);
        } else if (event.type === "progress") {
          setPullProgress((p) => {
            if (!p) return p;
            const errors = event.status === "error"
              ? [...p.errors, `${event.label}: failed`]
              : p.errors;
            return {
              ...p,
              completed: event.completed ?? p.completed,
              currentLabel: event.status === "running"
                ? `Querying ${event.label}...`
                : `${event.label} ${event.status}`,
              errors,
            };
          });
        } else if (event.type === "done") {
          toast.success(
            `Pulled M365 context: ${event.successCount}/${event.totalQueries} sources`,
            { duration: 5000 },
          );
        } else if (event.type === "error") {
          toast.error(event.detail || "Failed to save context file", { duration: 8000 });
        } else if (event.type === "download-started") {
          setPullProgress((p) => p ? {
            ...p,
            phase: "downloads",
            completed: 0,
            total: event.total ?? 0,
            downloadTotal: event.total ?? 0,
            currentLabel: `Downloading ${event.total} file(s)...`,
          } : p);
        } else if (event.type === "download-progress") {
          setPullProgress((p) => {
            if (!p) return p;
            const label = event.status === "resolving" ? `Resolving ${event.name || "file"}...`
              : event.status === "downloading" ? `Downloading ${event.name || "file"}...`
              : event.status === "done" ? `${event.name}${event.converted ? ` → ${event.converted}` : ""}`
              : event.status === "skipped" ? `Skipped: ${event.name}`
              : event.status === "error" ? `Failed: ${event.name}`
              : p.currentLabel;
            const errors = event.status === "error"
              ? [...p.errors, `${event.name}: ${event.detail || "download failed"}`]
              : p.errors;
            return {
              ...p,
              completed: event.index ?? p.completed,
              downloadIndex: event.index,
              currentLabel: label,
              errors,
            };
          });
        } else if (event.type === "download-done") {
          toast.success(
            `Downloaded ${event.downloaded}/${event.total} files`,
            { duration: 5000 },
          );
        } else if (event.type === "download-skipped") {
          toast.info(event.reason || "File downloads skipped", { duration: 5000 });
        }
      });
      setShowPullForm(false);
      setPullCustomer("");
    } catch (e: any) {
      toast.error(e.message || "Failed to pull M365 context", { duration: 8000 });
    } finally {
      setPulling(false);
      setPullProgress(null);
    }
  };

  const newAndModified = documents.filter((d) => d.changeStatus === "new" || d.changeStatus === "modified");

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-foreground">Documents ({documents.length})</h2>
          {newAndModified.length > 0 && (
            <span className="text-[11px] text-info font-medium">{newAndModified.length} pending research</span>
          )}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => setShowTextForm(true)}>
            <PenLine className="h-3 w-3" /> Write
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={handleUploadClick}>
            <Upload className="h-3 w-3" /> Upload
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => setShowPullForm(true)}>
            <Cloud className="h-3 w-3" /> Pull from M365
          </Button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept={ACCEPTED_EXTENSIONS} multiple className="hidden" onChange={handleFileInput} />

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "mb-3 rounded-lg border-2 border-dashed p-6 text-center transition-all cursor-pointer",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30",
          uploading && "opacity-60 pointer-events-none"
        )}
        onClick={handleUploadClick}
        role="button"
        tabIndex={0}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Uploading...</span>
          </div>
        ) : (
          <>
            <Upload className="mx-auto h-5 w-5 text-muted-foreground mb-1.5" />
            <p className="text-xs text-muted-foreground">Drag & drop files here, or click to browse</p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">Supports md, csv, txt, json, images, docx, pdf, pptx, xlsx</p>
          </>
        )}
      </div>

      {/* Paste text form */}
      {showTextForm && (
        <div className="mb-3 rounded-lg border border-border bg-card p-4 space-y-3">
          <Input placeholder="Title" value={textTitle} onChange={(e) => setTextTitle(e.target.value)} />
          <Textarea placeholder="Paste or type content..." value={textContent} onChange={(e) => setTextContent(e.target.value)} rows={5} />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setShowTextForm(false); setTextTitle(""); setTextContent(""); }}>Cancel</Button>
            <Button size="sm" onClick={addTextDoc} disabled={uploading}>Save</Button>
          </div>
        </div>
      )}

      {/* Pull from M365 form */}
      {showPullForm && (
        <div className="mb-3 rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Pull from M365</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Search emails, meetings, Teams, SharePoint, and people via WorkIQ. Documents found in SharePoint are automatically downloaded and converted.
          </p>
          <Input
            placeholder="Customer or company name"
            value={pullCustomer}
            onChange={(e) => setPullCustomer(e.target.value)}
            disabled={pulling}
            onKeyDown={(e) => { if (e.key === "Enter" && pullCustomer.trim()) handlePullFromM365(); }}
          />
          <Select value={pullTimeRange} onValueChange={setPullTimeRange} disabled={pulling}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="180d">Last 6 months</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>

          {pullProgress && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Progress value={pullProgress.total > 0 ? (pullProgress.completed / pullProgress.total) * 100 : 0} className="h-2 flex-1" />
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {pullProgress.phase === "downloads" ? "Files" : "Queries"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {pullProgress.currentLabel} ({pullProgress.completed}/{pullProgress.total})
              </p>
              {pullProgress.errors.length > 0 && (
                <div className="text-[11px] text-destructive space-y-0.5">
                  {pullProgress.errors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowPullForm(false); setPullCustomer(""); setPullProgress(null); }}
              disabled={pulling}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handlePullFromM365}
              disabled={pulling || !pullCustomer.trim()}
              className="gap-1"
            >
              {pulling ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Pulling...</>
              ) : (
                <><Cloud className="h-3 w-3" /> Pull</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Document list */}
      <div className="space-y-2">
        {documents.map((doc) => {
          const statusCfg = STATUS_CONFIG[doc.changeStatus];
          const DocIcon = iconForType(doc.type);
          return (
            <div
              key={doc.id}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all cursor-pointer hover:border-primary/30 hover:bg-surface-2"
              onClick={() => setSelectedDocName(doc.name)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-3">
                  <DocIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{doc.name}</p>
                    <span className={cn("shrink-0 rounded-full border px-1.5 py-0 text-[10px] font-medium leading-4", statusCfg.className)}>
                      {statusCfg.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{doc.size}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive shrink-0"
                onClick={(e) => { e.stopPropagation(); handleDelete(doc.name); }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Preview dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={(open) => { if (!open) setSelectedDocName(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium truncate pr-8">{selectedDoc?.name}</DialogTitle>
            {selectedDoc && <p className="text-xs text-muted-foreground">{selectedDoc.size}</p>}
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-0">
            {selectedDoc && (
              <DocumentPreview doc={selectedDoc} projectId={projectId} content={docContent[selectedDoc.name] ?? ""} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentDropZone;
