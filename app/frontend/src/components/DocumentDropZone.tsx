import { useState, useCallback, useRef } from "react";
import { Upload, PenLine, FileText, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DocChangeStatus } from "@/types";
import { useProjectStore } from "@/stores/projectStore";
import { cn } from "@/lib/utils";

interface DocumentDropZoneProps {
  projectId: string;
}

const STATUS_CONFIG: Record<DocChangeStatus, { label: string; className: string }> = {
  new: { label: "New", className: "bg-info/15 text-info border-info/40" },
  modified: { label: "Modified", className: "bg-warning/15 text-warning border-warning/40" },
  processed: { label: "Processed", className: "bg-success/15 text-success border-success/40" },
};

const ACCEPTED_EXTENSIONS = ".md,.csv,.txt,.json,.png,.jpg,.jpeg,.gif,.webp,.docx,.pdf,.pptx";

const DocumentDropZone = ({ projectId }: DocumentDropZoneProps) => {
  const { documents, uploadFile, pasteText, removeDocument } = useProjectStore();
  const [dragOver, setDragOver] = useState(false);
  const [showTextForm, setShowTextForm] = useState(false);
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        await uploadFile(file);
      } catch {
        // Could show toast here
      }
    }
    setUploading(false);
  }, [uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFiles(e.target.files);
      e.target.value = "";
    }
  };

  const addTextDoc = async () => {
    if (!textTitle.trim() || !textContent.trim()) return;
    setUploading(true);
    try {
      await pasteText(textTitle.trim(), textContent.trim());
      setTextTitle("");
      setTextContent("");
      setShowTextForm(false);
    } catch {
      // Could show toast here
    }
    setUploading(false);
  };

  const newAndModified = documents.filter((d) => d.changeStatus === "new" || d.changeStatus === "modified");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-foreground">Documents ({documents.length})</h2>
          {newAndModified.length > 0 && (
            <span className="text-[11px] text-info font-medium">
              {newAndModified.length} pending research
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => setShowTextForm(true)}>
            <PenLine className="h-3 w-3" /> Write
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={handleUploadClick}>
            <Upload className="h-3 w-3" /> Upload
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        multiple
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "mb-3 rounded-lg border-2 border-dashed p-6 text-center transition-all",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/30",
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
            <p className="text-xs text-muted-foreground">
              Drag & drop files here, or click to browse
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Supports md, csv, txt, json, images, docx, pdf, pptx
            </p>
          </>
        )}
      </div>

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

      {/* Document list */}
      <div className="space-y-2">
        {documents.map((doc) => {
          const statusCfg = STATUS_CONFIG[doc.changeStatus];
          return (
            <div key={doc.id} className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/30 hover:bg-surface-2">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {doc.name}
                    </p>
                    <span className={cn("shrink-0 rounded-full border px-1.5 py-0 text-[10px] font-medium leading-4", statusCfg.className)}>
                      {statusCfg.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {doc.size}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive shrink-0"
                onClick={() => removeDocument(doc.name)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DocumentDropZone;
