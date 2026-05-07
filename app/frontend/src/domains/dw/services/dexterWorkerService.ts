import { getDexterUrl, DEXTER_CONFIG } from '../../../config/dexterConfig';

/** Fetch function type (plain fetch or auth-wrapped fetch) */
export type AuthFetchFn = (url: string, options?: RequestInit) => Promise<Response>;

const POLL_INTERVAL_MS = 30000;

// Track active polling intervals by worker ID.
// NOTE: This module-level Map survives HMR in development — reloading the module
// creates a new Map and orphans old intervals. Not a production issue.
const pollingIntervals = new Map<string, ReturnType<typeof setInterval>>();

export interface DexterWorkerPayload {
  name: string;
  description: string;
  instructions: string;
  email?: string;
  model?: string;
  provider?: string;
  skills?: DexterWorkspaceSkill[];
  knowledge?: DexterKnowledgeItem[];
}

export interface DexterWorkerResult {
  id: string;
  lifecycleStatus: 'provisioning' | 'ready' | 'failed' | null;
  lifecycleError: string | null;
}

/** Shape of a worker returned by GET /workers (list endpoint). */
export interface DexterWorker {
  id: string;
  name: string;
  status: string | null;
  lifecycleStatus: string | null;
  model: string | null;
  createdAt: string | null;
}

/** Tool configuration within a skill. */
export interface DexterToolConfig {
  type: string;       // 'http' (MCP server), 'stdio' (local package), or 'connector'
  url?: string;       // MCP server URL (type=http)
  packageName?: string;
  connectorName?: string;
}

/** Knowledge source attached to a worker or skill. */
export interface DexterKnowledgeItem {
  type: string;  // 'file', 'uri', or 'database'
  value: string;
  name?: string;
}

/** Workspace skill on a worker. */
export interface DexterWorkspaceSkill {
  name: string;
  description: string;
  instructions: string;
  tools: DexterToolConfig[];
  knowledge: DexterKnowledgeItem[];
  model?: string | null;
  enabled: boolean;
}

/** Full worker detail returned by GET /workers/{id}. */
export interface DexterWorkerDetail {
  id: string;
  name: string;
  description: string | null;
  email: string | null;
  instructions: string | null;
  status: string | null;
  lifecycleStatus: string | null;
  lifecycleError: string | null;
  model: string | null;
  provider: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  // Agent identity (Entra)
  tenantId: string | null;
  agenticAppId: string | null;
  agenticUserId: string | null;
  // Skills & knowledge
  skills: DexterWorkspaceSkill[];
  knowledge: DexterKnowledgeItem[];
  // Metrics
  skillsCount: number;
  tasksCompleted: number;
  successRate: number;
}

/** Partial update payload for PUT /workers/{id}. */
export interface DexterWorkerUpdatePayload {
  name?: string;
  description?: string;
  instructions?: string;
  model?: string;
  provider?: string;
  status?: string;
  skills?: DexterWorkspaceSkill[];
  knowledge?: DexterKnowledgeItem[];
}

/** Session list item from GET /workers/{id}/sessions/recent. */
export interface DexterSession {
  sessionId: string;
  status: string | null;
  createdAt: string | null;
  messageCount: number | null;
}

/** Session detail with messages from GET /workers/{id}/sessions/{sessionId}. */
export interface DexterSessionDetail extends DexterSession {
  messages: Array<{ role: string; content: string; timestamp?: string }>;
}

/** Task list item from GET /workers/{id}/tasks. */
export interface DexterTask {
  taskId: string;
  sessionId: string;
  status: string | null;
  result: string | null;
  error: string | null;
  createdAt: string | null;
  completedAt: string | null;
}

/** Reachout signal from GET /workers/{id}/reachout. */
export interface DexterReachoutSignal {
  signalId: string;
  status: string | null;
  createdAt: string | null;
  [key: string]: unknown; // shape TBD — pass through extra fields
}

