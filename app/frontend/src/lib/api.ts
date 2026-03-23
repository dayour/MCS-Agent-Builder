/**
 * API client — fetch wrapper for all server.py endpoints.
 *
 * In dev mode, Vite proxies /api → localhost:8000.
 * In production, same origin serves both API and static files.
 */
import type {
  ApiProject,
  ApiProjectDetail,
  ApiAgentDetail,
  ApiUploadResult,
  ApiPasteResult,
} from "@/types/api";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    // FastAPI returns {"detail": "..."} — extract the message
    let msg = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed.detail) msg = parsed.detail;
    } catch { /* use raw text */ }
    throw new Error(msg);
  }
  return res.json();
}

// ─── Config (runtime ports) ───────────────────────────────────────

let _terminalWsUrl: string | null = null;

export async function getTerminalWsUrl(): Promise<string> {
  if (_terminalWsUrl) return _terminalWsUrl;
  try {
    const res = await fetch("/api/config");
    if (res.ok) {
      const data = await res.json();
      _terminalWsUrl = data.terminalWsUrl;
      return _terminalWsUrl!;
    }
  } catch { /* fallback */ }
  // Derive from current page: same host + port, /ws path
  const port = window.location.port || "8000";
  _terminalWsUrl = `ws://localhost:${port}/ws`;
  return _terminalWsUrl;
}

// ─── Projects ─────────────────────────────────────────────────────

export async function fetchProjects(): Promise<ApiProject[]> {
  const data = await request<{ projects: ApiProject[] }>("/projects");
  return data.projects;
}

export async function fetchProject(id: string): Promise<ApiProjectDetail> {
  return request<ApiProjectDetail>(`/projects/${id}`);
}

export async function createProject(name: string): Promise<{ id: string; name: string }> {
  return request("/projects", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function deleteProject(
  projectId: string
): Promise<{ deleted: boolean }> {
  return request(`/projects/${projectId}`, {
    method: "DELETE",
  });
}

// ─── Agents ───────────────────────────────────────────────────────

export async function fetchAgent(projectId: string, agentId: string): Promise<ApiAgentDetail> {
  return request<ApiAgentDetail>(`/projects/${projectId}/agents/${agentId}`);
}

export async function saveAgentBrief(
  projectId: string,
  agentId: string,
  brief: Record<string, unknown>
): Promise<{ saved: boolean }> {
  return request(`/projects/${projectId}/agents/${agentId}/state`, {
    method: "PUT",
    body: JSON.stringify(brief),
  });
}

export async function deleteAgent(
  projectId: string,
  agentId: string
): Promise<{ deleted: boolean }> {
  return request(`/projects/${projectId}/agents/${agentId}`, {
    method: "DELETE",
  });
}

export async function scaffoldChildren(
  projectId: string,
  agentId: string
): Promise<{ created: string[]; message: string }> {
  return request(`/projects/${projectId}/agents/${agentId}/scaffold-children`, {
    method: "POST",
  });
}

// ─── Documents ────────────────────────────────────────────────────

export async function uploadDocument(
  projectId: string,
  file: File
): Promise<ApiUploadResult> {
  const form = new FormData();
  form.append("file", file);
  return request(`/projects/${projectId}/upload`, {
    method: "POST",
    body: form,
  });
}

export async function pasteDocument(
  projectId: string,
  title: string,
  text: string
): Promise<ApiPasteResult> {
  return request(`/projects/${projectId}/paste`, {
    method: "POST",
    body: JSON.stringify({ title, text }),
  });
}

export async function deleteDocument(
  projectId: string,
  filename: string
): Promise<{ deleted: boolean }> {
  return request(`/projects/${projectId}/docs/${encodeURIComponent(filename)}`, {
    method: "DELETE",
  });
}

export async function fetchDocContent(
  projectId: string,
  filename: string
): Promise<{ filename: string; content: string }> {
  return request(`/projects/${projectId}/docs/${encodeURIComponent(filename)}/content`);
}

// ─── Pull from M365 (WorkIQ SSE) ────────────────────────────────

export interface PullM365Progress {
  type: "started" | "progress" | "done" | "error"
    | "download-started" | "download-progress" | "download-done" | "download-skipped";
  queryId?: number;
  label?: string;
  status?: "running" | "done" | "error" | "resolving" | "downloading" | "skipped";
  completed?: number;
  total?: number;
  customer?: string;
  filename?: string;
  size?: number;
  successCount?: number;
  totalQueries?: number;
  detail?: string;
  // Download phase fields
  index?: number;
  url?: string;
  name?: string;
  converted?: string | null;
  downloaded?: number;
  errors?: number;
  reason?: string;
}

export async function pullFromM365(
  projectId: string,
  customer: string,
  timeRange: string,
  onProgress: (event: PullM365Progress) => void,
): Promise<void> {
  const res = await fetch(`${BASE}/projects/${projectId}/pull-m365`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer, timeRange }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let msg = text;
    try { const parsed = JSON.parse(text); if (parsed.detail) msg = parsed.detail; } catch {}
    throw new Error(msg);
  }

  // Parse SSE stream
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          onProgress(JSON.parse(line.slice(6)));
        } catch { /* ignore malformed SSE */ }
      }
    }
  }
}
