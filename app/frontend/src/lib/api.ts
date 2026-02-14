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
  ApiDocStatus,
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
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
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

export async function fetchDocStatus(projectId: string): Promise<ApiDocStatus> {
  return request<ApiDocStatus>(`/projects/${projectId}/doc-status`);
}