/**
 * Create a new worker on the Dexter Control Plane API.
 * Accepts 200/201/202 (async provisioning).
 */
export async function createDexterWorker(
  authFetch: AuthFetchFn,
  payload: DexterWorkerPayload,
): Promise<DexterWorkerResult> {
  const url = getDexterUrl('/workers');
  const requestBody = {
    name: payload.name,
    description: payload.description || '',
    instructions: payload.instructions || '',
    model: payload.model || 'claude-opus-4-7',
    provider: payload.provider || 'claude',
    ...(payload.email ? { email: payload.email } : {}),
    ...(payload.skills && payload.skills.length > 0 ? { skills: payload.skills } : {}),
    ...(payload.knowledge && payload.knowledge.length > 0 ? { knowledge: payload.knowledge } : {}),
  };
  const response = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  // Accept 200, 201 (sync), and 202 (async provisioning)
  if (!response.ok && response.status !== 202) {
    const body = await response.text().catch(() => '');
    console.error('[Dexter] Create worker failed:', response.status, body);
    throw new Error(`Failed to create Dexter worker: ${response.status} ${body}`);
  }

  const backendWorker = await response.json();
  return {
    id: backendWorker.id,
    lifecycleStatus: backendWorker.lifecycleStatus ?? backendWorker.lifecycle_status ?? null,
    lifecycleError: backendWorker.lifecycleError ?? backendWorker.lifecycle_error ?? null,
  };
}

/**
 * Fetch a single worker's current status from the Dexter API.
 */
export async function fetchDexterWorkerStatus(
  authFetch: AuthFetchFn,
  workerId: string,
): Promise<DexterWorkerResult | null> {
  const response = await authFetch(getDexterUrl(`/workers/${workerId}`));
  if (response.status === 404) { console.warn('[Dexter] Worker not found:', workerId); return null; }
  if (!response.ok) { console.warn('[Dexter] Poll failed:', response.status, response.statusText); return null; }

  const backendWorker = await response.json();
  return {
    id: backendWorker.id,
    lifecycleStatus: backendWorker.lifecycleStatus ?? backendWorker.lifecycle_status ?? null,
    lifecycleError: backendWorker.lifecycleError ?? backendWorker.lifecycle_error ?? null,
  };
}

/**
 * Start polling a worker's status every 30 seconds.
 * Calls `onUpdate` when the status changes, and auto-stops when no longer provisioning.
 */
export function startPollingWorker(
  authFetch: AuthFetchFn,
  workerId: string,
  onUpdate: (result: DexterWorkerResult) => void,
): void {
  // Don't start if already polling
  if (pollingIntervals.has(workerId)) return;

  const interval = setInterval(async () => {
    try {
      const result = await fetchDexterWorkerStatus(authFetch, workerId);
      if (!result) {
        stopPollingWorker(workerId);
        return;
      }

      onUpdate(result);

      // Stop polling once no longer provisioning
      if (result.lifecycleStatus !== 'provisioning') {
        stopPollingWorker(workerId);
      }
    } catch (error) {
      console.error(`[Dexter] Error polling worker ${workerId}:`, error);
    }
  }, POLL_INTERVAL_MS);

  pollingIntervals.set(workerId, interval);
}

/**
 * Stop polling a specific worker.
 */
export function stopPollingWorker(workerId: string): void {
  const interval = pollingIntervals.get(workerId);
  if (interval) {
    clearInterval(interval);
    pollingIntervals.delete(workerId);
  }
}

/**
 * Stop all active polling (e.g., on unmount).
 */
export function stopAllPolling(): void {
  pollingIntervals.forEach(interval => clearInterval(interval));
  pollingIntervals.clear();
}

/**
 * List all workers for the authenticated user's tenant.
 * GET /workers (scoped by auth token's tenantId server-side)
 */
