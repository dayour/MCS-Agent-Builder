/**
 * Store for the currently-viewed project's agents and documents.
 *
 * Documents use filename as the unique ID. Mutations are optimistic —
 * the UI updates immediately, then syncs with the server in the background.
 */
import { create } from "zustand";
import type { Agent, Document } from "@/types";
import type { ApiProjectDetail, ApiAgentSummary, ApiDoc } from "@/types/api";
import {
  fetchProject,
  uploadDocument as apiUpload,
  pasteDocument as apiPaste,
  deleteDocument as apiDeleteDoc,
  deleteAgent as apiDeleteAgent,
} from "@/lib/api";

interface ProjectStore {
  projectId: string | null;
  projectName: string;
  agents: Agent[];
  documents: Document[];
  docContent: Record<string, string>;
  loading: boolean;
  error: string | null;
  loadProject: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  pasteText: (title: string, text: string) => Promise<void>;
  removeDocument: (filename: string) => Promise<void>;
  removeAgent: (agentId: string) => Promise<void>;
}

function apiAgentToAgent(a: ApiAgentSummary): Agent {
  let status: Agent["status"] = "draft";
  if (a.has_build_report) status = "built";
  else if (a.build_ready) status = "ready";
  else if (a.has_instructions) status = "researched";

  return {
    id: a.id,
    name: a.name,
    description: a.description,
    status,
    readiness: a.readiness,
    sectionCompletion: {},
    evalPassRate: a.eval_pass_rate ?? null,
    architectureType: a.architecture_type || undefined,
    childAgentIds: a.architecture_children?.length ? a.architecture_children : undefined,
  };
}

function docTypeFromExt(ext: string): Document["type"] {
  if (ext === "csv") return "csv";
  if (ext === "json") return "json";
  if (ext === "txt") return "text";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff"].includes(ext)) return "image";
  if (["docx", "pptx", "xlsx", "xls"].includes(ext)) return "document";
  return "markdown";
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function apiDocToDocument(d: ApiDoc): Document {
  const ext = d.filename.split(".").pop()?.toLowerCase() ?? "";
  return {
    id: d.filename,
    name: d.filename,
    type: docTypeFromExt(ext),
    size: formatSize(d.size),
    uploadedAt: "",
    content: "",
    contentHash: "",
    changeStatus: d.isModified ? "modified" : d.isNew ? "new" : "processed",
  };
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projectId: null,
  projectName: "",
  agents: [],
  documents: [],
  docContent: {},
  loading: false,
  error: null,

  loadProject: async (id: string) => {
    set({ loading: true, error: null, projectId: id });
    try {
      const data: ApiProjectDetail = await fetchProject(id);
      set({
        projectId: data.id,
        projectName: data.name,
        agents: data.agents.map(apiAgentToAgent),
        documents: data.docs.map(apiDocToDocument),
        docContent: data.doc_content,
        loading: false,
      });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  refresh: async () => {
    const id = get().projectId;
    if (!id) return;
    try {
      const data = await fetchProject(id);
      set({
        agents: data.agents.map(apiAgentToAgent),
        documents: data.docs.map(apiDocToDocument),
        docContent: data.doc_content,
      });
    } catch {
      // Silent — don't break UI on background refresh failure
    }
  },

  uploadFile: async (file: File) => {
    const id = get().projectId;
    if (!id) return;
    const result = await apiUpload(id, file);
    // Fetch fresh doc list from server (gets real sanitized filename + conversion result)
    await get().refresh();
    return result;
  },

  pasteText: async (title: string, text: string) => {
    const id = get().projectId;
    if (!id) return;
    await apiPaste(id, title, text);
    await get().refresh();
  },

  removeDocument: async (filename: string) => {
    const id = get().projectId;
    if (!id) return;
    // Delete on server first, then update local state (no race with refresh)
    await apiDeleteDoc(id, filename);
    set((s) => ({
      documents: s.documents.filter((d) => d.name !== filename),
      docContent: Object.fromEntries(
        Object.entries(s.docContent).filter(([k]) => k !== filename)
      ),
    }));
  },

  removeAgent: async (agentId: string) => {
    const id = get().projectId;
    if (!id) return;
    await apiDeleteAgent(id, agentId);
    set((s) => ({ agents: s.agents.filter((a) => a.id !== agentId) }));
  },
}));
