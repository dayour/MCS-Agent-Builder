/**
 * API client — fetch wrapper for all server.js endpoints.
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
import { consumeSSE } from "@/lib/sseStream";

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

// ─── Solutions / Templates ───────────────────────────────────────

export interface SolutionTemplate {
  id: string;
  name: string;
  files: number;
  agents: number;
  tags: Record<string, string>;
  hasPresentation: boolean;
  hasSolution: boolean;
}

export async function fetchSolutions(): Promise<SolutionTemplate[]> {
  const data = await request<{ solutions: SolutionTemplate[] }>("/solutions");
  return data.solutions;
}

// ─── Platform Agents ─────────────────────────────────────────────

export interface PlatformAgent {
  id: string;
  name: string;
  schemaName: string;
  status: string;
  description: string;
}

export async function fetchPlatformAgents(): Promise<{ agents: PlatformAgent[]; error?: string }> {
  return request<{ agents: PlatformAgent[]; error?: string }>("/platform/agents");
}

export async function importPlatformAgent(agentName: string, schemaName?: string): Promise<{ projectId: string; agentId: string; existed: boolean; message: string }> {
  return request("/platform/agents/import", {
    method: "POST",
    body: JSON.stringify({ agentName, schemaName }),
  });
}

export async function deploySolutionTemplate(solutionId: string, solutionName: string): Promise<{ projectId: string; agentId: string; existed: boolean; message: string }> {
  return request("/solutions/deploy", {
    method: "POST",
    body: JSON.stringify({ solutionId, solutionName }),
  });
}

// ─── Credential Readiness Check ──────────────────────────────────

export interface PacProfile {
  index: number;
  active: boolean;
  kind: string;
  name: string;
  user: string;
  cloud: string;
  type: string;
  environment: string;
  environmentUrl: string;
}

export interface PacEnvironment {
  active: boolean;
  name: string;
  id: string;
  url: string;
}

export interface CredentialCheck {
  claude: boolean;
  az: boolean;
  dataverse: boolean | null;
  ready: boolean;
  details: Record<string, string>;
  azAccount: { user: string; tenantId: string; tenantName: string | null; tenantDomain: string | null } | null;
  pacProfiles: PacProfile[];
  pacEnvironments: PacEnvironment[];
}

export async function checkCredentials(): Promise<CredentialCheck> {
  return request<CredentialCheck>("/readiness/credentials");
}

export async function switchPacProfile(profileIndex: number): Promise<{ switched: boolean; activeUser: string; message: string }> {
  return request("/auth/switch-profile", {
    method: "POST",
    body: JSON.stringify({ profileIndex }),
  });
}

export async function switchPacEnvironment(environmentId: string): Promise<{ switched: boolean; environmentId: string }> {
  return request("/auth/switch-environment", {
    method: "POST",
    body: JSON.stringify({ environmentId }),
  });
}

export async function deletePacProfile(profileIndex: number): Promise<{ deleted: boolean; index: number }> {
  return request(`/auth/profile/${profileIndex}`, { method: "DELETE" });
}

// ─── Wizard — Conversational Brief Builder ───────────────────────

export interface ComparisonDivergence {
  aspect: string;
  primaryPosition: string;
  secondaryPosition: string;
  severity: "info" | "warning" | "conflict";
}

export interface ComparisonResult {
  agreement: "agree" | "partial" | "diverge" | "conflict";
  similarityScore: number;
  divergences: ComparisonDivergence[];
  safety: {
    primaryRefused: boolean;
    secondaryRefused: boolean;
    saferResponse: "primary" | "secondary" | "neither";
  };
  meta: {
    primaryModel: string;
    secondaryModel: string;
    primaryLatencyMs: number | null;
    secondaryLatencyMs: number | null;
    comparisonMethod: string;
    comparisonLatencyMs: number;
    timestamp: string;
  };
}

export interface WizardChatEvent {
  type: "started" | "token" | "state" | "comparison" | "done" | "error";
  text?: string;
  wizardState?: Record<string, unknown>;
  data?: ComparisonResult;
  detail?: string;
}

export async function wizardChat(
  mode: "interview" | "fuzzy",
  messages: Array<{ role: string; content: string }>,
  currentState: Record<string, unknown>,
  onEvent: (event: WizardChatEvent) => void,
  projectId?: string | null,
  model?: string,
  dualModelEnabled?: boolean,
): Promise<void> {
  const res = await fetch(`${BASE}/wizard/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode, messages, currentState,
      projectId: projectId || undefined,
      model: model || undefined,
      dualModel: dualModelEnabled ?? false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let msg = text;
    try { const parsed = JSON.parse(text); if (parsed.detail) msg = parsed.detail; } catch {}
    throw new Error(msg);
  }

  await consumeSSE<WizardChatEvent>(res, onEvent);
}

export interface WizardPrefetchResult {
  text: string;
  state: Record<string, unknown> | null;
  prefetchKey: string;
}

export async function wizardPrefetch(
  mode: "interview" | "fuzzy",
  messages: Array<{ role: string; content: string }>,
  currentState: Record<string, unknown>,
  projectId?: string | null,
  model?: string,
): Promise<WizardPrefetchResult> {
  return request("/wizard/prefetch", {
    method: "POST",
    body: JSON.stringify({
      mode,
      messages,
      currentState,
      projectId: projectId || undefined,
      model: model || undefined,
    }),
  });
}

export async function wizardSave(
  projectName: string,
  agentName: string,
  draft: Record<string, unknown>,
): Promise<{ projectId: string; agentId: string }> {
  return request("/wizard/save", {
    method: "POST",
    body: JSON.stringify({ projectName, agentName, draft }),
  });
}

// ─── Enrichment — Background Brief Enrichment ────────────────────

export interface EnrichmentStepEvent {
  type: "state" | "step" | "done";
  step?: string;
  status?: string;
  detail?: string;
  steps?: Record<string, { status: string; label: string; detail?: string }>;
  errors?: string[];
}

export async function speculativeEnrichment(
  draft: Record<string, unknown>,
  agentName?: string,
): Promise<{ jobId: string; status: string }> {
  return request("/enrichment/speculative", {
    method: "POST",
    body: JSON.stringify({ draft, agentName }),
  });
}

export async function reconcileEnrichment(
  speculativeJobId: string,
  projectId: string,
  agentId: string,
): Promise<{ reconciled: boolean; enrichedFields: string[] }> {
  return request("/enrichment/reconcile", {
    method: "POST",
    body: JSON.stringify({ speculativeJobId, projectId, agentId }),
  });
}

export async function startEnrichment(
  projectId: string,
  agentId: string,
): Promise<{ jobId: string; status: string }> {
  return request("/enrichment/start", {
    method: "POST",
    body: JSON.stringify({ projectId, agentId }),
  });
}

export async function startDeltaEnrichment(
  projectId: string,
  agentId: string,
): Promise<{ jobId: string | null; status: string; deltaFiles?: string[]; message?: string }> {
  return request("/enrichment/delta", {
    method: "POST",
    body: JSON.stringify({ projectId, agentId }),
  });
}

export async function watchEnrichment(
  jobId: string,
  onEvent: (event: EnrichmentStepEvent) => void,
): Promise<void> {
  const res = await fetch(`${BASE}/enrichment/status/${jobId}`);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text);
  }

  await consumeSSE<EnrichmentStepEvent>(res, onEvent);
}

// ─── Pull from M365 (WorkIQ SSE) ────────────────────────────────

export interface PullM365Progress {
  type: "started" | "progress" | "done" | "error" | "merge-info"
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
  aliases: string,
  onProgress: (event: PullM365Progress) => void,
): Promise<void> {
  const res = await fetch(`${BASE}/projects/${projectId}/pull-m365`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customer, timeRange, aliases }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let msg = text;
    try { const parsed = JSON.parse(text); if (parsed.detail) msg = parsed.detail; } catch {}
    throw new Error(msg);
  }

  await consumeSSE<PullM365Progress>(res, onProgress);
}

// ─── Build Runner — Headless agent build ─────────────────────────

export interface BuildStep {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  detail: string | null;
}

export interface BuildStatusEvent {
  type: "state" | "step" | "output" | "command_sent" | "auth_required" | "auth_completed" | "done";
  steps?: BuildStep[];
  status?: string;
  step?: string;
  detail?: string | null;
  errors?: string[];
  summary?: string;
  data?: string;             // raw terminal output
  command?: string;
  system?: string;           // auth_required system name
  instructions?: string;     // auth_required instructions
  authPrompt?: { system: string; instructions: string } | null;
}

export async function startBuild(
  projectId: string,
  agentId: string,
): Promise<{ jobId: string; status: string }> {
  return request("/build/start", {
    method: "POST",
    body: JSON.stringify({ projectId, agentId }),
  });
}

export async function subscribeBuildStatus(
  jobId: string,
  onEvent: (event: BuildStatusEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE}/build/status/${jobId}`, { signal });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text);
  }

  await consumeSSE<BuildStatusEvent>(res, onEvent, signal);
}

export async function buildAuthComplete(
  jobId: string,
): Promise<{ resumed: boolean }> {
  return request(`/build/${jobId}/auth-complete`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchBuildLog(jobId: string): Promise<string> {
  const res = await fetch(`${BASE}/build/log/${jobId}`);
  if (!res.ok) throw new Error("Failed to fetch build log");
  return res.text();
}

// ─── Skill Runner — Generalized headless skill execution ─────────

export type SkillType = "research" | "eval" | "fix" | "build";

export interface SkillStep {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  detail: string | null;
}

export interface SkillStatusEvent {
  type: "state" | "step" | "output" | "command_sent" | "auth_required" | "auth_completed" | "done";
  skillType?: SkillType;
  steps?: SkillStep[];
  status?: string;
  step?: string;
  detail?: string | null;
  errors?: string[];
  summary?: string;
  data?: string;
  command?: string;
  system?: string;
  instructions?: string;
  authPrompt?: { system: string; instructions: string } | null;
}

export async function startSkill(
  skillType: SkillType,
  projectId: string,
  agentId?: string,
): Promise<{ jobId: string; status: string; skillType: SkillType }> {
  return request("/skill/start", {
    method: "POST",
    body: JSON.stringify({ skillType, projectId, agentId: agentId || undefined }),
  });
}

export async function subscribeSkillStatus(
  jobId: string,
  onEvent: (event: SkillStatusEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE}/skill/status/${jobId}`, { signal });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text);
  }

  await consumeSSE<SkillStatusEvent>(res, onEvent, signal);
}

export async function skillAuthComplete(
  jobId: string,
): Promise<{ resumed: boolean }> {
  return request(`/skill/${jobId}/auth-complete`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchSkillLog(jobId: string): Promise<string> {
  const res = await fetch(`${BASE}/skill/log/${jobId}`);
  if (!res.ok) throw new Error("Failed to fetch skill log");
  return res.text();
}

// ─── Meeting Co-Pilot ─────────────────────────────────────────────

export interface MeetingPrepareResult {
  sessionId: string;
  state: string;
  briefingTokens: number;
  message: string;
}

export interface MeetingTranscriptEntry {
  id?: string;
  speaker: "kim" | "customer";
  text: string;
  timestamp: number;
  duration: number;
  processingTime?: number;
}

export interface MeetingEvent {
  type: string;
  timestamp: number;
  [key: string]: unknown;
}

export interface MeetingStats {
  session: { id: string; state: string; durationMs: number };
  audio: { systemBytes: number; micBytes: number; framesReceived: number };
  transcription: { chunksProcessed: number; silenceSkipped: number; totalDurationMs: number };
  questions: { questions: number; requirements: number; skipped: number; llmCalls: number };
  answers: { answers: number; totalTokens: number; totalCost: number; avgResponseMs: number; avgTTFT: number };
}

export async function prepareMeeting(
  projectId: string,
  options?: { agentName?: string; answerModel?: string; transcriptionModel?: string }
): Promise<MeetingPrepareResult> {
  return request(`/meeting/prepare/${projectId}`, {
    method: "POST",
    body: JSON.stringify(options || {}),
  });
}

export async function startMeeting(sessionId: string): Promise<{ sessionId: string; state: string; startedAt: number }> {
  return request(`/meeting/${sessionId}/start`, { method: "POST" });
}

export async function stopMeeting(sessionId: string): Promise<unknown> {
  return request(`/meeting/${sessionId}/stop`, { method: "POST" });
}

export function subscribeMeetingStream(
  sessionId: string,
  onEvent: (event: MeetingEvent) => void,
  onError?: (err: Error) => void
): () => void {
  const es = new EventSource(`${BASE}/meeting/${sessionId}/stream`);
  es.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data) as MeetingEvent;
      onEvent(event);
    } catch { /* ignore parse errors */ }
  };
  let errored = false;
  es.onerror = () => {
    if (errored) return; // Prevent repeated callbacks from EventSource auto-reconnect
    errored = true;
    es.close();
    if (onError) onError(new Error("Meeting SSE connection lost"));
  };
  return () => es.close();
}


export async function setMeetingModel(
  sessionId: string,
  model: string
): Promise<{ model: string; message: string }> {
  return request(`/meeting/${sessionId}/model`, {
    method: "PATCH",
    body: JSON.stringify({ model }),
  });
}

export async function setMeetingMic(
  sessionId: string,
  disabled: boolean
): Promise<{ micDisabled: boolean }> {
  return request(`/meeting/${sessionId}/mic`, {
    method: "PATCH",
    body: JSON.stringify({ disabled }),
  });
}