export async function listDexterWorkers(
  authFetch: AuthFetchFn,
): Promise<DexterWorker[]> {
  const url = getDexterUrl('/workers');
  const response = await authFetch(url);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to list workers: ${response.status} ${body}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : data.value ?? data.workers ?? [];
}

/**
 * Delete a worker via the Control Plane (which internally deprovisions the VMSS).
 * DELETE /workers/{workerId}
 */
export async function deleteDexterWorker(
  authFetch: AuthFetchFn,
  workerId: string,
): Promise<void> {
  const url = getDexterUrl(`/workers/${encodeURIComponent(workerId)}`);
  const response = await authFetch(url, { method: 'DELETE' });

  if (!response.ok && response.status !== 204) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to delete worker: ${response.status} ${body}`);
  }
}

/**
 * Fetch full detail for a single worker.
 * GET /workers/{workerId}
 */
export async function fetchDexterWorkerDetail(
  authFetch: AuthFetchFn,
  workerId: string,
): Promise<DexterWorkerDetail> {
  const url = getDexterUrl(`/workers/${encodeURIComponent(workerId)}`);
  const response = await authFetch(url);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to fetch worker detail: ${response.status} ${body}`);
  }

  const w = await response.json();
  return mapWorkerDetail(w);
}

/**
 * Update a worker's fields.
 * PUT /workers/{workerId}
 */
export async function updateDexterWorker(
  authFetch: AuthFetchFn,
  workerId: string,
  payload: DexterWorkerUpdatePayload,
): Promise<DexterWorkerDetail> {
  const url = getDexterUrl(`/workers/${encodeURIComponent(workerId)}`);
  const response = await authFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to update worker: ${response.status} ${body}`);
  }

  const w = await response.json();
  return mapWorkerDetail(w);
}

/** Map raw API response to DexterWorkerDetail, handling both camelCase and snake_case. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapWorkerDetail(w: Record<string, any>): DexterWorkerDetail {
  return {
    id: w.id,
    name: w.name ?? '',
    description: w.description ?? null,
    email: w.email ?? null,
    instructions: w.instructions ?? null,
    status: w.status ?? null,
    lifecycleStatus: w.lifecycleStatus ?? w.lifecycle_status ?? null,
    lifecycleError: w.lifecycleError ?? w.lifecycle_error ?? null,
    model: w.model ?? null,
    provider: w.provider ?? null,
    createdAt: w.createdAt ?? w.created_at ?? null,
    updatedAt: w.updatedAt ?? w.updated_at ?? null,
    tenantId: w.tenantId ?? w.tenant_id ?? null,
    agenticAppId: w.agenticAppId ?? w.agentic_app_id ?? null,
    agenticUserId: w.agenticUserId ?? w.agentic_user_id ?? null,
    skills: Array.isArray(w.skills) ? w.skills.map((s: Record<string, any>) => ({
      name: s.name ?? '',
      description: s.description ?? '',
      instructions: s.instructions ?? '',
      tools: Array.isArray(s.tools) ? s.tools.map((t: Record<string, any>) => ({
        type: t.type ?? 'unknown',
        url: t.url,
        packageName: t.packageName ?? t.package_name,
        connectorName: t.connectorName ?? t.connector_name,
      })) : [],
      knowledge: Array.isArray(s.knowledge) ? s.knowledge.map((k: Record<string, any>) => ({
        type: k.type ?? 'uri',
        value: k.value ?? '',
        name: k.name,
      })) : [],
      model: s.model ?? null,
      enabled: s.enabled ?? true,
    })) : [],
    knowledge: Array.isArray(w.knowledge) ? w.knowledge.map((k: Record<string, any>) => ({
      type: k.type ?? 'uri',
      value: k.value ?? '',
      name: k.name,
    })) : [],
    skillsCount: w.skillsCount ?? w.skills_count ?? 0,
    tasksCompleted: w.tasksCompleted ?? w.tasks_completed ?? 0,
    successRate: w.successRate ?? w.success_rate ?? 0,
  };
}

/**
 * List recent sessions for a worker.
 * GET /workers/{workerId}/sessions/recent
 */
export async function listDexterWorkerSessions(
  authFetch: AuthFetchFn,
  workerId: string,
): Promise<DexterSession[]> {
  const url = getDexterUrl(`/workers/${encodeURIComponent(workerId)}/sessions/recent`);
  const response = await authFetch(url);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to list sessions: ${response.status} ${body}`);
  }

  const data = await response.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: Record<string, any>[] = Array.isArray(data) ? data : data.value ?? data.sessions ?? [];
  return items.map(s => ({
    sessionId: s.sessionId ?? s.session_id ?? s.id ?? '',
    status: s.status ?? null,
    createdAt: s.createdAt ?? s.created_at ?? null,
    messageCount: s.messageCount ?? s.message_count ?? null,
  }));
}

