/**
 * DocumentsPanel — Shared document management panel for projects.
 *
 * Supports upload (drag-drop + browse), delete, inline preview, and
 * integration with the analyze pipeline. Used by both SpecPage and
 * ProjectModePage.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CopilotButton } from './ui/CopilotButton';
import { AnalyzeProgress } from './AnalyzeProgress';
import { useAnalyzeJob } from '../hooks/useAnalyzeJob';
import {
  Sparkle20Regular,
  Delete20Regular,
  Document20Regular,
  DocumentPdf20Regular,
  Image20Regular,
  ArrowUpload20Regular,
  ArrowClockwise20Regular,
  Eye20Regular,
  Info16Regular,
} from '@fluentui/react-icons';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DocFile {
  filename: string;
  size: number;
  mtime: number;
  isNew: boolean;
  isModified: boolean;
  matchedAgents?: string[];
}

export interface DocStatus {
  hasManifest: boolean;
  lastResearchAt: string | null;
  newDocs: string[];
  changedDocs: string[];
  needsUpdate: boolean;
}

// ── File helpers ─────────────────────────────────────────────────────────────

const FILE_ICONS: Record<string, React.ReactNode> = {
  pdf: <DocumentPdf20Regular className="w-4 h-4 text-red-500" />,
  md: <Document20Regular className="w-4 h-4 text-blue-500" />,
  csv: <Document20Regular className="w-4 h-4 text-green-600" />,
  txt: <Document20Regular className="w-4 h-4 text-gray-500" />,
  json: <Document20Regular className="w-4 h-4 text-amber-600" />,
  docx: <Document20Regular className="w-4 h-4 text-blue-600" />,
  xlsx: <Document20Regular className="w-4 h-4 text-green-700" />,
  pptx: <Document20Regular className="w-4 h-4 text-orange-500" />,
  png: <Image20Regular className="w-4 h-4 text-purple-500" />,
  jpg: <Image20Regular className="w-4 h-4 text-purple-500" />,
  jpeg: <Image20Regular className="w-4 h-4 text-purple-500" />,
};

export function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || <Document20Regular className="w-4 h-4 text-gray-400" />;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function formatDate(mtime: number | string): string {
  const d = new Date(mtime);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Props ────────────────────────────────────────────────────────────────────

interface DocumentsPanelProps {
  projectId: string;
  /** Label for the analyze button. Defaults to "Analyze documents". */
  analyzeLabel?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export const DocumentsPanel: React.FC<DocumentsPanelProps> = ({ projectId, analyzeLabel = 'Analyze documents' }) => {
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [docStatus, setDocStatus] = useState<DocStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analyze = useAnalyzeJob();

  const fetchDocs = useCallback(async () => {
    try {
      const [projRes, statusRes] = await Promise.all([
        fetch(`/api/projects/${encodeURIComponent(projectId)}`),
        fetch(`/api/projects/${encodeURIComponent(projectId)}/doc-status`),
      ]);
      let fetchedDocs: DocFile[] = [];
      if (projRes.ok) {
        const proj = await projRes.json();
        fetchedDocs = proj.docs || [];
      }
      if (statusRes.ok) {
        setDocStatus(await statusRes.json());
      }

      // Auto-classify if docs exist but none have agent tags
      const hasAnyTags = fetchedDocs.some(d => d.matchedAgents && d.matchedAgents.length > 0);
      if (fetchedDocs.length > 0 && !hasAnyTags) {
        try {
          const classRes = await fetch(`/api/projects/${encodeURIComponent(projectId)}/classify-docs`, { method: 'POST' });
          if (classRes.ok) {
            const reFetch = await fetch(`/api/projects/${encodeURIComponent(projectId)}`);
            if (reFetch.ok) {
              const proj2 = await reFetch.json();
              fetchedDocs = proj2.docs || fetchedDocs;
            }
          }
        } catch {}
      }
      setDocs(fetchedDocs);
    } catch (err) {
      console.error('[DocumentsPanel] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleUpload = async (files: FileList | File[]) => {
    setUploading(true);
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append('file', file);
      try {
        await fetch(`/api/projects/${encodeURIComponent(projectId)}/upload`, { method: 'POST', body: form });
      } catch (err) {
        console.error('[DocumentsPanel] upload error:', err);
      }
    }
    setUploading(false);
    fetchDocs();
  };

  const handleDelete = async (filename: string) => {
    try {
      await fetch(`/api/projects/${encodeURIComponent(projectId)}/docs/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      setDocs(prev => prev.filter(d => d.filename !== filename));
      if (previewFile === filename) { setPreviewFile(null); setPreviewContent(''); }
    } catch (err) {
      console.error('[DocumentsPanel] delete error:', err);
    }
  };

  const handlePreview = async (filename: string) => {
    if (previewFile === filename) { setPreviewFile(null); return; }
    setPreviewFile(filename);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/docs/${encodeURIComponent(filename)}/content`);
      if (res.ok) {
        const data = await res.json();
        setPreviewContent(data.content || data.text || '(No content extracted)');
      } else {
        setPreviewContent('(Could not load preview)');
      }
    } catch {
      setPreviewContent('(Preview unavailable)');
    } finally {
      setPreviewLoading(false);
    }
  };

  const isNewDoc = (filename: string) => docStatus?.newDocs?.includes(filename) || false;
  const isChangedDoc = (filename: string) => docStatus?.changedDocs?.includes(filename) || false;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Re-research banner */}
      {docStatus?.needsUpdate && docs.length > 0 && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl border border-amber-200 bg-amber-50">
          <Info16Regular className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-amber-800">
              {docStatus.newDocs.length} new document{docStatus.newDocs.length !== 1 ? 's' : ''} since last research
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Re-analyze to update the agent spec with new information
            </p>
          </div>
          <CopilotButton
            variant="secondary"
            size="sm"
            icon={<ArrowClockwise20Regular />}
            onClick={() => analyze.start(projectId)}
            disabled={analyze.status === 'running'}
          >
            {analyze.status === 'running' ? 'Analyzing...' : 'Re-analyze'}
          </CopilotButton>
        </div>
      )}

      {/* Upload area */}
      <div
        className="flex items-center justify-between p-3 rounded-xl border border-dashed border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 transition-all cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex items-center gap-2 text-gray-400">
          <ArrowUpload20Regular className="w-4 h-4" />
          <span className="text-[13px]">{uploading ? 'Uploading...' : 'Drop files here or click to upload'}</span>
        </div>
        <CopilotButton variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
          Browse
        </CopilotButton>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.md,.xlsx,.xls,.csv,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.json"
          onChange={(e) => { if (e.target.files?.length) { handleUpload(e.target.files); e.target.value = ''; } }}
        />
      </div>

      {/* File list */}
      {docs.length === 0 ? (
        <div className="text-center py-8">
          <Document20Regular className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No documents yet</p>
          <p className="text-xs text-gray-300 mt-1">Upload SDR documents, transcripts, or other reference files</p>
        </div>
      ) : (
        <div className="space-y-1">
          {docs.map((doc) => (
            <div key={doc.filename}>
              <div className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                {/* File icon */}
                <div className="flex-shrink-0">{getFileIcon(doc.filename)}</div>

                {/* File name + meta */}
                <button
                  className="flex-1 min-w-0 text-left"
                  onClick={() => handlePreview(doc.filename)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-gray-900 truncate">{doc.filename}</span>
                    {(isNewDoc(doc.filename) || doc.isNew) && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">New</span>
                    )}
                    {isChangedDoc(doc.filename) && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">Changed</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[11px] text-gray-400">{formatFileSize(doc.size)}</span>
                    <span className="text-[11px] text-gray-300">&middot;</span>
                    <span className="text-[11px] text-gray-400">{formatDate(doc.mtime)}</span>
                    {doc.matchedAgents && doc.matchedAgents.length > 0 && (
                      <>
                        <span className="text-[11px] text-gray-300">&middot;</span>
                        {doc.matchedAgents.map((agentId, ai) => (
                          <span key={ai} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]">
                            {agentId.replace(/-/g, ' ')}
                          </span>
                        ))}
                      </>
                    )}
                  </div>
                </button>

                {/* Actions */}
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => handlePreview(doc.filename)}
                    className="p-1.5 rounded-md hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors"
                    title="Preview"
                  >
                    <Eye20Regular className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.filename)}
                    className="p-1.5 rounded-md hover:bg-gray-100 text-gray-300 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Delete20Regular className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Inline preview */}
              {previewFile === doc.filename && (
                <div className="mx-3 mb-2 p-3 rounded-lg bg-gray-50 border border-gray-100 max-h-[300px] overflow-y-auto">
                  {previewLoading ? (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                      Loading preview...
                    </div>
                  ) : (
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">{previewContent}</pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Analyze pipeline progress */}
      {analyze.status !== 'idle' && (
        <div className="p-3 rounded-xl border border-gray-100 bg-gray-50/50">
          <AnalyzeProgress
            steps={analyze.steps}
            status={analyze.status}
            summary={analyze.summary}
            errors={analyze.errors}
            onCancel={analyze.cancel}
          />
        </div>
      )}

      {/* Analyze button — primary action when docs exist but no analysis running */}
      {docs.length > 0 && analyze.status === 'idle' && !docStatus?.needsUpdate && (
        <CopilotButton
          variant="primary"
          size="sm"
          icon={<Sparkle20Regular />}
          onClick={() => analyze.start(projectId)}
          className="w-full"
        >
          {analyzeLabel}
        </CopilotButton>
      )}

      {/* Summary footer */}
      {docs.length > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-400">
          <span>{docs.length} document{docs.length !== 1 ? 's' : ''}</span>
          {docStatus?.lastResearchAt && (
            <span>Last researched {formatDate(docStatus.lastResearchAt)}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentsPanel;
