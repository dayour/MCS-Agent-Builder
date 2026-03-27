/**
 * DocumentBar — File panel for the wizard left sidebar.
 *
 * Full-featured document management: drag-and-drop upload, file list with
 * type icons, delete, and preview dialog. Reuses the same upload/delete
 * API as DocumentDropZone but in a compact sidebar layout.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import {
  FileText,
  Loader2,
  Paperclip,
  Trash2,
  Image,
  File as FileIcon,
  FileSpreadsheet,
  Eye,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fetchDocContent } from "@/lib/api";
import { marked } from "marked";
import DOMPurify from "dompurify";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadedDoc {
  name: string;
  size: string;
  type: string;
  uploadedAt?: string;
}

interface DocumentBarProps {
  documents: UploadedDoc[];
  projectId: string | null;
  onUpload: (file: File) => Promise<void>;
  onRemove: (filename: string) => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCEPTED_EXTENSIONS =
  ".md,.csv,.txt,.json,.png,.jpg,.jpeg,.gif,.webp,.docx,.pdf,.pptx,.xlsx,.xls";

marked.setOptions({ breaks: true, gfm: true });

function iconForType(type: string) {
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff"].includes(type)) return Image;
  if (["csv", "xlsx", "xls"].includes(type)) return FileSpreadsheet;
  if (["docx", "pptx", "pdf"].includes(type)) return FileIcon;
  return FileText;
}

// ---------------------------------------------------------------------------
// Preview component — renders file content by type
// ---------------------------------------------------------------------------

function DocPreview({
  doc,
  projectId,
}: {
  doc: UploadedDoc;
  projectId: string;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const rawUrl = `/api/projects/${projectId}/docs/${encodeURIComponent(doc.name)}/raw`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDocContent(projectId, doc.name)
      .then((res) => { if (!cancelled) setContent(res.content); })
      .catch(() => { if (!cancelled) setContent(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, doc.name]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading preview...</span>
      </div>
    );
  }

  // Images
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff"].includes(doc.type)) {
    return (
      <div className="flex justify-center">
        <img src={rawUrl} alt={doc.name} className="max-w-full max-h-[70vh] rounded object-contain" />
      </div>
    );
  }

  // PDF
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

  // Markdown / text with markdown rendering
  if (content) {
    if (doc.type === "md" || doc.type === "markdown" || doc.type === "docx" || doc.type === "pptx") {
      const rawHtml = marked.parse(content);
      const safeHtml = DOMPurify.sanitize(typeof rawHtml === "string" ? rawHtml : "");
      return (
        <div
          className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      );
    }
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

export default function DocumentBar({
  documents,
  projectId,
  onUpload,
  onRemove,
  disabled = false,
}: DocumentBarProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<UploadedDoc | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          try {
            await onUpload(file);
          } catch (e: any) {
            toast.error(`Failed to upload ${file.name}`);
          }
        }
      } finally {
        setUploading(false);
      }
    },
    [onUpload],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFiles(e.target.files);
      e.target.value = "";
    }
  };

  return (
    <>
      <div className={cn("mt-1", disabled && "opacity-50 pointer-events-none")}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">
            Files {documents.length > 0 && `(${documents.length})`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Paperclip className="h-3 w-3" />
            )}
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          className="hidden"
          onChange={handleFileInput}
        />

        {/* Drop zone (shown when no files, or always as target) */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "mx-3 rounded-md border border-dashed transition-all cursor-pointer",
            documents.length === 0 ? "p-3 mb-2" : "p-1.5 mb-1",
            dragOver ? "border-primary bg-primary/5" : "border-border/60 hover:border-muted-foreground/30",
            uploading && "opacity-60 pointer-events-none"
          )}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-[10px]">Uploading...</span>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center">
              <Upload className="mx-auto h-4 w-4 text-muted-foreground/60 mb-1" />
              <p className="text-[10px] text-muted-foreground/60">
                Drop files here
              </p>
              <p className="text-[9px] text-muted-foreground/40 mt-0.5">
                docs, PDFs, images, spreadsheets
              </p>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground/50 text-center">
              + Drop more files
            </p>
          )}
        </div>

        {/* File list */}
        {documents.length > 0 && (
          <div className="px-2 pb-2 space-y-0.5 max-h-[200px] overflow-y-auto">
            {documents.map((doc) => {
              const DocIcon = iconForType(doc.type);
              return (
                <div
                  key={doc.name}
                  className="group flex items-center gap-2 px-2 py-1 rounded-md text-xs hover:bg-surface-2 transition-colors"
                >
                  <DocIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="block truncate text-foreground/80">{doc.name}</span>
                    {doc.uploadedAt && (
                      <span className="block text-[9px] text-muted-foreground/60">
                        {new Date(doc.uploadedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    )}
                  </div>

                  {/* Preview button */}
                  {projectId && (
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all"
                      title="Preview"
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={() => onRemove(doc.name)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                    title="Remove"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview dialog */}
      {projectId && (
        <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) setPreviewDoc(null); }}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-sm font-medium truncate pr-8">{previewDoc?.name}</DialogTitle>
              {previewDoc && (
                <p className="text-xs text-muted-foreground">
                  {previewDoc.size}
                  {previewDoc.uploadedAt && (
                    <span className="ml-2">
                      {new Date(previewDoc.uploadedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </p>
              )}
            </DialogHeader>
            <div className="flex-1 overflow-auto min-h-0">
              {previewDoc && (
                <DocPreview doc={previewDoc} projectId={projectId} />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
