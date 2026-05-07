/**
 * chatStream.ts — Frontend client for the unified /api/chat SSE endpoint.
 *
 * Native EventSource only supports GET, so we use fetch + ReadableStream
 * to consume the SSE stream over POST.
 *
 * Event envelope is defined server-side at app/lib/chat/event-protocol.js.
 * Stable types — frontend treats unknown event types as ignorable for
 * forward-compat.
 */

export interface ChatStreamEvent {
  type:
    | 'hello'
    | 'message_start'
    | 'message_delta'
    | 'message_done'
    | 'action_requested'
    | 'action_completed'
    | 'artifact_updated'
    | 'job_started'
    | 'job_progress'
    | 'job_completed'
    | 'error'
    | 'done';
  ts: number;
  [key: string]: any;
}

export interface ChatStreamRequest {
  message: string;
  projectId?: string;
  agentId?: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  attachments?: Array<{ name: string; content?: string; kind?: string }>;
  toolCallResponse?: { toolCallId: string; decision: 'confirm' | 'decline' };
  sessionId?: string;
}

export interface ChatStreamHandlers {
  onHello?: (e: ChatStreamEvent) => void;
  onMessageStart?: (e: ChatStreamEvent) => void;
  onMessageDelta?: (e: ChatStreamEvent) => void;
  onMessageDone?: (e: ChatStreamEvent) => void;
  onActionRequested?: (e: ChatStreamEvent) => void;
  onActionCompleted?: (e: ChatStreamEvent) => void;
  onArtifactUpdated?: (e: ChatStreamEvent) => void;
  onJobStarted?: (e: ChatStreamEvent) => void;
  onJobProgress?: (e: ChatStreamEvent) => void;
  onJobCompleted?: (e: ChatStreamEvent) => void;
  onError?: (e: ChatStreamEvent) => void;
  onDone?: (e: ChatStreamEvent) => void;
  onAny?: (e: ChatStreamEvent) => void;
}

const DISPATCH: Record<string, keyof ChatStreamHandlers> = {
  hello: 'onHello',
  message_start: 'onMessageStart',
  message_delta: 'onMessageDelta',
  message_done: 'onMessageDone',
  action_requested: 'onActionRequested',
  action_completed: 'onActionCompleted',
  artifact_updated: 'onArtifactUpdated',
  job_started: 'onJobStarted',
  job_progress: 'onJobProgress',
  job_completed: 'onJobCompleted',
  error: 'onError',
  done: 'onDone',
};

/**
 * Open a chat stream against /api/chat. Returns a controller with
 * `cancel()` so the caller can abort mid-stream (the server will see
 * res.on('close') fire and tear down its work).
 */
export function streamChat(
  req: ChatStreamRequest,
  handlers: ChatStreamHandlers,
  endpoint = '/api/chat'
): { cancel: () => void; finished: Promise<void> } {
  const controller = new AbortController();

  const finished = (async () => {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(req.sessionId ? { 'X-Session-Id': req.sessionId } : {}),
        },
        body: JSON.stringify({
          message: req.message,
          projectId: req.projectId,
          agentId: req.agentId,
          history: req.history,
          attachments: req.attachments,
          toolCallResponse: req.toolCallResponse,
        }),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      handlers.onError?.({ type: 'error', ts: Date.now(), code: 'fetch_failed', message: err?.message || String(err) });
      return;
    }

    if (!response.ok || !response.body) {
      handlers.onError?.({
        type: 'error',
        ts: Date.now(),
        code: 'http_error',
        message: `chat endpoint returned ${response.status}`,
      });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Split on blank-line event boundaries (SSE framing)
        let boundary;
        // eslint-disable-next-line no-cond-assign
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const raw = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const evt = parseSseFrame(raw);
          if (!evt) continue;
          const handlerKey = DISPATCH[evt.type];
          if (handlerKey && handlers[handlerKey]) {
            (handlers[handlerKey] as (e: ChatStreamEvent) => void)(evt);
          }
          handlers.onAny?.(evt);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      handlers.onError?.({
        type: 'error',
        ts: Date.now(),
        code: 'stream_read_failed',
        message: err?.message || String(err),
      });
    }
  })();

  return {
    cancel: () => { try { controller.abort(); } catch { /* noop */ } },
    finished,
  };
}

function parseSseFrame(raw: string): ChatStreamEvent | null {
  // Each frame is several "key: value" lines. We only care about the data line.
  const lines = raw.split('\n');
  let dataLine = '';
  for (const line of lines) {
    if (line.startsWith('data:')) {
      // Multi-line data accumulates with newlines (per SSE spec)
      dataLine += (dataLine ? '\n' : '') + line.slice(5).trimStart();
    }
  }
  if (!dataLine) return null;
  try {
    const parsed = JSON.parse(dataLine);
    if (parsed && typeof parsed.type === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}