/**
 * Fetch detail for a specific session (including messages).
 * GET /workers/{workerId}/sessions/{sessionId}
 */
export async function fetchDexterSessionDetail(
  authFetch: AuthFetchFn,
  workerId: string,
  sessionId: string,
): Promise<DexterSessionDetail> {
  const url = getDexterUrl(`/workers/${encodeURIComponent(workerId)}/sessions/${encodeURIComponent(sessionId)}`);
  const response = await authFetch(url);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to fetch session detail: ${response.status} ${body}`);
  }

  const s = await response.json();
  return {
    sessionId: s.sessionId ?? s.session_id ?? s.id ?? '',
    status: s.status ?? null,
    createdAt: s.createdAt ?? s.created_at ?? null,
    messageCount: s.messageCount ?? s.message_count ?? null,
    messages: Array.isArray(s.messages) ? s.messages : [],
  };
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

/**
 * List all tasks for a worker.
 * GET /workers/{workerId}/tasks
 */
export async function listDexterTasks(
  authFetch: AuthFetchFn,
  workerId: string,
): Promise<DexterTask[]> {
  const url = getDexterUrl(`/workers/${encodeURIComponent(workerId)}/tasks`);
  const response = await authFetch(url);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to list tasks: ${response.status} ${body}`);
  }

  const data = await response.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: Record<string, any>[] = Array.isArray(data) ? data : data.value ?? data.tasks ?? [];
  return items.map(t => ({
    taskId: t.taskId ?? t.task_id ?? t.id ?? '',
    sessionId: t.sessionId ?? t.session_id ?? '',
    status: t.status ?? null,
    result: t.result ?? null,
    error: t.error ?? null,
    createdAt: t.createdAt ?? t.created_at ?? null,
    completedAt: t.completedAt ?? t.completed_at ?? null,
  }));
}

/**
 * Fetch a specific task by ID.
 * GET /workers/{workerId}/tasks/{taskId}
 */
export async function fetchDexterTask(
  authFetch: AuthFetchFn,
  workerId: string,
  taskId: string,
): Promise<DexterTask> {
  const url = getDexterUrl(`/workers/${encodeURIComponent(workerId)}/tasks/${encodeURIComponent(taskId)}`);
  const response = await authFetch(url);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to fetch task: ${response.status} ${body}`);
  }

  const t = await response.json();
  return {
    taskId: t.taskId ?? t.task_id ?? t.id ?? '',
    sessionId: t.sessionId ?? t.session_id ?? '',
    status: t.status ?? null,
    result: t.result ?? null,
    error: t.error ?? null,
    createdAt: t.createdAt ?? t.created_at ?? null,
    completedAt: t.completedAt ?? t.completed_at ?? null,
  };
}

// ---------------------------------------------------------------------------
// Memory (proxied through Bobby — 3 sub-endpoints)
// ---------------------------------------------------------------------------

/**
 * Fetch shared (user-wide) memory.
 * GET /workers/{workerId}/memory/shared
 */
export async function fetchDexterSharedMemory(
  authFetch: AuthFetchFn,
  workerId: string,
): Promise<unknown> {
  const url = getDexterUrl(`/workers/${encodeURIComponent(workerId)}/memory/shared`);
  const response = await authFetch(url);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to fetch shared memory: ${response.status} ${body}`);
  }
  return response.json();
}

/**
 * List short-term memory files.
 * GET /workers/{workerId}/memory/short-term/files
 */
export async function listDexterShortTermMemoryFiles(
  authFetch: AuthFetchFn,
  workerId: string,
): Promise<unknown> {
  const url = getDexterUrl(`/workers/${encodeURIComponent(workerId)}/memory/short-term/files`);
  const response = await authFetch(url);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to list short-term memory files: ${response.status} ${body}`);
  }
  return response.json();
}

/**
 * Fetch short-term memory for a specific date.
 * GET /workers/{workerId}/memory/short-term/{date}  (YYYY-MM-DD)
 */
export async function fetchDexterShortTermMemory(
  authFetch: AuthFetchFn,
  workerId: string,
  date: string,
): Promise<unknown> {
  const url = getDexterUrl(`/workers/${encodeURIComponent(workerId)}/memory/short-term/${encodeURIComponent(date)}`);
  const response = await authFetch(url);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to fetch short-term memory: ${response.status} ${body}`);
  }
  return response.json();
}

/**
 * Fetch long-term memory.
 * GET /workers/{workerId}/memory/long-term
 */
export async function fetchDexterLongTermMemory(
  authFetch: AuthFetchFn,
  workerId: string,
): Promise<unknown> {
  const url = getDexterUrl(`/workers/${encodeURIComponent(workerId)}/memory/long-term`);
  const response = await authFetch(url);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to fetch long-term memory: ${response.status} ${body}`);
  }
  return response.json();
}

// ---------------------------------------------------------------------------
// Reachout Signals
// ---------------------------------------------------------------------------

/**
 * List reachout signals for a worker.
 * GET /workers/{workerId}/reachout
 */
export async function listDexterReachoutSignals(
  authFetch: AuthFetchFn,
  workerId: string,
): Promise<DexterReachoutSignal[]> {
  const url = getDexterUrl(`/workers/${encodeURIComponent(workerId)}/reachout`);
  const response = await authFetch(url);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to list reachout signals: ${response.status} ${body}`);
  }

  const data = await response.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: Record<string, any>[] = Array.isArray(data) ? data : data.value ?? data.signals ?? [];
  return items.map(s => ({
    ...s,
    signalId: s.signalId ?? s.signal_id ?? s.id ?? '',
    status: s.status ?? null,
    createdAt: s.createdAt ?? s.created_at ?? null,
  }));
}

/**
 * Fetch a specific reachout signal.
 * GET /workers/{workerId}/reachout/{signalId}
 */
export async function fetchDexterReachoutSignal(
  authFetch: AuthFetchFn,
  workerId: string,
  signalId: string,
): Promise<DexterReachoutSignal> {
  const url = getDexterUrl(`/workers/${encodeURIComponent(workerId)}/reachout/${encodeURIComponent(signalId)}`);
  const response = await authFetch(url);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to fetch reachout signal: ${response.status} ${body}`);
  }

  const s = await response.json();
  return {
    ...s,
    signalId: s.signalId ?? s.signal_id ?? s.id ?? '',
    status: s.status ?? null,
    createdAt: s.createdAt ?? s.created_at ?? null,
  };
}

/**
 * Cancel a reachout signal.
 * POST /workers/{workerId}/reachout/{signalId}/cancel
 */
export async function cancelDexterReachoutSignal(
  authFetch: AuthFetchFn,
  workerId: string,
  signalId: string,
): Promise<void> {
  const url = getDexterUrl(`/workers/${encodeURIComponent(workerId)}/reachout/${encodeURIComponent(signalId)}/cancel`);
  const response = await authFetch(url, { method: 'POST' });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to cancel reachout signal: ${response.status} ${body}`);
  }
}

